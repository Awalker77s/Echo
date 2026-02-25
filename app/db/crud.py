from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MoodEntry, User, UserStreak


async def create_user(
    session: AsyncSession,
    *,
    email: str,
    user_id: UUID | None = None,
    supabase_uid: UUID | None = None,
    display_name: str | None = None,
    avatar_url: str | None = None,
    tier: str = "free",
    timezone: str | None = None,
    stripe_customer_id: str | None = None,
) -> User:
    user = User(
        id=user_id,
        supabase_uid=supabase_uid,
        email=email,
        display_name=display_name,
        avatar_url=avatar_url,
        tier=tier,
        timezone=timezone,
        stripe_customer_id=stripe_customer_id,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def upsert_user_by_supabase_uid(
    session: AsyncSession,
    *,
    supabase_uid: UUID,
    email: str,
) -> User:
    result = await session.execute(select(User).where(User.supabase_uid == supabase_uid))
    user = result.scalar_one_or_none()
    if user is None:
        return await create_user(session, supabase_uid=supabase_uid, email=email)

    if user.email != email:
        user.email = email
        await session.commit()
        await session.refresh(user)
    return user


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(session: AsyncSession, user_id: UUID) -> User | None:
    return await session.get(User, user_id)


async def get_user_by_supabase_uid(session: AsyncSession, supabase_uid: UUID) -> User | None:
    result = await session.execute(select(User).where(User.supabase_uid == supabase_uid))
    return result.scalar_one_or_none()


async def get_user_by_stripe_customer_id(session: AsyncSession, stripe_customer_id: str) -> User | None:
    result = await session.execute(select(User).where(User.stripe_customer_id == stripe_customer_id))
    return result.scalar_one_or_none()


async def set_user_stripe_customer_id(session: AsyncSession, user: User, stripe_customer_id: str) -> User:
    user.stripe_customer_id = stripe_customer_id
    await session.commit()
    await session.refresh(user)
    return user


async def set_user_tier(session: AsyncSession, user: User, tier: str) -> User:
    user.tier = tier
    await session.commit()
    await session.refresh(user)
    return user


async def set_user_tier_by_customer_id(session: AsyncSession, stripe_customer_id: str, tier: str) -> User | None:
    user = await get_user_by_stripe_customer_id(session, stripe_customer_id)
    if user is None:
        return None
    return await set_user_tier(session, user, tier)


async def create_entry(session: AsyncSession, entry_data: dict) -> MoodEntry:
    entry = MoodEntry(**entry_data)
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return entry


async def get_entries_by_user(
    session: AsyncSession,
    user_id: UUID,
    limit: int = 20,
    offset: int = 0,
) -> list[MoodEntry]:
    stmt = (
        select(MoodEntry)
        .where(MoodEntry.user_id == user_id)
        .order_by(MoodEntry.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_entry_by_id(session: AsyncSession, entry_id: UUID) -> MoodEntry | None:
    result = await session.execute(select(MoodEntry).where(MoodEntry.id == entry_id))
    return result.scalar_one_or_none()


async def update_entry_pipeline_success(session: AsyncSession, *, entry_id: UUID, fields: dict) -> MoodEntry | None:
    entry = await get_entry_by_id(session, entry_id)
    if entry is None:
        return None
    for key, value in fields.items():
        setattr(entry, key, value)
    entry.error_message = None
    await session.commit()
    await session.refresh(entry)
    return entry


async def update_entry_pipeline_failure(session: AsyncSession, *, entry_id: UUID, error_message: str) -> MoodEntry | None:
    entry = await get_entry_by_id(session, entry_id)
    if entry is None:
        return None
    entry.status = "failed"
    entry.error_message = error_message[:1000]
    await session.commit()
    await session.refresh(entry)
    return entry


async def upsert_streak(
    session: AsyncSession,
    user_id: UUID,
    *,
    current_streak: int,
    longest_streak: int,
    last_entry_date: date | None,
) -> UserStreak:
    streak = await session.get(UserStreak, user_id)
    if streak is None:
        streak = UserStreak(
            user_id=user_id,
            current_streak=current_streak,
            longest_streak=longest_streak,
            last_entry_date=last_entry_date,
        )
        session.add(streak)
    else:
        streak.current_streak = current_streak
        streak.longest_streak = longest_streak
        streak.last_entry_date = last_entry_date

    await session.commit()
    await session.refresh(streak)
    return streak


async def get_streak_by_user(session: AsyncSession, user_id: UUID) -> UserStreak | None:
    return await session.get(UserStreak, user_id)
