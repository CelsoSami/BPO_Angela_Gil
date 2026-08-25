"""Engine e sessão SQLAlchemy."""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

_engine = None
_SessionLocal = None


def get_engine():
    """Cria o engine sob demanda (permite importar o app sem banco configurado)."""
    global _engine
    if _engine is None:
        if not settings.database_url:
            raise RuntimeError(
                "DATABASE_URL não configurada. Copie .env.example para .env e preencha."
            )
        _engine = create_engine(
            settings.database_url,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
        )
    return _engine


def get_session_local():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            bind=get_engine(), autoflush=False, autocommit=False
        )
    return _SessionLocal


def get_db():
    """Dependency do FastAPI para sessões."""
    db = get_session_local()()
    try:
        yield db
    finally:
        db.close()


class Base(DeclarativeBase):
    """Base declarativa dos modelos ORM."""
