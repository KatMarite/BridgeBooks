"""
google_books.py — Google Books API client for BridgeBooks metadata enrichment.

Fetches book descriptions, cover images, and page counts from the
Google Books API using ISBN-13 lookup.

The Google Books API is free and does NOT require an API key for basic
volume search. An API key is optional but recommended for higher rate limits.

Usage:
    from utils.google_books import lookup_isbn, bulk_enrich

    # Single ISBN lookup
    data = lookup_isbn('9780134685991')
    # Returns: { description, cover_image_url, page_count, categories, ... }

    # Bulk enrichment (with rate-limiting)
    results = bulk_enrich(['9780134685991', '9780201633610'])
"""

import requests
import time
import os

GOOGLE_BOOKS_API = "https://www.googleapis.com/books/v1/volumes"

# Optional API key — set GOOGLE_BOOKS_API_KEY in .env for higher rate limits
API_KEY = os.getenv("GOOGLE_BOOKS_API_KEY", None)

# Rate limiting: Google allows ~1 request/sec without API key
REQUEST_DELAY = 1.0  # seconds between requests


def lookup_isbn(isbn_13):
    """
    Look up a single ISBN-13 on the Google Books API.

    Returns a dict with enrichment data, or None if not found.

    Keys returned:
        - title (str)
        - author (str)
        - publisher (str)
        - publication_date (str)
        - description (str)
        - cover_image_url (str)
        - page_count (int)
        - categories (list[str])
        - language (str)
        - preview_link (str)
    """
    if not isbn_13 or len(str(isbn_13)) != 13:
        return None

    params = {"q": f"isbn:{isbn_13}"}
    if API_KEY:
        params["key"] = API_KEY

    try:
        resp = requests.get(GOOGLE_BOOKS_API, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        if data.get("totalItems", 0) == 0:
            return None

        # Use the first (best) match
        volume = data["items"][0]["volumeInfo"]

        # Prefer HTTPS thumbnail, fall back to HTTP
        image_links = volume.get("imageLinks", {})
        cover_url = (
            image_links.get("thumbnail", "") or
            image_links.get("smallThumbnail", "")
        )
        # Google returns HTTP links — upgrade to HTTPS
        if cover_url and cover_url.startswith("http://"):
            cover_url = cover_url.replace("http://", "https://", 1)

        return {
            "title": volume.get("title"),
            "author": ", ".join(volume.get("authors", [])) or None,
            "publisher": volume.get("publisher"),
            "publication_date": volume.get("publishedDate"),
            "description": volume.get("description"),
            "cover_image_url": cover_url or None,
            "page_count": volume.get("pageCount"),
            "categories": volume.get("categories", []),
            "language": volume.get("language"),
            "preview_link": volume.get("previewLink"),
        }

    except requests.exceptions.Timeout:
        print(f"  [google_books] Timeout looking up ISBN {isbn_13}")
        return None
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 429:
            print(f"  [google_books] Rate limited — waiting 5s...")
            time.sleep(5)
            return lookup_isbn(isbn_13)  # Retry once
        print(f"  [google_books] HTTP error for ISBN {isbn_13}: {e}")
        return None
    except Exception as e:
        print(f"  [google_books] Error looking up ISBN {isbn_13}: {e}")
        return None


def bulk_enrich(isbn_list, delay=REQUEST_DELAY):
    """
    Look up multiple ISBNs with rate limiting.

    Args:
        isbn_list: List of ISBN-13 strings.
        delay: Seconds to wait between requests (default 1.0).

    Returns:
        Dict mapping ISBN -> enrichment data (only found entries).
    """
    results = {}
    total = len(isbn_list)

    for i, isbn in enumerate(isbn_list):
        if i > 0:
            time.sleep(delay)

        print(f"  [{i + 1}/{total}] Looking up {isbn}...", end=" ")
        data = lookup_isbn(isbn)

        if data:
            results[isbn] = data
            print(f"found: {data.get('title', '?')}")
        else:
            print("not found")

    print(f"\n  Enriched {len(results)}/{total} ISBNs")
    return results
