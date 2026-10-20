"""Tell open screens that something changed, so they fetch fresh data straight away (REQ-34).

Screens keep a WebSocket open on /api/ws. After any database commit that wrote something, each
socket gets {"type": "changed"} and the screen re-runs its usual GET. The message carries no
data, so the socket needs no key. This works within one backend process; several workers would
need shared pub/sub (e.g. Redis) to reach each other's sockets.
"""

import asyncio
import json

from fastapi import WebSocket
from sqlalchemy import event
from sqlalchemy.orm import Session

# Commits this close together send one message
COALESCE_SECONDS = 0.05

CHANGED = json.dumps({"type": "changed"})


class Live:
    def __init__(self) -> None:
        self.sockets: set[WebSocket] = set()
        self.loop: asyncio.AbstractEventLoop | None = None
        self._pending = False

    def add(self, ws: WebSocket) -> None:
        self.loop = asyncio.get_running_loop()
        self.sockets.add(ws)

    def remove(self, ws: WebSocket) -> None:
        self.sockets.discard(ws)

    def notify(self) -> None:
        """Safe from any thread: sync routes run in a thread pool, the sockets on the event loop."""
        loop = self.loop
        if loop is None or loop.is_closed() or not self.sockets:
            return
        loop.call_soon_threadsafe(self._schedule)

    def _schedule(self) -> None:
        if self._pending or self.loop is None:
            return
        self._pending = True
        self.loop.call_later(COALESCE_SECONDS, lambda: asyncio.ensure_future(self._broadcast()))

    async def _broadcast(self) -> None:
        self._pending = False
        for ws in list(self.sockets):
            try:
                await ws.send_text(CHANGED)
            except Exception:
                # Closed in the meantime; its handler removes it too
                self.sockets.discard(ws)


live = Live()


# Only commits that flushed something count, so reads never cause a message (and a screen's
# refetch can't trigger another one)
@event.listens_for(Session, "after_flush")
def _wrote(session: Session, _flush_context: object) -> None:
    session.info["live_wrote"] = True


@event.listens_for(Session, "after_commit")
def _committed(session: Session) -> None:
    if session.info.pop("live_wrote", False):
        live.notify()


@event.listens_for(Session, "after_rollback")
def _rolled_back(session: Session) -> None:
    session.info.pop("live_wrote", None)
