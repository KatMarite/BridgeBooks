"""
insert_books.py — Inserts normalized Booksite data into the BridgeBooks PostgreSQL database.

Upserts into:
  - books            (core metadata: isbn, title, author, publisher, pub_date, weight_grams)
  - supplier_prices  (Booksite-specific: retail_price, in_stock, stock_quantity, currency)

Uses ON CONFLICT to safely re-import without duplicating data.
Booksite is the source of truth for pricing and availability for most SA titles.

Usage:
    python3 insert_books.py
    python3 insert_books.py --dry-run      # Parse and count without writing
"""

import csv
import os
import sys
import argparse
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from utils.ingestion_logger import IngestionLogger

# ----------------------------
# CONFIG
# ----------------------------
BS_DIR = Path(__file__).resolve().parent
FTPS_ROOT = BS_DIR.parent
load_dotenv(FTPS_ROOT / ".env")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:admin123@localhost:5432/Bridge_dev"
)

CSV_FILE = BS_DIR / "normalized_output.csv"

SUPPLIER_NAME = "booksite"

# ----------------------------
# SQL
# ----------------------------
BOOKS_UPSERT = """
INSERT INTO books (isbn_13, title, author, publisher, publication_date, weight_grams)
VALUES (%s, %s, %s, %s, %s, %s)
ON CONFLICT (isbn_13) DO UPDATE SET
    title            = COALESCE(EXCLUDED.title,            books.title),
    author           = COALESCE(EXCLUDED.author,           books.author),
    publisher        = COALESCE(EXCLUDED.publisher,        books.publisher),
    publication_date = COALESCE(EXCLUDED.publication_date, books.publication_date),
    weight_grams     = COALESCE(EXCLUDED.weight_grams,     books.weight_grams),
    updated_at       = NOW();
"""

PRICES_UPSERT = """
INSERT INTO supplier_prices (
    isbn_13, supplier_name, retail_price, in_stock, stock_quantity, currency
)
VALUES (%s, %s, %s, %s, %s, 'ZAR')
ON CONFLICT (isbn_13, supplier_name) DO UPDATE SET
    retail_price   = EXCLUDED.retail_price,
    in_stock       = EXCLUDED.in_stock,
    stock_quantity = EXCLUDED.stock_quantity,
    last_synced_at = NOW(),
    updated_at     = NOW();
"""

# ----------------------------
# MAIN
# ----------------------------
def main(dry_run: bool = False):
    if not CSV_FILE.exists():
        raise FileNotFoundError(
            f"Normalized CSV not found at {CSV_FILE}. Run normalize_booksite.py first."
        )

    logger = IngestionLogger(SUPPLIER_NAME, CSV_FILE.name)
    logger.start()

    # Count rows
    with open(CSV_FILE, encoding="utf-8", newline="") as f:
        total = sum(1 for _ in csv.DictReader(f))
    print(f"Loaded {total:,} rows from {CSV_FILE.name}")

    if dry_run:
        print(f"DRY RUN — would upsert {total:,} books and prices. No DB writes.")
        logger.finish("success", f"Dry run: {total:,} rows ready")
        return

    conn = psycopg2.connect(DATABASE_URL)
    books_ok = prices_ok = errors = 0

    try:
        with open(CSV_FILE, encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)

            for row in reader:
                isbn    = row["isbn_13"]
                title   = row["title"] or None
                author  = row["author"] or None
                pub     = row["publisher"] or None
                pubdate = row["publication_date"] or None
                weight  = float(row["weight_grams"]) if row["weight_grams"] else None
                price   = float(row["retail_price"]) if row["retail_price"] else 0.0
                in_stk  = row["in_stock"].lower() == "true"
                qty     = int(row["available_qty"]) if row["available_qty"] else 0
                # Treat negative quantities as zero (back-ordered)
                qty = max(qty, 0)

                try:
                    with conn.cursor() as cur:
                        cur.execute(BOOKS_UPSERT, (
                            isbn, title, author, pub, pubdate, weight
                        ))
                        books_ok += 1
                        logger.add_inserted()

                        cur.execute(PRICES_UPSERT, (
                            isbn, SUPPLIER_NAME, price, in_stk, qty
                        ))
                        prices_ok += 1

                    conn.commit()

                except Exception as e:
                    conn.rollback()
                    errors += 1
                    logger.add_error(f"ISBN {isbn}: {e}")
                    if errors <= 10:
                        print(f"  [ERROR] {isbn}: {e}")

                finally:
                    logger.add_processed()

    finally:
        conn.close()

    summary = (
        f"Booksite import complete: {books_ok:,} books upserted, "
        f"{prices_ok:,} prices upserted, {errors:,} errors."
    )
    logger.finish("success", summary)
    print(f"\n{summary}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Insert normalized Booksite data into BridgeBooks PostgreSQL"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Count rows and validate without writing to the database"
    )
    args = parser.parse_args()
    main(dry_run=args.dry_run)
