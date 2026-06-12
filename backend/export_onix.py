import psycopg2
import xml.etree.ElementTree as ET

# ----------------------------
# CONNECT TO POSTGRESQL
# ----------------------------
conn = psycopg2.connect(
    host="localhost",
    database="Bridge_dev",
    user="postgres",
    password="admin123"
)

cur = conn.cursor()

# ----------------------------
# FETCH MASTER CATALOGUE DATA
# ----------------------------
cur.execute("""
SELECT
    b.isbn_13,
    b.title,
    b.author,
    b.publisher,
    b.publication_date,
    MAX(sp.retail_price) as retail_price
FROM books b
LEFT JOIN supplier_prices sp ON b.isbn_13 = sp.isbn_13
GROUP BY b.isbn_13, b.title, b.author, b.publisher, b.publication_date
""")

books = cur.fetchall()

# ----------------------------
# CREATE ONIX XML
# ----------------------------
root = ET.Element("ONIXMessage", release="3.0")

# Standard ONIX Header
header = ET.SubElement(root, "Header")
sender = ET.SubElement(header, "Sender")
ET.SubElement(sender, "SenderName").text = "BridgeBooks"

for book in books:
    isbn, title, author, publisher, pub_date, retail_price = book

    # Skip records missing required fields
    if not isbn or not title:
        continue

    product = ET.SubElement(root, "Product")

    # ISBN
    identifier = ET.SubElement(product, "ProductIdentifier")
    ET.SubElement(identifier, "ProductIDType").text = "15"
    ET.SubElement(identifier, "IDValue").text = str(isbn)

    # Descriptive Detail
    descriptive = ET.SubElement(product, "DescriptiveDetail")

    # Title
    title_detail = ET.SubElement(descriptive, "TitleDetail")
    title_element = ET.SubElement(title_detail, "TitleElement")
    ET.SubElement(title_element, "TitleText").text = str(title)

    # Author
    contributor = ET.SubElement(descriptive, "Contributor")
    ET.SubElement(contributor, "PersonName").text = (
        str(author) if author else "Unknown Author"
    )

    # Publishing Detail
    publishing = ET.SubElement(product, "PublishingDetail")

    publisher_node = ET.SubElement(publishing, "Publisher")
    ET.SubElement(publisher_node, "PublisherName").text = (
        str(publisher) if publisher else "Unknown Publisher"
    )

    # Publication Date
    if pub_date:
        ET.SubElement(
            publishing,
            "PublishingDate"
        ).text = str(pub_date)

    # Price
    if retail_price is not None:
        supply = ET.SubElement(product, "ProductSupply")
        price_node = ET.SubElement(supply, "Price")
        ET.SubElement(price_node, "PriceAmount").text = str(retail_price)

# ----------------------------
# SAVE XML FILE
# ----------------------------
tree = ET.ElementTree(root)

tree.write(
    "onix_export.xml",
    encoding="utf-8",
    xml_declaration=True
)

# ----------------------------
# CLEAN UP
# ----------------------------
cur.close()
conn.close()

print("ONIX export completed successfully!")