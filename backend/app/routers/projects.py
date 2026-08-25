"""Projetos, rentabilidade e rankings."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.auth import User
from app.models.projects import Project
from app.routers.helpers import clamp_page, paginate
from app.schemas.clients import ProjectCreate, ProjectOut, ProjectUpdate
from app.schemas.common import MessageOut
from app.security.auth import get_current_user, require_roles
from app.services.audit import register_audit
from app.services.rentabilidade import compute_profitability, project_profit, rankings

router = APIRouter(prefix="/projects", tags=["projects"])

_EDITORES = ("ADMIN", "GERENTE", "AUXILIAR")
_GESTORES = ("ADMIN", "GERENTE")


def _serialize(p: Project, with_profit: bool = False) -> dict:
    data = ProjectOut.model_validate(p).model_dump()
    if with_profit:
        data.update(project_profit(p))
    return data


@router.get("", response_model=dict)
def list_projects(
    page: int = 1,
    page_size: int = 50,
    client_id=None,
    status: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Project)
    if client_id:
        q = q.filter(Project.client_id == client_id)
    if status:
        q = q.filter(Project.status == status)
    if search:
        like = f"%{search}%"
        q = q.filter(Project.nome.ilike(like) | Project.codigo.ilike(like))
    q = q.order_by(Project.created_at.desc())
    page, page_size = clamp_page(page, page_size)
    items, total = paginate(q, page, page_size)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_serialize(p, with_profit=True) for p in items],
    }


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    payload: ProjectCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    projeto = Project(**payload.model_dump())
    db.add(projeto)
    db.flush()
    register_audit(
        db, user, "Projeto criado", "PROJECTS", registro_id=projeto.id,
        valor_novo={"nome": projeto.nome, "client_id": str(projeto.client_id)},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return projeto


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    p = db.get(Project, project_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")
    return p


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id,
    payload: ProjectUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    p = db.get(Project, project_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")
    before = {"nome": p.nome, "status": p.status}
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    register_audit(
        db, user, "Projeto alterado", "PROJECTS", registro_id=project_id,
        valor_anterior=before, valor_novo={"nome": p.nome, "status": p.status},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return p


@router.delete("/{project_id}", response_model=MessageOut)
def delete_project(
    project_id,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_GESTORES)),
):
    p = db.get(Project, project_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")
    db.delete(p)
    register_audit(
        db, user, "Projeto excluído", "PROJECTS", registro_id=project_id,
        valor_anterior={"nome": p.nome},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return MessageOut(message="Projeto excluído.")


@router.get("/profitability/all", response_model=list)
def profitability(
    client_id=None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return compute_profitability(db, client_id)


@router.get("/rankings/all", response_model=dict)
def project_rankings(
    client_id=None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return rankings(db, client_id)
