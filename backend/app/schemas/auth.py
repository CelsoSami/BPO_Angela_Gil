"""Schemas de autenticação e usuários."""
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import BaseCreate, BaseUpdate, ORMModel


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=255)


class TokenResponse(BaseModel):
    token: str
    token_type: str = "bearer"
    expires_minutes: int
    user: "UserOut"


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class UserOut(ORMModel):
    id: uuid.UUID
    username: str
    nome: str
    email: EmailStr
    cargo: str | None
    role: str
    ativo: bool
    ultimo_login: datetime | None
    created_at: datetime


class UserCreate(BaseCreate):
    username: str = Field(min_length=3, max_length=255)
    nome: str = Field(min_length=2, max_length=255)
    email: EmailStr
    cargo: str | None = None
    role: str = Field(default="AUXILIAR", pattern="^(ADMIN|GERENTE|AUXILIAR|CONSULTOR)$")
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseUpdate):
    nome: str | None = None
    email: EmailStr | None = None
    cargo: str | None = None
    role: str | None = Field(default=None, pattern="^(ADMIN|GERENTE|AUXILIAR|CONSULTOR)$")
    ativo: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


TokenResponse.model_rebuild()
