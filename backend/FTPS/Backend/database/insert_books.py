"""
insert_books.py — Inserts normalized Booksite data into the BridgeBooks PostgreSQL database.

Inserts into both:
  - `books` table (core metadata)
  - `supplier_prices` table (Booksite-specific pricing and availability)

Uses ON CONFLICT to safely handle re-imports without duplicating data.
"""

import pandas as pd
import psycopg2
import os
import sys
from dotenv import load_dotenv

# Add backend root to path for shared utils
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from utils.ingestion_logger import IngestionLogger

# ----------------------------
# CONFIG
# ----------------------------
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:admin123@localhost:5432/Bridge_dev"
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_FILE = os.path.join(BASE_DIR, "..", "normalization", "normalized_output.csv")

# ----------------------------
# LOAD NORMALIZED DATA
# ----------------------------
if not os.path.exists(CSV_FILE):
    raise FileNotFoundError(f"Normalized CSV not found at {CSV_FILE}. Run normalize_booksite.py first.")

df = pd.read_csv(CSV_FILE, dtype={"isbn_13": str})

print(f"📖 Loaded {len(df)} rows from normalized CSV")

# ----------------------------
# CONNECT TO POSTGRESQL
# ----------------------------
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# ----------------------------
# INSERT INTO `books` TABLE
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

# ----------------------------
# INSERT INTO `supplier_prices` TABLE
# ----------------------------
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
logger = IngestionLogger('booksite', os.path.basename(CSV_FILE))
logger.start()

books_inserted = 0
prices_inserted = 0

for _, row in df.iterrows():
    try:
        # 1. Upsert book metadata
        cur.execute(books_query, (
            row["isbn_13"],
            row.get("title", "Unknown"),
            row.get("author", "Unknown"),
            row.get("publisher", None),
            row.get("publication_date", None),
        ))
        books_inserted += 1
        logger.add_inserted()

        # 2. Upsert supplier pricing
        cur.execute(prices_query, (
            row["isbn_13"],
            row.get("supplier_name", "booksite"),
            float(row.get("retail_price", 0)),
            bool(row.get("in_stock", False)),
        ))
        prices_inserted += 1
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
    message=f"Booksite import: {books_inserted} books, {prices_inserted} prices upserted"
)