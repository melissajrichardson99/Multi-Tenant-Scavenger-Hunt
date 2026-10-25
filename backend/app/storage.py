"""
File storage for character images and QR code PNGs.

Two backends, chosen by configuration (see config.py):
  - Supabase Storage via its REST API (no supabase-py dependency), used when
    SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both set. Buckets must
    exist and be public-read.
  - Local disk under UPLOADS_DIR/<bucket>/, served by the backend at
    /uploads/<bucket>/<object>. Development and tests only.

Used by the admin character endpoints, QR code generation and the QR PDF
(routers/characters.py, qr_codes.py, pdf_generation.py).
"""

import httpx

from .config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, USE_SUPABASE_STORAGE, UPLOADS_DIR

CHARACTER_IMAGES_BUCKET = "character-images"
QR_CODES_BUCKET = "qr-codes"
BUCKETS = (CHARACTER_IMAGES_BUCKET, QR_CODES_BUCKET)

LOCAL_URL_PREFIX = "/uploads"

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
    """Builds the public URL for an object (absolute for Supabase, root-relative for local disk)."""
    if USE_SUPABASE_STORAGE:
        return f"{SUPABASE_URL}/storage/v1/object/public/{bucket_name}/{object_name}"
    return f"{LOCAL_URL_PREFIX}/{bucket_name}/{object_name}"


def _local_path(bucket_name: str, object_name: str):
    if bucket_name not in BUCKETS or "/" in object_name or "\\" in object_name or object_name.startswith("."):
        raise RuntimeError("Invalid storage object name")
    return UPLOADS_DIR / bucket_name / object_name


def upload_to_bucket(bucket_name: str, object_name: str, content_type: str, file_bytes: bytes) -> str:
    """
    Stores file_bytes under object_name in the given bucket and returns its
    public URL. Overwrites an existing object with the same name (Supabase:
    x-upsert), so re-rendering a QR code replaces it cleanly. Raises
    RuntimeError if the upload fails.
    """
    if not USE_SUPABASE_STORAGE:
        path = _local_path(bucket_name, object_name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(file_bytes)
        return public_url(bucket_name, object_name)

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
        raise RuntimeError(f"Supabase Storage upload failed ({response.status_code})")

    return public_url(bucket_name, object_name)


def read_object(bucket_name: str, object_name: str) -> bytes:
    """Returns an object's bytes (used to embed QR images in the print PDF)."""
    if not USE_SUPABASE_STORAGE:
        return _local_path(bucket_name, object_name).read_bytes()

    response = httpx.get(public_url(bucket_name, object_name), timeout=30.0)
    response.raise_for_status()
    return response.content


def delete_local_object(bucket_name: str, object_name: str) -> None:
    """Removes a local-disk object if present. Supabase objects are left in place."""
    if USE_SUPABASE_STORAGE:
        return
    path = _local_path(bucket_name, object_name)
    if path.exists():
        path.unlink()


def upload_character_image(object_name: str, content_type: str, file_bytes: bytes) -> str:
    """Uploads file_bytes to the "character-images" bucket. Returns the public URL."""
    return upload_to_bucket(CHARACTER_IMAGES_BUCKET, object_name, content_type, file_bytes)
