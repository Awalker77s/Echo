from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
}
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024


def validate_upload(file_name: str, content_type: str, size_bytes: int) -> None:
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError("Unsupported file type")
    if size_bytes > MAX_FILE_SIZE_BYTES:
        raise ValueError("File exceeds 50MB limit")
    if not file_name:
        raise ValueError("Missing file name")


def build_s3_key(user_id: str, content_type: str) -> str:
    ext = ALLOWED_CONTENT_TYPES[content_type]
    return f"uploads/{user_id}/{uuid4()}.{ext}"


def generate_presigned_put_url(
    s3_client: Any,
    *,
    bucket: str,
    s3_key: str,
    content_type: str,
    expires_in: int = 300,
) -> str:
    return s3_client.generate_presigned_url(
        ClientMethod="put_object",
        Params={"Bucket": bucket, "Key": s3_key, "ContentType": content_type},
        ExpiresIn=expires_in,
    )


def cleanup_objects_older_than_one_hour(s3_client: Any, bucket: str, prefix: str = "uploads/") -> int:
    response = s3_client.list_objects_v2(Bucket=bucket, Prefix=prefix)
    contents = response.get("Contents", [])
    cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
    deleted = 0

    for obj in contents:
        last_modified = obj.get("LastModified")
        key = obj.get("Key")
        if key and last_modified and last_modified < cutoff:
            s3_client.delete_object(Bucket=bucket, Key=key)
            deleted += 1
    return deleted


def generate_presigned_get_url(
    s3_client: Any,
    *,
    bucket: str,
    s3_key: str,
    expires_in: int = 300,
) -> str:
    return s3_client.generate_presigned_url(
        ClientMethod="get_object",
        Params={"Bucket": bucket, "Key": s3_key},
        ExpiresIn=expires_in,
    )
