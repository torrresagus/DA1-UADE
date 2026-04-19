from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Rematador
from app.schemas.rematador import RematadorCreate, RematadorOut

router = APIRouter(prefix="/rematadores", tags=["Rematadores"])


@router.post("", response_model=RematadorOut, status_code=status.HTTP_201_CREATED)
def crear_rematador(payload: RematadorCreate, db: Session = Depends(get_db)):
    if db.query(Rematador).filter(Rematador.matricula == payload.matricula).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Matrícula ya registrada")
    r = Rematador(**payload.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.get("", response_model=list[RematadorOut])
def listar_rematadores(db: Session = Depends(get_db)):
    return db.query(Rematador).all()


@router.get("/{rematador_id}", response_model=RematadorOut)
def obtener_rematador(rematador_id: int, db: Session = Depends(get_db)):
    r = db.get(Rematador, rematador_id)
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Rematador no encontrado")
    return r
