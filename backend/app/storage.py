"""
Uploads files to Supabase Storage via its REST API directly (no supabase-py
dependency needed for this). Used by the admin character image-upload
endpoint and QR code generation (routers/characters.py, qr_codes.py).
"""

import os
import httpx

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

CHARACTER_IMAGES_BUCKET = "character-images"
QR_CODES_BUCKET = "qr-codes"

# Content-types accepted for character image uploads, mapped to the file
# extension used when generating the storage object's unique filename.
ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5MB


def public_url(bucket_name: str, object_name: str) -> str:
    """Builds the public URL for an object in a public-read Supabase Storage bucket."""
    return f"{SUPABASE_URL}/storage/v1/object/public/{bucket_name}/{object_name}"


def upload_to_bucket(bucket_name: str, object_name: str, content_type: str, file_bytes: bytes) -> str:
    """
    Uploads file_bytes to the given Supabase Storage bucket under object_name,
    using the service role key for write access (the bucket itself must be
    public for reads). Returns the public URL. Uses upsert so re-uploading
    under the same object_name (e.g. re-rendering a QR code) overwrites
    cleanly instead of erroring. Raises RuntimeError if config is missing or
    the upload fails.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "Upload is not configured: SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY must be set in the environment."
        )

    upload_url = f"{SUPABASE_URL}/storage/v1/object/{bucket_name}/{object_name}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": content_type,
        "x-upsert": "true",
    }

    try:
        response = httpx.post(upload_url, headers=headers, content=file_bytes, timeout=30.0)
    except httpx.HTTPError as e:
        raise RuntimeError(f"Failed to reach Supabase Storage: {e}")

    if response.status_code not in (200, 201):
        raise RuntimeError(
            f"Supabase Storage upload failed ({response.status_code}): {response.text}"
        )

    return public_url(bucket_name, object_name)


def upload_character_image(object_name: str, content_type: str, file_bytes: bytes) -> str:
    """Uploads file_bytes to the "character-images" bucket. Returns the public URL."""
    return upload_to_bucket(CHARACTER_IMAGES_BUCKET, object_name, content_type, file_bytes)
