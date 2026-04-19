from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Venta(Base):
    __tablename__ = "ventas"

    id: Mapped[int] = mapped_column(primary_key=True)
    catalogo_item_id: Mapped[int] = mapped_column(ForeignKey("catalogo_items.id"), unique=True)
    comprador_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    medio_pago_id: Mapped[int] = mapped_column(ForeignKey("medios_pago.id"))
    monto_final: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    comision: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    costo_envio: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    retira_personalmente: Mapped[bool] = mapped_column(Boolean, default=False)
    moneda: Mapped[str] = mapped_column(String(3), default="ARS")
    fecha: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    pagada: Mapped[bool] = mapped_column(Boolean, default=False)

    comprador = relationship("Usuario", back_populates="ventas")
    catalogo_item = relationship("CatalogoItem")
    medio_pago = relationship("MedioPago")
