"""Recategorización automática de usuarios.

El enunciado: "La diversidad de los medios de pago del usuario y su actividad en
las subastas permiten mejorar su categoría". Se calcula un puntaje a partir de la
cantidad de TIPOS distintos de medios de pago verificados y de la cantidad de
ventas pagadas; la categoría sólo puede mejorar (nunca baja la asignada por la
investigación de la empresa).
"""
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    CATEGORIA_RANK,
    CategoriaUsuario,
    EstadoMedioPago,
    MedioPago,
    Notificacion,
    Usuario,
    Venta,
)

# Puntaje mínimo (tipos verificados + ventas pagadas) para cada categoría.
_UMBRALES = [
    (8, CategoriaUsuario.PLATINO),
    (6, CategoriaUsuario.ORO),
    (4, CategoriaUsuario.PLATA),
    (2, CategoriaUsuario.ESPECIAL),
]


def recalcular_categoria(db: Session, usuario: Usuario) -> CategoriaUsuario:
    tipos_verificados = (
        db.query(func.count(func.distinct(MedioPago.tipo)))
        .filter(
            MedioPago.usuario_id == usuario.id,
            MedioPago.verificado.is_(True),
            MedioPago.estado == EstadoMedioPago.VERIFICADO,
        )
        .scalar()
    ) or 0
    ventas_pagadas = (
        db.query(func.count(Venta.id))
        .filter(Venta.comprador_id == usuario.id, Venta.pagada.is_(True))
        .scalar()
    ) or 0

    score = int(tipos_verificados) + int(ventas_pagadas)
    objetivo = CategoriaUsuario.COMUN
    for minimo, categoria in _UMBRALES:
        if score >= minimo:
            objetivo = categoria
            break

    if CATEGORIA_RANK[objetivo] > CATEGORIA_RANK[usuario.categoria]:
        categoria_anterior = usuario.categoria
        usuario.categoria = objetivo
        db.add(Notificacion(
            usuario_id=usuario.id,
            tipo="categoria",
            titulo="¡Subiste de categoría!",
            cuerpo=(
                f"Pasaste de {categoria_anterior.value.capitalize()} a "
                f"{objetivo.value.capitalize()}. "
                "Ahora tenés acceso a más subastas exclusivas."
            ),
        ))
        db.commit()
    return usuario.categoria
