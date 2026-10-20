import hmac

from fastapi import Header, HTTPException

from app.core.config import get_settings


def require_staff(x_staff_key: str | None = Header(default=None)) -> None:
    """Staff and admin endpoints: the caller must send a staff key."""
    settings = get_settings()
    # No key configured means nobody gets in, rather than everybody
    keys = [k for k in (settings.staff_api_key, settings.browser_check_key) if k]
    sent = (x_staff_key or "").encode()
    if not sent or not any(hmac.compare_digest(sent, k.encode()) for k in keys):
        raise HTTPException(status_code=401, detail="Staff key required")
