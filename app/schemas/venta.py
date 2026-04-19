from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.common import ORMBase


class VentaCreate(BaseModel):
    catalogo_item_id: int
    comprador_id: int
    medio_pago_id: int
    monto_final: Decimal
    comision: Decimal
    costo_envio: Decimal = Decimal("0")
    retira_personalmente: bool = False
    moneda: str = "ARS"


class VentaOut(ORMBase):
    id: int
    catalogo_item_id: int
    comprador_id: int
    medio_pago_id: int
    monto_final: Decimal
    comision: Decimal
    costo_envio: Decimal
    retira_personalmente: bool
    moneda: str
    fecha: datetime
    pagada: bool
