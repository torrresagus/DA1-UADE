import re
import secrets
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path

from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import EstadoSolicitud, SolicitudSubasta
from app.routers.notificaciones import crear_notificacion

_ADMIN_USER = "admin"
_ADMIN_PASS = "bidify2026"

_security = HTTPBasic()
_templates = Jinja2Templates(
    directory=str(Path(__file__).parent.parent.parent / "templates")
)

router = APIRouter(prefix="/admin", tags=["Admin"])


def _check_admin(credentials: HTTPBasicCredentials = Depends(_security)) -> None:
    ok_user = secrets.compare_digest(credentials.username.encode(), _ADMIN_USER.encode())
    ok_pass = secrets.compare_digest(credentials.password.encode(), _ADMIN_PASS.encode())
    if not (ok_user and ok_pass):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
            headers={"WWW-Authenticate": "Basic"},
        )


def _extraer_precio_sugerido(descripcion: str | None) -> Decimal:
    if descripcion:
        m = re.search(r"\(precio sugerido: ([\d.]+)\)", descripcion)
        if m:
            try:
                return Decimal(m.group(1).replace(".", ""))
            except Exception:
                pass
    return Decimal("150000")


_ESTADOS_FILTRO = [
    ("en_inspeccion", "Pendientes de revisión"),
    ("ingresada", "Recién ingresadas"),
    ("aceptada", "Aceptadas (esperando usuario)"),
    ("rechazada", "Rechazadas"),
    ("confirmada_por_usuario", "Confirmadas"),
    ("rechazada_por_usuario", "Rechazadas por usuario"),
]


@router.get("", response_class=HTMLResponse)
def admin_lista(
    request: Request,
    estado: str | None = None,
    db: Session = Depends(get_db),
    _: None = Depends(_check_admin),
):
    estado_filtro = estado or "en_inspeccion"
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
    fecha_sugerida = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M")
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
            fecha = (
                datetime.fromisoformat(fecha_subasta_propuesta)
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
