from decimal import Decimal

from pydantic import BaseModel

from app.models.enums import EstadoMedioPago, TipoMedioPago
from app.schemas.common import ORMBase


class MedioPagoCreate(BaseModel):
    tipo: TipoMedioPago
    titular: str
    detalle: str
    pais: str
    monto_garantia: Decimal | None = None
    moneda: str | None = None


class MedioPagoVerificar(BaseModel):
    verificado: bool


class MedioPagoOut(ORMBase):
    id: int
    usuario_id: int
    tipo: TipoMedioPago
    titular: str
    detalle: str
    pais: str
    monto_garantia: Decimal | None = None
    moneda: str | None = None
    estado: EstadoMedioPago
    verificado: bool
