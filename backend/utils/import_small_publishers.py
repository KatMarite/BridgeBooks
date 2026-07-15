"""
import_small_publishers.py — Imports the consolidated small-publisher master
catalogue (bookbridge_master_v5.csv, built by the School Booklist tool's
enrichment scripts) into the BridgeBooks PostgreSQL database.

Unlike Booksite and Jonathan Ball, this file blends together ~10 different
small SA publishers/price lists in one CSV, distinguished by the `source`
column. Each source is mapped to its own supplier_name in supplier_prices,
so pricing/stock stays attributable per price list — same pattern as
Booksite and Jonathan Ball.

Input columns expected:
  isbn, title, author, publisher, distributor, rrp_zar, format, subject,
  language, pub_date, soh, source, flag_no_isbn, flag_no_price,
  flag_no_author, cover_url, isbn_site, product_url, soh_site,
  description, pages

Usage:
    python3 import_small_publishers.py /path/to/bookbridge_master_v5.csv
    python3 import_small_publishers.py /path/to/file.csv --dry-run
"""

from __future__ import annotations

import csv
import os
import sys
import argparse
import psycopg2
from psycopg2.extras import execute_values
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.ingestion_logger import IngestionLogger
from utils.cleaners import clean_isbn, clean_price

# ----------------------------
# CONFIG
# ----------------------------
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:admin123@localhost:5432/Bridge_dev"
)

BATCH_SIZE = 500

# ----------------------------
# SOURCE -> SUPPLIER_NAME MAPPING
# ----------------------------
# Multiple "source" values from the same distributor (e.g. Shuter's [OTHER]
# and [CAPS] catalogue sections) collapse into one supplier_name, matching
# how Booksite/Jonathan Ball are tracked.
SOURCE_TO_SUPPLIER = {
    "Shuter price list 2025 [OTHER]":            "shuter",
    "Shuter price list 2025 [CAPS]":              "shuter",
    "Protea stockfile 2026-04-09":                "protea",
    "Protea May Sub 2026":                        "protea",
    "Juta price list Dec 2026 [Law]":             "juta",
    "Juta price list Dec 2026 [Academic]":        "juta",
    "New Africa price list 2025-06 to 2026-06":   "new_africa",
    "VSP price list 2026/7":                      "vsp",
    "HSRC SOH 2026":                              "hsrc",
    "Book Dash stock list 2026-05-21":            "book_dash",
    "Bookstorm price list Jan 2026":              "bookstorm",
    "Book Tourism stock list":                    "book_tourism",
}


def map_supplier(source: str) -> str:
    """Map a raw 'source' value to a clean supplier_name slug."""
    if source in SOURCE_TO_SUPPLIER:
        return SOURCE_TO_SUPPLIER[source]
    # Unrecognised source — fall back to a slugified version rather than
    # dropping the row, and flag it so it can be added to the mapping above.
    slug = "".join(c if c.isalnum() else "_" for c in source.strip().lower())
    return slug or "unknown_small_publisher"


# ----------------------------
# LANGUAGE NAME -> ISO 639-2/B CODE MAPPING
# ----------------------------
LANGUAGE_TO_CODE = {
    "english": "eng", "eng": "eng", "engish": "eng",
    "afrikaans": "afr", "afr": "afr",
    "iszizulu": "zul",  # guard against stray typos, harmless if unused
    "isizulu": "zul", "zulu": "zul",
    "isixhosa": "xho", "xhosa": "xho",
    "setswana": "tsn",
    "siswati": "ssw",
    "ndebele": "nbl", "isindebele": "nbl",
    "sepedi": "nso",
    "sesotho": "sot", "sotho": "sot",
    "xitsonga": "tso", "tsonga": "tso",
    "tshivenda": "ven", "venda": "ven",
    "french": "fre",
    "german": "ger",
    "multilingual": "mul",
    "wordless": None,
    "kaaps": "afr",  # Kaaps is a variety of Afrikaans
}


def map_language(raw: str):
    """
    Map a free-text language value to an ISO 639-2/B code.
    Returns None if blank/unrecognised, or 'mul' for anything listing
    multiple languages (commas, '&', line breaks, or '|' as in N|uu).
    """
    if not raw or not raw.strip():
        return None

    cleaned = raw.strip().lower()

    if cleaned in LANGUAGE_TO_CODE:
        return LANGUAGE_TO_CODE[cleaned]

    # Multi-language free text (e.g. "English, Sesotho & isiXhosa",
    # "Afr, Eng,\nisiXhosa", "N|uu, IsiXhosa\nEng, Afrikaans")
    if any(sep in raw for sep in [",", "&", "\n"]) or "n|uu" in cleaned:
        return "mul"

    return None  # unrecognised — leave blank rather than guess


def clean_pub_date(raw: str):
    """pub_date in this file is just a year ('2022'). Return YYYY-01-01."""
    raw = (raw or "").strip()
    if not raw:
        return None
    if raw.isdigit() and len(raw) == 4:
        return f"{raw}-01-01"
    return None


def clean_soh(raw: str):
    """Stock-on-hand values are floats-as-strings ('617.0'). Return int >= 0."""
    try:
        qty = int(float(raw))
        return max(qty, 0)
    except (ValueError, TypeError):
        return 0


# ----------------------------
# SQL
# ----------------------------
BOOKS_UPSERT = """
INSERT INTO books (
    isbn_13, title, author, publisher, publication_date,
    description, cover_image_url, language_code
)
VALUES %s
ON CONFLICT (isbn_13) DO UPDATE SET
    title            = COALESCE(EXCLUDED.title,            books.title),
    author           = COALESCE(EXCLUDED.author,           books.author),
    publisher        = COALESCE(EXCLUDED.publisher,        books.publisher),
    publication_date = COALESCE(EXCLUDED.publication_date, books.publication_date),
    description      = COALESCE(EXCLUDED.description,      books.description),
    cover_image_url  = COALESCE(EXCLUDED.cover_image_url,   books.cover_image_url),
    language_code    = COALESCE(EXCLUDED.language_code,     books.language_code),
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


def parse_row(row: dict):
    isbn = clean_isbn(row.get("isbn"))
    if not isbn:
        return None

    title = (row.get("title") or "").strip() or None
    if not title:
        return None

    author = (row.get("author") or "").strip() or None
    publisher = (row.get("publisher") or "").strip() or None
    description = (row.get("description") or "").strip() or None
    cover_url = (row.get("cover_url") or "").strip() or None
    language_code = map_language(row.get("language", ""))
    pub_date = clean_pub_date(row.get("pub_date", ""))

    price = clean_price(row.get("rrp_zar"))
    qty = clean_soh(row.get("soh"))
    supplier_name = map_supplier((row.get("source") or "").strip())

    return {
        "isbn": isbn,
        "supplier_name": supplier_name,
        "books_row": (
            isbn, title, author, publisher, pub_date,
            description, cover_url, language_code,
        ),
        "prices_row": (
            isbn, supplier_name, price, qty > 0, qty, "ZAR",
        ),
    }


def main(input_file: str, dry_run: bool = False):
    csv_path = Path(input_file)
    if not csv_path.exists():
        raise FileNotFoundError(f"File not found: {csv_path}")

    logger = IngestionLogger("small_publishers", csv_path.name)
    logger.start()

    with open(csv_path, encoding="utf-8", newline="", errors="replace") as f:
        rows = list(csv.DictReader(f))
    print(f"Loaded {len(rows):,} rows from {csv_path.name}")

    parsed_rows = []
    skipped = 0
    for row in rows:
        parsed = parse_row(row)
        if parsed is None:
            skipped += 1
            continue
        parsed_rows.append(parsed)

    print(f"Parsed {len(parsed_rows):,} valid rows, skipped {skipped:,} (missing/invalid ISBN or title)")

    suppliers_seen = sorted({p["supplier_name"] for p in parsed_rows})
    print(f"Suppliers found: {', '.join(suppliers_seen)}")

    if dry_run:
        print(f"DRY RUN — would upsert {len(parsed_rows):,} books and prices. No DB writes.")
        logger.finish("success", f"Dry run: {len(parsed_rows):,} rows ready")
        return

    conn = psycopg2.connect(DATABASE_URL, sslmode="require")
    books_ok = prices_ok = errors = 0

    def flush(batch):
        nonlocal books_ok, prices_ok, errors
        if not batch:
            return
        # Dedupe within the batch, keeping the last occurrence of each
        # (isbn, supplier_name) pair — Postgres won't allow one multi-row
        # statement to update the same ON CONFLICT target twice.
        deduped_books = list({p["isbn"]: p for p in batch}.values())
        deduped_prices = list({(p["isbn"], p["supplier_name"]): p for p in batch}.values())
        try:
            with conn.cursor() as cur:
                execute_values(cur, BOOKS_UPSERT, [p["books_row"] for p in deduped_books])
                execute_values(cur, PRICES_UPSERT, [p["prices_row"] for p in deduped_prices])
            conn.commit()
            books_ok += len(deduped_books)
            prices_ok += len(deduped_prices)
            for _ in batch:
                logger.add_inserted()
        except Exception:
            conn.rollback()
            for parsed in batch:
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

    try:
        batch = []
        for i, parsed in enumerate(parsed_rows, start=1):
            batch.append(parsed)
            if len(batch) >= BATCH_SIZE:
                flush(batch)
                print(f"  ...{i:,} rows processed", end="\r")
                batch = []
        flush(batch)
    finally:
        conn.close()

    summary = (
        f"Small publishers import complete: {books_ok:,} books upserted, "
        f"{prices_ok:,} prices upserted, {errors:,} errors, "
        f"{skipped:,} rows skipped (bad ISBN/title)."
    )
    logger.finish("success", summary)
    print(f"\n{summary}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Import the small-publisher master catalogue into BridgeBooks PostgreSQL"
    )
    parser.add_argument("input_file", type=str, help="Path to bookbridge_master_v5.csv")
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Parse and count without writing to the database"
    )
    args = parser.parse_args()
    main(args.input_file, dry_run=args.dry_run)
