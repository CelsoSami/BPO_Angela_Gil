"""Interface de linha de comando (bootstrap e manutenção).

Uso:
    python -m app.cli create-admin        # cria o 1º administrador (.env)
    python -m app.cli create-user         # cria usuário interativamente
    python -m app.cli seed-demo           # popula dados demonstrativos (seed.sql)
    python -m app.cli health              # testa a conexão com o banco
"""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


def _get_db():
    from app.database.session import get_session_local

    return get_session_local()()


def cmd_create_admin() -> None:
    from app.config import settings
    from app.models.auth import User
    from app.security.passwords import hash_password

    db = _get_db()
    try:
        if db.query(User.id).filter(User.role == "ADMIN").first():
            print("Já existe um administrador cadastrado. Nada a fazer.")
            return
        password = settings.admin_password or input(
            "Senha do administrador (mín. 8 caracteres): "
        ).strip()
        if len(password) < 8:
            print("Senha muito curta.")
            sys.exit(1)
        username = settings.admin_username or input("Username: ").strip()
        nome = settings.admin_name or input("Nome: ").strip()
        email = settings.admin_email or input("E-mail: ").strip()
        admin = User(
            username=username,
            nome=nome,
            email=email,
            cargo="Administrador do sistema",
            role="ADMIN",
            password_hash=hash_password(password),
        )
        db.add(admin)
        db.commit()
        print(f"Administrador criado: {username} (role=ADMIN)")
    finally:
        db.close()


def cmd_create_user() -> None:
    from app.models.auth import User
    from app.security.passwords import hash_password

    username = input("Username: ").strip()
    nome = input("Nome completo: ").strip()
    email = input("E-mail: ").strip()
    role = input("Perfil (ADMIN/GERENTE/AUXILIAR/CONSULTOR) [AUXILIAR]: ").strip().upper() or "AUXILIAR"
    password = input("Senha (mín. 8): ").strip()
    if role not in ("ADMIN", "GERENTE", "AUXILIAR", "CONSULTOR"):
        print("Perfil inválido.")
        sys.exit(1)
    if len(password) < 8:
        print("Senha muito curta.")
        sys.exit(1)
    db = _get_db()
    try:
        db.add(
            User(
                username=username, nome=nome, email=email, role=role,
                password_hash=hash_password(password),
            )
        )
        db.commit()
        print(f"Usuário criado: {username} ({role})")
    finally:
        db.close()


def _split_sql(texto: str) -> list[str]:
    """Divide o arquivo SQL em statements (sem suporte a dollar-quoting)."""
    statements, atual = [], []
    for linha in texto.splitlines():
        strip = linha.strip()
        if not strip or strip.startswith("--"):
            continue
        atual.append(linha)
        if strip.endswith(";"):
            statements.append("\n".join(atual))
            atual = []
    if atual:
        statements.append("\n".join(atual))
    return statements


def cmd_seed_demo() -> None:
    from sqlalchemy import text

    db = _get_db()
    caminho = BACKEND_DIR.parent / "database" / "seed.sql"
    if not caminho.exists():
        print("Arquivo database/seed.sql não encontrado.")
        sys.exit(1)
    sql = caminho.read_text(encoding="utf-8")
    statements = _split_sql(sql)
    try:
        for stmt in statements:
            db.execute(text(stmt))
        db.commit()
        print(f"Seed executado com sucesso ({len(statements)} statements).")
    except Exception as exc:
        db.rollback()
        print(f"Erro ao executar seed: {exc}")
        print("Dica: execute schema.sql primeiro e crie o admin (create-admin).")
        sys.exit(1)
    finally:
        db.close()


def cmd_health() -> None:
    from sqlalchemy import text

    db = _get_db()
    try:
        db.execute(text("SELECT 1"))
        print("Conexão com o banco: OK")
    except Exception as exc:
        print(f"Falha de conexão: {exc}")
        sys.exit(1)
    finally:
        db.close()


COMMANDS = {
    "create-admin": cmd_create_admin,
    "create-user": cmd_create_user,
    "seed-demo": cmd_seed_demo,
    "health": cmd_health,
}


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print("Comandos disponíveis:", ", ".join(COMMANDS))
        sys.exit(1)
    COMMANDS[sys.argv[1]]()


if __name__ == "__main__":
    main()
