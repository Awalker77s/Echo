from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.service import extract_auth_user, login_with_supabase, register_with_supabase
from app.db.base import get_db
from app.db.crud import (
    create_entry,
    get_entries_by_user,
    get_entry_by_id,
    get_user_by_supabase_uid,
    set_user_stripe_customer_id,
    set_user_tier_by_customer_id,
    upsert_user_by_supabase_uid,
)
from app.media.r2 import build_s3_key, generate_presigned_put_url, validate_upload
from app.models.schemas import (
    CheckInAcceptedResponse,
    CheckInRequest,
    CheckInStatusResponse,
    HealthResponse,
    MoodEntry,
)

router = APIRouter()


class AuthRequest(BaseModel):
    email: str
    password: str


class UploadResponse(BaseModel):
    presigned_url: str
    s3_key: str


class CheckoutRequest(BaseModel):
    plan: str


class CheckoutResponse(BaseModel):
    checkout_url: str


class PortalResponse(BaseModel):
    portal_url: str


def _seconds_until_midnight_utc() -> int:
    now = datetime.now(timezone.utc)
    midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(1, int((midnight - now).total_seconds()))


async def _enforce_free_daily_checkin_limit(session: AsyncSession, user_id: UUID) -> None:
    from app.main import redis_client

    user = await get_user_by_supabase_uid(session, user_id)
    if user and user.tier == "premium":
        return
    if redis_client is None:
        return

    key = f"checkin_limit:{user_id}"
    added = await redis_client.set(key, "1", ex=_seconds_until_midnight_utc(), nx=True)
    if not added:
        raise HTTPException(
            status_code=403,
            detail={"error": "daily_limit_reached", "upgrade_url": "/upgrade"},
        )


async def _require_premium(session: AsyncSession, user_id: UUID) -> None:
    user = await get_user_by_supabase_uid(session, user_id)
    if not user or user.tier == "free":
        raise HTTPException(status_code=403, detail={"error": "premium_required", "upgrade_url": "/upgrade"})


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok")


@router.post("/api/v1/auth/register")
async def register(payload: AuthRequest):
    from app.main import supabase_client

    if supabase_client is None:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    return await register_with_supabase(supabase_client, payload.email, payload.password)


@router.post("/api/v1/auth/login")
async def login(
    payload: AuthRequest,
    session: AsyncSession = Depends(get_db),
):
    from app.main import supabase_client

    if supabase_client is None:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    auth_response = await login_with_supabase(supabase_client, payload.email, payload.password)
    auth_user = extract_auth_user(auth_response)
    await upsert_user_by_supabase_uid(
        session,
        supabase_uid=UUID(auth_user.user_id),
        email=auth_user.email or payload.email,
    )
    return auth_response


@router.post("/api/v1/upload", response_model=UploadResponse)
async def create_upload_url(
    file: UploadFile = File(...),
    file_size: int = Form(...),
    user_id: UUID = Depends(get_current_user),
) -> UploadResponse:
    from app.main import r2_client

    if r2_client is None:
        raise HTTPException(status_code=503, detail="R2 not configured")

    try:
        validate_upload(file.filename or "", file.content_type or "", file_size)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    from decouple import config

    s3_key = build_s3_key(str(user_id), file.content_type or "")

    presigned_url = generate_presigned_put_url(
        r2_client,
        bucket=config("R2_BUCKET_NAME", default=""),
        s3_key=s3_key,
        content_type=file.content_type or "",
        expires_in=300,
    )
    return UploadResponse(presigned_url=presigned_url, s3_key=s3_key)


async def run_pipeline_task(entry_id: UUID, media_url: str, media_type: str, user_id: UUID) -> None:
    from app.main import pipeline_service

    if pipeline_service is None:
        return

    now = datetime.utcnow()
    context = {
        "date": now.strftime("%Y-%m-%d"),
        "day_of_week": now.strftime("%A"),
        "local_time": now.strftime("%H:%M"),
        "time_period": "morning",
        "media_type": media_type,
        "user_id": str(user_id),
    }
    await pipeline_service.process_entry(entry_id=entry_id, s3_key=media_url, media_type=media_type, user_context=context)


@router.post(
    "/api/v1/checkins",
    response_model=CheckInAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_checkin(
    payload: CheckInRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> CheckInAcceptedResponse:
    await _enforce_free_daily_checkin_limit(session, user_id)
    entry = await create_entry(
        session,
        {
            "user_id": user_id,
            "media_type": payload.media_type,
            "media_s3_key": payload.media_url,
            "status": "processing",
        },
    )
    background_tasks.add_task(run_pipeline_task, entry.id, payload.media_url, payload.media_type, user_id)
    return CheckInAcceptedResponse(entry_id=entry.id, status="processing")


@router.get("/api/v1/checkins/{entry_id}/status", response_model=CheckInStatusResponse)
async def get_checkin_status(
    entry_id: UUID,
    session: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> CheckInStatusResponse:
    entry = await get_entry_by_id(session, entry_id)
    if not entry or entry.user_id != user_id:
        raise HTTPException(status_code=404, detail="Entry not found")
    result = MoodEntry.model_validate(entry, from_attributes=True) if entry.status == "complete" else None
    return CheckInStatusResponse(entry_id=entry.id, status=entry.status, result=result)


@router.get("/api/v1/entries", response_model=list[MoodEntry])
async def list_entries(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> list[MoodEntry]:
    entries = await get_entries_by_user(session=session, user_id=user_id, limit=limit, offset=offset)
    return [MoodEntry.model_validate(entry, from_attributes=True) for entry in entries]


@router.get("/api/v1/entries/{entry_id}", response_model=MoodEntry)
async def get_entry(
    entry_id: UUID,
    session: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> MoodEntry:
    entry = await get_entry_by_id(session=session, entry_id=entry_id)
    if not entry or entry.user_id != user_id:
        raise HTTPException(status_code=404, detail="Entry not found")
    return MoodEntry.model_validate(entry, from_attributes=True)


@router.post("/api/v1/billing/create-checkout", response_model=CheckoutResponse)
async def create_checkout(
    payload: CheckoutRequest,
    session: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> CheckoutResponse:
    if payload.plan not in {"echo_premium_monthly", "echo_premium_annual"}:
        raise HTTPException(status_code=400, detail="Unsupported plan")
    from app.main import stripe_service

    user = await get_user_by_supabase_uid(session, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    customer_id = await stripe_service.get_or_create_customer(user)
    if user.stripe_customer_id != customer_id:
        await set_user_stripe_customer_id(session, user, customer_id)
    checkout_url = await stripe_service.create_checkout_session(str(user_id), payload.plan, customer_id)
    return CheckoutResponse(checkout_url=checkout_url)


@router.get("/api/v1/billing/portal", response_model=PortalResponse)
async def billing_portal(
    session: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> PortalResponse:
    from app.main import stripe_service

    user = await get_user_by_supabase_uid(session, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    customer_id = await stripe_service.get_or_create_customer(user)
    if user.stripe_customer_id != customer_id:
        await set_user_stripe_customer_id(session, user, customer_id)
    portal_url = await stripe_service.create_portal_session(customer_id)
    return PortalResponse(portal_url=portal_url)


@router.post("/api/v1/billing/webhook")
async def stripe_webhook(request: Request, session: AsyncSession = Depends(get_db)) -> dict[str, str]:
    from decouple import config

    from app.main import redis_client, stripe_service

    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    webhook_secret = config("STRIPE_WEBHOOK_SECRET", default="")

    try:
        event = stripe_service.construct_event(payload=payload, signature=signature, webhook_secret=webhook_secret)
    except Exception:
        return {"status": "ok"}

    event_id = event.get("id")
    if redis_client and event_id:
        seen = await redis_client.set(f"stripe_event:{event_id}", "1", ex=86400, nx=True)
        if not seen:
            return {"status": "ok"}

    event_type = event.get("type", "")
    obj = event.get("data", {}).get("object", {})
    customer_id = obj.get("customer")

    if event_type in {"customer.subscription.created", "invoice.payment_succeeded"} and customer_id:
        await set_user_tier_by_customer_id(session, customer_id, "premium")
    elif event_type == "customer.subscription.updated" and customer_id:
        subscription_status = obj.get("status", "")
        tier = "premium" if subscription_status in {"active", "trialing", "past_due"} else "free"
        await set_user_tier_by_customer_id(session, customer_id, tier)
    elif event_type == "customer.subscription.deleted" and customer_id:
        await set_user_tier_by_customer_id(session, customer_id, "free")
    elif event_type == "invoice.payment_failed":
        print("warning: invoice payment failed")

    return {"status": "ok"}


@router.get("/api/v1/analytics/summary")
async def analytics_summary(
    session: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> dict:
    await _require_premium(session, user_id)
    return {"status": "ok", "message": "premium analytics placeholder"}
