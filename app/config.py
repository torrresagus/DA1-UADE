from decimal import Decimal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Sistema de Subastas API"
    database_url: str = "sqlite:///./subastas.db"
    media_dir: str = "media"
    secret_key: str = "changeme-uade-da1-2026"
    # Usuario "empresa" que compra los lotes sin pujas al valor base.
    empresa_email: str = "empresa@bidify.local"
    # Compañía aseguradora por defecto para pólizas auto-generadas.
    seguro_compania: str = "Bidify Seguros S.A."
    # Premio (prima) del seguro como porcentaje del monto cubierto.
    seguro_premio_pct: Decimal = Decimal("0.02")
    # Depósito de inspección — dirección donde los vendedores envían sus bienes.
    deposito_nombre: str = "Depósito Central Bidify"
    deposito_direccion: str = "Av. Corrientes 1234, Piso 3"
    deposito_ciudad: str = "Ciudad Autónoma de Buenos Aires"
    # Costo de envío del bien adquirido a la dirección declarada por el comprador.
    costo_envio_base: Decimal = Decimal("5000")
    # Gastos que se le informan al usuario cuando su bien se devuelve.
    gastos_devolucion_base: Decimal = Decimal("3000")

    # ─── Email (aviso de completar registro / generar clave). Opcional: si no se
    # configura un host SMTP, los mails se registran por log en vez de enviarse. ───
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str = "no-reply@bidify.local"
    smtp_tls: bool = True


settings = Settings()
