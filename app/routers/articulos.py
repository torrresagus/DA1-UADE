from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Articulo, Deposito, ImagenArticulo, Seguro
from decimal import Decimal

from app.schemas.articulo import (
    ArticuloCreate,
    ArticuloOut,
    DepositoCreate,
    DepositoOut,
    SeguroAumentar,
    SeguroCreate,
    SeguroOut,
)

router = APIRouter(prefix="/articulos", tags=["Artículos"])


@router.post("", response_model=ArticuloOut, status_code=status.HTTP_201_CREATED)
def crear_articulo(payload: ArticuloCreate, db: Session = Depends(get_db)):
    if db.query(Articulo).filter(Articulo.numero_pieza == payload.numero_pieza).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Número de pieza ya existente")
    data = payload.model_dump()
    imagenes = data.pop("imagenes", [])
    art = Articulo(**data)
    for img in imagenes:
        art.imagenes.append(ImagenArticulo(**img))
    db.add(art)
    db.commit()
    db.refresh(art)
    return art


@router.get("", response_model=list[ArticuloOut])
def listar_articulos(db: Session = Depends(get_db)):
    return db.query(Articulo).all()


@router.get("/{articulo_id}", response_model=ArticuloOut)
def obtener_articulo(articulo_id: int, db: Session = Depends(get_db)):
    art = db.get(Articulo, articulo_id)
    if art is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Artículo no encontrado")
    return art


@router.put("/{articulo_id}/deposito/{deposito_id}", response_model=ArticuloOut)
def asignar_deposito(articulo_id: int, deposito_id: int, db: Session = Depends(get_db)):
    art = db.get(Articulo, articulo_id)
    dep = db.get(Deposito, deposito_id)
    if art is None or dep is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Artículo o depósito no encontrado")
    art.deposito_id = deposito_id
    db.commit()
    db.refresh(art)
    return art


depositos_router = APIRouter(prefix="/depositos", tags=["Depósitos"])


@depositos_router.post("", response_model=DepositoOut, status_code=status.HTTP_201_CREATED)
def crear_deposito(payload: DepositoCreate, db: Session = Depends(get_db)):
    d = Deposito(**payload.model_dump())
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


@depositos_router.get("", response_model=list[DepositoOut])
def listar_depositos(db: Session = Depends(get_db)):
    return db.query(Deposito).all()


@depositos_router.get("/{deposito_id}", response_model=DepositoOut)
def obtener_deposito(deposito_id: int, db: Session = Depends(get_db)):
    d = db.get(Deposito, deposito_id)
    if d is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Depósito no encontrado")
    return d


seguros_router = APIRouter(prefix="/seguros", tags=["Seguros"])


@seguros_router.post("", response_model=SeguroOut, status_code=status.HTTP_201_CREATED)
def crear_seguro(payload: SeguroCreate, db: Session = Depends(get_db)):
    if db.query(Seguro).filter(Seguro.nro_poliza == payload.nro_poliza).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Póliza ya existente")
    data = payload.model_dump()
    articulo_ids = data.pop("articulo_ids")
    articulos = db.query(Articulo).filter(Articulo.id.in_(articulo_ids)).all()
    if len(articulos) != len(articulo_ids):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Algún artículo no existe")
    duenos = {a.dueno_actual_id for a in articulos if a.dueno_actual_id is not None}
    if len(duenos) > 1 or (duenos and data["beneficiario_id"] not in duenos):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "El seguro solo cubre piezas de un mismo dueño (beneficiario)",
        )
    seguro = Seguro(**data)
    seguro.articulos = articulos
    db.add(seguro)
    db.commit()
    db.refresh(seguro)
    return seguro


@seguros_router.get("", response_model=list[SeguroOut])
def listar_seguros(beneficiario_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(Seguro)
    if beneficiario_id is not None:
        q = q.filter(Seguro.beneficiario_id == beneficiario_id)
    return q.all()


@seguros_router.get("/{seguro_id}", response_model=SeguroOut)
def obtener_seguro(seguro_id: int, db: Session = Depends(get_db)):
    s = db.get(Seguro, seguro_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Seguro no encontrado")
    return s


@seguros_router.post(
    "/{seguro_id}/aumentar",
    response_model=SeguroOut,
    summary="Aumentar el valor de la póliza pagando la diferencia del premio",
)
def aumentar_seguro(seguro_id: int, payload: SeguroAumentar, db: Session = Depends(get_db)):
    s = db.get(Seguro, seguro_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Seguro no encontrado")
    if not s.vigente:
        raise HTTPException(status.HTTP_409_CONFLICT, "La póliza no está vigente")
    if Decimal(payload.nuevo_monto) <= Decimal(s.monto_cubierto):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "El nuevo monto debe ser mayor al monto cubierto actual",
        )
    s.monto_cubierto = Decimal(payload.nuevo_monto)
    db.commit()
    db.refresh(s)
    return s
