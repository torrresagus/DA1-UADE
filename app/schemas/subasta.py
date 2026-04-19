from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models.enums import CategoriaUsuario, EstadoSubasta, Moneda
from app.schemas.common import ORMBase


class CatalogoItemCreate(BaseModel):
    articulo_id: int
    precio_base: Decimal
    orden: int = 0


class CatalogoItemOut(ORMBase):
    id: int
    subasta_id: int
    articulo_id: int
    precio_base: Decimal
    orden: int
    vendido: bool


class SubastaCreate(BaseModel):
    nombre: str
    fecha_hora: datetime
    ubicacion: str
    categoria_minima: CategoriaUsuario = CategoriaUsuario.COMUN
    moneda: Moneda = Moneda.ARS
    rematador_id: int
    es_coleccion: bool = False
    nombre_coleccion: str | None = None


class SubastaCambioEstado(BaseModel):
    estado: EstadoSubasta


class SubastaOut(ORMBase):
    id: int
    nombre: str
    fecha_hora: datetime
    ubicacion: str
    categoria_minima: CategoriaUsuario
    moneda: Moneda
    estado: EstadoSubasta
    rematador_id: int
    es_coleccion: bool
    nombre_coleccion: str | None = None
    catalogo: list[CatalogoItemOut] = []


class CatalogoPublicoItem(ORMBase):
    """Ítem visible públicamente (sin precio base)."""

    id: int
    articulo_id: int
    orden: int
    vendido: bool


class SubastaPublicaOut(ORMBase):
    id: int
    nombre: str
    fecha_hora: datetime
    ubicacion: str
    categoria_minima: CategoriaUsuario
    moneda: Moneda
    estado: EstadoSubasta
    catalogo: list[CatalogoPublicoItem] = []
