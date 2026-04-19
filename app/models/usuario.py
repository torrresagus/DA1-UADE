from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import CategoriaUsuario, EstadoRegistro


class Usuario(Base):
    """Postor / Cliente.

    Legacy: tabla integrada con el sistema local de la empresa, no se modifica
    desde esta app a nivel esquema. Se recrea aquí para poder ejecutar.
    """

    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(80))
    apellido: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), default=None)
    doc_frente_url: Mapped[str | None] = mapped_column(String(500), default=None)
    doc_dorso_url: Mapped[str | None] = mapped_column(String(500), default=None)
    domicilio: Mapped[str] = mapped_column(String(250))
    pais: Mapped[str] = mapped_column(String(80))
    categoria: Mapped[CategoriaUsuario] = mapped_column(
        Enum(CategoriaUsuario), default=CategoriaUsuario.COMUN
    )
    estado_registro: Mapped[EstadoRegistro] = mapped_column(
        Enum(EstadoRegistro), default=EstadoRegistro.PENDIENTE_VERIFICACION
    )
    bloqueado_por_impago: Mapped[bool] = mapped_column(Boolean, default=False)
    fecha_alta: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    medios_pago = relationship("MedioPago", back_populates="usuario", cascade="all, delete-orphan")
    pujas = relationship("Puja", back_populates="usuario")
    ventas = relationship("Venta", back_populates="comprador")
    solicitudes = relationship("SolicitudSubasta", back_populates="usuario")
    multas = relationship("Multa", back_populates="usuario")
    cuentas_cobro = relationship("CuentaCobro", back_populates="usuario", cascade="all, delete-orphan")


class CuentaCobro(Base):
    """Cuenta a la vista donde se deposita el resultado de artículos vendidos."""

    __tablename__ = "cuentas_cobro"

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    banco: Mapped[str] = mapped_column(String(120))
    pais: Mapped[str] = mapped_column(String(80))
    numero_cuenta: Mapped[str] = mapped_column(String(60))
    titular: Mapped[str] = mapped_column(String(160))
    declarada_antes_subasta: Mapped[bool] = mapped_column(Boolean, default=False)

    usuario = relationship("Usuario", back_populates="cuentas_cobro")
