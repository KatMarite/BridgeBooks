"""add last_synced_to_shopify

Revision ID: 938112ca452d
Revises: d8e1f6a34b20
Create Date: 2026-06-10 21:06:27.843230

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '938112ca452d'
down_revision: Union[str, Sequence[str], None] = 'd8e1f6a34b20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('books', sa.Column('last_synced_to_shopify', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('books', 'last_synced_to_shopify')
