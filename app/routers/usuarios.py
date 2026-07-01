from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CuentaCobro, EstadoRegistro, Usuario
from app.services.auth import hash_password, verify_password
from app.services.categorias import recalcular_categoria
from app.schemas.usuario import (
    CambiarEmailPayload,
    CambiarPasswordPayload,
    CuentaCobroCreate,
    CuentaCobroOut,
    UsuarioAprobacion,
    UsuarioLogin,
    UsuarioOut,
    UsuarioRegistroEtapa1,
    UsuarioRegistroEtapa2,
)

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])


@router.post(
    "/registro/etapa-1",
    response_model=UsuarioOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar datos iniciales del postor (etapa 1)",
)
def registrar_etapa_1(payload: UsuarioRegistroEtapa1, db: Session = Depends(get_db)):
    if db.query(Usuario).filter(Usuario.email == payload.email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email ya registrado")
    usuario = Usuario(**payload.model_dump())
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


@router.post(
    "/{usuario_id}/aprobacion",
    response_model=UsuarioOut,
    summary="La empresa aprueba y asigna categoría tras la verificación externa",
)
def aprobar_usuario(usuario_id: int, payload: UsuarioAprobacion, db: Session = Depends(get_db)):
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    usuario.categoria = payload.categoria
    usuario.estado_registro = EstadoRegistro.APROBADO_FASE_1
    db.commit()
    db.refresh(usuario)
    return usuario


@router.post(
    "/{usuario_id}/registro/etapa-2",
    response_model=UsuarioOut,
    summary="Postor completa el registro y genera su clave (etapa 2)",
)
def registrar_etapa_2(
    usuario_id: int, payload: UsuarioRegistroEtapa2, db: Session = Depends(get_db)
):
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    if usuario.estado_registro != EstadoRegistro.APROBADO_FASE_1:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "El usuario aún no fue aprobado en etapa 1"
        )
    usuario.password_hash = hash_password(payload.password)
    usuario.estado_registro = EstadoRegistro.COMPLETO
    db.commit()
    db.refresh(usuario)
    return usuario


@router.post(
    "/{usuario_id}/recategorizar",
    response_model=UsuarioOut,
    summary="Recalcula la categoría según diversidad de medios de pago y actividad",
)
def recategorizar_usuario(usuario_id: int, db: Session = Depends(get_db)):
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    recalcular_categoria(db, usuario)
    db.refresh(usuario)
    return usuario


@router.post(
    "/login",
    response_model=UsuarioOut,
    summary="Autenticar usuario con email y contraseña",
)
def login(payload: UsuarioLogin, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.email == payload.email).first()
    if usuario is None or not verify_password(payload.password, usuario.password_hash or ""):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email o contraseña incorrectos")
    if usuario.estado_registro != EstadoRegistro.COMPLETO:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "El registro no está completo")
    if usuario.bloqueado_por_impago:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cuenta suspendida por multa impaga")
    return usuario


@router.get("", response_model=list[UsuarioOut], summary="Listar usuarios")
def listar_usuarios(db: Session = Depends(get_db)):
    return db.query(Usuario).all()


@router.get("/{usuario_id}", response_model=UsuarioOut, summary="Obtener usuario por id")
def obtener_usuario(usuario_id: int, db: Session = Depends(get_db)):
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    return usuario


@router.patch(
    "/{usuario_id}/cambiar-password",
    response_model=UsuarioOut,
    summary="Cambiar la contraseña del usuario",
)
def cambiar_password(
    usuario_id: int, payload: CambiarPasswordPayload, db: Session = Depends(get_db)
):
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    if not verify_password(payload.password_actual, usuario.password_hash or ""):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Contraseña actual incorrecta")
    usuario.password_hash = hash_password(payload.password_nueva)
    db.commit()
    db.refresh(usuario)
    return usuario


@router.patch(
    "/{usuario_id}/cambiar-email",
    response_model=UsuarioOut,
    summary="Cambiar el email del usuario",
)
def cambiar_email(
    usuario_id: int, payload: CambiarEmailPayload, db: Session = Depends(get_db)
):
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    if (
        db.query(Usuario)
        .filter(Usuario.email == payload.email_nuevo, Usuario.id != usuario_id)
        .first()
    ):
        raise HTTPException(status.HTTP_409_CONFLICT, "El email ya está en uso por otro usuario")
    usuario.email = payload.email_nuevo
    db.commit()
    db.refresh(usuario)
    return usuario


@router.post(
    "/{usuario_id}/cuentas-cobro",
    response_model=CuentaCobroOut,
    status_code=status.HTTP_201_CREATED,
    summary="Declarar cuenta a la vista para liquidar ventas",
)
def crear_cuenta_cobro(
    usuario_id: int, payload: CuentaCobroCreate, db: Session = Depends(get_db)
):
    if db.get(Usuario, usuario_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    cuenta = CuentaCobro(usuario_id=usuario_id, **payload.model_dump())
    db.add(cuenta)
    db.commit()
    db.refresh(cuenta)
    return cuenta


@router.get(
    "/{usuario_id}/cuentas-cobro",
    response_model=list[CuentaCobroOut],
    summary="Listar cuentas de cobro del usuario",
)
def listar_cuentas_cobro(usuario_id: int, db: Session = Depends(get_db)):
    return db.query(CuentaCobro).filter(CuentaCobro.usuario_id == usuario_id).all()
