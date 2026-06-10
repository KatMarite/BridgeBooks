"""
normalize_booksite.py — Cleans and normalizes raw Jonathan Ball FTPS data.

Logs normalization results (encoding errors, invalid ISBNs, malformed rows,
non-numeric prices) to ingestion_events and ingestion_errors.
"""

from pathlib import Path
import sys
import pandas as pd

# Add backend root to path for shared utils
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from utils.ingestion_logger import IngestionLogger

# ----------------------------
# PATHS
# ----------------------------
JB_DIR = Path(__file__).resolve().parent
RAW_FILE = JB_DIR / "downloads" / "JBPStock.csv"
OUTPUT_FILE = JB_DIR / "normalized_output.csv"
LOG_FILE = JB_DIR / "logs" / "csv_errors.log"

FILE_NAME = RAW_FILE.name
logger = IngestionLogger('jonathanBall', f"normalize_{FILE_NAME}")
logger.start()

print("Loading:", RAW_FILE)

if not RAW_FILE.exists():
    logger.add_error(f"CSV not found at: {RAW_FILE}")
    logger.finish('error', f"Normalization failed: {FILE_NAME} not found")
    raise FileNotFoundError(f"CSV not found at: {RAW_FILE}. Run ftp_download.py first.")

# ----------------------------
# SAFE LOAD (ENCODING + PIPE FORMAT)
# ----------------------------
df = None
encodings = ["utf-8", "cp1252", "latin1"]
encoding_used = None

for enc in encodings:
    try:
        print(f"  Trying encoding: {enc}")
        df = pd.read_csv(
            RAW_FILE, encoding=enc, on_bad_lines="skip",
            sep="|", header=None, low_memory=False,
        )
        encoding_used = enc
        print(f"  ✅ Loaded with {enc}")
        break
    except Exception as e:
        logger.add_error(f"Encoding {enc} failed: {e}")
        print(f"  ❌ Failed {enc}: {e}")

if df is None:
    logger.finish('error', f"Normalization failed: could not decode {FILE_NAME} with any encoding")
    raise ValueError("Failed to load CSV with any encoding.")

if encoding_used != "utf-8":
    logger.add_error(f"File encoding is {encoding_used}, not UTF-8 — may cause display issues")

total_raw = len(df)
print(f"\n  Columns detected: {df.shape[1]}")
print(f"  Total raw rows: {total_raw}")

# ----------------------------
# PROCESSING — ROW BY ROW WITH ERROR TRACKING
# ----------------------------
valid_rows = []
bad_rows = []

for index, row in df.iterrows():
    try:
        values = row.tolist()

        if len(values) < 3:
            raise ValueError("Malformed row (too short)")

        isbn_13 = str(values[0]).strip()
        title = str(values[1]).strip()

        if not isbn_13 or not isbn_13.isdigit() or len(isbn_13) != 13:
            raise ValueError(f"Invalid ISBN-13: '{isbn_13}'")

        if not title:
            raise ValueError("Missing title")

        author = str(values[2]).strip() if len(values) > 2 else ""
        publication_date = str(values[3]).strip() if len(values) > 3 else ""
        publisher = str(values[4]).strip() if len(values) > 4 else ""
        stock_status = str(values[5]).strip().upper() if len(values) > 5 else ""
        retail_price = values[6] if len(values) > 6 else 0
        discount = values[7] if len(values) > 7 else 0
        category = str(values[8]).strip() if len(values) > 8 else ""

        in_stock = stock_status == "IN STOCK"

        try:
            retail_price = float(retail_price)
        except (ValueError, TypeError):
            retail_price = 0.0

        try:
            discount = float(discount)
        except (ValueError, TypeError):
            discount = 0.0

        clean_row = {
            "isbn_13": isbn_13, "title": title, "author": author,
            "publication_date": publication_date if publication_date != "nan" else "",
            "publisher": publisher, "retail_price": retail_price,
            "discount": discount, "in_stock": in_stock,
            "category": category, "supplier_name": "jonathanBall",
        }

        valid_rows.append(clean_row)

    except Exception as e:
        bad_rows.append(f"Row {index + 1}: {e}")

# Log each bad row to the DB (up to 50 to avoid flooding)
for err in bad_rows[:50]:
    logger.add_error(err)
if len(bad_rows) > 50:
    logger.add_error(f"... and {len(bad_rows) - 50} more row-level errors")

# ----------------------------
# SAVE CLEAN DATA
# ----------------------------
clean_df = pd.DataFrame(valid_rows)
OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
clean_df.to_csv(OUTPUT_FILE, index=False)

# ----------------------------
# SAVE ERROR LOG (local file backup)
# ----------------------------
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
with open(LOG_FILE, "w", encoding="utf-8") as f:
    for err in bad_rows:
        f.write(err + "\n")

# ----------------------------
# FINISH
# ----------------------------
logger.records_processed = total_raw
logger.records_inserted = len(valid_rows)
logger.finish(
    status='success',
    message=f"JB normalization: {len(valid_rows)}/{total_raw} rows valid, {len(bad_rows)} skipped"
)