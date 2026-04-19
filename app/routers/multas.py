from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Multa, Usuario
from app.schemas.multa import MultaCreate, MultaOut

router = APIRouter(prefix="/multas", tags=["Multas"])


@router.post("", response_model=MultaOut, status_code=status.HTTP_201_CREATED)
def crear_multa(payload: MultaCreate, db: Session = Depends(get_db)):
    if db.get(Usuario, payload.usuario_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    m = Multa(**payload.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@router.get("/usuario/{usuario_id}", response_model=list[MultaOut])
def listar_por_usuario(usuario_id: int, db: Session = Depends(get_db)):
    return db.query(Multa).filter(Multa.usuario_id == usuario_id).all()


@router.post("/{multa_id}/pagar", response_model=MultaOut, summary="Marcar multa como pagada")
def pagar_multa(multa_id: int, db: Session = Depends(get_db)):
    m = db.get(Multa, multa_id)
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Multa no encontrada")
    m.pagada = True
    db.commit()
    # Si no quedan multas impagas, desbloquear usuario
    restantes = (
        db.query(Multa)
        .filter(Multa.usuario_id == m.usuario_id, Multa.pagada.is_(False))
        .count()
    )
    if restantes == 0:
        usuario = db.get(Usuario, m.usuario_id)
        if usuario:
            usuario.bloqueado_por_impago = False
            db.commit()
    db.refresh(m)
    return m
