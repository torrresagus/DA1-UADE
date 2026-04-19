import enum


class CategoriaUsuario(str, enum.Enum):
    COMUN = "comun"
    ESPECIAL = "especial"
    PLATA = "plata"
    ORO = "oro"
    PLATINO = "platino"


CATEGORIA_RANK = {
    CategoriaUsuario.COMUN: 1,
    CategoriaUsuario.ESPECIAL: 2,
    CategoriaUsuario.PLATA: 3,
    CategoriaUsuario.ORO: 4,
    CategoriaUsuario.PLATINO: 5,
}


class EstadoRegistro(str, enum.Enum):
    PENDIENTE_VERIFICACION = "pendiente_verificacion"
    APROBADO_FASE_1 = "aprobado_fase_1"
    COMPLETO = "completo"
    RECHAZADO = "rechazado"
    BLOQUEADO = "bloqueado"


class EstadoSubasta(str, enum.Enum):
    PROGRAMADA = "programada"
    ABIERTA = "abierta"
    CERRADA = "cerrada"
    CANCELADA = "cancelada"


class EstadoSolicitud(str, enum.Enum):
    INGRESADA = "ingresada"
    EN_INSPECCION = "en_inspeccion"
    ACEPTADA = "aceptada"
    RECHAZADA = "rechazada"
    DEVUELTA = "devuelta"


class EstadoArticulo(str, enum.Enum):
    DISPONIBLE = "disponible"
    EN_SUBASTA = "en_subasta"
    VENDIDO = "vendido"
    RETIRADO = "retirado"


class EstadoPuja(str, enum.Enum):
    PENDIENTE = "pendiente"
    CONFIRMADA = "confirmada"
    RECHAZADA = "rechazada"


class Moneda(str, enum.Enum):
    ARS = "ARS"
    USD = "USD"


class TipoMedioPago(str, enum.Enum):
    CUENTA_BANCARIA = "cuenta_bancaria"
    TARJETA_CREDITO = "tarjeta_credito"
    CHEQUE_CERTIFICADO = "cheque_certificado"


class EstadoMedioPago(str, enum.Enum):
    PENDIENTE = "pendiente"
    VERIFICADO = "verificado"
    RECHAZADO = "rechazado"
