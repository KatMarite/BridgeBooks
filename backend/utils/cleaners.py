import pandas as pd
import re

def clean_isbn(val):
    """
    Cleans an ISBN string by removing dashes, spaces, and other non-numeric characters.
    Validates that the resulting string is either 10 or 13 digits long.
    Returns the cleaned ISBN string, or None if invalid.
    """
    if pd.isna(val):
        return None
    
    val_str = str(val).split('.')[0].strip()
    
    # Remove all dashes and spaces
    cleaned = re.sub(r'[-\s]', '', val_str)
    
    if len(cleaned) == 13 and cleaned.isdigit():
        return cleaned
    if len(cleaned) == 10 and cleaned.isdigit():
        return cleaned
        
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
