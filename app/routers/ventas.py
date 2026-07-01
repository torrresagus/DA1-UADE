from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import (
    Articulo,
    CatalogoItem,
    CategoriaUsuario,
    EstadoArticulo,
    EstadoRegistro,
    MedioPago,
    Multa,
    Usuario,
    Venta,
)
from app.routers.notificaciones import crear_notificacion
from app.schemas.venta import VentaCreate, VentaOut
from app.services.categorias import recalcular_categoria
from app.services.pujas import mejor_puja

router = APIRouter(prefix="/ventas", tags=["Ventas"])


def _get_empresa(db: Session) -> Usuario:
    """Usuario interno 'empresa' que compra lotes sin pujas al valor base."""
    empresa = db.query(Usuario).filter(Usuario.email == settings.empresa_email).first()
    if empresa is None:
        empresa = Usuario(
            nombre="Bidify",
            apellido="Empresa",
            email=settings.empresa_email,
            domicilio="-",
            pais="Argentina",
            categoria=CategoriaUsuario.PLATINO,
            estado_registro=EstadoRegistro.COMPLETO,
        )
        db.add(empresa)
        db.flush()
    return empresa


def _invalidar_seguros(articulo: Articulo) -> None:
    """El retiro personal del bien hace perder la cobertura del seguro."""
    for seg in articulo.seguros:
        seg.vigente = False


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
    retira_personalmente: bool = False,
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
    moneda = item.articulo.moneda if item.articulo else "ARS"
    # Una subasta en dólares debe cancelarse en dólares (cuenta o tarjeta internacional).
    if moneda == "USD" and (mp.moneda or "ARS") != "USD":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Una subasta en dólares debe pagarse con un medio de pago en dólares "
            "(cuenta extranjera o tarjeta internacional)",
        )
    venta = Venta(
        catalogo_item_id=catalogo_item_id,
        comprador_id=mejor.usuario_id,
        medio_pago_id=medio_pago_id,
        monto_final=mejor.monto,
        comision=(Decimal(mejor.monto) * Decimal(comision_pct)).quantize(Decimal("0.01")),
        costo_envio=Decimal(costo_envio),
        retira_personalmente=retira_personalmente,
        moneda=moneda,
    )
    item.vendido = True
    articulo = db.get(Articulo, item.articulo_id)
    articulo.estado = EstadoArticulo.VENDIDO
    articulo.dueno_actual_id = mejor.usuario_id
    if retira_personalmente:
        _invalidar_seguros(articulo)
    db.add(venta)
    # Mensaje privado con el importe a pagar = puja + comisiones + envío.
    total = Decimal(venta.monto_final) + Decimal(venta.comision) + Decimal(venta.costo_envio)
    crear_notificacion(
        db,
        usuario_id=mejor.usuario_id,
        tipo="venta",
        titulo="¡Ganaste un lote!",
        cuerpo=(
            f"Importe a pagar: {total} {moneda} "
            f"(oferta {venta.monto_final} + comisión {venta.comision} + envío {venta.costo_envio})."
        ),
    )
    db.commit()
    db.refresh(venta)
    return venta


@router.post(
    "/cerrar-sin-pujas/{catalogo_item_id}",
    response_model=VentaOut,
    status_code=status.HTTP_201_CREATED,
    summary="Sin pujas: la empresa compra el ítem al valor base",
)
def cerrar_sin_pujas(catalogo_item_id: int, db: Session = Depends(get_db)):
    item = db.get(CatalogoItem, catalogo_item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ítem no encontrado")
    if item.vendido:
        raise HTTPException(status.HTTP_409_CONFLICT, "El ítem ya fue vendido")
    if mejor_puja(db, catalogo_item_id) is not None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "El ítem recibió pujas; usar /ventas/cerrar/{id}",
        )
    empresa = _get_empresa(db)
    venta = Venta(
        catalogo_item_id=catalogo_item_id,
        comprador_id=empresa.id,
        medio_pago_id=None,
        monto_final=item.precio_base,
        comision=Decimal("0"),
        costo_envio=Decimal("0"),
        moneda=item.articulo.moneda if item.articulo else "ARS",
    )
    item.vendido = True
    articulo = db.get(Articulo, item.articulo_id)
    articulo.estado = EstadoArticulo.VENDIDO
    articulo.dueno_actual_id = empresa.id
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
        # 72hs para presentar los fondos necesarios para pagar la oferta.
        fecha_vencimiento=datetime.utcnow() + timedelta(hours=72),
    )
    usuario.bloqueado_por_impago = True
    db.add(multa)
    crear_notificacion(
        db,
        usuario_id=usuario.id,
        tipo="multa",
        titulo="Multa por impago",
        cuerpo=(
            f"Se generó una multa de {monto_multa} {venta.moneda} (10% de lo ofertado). "
            "Tenés 72hs para presentar los fondos; debés pagarla antes de volver a participar."
        ),
    )
    db.commit()
    db.refresh(multa)
    return {
        "multa_id": multa.id,
        "monto": monto_multa,
        "bloqueado": True,
        "fecha_vencimiento": multa.fecha_vencimiento,
    }


@router.get("", response_model=list[VentaOut], summary="Listar ventas")
def listar_ventas(db: Session = Depends(get_db)):
    return db.query(Venta).all()


@router.get("/usuario/{usuario_id}", response_model=list[VentaOut], summary="Ventas del usuario como comprador")
def ventas_de_usuario(usuario_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Venta)
        .filter(Venta.comprador_id == usuario_id)
        .order_by(Venta.fecha.desc())
        .all()
    )


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
    # La actividad en subastas (ventas pagadas) puede mejorar la categoría.
    comprador = db.get(Usuario, v.comprador_id)
    if comprador:
        recalcular_categoria(db, comprador)
    db.refresh(v)
    return v
