"""
merge_records.py — Supplier-priority merge utility for BridgeBooks.

Merges supplier data (from Booksite, Jonathan Ball, Protea) with
external metadata (Google Books API) using a clear priority rule:

  - Supplier data ALWAYS wins for: pricing, stock, publisher
  - External data fills gaps for:   description, cover image, page count

Usage:
    from utils.merge_records import merge_book_data, enrich_and_merge

    # Manual merge of two dicts
    merged = merge_book_data(supplier_record, google_books_record)

    # Auto-enrich a single ISBN (calls Google Books API)
    merged = enrich_and_merge(supplier_record)
"""

from utils.google_books import lookup_isbn
from utils.open_library import lookup_isbn as ol_lookup_isbn


def merge_book_data(supplier_data: dict, external_data: dict) -> dict:
    """
    Merge a supplier record with external metadata.

    Supplier pricing and availability ALWAYS take precedence.
    External metadata (description, cover image, etc.) fills in
    any gaps the supplier didn't provide.

    Args:
        supplier_data: Normalized record from a supplier pipeline.
            Expected keys: isbn_13, title, author, publisher,
            publication_date, retail_price, in_stock, supplier_name
        external_data: Enrichment record from an external API.
            Expected keys: description, cover_image_url, page_count,
            categories, author (fallback)

    Returns:
        A merged dict ready for database insertion.
    """
    if not external_data:
        external_data = {}

    merged = {
        # ── Supplier-priority fields (NEVER overwritten by external) ──
        "isbn_13": supplier_data.get("isbn_13"),
        "title": supplier_data.get("title") or external_data.get("title"),
        "author": supplier_data.get("author") or external_data.get("author"),
        "publisher": supplier_data.get("publisher") or external_data.get("publisher"),
        "publication_date": supplier_data.get("publication_date") or external_data.get("publication_date"),
        "supplier_name": supplier_data.get("supplier_name"),

        # ── Pricing & stock (supplier ONLY — external APIs don't know this) ──
        "retail_price": supplier_data.get("retail_price", 0),
        "in_stock": supplier_data.get("in_stock", False),
        "discount": supplier_data.get("discount", 0),

        # ── External enrichment (fills gaps the supplier CSV doesn't have) ──
        "description": supplier_data.get("description") or external_data.get("description"),
        "cover_image_url": supplier_data.get("cover_image_url") or external_data.get("cover_image_url"),
        "page_count": supplier_data.get("page_count") or external_data.get("page_count"),
        "category": supplier_data.get("category") or _first(external_data.get("categories")),
    }

    return merged


def enrich_and_merge(supplier_data: dict) -> dict:
    """
    Look up a single supplier record on Google Books (with Open Library
    fallback) and merge the result.

    Tries Google Books first. If no data is returned, falls back to
    the Open Library API before giving up.

    Args:
        supplier_data: A normalized supplier record with isbn_13.

    Returns:
        Merged dict with enrichment data filled in where available.
    """
    isbn = supplier_data.get("isbn_13")
    external = None

    if isbn:
        # Try Google Books first
        external = lookup_isbn(isbn)

        # Fall back to Open Library if Google Books didn't find it
        if not external:
            external = ol_lookup_isbn(isbn)

    return merge_book_data(supplier_data, external or {})


def _first(items):
    """Return the first item of a list or None."""
    if items and isinstance(items, (list, tuple)):
        return items[0]
    return items
