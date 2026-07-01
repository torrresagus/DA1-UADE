import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, engine
from app.routers import (
    articulos,
    medios_pago,
    metricas,
    multas,
    notificaciones,
    pujas,
    rematadores,
    solicitudes,
    subastas,
    uploads,
    usuarios,
    ventas,
    ws,
)
from app.services.cierre import (
    procesar_medios_pago_pendientes,
    procesar_multas_vencidas,
    procesar_solicitudes_pendientes,
    procesar_subastas_programadas,
    procesar_subastas_vencidas,
    procesar_usuarios_pendientes,
    procesar_ventas_impagas,
)

# Importante para que SQLAlchemy registre todos los modelos antes de crear las tablas.
from app import models  # noqa: F401

_SCHEDULER_INTERVAL = 15  # segundos


async def _scheduler():
    """Revisa cada 15 s subastas vencidas y avanza solicitudes en la máquina de estados."""
    while True:
        await asyncio.sleep(_SCHEDULER_INTERVAL)
        try:
            aprobados = await asyncio.to_thread(procesar_usuarios_pendientes)
            if aprobados:
                print(f"[scheduler] {aprobados} usuario(s) aprobado(s) automáticamente.")
            await asyncio.to_thread(procesar_medios_pago_pendientes)
            await asyncio.to_thread(procesar_solicitudes_pendientes)
            abiertas = await asyncio.to_thread(procesar_subastas_programadas)
            if abiertas:
                print(f"[scheduler] {abiertas} subasta(s) abierta(s) automáticamente.")
            cerradas = await asyncio.to_thread(procesar_subastas_vencidas)
            if cerradas:
                print(f"[scheduler] {cerradas} subasta(s) cerrada(s) automáticamente.")
            multas = await asyncio.to_thread(procesar_ventas_impagas)
            if multas:
                print(f"[scheduler] {multas} multa(s) generada(s) por impago.")
            derivadas = await asyncio.to_thread(procesar_multas_vencidas)
            if derivadas:
                print(f"[scheduler] {derivadas} multa(s) derivada(s) a la justicia.")
        except Exception as e:
            print(f"[scheduler] Error en scheduler: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    task = asyncio.create_task(_scheduler())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=(
        "API REST del Sistema de Subastas — UADE Desarrollo de Aplicaciones I, "
        "1C 2026. Gestiona registración de postores, catálogo, subastas, pujas, "
        "ventas, multas, seguros y solicitudes de incorporación de bienes."
    ),
    contact={"name": "Equipo DA1", "email": "agustin.torres@majily.com"},
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Sistema"], summary="Healthcheck")
def health():
    return {
        "status": "ok",
        "app": settings.app_name,
        "deposito_inspeccion": {
            "nombre": settings.deposito_nombre,
            "direccion": settings.deposito_direccion,
            "ciudad": settings.deposito_ciudad,
        },
    }


app.include_router(usuarios.router)
app.include_router(medios_pago.router)
app.include_router(rematadores.router)
app.include_router(articulos.router)
app.include_router(articulos.depositos_router)
app.include_router(articulos.seguros_router)
app.include_router(subastas.router)
app.include_router(pujas.router)
app.include_router(ventas.router)
app.include_router(multas.router)
app.include_router(solicitudes.router)
app.include_router(metricas.router)
app.include_router(notificaciones.router)
app.include_router(uploads.router)
app.include_router(ws.router)

# Storage local de imágenes subidas (DNI, fotos de artículos/solicitudes).
_MEDIA_DIR = Path("media")
_MEDIA_DIR.mkdir(exist_ok=True)
app.mount("/media", StaticFiles(directory=str(_MEDIA_DIR)), name="media")
