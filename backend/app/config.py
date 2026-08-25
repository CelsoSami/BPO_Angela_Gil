"""Configurações da aplicação (lidas de .env)."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# .env localizado na raiz do projeto (build-flow/.env) — independe do CWD
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE), env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "Build Flow BPO"
    environment: str = "development"
    log_level: str = "INFO"

    # Banco de dados (Supabase PostgreSQL). Obrigatório em produção.
    database_url: str = ""

    # Segurança
    secret_key: str = "dev-only-secret-key-troque-em-producao"
    session_expire_minutes: int = 720
    password_hash_algorithm: str = "argon2id"  # argon2id | bcrypt

    # Primeiro administrador (bootstrap via CLI)
    admin_username: str = "admin"
    admin_password: str = ""
    admin_name: str = "Administrador"
    admin_email: str = "admin@buildflow.local"

    # CORS: lista separada por vírgula; "*" apenas em desenvolvimento
    cors_origins: str = "*"

    # Uploads
    max_upload_size: int = 15728640  # 15 MB
    storage_backend: str = "local"  # local | supabase
    upload_dir: str = "./uploads"
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""  # NUNCA expor no frontend
    supabase_storage_bucket: str = "documents"

    # Extração de documentos (Fase 1: regex). Fase 2 pode plugar OCR/IA aqui.
    document_extraction_engine: str = "regex"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
