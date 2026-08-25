"""Armazenamento de arquivos.

Fase 1: armazenamento local (UPLOAD_DIR). O backend `supabase` (Supabase
Storage, bucket privado com URLs assinadas) está preparado como integração
futura: basta implementar `_save_supabase` e `_download_supabase` abaixo.
"""
import mimetypes
import os
import re
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.config import settings

ALLOWED_EXTENSIONS = {".pdf", ".xlsx", ".xls", ".csv", ".png", ".jpg", ".jpeg", ".webp"}
MAX_SIZE = settings.max_upload_size


def _safe_name(filename: str) -> str:
    name = Path(filename).name
    name = re.sub(r"[^\w.\-]", "_", name)
    return name or "arquivo"


def validate_upload(file: UploadFile) -> None:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Tipo de arquivo não permitido. Envie PDF, XLSX, CSV ou imagem.",
        )
    size = 0
    while chunk := file.file.read(65536):
        size += len(chunk)
        if size > MAX_SIZE:
            raise HTTPException(
                status_code=400,
                detail="Arquivo excede o limite de 15 MB.",
            )
    file.file.seek(0)


def save_upload(file: UploadFile, client_key: str, categoria: str) -> dict:
    """Salva o arquivo e retorna {arquivo_nome, arquivo_url, tamanho, mime_type}."""
    validate_upload(file)
    if settings.storage_backend == "supabase":
        return _save_supabase(file, client_key, categoria)
    return _save_local(file, client_key, categoria)


def _save_local(file: UploadFile, client_key: str, categoria: str) -> dict:
    ext = Path(file.filename or "").suffix.lower()
    base = Path(settings.upload_dir) / client_key / categoria
    base.mkdir(parents=True, exist_ok=True)
    unique = f"{uuid.uuid4().hex}{ext}"
    destino = base / unique
    with open(destino, "wb") as out:
        while chunk := file.file.read(65536):
            out.write(chunk)
    mime = mimetypes.guess_type(destino.name)[0] or "application/octet-stream"
    url = f"/uploads/{client_key}/{categoria}/{unique}"
    return {
        "arquivo_nome": _safe_name(file.filename or unique),
        "arquivo_url": url,
        "tamanho": destino.stat().st_size,
        "mime_type": mime,
        "storage_path": str(destino),
    }


def _save_supabase(file: UploadFile, client_key: str, categoria: str) -> dict:
    """INTEGRAÇÃO FUTURA (Fase 2/Storage): Supabase Storage com bucket privado.

    Implementação esperada:
      1. autenticar com SUPABASE_SERVICE_ROLE_KEY (apenas no servidor);
      2. enviar bytes para `{bucket}/{client_key}/{categoria}/{uuid}{ext}`;
      3. gravar metadados e usar create_signed_url para acesso.
    """
    raise HTTPException(
        status_code=501,
        detail=(
            "Armazenamento Supabase ainda não configurado. Defina "
            "STORAGE_BACKEND=local (padrão da Fase 1) ou configure a integração."
        ),
    )


def local_path_from_url(url: str) -> Path | None:
    """Resolve um arquivo salvo localmente a partir da URL pública."""
    if not url or not url.startswith("/uploads/"):
        return None
    relative = url[len("/uploads/"):]
    path = (Path(settings.upload_dir) / relative).resolve()
    base = Path(settings.upload_dir).resolve()
    if base not in path.parents and path != base:
        return None
    if not path.exists():
        return None
    return path
