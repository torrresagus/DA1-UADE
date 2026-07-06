"""Envío de correo electrónico.

El enunciado pide que, al finalizar la primera etapa de registración, se envíe
un mail al postor avisándole que debe ingresar a la app, completar el registro y
generar su clave personal.

Si hay un host SMTP configurado (settings.smtp_host) el mail se envía de verdad;
en caso contrario se registra por log (modo demo/desarrollo) para no acoplar la
corrección de las subastas a tener credenciales de correo.
"""
import logging
import smtplib
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger("bidify.email")


def enviar_email(destinatario: str, asunto: str, cuerpo: str) -> bool:
    """Envía un mail. Devuelve True si se envió por SMTP, False si se logueó.

    Nunca levanta excepción: un fallo de correo no debe romper el registro.
    """
    if not settings.smtp_host:
        logger.info("[email:simulado] Para=%s | Asunto=%s\n%s", destinatario, asunto, cuerpo)
        return False

    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = destinatario
    msg["Subject"] = asunto
    msg.set_content(cuerpo)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            if settings.smtp_tls:
                smtp.starttls()
            if settings.smtp_user and settings.smtp_password:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
        return True
    except Exception as exc:  # pragma: no cover - depende de infraestructura externa
        logger.warning("No se pudo enviar el mail a %s: %s", destinatario, exc)
        return False


def enviar_mail_completar_registro(destinatario: str, nombre: str) -> bool:
    """Mail de la etapa 1 aprobada: el postor debe entrar y generar su clave."""
    asunto = "Bidify — Completá tu registro y generá tu clave"
    cuerpo = (
        f"Hola {nombre},\n\n"
        "¡Tu identidad fue verificada y tu cuenta aprobada!\n\n"
        "Ya podés ingresar a la app de Bidify para completar tu registro, "
        "generar tu clave personal y registrar al menos un medio de pago para "
        "poder participar de las subastas.\n\n"
        "Nos vemos en la sala de remates,\n"
        "El equipo de Bidify."
    )
    return enviar_email(destinatario, asunto, cuerpo)
