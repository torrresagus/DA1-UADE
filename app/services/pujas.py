"""Reglas de validación de pujas.

- Incremento mínimo: 1% del precio base del bien por sobre la última oferta.
- Incremento máximo: 20% del precio base del bien por sobre la última oferta.
- Los límites NO aplican para subastas de categoría oro y platino.
- Subasta debe estar ABIERTA.
- Usuario debe tener categoría >= categoria_minima de la subasta.
- Usuario debe tener al menos un medio de pago verificado.
- Usuario no puede estar bloqueado por impago ni tener multas impagas.
- Si tiene cheque certificado, la suma de sus compras no puede superar su garantía.
"""
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    CATEGORIA_RANK,
    CategoriaUsuario,
    CatalogoItem,
    EstadoMedioPago,
    EstadoPuja,
    EstadoSubasta,
    MedioPago,
    Multa,
    Puja,
    Subasta,
    TipoMedioPago,
    Usuario,
    Venta,
)


class PujaInvalida(Exception):
    pass


CATEGORIAS_SIN_LIMITE = {CategoriaUsuario.ORO, CategoriaUsuario.PLATINO}


def mejor_puja(db: Session, catalogo_item_id: int) -> Puja | None:
    return (
        db.query(Puja)
        .filter(
            Puja.catalogo_item_id == catalogo_item_id,
            Puja.estado == EstadoPuja.CONFIRMADA,
        )
        .order_by(Puja.monto.desc(), Puja.id.desc())
        .first()
    )


def rango_valido(precio_base: Decimal, ultimo_monto: Decimal | None, cat_subasta: CategoriaUsuario):
    base = Decimal(precio_base)
    ultimo = Decimal(ultimo_monto) if ultimo_monto is not None else base
    minimo = ultimo + base * Decimal("0.01") if ultimo_monto is not None else base
    if cat_subasta in CATEGORIAS_SIN_LIMITE:
        return minimo, None
    maximo = ultimo + base * Decimal("0.20")
    return minimo, maximo


def validar_y_registrar_puja(
    db: Session,
    catalogo_item_id: int,
    usuario_id: int,
    monto: Decimal,
) -> Puja:
    item = db.get(CatalogoItem, catalogo_item_id)
    if item is None:
        raise PujaInvalida("Ítem de catálogo inexistente")

    subasta = db.get(Subasta, item.subasta_id)
    if subasta.estado != EstadoSubasta.ABIERTA:
        raise PujaInvalida("La subasta no está abierta")
    if item.vendido:
        raise PujaInvalida("El ítem ya fue vendido")

    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise PujaInvalida("Usuario inexistente")
    if usuario.bloqueado_por_impago:
        raise PujaInvalida("Usuario bloqueado por impago")

    multas_impagas = (
        db.query(func.count(Multa.id))
        .filter(Multa.usuario_id == usuario_id, Multa.pagada.is_(False))
        .scalar()
    )
    if multas_impagas:
        raise PujaInvalida("El usuario tiene multas impagas")

    if CATEGORIA_RANK[usuario.categoria] < CATEGORIA_RANK[subasta.categoria_minima]:
        raise PujaInvalida("Categoría de usuario insuficiente para esta subasta")

    medios_verificados = (
        db.query(func.count(MedioPago.id))
        .filter(
            MedioPago.usuario_id == usuario_id,
            MedioPago.verificado.is_(True),
            MedioPago.estado == EstadoMedioPago.VERIFICADO,
        )
        .scalar()
    )
    if not medios_verificados:
        raise PujaInvalida("El usuario no tiene un medio de pago verificado")

    # Si tiene cheque certificado, limitar compras al monto garantizado
    cheque = (
        db.query(MedioPago)
        .filter(
            MedioPago.usuario_id == usuario_id,
            MedioPago.tipo == TipoMedioPago.CHEQUE_CERTIFICADO,
            MedioPago.verificado.is_(True),
            MedioPago.estado == EstadoMedioPago.VERIFICADO,
        )
        .first()
    )
    if cheque and cheque.monto_garantia is not None:
        gastado = (
            db.query(func.coalesce(func.sum(Venta.monto_final), 0))
            .filter(Venta.comprador_id == usuario_id)
            .scalar()
        ) or Decimal("0")
        if Decimal(gastado) + Decimal(monto) > Decimal(cheque.monto_garantia):
            raise PujaInvalida("La puja supera el monto garantizado por el cheque certificado")

    ultima = mejor_puja(db, catalogo_item_id)
    minimo, maximo = rango_valido(
        item.precio_base,
        ultima.monto if ultima else None,
        subasta.categoria_minima,
    )
    if Decimal(monto) < minimo:
        raise PujaInvalida(f"La puja debe ser al menos {minimo}")
    if maximo is not None and Decimal(monto) > maximo:
        raise PujaInvalida(f"La puja no puede superar {maximo}")

    puja = Puja(
        subasta_id=item.subasta_id,
        catalogo_item_id=catalogo_item_id,
        usuario_id=usuario_id,
        monto=Decimal(monto),
        estado=EstadoPuja.CONFIRMADA,
    )
    db.add(puja)
    db.commit()
    db.refresh(puja)
    return puja
