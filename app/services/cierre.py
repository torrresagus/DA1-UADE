"""Cierre automático de subastas vencidas, progresión de solicitudes y multas por impago.

Corre cada 15 segundos desde el scheduler de main.py:
  - Subastas ABIERTA con fecha_hora vencida → se cierran y generan Ventas.
  - Solicitudes INGRESADA con +30s → pasan a EN_INSPECCION.
  - Solicitudes EN_INSPECCION con +60s desde creación → pasan a ACEPTADA con propuesta.
  - Medios de pago PENDIENTE con +30s → pasan a VERIFICADO.
  - Ventas impagas de usuarios reales con +2min → generan Multa del 10% y bloquean al usuario.
"""
import re
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import (
    Articulo,
    CatalogoItem,
    CategoriaUsuario,
    CuentaCobro,
    EstadoArticulo,
    EstadoMedioPago,
    EstadoRegistro,
    EstadoSolicitud,
    EstadoSubasta,
    MedioPago,
    Multa,
    Notificacion,
    SolicitudSubasta,
    Subasta,
    Usuario,
    Venta,
)
from app.services.email import enviar_mail_completar_registro
from app.services.pujas import mejor_puja

_TIMER_SOLICITUD = timedelta(seconds=15)
# Gracia para pagar antes de generar multa. En producción sería horas/días;
# 1 minuto permite demostrarlo sin esperar.
_TIMER_IMPAGO = timedelta(minutes=1)


def _get_empresa(db: Session) -> Usuario:
    from app.config import settings
    empresa = db.query(Usuario).filter(Usuario.email == settings.empresa_email).first()
    if empresa is None:
        empresa = Usuario(
            nombre="Bidify", apellido="Empresa",
            email=settings.empresa_email,
            domicilio="-", pais="Argentina",
            categoria=CategoriaUsuario.PLATINO,
            estado_registro=EstadoRegistro.COMPLETO,
        )
        db.add(empresa)
        db.flush()
    return empresa


def _invalidar_seguros(articulo: Articulo) -> None:
    """El retiro personal del bien hace perder la cobertura del seguro."""
    for seg in articulo.seguros:
        seg.vigente = False


def _liquidar_a_consignante(
    db: Session, vendedor_id: int | None, comprador_id: int, neto: Decimal, moneda: str
) -> None:
    """El dinero de un artículo vendido de un cliente se envía a su cuenta a la vista.

    Sólo aplica cuando el bien tenía un dueño-consignante real (distinto del
    comprador y de la empresa). Se busca su cuenta declarada antes de la subasta.
    """
    if vendedor_id is None or vendedor_id == comprador_id:
        return
    vendedor = db.get(Usuario, vendedor_id)
    if vendedor is None or vendedor.email == settings.empresa_email:
        return
    cuenta = (
        db.query(CuentaCobro)
        .filter(CuentaCobro.usuario_id == vendedor_id)
        .order_by(CuentaCobro.declarada_antes_subasta.desc(), CuentaCobro.id.desc())
        .first()
    )
    if cuenta is not None:
        destino = f"{cuenta.banco} · {cuenta.numero_cuenta} ({cuenta.pais})"
        cuerpo = (
            f"Se acreditarán {neto} {moneda} por la venta de tu bien en la cuenta a la vista "
            f"declarada: {destino}."
        )
    else:
        cuerpo = (
            f"Tu bien se vendió y te corresponden {neto} {moneda}. "
            "Declará una cuenta a la vista para poder acreditarte el importe."
        )
    db.add(Notificacion(
        usuario_id=vendedor_id,
        tipo="liquidacion",
        titulo="Liquidación por venta de tu bien",
        cuerpo=cuerpo,
    ))


def _cerrar_item(db: Session, item: CatalogoItem) -> None:
    """Crea la Venta para un ítem no vendido al cierre de la subasta."""
    puja = mejor_puja(db, item.id)
    moneda = item.articulo.moneda if item.articulo else "ARS"
    articulo = db.get(Articulo, item.articulo_id)
    # Dueño-consignante antes del cierre: es quien cobra la liquidación.
    vendedor_id = articulo.dueno_actual_id if articulo else None

    retira = puja.retira_personalmente if puja is not None else False
    # El envío corre por cuenta del comprador; si retira personalmente no hay envío.
    costo_envio = Decimal("0") if (retira or puja is None) else Decimal(settings.costo_envio_base)
    medio_pago_id = puja.medio_pago_id if puja is not None else None

    if puja is not None:
        comprador_id = puja.usuario_id
        monto = Decimal(puja.monto)
        comision = (monto * Decimal("0.10")).quantize(Decimal("0.01"))
        total = monto + comision + costo_envio
        comprador = db.get(Usuario, comprador_id)
        destino = comprador.domicilio if (comprador and not retira) else None
        envio_txt = (
            "retiro personal (sin envío ni cobertura de seguro)"
            if retira
            else f"envío {costo_envio} a {destino or 'la dirección declarada'}"
        )
        db.add(Notificacion(
            usuario_id=comprador_id,
            tipo="venta",
            titulo="¡Ganaste un lote!",
            cuerpo=(
                f"Importe a pagar: {total} {moneda} "
                f"(oferta {monto} + comisión {comision} + {envio_txt})."
            ),
        ))
    else:
        comprador_id = _get_empresa(db).id
        monto = Decimal(item.precio_base)
        comision = Decimal("0")

    db.add(Venta(
        catalogo_item_id=item.id,
        comprador_id=comprador_id,
        medio_pago_id=medio_pago_id,
        monto_final=monto,
        comision=comision,
        costo_envio=costo_envio,
        moneda=moneda,
        retira_personalmente=retira,
    ))
    item.vendido = True
    if articulo:
        articulo.estado = EstadoArticulo.VENDIDO
        # El retiro personal del bien hace perder la cobertura del seguro.
        if retira:
            _invalidar_seguros(articulo)
        # El dinero de la venta va a la cuenta a la vista del consignante.
        if puja is not None:
            _liquidar_a_consignante(
                db, vendedor_id, comprador_id, monto - comision, moneda
            )
        articulo.dueno_actual_id = comprador_id


_DURACION_SUBASTA = timedelta(minutes=2)


def procesar_subastas_programadas() -> int:
    """Abre subastas PROGRAMADA cuya fecha_hora ya llegó y les da 30 min de ventana. Retorna la cantidad abierta."""
    db = SessionLocal()
    try:
        ahora = datetime.utcnow()
        subastas = (
            db.query(Subasta)
            .filter(Subasta.estado == EstadoSubasta.PROGRAMADA, Subasta.fecha_hora <= ahora)
            .all()
        )
        for subasta in subastas:
            subasta.estado = EstadoSubasta.ABIERTA
            subasta.fecha_hora = ahora + _DURACION_SUBASTA
        if subastas:
            db.commit()
        return len(subastas)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def procesar_subastas_vencidas() -> int:
    """Cierra subastas vencidas y genera ventas. Retorna la cantidad cerradas."""
    db = SessionLocal()
    try:
        ahora = datetime.utcnow()
        subastas = (
            db.query(Subasta)
            .filter(Subasta.estado == EstadoSubasta.ABIERTA, Subasta.fecha_hora <= ahora)
            .all()
        )
        cerradas = 0
        for subasta in subastas:
            subasta.estado = EstadoSubasta.CERRADA
            for item in subasta.catalogo:
                if not item.vendido:
                    _cerrar_item(db, item)
            db.commit()
            cerradas += 1
        return cerradas
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _extraer_precio(descripcion: str | None) -> Decimal:
    """Intenta leer el precio sugerido embebido en la descripción del formulario."""
    if descripcion:
        m = re.search(r'\(precio sugerido: ([\d.]+)\)', descripcion)
        if m:
            try:
                return Decimal(m.group(1).replace('.', ''))
            except Exception:
                pass
    return Decimal("150000")


def procesar_usuarios_pendientes() -> int:
    """Aprobación manual desde el panel admin — no hace nada automáticamente."""
    return 0


def procesar_medios_pago_pendientes() -> int:
    """Verifica automáticamente medios de pago que llevan +30s en PENDIENTE. Retorna cuántos verificó."""
    db = SessionLocal()
    try:
        ahora = datetime.utcnow()
        pendientes = (
            db.query(MedioPago)
            .filter(
                MedioPago.estado == EstadoMedioPago.PENDIENTE,
                MedioPago.fecha_creacion <= ahora - _TIMER_SOLICITUD,
            )
            .all()
        )
        for mp in pendientes:
            mp.estado = EstadoMedioPago.VERIFICADO
            mp.verificado = True
            db.add(Notificacion(
                usuario_id=mp.usuario_id,
                tipo="medio_pago",
                titulo="Medio de pago verificado",
                cuerpo=(
                    f"Tu {mp.tipo.value.replace('_', ' ').title()} "
                    f"({mp.detalle}) fue verificado exitosamente."
                ),
            ))
        if pendientes:
            db.commit()
        return len(pendientes)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def procesar_solicitudes_pendientes() -> int:
    """Reservado: la transición INGRESADA → EN_INSPECCION es ahora manual desde el panel admin."""
    return 0


def procesar_ventas_impagas() -> int:
    """Genera multas para ventas de usuarios reales impagas por más de _TIMER_IMPAGO.

    Excluye a la empresa (que compra lotes sin pujas) y ventas que ya tienen multa.
    Retorna la cantidad de multas generadas.
    """
    db = SessionLocal()
    try:
        ahora = datetime.utcnow()

        empresa = db.query(Usuario).filter(Usuario.email == settings.empresa_email).first()
        empresa_id = empresa.id if empresa else -1

        # IDs de ventas que ya tienen multa asociada
        ya_multadas = {
            row[0]
            for row in db.query(Multa.venta_id).filter(Multa.venta_id.isnot(None)).all()
        }

        ventas = (
            db.query(Venta)
            .filter(
                Venta.pagada.is_(False),
                Venta.fecha <= ahora - _TIMER_IMPAGO,
                Venta.comprador_id != empresa_id,
            )
            .all()
        )

        generadas = 0
        for venta in ventas:
            if venta.id in ya_multadas:
                continue
            usuario = db.get(Usuario, venta.comprador_id)
            if usuario is None:
                continue
            monto_multa = (Decimal(str(venta.monto_final)) * Decimal("0.10")).quantize(Decimal("0.01"))
            db.add(Multa(
                usuario_id=usuario.id,
                venta_id=venta.id,
                monto=monto_multa,
                moneda=venta.moneda,
                motivo=f"Impago de la venta #{venta.id}",
                fecha_vencimiento=ahora + timedelta(hours=72),
            ))
            usuario.bloqueado_por_impago = True
            db.add(Notificacion(
                usuario_id=usuario.id,
                tipo="multa",
                titulo="Multa por impago",
                cuerpo=(
                    f"Se registró una multa de ${monto_multa:,.2f} {venta.moneda} "
                    f"(10% de la venta #{venta.id}). "
                    "Tenés 72hs para presentar los fondos; debés pagarla antes de volver a participar."
                ),
            ))
            generadas += 1

        if generadas:
            db.commit()
        return generadas
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def procesar_multas_vencidas() -> int:
    """Deriva a la justicia las multas que vencieron sin ser pagadas.

    Condición: pagada=False, derivada_justicia=False, fecha_vencimiento <= ahora.
    Retorna la cantidad de multas derivadas.
    """
    db = SessionLocal()
    try:
        ahora = datetime.utcnow()
        multas = (
            db.query(Multa)
            .filter(
                Multa.pagada.is_(False),
                Multa.derivada_justicia.is_(False),
                Multa.fecha_vencimiento.isnot(None),
                Multa.fecha_vencimiento <= ahora,
            )
            .all()
        )
        derivadas = 0
        for m in multas:
            m.derivada_justicia = True
            usuario = db.get(Usuario, m.usuario_id)
            if usuario:
                usuario.estado_registro = EstadoRegistro.BLOQUEADO
                usuario.bloqueado_por_impago = True
                db.add(Notificacion(
                    usuario_id=usuario.id,
                    tipo="multa",
                    titulo="Caso derivado a la justicia",
                    cuerpo=(
                        f"Tu multa de ${m.monto:,.2f} {m.moneda} venció sin ser pagada. "
                        "El caso fue derivado a la justicia y tu cuenta fue suspendida permanentemente."
                    ),
                ))
            derivadas += 1
        if derivadas:
            db.commit()
        return derivadas
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
