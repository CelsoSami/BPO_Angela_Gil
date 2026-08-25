"""Autenticação: login, logout, me, troca de senha."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.database.session import get_db
from app.models.auth import User
from app.schemas.auth import LoginRequest, PasswordChange, TokenResponse, UserOut
from app.schemas.common import MessageOut
from app.security.auth import create_session, get_current_user, revoke_session
from app.security.passwords import hash_password, verify_password
from app.security.ratelimit import limiter
from app.services.audit import register_audit

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    """Login com username + senha. Sessão com expiração."""
    user = (
        db.query(User)
        .filter(User.username == payload.username.strip())
        .first()
    )
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=401, detail="Usuário ou senha inválidos."
        )
    if not user.ativo:
        raise HTTPException(status_code=403, detail="Usuário inativo. Contate o administrador.")
    token = create_session(db, user, request)
    user.ultimo_login = datetime.now(timezone.utc)
    db.commit()
    return TokenResponse(
        token=token,
        expires_minutes=settings.session_expire_minutes,
        user=UserOut.model_validate(user),
    )


@router.post("/logout", response_model=MessageOut)
def logout(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    auth = request.headers.get("authorization", "")
    token = auth.replace("Bearer ", "") if auth.startswith("Bearer ") else ""
    if token:
        revoke_session(db, token)
    return MessageOut(message="Sessão encerrada.")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/change-password", response_model=MessageOut)
def change_password(
    payload: PasswordChange,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Senha atual incorreta.")
    user.password_hash = hash_password(payload.new_password)
    register_audit(
        db, user, "Senha alterada", "AUTH", registro_id=user.id,
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return MessageOut(message="Senha alterada com sucesso.")
