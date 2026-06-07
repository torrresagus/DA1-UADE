from datetime import datetime

from app.schemas.common import ORMBase


class NotificacionOut(ORMBase):
    id: int
    usuario_id: int
    tipo: str
    titulo: str
    cuerpo: str
    leida: bool
    fecha: datetime
