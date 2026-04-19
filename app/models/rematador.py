from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Rematador(Base):
    """Martillero. Legacy: tabla del sistema existente, recreada aquí."""

    __tablename__ = "rematadores"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(80))
    apellido: Mapped[str] = mapped_column(String(80))
    matricula: Mapped[str] = mapped_column(String(40), unique=True)

    subastas = relationship("Subasta", back_populates="rematador")
