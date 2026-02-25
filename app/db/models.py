import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Uuid, Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


json_type = JSON().with_variant(JSONB, "postgresql")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    supabase_uid: Mapped[uuid.UUID | None] = mapped_column(Uuid, unique=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(100))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    tier: Mapped[str] = mapped_column(String(20), default="free", nullable=False)
    timezone: Mapped[str | None] = mapped_column(String(50))
    stripe_customer_id: Mapped[str | None] = mapped_column(String(100), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MoodEntry(Base):
    __tablename__ = "mood_entries"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    media_type: Mapped[str | None] = mapped_column(String(10))
    media_s3_key: Mapped[str | None] = mapped_column(Text)
    primary_mood_tag: Mapped[str | None] = mapped_column(String(50))
    secondary_mood_tag: Mapped[str | None] = mapped_column(String(50))
    mood_score: Mapped[int | None] = mapped_column(Integer)
    energy_score: Mapped[int | None] = mapped_column(Integer)
    stress_score: Mapped[int | None] = mapped_column(Integer)
    mood_summary: Mapped[str | None] = mapped_column(Text)
    emotional_insight: Mapped[str | None] = mapped_column(Text)
    reflection_paragraph: Mapped[str | None] = mapped_column(Text)
    facial_analysis: Mapped[dict | None] = mapped_column(json_type)
    voice_analysis: Mapped[dict | None] = mapped_column(json_type)
    eye_analysis: Mapped[dict | None] = mapped_column(json_type)
    user_feedback: Mapped[str | None] = mapped_column(String(10))
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    share_token: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="processing")
    error_message: Mapped[str | None] = mapped_column(Text)


class UserStreak(Base):
    __tablename__ = "user_streaks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), primary_key=True, nullable=False
    )
    current_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_entry_date: Mapped[date | None] = mapped_column(Date)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"))
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(100))
    plan: Mapped[str | None] = mapped_column(String(30))
    status: Mapped[str | None] = mapped_column(String(20))
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
