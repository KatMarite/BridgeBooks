"""
insert_books.py — Inserts normalized Jonathan Ball data into BridgeBooks PostgreSQL.

Inserts into both:
  - `books` table (core metadata)
  - `supplier_prices` table (Jonathan Ball-specific pricing with supplier_name='jonathanBall')

Uses ON CONFLICT to safely handle re-imports without duplicating data.
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
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
conn = psycopg2.connect(DATABASE_URL, sslmode="require")
cur = conn.cursor()

# ----------------------------
# SQL QUERIES
# ----------------------------
books_query = """
INSERT INTO books (
    isbn_13, title, author, publisher, publication_date
)
VALUES %s
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
VALUES %s
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
errors = 0
BATCH_SIZE = 500
row_num = 0


def parse_row(row):
    isbn = row["isbn_13"]
    pub_date = row.get("publication_date", None)
    if pd.isna(pub_date) or pub_date == "":
        pub_date = None
    return {
        "isbn": isbn,
        "books_row": (
            isbn,
            row.get("title", "Unknown"),
            row.get("author", "Unknown"),
            row.get("publisher", None),
            pub_date,
        ),
        "prices_row": (
            isbn,
            row.get("supplier_name", "jonathanBall"),
            float(row.get("retail_price", 0)),
            bool(row.get("in_stock", False)),
            "ZAR",
        ),
    }


def flush(batch):
    global books_upserted, prices_upserted, errors
    if not batch:
        return
    # Postgres refuses to let one multi-row statement update the same
    # ON CONFLICT target twice (CardinalityViolation). Dedupe within the
    # batch, keeping the last occurrence of each ISBN — otherwise any
    # batch with a repeated ISBN falls back to the slow per-row path.
    deduped = list({p["isbn"]: p for p in batch}.values())
    try:
        execute_values(cur, books_query, [p["books_row"] for p in deduped])
        execute_values(cur, prices_query, [p["prices_row"] for p in deduped])
        conn.commit()
        books_upserted += len(deduped)
        prices_upserted += len(deduped)
        for _ in deduped:
            logger.add_inserted()
    except Exception:
        # Still failed even after dedup (some other data issue) — roll
        # back the whole batch and retry rows one at a time so we only
        # lose the actual offending row(s).
        conn.rollback()
        for parsed in deduped:
            try:
                execute_values(cur, books_query, [parsed["books_row"]])
                execute_values(cur, prices_query, [parsed["prices_row"]])
                conn.commit()
                books_upserted += 1
                prices_upserted += 1
                logger.add_inserted()
            except Exception as row_err:
                conn.rollback()
                errors += 1
                logger.add_error(f"ISBN {parsed['isbn']}: {row_err}")
                if errors <= 10:
                    print(f"  [ERROR] {parsed['isbn']}: {row_err}")
    for _ in batch:
        logger.add_processed()


batch = []
for _, row in df.iterrows():
    row_num += 1
    batch.append(parse_row(row))

    if len(batch) >= BATCH_SIZE:
        flush(batch)
        print(f"  ...{row_num:,} rows processed", end="\r")
        batch = []

flush(batch)  # final partial batch

cur.close()
conn.close()

summary = (
    f"Jonathan Ball import complete: {books_upserted:,} books upserted, "
    f"{prices_upserted:,} prices upserted, {errors:,} errors."
)
logger.finish(status='success', message=summary)
print(f"\n{summary}")
