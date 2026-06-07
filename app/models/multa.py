from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Multa(Base):
    """Multa del 10% por impago de una oferta ganadora."""

    __tablename__ = "multas"

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    venta_id: Mapped[int | None] = mapped_column(ForeignKey("ventas.id"), default=None)
    monto: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    moneda: Mapped[str] = mapped_column(String(3), default="ARS")
    motivo: Mapped[str] = mapped_column(String(250))
    pagada: Mapped[bool] = mapped_column(Boolean, default=False)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    # El usuario tiene 72hs para presentar los fondos; vencido e impago, el caso
    # se deriva a la justicia y queda fuera del alcance de la app.
    fecha_vencimiento: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    derivada_justicia: Mapped[bool] = mapped_column(Boolean, default=False)

    usuario = relationship("Usuario", back_populates="multas")
