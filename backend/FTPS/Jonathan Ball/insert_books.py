"""
insert_books.py — Inserts normalized Jonathan Ball data into BridgeBooks PostgreSQL.

Inserts into both:
  - `books` table (core metadata)
  - `supplier_prices` table (Jonathan Ball-specific pricing with supplier_name='jonathanBall')

Uses ON CONFLICT to safely handle re-imports without duplicating data.
"""

import pandas as pd
import psycopg2
import os
import sys
from dotenv import load_dotenv
from pathlib import Path

# Add backend root to path for shared utils
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from utils.ingestion_logger import IngestionLogger

# ----------------------------
# CONFIG
# ----------------------------
FTPS_ROOT = Path(__file__).resolve().parent.parent  # backend/FTPS/
load_dotenv(FTPS_ROOT / ".env")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:admin123@localhost:5432/Bridge_dev"
)

JB_DIR = Path(__file__).resolve().parent
CSV_FILE = JB_DIR / "normalized_output.csv"

# ----------------------------
# LOAD NORMALIZED DATA
# ----------------------------
if not CSV_FILE.exists():
    raise FileNotFoundError(f"Normalized CSV not found at {CSV_FILE}. Run normalize_booksite.py first.")

df = pd.read_csv(CSV_FILE, dtype={"isbn_13": str})
print(f"📖 Loaded {len(df)} rows from normalized CSV")

# ----------------------------
# CONNECT TO POSTGRESQL
# ----------------------------
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# ----------------------------
# SQL QUERIES
# ----------------------------
books_query = """
INSERT INTO books (
    isbn_13, title, author, publisher, publication_date
)
VALUES (%s, %s, %s, %s, %s)
ON CONFLICT (isbn_13) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    publisher = EXCLUDED.publisher,
    publication_date = EXCLUDED.publication_date,
    updated_at = NOW();
"""

prices_query = """
INSERT INTO supplier_prices (
    isbn_13, supplier_name, retail_price, in_stock, currency
)
VALUES (%s, %s, %s, %s, 'ZAR')
ON CONFLICT (isbn_13, supplier_name) DO UPDATE SET
    retail_price = EXCLUDED.retail_price,
    in_stock = EXCLUDED.in_stock,
    last_synced_at = NOW(),
    updated_at = NOW();
"""

# ----------------------------
# PROCESS ROWS
# ----------------------------
logger = IngestionLogger('jonathanBall', CSV_FILE.name)
logger.start()

books_upserted = 0
prices_upserted = 0

for _, row in df.iterrows():
    try:
        pub_date = row.get("publication_date", None)
        if pd.isna(pub_date) or pub_date == "":
            pub_date = None

        cur.execute(books_query, (
            row["isbn_13"],
            row.get("title", "Unknown"),
            row.get("author", "Unknown"),
            row.get("publisher", None),
            pub_date,
        ))
        books_upserted += 1
        logger.add_inserted()

        cur.execute(prices_query, (
            row["isbn_13"],
            row.get("supplier_name", "jonathanBall"),
            float(row.get("retail_price", 0)),
            bool(row.get("in_stock", False)),
        ))
        prices_upserted += 1

    except Exception as e:
        logger.add_error(f"ISBN {row.get('isbn_13', '?')}: {e}")
        conn.rollback()
        continue
    finally:
        logger.add_processed()

conn.commit()
cur.close()
conn.close()

logger.finish(
    status='success',
    message=f"Jonathan Ball import: {books_upserted} books, {prices_upserted} prices upserted"
)
