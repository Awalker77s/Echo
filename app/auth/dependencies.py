from uuid import UUID

from fastapi import Header, HTTPException

from app.auth.service import verify_supabase_jwt


async def get_current_user(authorization: str = Header(default="")) -> UUID:
    from app.main import supabase_client

    if supabase_client is None:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.replace("Bearer ", "", 1).strip()
    try:
        auth_user = await verify_supabase_jwt(supabase_client, token)
        return UUID(auth_user.user_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Invalid token") from exc
