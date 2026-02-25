from __future__ import annotations

from dataclasses import dataclass
from typing import Any

try:
    from decouple import config
except ModuleNotFoundError:
    def config(key: str, default: str = "") -> str:
        import os

        return os.getenv(key, default)

APPROVED_TAGS = {
    "calm", "stressed", "driven", "low energy", "optimistic", "anxious", "focused", "disconnected",
    "energized", "melancholic", "content", "overwhelmed", "excited", "uncertain", "grateful", "tense",
    "reflective", "motivated", "drained", "hopeful",
}

SYSTEM_PROMPT = (
    "You are Echo, an empathetic AI emotional intelligence companion. Your role is to translate "
    "a user's detected emotional signals into a warm, honest, and grounding reflection. You do not "
    "diagnose. You do not give medical advice. You speak in second person ('you'). Your tone is calm, "
    "observant, and supportive — like a wise friend who truly sees you. Keep all outputs concise. "
    "Never be performatively positive or toxic. Be honest about what you detect."
)


@dataclass
class ReflectionOutput:
    mood_summary: str
    emotional_insight: str
    reflection_paragraph: str
    primary_mood_tag: str
    secondary_mood_tag: str


class ReflectionService:
    def __init__(self, client: Any | None = None) -> None:
        if client is not None:
            self.client = client
        else:
            from openai import AsyncOpenAI

            self.client = AsyncOpenAI(api_key=config("OPENAI_API_KEY", default=""))

    async def generate_reflection(self, signals: dict[str, Any], context: dict[str, Any]) -> ReflectionOutput:
        user_prompt = self._build_dynamic_prompt(signals, context)
        response = await self.client.responses.create(
            model="gpt-4o-2024-08-06",
            input=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_prompt}],
            text={
                "format": {
                    "type": "json_schema",
                    "name": "echo_reflection",
                    "schema": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "mood_summary": {"type": "string"},
                            "emotional_insight": {"type": "string"},
                            "reflection_paragraph": {"type": "string"},
                            "primary_mood_tag": {"type": "string"},
                            "secondary_mood_tag": {"type": "string"},
                        },
                        "required": ["mood_summary", "emotional_insight", "reflection_paragraph", "primary_mood_tag", "secondary_mood_tag"],
                    },
                    "strict": True,
                }
            },
        )
        import json

        parsed = json.loads(response.output_text)
        data = ReflectionOutput(**parsed)
        if data.primary_mood_tag not in APPROVED_TAGS:
            data.primary_mood_tag = "uncertain"
        if data.secondary_mood_tag not in APPROVED_TAGS:
            data.secondary_mood_tag = "uncertain"
        return data

    def _build_dynamic_prompt(self, signals: dict[str, Any], context: dict[str, Any]) -> str:
        return (
            f"Today's date: {context.get('date')}, {context.get('day_of_week')}\n"
            f"User's local time: {context.get('local_time')} ({context.get('time_period')})\n"
            f"Entry type: {context.get('media_type')}\n"
            f"- Energy level: {signals.get('energy_score', 50)}\n"
            f"- Stress score: {signals.get('stress_score', 50)}\n"
            f"- Composite mood score: {signals.get('mood_score', 50)}"
        )
