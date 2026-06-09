"""
ftp_download.py — Downloads the Jonathan Ball stock file via FTPS.

Connects to the Jonathan Ball Publishers FTPS server,
navigates to the OUT directory, and downloads JBPStock.csv.

Credentials are read from the shared .env file in the FTPS root folder.
"""

from ftplib import FTP_TLS
from dotenv import load_dotenv
from pathlib import Path
import os

# ----------------------------
# LOAD ENV VARIABLES
# ----------------------------
FTPS_ROOT = Path(__file__).resolve().parent.parent  # backend/FTPS/
load_dotenv(FTPS_ROOT / ".env")

# ----------------------------
# FTP CONFIG
# ----------------------------
HOST = os.getenv("FTP_HOST")
USER = os.getenv("FTP_USER")
PASSWORD = os.getenv("FTP_PASSWORD")

if not HOST or not USER or not PASSWORD:
    raise ValueError("Missing FTP credentials. Copy .env.example to .env and fill in your credentials.")

# ----------------------------
# LOCAL PATH SETUP
# ----------------------------
JB_DIR = Path(__file__).resolve().parent  # backend/FTPS/Jonathan Ball/
DOWNLOAD_DIR = JB_DIR / "downloads"
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

REMOTE_FILE = "JBPStock.csv"
LOCAL_FILE = DOWNLOAD_DIR / REMOTE_FILE

# ----------------------------
# CONNECT & DOWNLOAD
# ----------------------------
try:
    print("🔄 Connecting to FTPS server...")

    ftps = FTP_TLS(HOST)
    ftps.login(USER, PASSWORD)
    ftps.prot_p()  # Secure data connection

    print("✅ Connected to:", HOST)

    # Enter the OUT directory where stock files are placed
    ftps.cwd("OUT")
    print("📂 Current FTP folder:", ftps.pwd())

    # List available files (useful for debugging)
    files = ftps.nlst()
    print(f"   Files available: {len(files)}")

    # Download
    print(f"\n⬇️  Downloading {REMOTE_FILE}...")
    with open(LOCAL_FILE, "wb") as f:
        ftps.retrbinary(f"RETR {REMOTE_FILE}", f.write)

    file_size_mb = LOCAL_FILE.stat().st_size / (1024 * 1024)
    print(f"✅ Downloaded: {REMOTE_FILE} ({file_size_mb:.1f} MB)")
    print(f"   Saved to: {LOCAL_FILE}")

    ftps.quit()
    print("🔒 FTP session closed.")

except Exception as e:
    print("❌ FTP Error:", e)
    raise