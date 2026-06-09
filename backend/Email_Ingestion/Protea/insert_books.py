"""
insert_books.py — Inserts normalized Protea data into BridgeBooks PostgreSQL.

Inserts into both:
  - `books` table (core metadata)
  - `supplier_prices` table (Protea-specific pricing with supplier_name='protea')
"""

import pandas as pd
import psycopg2
import os
from dotenv import load_dotenv
from pathlib import Path

# ----------------------------
# CONFIG
# ----------------------------
INGESTION_ROOT = Path(__file__).resolve().parent.parent  # backend/Email_Ingestion/
load_dotenv(INGESTION_ROOT / ".env")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:admin123@localhost:5432/Bridge_dev"
)

PROTEA_DIR = Path(__file__).resolve().parent
CSV_FILE = PROTEA_DIR / "normalized_output.csv"

# ----------------------------
# LOAD NORMALIZED DATA
# ----------------------------
if not CSV_FILE.exists():
    raise FileNotFoundError(f"Normalized CSV not found at {CSV_FILE}. Run normalize_protea.py first.")

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
books_upserted = 0
prices_upserted = 0
errors = 0

for _, row in df.iterrows():
    try:
        # Parse publication_date safely
        pub_date = row.get("publication_date", None)
        if pd.isna(pub_date) or pub_date == "":
            pub_date = None

        # 1. Upsert book metadata
        cur.execute(books_query, (
            row["isbn_13"],
            row.get("title", "Unknown"),
            row.get("author", "Unknown"),
            row.get("publisher", None),
            pub_date,
        ))
        books_upserted += 1

        # 2. Upsert supplier pricing
        cur.execute(prices_query, (
            row["isbn_13"],
            row.get("supplier_name", "protea"),
            float(row.get("retail_price", 0)),
            bool(row.get("in_stock", False)),
        ))
        prices_upserted += 1

    except Exception as e:
        errors += 1
        if errors <= 5:
            print(f"  ⚠️  Row error (ISBN {row.get('isbn_13', '?')}): {e}")
        conn.rollback()
        continue

conn.commit()
cur.close()
conn.close()

print(f"\n✅ Protea import complete!")
print(f"   Books upserted:    {books_upserted}")
print(f"   Prices upserted:   {prices_upserted}")
if errors:
    print(f"   ⚠️  Errors skipped: {errors}")
