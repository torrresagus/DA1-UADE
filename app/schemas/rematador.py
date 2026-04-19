from pydantic import BaseModel

from app.schemas.common import ORMBase


class RematadorCreate(BaseModel):
    nombre: str
    apellido: str
    matricula: str


class RematadorOut(ORMBase):
    id: int
    nombre: str
    apellido: str
    matricula: str
