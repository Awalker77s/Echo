from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

MoodTag = Literal[
    "calm",
    "stressed",
    "driven",
    "low energy",
    "optimistic",
    "anxious",
    "focused",
    "disconnected",
    "energized",
    "melancholic",
    "content",
    "overwhelmed",
    "excited",
    "uncertain",
    "grateful",
    "tense",
    "reflective",
    "motivated",
    "drained",
    "hopeful",
]


class CheckInRequest(BaseModel):
    media_type: Literal["image", "video"]
    media_url: str


class MoodEntry(BaseModel):
    id: UUID
    user_id: UUID
    created_at: datetime
    media_type: Literal["image", "video"] | None
    media_s3_key: str | None
    primary_mood_tag: MoodTag | None
    secondary_mood_tag: MoodTag | None
    mood_score: int | None
    energy_score: int | None
    stress_score: int | None
    mood_summary: str | None
    emotional_insight: str | None
    reflection_paragraph: str | None
    facial_analysis: dict[str, Any] | None
    voice_analysis: dict[str, Any] | None
    eye_analysis: dict[str, Any] | None
    user_feedback: str | None = None
    is_shared: bool = False
    share_token: str | None = None
    status: str
    error_message: str | None = None


class CheckInAcceptedResponse(BaseModel):
    entry_id: UUID
    status: Literal["processing"]


class CheckInStatusResponse(BaseModel):
    entry_id: UUID
    status: Literal["processing", "complete", "failed"]
    result: MoodEntry | None


class HealthResponse(BaseModel):
    status: str
