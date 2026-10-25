import hmac

from fastapi import Header, HTTPException

from app.core.config import get_settings


def _matches(sent: str | None, keys: list[str]) -> bool:
    raw = (sent or "").encode()
    return bool(raw) and any(hmac.compare_digest(raw, k.encode()) for k in keys if k)


def _admin_keys() -> list[str]:
    s = get_settings()
    # Until ADMIN_API_KEY is set, the staff key opens the admin screens too (as before)
    return [s.admin_api_key or s.staff_api_key, s.browser_check_key]


def require_staff(x_staff_key: str | None = Header(default=None)) -> None:
    """Front of house: the staff key, or the admin key (admins can do everything staff can)."""
    s = get_settings()
    # No key configured means nobody gets in, rather than everybody
    if not _matches(x_staff_key, [s.staff_api_key, *_admin_keys()]):
        raise HTTPException(status_code=401, detail="Staff key required")


def require_admin(x_staff_key: str | None = Header(default=None)) -> None:
    """Admin screens (menu, floor plan): the admin key. A staff key gets 403, not 401, so the
    device keeps it for front of house."""
    if _matches(x_staff_key, _admin_keys()):
        return
    require_staff(x_staff_key)
    raise HTTPException(status_code=403, detail="Admin key required")
