"""Endpoint WebSocket para seguir una subasta en vivo."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.realtime import manager

router = APIRouter()


@router.websocket("/ws/subastas/{subasta_id}")
async def ws_subasta(websocket: WebSocket, subasta_id: int, usuario_id: int | None = None):
    ok = await manager.connect(websocket, subasta_id, usuario_id)
    if not ok:
        # El usuario ya está conectado a otra subasta.
        await websocket.send_json({"type": "error", "detail": "Ya estás conectado a otra subasta"})
        await websocket.close(code=4001)
        return
    try:
        await websocket.send_json({"type": "connected", "subasta_id": subasta_id})
        while True:
            # Mantener viva la conexión; los mensajes entrantes se ignoran.
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket, subasta_id, usuario_id)
