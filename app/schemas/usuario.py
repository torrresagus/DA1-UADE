from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import CategoriaUsuario, EstadoRegistro
from app.schemas.common import ORMBase


class UsuarioRegistroEtapa1(BaseModel):
    nombre: str = Field(..., max_length=80)
    apellido: str = Field(..., max_length=80)
    email: EmailStr
    doc_frente_url: str | None = None
    doc_dorso_url: str | None = None
    domicilio: str
    pais: str


class UsuarioRegistroEtapa2(BaseModel):
    """El postor ingresa la app y genera su clave personal."""

    password: str = Field(..., min_length=8)


class UsuarioAprobacion(BaseModel):
    categoria: CategoriaUsuario


class UsuarioOut(ORMBase):
    id: int
    nombre: str
    apellido: str
    email: EmailStr
    domicilio: str
    pais: str
    categoria: CategoriaUsuario
    estado_registro: EstadoRegistro
    bloqueado_por_impago: bool
    fecha_alta: datetime


class CuentaCobroCreate(BaseModel):
    banco: str
    pais: str
    numero_cuenta: str
    titular: str
    declarada_antes_subasta: bool = False


class CuentaCobroOut(ORMBase):
    id: int
    usuario_id: int
    banco: str
    pais: str
    numero_cuenta: str
    titular: str
    declarada_antes_subasta: bool
