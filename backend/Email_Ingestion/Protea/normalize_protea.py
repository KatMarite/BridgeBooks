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
    if 'isbn' in lower:
        column_map[col] = 'isbn_13'
    elif lower in ['title', 'book title', 'product name']:
        column_map[col] = 'title'
    elif lower in ['author', 'writer', 'author name']:
        column_map[col] = 'author'
    elif lower in ['publisher', 'imprint']:
        column_map[col] = 'publisher'
    elif 'price' in lower and 'cost' not in lower:
        column_map[col] = 'retail_price'
    elif lower in ['category', 'genre', 'subject']:
        column_map[col] = 'category'
    elif 'stock' in lower or 'qty' in lower or 'quantity' in lower:
        column_map[col] = 'stock_qty'
    elif 'date' in lower and 'pub' in lower:
        column_map[col] = 'publication_date'

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
    df['isbn_13'] = df['isbn_13'].astype(str).str.strip()
    before = len(df)
    df = df[df['isbn_13'].str.match(r'^\d{13}$', na=False)]
    dropped = before - len(df)
    if dropped > 0:
        logger.add_error(f"Dropped {dropped} rows with invalid ISBN-13")

# Parse price
if 'retail_price' in df.columns:
    bad_prices = pd.to_numeric(df['retail_price'], errors='coerce').isna().sum()
    if bad_prices > 0:
        logger.add_error(f"{bad_prices} rows have non-numeric retail_price")
    df['retail_price'] = pd.to_numeric(df['retail_price'], errors='coerce').fillna(0)

# Stock status
if 'stock_qty' in df.columns:
    df['in_stock'] = pd.to_numeric(df['stock_qty'], errors='coerce').fillna(0) > 0
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
