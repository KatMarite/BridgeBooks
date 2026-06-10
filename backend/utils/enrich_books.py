"""
enrich_books.py — Batch enrichment script for BridgeBooks.

Finds all books in the database missing description/cover/page_count
and enriches them via the Google Books API.

Usage:
    python -m utils.enrich_books            # Enrich all un-enriched books
    python -m utils.enrich_books --limit 20 # Enrich up to 20 books
    python -m utils.enrich_books --isbn 9780134685991  # Enrich a single ISBN

Run from the backend/ directory.
"""

import psycopg2
import os
import sys
import argparse
from datetime import datetime

# Ensure backend root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.google_books import lookup_isbn, bulk_enrich
from utils.ingestion_logger import IngestionLogger

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:admin123@localhost:5432/Bridge_dev"
)


def get_unenriched_isbns(conn, limit=50):
    """Fetch ISBNs that have no description, cover image, or page count."""
    cur = conn.cursor()
    cur.execute(
        """SELECT isbn_13 FROM books
           WHERE (description IS NULL OR description = '')
             AND (cover_image_url IS NULL OR cover_image_url = '')
             AND (page_count IS NULL OR page_count = 0)
           ORDER BY updated_at DESC
           LIMIT %s""",
        (limit,)
    )
    isbns = [row[0] for row in cur.fetchall()]
    cur.close()
    return isbns


def update_book_enrichment(conn, isbn, data):
    """Update a book's enrichment fields in the database."""
    if not data:
        return False

    cur = conn.cursor()
    cur.execute(
        """UPDATE books SET
             description = COALESCE(NULLIF(description, ''), %s),
             cover_image_url = COALESCE(NULLIF(cover_image_url, ''), %s),
             page_count = COALESCE(page_count, %s),
             updated_at = NOW()
           WHERE isbn_13 = %s""",
        (
            data.get("description"),
            data.get("cover_image_url"),
            data.get("page_count"),
            isbn,
        )
    )
    updated = cur.rowcount > 0
    cur.close()
    return updated


def run_enrichment(limit=50, single_isbn=None):
    """
    Main enrichment loop.

    Args:
        limit: Max number of books to enrich in this run.
        single_isbn: If set, only enrich this specific ISBN.
    """
    logger = IngestionLogger('google_books', 'enrich_books.py')
    logger.start()

    conn = psycopg2.connect(DATABASE_URL)

    try:
        if single_isbn:
            isbns = [single_isbn]
            print(f"Enriching single ISBN: {single_isbn}")
        else:
            isbns = get_unenriched_isbns(conn, limit)
            print(f"Found {len(isbns)} books needing enrichment (limit: {limit})")

        if not isbns:
            logger.finish('success', 'No books need enrichment')
            conn.close()
            return

        # Bulk lookup via Google Books API
        results = bulk_enrich(isbns)

        enriched_count = 0
        for isbn in isbns:
            data = results.get(isbn)
            logger.add_processed()

            if data:
                updated = update_book_enrichment(conn, isbn, data)
                if updated:
                    enriched_count += 1
                    logger.add_updated()
            else:
                logger.add_error(f"ISBN {isbn}: not found on Google Books")

        conn.commit()

        logger.finish(
            status='success',
            message=f"Google Books enrichment: {enriched_count}/{len(isbns)} books updated"
        )

    except Exception as e:
        conn.rollback()
        logger.add_error(f"Enrichment failed: {e}")
        logger.finish('error', f"Enrichment failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enrich BridgeBooks catalogue via Google Books API")
    parser.add_argument("--limit", type=int, default=50, help="Max books to enrich (default: 50)")
    parser.add_argument("--isbn", type=str, default=None, help="Enrich a single ISBN-13")
    args = parser.parse_args()

    run_enrichment(limit=args.limit, single_isbn=args.isbn)
