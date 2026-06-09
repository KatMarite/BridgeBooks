"""
normalize_booksite.py — Cleans and normalizes raw Booksite (Jonathan Ball) FTPS data.

Input:  Pipe-delimited CSV from FTPS (no header row)
Output: Cleaned CSV with standardized column names matching the BridgeBooks schema.

Columns in raw Booksite file (pipe-delimited, no header):
  0: ISBN-13
  1: Title
  2: Author
  3: Publication Date
  4: Publisher
  5: Stock Status ("IN STOCK" / "OUT OF STOCK")
  6: Retail Price (ZAR)
  7: Discount (decimal, e.g. 0.0000)
  8: Category Code
"""

from pathlib import Path
import pandas as pd

# ----------------------------
# PATHS
# ----------------------------
BASE_DIR = Path(__file__).resolve().parent
RAW_FILE = BASE_DIR / ".." / "downloads" / "JBPStock.csv"
OUTPUT_FILE = BASE_DIR / "normalized_output.csv"

print("Loading:", RAW_FILE)

if not RAW_FILE.exists():
    raise FileNotFoundError(f"Raw CSV not found at {RAW_FILE}. Run FTP download first.")

# ----------------------------
# READ PIPE-DELIMITED CSV (NO HEADER)
# ----------------------------
COLUMN_NAMES = [
    "isbn_13",
    "title",
    "author",
    "publication_date",
    "publisher",
    "stock_status",
    "retail_price",
    "discount",
    "category",
]

df = pd.read_csv(
    RAW_FILE,
    sep="|",
    header=None,
    names=COLUMN_NAMES,
    dtype={"isbn_13": str},
    on_bad_lines="skip",
)

# ----------------------------
# CLEAN DATA
# ----------------------------

# Strip whitespace from string columns
for col in ["isbn_13", "title", "author", "publisher", "stock_status", "category"]:
    if col in df.columns:
        df[col] = df[col].astype(str).str.strip()

# Validate ISBN-13 (must be exactly 13 digits)
df = df[df["isbn_13"].str.match(r"^\d{13}$", na=False)]

# Normalize stock status to boolean
df["in_stock"] = df["stock_status"].str.upper() == "IN STOCK"

# Parse retail price as numeric
df["retail_price"] = pd.to_numeric(df["retail_price"], errors="coerce").fillna(0)

# Parse discount as numeric
df["discount"] = pd.to_numeric(df["discount"], errors="coerce").fillna(0)

# Add supplier identifier
df["supplier_name"] = "booksite"

# ----------------------------
# SELECT OUTPUT COLUMNS
# ----------------------------
output_cols = [
    "isbn_13",
    "title",
    "author",
    "publication_date",
    "publisher",
    "retail_price",
    "discount",
    "in_stock",
    "category",
    "supplier_name",
]

df = df[output_cols]

# ----------------------------
# SAVE OUTPUT
# ----------------------------
OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(OUTPUT_FILE, index=False)

print(f"✅ Normalization complete!")
print(f"   Saved to: {OUTPUT_FILE}")
print(f"   Valid rows: {len(df)}")