"""
pricing_engine.py — Dynamic Pricing Engine for BridgeBooks.

Fetches live exchange rates and applies margin-based pricing rules
to convert foreign supplier costs into ZAR retail prices.

Business Rules (from BridgeBooks brief):
  - Imported books: ZAR Retail = (Foreign Cost × Exchange Rate + Import Fee) × 1.30
  - Domestic books: Use the supplier's RRP/wholesale price directly (no formula).
  - Second-hand books: Staff set prices manually — this engine skips them.

Exchange rates are sourced from the free Frankfurter API (https://api.frankfurter.app).

Usage:
    python -m utils.pricing_engine                  # Update all foreign prices
    python -m utils.pricing_engine --dry-run        # Preview changes without writing
    python -m utils.pricing_engine --fee 50         # Set a R50 flat import fee

Run from the backend/ directory.
"""

import psycopg2
import requests
import os
import sys
import argparse
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.ingestion_logger import IngestionLogger

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:admin123@localhost:5432/Bridge_dev"
)

FRANKFURTER_API = "https://api.frankfurter.app/latest"

# Default import/shipping fee in ZAR — staff can override via CLI or env var
DEFAULT_IMPORT_FEE_ZAR = Decimal(os.getenv("IMPORT_FEE_ZAR", "35.00"))

# Markup multiplier for imported new books (30%)
IMPORT_MARKUP = Decimal("1.30")

# Supported foreign currencies that need conversion
FOREIGN_CURRENCIES = ["USD", "GBP", "EUR"]


def fetch_exchange_rates(base="ZAR"):
    """
    Fetch live exchange rates from Frankfurter API.

    Frankfurter returns rates relative to a base currency. We request
    with base=ZAR so we get how many ZAR per 1 unit of foreign currency.

    Actually, Frankfurter works better with foreign base, so we'll
    request each foreign currency → ZAR.

    Returns:
        dict mapping currency code -> ZAR rate (e.g. {'USD': Decimal('18.42'), ...})
    """
    rates = {}

    for currency in FOREIGN_CURRENCIES:
        try:
            resp = requests.get(
                FRANKFURTER_API,
                params={"from": currency, "to": "ZAR"},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()

            zar_rate = data.get("rates", {}).get("ZAR")
            if zar_rate is not None:
                rates[currency] = Decimal(str(zar_rate))
                print(f"  [rates] 1 {currency} = {rates[currency]} ZAR")
            else:
                print(f"  [rates] WARNING: No ZAR rate returned for {currency}")

        except Exception as e:
            print(f"  [rates] ERROR fetching {currency} rate: {e}")

    return rates


def calculate_imported_retail(cost_price, exchange_rate, import_fee):
    """
    Calculate the ZAR retail price for an imported book.

    Formula: (Foreign Cost × Exchange Rate + Import Fee) × 1.30
    Rounds to 2 decimal places.

    Args:
        cost_price: The foreign cost price (Decimal).
        exchange_rate: The ZAR rate for the foreign currency (Decimal).
        import_fee: Flat import/shipping fee in ZAR (Decimal).

    Returns:
        Decimal retail price in ZAR.
    """
    zar_cost = cost_price * exchange_rate
    total_cost = zar_cost + import_fee
    retail = total_cost * IMPORT_MARKUP
    return retail.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def run_pricing_update(import_fee=None, dry_run=False):
    """
    Main pricing update loop.

    Finds all supplier_prices rows with a foreign currency, converts
    the cost_price to ZAR, applies the import markup, and updates
    the retail_price.

    Skips:
      - ZAR-denominated records (domestic — use supplier RRP directly)
      - Books with stock_type = 'second-hand' (staff sets prices manually)
      - Records with no cost_price

    Args:
        import_fee: Override the default import fee (Decimal or None).
        dry_run: If True, print changes but don't write to DB.
    """
    fee = Decimal(str(import_fee)) if import_fee is not None else DEFAULT_IMPORT_FEE_ZAR

    logger = IngestionLogger('pricing_engine', 'pricing_engine.py')
    logger.start()

    print(f"{'[DRY RUN] ' if dry_run else ''}Starting pricing engine...")
    print(f"  Import fee: R{fee}")

    # Fetch live exchange rates
    rates = fetch_exchange_rates()
    if not rates:
        msg = "Could not fetch any exchange rates — aborting."
        print(f"  ERROR: {msg}")
        logger.add_error(msg)
        logger.finish('error', msg)
        return

    conn = psycopg2.connect(DATABASE_URL)

    try:
        cur = conn.cursor()

        # Find all foreign-currency supplier prices for non-second-hand books
        cur.execute("""
            SELECT sp.id, sp.isbn_13, sp.supplier_name, sp.currency,
                   sp.cost_price, sp.retail_price,
                   b.stock_type
            FROM supplier_prices sp
            JOIN books b ON sp.isbn_13 = b.isbn_13
            WHERE sp.currency != 'ZAR'
              AND sp.cost_price IS NOT NULL
              AND sp.cost_price > 0
              AND b.stock_type != 'second-hand'
        """)

        rows = cur.fetchall()
        print(f"  Found {len(rows)} foreign-currency records to process")

        updated_count = 0
        skipped_count = 0

        for row in rows:
            sp_id, isbn, supplier, currency, cost_price, current_retail, stock_type = row
            logger.add_processed()

            currency_upper = currency.upper().strip()
            rate = rates.get(currency_upper)

            if rate is None:
                logger.add_error(
                    f"ISBN {isbn}: No exchange rate for '{currency_upper}' — skipped"
                )
                skipped_count += 1
                continue

            cost_decimal = Decimal(str(cost_price))
            new_retail = calculate_imported_retail(cost_decimal, rate, fee)

            if dry_run:
                print(
                    f"  [preview] ISBN {isbn} ({supplier}): "
                    f"{cost_price} {currency_upper} → R{new_retail} ZAR "
                    f"(was R{current_retail or 'NULL'})"
                )
            else:
                cur.execute(
                    """UPDATE supplier_prices
                       SET retail_price = %s, updated_at = NOW()
                       WHERE id = %s""",
                    (float(new_retail), sp_id)
                )

            updated_count += 1
            logger.add_updated()

        if not dry_run:
            conn.commit()

        summary = (
            f"Pricing update complete: {updated_count} updated, "
            f"{skipped_count} skipped out of {len(rows)} foreign records"
        )
        print(f"\n  {summary}")
        logger.finish('success', summary)

    except Exception as e:
        conn.rollback()
        logger.add_error(f"Pricing engine failed: {e}")
        logger.finish('error', f"Pricing engine failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="BridgeBooks Dynamic Pricing Engine"
    )
    parser.add_argument(
        "--fee", type=float, default=None,
        help=f"Import/shipping fee in ZAR (default: R{DEFAULT_IMPORT_FEE_ZAR})"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Preview price changes without writing to the database"
    )
    args = parser.parse_args()

    run_pricing_update(import_fee=args.fee, dry_run=args.dry_run)
