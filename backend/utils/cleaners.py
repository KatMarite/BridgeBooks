import pandas as pd
import re


def _isbn10_to_13(isbn10: str) -> str:
    """Convert a valid 10-digit ISBN to its ISBN-13 equivalent."""
    core = "978" + isbn10[:9]
    total = 0
    for i, ch in enumerate(core):
        digit = int(ch)
        total += digit if i % 2 == 0 else digit * 3
    check = (10 - (total % 10)) % 10
    return core + str(check)


def _is_valid_isbn13(isbn13: str) -> bool:
    if len(isbn13) != 13 or not isbn13.isdigit():
        return False
    total = 0
    for i, ch in enumerate(isbn13):
        digit = int(ch)
        total += digit if i % 2 == 0 else digit * 3
    return total % 10 == 0


def _is_valid_isbn10(isbn10: str) -> bool:
    if len(isbn10) != 10:
        return False
    total = 0
    for i, ch in enumerate(isbn10):
        if ch.upper() == "X" and i == 9:
            value = 10
        elif ch.isdigit():
            value = int(ch)
        else:
            return False
        total += value * (10 - i)
    return total % 11 == 0


def clean_isbn(val):
    """
    Cleans an ISBN string by removing dashes, spaces, and other non-numeric characters.
    Validates the check digit and converts ISBN-10 to ISBN-13.
    Returns a valid ISBN-13 string, or None if invalid.
    """
    if pd.isna(val):
        return None

    val_str = str(val).split('.')[0].strip().upper()

    # Remove all dashes and spaces
    cleaned = re.sub(r'[-\s]', '', val_str)

    if len(cleaned) == 13 and cleaned.isdigit():
        return cleaned if _is_valid_isbn13(cleaned) else None
    if len(cleaned) == 10 and _is_valid_isbn10(cleaned):
        return _isbn10_to_13(cleaned)

    return None

def clean_price(val):
    """
    Cleans a price string by removing currency symbols (R, $), commas, and spaces.
    Returns the parsed float, or 0.0 if it cannot be parsed.
    """
    if pd.isna(val):
        return 0.0
        
    try:
        val_str = str(val).strip()
        # Remove currency symbols and commas
        cleaned = re.sub(r'[R\$,\s]', '', val_str)
        if not cleaned:
            return 0.0
        return float(cleaned)
    except ValueError:
        return 0.0

def clean_stock(val):
    """
    Cleans a stock value, which could be a number (e.g. '10', 5) or a string 
    (e.g. 'IN STOCK', 'Available', 'Y', 'True').
    Returns a boolean indicating if the item is in stock.
    """
    if pd.isna(val):
        return False
        
    val_str = str(val).strip().upper()
    
    # Check for text variations indicating in-stock status
    if val_str in ["IN STOCK", "AVAILABLE", "Y", "TRUE", "YES", "ON HAND"]:
        return True
        
    # Check for text variations indicating out of stock
    if val_str in ["OUT OF STOCK", "UNAVAILABLE", "N", "FALSE", "NO"]:
        return False
        
    # Attempt to parse as a number
    try:
        # Sometimes stock is given as "10+"
        cleaned_num = re.sub(r'[^\d.-]', '', val_str)
        if cleaned_num:
            return float(cleaned_num) > 0
        return False
    except ValueError:
        return False
