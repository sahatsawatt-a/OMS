from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from app.core.config import get_settings


def utcnow() -> datetime:
    """Naive UTC, as stored in MySQL DATETIME columns."""
    return datetime.now(UTC).replace(tzinfo=None)


def to_ms(value: datetime | None) -> int | None:
    """Epoch milliseconds, the time format the frontend uses."""
    if value is None:
        return None
    return int(value.replace(tzinfo=UTC).timestamp() * 1000)


def from_ms(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000, UTC).replace(tzinfo=None)


def business_day(at: datetime) -> date:
    """The restaurant's calendar day for a stored UTC time."""
    tz = ZoneInfo(get_settings().restaurant_timezone)
    return at.replace(tzinfo=UTC).astimezone(tz).date()
