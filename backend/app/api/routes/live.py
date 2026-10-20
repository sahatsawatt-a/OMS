import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.live import live

router = APIRouter(tags=["live"])

# Send something this often so proxies (nginx, ngrok) don't close an idle socket
PING_SECONDS = 25


@router.websocket("/ws")
async def changes(ws: WebSocket) -> None:
    """Sends {"type": "changed"} whenever data changes; the screen then fetches what it shows."""
    await ws.accept()
    live.add(ws)
    try:
        while True:
            try:
                # Screens don't send anything; this just notices when they go away
                await asyncio.wait_for(ws.receive_text(), timeout=PING_SECONDS)
            except TimeoutError:
                await ws.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    finally:
        live.remove(ws)
