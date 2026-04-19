from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import CategoriaUsuario, EstadoSubasta, Moneda


class Subasta(Base):
    __tablename__ = "subastas"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(160))
    fecha_hora: Mapped[datetime] = mapped_column(DateTime)
    ubicacion: Mapped[str] = mapped_column(String(250))
    categoria_minima: Mapped[CategoriaUsuario] = mapped_column(
        Enum(CategoriaUsuario), default=CategoriaUsuario.COMUN
    )
    moneda: Mapped[Moneda] = mapped_column(Enum(Moneda), default=Moneda.ARS)
    estado: Mapped[EstadoSubasta] = mapped_column(Enum(EstadoSubasta), default=EstadoSubasta.PROGRAMADA)
    rematador_id: Mapped[int] = mapped_column(ForeignKey("rematadores.id"))
    es_coleccion: Mapped[bool] = mapped_column(default=False)
    nombre_coleccion: Mapped[str | None] = mapped_column(String(160), default=None)

    rematador = relationship("Rematador", back_populates="subastas")
    catalogo = relationship("CatalogoItem", back_populates="subasta", cascade="all, delete-orphan")
    pujas = relationship("Puja", back_populates="subasta")


class CatalogoItem(Base):
    """Relación N:M entre subasta y artículos con precio base para esa subasta."""

    __tablename__ = "catalogo_items"
    __table_args__ = (UniqueConstraint("subasta_id", "articulo_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    subasta_id: Mapped[int] = mapped_column(ForeignKey("subastas.id"))
    articulo_id: Mapped[int] = mapped_column(ForeignKey("articulos.id"))
    precio_base: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    orden: Mapped[int] = mapped_column(default=0)
    vendido: Mapped[bool] = mapped_column(default=False)

    subasta = relationship("Subasta", back_populates="catalogo")
    articulo = relationship("Articulo", back_populates="catalogos")
    pujas = relationship("Puja", back_populates="catalogo_item")
