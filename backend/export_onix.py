"""
export_onix.py — Production ONIX 3.0 XML export for Bridge Books / EasyBooks.

Generates a valid ONIX 3.0 file from the master catalogue database,
suitable for import by:
  - ONIXEDIT Bookstore (Shopify app)
  - Protea Distribution
  - Catalyst / Ingram (US, planned 2027)

ONIX fields included:
  RecordReference, NotificationType, ProductIdentifier (ISBN-13)
  ProductComposition, ProductForm, Measure (dimensions + weight)
  Language, TitleDetail (with TitleType + TitleElementLevel)
  Contributor (with ContributorRole + BiographicalNote)
  Subject (Thema — SubjectSchemeIdentifier 93)
  PublishingDetail (Publisher, PublishingDate, PublishingStatus, SalesRights)
  ProductSupply > SupplyDetail (Supplier, ProductAvailability, Price with CurrencyCode)

Usage:
    python3 export_onix.py                          # all active titles
    python3 export_onix.py --publisher "Aristata"   # filter by publisher name
    python3 export_onix.py --easybooks-only         # only is_easybooks=true rows
    python3 export_onix.py --isbn 9781234567890     # single title
    python3 export_onix.py --out custom_name.xml    # custom output filename

Schema notes:
    The books table should have these columns (add if missing):
        product_form    VARCHAR(4)     -- ONIX ProductForm code e.g. BC (paperback)
        language_code   CHAR(3)        -- ISO 639-2/B e.g. eng, afr, zul
        thema_code      VARCHAR(10)    -- Primary Thema subject code
        weight_grams    NUMERIC        -- Unit weight in grams
        height_mm       NUMERIC        -- Height in mm
        width_mm        NUMERIC        -- Width in mm
        thickness_mm    NUMERIC        -- Spine thickness in mm
        author_bio      TEXT           -- BiographicalNote
        is_easybooks    BOOLEAN        -- True for EasyBooks distribution clients
        territory       VARCHAR(50)    -- Space-separated ISO country codes
                                       -- default: 'ZA NA BW'
"""

from __future__ import annotations

import os
import sys
import argparse
import psycopg2
import psycopg2.extras
from datetime import datetime, date
from xml.etree.ElementTree import (
    Element, SubElement, ElementTree, indent
)
from dotenv import load_dotenv
from pathlib import Path

# ----------------------------
# CONFIG
# ----------------------------
load_dotenv(Path(__file__).resolve().parent / ".env")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:admin123@localhost:5432/Bridge_dev"
)

SENDER_NAME  = os.getenv("ONIX_SENDER_NAME",  "Bridge Books")
SENDER_EMAIL = os.getenv("ONIX_SENDER_EMAIL", "info@bridgebooks.co.za")
DEFAULT_TERRITORY = "ZA NA BW"   # South Africa, Namibia, Botswana

# ONIX ProductForm defaults (used when column is NULL or missing from schema)
DEFAULT_PRODUCT_FORM = "BC"   # BC = Paperback/softback (most common SA trade format)
DEFAULT_LANGUAGE     = "eng"  # ISO 639-2

# ProductAvailability codes
AVAILABILITY_IN_STOCK  = "20"  # Available
AVAILABILITY_POD       = "23"  # Print on demand
AVAILABILITY_NOT_AVAIL = "40"  # Not available

# ----------------------------
# HELPERS
# ----------------------------
def fmt_date(val) -> str | None:
    """Convert a date/string to YYYYMMDD for ONIX."""
    if val is None:
        return None
    if isinstance(val, (date, datetime)):
        return val.strftime("%Y%m%d")
    s = str(val).strip().replace("-", "")
    # Reject placeholder dates
    if s in ("", "00010101", "19000101"):
        return None
    if len(s) == 8 and s.isdigit():
        return s
    return None

def safe(val, default="") -> str:
    """Return stripped string or default."""
    if val is None:
        return default
    return str(val).strip() or default

def col_exists(cur, column: str) -> bool:
    """Check if a column exists in the books table."""
    cur.execute("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'books' AND column_name = %s
    """, (column,))
    return cur.fetchone() is not None

# ----------------------------
# BUILD QUERY
# ----------------------------
def build_query(filters: dict, extended_cols: list) -> tuple[str, list]:
    """Build the SELECT query dynamically based on available schema columns."""
    base_cols = [
        "b.isbn_13", "b.title", "b.author", "b.publisher",
        "b.publication_date", "b.description", "b.cover_image_url",
    ]
    extra = [f"b.{c}" for c in extended_cols if c != "isbn_13"]
    price_col = "MAX(sp.retail_price) AS retail_price"
    stock_col  = "BOOL_OR(sp.in_stock) AS in_stock"
    qty_col    = "COALESCE(SUM(sp.stock_quantity), 0) AS stock_quantity"

    select = ", ".join(base_cols + extra + [price_col, stock_col, qty_col])

    group_by = ", ".join(base_cols + extra)

    where_clauses = ["b.isbn_13 IS NOT NULL", "b.title IS NOT NULL"]
    params = []

    if filters.get("easybooks_only") and "is_easybooks" in extended_cols:
        where_clauses.append("b.is_easybooks = TRUE")

    if filters.get("publisher"):
        where_clauses.append("b.publisher ILIKE %s")
        params.append(f"%{filters['publisher']}%")

    if filters.get("isbn"):
        where_clauses.append("b.isbn_13 = %s")
        params.append(filters["isbn"])

    where = "WHERE " + " AND ".join(where_clauses)

    sql = f"""
        SELECT {select}
        FROM books b
        LEFT JOIN supplier_prices sp ON b.isbn_13 = sp.isbn_13
        {where}
        GROUP BY {group_by}
        ORDER BY b.publisher, b.title
    """
    return sql, params

# ----------------------------
# XML BUILDERS
# ----------------------------
def add_header(root: Element) -> None:
    header = SubElement(root, "Header")
    sender = SubElement(header, "Sender")
    SubElement(sender, "SenderName").text = SENDER_NAME
    SubElement(sender, "EmailAddress").text = SENDER_EMAIL
    SubElement(header, "SentDateTime").text = datetime.now().strftime("%Y%m%d")
    SubElement(header, "DefaultLanguageOfText").text = DEFAULT_LANGUAGE
    SubElement(header, "DefaultCurrencyCode").text = "ZAR"


def add_product(root: Element, row: dict, extended_cols: list) -> None:
    isbn    = safe(row["isbn_13"])
    title   = safe(row["title"])
    author  = safe(row["author"], "Unknown Author")
    pub     = safe(row["publisher"], "Unknown Publisher")

    product = SubElement(root, "Product")

    # Reference & notification type
    SubElement(product, "RecordReference").text = f"bridgebooks-{isbn}"
    SubElement(product, "NotificationType").text = "03"  # Confirmed publication

    # ISBN-13
    ident = SubElement(product, "ProductIdentifier")
    SubElement(ident, "ProductIDType").text = "15"
    SubElement(ident, "IDValue").text = isbn

    # ── DescriptiveDetail ──────────────────────────────────────────────────────
    desc = SubElement(product, "DescriptiveDetail")

    SubElement(desc, "ProductComposition").text = "00"  # Single-item retail product

    # ProductForm
    pf = safe(row.get("product_form"), DEFAULT_PRODUCT_FORM)
    SubElement(desc, "ProductForm").text = pf

    # Physical measures (if available)
    measures = [
        ("01", "height_mm"),     # Height
        ("02", "width_mm"),      # Width
        ("03", "thickness_mm"),  # Spine thickness
        ("08", "weight_grams"),  # Unit weight
    ]
    for measure_type, col in measures:
        if col in extended_cols and row.get(col) is not None:
            m = SubElement(desc, "Measure")
            SubElement(m, "MeasureType").text = measure_type
            SubElement(m, "Measurement").text = str(row[col])
            SubElement(m, "MeasureUnitCode").text = "gr" if col == "weight_grams" else "mm"

    # Language
    lang_code = safe(row.get("language_code"), DEFAULT_LANGUAGE)
    lang = SubElement(desc, "Language")
    SubElement(lang, "LanguageRole").text = "01"   # Language of text
    SubElement(lang, "LanguageCode").text = lang_code.lower()[:3]

    # Thema subject
    thema = safe(row.get("thema_code"), "")
    if thema:
        subj = SubElement(desc, "Subject")
        SubElement(subj, "SubjectSchemeIdentifier").text = "93"  # Thema
        SubElement(subj, "SubjectCode").text = thema

    # TitleDetail
    td = SubElement(desc, "TitleDetail")
    SubElement(td, "TitleType").text = "01"          # Distinctive title of item
    te = SubElement(td, "TitleElement")
    SubElement(te, "TitleElementLevel").text = "01"  # Product level
    SubElement(te, "TitleText").text = title

    # Contributor (author)
    contrib = SubElement(desc, "Contributor")
    SubElement(contrib, "SequenceNumber").text = "1"
    SubElement(contrib, "ContributorRole").text = "A01"  # Written by
    SubElement(contrib, "PersonName").text = author

    bio = safe(row.get("author_bio"), "")
    if bio:
        SubElement(contrib, "BiographicalNote").text = bio

    # ── PublishingDetail ───────────────────────────────────────────────────────
    publishing = SubElement(product, "PublishingDetail")

    publisher_el = SubElement(publishing, "Publisher")
    SubElement(publisher_el, "PublishingRole").text = "01"  # Publisher
    SubElement(publisher_el, "PublisherName").text = pub

    pub_date = fmt_date(row.get("publication_date"))
    if pub_date:
        pd_el = SubElement(publishing, "PublishingDate")
        SubElement(pd_el, "PublishingDateRole").text = "01"  # Publication date
        SubElement(pd_el, "Date").text = pub_date

    SubElement(publishing, "PublishingStatus").text = "04"  # Active

    # Sales rights
    territory = safe(row.get("territory"), DEFAULT_TERRITORY)
    sr = SubElement(publishing, "SalesRights")
    SubElement(sr, "SalesRightsType").text = "01"  # For sale with exclusive rights
    terr = SubElement(sr, "Territory")
    SubElement(terr, "CountriesIncluded").text = territory

    # ── ProductSupply ──────────────────────────────────────────────────────────
    supply = SubElement(product, "ProductSupply")
    sd = SubElement(supply, "SupplyDetail")

    supplier = SubElement(sd, "Supplier")
    SubElement(supplier, "SupplierRole").text = "01"   # Publisher
    SubElement(supplier, "SupplierName").text = SENDER_NAME

    # Availability
    in_stock = row.get("in_stock")
    qty      = row.get("stock_quantity", 0) or 0
    if qty > 0 or in_stock:
        avail = AVAILABILITY_IN_STOCK
    else:
        avail = AVAILABILITY_NOT_AVAIL
    SubElement(sd, "ProductAvailability").text = avail

    # Price
    retail = row.get("retail_price")
    if retail is not None and float(retail) > 0:
        price_el = SubElement(sd, "Price")
        SubElement(price_el, "PriceType").text = "02"   # RRP excluding tax
        SubElement(price_el, "PriceAmount").text = f"{float(retail):.2f}"
        SubElement(price_el, "CurrencyCode").text = "ZAR"
        price_terr = SubElement(price_el, "Territory")
        SubElement(price_terr, "CountriesIncluded").text = "ZA"

    # Cover image (CollateralDetail)
    cover = safe(row.get("cover_image_url"), "")
    if cover:
        coll = SubElement(product, "CollateralDetail")
        sr_el = SubElement(coll, "SupportingResource")
        SubElement(sr_el, "ResourceContentType").text = "01"  # Front cover
        SubElement(sr_el, "ContentAudience").text = "01"      # Unrestricted
        rf = SubElement(sr_el, "ResourceFeature")
        SubElement(rf, "ResourceFeatureType").text = "01"
        rv = SubElement(sr_el, "ResourceVersion")
        SubElement(rv, "ResourceForm").text = "02"            # Linkable resource
        SubElement(rv, "ResourceLink").text = cover

    # Description (TextContent)
    description = safe(row.get("description"), "")
    if description:
        if not product.find("CollateralDetail"):
            coll = SubElement(product, "CollateralDetail")
        else:
            coll = product.find("CollateralDetail")
        tc = SubElement(coll, "TextContent")
        SubElement(tc, "TextType").text = "03"          # Description / back-cover
        SubElement(tc, "ContentAudience").text = "01"   # Unrestricted
        SubElement(tc, "Text").text = description


# ----------------------------
# MAIN
# ----------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Export BridgeBooks catalogue to ONIX 3.0 XML"
    )
    parser.add_argument("--publisher",      help="Filter by publisher name (partial match)")
    parser.add_argument("--easybooks-only", action="store_true",
                        help="Only export EasyBooks distribution clients")
    parser.add_argument("--isbn",           help="Export a single ISBN")
    parser.add_argument("--out",            default="onix_export.xml",
                        help="Output filename (default: onix_export.xml)")
    args = parser.parse_args()

    conn = psycopg2.connect(DATABASE_URL, sslmode="require")
    conn.autocommit = True

    with conn.cursor() as cur:
        # Detect which optional columns exist in the schema
        optional_cols = [
            "product_form", "language_code", "thema_code",
            "weight_grams", "height_mm", "width_mm", "thickness_mm",
            "author_bio", "is_easybooks", "territory",
        ]
        extended_cols = [c for c in optional_cols if col_exists(cur, c)]

        missing = set(optional_cols) - set(extended_cols)
        if missing:
            print(f"Note: {len(missing)} optional column(s) not yet in schema "
                  f"(defaults will be used): {', '.join(sorted(missing))}")

        filters = {
            "easybooks_only": args.easybooks_only,
            "publisher":      args.publisher,
            "isbn":           args.isbn,
        }

        sql, params = build_query(filters, extended_cols)
        cur.execute(sql, params)
        rows = cur.fetchall()
        col_names = [desc[0] for desc in cur.description]

    conn.close()

    if not rows:
        print("No records matched the filter criteria. Nothing exported.")
        sys.exit(0)

    print(f"Exporting {len(rows):,} records to {args.out}...")

    # Build XML
    root = Element("ONIXMessage", release="3.0")
    add_header(root)

    skipped = 0
    for raw_row in rows:
        row = dict(zip(col_names, raw_row))
        if not row.get("isbn_13") or not row.get("title"):
            skipped += 1
            continue
        add_product(root, row, extended_cols)

    # Pretty-print
    indent(root, space="  ")
    tree = ElementTree(root)
    tree.write(args.out, encoding="utf-8", xml_declaration=True)

    exported = len(rows) - skipped
    print(f"Done. {exported:,} records exported to '{args.out}'"
          + (f" ({skipped} skipped — missing ISBN or title)" if skipped else ""))


if __name__ == "__main__":
    main()
