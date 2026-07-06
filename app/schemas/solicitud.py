from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, computed_field

from app.models.enums import CategoriaUsuario, EstadoSolicitud
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
    # Documentación (URL) que acredita el origen lícito, si se dispone.
    origen_documentacion_url: str | None = None
    acepta_devolucion_con_cargo: bool
    cantidad_elementos: int = 1
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
    # Solo relevante cuando acepta=True: define el público mínimo de la subasta generada.
    categoria_minima: CategoriaUsuario = CategoriaUsuario.COMUN
    # Si True, la subasta se crea como ABIERTA de inmediato en vez de PROGRAMADA.
    iniciar_inmediatamente: bool = False


class SolicitudOut(ORMBase):
    id: int
    usuario_id: int
    descripcion: str
    datos_historicos: str | None = None
    declara_propiedad: bool
    origen_licito_acreditado: bool
    origen_documentacion_url: str | None = None
    revisar_origen: bool = False
    autoridad_avisada: bool = False
    acepta_devolucion_con_cargo: bool
    cantidad_elementos: int = 1
    estado: EstadoSolicitud
    motivo_rechazo: str | None = None
    precio_base_propuesto: Decimal | None = None
    comision_propuesta: Decimal | None = None
    fecha_subasta_propuesta: datetime | None = None
    respuesta_usuario: bool | None = None
    gastos_devolucion: Decimal | None = None
    fecha: datetime
    imagenes: list[ImagenSolicitudOut] = []

    @computed_field
    @property
    def articulo_nro_pieza(self) -> str | None:
        if self.estado == EstadoSolicitud.CONFIRMADA_POR_USUARIO:
            return f"SOL-{self.id}"
        return None

    @computed_field
    @property
    def nro_poliza(self) -> str | None:
        if self.estado == EstadoSolicitud.CONFIRMADA_POR_USUARIO:
            return f"POL-SOL-{self.id}"
        return None

    @computed_field
    @property
    def ubicacion_subasta(self) -> str | None:
        if self.estado == EstadoSolicitud.CONFIRMADA_POR_USUARIO:
            return "Bidify - Online"
        return None
