"""
ftp_download.py — Downloads the Jonathan Ball stock file via FTPS.

Logs the download event to the ingestion_events table.
"""

from ftplib import FTP_TLS
from dotenv import load_dotenv
from pathlib import Path
import os
import sys

# Add backend root to path for shared utils
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from utils.ingestion_logger import IngestionLogger

# ----------------------------
# LOAD ENV VARIABLES
# ----------------------------
FTPS_ROOT = Path(__file__).resolve().parent.parent  # backend/FTPS/
load_dotenv(FTPS_ROOT / ".env")

HOST = os.getenv("FTP_HOST")
USER = os.getenv("FTP_USER")
PASSWORD = os.getenv("FTP_PASSWORD")

REMOTE_FILE = "JBPStock.csv"
logger = IngestionLogger('jonathanBall', REMOTE_FILE)

if not HOST or not USER or not PASSWORD:
    logger.start()
    logger.add_error("Missing FTP credentials — .env not configured")
    logger.finish('error', 'FTP download failed: missing credentials')
    raise ValueError("Missing FTP credentials. Copy .env.example to .env and fill in your credentials.")

# ----------------------------
# LOCAL PATH SETUP
# ----------------------------
JB_DIR = Path(__file__).resolve().parent
DOWNLOAD_DIR = JB_DIR / "downloads"
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

LOCAL_FILE = DOWNLOAD_DIR / REMOTE_FILE

# ----------------------------
# CONNECT & DOWNLOAD
# ----------------------------
logger.start()

try:
    print("🔄 Connecting to FTPS server...")

    ftps = FTP_TLS(HOST)
    ftps.login(USER, PASSWORD)
    ftps.prot_p()

    print("✅ Connected to:", HOST)

    ftps.cwd("OUT")
    print("📂 Current FTP folder:", ftps.pwd())

    files = ftps.nlst()
    print(f"   Files available: {len(files)}")

    if REMOTE_FILE not in files:
        logger.add_error(f"File '{REMOTE_FILE}' not found on FTP server")
        logger.finish('error', f"FTP download failed: {REMOTE_FILE} not found on server")
        ftps.quit()
        raise FileNotFoundError(f"{REMOTE_FILE} not found on FTP server")

    print(f"\n⬇️  Downloading {REMOTE_FILE}...")
    with open(LOCAL_FILE, "wb") as f:
        ftps.retrbinary(f"RETR {REMOTE_FILE}", f.write)

    file_size_mb = LOCAL_FILE.stat().st_size / (1024 * 1024)
    logger.add_processed()
    logger.finish('success', f"Downloaded {REMOTE_FILE} ({file_size_mb:.1f} MB)")

    ftps.quit()
    print("🔒 FTP session closed.")

except Exception as e:
    logger.add_error(f"FTP connection/download failed: {e}")
    logger.finish('error', f"FTP download failed: {e}")
    raise