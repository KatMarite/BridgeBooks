"""
normalize_booksite.py — Cleans and normalizes raw Booksite (Jonathan Ball) FTPS data.

Input:  Pipe-delimited CSV from FTPS (no header row)
Output: Cleaned CSV with standardized column names matching the BridgeBooks schema.

Logs normalization results (valid/skipped row counts, parse errors) to the
ingestion_events and ingestion_errors tables.
"""

from pathlib import Path
import sys
import pandas as pd

# Add backend root to path for shared utils
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))
from utils.ingestion_logger import IngestionLogger
from utils.cleaners import clean_isbn, clean_price, clean_stock

# ----------------------------
# PATHS
# ----------------------------
BASE_DIR = Path(__file__).resolve().parent
RAW_FILE = BASE_DIR / ".." / "downloads" / "JBPStock.csv"
OUTPUT_FILE = BASE_DIR / "normalized_output.csv"

FILE_NAME = RAW_FILE.name
logger = IngestionLogger('booksite', f"normalize_{FILE_NAME}")
logger.start()

print("Loading:", RAW_FILE)

if not RAW_FILE.exists():
    logger.add_error(f"Raw CSV not found at {RAW_FILE}")
    logger.finish('error', f"Normalization failed: {FILE_NAME} not found")
    raise FileNotFoundError(f"Raw CSV not found at {RAW_FILE}. Run FTP download first.")

# ----------------------------
# READ PIPE-DELIMITED CSV (NO HEADER)
# ----------------------------
COLUMN_NAMES = [
    "isbn_13", "title", "author", "publication_date",
    "publisher", "stock_status", "retail_price", "discount", "category",
]

try:
    df = pd.read_csv(
        RAW_FILE, sep="|", header=None, names=COLUMN_NAMES,
        dtype={"isbn_13": str}, on_bad_lines="skip",
    )
except Exception as e:
    logger.add_error(f"CSV parse error: {e}")
    logger.finish('error', f"Normalization failed: could not parse {FILE_NAME}")
    raise

total_raw = len(df)
print(f"  Raw rows loaded: {total_raw}")

# ----------------------------
# CLEAN DATA
# ----------------------------
for col in ["isbn_13", "title", "author", "publisher", "stock_status", "category"]:
    if col in df.columns:
        df[col] = df[col].astype(str).str.strip()

# Clean ISBNs and drop invalid ones
before_isbn = len(df)
df['isbn_13'] = df['isbn_13'].apply(clean_isbn)
df = df.dropna(subset=['isbn_13'])
isbn_dropped = before_isbn - len(df)
if isbn_dropped > 0:
    logger.add_error(f"Dropped {isbn_dropped} rows with invalid ISBNs")

# Track rows with missing titles
missing_titles = df["title"].isin(["", "nan", "None"]).sum()
if missing_titles > 0:
    logger.add_error(f"{missing_titles} rows have missing or empty titles")

# Normalize stock status using cleaner
df["in_stock"] = df["stock_status"].apply(clean_stock)

# Parse retail price using cleaner
df["retail_price"] = df["retail_price"].apply(clean_price)

df["discount"] = pd.to_numeric(df["discount"], errors="coerce").fillna(0)
df["supplier_name"] = "booksite"

# ----------------------------
# SELECT OUTPUT COLUMNS & SAVE
# ----------------------------
output_cols = [
    "isbn_13", "title", "author", "publication_date",
    "publisher", "retail_price", "discount", "in_stock", "category", "supplier_name",
]
df = df[output_cols]

OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(OUTPUT_FILE, index=False)

logger.records_processed = total_raw
logger.records_inserted = len(df)
logger.finish(
    status='success',
    message=f"Booksite normalization: {len(df)}/{total_raw} rows valid, {isbn_dropped} invalid ISBNs dropped"
)