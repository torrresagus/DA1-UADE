"""Conexiones WebSocket en tiempo real para las subastas.

- Un usuario sólo puede estar conectado a UNA subasta a la vez (enunciado: "los
  usuarios no pueden estar conectados en más de una a la vez").
- Al registrarse una puja se difunde la nueva mejor oferta a todos los
  conectados a esa subasta, para que validen y hagan sus propias ofertas.
"""
from __future__ import annotations

import asyncio
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._rooms: dict[int, set[WebSocket]] = defaultdict(set)
        # usuario_id -> (subasta_id, WebSocket). Sólo para usuarios identificados.
        self._user_session: dict[int, tuple[int, WebSocket]] = {}
        self._lock = asyncio.Lock()

    def subasta_de_usuario(self, usuario_id: int) -> int | None:
        sess = self._user_session.get(usuario_id)
        return sess[0] if sess else None

    async def connect(self, ws: WebSocket, subasta_id: int, usuario_id: int | None) -> bool:
        """Acepta la conexión. Devuelve False si el usuario ya está en otra subasta."""
        await ws.accept()
        async with self._lock:
            if usuario_id is not None:
                existing = self._user_session.get(usuario_id)
                if existing and existing[0] != subasta_id:
                    return False
                self._user_session[usuario_id] = (subasta_id, ws)
            self._rooms[subasta_id].add(ws)
        return True

    async def disconnect(self, ws: WebSocket, subasta_id: int, usuario_id: int | None) -> None:
        async with self._lock:
            self._rooms.get(subasta_id, set()).discard(ws)
            if usuario_id is not None:
                sess = self._user_session.get(usuario_id)
                if sess and sess[1] is ws:
                    self._user_session.pop(usuario_id, None)

    async def broadcast(self, subasta_id: int, message: dict) -> None:
        for ws in list(self._rooms.get(subasta_id, set())):
            try:
                await ws.send_json(message)
            except Exception:
                self._rooms.get(subasta_id, set()).discard(ws)


manager = ConnectionManager()
