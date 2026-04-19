from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CatalogoItem, Puja, Subasta
from app.schemas.puja import MejorOferta, PujaCreate, PujaOut
from app.services.pujas import PujaInvalida, mejor_puja, rango_valido, validar_y_registrar_puja

router = APIRouter(prefix="/pujas", tags=["Pujas"])


@router.post(
    "",
    response_model=PujaOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar una puja (valida reglas de incremento)",
    responses={
        400: {"description": "Puja inválida (rango, usuario bloqueado, subasta cerrada, etc.)"},
        404: {"description": "Ítem, subasta o usuario no encontrado"},
    },
)
def crear_puja(payload: PujaCreate, db: Session = Depends(get_db)):
    try:
        puja = validar_y_registrar_puja(
            db,
            catalogo_item_id=payload.catalogo_item_id,
            usuario_id=payload.usuario_id,
            monto=payload.monto,
        )
    except PujaInvalida as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    return puja


@router.get(
    "/item/{catalogo_item_id}",
    response_model=list[PujaOut],
    summary="Historial de pujas de un ítem (orden cronológico)",
)
def historial_item(catalogo_item_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Puja)
        .filter(Puja.catalogo_item_id == catalogo_item_id)
        .order_by(Puja.fecha_hora.asc())
        .all()
    )


@router.get(
    "/item/{catalogo_item_id}/mejor",
    response_model=MejorOferta,
    summary="Mejor oferta actual y rango válido para la próxima puja",
)
def mejor_oferta(catalogo_item_id: int, db: Session = Depends(get_db)):
    item = db.get(CatalogoItem, catalogo_item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ítem de catálogo no encontrado")
    subasta = db.get(Subasta, item.subasta_id)
    ultima = mejor_puja(db, catalogo_item_id)
    minimo, maximo = rango_valido(
        item.precio_base,
        ultima.monto if ultima else None,
        subasta.categoria_minima,
    )
    return MejorOferta(
        catalogo_item_id=catalogo_item_id,
        mejor_monto=ultima.monto if ultima else None,
        usuario_id=ultima.usuario_id if ultima else None,
        minimo_proxima=Decimal(minimo),
        maximo_proxima=Decimal(maximo) if maximo is not None else None,
    )


@router.get(
    "/usuario/{usuario_id}",
    response_model=list[PujaOut],
    summary="Historial de pujas de un usuario",
)
def historial_usuario(usuario_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Puja)
        .filter(Puja.usuario_id == usuario_id)
        .order_by(Puja.fecha_hora.desc())
        .all()
    )
