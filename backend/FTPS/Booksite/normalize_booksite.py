"""
normalize_booksite.py — Cleans and normalizes raw Booksite stock data.

Booksite format: comma-delimited CSV with quoted string fields.
Columns (from Booksite FTP documentation):
  0  Division/Publisher  (str)
  1  ISBN                (str)
  2  Title               (str)
  3  Author              (str)
  4  Release Date        (str)  — may be "0001-01-01" for unknown
  5  Item Status         (str)  — Booksite internal code
  6  Available Qty       (int)  — can be negative (back-order/oversold)
  7  Retail Price        (float)
  8  Weight kg           (float)
  9  Stock Status        (str)  — "C" = current, "D" = discontinued, "O" = out of stock
  10 Substitute ISBN     (str)  — optional, sometimes same as ISBN

Outputs: normalized_output.csv for insert_books.py

Usage:
    python3 normalize_booksite.py
"""

import csv
import sys
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from utils.ingestion_logger import IngestionLogger
from utils.cleaners import clean_isbn, clean_price

# Load DATABASE_URL so IngestionLogger can actually write its audit log
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# ----------------------------
# PATHS
# ----------------------------
BS_DIR      = Path(__file__).resolve().parent
RAW_FILE    = BS_DIR / "downloads" / "itemmast.txt"
OUTPUT_FILE = BS_DIR / "normalized_output.csv"
LOG_FILE    = BS_DIR / "logs" / "normalize_errors.log"

SUPPLIER_NAME = "booksite"

logger = IngestionLogger(SUPPLIER_NAME, f"normalize_{RAW_FILE.name}")
logger.start()

if not RAW_FILE.exists():
    logger.add_error(f"itemmast.txt not found at {RAW_FILE}")
    logger.finish("error", "Normalization failed: run ftp_download.py first")
    raise FileNotFoundError(f"Not found: {RAW_FILE}. Run ftp_download.py first.")

print(f"Loading: {RAW_FILE}")

# ----------------------------
# STOCK STATUS MAPPING
# ----------------------------
STOCK_STATUS_MAP = {
    "C": True,   # Current — in stock
    "A": True,   # Active
    "N": True,   # New
    "O": False,  # Out of stock
    "D": False,  # Discontinued
    "S": False,  # Superseded
    "X": False,  # Deleted
}

def parse_in_stock(status_code: str, available_qty: int) -> bool:
    """Determine in-stock status from status code and available quantity."""
    if status_code.upper() in STOCK_STATUS_MAP:
        return STOCK_STATUS_MAP[status_code.upper()] and available_qty > 0
    # Fallback: trust the quantity
    return available_qty > 0

def clean_pub_date(raw: str) -> str | None:
    """Normalise publication date. Returns YYYY-MM-DD or None."""
    if not raw or raw.strip() in ("", "0001-01-01", "nan"):
        return None
    return raw.strip()

def clean_weight(raw) -> float | None:
    """Return weight in grams (Booksite supplies kg)."""
    try:
        kg = float(str(raw).strip())
        if kg > 0:
            return round(kg * 1000, 1)   # Convert kg → grams
    except (ValueError, TypeError):
        pass
    return None

# ----------------------------
# PARSE
# ----------------------------
valid_rows = []
bad_rows   = []
total_raw  = 0

# Booksite files may use cp1252 encoding (Windows)
for encoding in ("utf-8", "cp1252", "latin1"):
    try:
        with open(RAW_FILE, encoding=encoding, newline="") as f:
            reader = csv.reader(f)
            for i, row in enumerate(reader):
                total_raw += 1

                # Skip empty or very short rows
                if len(row) < 8:
                    bad_rows.append(f"Row {i+1}: too few columns ({len(row)})")
                    continue

                try:
                    publisher     = row[0].strip()
                    raw_isbn      = row[1].strip()
                    title         = row[2].strip()
                    author        = row[3].strip()
                    release_date  = clean_pub_date(row[4])
                    item_status   = row[5].strip()
                    available_qty = int(float(row[6])) if row[6].strip() else 0
                    retail_price  = clean_price(row[7])
                    weight_g      = clean_weight(row[8]) if len(row) > 8 else None
                    stock_status  = row[9].strip() if len(row) > 9 else ""
                    sub_isbn      = clean_isbn(row[10]) if len(row) > 10 else None

                    isbn_13 = clean_isbn(raw_isbn)
                    if not isbn_13:
                        raise ValueError(f"Invalid ISBN: '{raw_isbn}'")
                    if not title:
                        raise ValueError("Missing title")

                    in_stock = parse_in_stock(stock_status, available_qty)

                    valid_rows.append({
                        "isbn_13":          isbn_13,
                        "title":            title,
                        "author":           author or None,
                        "publisher":        publisher or None,
                        "publication_date": release_date,
                        "retail_price":     retail_price,
                        "available_qty":    available_qty,
                        "weight_grams":     weight_g,
                        "in_stock":         in_stock,
                        "stock_status":     stock_status,
                        "item_status":      item_status,
                        "substitute_isbn":  sub_isbn,
                        "supplier_name":    SUPPLIER_NAME,
                    })

                except Exception as e:
                    bad_rows.append(f"Row {i+1}: {e}")
                    continue

        encoding_used = encoding
        print(f"Loaded with encoding: {encoding}")
        break

    except UnicodeDecodeError:
        total_raw = 0
        valid_rows = []
        bad_rows = []
        continue
else:
    logger.finish("error", "Could not decode itemmast.txt with any encoding")
    raise ValueError("Encoding detection failed for itemmast.txt")

# ----------------------------
# LOG ERRORS
# ----------------------------
for err in bad_rows[:50]:
    logger.add_error(err)
if len(bad_rows) > 50:
    logger.add_error(f"... and {len(bad_rows) - 50} more row-level errors (see log file)")

LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
with open(LOG_FILE, "w", encoding="utf-8") as f:
    for err in bad_rows:
        f.write(err + "\n")

# ----------------------------
# WRITE OUTPUT CSV
# ----------------------------
if valid_rows:
    fieldnames = list(valid_rows[0].keys())
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(valid_rows)

# ----------------------------
# SUMMARY
# ----------------------------
logger.records_processed = total_raw
logger.records_inserted  = len(valid_rows)
msg = (
    f"Booksite normalization: {len(valid_rows):,}/{total_raw:,} rows valid, "
    f"{len(bad_rows):,} skipped. Encoding: {encoding_used}."
)
logger.finish("success", msg)
print(f"\n{msg}")
print(f"Output: {OUTPUT_FILE}")
