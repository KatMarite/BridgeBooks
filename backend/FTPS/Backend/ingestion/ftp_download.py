"""
ftp_download.py — Downloads the Booksite stock file via FTPS.

Connects to the Booksite (Jonathan Ball Publishers) FTPS server,
navigates to the OUT directory, and downloads JBPStock.csv.

Logs the download event (success or failure) to the ingestion_events table.
"""

from ftplib import FTP_TLS
from dotenv import load_dotenv
import os
import sys

# Add backend root to path for shared utils
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from utils.ingestion_logger import IngestionLogger

# ----------------------------
# LOAD CONFIG
# ----------------------------
FTPS_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(FTPS_ROOT, '..', '.env'))

HOST = os.getenv("FTP_HOST")
USER = os.getenv("FTP_USER")
PASSWORD = os.getenv("FTP_PASSWORD")

FILE_NAME = "JBPStock.csv"
logger = IngestionLogger('booksite', FILE_NAME)

if not HOST or not USER or not PASSWORD:
    logger.start()
    logger.add_error("Missing FTP credentials — .env not configured")
    logger.finish('error', 'FTP download failed: missing credentials')
    raise ValueError("Missing FTP credentials. Copy .env.example to .env and fill in your credentials.")

# ----------------------------
# PATH SETUP
# ----------------------------
DOWNLOAD_FOLDER = os.path.join(FTPS_ROOT, "downloads")
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

local_path = os.path.join(DOWNLOAD_FOLDER, FILE_NAME)

# ----------------------------
# CONNECT & DOWNLOAD
# ----------------------------
logger.start()

try:
    ftps = FTP_TLS(HOST)
    ftps.login(USER, PASSWORD)
    ftps.prot_p()

    print("✅ Connected to FTP:", HOST)

    ftps.cwd("OUT")
    print("📂 Entered OUT directory")

    with open(local_path, "wb") as f:
        ftps.retrbinary(f"RETR {FILE_NAME}", f.write)

    file_size_mb = os.path.getsize(local_path) / (1024 * 1024)
    logger.add_processed()
    logger.finish('success', f"Downloaded {FILE_NAME} ({file_size_mb:.1f} MB)")

    ftps.quit()
    print("🔒 FTP session closed.")

except Exception as e:
    logger.add_error(f"FTP connection/download failed: {e}")
    logger.finish('error', f"FTP download failed: {e}")
    raise