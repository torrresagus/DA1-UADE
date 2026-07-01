from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Notificacion
from app.schemas.notificacion import NotificacionOut

router = APIRouter(tags=["Notificaciones"])


def crear_notificacion(
    db: Session, usuario_id: int, tipo: str, titulo: str, cuerpo: str
) -> Notificacion:
    """Helper usado por otros routers para emitir un mensaje privado al usuario.

    No hace commit: se persiste junto con la transacción que la origina.
    """
    n = Notificacion(usuario_id=usuario_id, tipo=tipo, titulo=titulo, cuerpo=cuerpo)
    db.add(n)
    return n


@router.get(
    "/usuarios/{usuario_id}/notificaciones",
    response_model=list[NotificacionOut],
    summary="Mensajes privados del usuario (más recientes primero)",
)
def listar_notificaciones(usuario_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Notificacion)
        .filter(Notificacion.usuario_id == usuario_id)
        .order_by(Notificacion.fecha.desc())
        .all()
    )


@router.post(
    "/notificaciones/{notificacion_id}/leer",
    response_model=NotificacionOut,
    summary="Marcar una notificación como leída",
)
def marcar_leida(notificacion_id: int, db: Session = Depends(get_db)):
    n = db.get(Notificacion, notificacion_id)
    if n is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notificación no encontrada")
    n.leida = True
    db.commit()
    db.refresh(n)
    return n


@router.delete(
    "/usuarios/{usuario_id}/notificaciones",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar todas las notificaciones del usuario",
)
def eliminar_notificaciones(usuario_id: int, db: Session = Depends(get_db)):
    db.query(Notificacion).filter(Notificacion.usuario_id == usuario_id).delete()
    db.commit()
