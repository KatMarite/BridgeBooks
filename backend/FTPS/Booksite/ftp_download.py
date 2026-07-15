"""
ftp_download.py — Downloads and extracts the Booksite stock file via FTP.

Booksite delivers itemmast.zip (WinZip compressed) via plain FTP.
This script downloads and extracts it to the downloads/ subfolder.
Logs the download event via IngestionLogger.

Usage:
    python3 ftp_download.py

Credentials are loaded from backend/FTPS/.env (shared with Jonathan Ball —
uses BOOKSITE_FTP_* var names so the two suppliers don't collide).
"""

import ftplib
import os
import sys
import zipfile
from pathlib import Path

# backend/ root (three levels up: Booksite/ -> FTPS/ -> backend/) for shared utils
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from utils.ingestion_logger import IngestionLogger

# ----------------------------
# LOAD ENV
# ----------------------------
from dotenv import load_dotenv
BS_DIR = Path(__file__).resolve().parent
FTPS_ROOT = BS_DIR.parent
load_dotenv(FTPS_ROOT / ".env")

HOST     = os.getenv("BOOKSITE_FTP_HOST", "41.207.238.55")
USER     = os.getenv("BOOKSITE_FTP_USER", "booksiteitm")
PASSWORD = os.getenv("BOOKSITE_FTP_PASSWORD")   # required — set in .env

REMOTE_ZIP  = "itemmast.zip"
REMOTE_FILE = "itemmast.txt"      # filename inside the zip

logger = IngestionLogger("booksite", REMOTE_ZIP)

if not PASSWORD:
    logger.start()
    logger.add_error("Missing BOOKSITE_FTP_PASSWORD — add it to backend/FTPS/.env")
    logger.finish("error", "FTP download failed: missing credentials")
    raise ValueError("BOOKSITE_FTP_PASSWORD not set. Copy .env.example to .env and fill in.")

# ----------------------------
# PATHS
# ----------------------------
DOWNLOAD_DIR = BS_DIR / "downloads"
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

LOCAL_ZIP  = DOWNLOAD_DIR / REMOTE_ZIP
LOCAL_FILE = DOWNLOAD_DIR / REMOTE_FILE

# ----------------------------
# CONNECT & DOWNLOAD
# ----------------------------
logger.start()

try:
    print(f"Connecting to FTP: {HOST}")
    ftp = ftplib.FTP()
    ftp.connect(HOST, 21, timeout=30)
    ftp.login(USER, PASSWORD)
    print(f"Connected. Welcome: {ftp.getwelcome()}")

    files = ftp.nlst()
    print(f"Files on server: {files}")

    if REMOTE_ZIP not in files:
        logger.add_error(f"'{REMOTE_ZIP}' not found on FTP server")
        logger.finish("error", f"FTP download failed: {REMOTE_ZIP} not found")
        ftp.quit()
        raise FileNotFoundError(f"{REMOTE_ZIP} not found on FTP server")

    print(f"Downloading {REMOTE_ZIP}...")
    with open(LOCAL_ZIP, "wb") as f:
        ftp.retrbinary(f"RETR {REMOTE_ZIP}", f.write)

    zip_size_mb = LOCAL_ZIP.stat().st_size / (1024 * 1024)
    print(f"Downloaded {zip_size_mb:.1f} MB")
    ftp.quit()
    print("FTP session closed.")

except ftplib.all_errors as e:
    logger.add_error(f"FTP error: {e}")
    logger.finish("error", f"FTP download failed: {e}")
    raise

# ----------------------------
# EXTRACT ZIP
# ----------------------------
try:
    print(f"Extracting {REMOTE_ZIP}...")
    with zipfile.ZipFile(LOCAL_ZIP, "r") as zf:
        # itemmast.zip may contain itemmast.txt or ITEMMAST.TXT — handle both
        names = zf.namelist()
        print(f"Contents: {names}")
        match = next(
            (n for n in names if n.upper() == REMOTE_FILE.upper()),
            None
        )
        if not match:
            raise FileNotFoundError(
                f"Expected '{REMOTE_FILE}' inside zip, found: {names}"
            )
        # Extract with correct filename casing
        data = zf.read(match)
        LOCAL_FILE.write_bytes(data)

    txt_size_mb = LOCAL_FILE.stat().st_size / (1024 * 1024)
    logger.add_processed()
    logger.finish(
        "success",
        f"Downloaded and extracted {REMOTE_ZIP} ({zip_size_mb:.1f} MB zip, "
        f"{txt_size_mb:.1f} MB extracted)"
    )
    print(f"Extracted to: {LOCAL_FILE} ({txt_size_mb:.1f} MB)")

except (zipfile.BadZipFile, FileNotFoundError) as e:
    logger.add_error(f"Extraction error: {e}")
    logger.finish("error", f"Zip extraction failed: {e}")
    raise
