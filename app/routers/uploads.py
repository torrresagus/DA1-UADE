"""Subida de imágenes a un storage local (filesystem).

Las imágenes se guardan en ./media y se sirven como estáticos en /media.
Devuelve la URL absoluta para guardar en doc_frente_url / imágenes de
artículos / solicitudes. (No es un object store; alcanza para dev y la entrega.)
"""
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status

MEDIA_DIR = Path("media")
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic"}
MAX_BYTES = 8 * 1024 * 1024  # 8 MB

router = APIRouter(tags=["Uploads"])


@router.post("/uploads", summary="Subir una imagen y obtener su URL pública")
async def subir_imagen(request: Request, file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Formato no permitido (jpg, png, webp, gif, heic)",
        )
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "La imagen supera los 8MB")

    MEDIA_DIR.mkdir(exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    (MEDIA_DIR / name).write_bytes(data)

    url = str(request.base_url).rstrip("/") + f"/media/{name}"
    return {"url": url}
