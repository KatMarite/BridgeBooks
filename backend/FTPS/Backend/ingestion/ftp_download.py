"""
ftp_download.py — Downloads the Booksite stock file via FTPS.

Connects to the Booksite (Jonathan Ball Publishers) FTPS server,
navigates to the OUT directory, and downloads JBPStock.csv.

Credentials are read from the .env file in the FTPS root folder.
"""

from ftplib import FTP_TLS
from dotenv import load_dotenv
import os

# ----------------------------
# LOAD CONFIG
# ----------------------------
FTPS_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(FTPS_ROOT, '..', '.env'))

HOST = os.getenv("FTP_HOST")
USER = os.getenv("FTP_USER")
PASSWORD = os.getenv("FTP_PASSWORD")

if not HOST or not USER or not PASSWORD:
    raise ValueError("Missing FTP credentials. Copy .env.example to .env and fill in your credentials.")

# ----------------------------
# PATH SETUP
# ----------------------------
DOWNLOAD_FOLDER = os.path.join(FTPS_ROOT, "downloads")
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

FILE_NAME = "JBPStock.csv"
local_path = os.path.join(DOWNLOAD_FOLDER, FILE_NAME)

# ----------------------------
# CONNECT & DOWNLOAD
# ----------------------------
try:
    ftps = FTP_TLS(HOST)
    ftps.login(USER, PASSWORD)
    ftps.prot_p()  # Switch to secure data connection

    print("✅ Connected to FTP:", HOST)

    # Enter the OUT directory where Booksite places stock files
    ftps.cwd("OUT")
    print("📂 Entered OUT directory")

    # Download the file
    with open(local_path, "wb") as f:
        ftps.retrbinary(f"RETR {FILE_NAME}", f.write)

    file_size_mb = os.path.getsize(local_path) / (1024 * 1024)
    print(f"✅ Downloaded: {FILE_NAME} ({file_size_mb:.1f} MB)")

    ftps.quit()
    print("🔒 FTP session closed.")

except Exception as e:
    print("❌ FTP Error:", e)
    raise