import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

from fastapi import APIRouter, Cookie, Depends, Form, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import EstadoRegistro, EstadoSolicitud, SolicitudSubasta, Usuario
from app.routers.notificaciones import crear_notificacion

_ADMIN_USER = "admin"
_ADMIN_PASS = "bidify2026"
_ADMIN_TOKEN = hashlib.sha256(f"{_ADMIN_USER}:{_ADMIN_PASS}".encode()).hexdigest()

_BA_TZ = timezone(timedelta(hours=-3))  # America/Argentina/Buenos_Aires


def _to_ba(dt: datetime | None) -> datetime | None:
    """Convierte un datetime naive UTC a Buenos Aires (UTC-3) para mostrar en templates."""
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc).astimezone(_BA_TZ)


_templates = Jinja2Templates(
    directory=str(Path(__file__).parent.parent.parent / "templates")
)
_templates.env.filters["to_ba"] = _to_ba

router = APIRouter(prefix="/admin", tags=["Admin"])

_ESTADOS_CUENTAS_FILTRO = [
    ("pendiente", "Pendientes de aprobación"),
    ("aprobadas", "Aprobadas (fase 1)"),
    ("completas", "Completas"),
    ("bloqueadas", "Bloqueadas"),
]

_ESTADOS_FILTRO = [
    ("ingresada", "Recién ingresadas"),
    ("en_inspeccion", "Pendientes de revisión"),
    ("aceptada", "Aceptadas (esperando usuario)"),
    ("rechazada", "Rechazadas"),
    ("confirmada_por_usuario", "Confirmadas"),
    ("rechazada_por_usuario", "Rechazadas por usuario"),
]


def _check_admin(bidify_admin_token: str | None = Cookie(default=None)) -> None:
    if bidify_admin_token != _ADMIN_TOKEN:
        raise HTTPException(status_code=303, headers={"Location": "/admin/login"})


def _extraer_precio_sugerido(descripcion: str | None) -> Decimal:
    if descripcion:
        m = re.search(r"\(precio sugerido: ([\d.]+)\)", descripcion)
        if m:
            try:
                return Decimal(m.group(1).replace(".", ""))
            except Exception:
                pass
    return Decimal("150000")


# ── Auth ──────────────────────────────────────────────────────────────────────

@router.get("/login", response_class=HTMLResponse)
def admin_login_page(request: Request):
    return _templates.TemplateResponse(
        "admin/login.html", {"request": request, "error": None}
    )


@router.post("/login")
def admin_login(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
):
    ok_user = secrets.compare_digest(username.encode(), _ADMIN_USER.encode())
    ok_pass = secrets.compare_digest(password.encode(), _ADMIN_PASS.encode())
    if ok_user and ok_pass:
        response = RedirectResponse(url="/admin", status_code=303)
        response.set_cookie("bidify_admin_token", _ADMIN_TOKEN, httponly=True, samesite="lax")
        return response
    return _templates.TemplateResponse(
        "admin/login.html",
        {"request": request, "error": "Usuario o contraseña incorrectos."},
        status_code=401,
    )


@router.get("/logout")
def admin_logout():
    response = RedirectResponse(url="/admin/login", status_code=303)
    response.delete_cookie("bidify_admin_token")
    return response


# ── Panel ─────────────────────────────────────────────────────────────────────

@router.get("", response_class=HTMLResponse)
def admin_lista(
    request: Request,
    estado: str | None = None,
    db: Session = Depends(get_db),
    _: None = Depends(_check_admin),
):
    estado_filtro = estado or "ingresada"
    try:
        estado_enum = EstadoSolicitud[estado_filtro.upper()]
        solicitudes = (
            db.query(SolicitudSubasta)
            .filter(SolicitudSubasta.estado == estado_enum)
            .order_by(SolicitudSubasta.fecha.desc())
            .all()
        )
    except KeyError:
        solicitudes = []
    return _templates.TemplateResponse(
        "admin/lista.html",
        {
            "request": request,
            "solicitudes": solicitudes,
            "estado_filtro": estado_filtro,
            "estados_filtro": _ESTADOS_FILTRO,
        },
    )


@router.get("/solicitudes/{solicitud_id}", response_class=HTMLResponse)
def admin_detalle(
    solicitud_id: int,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(_check_admin),
):
    s = db.get(SolicitudSubasta, solicitud_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
    precio_sugerido = _extraer_precio_sugerido(s.descripcion)
    comision_sugerida = (precio_sugerido * Decimal("0.10")).quantize(Decimal("0.01"))
    # Sugerimos hora local (UTC-3) para que el admin la vea y la ingrese en su zona horaria.
    fecha_sugerida = (datetime.utcnow() - timedelta(hours=3) + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M")
    return _templates.TemplateResponse(
        "admin/detalle.html",
        {
            "request": request,
            "s": s,
            "precio_sugerido": precio_sugerido,
            "comision_sugerida": comision_sugerida,
            "fecha_sugerida": fecha_sugerida,
        },
    )


@router.post("/solicitudes/{solicitud_id}/iniciar-inspeccion")
def admin_iniciar_inspeccion(
    solicitud_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(_check_admin),
):
    s = db.get(SolicitudSubasta, solicitud_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
    if s.estado != EstadoSolicitud.INGRESADA:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La solicitud no está en estado INGRESADA")
    s.estado = EstadoSolicitud.EN_INSPECCION
    crear_notificacion(
        db,
        usuario_id=s.usuario_id,
        tipo="solicitud",
        titulo="Tu bien está siendo inspeccionado",
        cuerpo=(
            "Nuestros expertos verificarán su autenticidad "
            "y estado de conservación. Te avisamos cuando tengamos novedades."
        ),
    )
    db.commit()
    return RedirectResponse(url=f"/admin/solicitudes/{solicitud_id}", status_code=303)


@router.post("/solicitudes/{solicitud_id}/resolver")
def admin_resolver(
    solicitud_id: int,
    accion: str = Form(...),
    precio_base_propuesto: str = Form(""),
    comision_propuesta: str = Form(""),
    fecha_subasta_propuesta: str = Form(""),
    motivo_rechazo: str = Form(""),
    db: Session = Depends(get_db),
    _: None = Depends(_check_admin),
):
    s = db.get(SolicitudSubasta, solicitud_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")

    # No permitir sobrescribir solicitudes que el usuario ya respondió (evita estado inconsistente).
    if s.estado in (EstadoSolicitud.CONFIRMADA_POR_USUARIO, EstadoSolicitud.RECHAZADA_POR_USUARIO):
        return RedirectResponse(url=f"/admin/solicitudes/{solicitud_id}", status_code=303)

    if accion == "aceptar":
        try:
            precio = (
                Decimal(precio_base_propuesto.replace(".", "").replace(",", "."))
                if precio_base_propuesto.strip()
                else Decimal("150000")
            )
        except Exception:
            precio = Decimal("150000")
        try:
            comision = (
                Decimal(comision_propuesta.replace(".", "").replace(",", "."))
                if comision_propuesta.strip()
                else (precio * Decimal("0.10")).quantize(Decimal("0.01"))
            )
        except Exception:
            comision = (precio * Decimal("0.10")).quantize(Decimal("0.01"))
        try:
            # El admin ingresa hora local (GMT-3); convertimos a UTC sumando 3h para
            # que el scheduler (que compara con utcnow()) lo abra en el momento correcto.
            fecha = (
                datetime.fromisoformat(fecha_subasta_propuesta) + timedelta(hours=3)
                if fecha_subasta_propuesta.strip()
                else datetime.utcnow() + timedelta(days=1)
            )
        except Exception:
            fecha = datetime.utcnow() + timedelta(days=1)

        s.estado = EstadoSolicitud.ACEPTADA
        s.precio_base_propuesto = precio
        s.comision_propuesta = comision
        s.fecha_subasta_propuesta = fecha
        crear_notificacion(
            db,
            usuario_id=s.usuario_id,
            tipo="solicitud",
            titulo="Tu bien fue aceptado",
            cuerpo=(
                f"Valor base propuesto: ${precio:,.0f}, "
                f"comisión: ${comision:,.2f}. Ingresá para aceptar o rechazar."
            ),
        )
    else:
        s.estado = EstadoSolicitud.RECHAZADA
        s.motivo_rechazo = motivo_rechazo.strip() or "Sin especificar"
        crear_notificacion(
            db,
            usuario_id=s.usuario_id,
            tipo="solicitud",
            titulo="Tu bien fue rechazado",
            cuerpo=f"Motivo: {s.motivo_rechazo}. El bien se devuelve con cargo.",
        )

    db.commit()
    return RedirectResponse(url="/admin", status_code=303)


# ── Cuentas ───────────────────────────────────────────────────────────────────

_ESTADO_REGISTRO_MAP = {
    "pendiente":  EstadoRegistro.PENDIENTE_VERIFICACION,
    "aprobadas":  EstadoRegistro.APROBADO_FASE_1,
    "completas":  EstadoRegistro.COMPLETO,
    "bloqueadas": EstadoRegistro.BLOQUEADO,
}


@router.get("/cuentas", response_class=HTMLResponse)
def admin_cuentas(
    request: Request,
    estado: str | None = None,
    db: Session = Depends(get_db),
    _: None = Depends(_check_admin),
):
    estado_filtro = estado or "pendiente"
    estado_enum = _ESTADO_REGISTRO_MAP.get(estado_filtro)
    if estado_enum:
        usuarios = (
            db.query(Usuario)
            .filter(Usuario.estado_registro == estado_enum)
            .filter(Usuario.id != 5)  # excluir empresa interna
            .order_by(Usuario.fecha_alta.desc())
            .all()
        )
    else:
        usuarios = []
    return _templates.TemplateResponse(
        "admin/cuentas.html",
        {
            "request": request,
            "usuarios": usuarios,
            "estado_filtro": estado_filtro,
            "estados_filtro": _ESTADOS_CUENTAS_FILTRO,
        },
    )


@router.post("/usuarios/{usuario_id}/aprobar")
def admin_aprobar_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(_check_admin),
):
    u = db.get(Usuario, usuario_id)
    if u is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    if u.estado_registro != EstadoRegistro.PENDIENTE_VERIFICACION:
        return RedirectResponse(url="/admin/cuentas", status_code=303)
    u.estado_registro = EstadoRegistro.APROBADO_FASE_1
    crear_notificacion(
        db,
        usuario_id=u.id,
        tipo="registro",
        titulo="¡Tu identidad fue verificada!",
        cuerpo="Tu documentación fue aprobada. Ya podés ingresar a la app y crear tu contraseña.",
    )
    db.commit()
    return RedirectResponse(url="/admin/cuentas", status_code=303)


@router.post("/usuarios/{usuario_id}/rechazar")
def admin_rechazar_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(_check_admin),
):
    u = db.get(Usuario, usuario_id)
    if u is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    if u.estado_registro != EstadoRegistro.PENDIENTE_VERIFICACION:
        return RedirectResponse(url="/admin/cuentas", status_code=303)
    u.estado_registro = EstadoRegistro.BLOQUEADO
    crear_notificacion(
        db,
        usuario_id=u.id,
        tipo="registro",
        titulo="Tu solicitud de registro fue rechazada",
        cuerpo="Tu documentación no pudo ser verificada. Contactate con soporte para más información.",
    )
    db.commit()
    return RedirectResponse(url="/admin/cuentas", status_code=303)
