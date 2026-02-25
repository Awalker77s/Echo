from contextlib import asynccontextmanager

import boto3
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from decouple import config
from fastapi import FastAPI
from supabase import create_async_client

from app.api.routes import router
from app.db.base import AsyncSessionLocal
from app.media.r2 import cleanup_objects_older_than_one_hour
from app.services.echo_pipeline import EchoPipelineService
from app.services.hume_service import HumeService
from app.services.reflection_service import ReflectionService
from app.services.stripe_service import StripeService

supabase_client = None
r2_client = None
redis_client = None
pipeline_service: EchoPipelineService | None = None
stripe_service: StripeService | None = None
scheduler: AsyncIOScheduler | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global supabase_client, r2_client, redis_client, scheduler, pipeline_service, stripe_service

    supabase_url = config("SUPABASE_URL", default="")
    supabase_key = config("SUPABASE_ANON_KEY", default="")
    if supabase_url and supabase_key:
        supabase_client = await create_async_client(supabase_url, supabase_key)

    r2_client = boto3.client(
        "s3",
        endpoint_url=config("R2_ENDPOINT", default=""),
        aws_access_key_id=config("R2_ACCESS_KEY", default=""),
        aws_secret_access_key=config("R2_SECRET_KEY", default=""),
        region_name="auto",
    )

    try:
        from redis.asyncio import from_url

        redis_client = from_url(config("REDIS_URL", default="redis://localhost:6379"), decode_responses=True)
    except Exception:
        redis_client = None

    pipeline_service = EchoPipelineService(
        session_factory=AsyncSessionLocal,
        hume_service=HumeService(r2_client=r2_client, bucket=config("R2_BUCKET_NAME", default="")),
        reflection_service=ReflectionService(),
    )
    stripe_service = StripeService()

    try:
        from slowapi import Limiter
        from slowapi.errors import RateLimitExceeded
        from slowapi.middleware import SlowAPIMiddleware
        from slowapi.util import get_remote_address
        from slowapi import _rate_limit_exceeded_handler

        limiter = Limiter(key_func=get_remote_address, storage_uri=config("REDIS_URL", default="redis://localhost:6379"))
        app.state.limiter = limiter
        app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
        if not any(m.cls == SlowAPIMiddleware for m in app.user_middleware):
            app.add_middleware(SlowAPIMiddleware)
    except Exception:
        pass

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        cleanup_objects_older_than_one_hour,
        "interval",
        minutes=15,
        kwargs={"s3_client": r2_client, "bucket": config("R2_BUCKET_NAME", default="")},
    )
    scheduler.start()

    try:
        yield
    finally:
        if scheduler:
            scheduler.shutdown(wait=False)
        if redis_client:
            await redis_client.close()


app = FastAPI(
    title="Echo API",
    version="0.1.0",
    description="MVP backend for passive mood journaling",
    lifespan=lifespan,
)

app.include_router(router)
