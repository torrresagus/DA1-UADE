from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import EstadoMedioPago, MedioPago, Usuario
from app.schemas.medio_pago import MedioPagoCreate, MedioPagoOut, MedioPagoVerificar

router = APIRouter(prefix="/usuarios/{usuario_id}/medios-pago", tags=["Medios de pago"])


@router.post(
    "",
    response_model=MedioPagoOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar medio de pago para el usuario",
)
def crear_medio_pago(
    usuario_id: int, payload: MedioPagoCreate, db: Session = Depends(get_db)
):
    if db.get(Usuario, usuario_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    mp = MedioPago(usuario_id=usuario_id, **payload.model_dump())
    db.add(mp)
    db.commit()
    db.refresh(mp)
    return mp


@router.get("", response_model=list[MedioPagoOut], summary="Listar medios de pago del usuario")
def listar_medios_pago(usuario_id: int, db: Session = Depends(get_db)):
    return db.query(MedioPago).filter(MedioPago.usuario_id == usuario_id).all()


@router.post(
    "/{mp_id}/verificar",
    response_model=MedioPagoOut,
    summary="Verificar (o rechazar) un medio de pago antes del inicio de la subasta",
)
def verificar_medio_pago(
    usuario_id: int, mp_id: int, payload: MedioPagoVerificar, db: Session = Depends(get_db)
):
    mp = db.get(MedioPago, mp_id)
    if mp is None or mp.usuario_id != usuario_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Medio de pago no encontrado")
    mp.verificado = payload.verificado
    mp.estado = EstadoMedioPago.VERIFICADO if payload.verificado else EstadoMedioPago.RECHAZADO
    db.commit()
    db.refresh(mp)
    return mp


@router.delete(
    "/{mp_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar medio de pago"
)
def eliminar_medio_pago(usuario_id: int, mp_id: int, db: Session = Depends(get_db)):
    mp = db.get(MedioPago, mp_id)
    if mp is None or mp.usuario_id != usuario_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Medio de pago no encontrado")
    db.delete(mp)
    db.commit()
