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
from psycopg2.extras import execute_values
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
VALUES %s
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
VALUES %s
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

    conn = psycopg2.connect(DATABASE_URL, sslmode="require")
    books_ok = prices_ok = errors = 0
    BATCH_SIZE = 500
    row_num = 0

    def parse_row(row):
        isbn    = row["isbn_13"]
        title   = row["title"] or None
        author  = row["author"] or None
        pub     = row["publisher"] or None
        pubdate = row["publication_date"] or None
        weight  = float(row["weight_grams"]) if row["weight_grams"] else None
        price   = float(row["retail_price"]) if row["retail_price"] else 0.0
        in_stk  = row["in_stock"].lower() == "true"
        qty     = int(row["available_qty"]) if row["available_qty"] else 0
        qty = max(qty, 0)  # treat negative (back-ordered) quantities as zero
        return {
            "isbn": isbn,
            "books_row": (isbn, title, author, pub, pubdate, weight),
            "prices_row": (isbn, SUPPLIER_NAME, price, in_stk, qty, "ZAR"),
        }

    try:
        with open(CSV_FILE, encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            batch = []

            def flush(batch):
                nonlocal books_ok, prices_ok, errors
                if not batch:
                    return
                # Postgres refuses to let one multi-row statement update the
                # same ON CONFLICT target twice (CardinalityViolation).
                # Booksite's stock file repeats some ISBNs (different
                # branches/formats) so dedupe within the batch, keeping the
                # last occurrence — otherwise every batch with a repeat ISBN
                # falls back to the slow per-row path.
                deduped = list({p["isbn"]: p for p in batch}.values())
                try:
                    with conn.cursor() as cur:
                        execute_values(cur, BOOKS_UPSERT, [p["books_row"] for p in deduped])
                        execute_values(cur, PRICES_UPSERT, [p["prices_row"] for p in deduped])
                    conn.commit()
                    books_ok += len(deduped)
                    prices_ok += len(deduped)
                    for p in deduped:
                        logger.add_inserted()
                except Exception:
                    # Still failed even after dedup (some other data issue) —
                    # roll back the whole batch and retry rows one at a time
                    # so we only lose the actual offending row(s).
                    conn.rollback()
                    for parsed in deduped:
                        try:
                            with conn.cursor() as cur:
                                execute_values(cur, BOOKS_UPSERT, [parsed["books_row"]])
                                execute_values(cur, PRICES_UPSERT, [parsed["prices_row"]])
                            conn.commit()
                            books_ok += 1
                            prices_ok += 1
                            logger.add_inserted()
                        except Exception as row_err:
                            conn.rollback()
                            errors += 1
                            logger.add_error(f"ISBN {parsed['isbn']}: {row_err}")
                            if errors <= 10:
                                print(f"  [ERROR] {parsed['isbn']}: {row_err}")
                for _ in batch:
                    logger.add_processed()

            for row in reader:
                row_num += 1
                batch.append(parse_row(row))

                if len(batch) >= BATCH_SIZE:
                    flush(batch)
                    print(f"  ...{row_num:,} rows processed", end="\r")
                    batch = []

            flush(batch)  # final partial batch

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
