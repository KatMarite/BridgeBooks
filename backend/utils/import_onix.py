import os
import sys
import argparse
import psycopg2
import xml.etree.ElementTree as ET
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

def strip_ns(tag):
    """Strip the namespace from an XML tag."""
    if '}' in tag:
        return tag.split('}', 1)[1]
    return tag

def get_text(element, path_tags):
    """
    Find a descendant ignoring namespaces, following the path_tags.
    Returns the text of the found element or None.
    """
    current = [element]
    for tag_name in path_tags:
        next_level = []
        for el in current:
            for child in el:
                if strip_ns(child.tag) == tag_name:
                    next_level.append(child)
        current = next_level
        if not current:
            return None
    return current[0].text if current[0].text else None

def parse_onix(xml_file):
    """
    Parse ONIX XML and yield dictionaries representing books.
    Returns (supplier_name, generator_of_books)
    """
    tree = ET.parse(xml_file)
    root = tree.getroot()

    # Extract Supplier Name from Header
    supplier_name = "Unknown Supplier"
    for header in root:
        if strip_ns(header.tag) == 'Header':
            sender_name = get_text(header, ['Sender', 'SenderName'])
            if sender_name:
                supplier_name = sender_name.strip()
            break

    def book_generator():
        for product in root:
            if strip_ns(product.tag) != 'Product':
                continue

            book_data = {}
            
            # Extract ISBN
            for identifier in product:
                if strip_ns(identifier.tag) == 'ProductIdentifier':
                    id_type = get_text(identifier, ['ProductIDType'])
                    if id_type == '15':
                        book_data['isbn_13'] = get_text(identifier, ['IDValue'])

            if not book_data.get('isbn_13'):
                continue # Skip if no ISBN-13

            # Extract Title and Author from DescriptiveDetail
            book_data['title'] = get_text(product, ['DescriptiveDetail', 'TitleDetail', 'TitleElement', 'TitleText'])
            book_data['author'] = get_text(product, ['DescriptiveDetail', 'Contributor', 'PersonName'])

            # Extract Publisher and Date from PublishingDetail
            book_data['publisher'] = get_text(product, ['PublishingDetail', 'Publisher', 'PublisherName'])
            book_data['publication_date'] = get_text(product, ['PublishingDetail', 'PublishingDate'])

            # Extract Price from ProductSupply
            price_text = get_text(product, ['ProductSupply', 'Price', 'PriceAmount'])
            if price_text:
                try:
                    book_data['retail_price'] = float(price_text)
                except ValueError:
                    book_data['retail_price'] = 0.0
            else:
                book_data['retail_price'] = 0.0

            yield book_data

    return supplier_name, book_generator()

def import_onix(xml_file):
    if not os.path.exists(xml_file):
        print(f"Error: File '{xml_file}' not found.")
        sys.exit(1)

    print(f"Parsing '{xml_file}'...")
    try:
        supplier_name, books = parse_onix(xml_file)
    except Exception as e:
        print(f"Error parsing XML: {e}")
        sys.exit(1)

    print(f"Detected Supplier Name: '{supplier_name}'")

    logger = IngestionLogger(supplier_name, os.path.basename(xml_file))
    logger.start()

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    books_query = """
    INSERT INTO books (isbn_13, title, author, publisher, publication_date)
    VALUES (%s, %s, %s, %s, %s)
    ON CONFLICT (isbn_13) DO UPDATE SET
        title = COALESCE(EXCLUDED.title, books.title),
        author = COALESCE(EXCLUDED.author, books.author),
        publisher = COALESCE(EXCLUDED.publisher, books.publisher),
        publication_date = COALESCE(EXCLUDED.publication_date, books.publication_date),
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

    for book in books:
        try:
            # 1. Upsert book metadata
            cur.execute(books_query, (
                book.get('isbn_13'),
                book.get('title'),
                book.get('author'),
                book.get('publisher'),
                book.get('publication_date')
            ))
            books_inserted += 1
            logger.add_inserted()

            # 2. Upsert supplier pricing
            cur.execute(prices_query, (
                book.get('isbn_13'),
                supplier_name,
                book.get('retail_price', 0.0)
            ))
            prices_inserted += 1
        except Exception as e:
            logger.add_error(f"ISBN {book.get('isbn_13', '?')}: {e}")
            conn.rollback()
            continue
        finally:
            logger.add_processed()

    conn.commit()
    cur.close()
    conn.close()

    summary = f"ONIX import completed: {books_inserted} books, {prices_inserted} prices upserted for {supplier_name}"
    logger.finish(status='success', message=summary)
    print(f"\nSuccess! {summary}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import BridgeBooks catalogue from an ONIX XML file")
    parser.add_argument("xml_file", type=str, help="Path to the ONIX XML file to import")
    args = parser.parse_args()

    import_onix(args.xml_file)
