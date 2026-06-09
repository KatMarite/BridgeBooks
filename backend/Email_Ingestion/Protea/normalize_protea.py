"""
normalize_protea.py — Cleans and normalizes raw Protea email attachments.

Input:  CSV or Excel file downloaded from email
Output: Cleaned CSV with standardized column names matching BridgeBooks schema.

NOTE: This is a placeholder script. Once a real Protea stock file is received,
this script must be updated to map their specific columns to our schema.
"""

from pathlib import Path
import pandas as pd

# ----------------------------
# PATHS
# ----------------------------
PROTEA_DIR = Path(__file__).resolve().parent
# Note: The exact filename will depend on what Protea sends
DOWNLOAD_DIR = PROTEA_DIR / "downloads"
OUTPUT_FILE = PROTEA_DIR / "normalized_output.csv"

# Find the newest downloaded file
downloaded_files = list(DOWNLOAD_DIR.glob("*.*"))
if not downloaded_files:
    raise FileNotFoundError("No raw files found. Run email_download.py first.")

RAW_FILE = max(downloaded_files, key=lambda p: p.stat().st_mtime)
print(f"Loading latest file: {RAW_FILE.name}")

# ----------------------------
# READ DATA
# ----------------------------
if RAW_FILE.suffix.lower() in ['.xlsx', '.xls']:
    df = pd.read_excel(RAW_FILE)
else:
    df = pd.read_csv(RAW_FILE)

# ----------------------------
# TODO: IMPLEMENT COLUMN MAPPING
# ----------------------------
# The dataframe must be transformed to output the following columns:
# isbn_13, title, author, publication_date, publisher,
# retail_price, discount, in_stock, category, supplier_name

# Example:
# df = df.rename(columns={"protea_isbn": "isbn_13", "Price Excl": "retail_price"})
# df["supplier_name"] = "protea"
# df["in_stock"] = df["Qty Available"] > 0

print("⚠️  Normalization mapping not yet implemented for Protea format.")

# OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
# df.to_csv(OUTPUT_FILE, index=False)
