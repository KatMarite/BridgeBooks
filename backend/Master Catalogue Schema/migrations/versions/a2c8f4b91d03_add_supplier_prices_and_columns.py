"""add supplier_prices table and new book columns

Revision ID: a2c8f4b91d03
Revises: fbe3d2a17e79
Create Date: 2026-06-09 16:59:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2c8f4b91d03'
down_revision: Union[str, Sequence[str], None] = 'fbe3d2a17e79'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # ── Add new columns to books table ──
    op.add_column('books', sa.Column('shopify_product_id', sa.String(255), nullable=True))
    op.add_column('books', sa.Column('stock_type', sa.String(50), nullable=False, server_default='standard'))

    op.create_index('idx_books_shopify_product_id', 'books', ['shopify_product_id'])
    op.create_index('idx_books_stock_type', 'books', ['stock_type'])

    # ── Remove single-supplier pricing columns from books ──
    # These are now tracked per-supplier in the supplier_prices table.
    op.drop_column('books', 'supplier_cost_price')
    op.drop_column('books', 'retail_price')
    op.drop_column('books', 'stock_quantity')

    # ── Create supplier_prices table ──
    op.create_table(
        'supplier_prices',

        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),

        # Foreign key to books
        sa.Column('isbn_13', sa.String(13), sa.ForeignKey('books.isbn_13', ondelete='CASCADE'), nullable=False),

        # Supplier identity — canonical keys: 'booksite', 'jonathanBall', 'protea'
        sa.Column('supplier_name', sa.String(100), nullable=False),

        # Pricing
        sa.Column('cost_price', sa.Numeric(10, 2), nullable=True),
        sa.Column('retail_price', sa.Numeric(10, 2), nullable=True),
        sa.Column('currency', sa.String(10), nullable=False, server_default='ZAR'),

        # Availability
        sa.Column('in_stock', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('stock_quantity', sa.Integer(), nullable=False, server_default='0'),

        # Sync tracking
        sa.Column('last_synced_at', sa.DateTime(), nullable=True),

        # Audit trail
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),

        # Each supplier can only have one price entry per book
        sa.UniqueConstraint('isbn_13', 'supplier_name', name='uq_supplier_prices_isbn_supplier'),
    )

    # Indexes for common query patterns
    op.create_index('idx_supplier_prices_isbn', 'supplier_prices', ['isbn_13'])
    op.create_index('idx_supplier_prices_supplier', 'supplier_prices', ['supplier_name'])
    op.create_index('idx_supplier_prices_in_stock', 'supplier_prices', ['in_stock'])


def downgrade():
    # Drop supplier_prices table
    op.drop_index('idx_supplier_prices_in_stock', table_name='supplier_prices')
    op.drop_index('idx_supplier_prices_supplier', table_name='supplier_prices')
    op.drop_index('idx_supplier_prices_isbn', table_name='supplier_prices')
    op.drop_table('supplier_prices')

    # Re-add the original single-supplier columns to books
    op.add_column('books', sa.Column('stock_quantity', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('books', sa.Column('retail_price', sa.Numeric(10, 2), nullable=False, server_default='0'))
    op.add_column('books', sa.Column('supplier_cost_price', sa.Numeric(10, 2), nullable=False, server_default='0'))

    # Drop new columns
    op.drop_index('idx_books_stock_type', table_name='books')
    op.drop_index('idx_books_shopify_product_id', table_name='books')
    op.drop_column('books', 'stock_type')
    op.drop_column('books', 'shopify_product_id')
