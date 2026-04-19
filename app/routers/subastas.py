from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    CATEGORIA_RANK,
    Articulo,
    CatalogoItem,
    EstadoRegistro,
    EstadoSubasta,
    Rematador,
    Subasta,
    Usuario,
)
from app.schemas.subasta import (
    CatalogoItemCreate,
    CatalogoItemOut,
    SubastaCambioEstado,
    SubastaCreate,
    SubastaOut,
    SubastaPublicaOut,
)

router = APIRouter(prefix="/subastas", tags=["Subastas"])


@router.post("", response_model=SubastaOut, status_code=status.HTTP_201_CREATED)
def crear_subasta(payload: SubastaCreate, db: Session = Depends(get_db)):
    if db.get(Rematador, payload.rematador_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Rematador no encontrado")
    s = Subasta(**payload.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.get("", response_model=list[SubastaOut], summary="Listar subastas (vista interna)")
def listar_subastas(
    estado: EstadoSubasta | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Subasta)
    if estado is not None:
        q = q.filter(Subasta.estado == estado)
    return q.order_by(Subasta.fecha_hora).all()


@router.get(
    "/publicas",
    response_model=list[SubastaPublicaOut],
    summary="Catálogo público (sin precios base)",
)
def listar_subastas_publicas(db: Session = Depends(get_db)):
    return db.query(Subasta).all()


@router.get("/{subasta_id}", response_model=SubastaOut)
def obtener_subasta(
    subasta_id: int,
    usuario_id: int | None = Query(default=None, description="Si se informa, valida acceso"),
    db: Session = Depends(get_db),
):
    s = db.get(Subasta, subasta_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subasta no encontrada")
    if usuario_id is not None:
        u = db.get(Usuario, usuario_id)
        if u is None or u.estado_registro != EstadoRegistro.COMPLETO:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Usuario no autorizado")
        if CATEGORIA_RANK[u.categoria] < CATEGORIA_RANK[s.categoria_minima]:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Categoría de usuario insuficiente"
            )
    return s


@router.post("/{subasta_id}/estado", response_model=SubastaOut)
def cambiar_estado(
    subasta_id: int, payload: SubastaCambioEstado, db: Session = Depends(get_db)
):
    s = db.get(Subasta, subasta_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subasta no encontrada")
    s.estado = payload.estado
    db.commit()
    db.refresh(s)
    return s


@router.post(
    "/{subasta_id}/catalogo",
    response_model=CatalogoItemOut,
    status_code=status.HTTP_201_CREATED,
    summary="Agregar artículo al catálogo de la subasta",
)
def agregar_item_catalogo(
    subasta_id: int, payload: CatalogoItemCreate, db: Session = Depends(get_db)
):
    s = db.get(Subasta, subasta_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subasta no encontrada")
    if db.get(Articulo, payload.articulo_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Artículo no encontrado")
    item = CatalogoItem(subasta_id=subasta_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get(
    "/{subasta_id}/catalogo",
    response_model=list[CatalogoItemOut],
    summary="Catálogo completo (con precios base) — requiere usuario registrado",
)
def listar_catalogo(subasta_id: int, db: Session = Depends(get_db)):
    s = db.get(Subasta, subasta_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subasta no encontrada")
    return db.query(CatalogoItem).filter(CatalogoItem.subasta_id == subasta_id).all()
