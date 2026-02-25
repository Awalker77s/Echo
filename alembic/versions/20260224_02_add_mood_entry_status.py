"""add mood entry status fields

Revision ID: 20260224_02
Revises: 20260224_01
Create Date: 2026-02-24 23:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260224_02"
down_revision: Union[str, Sequence[str], None] = "20260224_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("mood_entries", sa.Column("status", sa.String(length=20), nullable=False, server_default="processing"))
    op.add_column("mood_entries", sa.Column("error_message", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("mood_entries", "error_message")
    op.drop_column("mood_entries", "status")
