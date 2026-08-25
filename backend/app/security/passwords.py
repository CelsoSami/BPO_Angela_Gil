"""Hash de senhas: Argon2id (padrão) com fallback para bcrypt."""
from app.config import settings

# Importado sob demanda para evitar dependência pesada em ambientes mínimos
_argon2_ph = None
_bcrypt_loaded = False


def _get_argon2():
    global _argon2_ph
    if _argon2_ph is None:
        from argon2 import PasswordHasher

        _argon2_ph = PasswordHasher()
    return _argon2_ph


def hash_password(password: str) -> str:
    """Gera o hash da senha usando o algoritmo configurado (argon2id | bcrypt)."""
    if settings.password_hash_algorithm == "bcrypt":
        import bcrypt

        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    return _get_argon2().hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verifica a senha contra o hash, detectando o algoritmo pelo prefixo."""
    if password_hash.startswith("$2"):  # hash bcrypt
        try:
            import bcrypt

            return bcrypt.checkpw(
                password.encode("utf-8"), password_hash.encode("utf-8")
            )
        except Exception:
            return False
    try:
        return _get_argon2().verify(password_hash, password)
    except Exception:
        return False
