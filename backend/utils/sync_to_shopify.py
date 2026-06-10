"""
sync_to_shopify.py — Core Delta Sync Engine for BridgeBooks.

Pushes updated catalogue data from PostgreSQL to Shopify.
Uses Option A pricing (highest RRP) and dynamic inventory fallback.
"""

import os
import sys
import argparse
import psycopg2
from psycopg2.extras import DictCursor
from datetime import datetime

# Ensure backend root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.shopify_client import ShopifyClient, ShopifyAPIError
from utils.ingestion_logger import IngestionLogger

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:admin123@localhost:5432/Bridge_dev"
)

def fetch_books_to_sync(conn, limit=50):
    """Find ISBNs that have changed since the last Shopify sync."""
    cur = conn.cursor()
    # Find books where the book itself OR its supplier prices have updated
    cur.execute(
        """
        SELECT DISTINCT b.isbn_13
        FROM books b
        LEFT JOIN supplier_prices sp ON b.isbn_13 = sp.isbn_13
        WHERE b.last_synced_to_shopify IS NULL
           OR b.updated_at > b.last_synced_to_shopify
           OR sp.updated_at > b.last_synced_to_shopify
        ORDER BY b.isbn_13
        LIMIT %s
        """,
        (limit,)
    )
    isbns = [row[0] for row in cur.fetchall()]
    cur.close()
    return isbns

def fetch_book_data(conn, isbn):
    """Fetch the master record and all supplier prices for an ISBN."""
    cur = conn.cursor(cursor_factory=DictCursor)
    cur.execute("SELECT * FROM books WHERE isbn_13 = %s", (isbn,))
    book = dict(cur.fetchone())

    cur.execute("SELECT * FROM supplier_prices WHERE isbn_13 = %s", (isbn,))
    suppliers = [dict(row) for row in cur.fetchall()]
    cur.close()
    
    return book, suppliers

def build_shopify_payload(book, suppliers):
    """Apply business logic to generate Shopify product data."""
    # 1. Pricing: Highest RRP
    valid_prices = [sp['retail_price'] for sp in suppliers if sp.get('retail_price')]
    final_price = max(valid_prices) if valid_prices else 0.0

    # 2. Inventory Logic
    total_stock = sum(sp.get('stock_quantity', 0) for sp in suppliers)
    has_unquantified_stock = any(
        sp.get('in_stock') and sp.get('stock_quantity', 0) == 0 
        for sp in suppliers
    )

    if total_stock > 0:
        inventory_policy = 'deny'
        inventory_quantity = total_stock
    elif has_unquantified_stock:
        # Supplier says they have it, but we don't know exactly how many
        inventory_policy = 'continue'
        inventory_quantity = 0
    else:
        # Totally out of stock
        inventory_policy = 'deny'
        inventory_quantity = 0

    # 3. Tags (Category only, no supplier names)
    tags = book.get('category') or ""

    # Build Shopify product dict
    product_data = {
        "title": book.get('title') or f"Unknown Title ({book['isbn_13']})",
        "body_html": book.get('description') or "",
        "vendor": book.get('publisher') or "Unknown Publisher",
        "product_type": "Book",
        "tags": tags,
        "variants": [
            {
                "price": str(final_price),
                "sku": book['isbn_13'],
                "inventory_management": "shopify",
                "inventory_policy": inventory_policy
            }
        ]
    }
    
    # Optional image
    if book.get('cover_image_url'):
        product_data["images"] = [{"src": book['cover_image_url']}]

    return product_data, inventory_quantity

def mark_synced(conn, isbn, shopify_product_id=None):
    """Update the last_synced_to_shopify timestamp and product ID."""
    cur = conn.cursor()
    if shopify_product_id:
        cur.execute(
            """UPDATE books SET 
                 shopify_product_id = %s,
                 last_synced_to_shopify = NOW()
               WHERE isbn_13 = %s""",
            (shopify_product_id, isbn)
        )
    else:
        cur.execute(
            """UPDATE books SET last_synced_to_shopify = NOW()
               WHERE isbn_13 = %s""",
            (isbn,)
        )
    cur.close()

def sync_batch(limit=50):
    """Main sync execution loop."""
    logger = IngestionLogger('shopify_sync', 'sync_to_shopify.py')
    logger.start()

    conn = psycopg2.connect(DATABASE_URL)
    
    try:
        shopify = ShopifyClient()
        primary_location = shopify.get_primary_location()
        print(f"Connected to Shopify. Primary Location: {primary_location}")
    except Exception as e:
        logger.finish('error', f"Failed to connect to Shopify: {e}")
        return

    try:
        isbns = fetch_books_to_sync(conn, limit)
        print(f"Found {len(isbns)} books needing sync.")
        
        if not isbns:
            logger.finish('success', 'No books need syncing at this time.')
            conn.close()
            return

        synced_count = 0
        
        for isbn in isbns:
            book, suppliers = fetch_book_data(conn, isbn)
            
            # Skip if no suppliers exist yet
            if not suppliers:
                mark_synced(conn, isbn)
                continue

            product_payload, target_qty = build_shopify_payload(book, suppliers)
            logger.add_processed()

            try:
                if not book.get('shopify_product_id'):
                    # CREATE NEW
                    created = shopify.create_product(product_payload)
                    product_id = str(created['id'])
                    variant = created['variants'][0]
                    inventory_item_id = variant['inventory_item_id']
                    
                    # Set inventory
                    shopify.set_inventory(inventory_item_id, target_qty, primary_location)
                    
                    # Update DB
                    mark_synced(conn, isbn, product_id)
                    synced_count += 1
                    logger.add_updated()
                    print(f"  [CREATED] {isbn} -> Shopify ID: {product_id}")
                
                else:
                    # UPDATE EXISTING
                    product_id = book['shopify_product_id']
                    # Don't update images on every sync unless necessary, but we'll include it.
                    # Actually, passing images on update adds a new image if we aren't careful.
                    # Best practice for update is omitting images unless they changed.
                    if 'images' in product_payload:
                        del product_payload['images']
                        
                    updated = shopify.update_product(product_id, product_payload)
                    variant = updated['variants'][0]
                    inventory_item_id = variant['inventory_item_id']
                    
                    # Set inventory
                    shopify.set_inventory(inventory_item_id, target_qty, primary_location)
                    
                    # Update DB
                    mark_synced(conn, isbn)
                    synced_count += 1
                    logger.add_updated()
                    print(f"  [UPDATED] {isbn} (Shopify ID: {product_id})")
                    
            except Exception as e:
                print(f"  [ERROR] {isbn}: {e}")
                logger.add_error(f"ISBN {isbn} sync failed: {e}")
                conn.rollback()
                continue
                
        conn.commit()
        logger.finish('success', f"Synced {synced_count}/{len(isbns)} books to Shopify.")

    except Exception as e:
        conn.rollback()
        logger.finish('error', f"Sync script failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sync BridgeBooks catalogue to Shopify")
    parser.add_argument("--limit", type=int, default=50, help="Max books to sync (default: 50)")
    args = parser.parse_args()

    sync_batch(limit=args.limit)
