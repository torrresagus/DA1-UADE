from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import EstadoSolicitud
from app.schemas.common import ORMBase


class ImagenSolicitudCreate(BaseModel):
    url: str
    orden: int = 0


class ImagenSolicitudOut(ORMBase):
    id: int
    url: str
    orden: int


class SolicitudCreate(BaseModel):
    descripcion: str
    datos_historicos: str | None = None
    declara_propiedad: bool
    origen_licito_acreditado: bool = False
    acepta_devolucion_con_cargo: bool
    # El enunciado exige fotos del bien (al menos 6).
    imagenes: list[ImagenSolicitudCreate] = Field(..., min_length=6)


class SolicitudResolucion(BaseModel):
    estado: EstadoSolicitud
    motivo_rechazo: str | None = None
    precio_base_propuesto: Decimal | None = None
    comision_propuesta: Decimal | None = None
    fecha_subasta_propuesta: datetime | None = None


class SolicitudRespuestaUsuario(BaseModel):
    acepta: bool


class SolicitudOut(ORMBase):
    id: int
    usuario_id: int
    descripcion: str
    datos_historicos: str | None = None
    declara_propiedad: bool
    origen_licito_acreditado: bool
    revisar_origen: bool = False
    acepta_devolucion_con_cargo: bool
    estado: EstadoSolicitud
    motivo_rechazo: str | None = None
    precio_base_propuesto: Decimal | None = None
    comision_propuesta: Decimal | None = None
    fecha_subasta_propuesta: datetime | None = None
    respuesta_usuario: bool | None = None
    fecha: datetime
    imagenes: list[ImagenSolicitudOut] = []
