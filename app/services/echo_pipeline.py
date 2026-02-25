from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.crud import get_entry_by_id, update_entry_pipeline_failure, update_entry_pipeline_success
from app.services.hume_service import HumeService
from app.services.reflection_service import ReflectionService


class EchoPipelineService:
    def __init__(
        self,
        *,
        session_factory: async_sessionmaker[AsyncSession],
        hume_service: HumeService,
        reflection_service: ReflectionService,
    ) -> None:
        self.session_factory = session_factory
        self.hume_service = hume_service
        self.reflection_service = reflection_service

    async def process_entry(self, entry_id: UUID, s3_key: str, media_type: str, user_context: dict[str, Any]) -> None:
        async with self.session_factory() as session:
            try:
                signals = await self.hume_service.analyze_media(s3_key=s3_key, media_type=media_type)
                reflection = await self.reflection_service.generate_reflection(
                    signals={
                        **signals,
                        "mood_score": max(0, min(100, 100 - signals.get("stress_score", 50) + signals.get("energy_score", 50) // 2)),
                        "voice_tone": "N/A" if media_type == "image" else "elevated",
                        "speech_speed": "N/A" if media_type == "image" else "normal",
                    },
                    context=user_context,
                )
                await update_entry_pipeline_success(
                    session,
                    entry_id=entry_id,
                    fields={
                        "status": "complete",
                        "primary_mood_tag": reflection.primary_mood_tag,
                        "secondary_mood_tag": reflection.secondary_mood_tag,
                        "mood_summary": reflection.mood_summary,
                        "emotional_insight": reflection.emotional_insight,
                        "reflection_paragraph": reflection.reflection_paragraph,
                        "energy_score": signals["energy_score"],
                        "stress_score": signals["stress_score"],
                        "mood_score": max(0, min(100, 100 - signals["stress_score"] + signals["energy_score"] // 2)),
                        "facial_analysis": {
                            "top_emotions": signals["top_emotions"],
                            "facial_scores": signals["facial_scores"],
                        },
                        "voice_analysis": signals.get("voice_scores"),
                        "eye_analysis": {"generated_at": datetime.utcnow().isoformat()},
                    },
                )
            except Exception as exc:  # noqa: BLE001
                await update_entry_pipeline_failure(session, entry_id=entry_id, error_message=str(exc))


async def get_entry_status_payload(session: AsyncSession, entry_id: UUID) -> dict[str, Any] | None:
    entry = await get_entry_by_id(session, entry_id)
    if not entry:
        return None
    return {
        "entry_id": str(entry.id),
        "status": entry.status,
        "result": entry if entry.status == "complete" else None,
    }
