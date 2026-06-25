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
from utils.open_library import lookup_isbn as ol_lookup_isbn
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
    Main enrichment loop with Google Books → Open Library fallback.

    For each ISBN, we first query Google Books. If Google Books returns
    no data, we automatically fall back to the Open Library API.
    The enrichment source is logged for every record.

    Args:
        limit: Max number of books to enrich in this run.
        single_isbn: If set, only enrich this specific ISBN.
    """
    logger = IngestionLogger('metadata_enrichment', 'enrich_books.py')
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

        # Phase 1: Bulk lookup via Google Books API
        print("\n-- Phase 1: Google Books API --")
        google_results = bulk_enrich(isbns)

        # Phase 2: Fall back to Open Library for ISBNs Google missed
        missed_isbns = [isbn for isbn in isbns if isbn not in google_results]
        ol_results = {}
        if missed_isbns:
            print(f"\n-- Phase 2: Open Library fallback ({len(missed_isbns)} ISBNs) --")
            for isbn in missed_isbns:
                import time
                time.sleep(1)  # Rate-limit Open Library requests
                ol_data = ol_lookup_isbn(isbn)
                if ol_data:
                    ol_results[isbn] = ol_data
                    print(f"  [OL] {isbn}: found — {ol_data.get('title', '?')}")
                else:
                    print(f"  [OL] {isbn}: not found")
        else:
            print("\n  All ISBNs found on Google Books — skipping Open Library fallback.")

        # Phase 3: Update database
        enriched_count = 0
        google_count = 0
        ol_count = 0

        for isbn in isbns:
            logger.add_processed()

            # Prefer Google Books data, fall back to Open Library
            data = google_results.get(isbn)
            source = "google_books"
            if not data:
                data = ol_results.get(isbn)
                source = "open_library"

            if data:
                updated = update_book_enrichment(conn, isbn, data)
                if updated:
                    enriched_count += 1
                    logger.add_updated()
                    if source == "google_books":
                        google_count += 1
                    else:
                        ol_count += 1
                    print(f"  [OK] {isbn} enriched via {source}")
            else:
                logger.add_error(f"ISBN {isbn}: not found on Google Books or Open Library")

        conn.commit()

        summary = (
            f"Enrichment complete: {enriched_count}/{len(isbns)} books updated "
            f"(Google Books: {google_count}, Open Library: {ol_count})"
        )
        logger.finish(status='success', message=summary)

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
