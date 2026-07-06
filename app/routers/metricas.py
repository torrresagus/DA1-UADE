"""FLUJO — Métricas de participación (todas calculadas de datos reales de la BD).

Enunciado: cada usuario ve su participación — subastas asistidas, cantidad de pujas,
veces que ganó, importes ofertado/pagado — y un desglose por categoría de subasta
(`_por_categoria`). Nada está hardcodeado: son agregaciones SQL sobre Puja y Venta.
"""
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CatalogoItem, Puja, Subasta, Venta

router = APIRouter(prefix="/metricas", tags=["Métricas"])


def _por_categoria(db: Session, usuario_id: int) -> list[dict]:
    """Agrupa la actividad del usuario por la categoría de las subastas.

    - pujas e importe ofertado: join Puja -> Subasta.categoria_minima.
    - ganadas e importe pagado: join Venta -> CatalogoItem -> Subasta.
    """
    pujas_rows = (
        db.query(
            Subasta.categoria_minima,
            func.count(Puja.id),
            func.coalesce(func.sum(Puja.monto), 0),
        )
        .join(Puja, Puja.subasta_id == Subasta.id)
        .filter(Puja.usuario_id == usuario_id)
        .group_by(Subasta.categoria_minima)
        .all()
    )
    ventas_rows = (
        db.query(
            Subasta.categoria_minima,
            func.count(Venta.id),
            func.coalesce(func.sum(Venta.monto_final), 0),
        )
        .join(CatalogoItem, CatalogoItem.id == Venta.catalogo_item_id)
        .join(Subasta, Subasta.id == CatalogoItem.subasta_id)
        .filter(Venta.comprador_id == usuario_id)
        .group_by(Subasta.categoria_minima)
        .all()
    )
    acc: dict[str, dict] = {}
    for cat, cant, ofertado in pujas_rows:
        key = cat.value if hasattr(cat, "value") else str(cat)
        acc.setdefault(key, {"categoria": key, "cantidad_pujas": 0, "importe_ofertado": 0.0, "subastas_ganadas": 0, "importe_pagado": 0.0})
        acc[key]["cantidad_pujas"] = int(cant)
        acc[key]["importe_ofertado"] = float(ofertado)
    for cat, ganadas, pagado in ventas_rows:
        key = cat.value if hasattr(cat, "value") else str(cat)
        acc.setdefault(key, {"categoria": key, "cantidad_pujas": 0, "importe_ofertado": 0.0, "subastas_ganadas": 0, "importe_pagado": 0.0})
        acc[key]["subastas_ganadas"] = int(ganadas)
        acc[key]["importe_pagado"] = float(pagado)
    return list(acc.values())


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
        "por_categoria": _por_categoria(db, usuario_id),
    }


@router.get(
    "/usuario/{usuario_id}/por-categoria",
    summary="Métricas del usuario desglosadas por categoría de subasta",
)
def metricas_usuario_por_categoria(usuario_id: int, db: Session = Depends(get_db)):
    return {"usuario_id": usuario_id, "por_categoria": _por_categoria(db, usuario_id)}


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
