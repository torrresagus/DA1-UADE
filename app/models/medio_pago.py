from decimal import Decimal

from sqlalchemy import Boolean, Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import EstadoMedioPago, TipoMedioPago


class MedioPago(Base):
    __tablename__ = "medios_pago"

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    tipo: Mapped[TipoMedioPago] = mapped_column(Enum(TipoMedioPago))
    titular: Mapped[str] = mapped_column(String(160))
    detalle: Mapped[str] = mapped_column(String(255))  # últimos dígitos, CBU, etc.
    pais: Mapped[str] = mapped_column(String(80))
    monto_garantia: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), default=None)
    moneda: Mapped[str | None] = mapped_column(String(3), default=None)
    estado: Mapped[EstadoMedioPago] = mapped_column(
        Enum(EstadoMedioPago), default=EstadoMedioPago.PENDIENTE
    )
    verificado: Mapped[bool] = mapped_column(Boolean, default=False)

    usuario = relationship("Usuario", back_populates="medios_pago")
