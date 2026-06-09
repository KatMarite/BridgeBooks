"""
email_download.py — Downloads the Protea stock file via IMAP Email.

Connects to a mailbox, searches for emails from Protea containing
stock updates, and downloads the attached CSV or Excel file.
"""

import imaplib
import email
from email.header import decode_header
from pathlib import Path
from dotenv import load_dotenv
import os
import logging

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
    filename=LOG_FILE,
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

# ----------------------------
# LOAD ENV VARIABLES
# ----------------------------
load_dotenv(INGESTION_ROOT / ".env")

EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")
IMAP_SERVER = os.getenv("IMAP_SERVER")

# Optional filtering config
PROTEA_SENDER = os.getenv("PROTEA_SENDER_EMAIL", "")
SUBJECT_KEYWORD = os.getenv("PROTEA_SUBJECT_KEYWORD", "").lower()

if not EMAIL_USER or not EMAIL_PASS or not IMAP_SERVER:
    raise ValueError("Missing email credentials. Copy .env.example to .env and configure.")

# ----------------------------
# CONNECT TO MAILBOX
# ----------------------------
print("🔄 Connecting to mailbox...")

try:
    mail = imaplib.IMAP4_SSL(IMAP_SERVER)
    mail.login(EMAIL_USER, EMAIL_PASS)
    print("✅ Connected successfully")
    logging.info("Mailbox connection successful")

    mail.select("inbox")

    # ----------------------------
    # SEARCH EMAILS
    # ----------------------------
    # We search for ALL emails, but in a real production system you'd use:
    # search_criteria = f'(FROM "{PROTEA_SENDER}" UNSEEN)' 
    status, messages = mail.search(None, 'ALL')
    email_ids = messages[0].split()

    print(f"📂 Total emails found in inbox: {len(email_ids)}")
    
    # We'll only check the most recent 20 emails to save time
    recent_emails = email_ids[-20:]
    recent_emails.reverse() # Newest first
    
    downloaded_count = 0
    file_saved_path = None

    for email_id in recent_emails:
        status, msg_data = mail.fetch(email_id, "(RFC822)")

        for response_part in msg_data:
            if isinstance(response_part, tuple):
                msg = email.message_from_bytes(response_part[1])

                # Get Subject
                subject, encoding = decode_header(msg.get("Subject", ""))[0]
                if isinstance(subject, bytes):
                    subject = subject.decode(encoding if encoding else "utf-8", errors="ignore")
                
                # Get Sender
                sender = msg.get("From", "")

                # ----------------------------
                # FILTERING
                # ----------------------------
                if PROTEA_SENDER and PROTEA_SENDER.lower() not in sender.lower():
                    continue
                if SUBJECT_KEYWORD and SUBJECT_KEYWORD not in subject.lower():
                    continue

                print(f"\n📧 Checking matching email: {subject}")

                # ----------------------------
                # ATTACHMENT EXTRACTION
                # ----------------------------
                for part in msg.walk():
                    if part.get_content_maintype() == 'multipart':
                        continue
                    if part.get('Content-Disposition') is None:
                        continue

                    filename = part.get_filename()
                    if not filename:
                        continue
                    
                    # Only download stock data files
                    if not filename.lower().endswith(('.csv', '.xlsx', '.xls')):
                        continue

                    filepath = DOWNLOAD_DIR / filename
                    with open(filepath, "wb") as f:
                        f.write(part.get_payload(decode=True))

                    downloaded_count += 1
                    file_saved_path = filepath
                    print(f"   ⬇️ Downloaded: {filename}")
                    logging.info(f"Downloaded attachment: {filename} from {sender}")
        
        # Stop after we find the newest matching stock file
        if downloaded_count > 0:
            break

    # ----------------------------
    # SUMMARY
    # ----------------------------
    print("\n===== DOWNLOAD SUMMARY =====")
    if downloaded_count > 0:
        print(f"✅ Downloaded newest Protea stock file: {file_saved_path.name}")
    else:
        print("⚠️ No matching emails with stock attachments found.")

    logging.info(f"Total attachments downloaded: {downloaded_count}")

    mail.logout()

except Exception as e:
    print("❌ Mailbox Error:", e)
    logging.error(f"Mailbox Error: {e}")
    raise