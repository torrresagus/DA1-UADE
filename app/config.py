from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Sistema de Subastas API"
    database_url: str = "sqlite:///./subastas.db"
    secret_key: str = "changeme-uade-da1-2026"


settings = Settings()
