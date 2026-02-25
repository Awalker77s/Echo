"""initial schema

Revision ID: 20260224_01
Revises: 
Create Date: 2026-02-24 22:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260224_01"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("supabase_uid", postgresql.UUID(as_uuid=True), nullable=True, unique=True),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("display_name", sa.String(length=100), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("tier", sa.String(length=20), nullable=False, server_default="free"),
        sa.Column("timezone", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "mood_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("media_type", sa.String(length=10), nullable=True),
        sa.Column("media_s3_key", sa.Text(), nullable=True),
        sa.Column("primary_mood_tag", sa.String(length=50), nullable=True),
        sa.Column("secondary_mood_tag", sa.String(length=50), nullable=True),
        sa.Column("mood_score", sa.Integer(), nullable=True),
        sa.Column("energy_score", sa.Integer(), nullable=True),
        sa.Column("stress_score", sa.Integer(), nullable=True),
        sa.Column("mood_summary", sa.Text(), nullable=True),
        sa.Column("emotional_insight", sa.Text(), nullable=True),
        sa.Column("reflection_paragraph", sa.Text(), nullable=True),
        sa.Column("facial_analysis", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("voice_analysis", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("eye_analysis", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("user_feedback", sa.String(length=10), nullable=True),
        sa.Column("is_shared", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("share_token", sa.String(length=64), nullable=True),
    )

    op.create_table(
        "user_streaks",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True, nullable=False),
        sa.Column("current_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("longest_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_entry_date", sa.Date(), nullable=True),
    )

    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("stripe_subscription_id", sa.String(length=100), nullable=True),
        sa.Column("plan", sa.String(length=30), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("subscriptions")
    op.drop_table("user_streaks")
    op.drop_table("mood_entries")
    op.drop_table("users")
