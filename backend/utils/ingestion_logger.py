"""
ingestion_logger.py — Shared utility for logging pipeline runs to PostgreSQL.

Usage in any pipeline script:
    from utils.ingestion_logger import IngestionLogger

    logger = IngestionLogger('booksite', 'JBPStock.csv')
    logger.start()

    # ... do your processing ...
    logger.add_inserted(50)
    logger.add_updated(12)
    logger.add_error('Row 42: Invalid ISBN')

    logger.finish('success', 'Processed 62 records')
"""

import psycopg2
import os
import sys
from datetime import datetime


def _safe_print(text):
    """Print text safely even on Windows consoles that don't support UTF-8 emojis."""
    try:
        print(text)
    except UnicodeEncodeError:
        # Strip emoji characters for terminals that can't handle them
        safe = text.encode('ascii', errors='replace').decode('ascii')
        print(safe)


class IngestionLogger:
    """Logs a single pipeline run to the ingestion_events and ingestion_errors tables."""

    def __init__(self, supplier_name, file_name=None):
        self.supplier_name = supplier_name
        self.file_name = file_name
        self.records_processed = 0
        self.records_inserted = 0
        self.records_updated = 0
        self.errors = []
        self.started_at = None
        self.event_id = None
        self._conn = None

    def _get_connection(self):
        if self._conn is None or self._conn.closed:
            db_url = os.getenv(
                "DATABASE_URL",
                "postgresql://postgres:admin123@localhost:5432/Bridge_dev"
            )
            self._conn = psycopg2.connect(db_url)
        return self._conn

    def start(self):
        """Mark the start time of this pipeline run."""
        self.started_at = datetime.utcnow()
        _safe_print(f"[{self.supplier_name}] Pipeline started at {self.started_at.isoformat()}")

    def add_processed(self, count=1):
        self.records_processed += count

    def add_inserted(self, count=1):
        self.records_inserted += count

    def add_updated(self, count=1):
        self.records_updated += count

    def add_error(self, message):
        self.errors.append(message)

    def finish(self, status='success', message=None):
        """
        Write the pipeline run to the database.

        Args:
            status: 'success', 'warning', or 'error'
            message: Human-readable summary (auto-generated if None)
        """
        if not message:
            message = (
                f"Processed {self.records_processed} records: "
                f"{self.records_inserted} inserted, "
                f"{self.records_updated} updated, "
                f"{len(self.errors)} errors"
            )

        # Auto-escalate status based on errors
        if len(self.errors) > 0 and status == 'success':
            status = 'warning'
        if self.records_processed == 0 and len(self.errors) > 0:
            status = 'error'

        try:
            conn = self._get_connection()
            cur = conn.cursor()

            # 1. Insert the event
            cur.execute(
                """INSERT INTO ingestion_events
                   (supplier_name, status, file_name, records_processed,
                    records_inserted, records_updated, errors_count,
                    message, started_at, completed_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                   RETURNING id""",
                (
                    self.supplier_name, status, self.file_name,
                    self.records_processed, self.records_inserted,
                    self.records_updated, len(self.errors),
                    message, self.started_at
                )
            )
            self.event_id = cur.fetchone()[0]

            # 2. Insert individual errors
            for err_msg in self.errors:
                cur.execute(
                    """INSERT INTO ingestion_errors
                       (event_id, supplier_name, file_name, message)
                       VALUES (%s, %s, %s, %s)""",
                    (self.event_id, self.supplier_name, self.file_name, err_msg)
                )

            conn.commit()
            cur.close()

            icon = '[OK]' if status == 'success' else '[WARN]' if status == 'warning' else '[ERR]'
            _safe_print(f"{icon} [{self.supplier_name}] {message}")
            _safe_print(f"    Event ID: {self.event_id}")

        except Exception as e:
            _safe_print(f"[ERR] [{self.supplier_name}] Failed to log pipeline event: {e}")
            if self._conn:
                self._conn.rollback()
        finally:
            if self._conn and not self._conn.closed:
                self._conn.close()
                self._conn = None
