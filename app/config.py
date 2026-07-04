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
    # Depósito de inspección — dirección donde los vendedores envían sus bienes.
    deposito_nombre: str = "Depósito Central Bidify"
    deposito_direccion: str = "Av. Corrientes 1234, Piso 3"
    deposito_ciudad: str = "Ciudad Autónoma de Buenos Aires"


settings = Settings()
