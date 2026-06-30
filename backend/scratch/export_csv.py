import psycopg2
import csv
import os

DB_URL = "postgresql://postgres:456bigBooks!dot@bridgebooks-db.c1ik8o8oeljf.af-south-1.rds.amazonaws.com:5432/postgres?sslmode=require"
OUTPUT_FILE = os.path.expanduser("~/Desktop/BridgeBooks_Data_Export.csv")

def export_data():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    query = """
    SELECT 
        b.isbn_13, 
        b.title, 
        b.author, 
        b.publisher, 
        b.publication_date,
        s.supplier_name, 
        s.retail_price, 
        s.discount, 
        s.in_stock
    FROM books b
    LEFT JOIN supplier_prices s ON b.isbn_13 = s.isbn_13
    ORDER BY b.title;
    """
    
    cur.execute(query)
    rows = cur.fetchall()
    
    # Write to CSV
    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            "ISBN", "Title", "Author", "Publisher", "Publication Date", 
            "Supplier", "Retail Price", "Discount", "In Stock"
        ])
        for row in rows:
            writer.writerow(row)
            
    print(f"Exported {len(rows)} records to {OUTPUT_FILE}")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    export_data()
