from dataclasses import dataclass

from app.models.schemas import MoodTag, SignalPayload


@dataclass
class PipelineResult:
    signals: SignalPayload
    primary_mood_tag: MoodTag
    secondary_mood_tag: MoodTag
    mood_summary: str
    emotional_insight: str
    reflection_paragraph: str


class EchoPipeline:
    """MVP simulation of the modular analysis + reflection pipeline."""

    def analyze(self, media_type: str) -> PipelineResult:
        if media_type == "video":
            signals = SignalPayload(
                facial_expression="focused",
                eye_contact_stability="stable",
                voice_tone="warm",
                speech_speed="normal",
                energy_score=72,
                stress_score=38,
                mood_score=76,
            )
            primary = "focused"
            secondary = "optimistic"
        else:
            signals = SignalPayload(
                facial_expression="neutral",
                eye_contact_stability="fatigued",
                blink_rate="elevated",
                energy_score=45,
                stress_score=61,
                mood_score=49,
            )
            primary = "reflective"
            secondary = "low energy"

        return PipelineResult(
            signals=signals,
            primary_mood_tag=primary,
            secondary_mood_tag=secondary,
            mood_summary=self._build_summary(primary, secondary),
            emotional_insight=self._build_insight(signals),
            reflection_paragraph=self._build_reflection(primary, signals),
        )

    def _build_summary(self, primary: MoodTag, secondary: MoodTag) -> str:
        return f"You seem {primary}, with an undercurrent of {secondary}."

    def _build_insight(self, signals: SignalPayload) -> str:
        return (
            f"Your energy is at {signals.energy_score}/100 while stress sits at {signals.stress_score}/100. "
            "This pattern suggests you are carrying emotional load while still trying to stay present."
        )

    def _build_reflection(self, primary: MoodTag, signals: SignalPayload) -> str:
        return (
            f"Right now, you appear {primary}. "
            f"With a mood score around {signals.mood_score}, your signals point to a moment that deserves attention, not judgment. "
            "You may benefit from slowing down and naming one thing that feels heavy and one thing that feels steady. "
            "Even brief self-awareness can help you regain clarity for the rest of your day."
        )
