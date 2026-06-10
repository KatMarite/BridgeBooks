"""add ingestion_events and ingestion_errors tables

Revision ID: d8e1f6a34b20
Revises: c7d9e5f23a10
Create Date: 2026-06-10 15:06:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8e1f6a34b20'
down_revision: Union[str, Sequence[str], None] = 'c7d9e5f23a10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # ── ingestion_events: logs each pipeline run ──
    op.create_table(
        'ingestion_events',

        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),

        # Which supplier pipeline ran
        sa.Column('supplier_name', sa.String(100), nullable=False),

        # Outcome: 'success', 'warning', 'error'
        sa.Column('status', sa.String(20), nullable=False, server_default='success'),

        # What file was processed
        sa.Column('file_name', sa.String(500), nullable=True),

        # Counters
        sa.Column('records_processed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('records_inserted', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('records_updated', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('errors_count', sa.Integer(), nullable=False, server_default='0'),

        # Human-readable summary
        sa.Column('message', sa.Text(), nullable=True),

        # Timing
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_index('idx_ingestion_events_supplier', 'ingestion_events', ['supplier_name'])
    op.create_index('idx_ingestion_events_status', 'ingestion_events', ['status'])
    op.create_index('idx_ingestion_events_completed', 'ingestion_events', ['completed_at'])

    # ── ingestion_errors: individual error entries from pipeline runs ──
    op.create_table(
        'ingestion_errors',

        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),

        # Link to the pipeline run that produced this error
        sa.Column('event_id', sa.Integer(), sa.ForeignKey('ingestion_events.id', ondelete='CASCADE'), nullable=True),

        sa.Column('supplier_name', sa.String(100), nullable=False),
        sa.Column('file_name', sa.String(500), nullable=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('resolved', sa.Boolean(), nullable=False, server_default='false'),

        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_index('idx_ingestion_errors_supplier', 'ingestion_errors', ['supplier_name'])
    op.create_index('idx_ingestion_errors_resolved', 'ingestion_errors', ['resolved'])
    op.create_index('idx_ingestion_errors_created', 'ingestion_errors', ['created_at'])


def downgrade():
    op.drop_index('idx_ingestion_errors_created', table_name='ingestion_errors')
    op.drop_index('idx_ingestion_errors_resolved', table_name='ingestion_errors')
    op.drop_index('idx_ingestion_errors_supplier', table_name='ingestion_errors')
    op.drop_table('ingestion_errors')

    op.drop_index('idx_ingestion_events_completed', table_name='ingestion_events')
    op.drop_index('idx_ingestion_events_status', table_name='ingestion_events')
    op.drop_index('idx_ingestion_events_supplier', table_name='ingestion_events')
    op.drop_table('ingestion_events')
