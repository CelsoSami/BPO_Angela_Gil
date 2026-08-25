"""Dependências de autenticação e autorização."""
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database.session import get_db
from app.models.auth import Session as SessionModel
from app.models.auth import User

_bearer = HTTPBearer(auto_error=False)

ROLES = ("ADMIN", "GERENTE", "AUXILIAR", "CONSULTOR")


def _unauthorized(detail: str = "Sessão inválida ou expirada.") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def create_session(db: Session, user: User, request: Request | None = None) -> str:
    """Cria uma sessão segura e retorna o token (expiração configurável)."""
    token = secrets.token_urlsafe(48)
    expires = datetime.now(timezone.utc) + timedelta(
        minutes=settings.session_expire_minutes
    )
    ip = None
    ua = None
    if request:
        ip = request.client.host if request.client else None
        ua = request.headers.get("user-agent")
    db.add(
        SessionModel(
            token=token,
            user_id=user.id,
            ip=ip,
            user_agent=ua,
            expires_at=expires,
        )
    )
    db.commit()
    return token


def revoke_session(db: Session, token: str) -> None:
    sess = (
        db.query(SessionModel).filter(SessionModel.token == token).first()
    )
    if sess:
        sess.revoked = True
        db.commit()


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Resolve o usuário autenticado a partir do token Bearer."""
    if credentials is None:
        raise _unauthorized()
    token = credentials.credentials
    if not token:
        raise _unauthorized()
    sess = db.query(SessionModel).filter(SessionModel.token == token).first()
    if sess is None or sess.revoked:
        raise _unauthorized()
    if sess.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise _unauthorized("Sessão expirada. Faça login novamente.")
    user = db.query(User).filter(User.id == sess.user_id).first()
    if user is None or not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo ou inexistente.",
        )
    return user


def require_roles(*roles: str):
    """Restringe acesso a determinados perfis (ADMIN, GERENTE, AUXILIAR, CONSULTOR)."""

    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem permissão para executar esta ação.",
            )
        return user

    return checker


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Somente administradores podem executar esta ação.",
        )
    return user
