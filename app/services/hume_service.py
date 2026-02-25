from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

try:
    from decouple import config
except ModuleNotFoundError:
    def config(key: str, default: str = "") -> str:
        import os

        return os.getenv(key, default)

from app.media.r2 import generate_presigned_get_url


class HumeService:
    def __init__(self, *, r2_client: Any, bucket: str, api_key: str | None = None) -> None:
        self.r2_client = r2_client
        self.bucket = bucket
        self.api_key = api_key or config("HUME_API_KEY", default="")

    async def analyze_media(self, s3_key: str, media_type: str) -> dict[str, Any]:
        media_url = generate_presigned_get_url(
            self.r2_client,
            bucket=self.bucket,
            s3_key=s3_key,
            expires_in=300,
        )
        client = self._create_hume_client()
        models: dict[str, dict[str, Any]] = {"face": {}}
        if media_type == "video":
            models["prosody"] = {}

        job_id = await self._submit_job(client, media_url, models)
        await self._wait_for_completion(client, job_id)
        predictions = await self._get_predictions(client, job_id)
        return self._parse_predictions(predictions, media_type)

    def _create_hume_client(self) -> Any:
        from hume import HumeClient

        return HumeClient(api_key=self.api_key)

    async def _submit_job(self, client: Any, media_url: str, models: dict[str, Any]) -> str:
        response = await client.expression_measurement.batch.start_inference_job(
            urls=[media_url],
            models=models,
        )
        return response["job_id"]

    async def _wait_for_completion(self, client: Any, job_id: str) -> None:
        started = datetime.now(timezone.utc)
        while (datetime.now(timezone.utc) - started).total_seconds() < 30:
            job = await client.expression_measurement.batch.get_job_details(job_id)
            if job.get("state", {}).get("status") == "COMPLETED":
                return
            if job.get("state", {}).get("status") in {"FAILED", "CANCELLED"}:
                raise RuntimeError(f"Hume job {job_id} failed")
            await asyncio.sleep(2)
        raise TimeoutError(f"Timed out waiting for Hume job {job_id}")

    async def _get_predictions(self, client: Any, job_id: str) -> dict[str, Any]:
        return await client.expression_measurement.batch.get_job_predictions(job_id)

    def _parse_predictions(self, payload: dict[str, Any], media_type: str) -> dict[str, Any]:
        predictions = payload.get("predictions", [])
        models = predictions[0].get("results", {}).get("predictions", [{}])[0].get("models", {}) if predictions else {}

        face_emotions = self._extract_emotions(models.get("face", {}))
        prosody_emotions = self._extract_emotions(models.get("prosody", {})) if media_type == "video" else {}

        top_emotions = sorted(face_emotions.items(), key=lambda item: item[1], reverse=True)[:5]
        stress_score = int(round((
            face_emotions.get("anxiety", 0.0) * 0.5
            + face_emotions.get("fear", 0.0) * 0.3
            + face_emotions.get("disgust", 0.0) * 0.2
        ) * 100))
        energy_source = prosody_emotions if prosody_emotions else face_emotions
        energy_score = int(round((
            energy_source.get("excitement", 0.0) * 0.4
            + energy_source.get("concentration", 0.0) * 0.35
            + energy_source.get("joy", 0.0) * 0.25
        ) * 100))

        return {
            "top_emotions": [{"name": name, "score": score} for name, score in top_emotions],
            "facial_scores": face_emotions,
            "voice_scores": prosody_emotions or None,
            "energy_score": max(0, min(100, energy_score)),
            "stress_score": max(0, min(100, stress_score)),
        }

    def _extract_emotions(self, model_payload: dict[str, Any]) -> dict[str, float]:
        grouped_predictions = model_payload.get("grouped_predictions", [])
        if not grouped_predictions:
            return {}
        emotions = grouped_predictions[0].get("predictions", [])
        if not emotions:
            return {}
        entries = emotions[0].get("emotions", [])
        return {item.get("name", "unknown"): float(item.get("score", 0.0)) for item in entries}
