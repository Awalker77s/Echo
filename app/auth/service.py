from dataclasses import dataclass
from typing import Any


@dataclass
class AuthUser:
    user_id: str
    email: str | None = None


async def verify_supabase_jwt(supabase_client: Any, token: str) -> AuthUser:
    """Validate JWT through Supabase and return the subject UUID."""
    response = await supabase_client.auth.get_user(token)
    user = getattr(response, "user", None)
    if user is None or getattr(user, "id", None) is None:
        raise ValueError("Invalid Supabase JWT")
    return AuthUser(user_id=str(user.id), email=getattr(user, "email", None))


async def register_with_supabase(supabase_client: Any, email: str, password: str) -> Any:
    return await supabase_client.auth.sign_up({"email": email, "password": password})


async def login_with_supabase(supabase_client: Any, email: str, password: str) -> Any:
    return await supabase_client.auth.sign_in_with_password({"email": email, "password": password})


def extract_auth_user(auth_response: Any) -> AuthUser:
    user = getattr(auth_response, "user", None)
    if user is None or getattr(user, "id", None) is None:
        raise ValueError("Invalid Supabase auth response")
    return AuthUser(user_id=str(user.id), email=getattr(user, "email", None))
