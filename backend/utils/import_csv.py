import os
import sys
import argparse
import pandas as pd
import psycopg2
from dotenv import load_dotenv

# Ensure backend root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.ingestion_logger import IngestionLogger

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:admin123@localhost:5432/Bridge_dev"
)

# Heuristic mapping dictionaries (lowercase keys for matching)
COLUMN_ALIASES = {
    'isbn_13': ['isbn', 'isbn13', 'isbn-13', 'ean', 'barcode'],
    'title': ['title', 'book title', 'product name', 'description'],
    'author': ['author', 'contributor', 'writer'],
    'retail_price': ['price', 'retail price', 'rrp', 'za price', 'zar price', 'selling price', 'retail']
}

def clean_isbn(val):
    if pd.isna(val):
        return None
    cleaned = str(val).split('.')[0].strip().replace('-', '').replace(' ', '')
    if len(cleaned) == 13 and cleaned.isdigit():
        return cleaned
    if len(cleaned) == 10 and cleaned.isdigit(): # Technically we only want 13, but let's allow 10 for now
        return cleaned
    return None

def clean_price(val):
    if pd.isna(val):
        return 0.0
    try:
        # Remove currency symbols and commas
        cleaned = str(val).replace('R', '').replace('$', '').replace(',', '').strip()
        return float(cleaned)
    except ValueError:
        return 0.0

def normalize_columns(df):
    """
    Rename columns based on heuristic matching.
    """
    mapped_columns = {}
    original_cols = df.columns.tolist()
    
    for orig in original_cols:
        col_lower = str(orig).strip().lower()
        
        for std_name, aliases in COLUMN_ALIASES.items():
            if std_name in mapped_columns.values():
                continue # Already mapped this standard column
            
            if col_lower in aliases or col_lower == std_name:
                mapped_columns[orig] = std_name
                break
                
    df = df.rename(columns=mapped_columns)
    return df

def import_spreadsheet(file_path, supplier_name):
    if not os.path.exists(file_path):
        print(f"Error: File '{file_path}' not found.")
        sys.exit(1)

    print(f"Reading '{file_path}'...")
    try:
        if file_path.lower().endswith('.csv'):
            df = pd.read_csv(file_path, dtype=str)
        elif file_path.lower().endswith(('.xls', '.xlsx')):
            df = pd.read_excel(file_path, dtype=str)
        else:
            print("Error: Unsupported file format. Please provide a CSV or Excel file.")
            sys.exit(1)
    except Exception as e:
        print(f"Error reading file: {e}")
        sys.exit(1)

    # Normalize column headers
    df = normalize_columns(df)
    
    if 'isbn_13' not in df.columns:
        print(f"Error: Could not find an ISBN column in '{file_path}'. Found columns: {df.columns.tolist()}")
        sys.exit(1)

    logger = IngestionLogger(supplier_name, os.path.basename(file_path))
    logger.start()

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    books_query = """
    INSERT INTO books (isbn_13, title, author)
    VALUES (%s, %s, %s)
    ON CONFLICT (isbn_13) DO UPDATE SET
        title = COALESCE(EXCLUDED.title, books.title),
        author = COALESCE(EXCLUDED.author, books.author),
        updated_at = NOW();
    """

    prices_query = """
    INSERT INTO supplier_prices (isbn_13, supplier_name, retail_price, in_stock, currency)
    VALUES (%s, %s, %s, true, 'ZAR')
    ON CONFLICT (isbn_13, supplier_name) DO UPDATE SET
        retail_price = EXCLUDED.retail_price,
        in_stock = EXCLUDED.in_stock,
        last_synced_at = NOW(),
        updated_at = NOW();
    """

    books_inserted = 0
    prices_inserted = 0

    for index, row in df.iterrows():
        isbn = clean_isbn(row.get('isbn_13'))
        if not isbn:
            continue
            
        title = str(row.get('title', '')).strip() if 'title' in df.columns and pd.notna(row.get('title')) else None
        author = str(row.get('author', '')).strip() if 'author' in df.columns and pd.notna(row.get('author')) else None
        price = clean_price(row.get('retail_price')) if 'retail_price' in df.columns else 0.0

        try:
            # 1. Upsert book metadata
            cur.execute(books_query, (isbn, title, author))
            books_inserted += 1
            logger.add_inserted()

            # 2. Upsert supplier pricing
            cur.execute(prices_query, (isbn, supplier_name, price))
            prices_inserted += 1
        except Exception as e:
            logger.add_error(f"ISBN {isbn}: {e}")
            conn.rollback()
            continue
        finally:
            logger.add_processed()

    conn.commit()
    cur.close()
    conn.close()

    summary = f"Spreadsheet import completed: {books_inserted} books, {prices_inserted} prices upserted for {supplier_name}"
    logger.finish(status='success', message=summary)
    print(f"\nSuccess! {summary}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import BridgeBooks catalogue from a CSV or Excel file")
    parser.add_argument("file_path", type=str, help="Path to the CSV or Excel file")
    parser.add_argument("--supplier", type=str, required=True, help="Name of the supplier providing this file")
    args = parser.parse_args()

    import_spreadsheet(args.file_path, args.supplier)
