from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CatalogoItem, Puja, Subasta, Venta

router = APIRouter(prefix="/metricas", tags=["Métricas"])


@router.get(
    "/usuario/{usuario_id}",
    summary="Métricas de participación del usuario",
)
def metricas_usuario(usuario_id: int, db: Session = Depends(get_db)):
    subastas_asistidas = (
        db.query(func.count(func.distinct(Puja.subasta_id)))
        .filter(Puja.usuario_id == usuario_id)
        .scalar()
    ) or 0
    total_pujas = (
        db.query(func.count(Puja.id)).filter(Puja.usuario_id == usuario_id).scalar()
    ) or 0
    ganadas = (
        db.query(func.count(Venta.id)).filter(Venta.comprador_id == usuario_id).scalar()
    ) or 0
    importe_ofertado = (
        db.query(func.coalesce(func.sum(Puja.monto), 0))
        .filter(Puja.usuario_id == usuario_id)
        .scalar()
    ) or Decimal("0")
    importe_pagado = (
        db.query(func.coalesce(func.sum(Venta.monto_final), 0))
        .filter(Venta.comprador_id == usuario_id, Venta.pagada.is_(True))
        .scalar()
    ) or Decimal("0")
    return {
        "usuario_id": usuario_id,
        "subastas_asistidas": int(subastas_asistidas),
        "cantidad_pujas": int(total_pujas),
        "subastas_ganadas": int(ganadas),
        "importe_ofertado": float(importe_ofertado),
        "importe_pagado": float(importe_pagado),
    }


@router.get("/subasta/{subasta_id}", summary="Métricas generales de una subasta")
def metricas_subasta(subasta_id: int, db: Session = Depends(get_db)):
    items = (
        db.query(func.count(CatalogoItem.id))
        .filter(CatalogoItem.subasta_id == subasta_id)
        .scalar()
    ) or 0
    vendidos = (
        db.query(func.count(CatalogoItem.id))
        .filter(CatalogoItem.subasta_id == subasta_id, CatalogoItem.vendido.is_(True))
        .scalar()
    ) or 0
    total_pujas = (
        db.query(func.count(Puja.id)).filter(Puja.subasta_id == subasta_id).scalar()
    ) or 0
    subasta = db.get(Subasta, subasta_id)
    return {
        "subasta_id": subasta_id,
        "estado": subasta.estado.value if subasta else None,
        "items": int(items),
        "vendidos": int(vendidos),
        "total_pujas": int(total_pujas),
    }
