"""
Uploads character images to Supabase Storage via its REST API directly
(no supabase-py dependency needed for this one call). Used by the admin
character image-upload endpoint (routers/characters.py).
"""

import os
import httpx

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

CHARACTER_IMAGES_BUCKET = "character-images"

# Content-types accepted for character image uploads, mapped to the file
# extension used when generating the storage object's unique filename.
ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5MB


def upload_character_image(object_name: str, content_type: str, file_bytes: bytes) -> str:
    """
    Uploads file_bytes to the "character-images" Supabase Storage bucket
    under object_name, using the service role key for write access (the
    bucket itself is public for reads). Returns the public URL.
    Raises RuntimeError if config is missing or the upload fails.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "Image upload is not configured: SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY must be set in the environment."
        )

    upload_url = (
        f"{SUPABASE_URL}/storage/v1/object/{CHARACTER_IMAGES_BUCKET}/{object_name}"
    )
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": content_type,
    }

    try:
        response = httpx.post(upload_url, headers=headers, content=file_bytes, timeout=30.0)
    except httpx.HTTPError as e:
        raise RuntimeError(f"Failed to reach Supabase Storage: {e}")

    if response.status_code not in (200, 201):
        raise RuntimeError(
            f"Supabase Storage upload failed ({response.status_code}): {response.text}"
        )

    return f"{SUPABASE_URL}/storage/v1/object/public/{CHARACTER_IMAGES_BUCKET}/{object_name}"
