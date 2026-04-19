from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import EstadoSolicitud


class SolicitudSubasta(Base):
    """Pedido de un usuario para incluir un bien en una futura subasta."""

    __tablename__ = "solicitudes_subasta"

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    descripcion: Mapped[str] = mapped_column(Text)
    datos_historicos: Mapped[str | None] = mapped_column(Text, default=None)
    declara_propiedad: Mapped[bool] = mapped_column(Boolean, default=False)
    origen_licito_acreditado: Mapped[bool] = mapped_column(Boolean, default=False)
    acepta_devolucion_con_cargo: Mapped[bool] = mapped_column(Boolean, default=False)
    estado: Mapped[EstadoSolicitud] = mapped_column(Enum(EstadoSolicitud), default=EstadoSolicitud.INGRESADA)
    motivo_rechazo: Mapped[str | None] = mapped_column(Text, default=None)
    precio_base_propuesto: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), default=None)
    comision_propuesta: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), default=None)
    fecha_subasta_propuesta: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    usuario = relationship("Usuario", back_populates="solicitudes")
    imagenes = relationship("ImagenSolicitud", back_populates="solicitud", cascade="all, delete-orphan")


class ImagenSolicitud(Base):
    __tablename__ = "imagenes_solicitud"

    id: Mapped[int] = mapped_column(primary_key=True)
    solicitud_id: Mapped[int] = mapped_column(ForeignKey("solicitudes_subasta.id"))
    url: Mapped[str] = mapped_column(String(500))
    orden: Mapped[int] = mapped_column(default=0)

    solicitud = relationship("SolicitudSubasta", back_populates="imagenes")
