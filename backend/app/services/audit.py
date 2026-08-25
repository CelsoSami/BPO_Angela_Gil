"""Auditoria de operações."""
import uuid

from sqlalchemy.orm import Session

from app.models.admin import AuditLog


def register_audit(
    db: Session,
    user,
    acao: str,
    modulo: str,
    registro_id: str | uuid.UUID | None = None,
    valor_anterior: dict | None = None,
    valor_novo: dict | None = None,
    ip: str | None = None,
) -> None:
    """Registra uma ação no log de auditoria (sem commit — o chamador commita)."""
    db.add(
        AuditLog(
            usuario_id=user.id if user else None,
            acao=acao,
            modulo=modulo,
            registro_id=str(registro_id) if registro_id is not None else None,
            valor_anterior=valor_anterior,
            valor_novo=valor_novo,
            ip=ip,
        )
    )
