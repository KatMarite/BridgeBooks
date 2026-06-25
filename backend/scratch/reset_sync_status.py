import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('c:/Users/Katleho/Desktop/BridgeBooks/backend/.env')
db_url = os.getenv('DATABASE_URL', 'postgresql://postgres:admin123@localhost:5432/Bridge_dev')

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # Reset last_synced_to_shopify for all books
    cur.execute("UPDATE books SET last_synced_to_shopify = NULL;")
    conn.commit()
    
    updated_count = cur.rowcount
    print(f"Successfully reset last_synced_to_shopify for {updated_count} books.")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Database error: {e}")
