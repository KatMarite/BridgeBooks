"""create books table

Revision ID: fbe3d2a17e79
Revises: 
Create Date: 2026-04-24 16:08:32.128990

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fbe3d2a17e79'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


from alembic import op
import sqlalchemy as sa


def upgrade():
    op.create_table(
        'books',

        # Primary Key
        sa.Column('isbn_13', sa.String(13), primary_key=True),

        # Core Book Metadata
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('author', sa.String(255), nullable=False),
        sa.Column('publisher', sa.String(255), nullable=True),
        sa.Column('publication_date', sa.Date(), nullable=True),

        # Pricing & Inventory
        sa.Column('supplier_cost_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('retail_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('currency', sa.String(10), nullable=False, server_default='ZAR'),
        sa.Column('stock_quantity', sa.Integer(), nullable=False, server_default='0'),

        # Enrichment Fields
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('cover_image_url', sa.String(500), nullable=True),
        sa.Column('page_count', sa.Integer(), nullable=True),

        # Audit Trail
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now())
    )

    # Indexes
    op.create_index('idx_books_title', 'books', ['title'])
    op.create_index('idx_books_author', 'books', ['author'])
    op.create_index('idx_books_publisher', 'books', ['publisher'])


def downgrade():
    op.drop_index('idx_books_title', table_name='books')
    op.drop_index('idx_books_author', table_name='books')
    op.drop_index('idx_books_publisher', table_name='books')

    op.drop_table('books')