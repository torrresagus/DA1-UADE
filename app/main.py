from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import (
    articulos,
    medios_pago,
    metricas,
    multas,
    pujas,
    rematadores,
    solicitudes,
    subastas,
    usuarios,
    ventas,
)

# Importante para que SQLAlchemy registre todos los modelos antes de crear las tablas.
from app import models  # noqa: F401

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=(
        "API REST del Sistema de Subastas — UADE Desarrollo de Aplicaciones I, "
        "1C 2026. Gestiona registración de postores, catálogo, subastas, pujas, "
        "ventas, multas, seguros y solicitudes de incorporación de bienes."
    ),
    contact={"name": "Equipo DA1", "email": "agustin.torres@majily.com"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    # Crea tablas automáticamente si la DB no existe (útil para desarrollo/Swagger).
    # En producción usar Alembic: `alembic upgrade head`.
    Base.metadata.create_all(bind=engine)


@app.get("/health", tags=["Sistema"], summary="Healthcheck")
def health():
    return {"status": "ok", "app": settings.app_name}


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
