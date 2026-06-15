"""
open_library.py — Open Library API client for BridgeBooks metadata enrichment.

Acts as the fallback enrichment source when the Google Books API does not
return results for a given ISBN-13.

Open Library API docs: https://openlibrary.org/developers/api

Usage:
    from utils.open_library import lookup_isbn as ol_lookup

    data = ol_lookup('9780134685991')
    # Returns: { description, cover_image_url, page_count, ... } or None
"""

import requests
import time


OL_BOOKS_API = "https://openlibrary.org/api/books"
OL_COVERS_BASE = "https://covers.openlibrary.org/b/isbn"

# Rate limiting: be respectful — 1 req/sec
REQUEST_DELAY = 1.0


def lookup_isbn(isbn_13):
    """
    Look up a single ISBN-13 on the Open Library API.

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
    """
    if not isbn_13 or len(str(isbn_13)) != 13:
        return None

    bibkey = f"ISBN:{isbn_13}"
    params = {
        "bibkeys": bibkey,
        "format": "json",
        "jscmd": "data",
    }

    try:
        resp = requests.get(OL_BOOKS_API, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        if bibkey not in data:
            return None

        book = data[bibkey]

        # Extract authors
        authors_list = book.get("authors", [])
        author_str = ", ".join(a.get("name", "") for a in authors_list) or None

        # Extract publishers
        publishers_list = book.get("publishers", [])
        publisher_str = publishers_list[0].get("name", "") if publishers_list else None

        # Extract publication date
        pub_date = book.get("publish_date")

        # Extract description (can be a string or a dict with 'value' key)
        description_raw = book.get("excerpts", [{}])
        description = None
        if isinstance(description_raw, list) and description_raw:
            first = description_raw[0]
            description = first.get("text") if isinstance(first, dict) else str(first)
        # Also check 'notes' field as some entries store descriptions there
        if not description:
            notes = book.get("notes")
            if isinstance(notes, str):
                description = notes
            elif isinstance(notes, dict):
                description = notes.get("value")

        # Extract page count
        page_count = book.get("number_of_pages")

        # Cover image — use the Open Library Covers API (reliable large images)
        cover_url = f"{OL_COVERS_BASE}/{isbn_13}-L.jpg?default=false"
        # Verify the cover actually exists (returns 404 if not)
        try:
            cover_check = requests.head(cover_url, timeout=5, allow_redirects=True)
            if cover_check.status_code != 200:
                cover_url = None
        except Exception:
            cover_url = None

        # Extract subjects/categories
        subjects = book.get("subjects", [])
        categories = [s.get("name", "") for s in subjects if isinstance(s, dict)]

        return {
            "title": book.get("title"),
            "author": author_str,
            "publisher": publisher_str,
            "publication_date": pub_date,
            "description": description,
            "cover_image_url": cover_url,
            "page_count": page_count,
            "categories": categories,
        }

    except requests.exceptions.Timeout:
        print(f"  [open_library] Timeout looking up ISBN {isbn_13}")
        return None
    except requests.exceptions.HTTPError as e:
        if e.response is not None and e.response.status_code == 429:
            print(f"  [open_library] Rate limited — waiting 5s...")
            time.sleep(5)
            return lookup_isbn(isbn_13)  # Retry once
        print(f"  [open_library] HTTP error for ISBN {isbn_13}: {e}")
        return None
    except Exception as e:
        print(f"  [open_library] Error looking up ISBN {isbn_13}: {e}")
        return None


def bulk_enrich(isbn_list, delay=REQUEST_DELAY):
    """
    Look up multiple ISBNs on Open Library with rate limiting.

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

        print(f"  [OL {i + 1}/{total}] Looking up {isbn}...", end=" ")
        data = lookup_isbn(isbn)

        if data:
            results[isbn] = data
            print(f"found: {data.get('title', '?')}")
        else:
            print("not found")

    print(f"\n  Open Library enriched {len(results)}/{total} ISBNs")
    return results
