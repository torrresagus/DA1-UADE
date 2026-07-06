from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models.enums import EstadoPuja
from app.schemas.common import ORMBase


class PujaCreate(BaseModel):
    catalogo_item_id: int
    usuario_id: int
    monto: Decimal
    retira_personalmente: bool = False
    # Medio de pago con el que cancelaría si gana (opcional pero recomendado).
    medio_pago_id: int | None = None


class PujaOut(ORMBase):
    id: int
    subasta_id: int
    catalogo_item_id: int
    usuario_id: int
    monto: Decimal
    fecha_hora: datetime
    estado: EstadoPuja
    retira_personalmente: bool
    medio_pago_id: int | None = None


class MejorOferta(BaseModel):
    catalogo_item_id: int
    mejor_monto: Decimal | None = None
    usuario_id: int | None = None
    minimo_proxima: Decimal
    maximo_proxima: Decimal | None = None
