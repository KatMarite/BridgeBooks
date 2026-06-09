"""
normalize_booksite.py — Cleans and normalizes raw Jonathan Ball FTPS data.

Input:  Pipe-delimited CSV from FTPS (no header row)
Output: Cleaned CSV with standardized column names matching the BridgeBooks schema.

Columns in raw Jonathan Ball file (pipe-delimited, no header):
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
JB_DIR = Path(__file__).resolve().parent  # backend/FTPS/Jonathan Ball/
RAW_FILE = JB_DIR / "downloads" / "JBPStock.csv"
OUTPUT_FILE = JB_DIR / "normalized_output.csv"
LOG_FILE = JB_DIR / "logs" / "csv_errors.log"

print("Loading:", RAW_FILE)

if not RAW_FILE.exists():
    raise FileNotFoundError(f"CSV not found at: {RAW_FILE}. Run ftp_download.py first.")

# ----------------------------
# SAFE LOAD (ENCODING + PIPE FORMAT)
# ----------------------------
df = None
encodings = ["utf-8", "cp1252", "latin1"]

for enc in encodings:
    try:
        print(f"  Trying encoding: {enc}")
        df = pd.read_csv(
            RAW_FILE,
            encoding=enc,
            on_bad_lines="skip",
            sep="|",
            header=None,
            low_memory=False,
        )
        print(f"  ✅ Loaded with {enc}")
        break
    except Exception as e:
        print(f"  ❌ Failed {enc}: {e}")

if df is None:
    raise ValueError("Failed to load CSV with any encoding.")

print(f"\n  Columns detected: {df.shape[1]}")
print(f"  Total raw rows: {len(df)}")

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

        # Validate ISBN-13
        if not isbn_13 or not isbn_13.isdigit() or len(isbn_13) != 13:
            raise ValueError(f"Invalid ISBN-13: '{isbn_13}'")

        if not title:
            raise ValueError("Missing title")

        # Extract all fields safely
        author = str(values[2]).strip() if len(values) > 2 else ""
        publication_date = str(values[3]).strip() if len(values) > 3 else ""
        publisher = str(values[4]).strip() if len(values) > 4 else ""
        stock_status = str(values[5]).strip().upper() if len(values) > 5 else ""
        retail_price = values[6] if len(values) > 6 else 0
        discount = values[7] if len(values) > 7 else 0
        category = str(values[8]).strip() if len(values) > 8 else ""

        # Normalize
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
            "isbn_13": isbn_13,
            "title": title,
            "author": author,
            "publication_date": publication_date if publication_date != "nan" else "",
            "publisher": publisher,
            "retail_price": retail_price,
            "discount": discount,
            "in_stock": in_stock,
            "category": category,
            "supplier_name": "jonathanBall",
        }

        valid_rows.append(clean_row)

    except Exception as e:
        bad_rows.append(f"Row {index + 1}: {e}")

# ----------------------------
# SAVE CLEAN DATA
# ----------------------------
clean_df = pd.DataFrame(valid_rows)
OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
clean_df.to_csv(OUTPUT_FILE, index=False)

# ----------------------------
# SAVE ERROR LOG
# ----------------------------
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
with open(LOG_FILE, "w", encoding="utf-8") as f:
    for err in bad_rows:
        f.write(err + "\n")

# ----------------------------
# SUMMARY REPORT
# ----------------------------
print("\n===== NORMALIZATION SUMMARY =====")
print(f"  ✅ Valid rows:   {len(valid_rows)}")
print(f"  ⚠️  Skipped rows: {len(bad_rows)}")
print(f"\n  Clean output: {OUTPUT_FILE}")
print(f"  Error log:    {LOG_FILE}")