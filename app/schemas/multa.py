from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.common import ORMBase


class MultaCreate(BaseModel):
    usuario_id: int
    venta_id: int | None = None
    monto: Decimal
    moneda: str = "ARS"
    motivo: str


class MultaOut(ORMBase):
    id: int
    usuario_id: int
    venta_id: int | None
    monto: Decimal
    moneda: str
    motivo: str
    pagada: bool
    fecha: datetime
    fecha_vencimiento: datetime | None = None
    derivada_justicia: bool = False
