"""Gestão de usuários internos (somente ADMIN)."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.auth import User
from app.routers.helpers import clamp_page, paginate
from app.schemas.auth import UserCreate, UserOut, UserUpdate
from app.schemas.common import MessageOut
from app.security.auth import get_current_user, require_admin
from app.security.passwords import hash_password
from app.services.audit import register_audit

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=dict)
def list_users(
    page: int = 1,
    page_size: int = 50,
    search: str | None = None,
    role: str | None = None,
    ativo: bool | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(User)
    if search:
        like = f"%{search}%"
        q = q.filter(User.nome.ilike(like) | User.username.ilike(like) | User.email.ilike(like))
    if role:
        q = q.filter(User.role == role.upper())
    if ativo is not None:
        q = q.filter(User.ativo == ativo)
    q = q.order_by(User.nome)
    page, page_size = clamp_page(page, page_size)
    items, total = paginate(q, page, page_size)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [UserOut.model_validate(u).model_dump() for u in items],
    }


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=409, detail="Username já existe.")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="E-mail já cadastrado.")
    user = User(
        username=payload.username.strip(),
        nome=payload.nome.strip(),
        email=payload.email,
        cargo=payload.cargo,
        role=payload.role,
        password_hash=hash_password(payload.password),
        criado_por=admin.id,
    )
    db.add(user)
    db.flush()
    register_audit(
        db, admin, "Usuário criado", "USERS", registro_id=user.id,
        valor_novo={"username": user.username, "role": user.role},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id,
    payload: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    before = {"nome": user.nome, "role": user.role, "ativo": user.ativo}
    data = payload.model_dump(exclude_unset=True)
    if "email" in data and data["email"] != user.email:
        existe = db.query(User.id).filter(User.email == data["email"]).first()
        if existe:
            raise HTTPException(status_code=409, detail="E-mail já cadastrado.")
    if "password" in data and data["password"]:
        user.password_hash = hash_password(data.pop("password"))
    for k, v in data.items():
        setattr(user, k, v)
    register_audit(
        db, admin, "Usuário alterado", "USERS", registro_id=user.id,
        valor_anterior=before,
        valor_novo={"nome": user.nome, "role": user.role, "ativo": user.ativo},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return user


@router.delete("/{user_id}", response_model=MessageOut)
def delete_user(
    user_id,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Você não pode excluir a si mesmo.")
    db.delete(user)
    register_audit(
        db, admin, "Usuário excluído", "USERS", registro_id=user_id,
        valor_anterior={"username": user.username},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return MessageOut(message="Usuário excluído.")
