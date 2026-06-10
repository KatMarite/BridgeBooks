"""
email_download.py — Downloads the Protea stock file via IMAP Email.

Logs the download event (success/failure) to the ingestion_events table.
"""

import imaplib
import email
from email.header import decode_header
from pathlib import Path
from dotenv import load_dotenv
import os
import sys
import logging

# Add backend root to path for shared utils
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from utils.ingestion_logger import IngestionLogger

# ----------------------------
# PATH SETUP
# ----------------------------
PIPELINE_DIR = Path(__file__).resolve().parent
INGESTION_ROOT = PIPELINE_DIR.parent

DOWNLOAD_DIR = PIPELINE_DIR / "downloads"
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

LOG_DIR = PIPELINE_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "protea_email.log"

logging.basicConfig(
    filename=LOG_FILE, level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

# ----------------------------
# LOAD ENV VARIABLES
# ----------------------------
load_dotenv(INGESTION_ROOT / ".env")

EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")
IMAP_SERVER = os.getenv("IMAP_SERVER")

PROTEA_SENDER = os.getenv("PROTEA_SENDER_EMAIL", "")
SUBJECT_KEYWORD = os.getenv("PROTEA_SUBJECT_KEYWORD", "").lower()

logger = IngestionLogger('protea', 'email_attachment')

if not EMAIL_USER or not EMAIL_PASS or not IMAP_SERVER:
    logger.start()
    logger.add_error("Missing email credentials — .env not configured")
    logger.finish('error', 'Email download failed: missing credentials')
    raise ValueError("Missing email credentials. Copy .env.example to .env and configure.")

# ----------------------------
# CONNECT TO MAILBOX
# ----------------------------
logger.start()
print("🔄 Connecting to mailbox...")

try:
    mail = imaplib.IMAP4_SSL(IMAP_SERVER)
    mail.login(EMAIL_USER, EMAIL_PASS)
    print("✅ Connected successfully")
    logging.info("Mailbox connection successful")

    mail.select("inbox")

    status, messages = mail.search(None, 'ALL')
    email_ids = messages[0].split()

    print(f"📂 Total emails found in inbox: {len(email_ids)}")
    
    recent_emails = email_ids[-20:]
    recent_emails.reverse()
    
    downloaded_count = 0
    file_saved_path = None

    for email_id in recent_emails:
        status, msg_data = mail.fetch(email_id, "(RFC822)")

        for response_part in msg_data:
            if isinstance(response_part, tuple):
                msg = email.message_from_bytes(response_part[1])

                subject, encoding = decode_header(msg.get("Subject", ""))[0]
                if isinstance(subject, bytes):
                    subject = subject.decode(encoding if encoding else "utf-8", errors="ignore")
                
                sender = msg.get("From", "")

                # Filtering
                if PROTEA_SENDER and PROTEA_SENDER.lower() not in sender.lower():
                    continue
                if SUBJECT_KEYWORD and SUBJECT_KEYWORD not in subject.lower():
                    continue

                print(f"\n📧 Checking matching email: {subject}")

                # Attachment extraction
                for part in msg.walk():
                    if part.get_content_maintype() == 'multipart':
                        continue
                    if part.get('Content-Disposition') is None:
                        continue

                    filename = part.get_filename()
                    if not filename:
                        continue
                    
                    if not filename.lower().endswith(('.csv', '.xlsx', '.xls')):
                        logger.add_error(f"Skipped non-data attachment: {filename}")
                        continue

                    filepath = DOWNLOAD_DIR / filename
                    with open(filepath, "wb") as f:
                        f.write(part.get_payload(decode=True))

                    downloaded_count += 1
                    file_saved_path = filepath
                    logger.file_name = filename  # Update the logger with actual filename
                    print(f"   ⬇️ Downloaded: {filename}")
                    logging.info(f"Downloaded attachment: {filename} from {sender}")
        
        if downloaded_count > 0:
            break

    # ----------------------------
    # SUMMARY
    # ----------------------------
    if downloaded_count > 0:
        logger.add_processed()
        logger.finish('success', f"Downloaded Protea stock file: {file_saved_path.name}")
    else:
        logger.add_error("No matching emails with stock attachments found in inbox")
        logger.finish('warning', "No Protea stock file found in recent emails")

    logging.info(f"Total attachments downloaded: {downloaded_count}")
    mail.logout()

except imaplib.IMAP4.error as e:
    logger.add_error(f"IMAP authentication failed: {e}")
    logger.finish('error', f"Email download failed: authentication error")
    logging.error(f"IMAP Error: {e}")
    raise

except ConnectionRefusedError as e:
    logger.add_error(f"Cannot connect to mail server {IMAP_SERVER}: {e}")
    logger.finish('error', f"Email download failed: mail server unreachable")
    logging.error(f"Connection Error: {e}")
    raise

except Exception as e:
    logger.add_error(f"Unexpected email error: {e}")
    logger.finish('error', f"Email download failed: {e}")
    logging.error(f"Mailbox Error: {e}")
    raise