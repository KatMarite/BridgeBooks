"""add price_overrides and indie_submissions tables

Revision ID: c7d9e5f23a10
Revises: a2c8f4b91d03
Create Date: 2026-06-10 14:51:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7d9e5f23a10'
down_revision: Union[str, Sequence[str], None] = 'a2c8f4b91d03'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # ── price_overrides table ──
    op.create_table(
        'price_overrides',

        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column('isbn_13', sa.String(13), sa.ForeignKey('books.isbn_13', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(500), nullable=True),
        sa.Column('author', sa.String(500), nullable=True),
        sa.Column('original_price', sa.Numeric(10, 2), nullable=True),
        sa.Column('override_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('reason', sa.String(50), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(255), nullable=False, server_default='staff@bridgebooks.co.za'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),

        # Only one active override per book at a time
        sa.UniqueConstraint('isbn_13', name='uq_price_overrides_isbn'),
    )

    op.create_index('idx_price_overrides_isbn', 'price_overrides', ['isbn_13'])

    # ── indie_submissions table ──
    op.create_table(
        'indie_submissions',

        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('author_name', sa.String(500), nullable=False),
        sa.Column('author_email', sa.String(500), nullable=False),
        sa.Column('synopsis', sa.Text(), nullable=True),
        sa.Column('page_count', sa.Integer(), nullable=True),
        sa.Column('suggested_price', sa.Numeric(10, 2), nullable=True),
        sa.Column('cover_image_url', sa.String(1000), nullable=True),
        sa.Column('submission_date', sa.DateTime(), server_default=sa.func.now()),

        # Review workflow
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('reviewed_by', sa.String(255), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
    )

    op.create_index('idx_indie_submissions_status', 'indie_submissions', ['status'])
    op.create_index('idx_indie_submissions_date', 'indie_submissions', ['submission_date'])


def downgrade():
    op.drop_index('idx_indie_submissions_date', table_name='indie_submissions')
    op.drop_index('idx_indie_submissions_status', table_name='indie_submissions')
    op.drop_table('indie_submissions')

    op.drop_index('idx_price_overrides_isbn', table_name='price_overrides')
    op.drop_table('price_overrides')
