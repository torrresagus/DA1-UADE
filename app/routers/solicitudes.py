"""FLUJO — Solicitudes de venta de bienes (el usuario ofrece un bien a la empresa).

`crear_solicitud`: carga con >=6 fotos, declaración de propiedad (obligatoria) y origen
lícito; si no se acredita el origen se marca para revisión y se AVISA A LAS AUTORIDADES
(`_avisar_autoridades`). Máquina de estados (automatizada en [../services/cierre.py]):
INGRESADA → EN_INSPECCION. `resolver_solicitud` (empresa): acepta con precio base + comisión
+ fecha, o rechaza con motivo e informa gastos de devolución. `responder_solicitud` (usuario):
si acepta se crea el artículo, su seguro y la subasta (agrupando en COLECCIÓN si ya hay bienes
suyos); si rechaza, se informan los gastos de devolución.
"""
import logging
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings

logger = logging.getLogger("bidify.cumplimiento")
from app.database import get_db
from app.models import (
    Articulo,
    CatalogoItem,
    Deposito,
    EstadoArticulo,
    EstadoSolicitud,
    EstadoSubasta,
    ImagenArticulo,
    ImagenSolicitud,
    Rematador,
    Seguro,
    SolicitudSubasta,
    Subasta,
    Usuario,
)
from app.routers.notificaciones import crear_notificacion
from app.schemas.solicitud import (
    SolicitudCreate,
    SolicitudOut,
    SolicitudResolucion,
    SolicitudRespuestaUsuario,
)


def _get_deposito_central(db: Session) -> Deposito:
    dep = db.query(Deposito).filter(Deposito.nombre == settings.deposito_nombre).first()
    if dep is None:
        dep = Deposito(
            nombre=settings.deposito_nombre,
            direccion=settings.deposito_direccion,
            ciudad=settings.deposito_ciudad,
        )
        db.add(dep)
        db.flush()
    return dep


def _avisar_autoridades(sol: SolicitudSubasta) -> None:
    """Ante dudas sobre el origen de un bien, la empresa avisa a las autoridades.

    Se deja registro (log/auditoría) y se marca la solicitud como avisada.
    """
    logger.warning(
        "AVISO A AUTORIDADES — solicitud #%s (usuario %s): origen lícito NO acreditado. %s",
        sol.id,
        sol.usuario_id,
        f"Documentación: {sol.origen_documentacion_url}" if sol.origen_documentacion_url else "Sin documentación adjunta.",
    )
    sol.autoridad_avisada = True


def _get_rematador_default(db: Session) -> Rematador:
    r = db.query(Rematador).first()
    if r is None:
        r = Rematador(nombre="Bidify", apellido="Rematador", matricula="BIDIFY-AUTO-001")
        db.add(r)
        db.flush()
    return r

router = APIRouter(prefix="/solicitudes", tags=["Solicitudes de subasta"])


@router.post(
    "/{usuario_id}",
    response_model=SolicitudOut,
    status_code=status.HTTP_201_CREATED,
    summary="Postor solicita incluir un bien en una futura subasta",
)
def crear_solicitud(
    usuario_id: int, payload: SolicitudCreate, db: Session = Depends(get_db)
):
    if db.get(Usuario, usuario_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    if not payload.declara_propiedad:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Debe declarar que el bien le pertenece y no tiene impedimentos",
        )
    if not payload.acepta_devolucion_con_cargo:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Debe aceptar que la devolución (si corresponde) corre por su cuenta",
        )
    data = payload.model_dump()
    imagenes = data.pop("imagenes", [])
    sol = SolicitudSubasta(usuario_id=usuario_id, **data)
    # Si no se acreditó el origen lícito, marcar para revisión y avisar a las autoridades.
    sol.revisar_origen = not payload.origen_licito_acreditado
    db.add(sol)
    db.flush()  # necesitamos sol.id para el aviso
    if sol.revisar_origen:
        _avisar_autoridades(sol)
    for img in imagenes:
        sol.imagenes.append(ImagenSolicitud(**img))
    db.commit()
    db.refresh(sol)
    return sol


@router.get("/{solicitud_id}", response_model=SolicitudOut)
def obtener_solicitud(solicitud_id: int, db: Session = Depends(get_db)):
    s = db.get(SolicitudSubasta, solicitud_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
    return s


@router.get("", response_model=list[SolicitudOut])
def listar_solicitudes(
    estado: EstadoSolicitud | None = None, db: Session = Depends(get_db)
):
    q = db.query(SolicitudSubasta)
    if estado is not None:
        q = q.filter(SolicitudSubasta.estado == estado)
    return q.order_by(SolicitudSubasta.fecha.desc()).all()


@router.post(
    "/{solicitud_id}/resolver",
    response_model=SolicitudOut,
    summary="La empresa acepta o rechaza la solicitud tras la inspección",
)
def resolver_solicitud(
    solicitud_id: int, payload: SolicitudResolucion, db: Session = Depends(get_db)
):
    s = db.get(SolicitudSubasta, solicitud_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
    s.estado = payload.estado
    if payload.motivo_rechazo is not None:
        s.motivo_rechazo = payload.motivo_rechazo
    if payload.precio_base_propuesto is not None:
        s.precio_base_propuesto = payload.precio_base_propuesto
    if payload.comision_propuesta is not None:
        s.comision_propuesta = payload.comision_propuesta
    if payload.fecha_subasta_propuesta is not None:
        s.fecha_subasta_propuesta = payload.fecha_subasta_propuesta
    # Avisar al usuario la resolución (aceptada con condiciones, o rechazada con causas).
    if s.estado == EstadoSolicitud.ACEPTADA:
        crear_notificacion(
            db,
            usuario_id=s.usuario_id,
            tipo="solicitud",
            titulo="Tu bien fue aceptado",
            cuerpo=(
                f"Valor base propuesto: {s.precio_base_propuesto}, "
                f"comisión: {s.comision_propuesta}. Ingresá para aceptar o rechazar."
            ),
        )
    elif s.estado == EstadoSolicitud.RECHAZADA:
        # El bien se devuelve con cargo: se informan los gastos de devolución.
        s.gastos_devolucion = Decimal(settings.gastos_devolucion_base)
        crear_notificacion(
            db,
            usuario_id=s.usuario_id,
            tipo="solicitud",
            titulo="Tu bien fue rechazado",
            cuerpo=(
                f"Motivo: {s.motivo_rechazo or 'sin especificar'}. "
                f"El bien se devuelve con cargo (gastos de devolución: {s.gastos_devolucion})."
            ),
        )
    db.commit()
    db.refresh(s)
    return s


@router.post(
    "/{solicitud_id}/responder",
    response_model=SolicitudOut,
    summary="El usuario acepta o rechaza el valor base y las comisiones propuestas",
)
def responder_solicitud(
    solicitud_id: int, payload: SolicitudRespuestaUsuario, db: Session = Depends(get_db)
):
    s = db.get(SolicitudSubasta, solicitud_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
    if s.estado != EstadoSolicitud.ACEPTADA:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Solo se puede responder una solicitud aceptada por la empresa",
        )
    s.respuesta_usuario = payload.acepta
    if payload.acepta:
        s.estado = EstadoSolicitud.CONFIRMADA_POR_USUARIO

        # Crear el artículo a partir de los datos de la solicitud.
        precio = Decimal(s.precio_base_propuesto)
        deposito = _get_deposito_central(db)
        articulo = Articulo(
            numero_pieza=f"SOL-{s.id}",
            descripcion=s.descripcion,
            historia=s.datos_historicos,
            precio_base=precio,
            moneda="ARS",
            dueno_actual_id=s.usuario_id,
            estado=EstadoArticulo.EN_SUBASTA,
            deposito_id=deposito.id,
            cantidad_elementos=s.cantidad_elementos,
        )
        db.add(articulo)
        db.flush()

        # Copiar las fotos de la solicitud al artículo.
        for img in s.imagenes:
            db.add(ImagenArticulo(articulo_id=articulo.id, url=img.url, orden=img.orden))

        # Seguro automático para el artículo.
        seguro = Seguro(
            nro_poliza=f"POL-SOL-{s.id}",
            compania=settings.seguro_compania,
            beneficiario_id=s.usuario_id,
            monto_cubierto=precio,
            moneda="ARS",
        )
        seguro.articulos = [articulo]
        db.add(seguro)

        # Collection auction: if a PROGRAMADA subasta already has articles from this
        # user, merge the new one into it (the company groups lots by consignor).
        # Si se pidió inicio inmediato, siempre se crea una subasta nueva ABIERTA.
        existing_subasta = None
        if not payload.iniciar_inmediatamente:
            existing_subasta = (
                db.query(Subasta)
                .join(CatalogoItem, CatalogoItem.subasta_id == Subasta.id)
                .join(Articulo, Articulo.id == CatalogoItem.articulo_id)
                .filter(
                    Subasta.estado == EstadoSubasta.PROGRAMADA,
                    Articulo.dueno_actual_id == s.usuario_id,
                )
                .first()
            )

        if existing_subasta:
            existing_subasta.es_coleccion = True
            if not existing_subasta.nombre_coleccion:
                usuario_obj = db.get(Usuario, s.usuario_id)
                existing_subasta.nombre_coleccion = (
                    f"Colección de {usuario_obj.nombre} {usuario_obj.apellido}"
                    if usuario_obj else "Colección"
                )
            db.add(CatalogoItem(
                subasta_id=existing_subasta.id,
                articulo_id=articulo.id,
                precio_base=precio,
                orden=len(existing_subasta.catalogo) + 1,
            ))
            subasta = existing_subasta
            notif_titulo = "Bien añadido a tu colección"
            notif_cuerpo = (
                f"Tu bien se sumó a la colección \"{subasta.nombre_coleccion}\". "
                f"Subasta programada para el {subasta.fecha_hora.strftime('%d/%m/%Y') if subasta.fecha_hora else '—'}."
            )
        else:
            from datetime import datetime as _dt, timedelta as _td
            rematador = _get_rematador_default(db)
            if payload.iniciar_inmediatamente:
                # 2 minutos de ventana para pujar antes del cierre automático.
                fecha_subasta = _dt.utcnow() + _td(minutes=2)
                estado_subasta = EstadoSubasta.ABIERTA
            else:
                fecha_subasta = s.fecha_subasta_propuesta
                estado_subasta = EstadoSubasta.PROGRAMADA
            rematador = _get_rematador_default(db)
            subasta = Subasta(
                nombre=(s.descripcion or "Bien")[:100],
                fecha_hora=fecha_subasta,
                ubicacion="Bidify - Online",
                categoria_minima=payload.categoria_minima,
                moneda="ARS",
                estado=estado_subasta,
                rematador_id=rematador.id,
            )
            db.add(subasta)
            db.flush()
            db.add(CatalogoItem(
                subasta_id=subasta.id,
                articulo_id=articulo.id,
                precio_base=precio,
                orden=1,
            ))
            if payload.iniciar_inmediatamente:
                notif_titulo = "¡Tu subasta está activa!"
                notif_cuerpo = (
                    "Tu bien ya está en subasta ahora mismo. "
                    f"Categoría mínima: {payload.categoria_minima.value.capitalize()}. "
                    "Entrá al inicio de la app para verla en vivo."
                )
            else:
                notif_titulo = "¡Tu subasta fue programada!"
                notif_cuerpo = (
                    f"Tu bien estará en subasta el {s.fecha_subasta_propuesta.strftime('%d/%m/%Y') if s.fecha_subasta_propuesta else '—'}. "
                    f"Categoría mínima: {payload.categoria_minima.value.capitalize()}. "
                    "Ya aparece en el inicio de la app."
                )

        crear_notificacion(
            db,
            usuario_id=s.usuario_id,
            tipo="solicitud",
            titulo=notif_titulo,
            cuerpo=notif_cuerpo,
        )
    else:
        # No acepta valor/comisiones: se procede a la devolución informando gastos.
        s.estado = EstadoSolicitud.RECHAZADA_POR_USUARIO
        s.gastos_devolucion = Decimal(settings.gastos_devolucion_base)
        crear_notificacion(
            db,
            usuario_id=s.usuario_id,
            tipo="solicitud",
            titulo="Devolución de tu bien",
            cuerpo=(
                "No aceptaste el valor base / las comisiones propuestas. "
                f"Se procederá a la devolución del bien con un gasto de {s.gastos_devolucion}."
            ),
        )
    db.commit()
    db.refresh(s)
    return s
