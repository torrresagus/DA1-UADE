from datetime import datetime
from decimal import Decimal

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import EstadoArticulo


seguros_articulos = Table(
    "seguros_articulos",
    Base.metadata,
    Column("seguro_id", Integer, ForeignKey("seguros.id"), primary_key=True),
    Column("articulo_id", Integer, ForeignKey("articulos.id"), primary_key=True),
)


class Articulo(Base):
    """Pieza / Ítem de catálogo. Puede estar compuesta por varios elementos."""

    __tablename__ = "articulos"

    id: Mapped[int] = mapped_column(primary_key=True)
    numero_pieza: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    descripcion: Mapped[str] = mapped_column(Text)
    precio_base: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    moneda: Mapped[str] = mapped_column(String(3), default="ARS")
    dueno_actual_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"), default=None)
    artista: Mapped[str | None] = mapped_column(String(160), default=None)
    fecha_obra: Mapped[str | None] = mapped_column(String(40), default=None)
    historia: Mapped[str | None] = mapped_column(Text, default=None)
    cantidad_elementos: Mapped[int] = mapped_column(default=1)
    estado: Mapped[EstadoArticulo] = mapped_column(Enum(EstadoArticulo), default=EstadoArticulo.DISPONIBLE)
    deposito_id: Mapped[int | None] = mapped_column(ForeignKey("depositos.id"), default=None)

    imagenes = relationship("ImagenArticulo", back_populates="articulo", cascade="all, delete-orphan")
    deposito = relationship("Deposito", back_populates="articulos")
    seguros = relationship("Seguro", secondary=seguros_articulos, back_populates="articulos")
    catalogos = relationship("CatalogoItem", back_populates="articulo")


class ImagenArticulo(Base):
    __tablename__ = "imagenes_articulo"

    id: Mapped[int] = mapped_column(primary_key=True)
    articulo_id: Mapped[int] = mapped_column(ForeignKey("articulos.id"))
    url: Mapped[str] = mapped_column(String(500))
    orden: Mapped[int] = mapped_column(default=0)

    articulo = relationship("Articulo", back_populates="imagenes")


class Deposito(Base):
    __tablename__ = "depositos"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120))
    direccion: Mapped[str] = mapped_column(String(250))
    ciudad: Mapped[str] = mapped_column(String(120))

    articulos = relationship("Articulo", back_populates="deposito")


class Seguro(Base):
    """Póliza que cubre una o más piezas del mismo dueño."""

    __tablename__ = "seguros"

    id: Mapped[int] = mapped_column(primary_key=True)
    nro_poliza: Mapped[str] = mapped_column(String(60), unique=True)
    compania: Mapped[str] = mapped_column(String(120))
    beneficiario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    monto_cubierto: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    moneda: Mapped[str] = mapped_column(String(3), default="ARS")
    vigente_desde: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    articulos = relationship("Articulo", secondary=seguros_articulos, back_populates="seguros")
