from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import EstadoArticulo
from app.schemas.common import ORMBase


class ImagenArticuloCreate(BaseModel):
    url: str
    orden: int = 0


class ImagenArticuloOut(ORMBase):
    id: int
    url: str
    orden: int


class ArticuloCreate(BaseModel):
    numero_pieza: str
    descripcion: str
    precio_base: Decimal
    moneda: str = "ARS"
    dueno_actual_id: int | None = None
    artista: str | None = None
    fecha_obra: str | None = None
    historia: str | None = None
    cantidad_elementos: int = 1
    imagenes: list[ImagenArticuloCreate] = Field(default_factory=list)


class ArticuloOut(ORMBase):
    id: int
    numero_pieza: str
    descripcion: str
    precio_base: Decimal
    moneda: str
    dueno_actual_id: int | None = None
    artista: str | None = None
    fecha_obra: str | None = None
    historia: str | None = None
    cantidad_elementos: int
    estado: EstadoArticulo
    deposito_id: int | None = None
    imagenes: list[ImagenArticuloOut] = []


class DepositoCreate(BaseModel):
    nombre: str
    direccion: str
    ciudad: str


class DepositoOut(ORMBase):
    id: int
    nombre: str
    direccion: str
    ciudad: str


class SeguroCreate(BaseModel):
    nro_poliza: str
    compania: str
    beneficiario_id: int
    monto_cubierto: Decimal
    moneda: str = "ARS"
    articulo_ids: list[int]


class SeguroOut(ORMBase):
    id: int
    nro_poliza: str
    compania: str
    beneficiario_id: int
    monto_cubierto: Decimal
    moneda: str
