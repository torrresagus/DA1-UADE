from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models.enums import EstadoPuja
from app.schemas.common import ORMBase


class PujaCreate(BaseModel):
    catalogo_item_id: int
    usuario_id: int
    monto: Decimal


class PujaOut(ORMBase):
    id: int
    subasta_id: int
    catalogo_item_id: int
    usuario_id: int
    monto: Decimal
    fecha_hora: datetime
    estado: EstadoPuja


class MejorOferta(BaseModel):
    catalogo_item_id: int
    mejor_monto: Decimal | None = None
    usuario_id: int | None = None
    minimo_proxima: Decimal
    maximo_proxima: Decimal | None = None
