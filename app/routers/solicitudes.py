from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import EstadoSolicitud, ImagenSolicitud, SolicitudSubasta, Usuario
from app.schemas.solicitud import SolicitudCreate, SolicitudOut, SolicitudResolucion

router = APIRouter(prefix="/solicitudes", tags=["Solicitudes de subasta"])


@router.post(
    "/{usuario_id}",
    response_model=SolicitudOut,
    status_code=status.HTTP_201_CREATED,
    summary="Postor solicita incluir un bien en una futura subasta",
)
def crear_solicitud(
    usuario_id: int, payload: SolicitudCreate, db: Session = Depends(get_db)
):
    if db.get(Usuario, usuario_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    if not payload.declara_propiedad:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Debe declarar que el bien le pertenece y no tiene impedimentos",
        )
    if not payload.acepta_devolucion_con_cargo:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Debe aceptar que la devolución (si corresponde) corre por su cuenta",
        )
    data = payload.model_dump()
    imagenes = data.pop("imagenes", [])
    sol = SolicitudSubasta(usuario_id=usuario_id, **data)
    for img in imagenes:
        sol.imagenes.append(ImagenSolicitud(**img))
    db.add(sol)
    db.commit()
    db.refresh(sol)
    return sol


@router.get("/{solicitud_id}", response_model=SolicitudOut)
def obtener_solicitud(solicitud_id: int, db: Session = Depends(get_db)):
    s = db.get(SolicitudSubasta, solicitud_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
    return s


@router.get("", response_model=list[SolicitudOut])
def listar_solicitudes(
    estado: EstadoSolicitud | None = None, db: Session = Depends(get_db)
):
    q = db.query(SolicitudSubasta)
    if estado is not None:
        q = q.filter(SolicitudSubasta.estado == estado)
    return q.order_by(SolicitudSubasta.fecha.desc()).all()


@router.post(
    "/{solicitud_id}/resolver",
    response_model=SolicitudOut,
    summary="La empresa acepta o rechaza la solicitud tras la inspección",
)
def resolver_solicitud(
    solicitud_id: int, payload: SolicitudResolucion, db: Session = Depends(get_db)
):
    s = db.get(SolicitudSubasta, solicitud_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
    s.estado = payload.estado
    if payload.motivo_rechazo is not None:
        s.motivo_rechazo = payload.motivo_rechazo
    if payload.precio_base_propuesto is not None:
        s.precio_base_propuesto = payload.precio_base_propuesto
    if payload.comision_propuesta is not None:
        s.comision_propuesta = payload.comision_propuesta
    if payload.fecha_subasta_propuesta is not None:
        s.fecha_subasta_propuesta = payload.fecha_subasta_propuesta
    db.commit()
    db.refresh(s)
    return s
