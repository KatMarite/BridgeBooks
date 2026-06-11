"""add pending_orders table

Revision ID: 230996cea786
Revises: 938112ca452d
Create Date: 2026-06-11 16:14:32.784183

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '230996cea786'
down_revision: Union[str, Sequence[str], None] = '938112ca452d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'pending_orders',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('shopify_order_id', sa.String(255), nullable=False),
        sa.Column('shopify_order_number', sa.String(255), nullable=True),
        sa.Column('isbn_13', sa.String(13), sa.ForeignKey('books.isbn_13', ondelete='SET NULL'), nullable=True),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('supplier_name', sa.String(100), nullable=True),
        sa.Column('customer_name', sa.String(255), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now())
    )
    op.create_index('idx_pending_orders_status', 'pending_orders', ['status'])


def downgrade() -> None:
    op.drop_index('idx_pending_orders_status', table_name='pending_orders')
    op.drop_table('pending_orders')
