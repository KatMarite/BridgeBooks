"""
normalize_protea.py — Cleans and normalizes raw Protea email attachments.

Input:  CSV or Excel file downloaded from email
Output: Cleaned CSV with standardized column names matching BridgeBooks schema.

Logs normalization events and errors to the ingestion_events/ingestion_errors tables.

NOTE: The column mapping below is a template. Once a real Protea stock file is
received, update the column name mapping to match their specific format.
"""

from pathlib import Path
import sys
import pandas as pd

# Add backend root to path for shared utils
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from utils.ingestion_logger import IngestionLogger
from utils.cleaners import clean_isbn, clean_price, clean_stock

# ----------------------------
# PATHS
# ----------------------------
PROTEA_DIR = Path(__file__).resolve().parent
DOWNLOAD_DIR = PROTEA_DIR / "downloads"
OUTPUT_FILE = PROTEA_DIR / "normalized_output.csv"

# Find the newest downloaded file
downloaded_files = list(DOWNLOAD_DIR.glob("*.*"))

logger = IngestionLogger('protea', 'normalize_protea')
logger.start()

if not downloaded_files:
    logger.add_error("No raw files found in downloads/ — run email_download.py first")
    logger.finish('error', "Normalization failed: no input files found")
    raise FileNotFoundError("No raw files found. Run email_download.py first.")

RAW_FILE = max(downloaded_files, key=lambda p: p.stat().st_mtime)
logger.file_name = f"normalize_{RAW_FILE.name}"
print(f"Loading latest file: {RAW_FILE.name}")

# ----------------------------
# READ DATA
# ----------------------------
try:
    if RAW_FILE.suffix.lower() in ['.xlsx', '.xls']:
        df = pd.read_excel(RAW_FILE)
    else:
        # Try multiple encodings
        df = None
        for enc in ["utf-8", "cp1252", "latin1"]:
            try:
                df = pd.read_csv(RAW_FILE, encoding=enc, on_bad_lines="skip")
                break
            except Exception as e:
                logger.add_error(f"Encoding {enc} failed for {RAW_FILE.name}: {e}")

        if df is None:
            logger.finish('error', f"Normalization failed: could not decode {RAW_FILE.name}")
            raise ValueError(f"Could not decode {RAW_FILE.name} with any encoding")

except Exception as e:
    logger.add_error(f"File read error: {e}")
    logger.finish('error', f"Normalization failed: {e}")
    raise

total_raw = len(df)
print(f"  Loaded {total_raw} rows, {df.shape[1]} columns")
print(f"  Columns: {list(df.columns)}")

# ----------------------------
# COLUMN MAPPING
# ----------------------------
# TODO: Update this mapping when a real Protea file is received.
# For now, we attempt to auto-detect common column name patterns.

column_map = {}
for col in df.columns:
    lower = str(col).lower().strip()
    std_name = None
    if 'isbn' in lower:
        std_name = 'isbn_13'
    elif lower in ['title', 'book title', 'product name']:
        std_name = 'title'
    elif lower in ['author', 'writer', 'author name']:
        std_name = 'author'
    elif lower in ['publisher', 'imprint']:
        std_name = 'publisher'
    elif 'price' in lower and 'cost' not in lower:
        std_name = 'retail_price'
    elif lower in ['category', 'genre', 'subject']:
        std_name = 'category'
    elif 'stock' in lower or 'qty' in lower or 'quantity' in lower:
        std_name = 'stock_qty'
    elif 'date' in lower and 'pub' in lower:
        std_name = 'publication_date'

    if std_name and std_name not in column_map.values():
        column_map[col] = std_name

if column_map:
    df = df.rename(columns=column_map)
    print(f"  Auto-mapped columns: {column_map}")
else:
    logger.add_error(f"Could not auto-map any columns. Headers: {list(df.columns)}")
    logger.finish('warning', f"Normalization warning: column mapping needs manual configuration for {RAW_FILE.name}")
    print("⚠️  No columns auto-mapped. Manual configuration needed.")
    # Still save what we have so a developer can inspect it
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_FILE, index=False)
    raise SystemExit(0)

# Ensure required columns exist
required = ['isbn_13', 'title']
missing = [c for c in required if c not in df.columns]
if missing:
    logger.add_error(f"Missing required columns after mapping: {missing}")
    logger.finish('error', f"Normalization failed: missing columns {missing}")
    raise ValueError(f"Missing required columns: {missing}")

# ----------------------------
# CLEAN DATA
# ----------------------------
# Validate ISBN
if 'isbn_13' in df.columns:
    df['isbn_13'] = df['isbn_13'].apply(clean_isbn)
    before = len(df)
    df = df.dropna(subset=['isbn_13'])
    dropped = before - len(df)
    if dropped > 0:
        logger.add_error(f"Dropped {dropped} rows with invalid ISBNs")

# Parse price
if 'retail_price' in df.columns:
    df['retail_price'] = df['retail_price'].apply(clean_price)

# Stock status
if 'stock_qty' in df.columns:
    df['in_stock'] = df['stock_qty'].apply(clean_stock)
else:
    df['in_stock'] = True  # Assume in-stock if no stock column

df['supplier_name'] = 'protea'

# ----------------------------
# SAVE
# ----------------------------
OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(OUTPUT_FILE, index=False)

logger.records_processed = total_raw
logger.records_inserted = len(df)
logger.finish(
    status='success',
    message=f"Protea normalization: {len(df)}/{total_raw} rows valid from {RAW_FILE.name}"
)
