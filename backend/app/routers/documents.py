"""Central de documentos: upload, listagem, validação de extração, download."""
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database.session import get_db
from app.documents.extraction import process_document_file
from app.documents.storage import local_path_from_url, save_upload
from app.models.auth import User
from app.models.documents import Document, DocumentExtraction
from app.routers.helpers import clamp_page, paginate
from app.schemas.admin import DocumentOut, DocumentUpdate, ExtractionOut
from app.schemas.common import MessageOut
from app.security.auth import get_current_user, require_roles
from app.services.audit import register_audit

router = APIRouter(prefix="/documents", tags=["documents"])

_EDITORES = ("ADMIN", "GERENTE", "AUXILIAR")
_GESTORES = ("ADMIN", "GERENTE")

TIPOS_DOCUMENTO = ("CONTRATO", "NOTA_FISCAL", "RECIBO", "COMPROVANTE", "EXTRATO",
                   "ADMINISTRATIVO", "FINANCEIRO", "OUTRO")


def _serialize(d: Document) -> dict:
    data = DocumentOut.model_validate(d).model_dump()
    data["extractions"] = [
        ExtractionOut.model_validate(e).model_dump() for e in d.extractions
    ]
    return data


@router.get("", response_model=dict)
def list_documents(
    page: int = 1,
    page_size: int = 50,
    client_id=None,
    status: str | None = None,
    tipo: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Document)
    if client_id:
        q = q.filter(Document.client_id == client_id)
    if status:
        q = q.filter(Document.status == status)
    if tipo:
        q = q.filter(Document.tipo == tipo)
    q = q.order_by(Document.created_at.desc())
    page, page_size = clamp_page(page, page_size)
    items, total = paginate(q, page, page_size)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_serialize(d) for d in items],
    }


@router.post("/upload", response_model=DocumentOut, status_code=201)
def upload_document(
    request: Request,
    file: UploadFile = File(...),
    client_id: str = Form(...),
    tipo: str = Form("OUTRO"),
    projeto_id: str | None = Form(None),
    data_documento: str | None = Form(None),
    observacao: str | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    """Fluxo: UPLOAD -> VALIDAÇÃO -> ARMAZENAMENTO -> PROCESSAMENTO -> EXTRAÇÃO -> VALIDAÇÃO HUMANA."""
    if tipo not in TIPOS_DOCUMENTO:
        raise HTTPException(status_code=400, detail="Tipo de documento inválido.")
    if not file.filename:
        raise HTTPException(status_code=400, detail="Arquivo sem nome.")

    from app.models.clients import Client

    cli = db.get(Client, client_id)
    if cli is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    categoria = {
        "CONTRATO": "contracts",
        "NOTA_FISCAL": "invoices",
        "RECIBO": "receipts",
        "EXTRATO": "bank",
        "COMPROVANTE": "others",
        "ADMINISTRATIVO": "others",
        "FINANCEIRO": "others",
        "OUTRO": "others",
    }[tipo]

    stored = save_upload(file, client_id, categoria)

    from datetime import date

    data_doc = None
    if data_documento:
        try:
            data_doc = date.fromisoformat(data_documento)
        except ValueError:
            data_doc = None  # data inválida não bloqueia o upload

    doc = Document(
        client_id=cli.id,
        projeto_id=projeto_id,
        tipo=tipo,
        data_documento=data_doc,
        usuario_id=user.id,
        arquivo_nome=stored["arquivo_nome"],
        arquivo_url=stored["arquivo_url"],
        tamanho=stored["tamanho"],
        mime_type=stored["mime_type"],
        status="PROCESSADO",
        observacao=observacao,
    )
    db.add(doc)
    db.flush()

    # PROCESSAMENTO + EXTRAÇÃO (engine regex — Fase 1)
    caminho = stored.get("storage_path")
    if caminho and Path(caminho).exists():
        try:
            process_document_file(db, doc, caminho)
        except Exception:
            doc.status = "PROCESSADO"  # extração falhou; mantém o arquivo

    register_audit(
        db, user, "Documento enviado", "DOCUMENTOS", registro_id=doc.id,
        valor_novo={"arquivo": doc.arquivo_nome, "tipo": doc.tipo},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/{doc_id}", response_model=DocumentOut)
def get_document(doc_id, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    d = db.get(Document, doc_id)
    if d is None:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
    return d


@router.put("/{doc_id}", response_model=DocumentOut)
def update_document(
    doc_id,
    payload: DocumentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    d = db.get(Document, doc_id)
    if d is None:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(d, k, v)
    register_audit(
        db, user, "Documento alterado", "DOCUMENTOS", registro_id=doc_id,
        valor_novo={"status": d.status},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return d


@router.delete("/{doc_id}", response_model=MessageOut)
def delete_document(
    doc_id,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_GESTORES)),
):
    d = db.get(Document, doc_id)
    if d is None:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
    db.delete(d)
    register_audit(
        db, user, "Documento excluído", "DOCUMENTOS", registro_id=doc_id,
        valor_anterior={"arquivo": d.arquivo_nome},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return MessageOut(message="Documento excluído.")


@router.put("/{doc_id}/extractions/{extraction_id}", response_model=ExtractionOut)
def update_extraction(
    doc_id,
    extraction_id,
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    e = db.get(DocumentExtraction, extraction_id)
    if e is None or str(e.document_id) != doc_id:
        raise HTTPException(status_code=404, detail="Extração não encontrada.")
    e.valor = payload.get("valor", e.valor)
    e.status = payload.get("status", e.status)
    e.corrigido_por = user.id
    from datetime import datetime, timezone

    e.corrigido_em = datetime.now(timezone.utc)
    # Reavalia o status do documento
    d = db.get(Document, doc_id)
    if d:
        statuses = {x.status for x in d.extractions}
        if statuses and statuses <= {"VALIDADA", "CORRIGIDA"}:
            d.status = "VALIDADO"
        elif "REJEITADA" in statuses:
            d.status = "REJEITADO"
    register_audit(
        db, user, "Extração validada/corrigida", "DOCUMENTOS", registro_id=doc_id,
        valor_novo={"campo": e.campo, "valor": e.valor, "status": e.status},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return e


@router.get("/{doc_id}/download")
def download_document(doc_id, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    d = db.get(Document, doc_id)
    if d is None:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
    if settings.storage_backend != "local":
        raise HTTPException(
            status_code=501,
            detail="Download via Supabase Storage será habilitado com a integração.",
        )
    path = local_path_from_url(d.arquivo_url or "")
    if path is None:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado no armazenamento.")
    return FileResponse(path, filename=d.arquivo_nome)
