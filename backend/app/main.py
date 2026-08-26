"""Build Flow BPO — Fase 1. Aplicação FastAPI (API + frontend estático)."""
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.config import settings
from app.routers import (
    admin,
    alerts,
    auth,
    clients,
    collections,
    contracts,
    dashboard,
    documents,
    financial,
    projects,
    reports,
    users,
)
from app.security.ratelimit import limiter

logger = logging.getLogger("buildflow")
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"


def _setup_schema_if_requested() -> None:
    """Cria as tabelas no 1º boot quando SETUP_SCHEMA_ON_STARTUP=true
    e a tabela `users` ainda não existe (permite Postgres sem provisioning)."""
    if not settings.setup_schema_on_startup:
        return
    from sqlalchemy import text as sql_text

    from app.database.session import get_session_local

    try:
        db = get_session_local()()
    except Exception as exc:
        logger.warning("Setup automático do schema ignorado: %s", exc)
        return
    try:
        db.execute(sql_text("SELECT 1 FROM users LIMIT 1"))
        db.commit()
        return  # schema já existe
    except Exception:
        db.rollback()
    try:
        from app.services.seed import run_schema

        n = run_schema(db)
        logger.info("Schema criado automaticamente (%s statements).", n)
    except Exception:
        db.rollback()
        logger.exception("Falha ao criar schema automaticamente")
    finally:
        db.close()


def _bootstrap_admin() -> None:
    """Cria o primeiro administrador a partir do .env quando não existe.

    Se o admin configurado já existir, sincroniza nome/e-mail do .env
    (auto-correção — ex.: e-mail antigo com domínio reservado .local)."""
    if not settings.admin_password:
        return
    from app.database.session import get_session_local
    from app.models.auth import User
    from app.security.passwords import hash_password

    try:
        db = get_session_local()()
    except Exception as exc:  # banco ainda não configurado
        logger.warning("Bootstrap do admin ignorado: %s", exc)
        return
    try:
        username = settings.admin_username.strip()
        admin = (
            db.query(User).filter(User.username == username).first()
        )
        if admin is not None:
            # auto-correção de dados do admin configurado
            alterado = False
            if admin.email != settings.admin_email:
                admin.email = settings.admin_email
                alterado = True
            if admin.nome != settings.admin_name:
                admin.nome = settings.admin_name
                alterado = True
            if alterado:
                db.commit()
                logger.info("Dados do administrador sincronizados com o .env.")
            return
        admin = User(
            username=username,
            nome=settings.admin_name,
            email=settings.admin_email,
            cargo="Administrador do sistema",
            role="ADMIN",
            password_hash=hash_password(settings.admin_password),
        )
        db.add(admin)
        db.commit()
        logger.info("Administrador inicial criado: %s", admin.username)
    except Exception:
        db.rollback()
        logger.exception("Falha ao criar administrador inicial")
    finally:
        db.close()


def _clean_demo_if_requested() -> None:
    """Remove os dados de demonstração no boot quando DEMO_CLEAN_ON_STARTUP=true."""
    if not settings.demo_clean_on_startup:
        return
    from app.database.session import get_session_local

    try:
        db = get_session_local()()
    except Exception as exc:
        logger.warning("Limpeza de demonstração ignorada: %s", exc)
        return
    try:
        from app.services.seed import run_demo_clean

        run_demo_clean(db)
        logger.info("Dados de demonstração removidos.")
    except Exception:
        db.rollback()
        logger.exception("Falha ao limpar dados de demonstração")
    finally:
        db.close()


def _seed_demo_if_requested() -> None:
    """Popula dados demonstrativos no boot quando SEED_DEMO_ON_STARTUP=true.

    Executa o seed básico (banco vazio) e, se DEMO_EXTENDED=true e houver
    poucos clientes, o gerador estendido (demo_generate.sql)."""
    if not settings.seed_demo_on_startup:
        return
    from sqlalchemy import func

    from app.database.session import get_session_local
    from app.models.clients import Client

    try:
        db = get_session_local()()
    except Exception as exc:
        logger.warning("Seed de demonstração ignorado: %s", exc)
        return
    try:
        total = db.query(func.count(Client.id)).scalar() or 0
        if total == 0:
            from app.services.seed import run_seed

            n = run_seed(db)
            logger.info("Dados demonstrativos criados (%s statements).", n)

        if settings.demo_extended:
            from app.services.seed import run_demo_generate

            atual = db.query(func.count(Client.id)).scalar() or 0
            if atual < 40:
                n2 = run_demo_generate(db)
                logger.info("Dados estendidos de demonstração criados (%s statements).", n2)
            else:
                logger.info("Dados estendidos já presentes (%s clientes).", atual)
    except Exception:
        db.rollback()
        logger.exception("Falha ao popular dados demonstrativos")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    _setup_schema_if_requested()
    _clean_demo_if_requested()
    _bootstrap_admin()
    _seed_demo_if_requested()
    yield


app = FastAPI(
    title=settings.app_name,
    description=(
        "Plataforma de BPO para escritórios de arquitetura, engenharia e "
        "design de interiores — Fase 1 (sem IA)."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in origins else origins,
    allow_credentials=False if "*" in origins else True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limit
app.state.limiter = limiter


async def _rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Muitas tentativas em pouco tempo. Aguarde um instante e tente novamente."},
    )


app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ---------------------------------------------------------------------------
# Erros amigáveis (nunca expor tracebacks/SQL)
# ---------------------------------------------------------------------------
from sqlalchemy.exc import (  # noqa: E402
    IntegrityError,
    OperationalError,
    ProgrammingError,
    StatementError,
)


@app.exception_handler(ProgrammingError)
async def programming_error_handler(request: Request, exc: ProgrammingError):
    """Tabela/relação inexistente — quase sempre schema.sql não executado."""
    logger.warning("Erro de banco (tabela ausente?) em %s %s: %s", request.method, request.url, exc)
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Banco de dados não configurado corretamente. Verifique se o schema.sql foi executado e tente novamente."
        },
    )


@app.exception_handler(OperationalError)
async def operational_error_handler(request: Request, exc: OperationalError):
    logger.warning("Banco indisponível em %s %s: %s", request.method, request.url, exc)
    return JSONResponse(
        status_code=503,
        content={"detail": "Banco de dados indisponível no momento. Tente novamente em instantes."},
    )


@app.exception_handler(StatementError)
async def statement_error_handler(request: Request, exc: StatementError):
    logger.warning(
        "Parâmetro inválido em %s %s: %s",
        request.method,
        request.url,
        exc,
    )
    return JSONResponse(
        status_code=400,
        content={"detail": "Identificador ou parâmetro inválido na requisição."},
    )


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    logger.warning("Conflito de integridade em %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=409,
        content={"detail": "Registro duplicado ou referência inválida. Verifique os dados."},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Erro não tratado em %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Não foi possível concluir a operação. Tente novamente em instantes."
        },
    )


# ---------------------------------------------------------------------------
# Rotas da API
# ---------------------------------------------------------------------------
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(clients.router)
app.include_router(clients.plans_router)
app.include_router(projects.router)
app.include_router(contracts.router)
app.include_router(financial.router)
app.include_router(documents.router)
app.include_router(collections.router)
app.include_router(alerts.router)
app.include_router(reports.router)
app.include_router(dashboard.router)
app.include_router(admin.router)


# ---------------------------------------------------------------------------
# Frontend estático + uploads
# ---------------------------------------------------------------------------
@app.get("/api/health", tags=["system"])
def health():
    return {"status": "ok", "app": settings.app_name, "environment": settings.environment}


# Garante o diretório de uploads antes de montar o StaticFiles
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

if FRONTEND_DIR.exists() and (FRONTEND_DIR / "assets").exists():
    app.mount(
        "/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets"
    )

    @app.get("/", include_in_schema=False)
    def index():
        return FileResponse(FRONTEND_DIR / "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str):
        """Fallback do SPA (rota por hash — servimos sempre o index)."""
        if full_path:
            arquivo = (FRONTEND_DIR / full_path).resolve()
            # impede path traversal: apenas arquivos dentro do frontend
            if FRONTEND_DIR.resolve() in arquivo.parents and arquivo.is_file():
                return FileResponse(arquivo)
        return FileResponse(FRONTEND_DIR / "index.html")
else:
    logger.warning("Frontend não encontrado em %s — API disponível em /docs", FRONTEND_DIR)
