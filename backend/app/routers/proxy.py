import ipaddress
import socket
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session as DBSession

from ..database import get_db
from ..models import Organization

router = APIRouter(prefix="/api", tags=["Proxy"])

PROXY_TIMEOUT_SECONDS = 10.0
PROXY_MAX_BYTES = 5 * 1024 * 1024  # 5MB


def _is_safe_host(hostname: str) -> bool:
    """
    Resolves hostname and rejects loopback/private/link-local/reserved
    addresses, so the proxy can't be used to reach internal network services
    (SSRF). Redirects are not followed (see proxy_image below) so this check
    on the original URL's host is sufficient.
    """
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            return False
    return True


@router.get("/proxy-image")
def proxy_image(url: str = Query(...), db: DBSession = Depends(get_db)):
    """
    Fetches an external image server-side and streams it back through our own
    domain. Used by CompletionCard so html2canvas can read organization logo
    pixel data during share/export even when the logo's host doesn't send
    permissive CORS headers (browsers block cross-origin canvas reads
    otherwise, but a server-side fetch isn't subject to CORS at all).

    Only URLs currently set as an organization's logo_url are allowed, so
    this can't be used as a general-purpose open proxy for arbitrary URLs.
    """
    org = db.query(Organization).filter(Organization.logo_url == url).first()
    if not org:
        raise HTTPException(status_code=404, detail="Image not found")

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Invalid image URL")

    if not _is_safe_host(parsed.hostname):
        raise HTTPException(status_code=400, detail="Invalid image URL")

    try:
        # Redirects are not followed: a redirect could point at an internal
        # host that would pass the _is_safe_host check only because it was
        # run against the original (safe) URL.
        with httpx.stream(
            "GET", url, timeout=PROXY_TIMEOUT_SECONDS, follow_redirects=False
        ) as resp:
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail="Failed to fetch image")

            content_type = resp.headers.get("content-type", "")
            if not content_type.startswith("image/"):
                raise HTTPException(status_code=400, detail="URL did not return an image")

            content_length = resp.headers.get("content-length")
            if content_length and int(content_length) > PROXY_MAX_BYTES:
                raise HTTPException(status_code=400, detail="Image too large")

            body = bytearray()
            for chunk in resp.iter_bytes():
                body.extend(chunk)
                if len(body) > PROXY_MAX_BYTES:
                    raise HTTPException(status_code=400, detail="Image too large")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Failed to fetch image")

    return Response(
        content=bytes(body),
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=3600"},
    )
