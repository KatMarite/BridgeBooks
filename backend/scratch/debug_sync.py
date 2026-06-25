import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('c:/Users/Katleho/Desktop/BridgeBooks/backend/.env')
db_url = os.getenv('DATABASE_URL', 'postgresql://postgres:admin123@localhost:5432/Bridge_dev')

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    cur.execute("SELECT COUNT(*) FROM books;")
    total_books = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM books WHERE last_synced_to_shopify IS NULL;")
    null_sync = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM books WHERE last_synced_to_shopify IS NOT NULL;")
    synced_books = cur.fetchone()[0]
    
    cur.execute("""
        SELECT COUNT(DISTINCT b.isbn_13) 
        FROM books b 
        LEFT JOIN supplier_prices sp ON b.isbn_13 = sp.isbn_13 
        WHERE b.updated_at > b.last_synced_to_shopify 
           OR sp.updated_at > b.last_synced_to_shopify
    """)
    needs_update = cur.fetchone()[0]

    print(f"Total Books: {total_books}")
    print(f"Books never synced (last_synced_to_shopify is NULL): {null_sync}")
    print(f"Books previously synced: {synced_books}")
    print(f"Books needing update based on timestamps: {needs_update}")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Database error: {e}")
