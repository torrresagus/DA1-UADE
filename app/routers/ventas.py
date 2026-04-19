from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Articulo,
    CatalogoItem,
    EstadoArticulo,
    MedioPago,
    Multa,
    Usuario,
    Venta,
)
from app.schemas.venta import VentaCreate, VentaOut
from app.services.pujas import mejor_puja

router = APIRouter(prefix="/ventas", tags=["Ventas"])


@router.post(
    "/cerrar/{catalogo_item_id}",
    response_model=VentaOut,
    status_code=status.HTTP_201_CREATED,
    summary="Cerrar la venta tomando la mejor puja del ítem",
)
def cerrar_venta(
    catalogo_item_id: int,
    medio_pago_id: int,
    comision_pct: Decimal = Decimal("0.10"),
    costo_envio: Decimal = Decimal("0"),
    db: Session = Depends(get_db),
):
    item = db.get(CatalogoItem, catalogo_item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ítem no encontrado")
    if item.vendido:
        raise HTTPException(status.HTTP_409_CONFLICT, "El ítem ya fue vendido")
    mejor = mejor_puja(db, catalogo_item_id)
    if mejor is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El ítem no recibió pujas")
    mp = db.get(MedioPago, medio_pago_id)
    if mp is None or mp.usuario_id != mejor.usuario_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Medio de pago inválido")
    venta = Venta(
        catalogo_item_id=catalogo_item_id,
        comprador_id=mejor.usuario_id,
        medio_pago_id=medio_pago_id,
        monto_final=mejor.monto,
        comision=(Decimal(mejor.monto) * Decimal(comision_pct)).quantize(Decimal("0.01")),
        costo_envio=Decimal(costo_envio),
        moneda=item.articulo.moneda if item.articulo else "ARS",
    )
    item.vendido = True
    articulo = db.get(Articulo, item.articulo_id)
    articulo.estado = EstadoArticulo.VENDIDO
    articulo.dueno_actual_id = mejor.usuario_id
    db.add(venta)
    db.commit()
    db.refresh(venta)
    return venta


@router.post(
    "/{venta_id}/impago",
    summary="Registrar impago: genera multa del 10% y bloquea al usuario",
    status_code=status.HTTP_201_CREATED,
)
def registrar_impago(venta_id: int, db: Session = Depends(get_db)):
    venta = db.get(Venta, venta_id)
    if venta is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Venta no encontrada")
    if venta.pagada:
        raise HTTPException(status.HTTP_409_CONFLICT, "La venta ya fue pagada")
    usuario = db.get(Usuario, venta.comprador_id)
    monto_multa = (Decimal(venta.monto_final) * Decimal("0.10")).quantize(Decimal("0.01"))
    multa = Multa(
        usuario_id=usuario.id,
        venta_id=venta.id,
        monto=monto_multa,
        moneda=venta.moneda,
        motivo=f"Impago de la venta {venta.id}",
    )
    usuario.bloqueado_por_impago = True
    db.add(multa)
    db.commit()
    db.refresh(multa)
    return {"multa_id": multa.id, "monto": monto_multa, "bloqueado": True}


@router.get("", response_model=list[VentaOut], summary="Listar ventas")
def listar_ventas(db: Session = Depends(get_db)):
    return db.query(Venta).all()


@router.get("/{venta_id}", response_model=VentaOut)
def obtener_venta(venta_id: int, db: Session = Depends(get_db)):
    v = db.get(Venta, venta_id)
    if v is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Venta no encontrada")
    return v


@router.post("/{venta_id}/pagar", response_model=VentaOut, summary="Marcar venta como pagada")
def marcar_pagada(venta_id: int, db: Session = Depends(get_db)):
    v = db.get(Venta, venta_id)
    if v is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Venta no encontrada")
    v.pagada = True
    db.commit()
    db.refresh(v)
    return v
