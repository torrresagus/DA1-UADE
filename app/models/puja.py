from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import EstadoPuja


class Puja(Base):
    __tablename__ = "pujas"

    id: Mapped[int] = mapped_column(primary_key=True)
    subasta_id: Mapped[int] = mapped_column(ForeignKey("subastas.id"))
    catalogo_item_id: Mapped[int] = mapped_column(ForeignKey("catalogo_items.id"))
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    monto: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    fecha_hora: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    estado: Mapped[EstadoPuja] = mapped_column(Enum(EstadoPuja), default=EstadoPuja.CONFIRMADA)

    subasta = relationship("Subasta", back_populates="pujas")
    catalogo_item = relationship("CatalogoItem", back_populates="pujas")
    usuario = relationship("Usuario", back_populates="pujas")
