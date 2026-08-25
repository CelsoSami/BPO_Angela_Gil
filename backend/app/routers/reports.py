"""Relatórios gerenciais mensais + precificação."""
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.config import settings
from app.database.session import get_db
from app.models.admin import Report
from app.models.auth import User
from app.models.clients import Client
from app.models.pricing import PricingSimulation
from app.routers.helpers import clamp_page, paginate
from app.schemas.admin import PricingOut
from app.schemas.common import MessageOut
from app.security.auth import get_current_user, require_roles
from app.services.audit import register_audit
from app.services.precificacao import calculate
from app.services.relatorios import (
    build_monthly_report,
    export_csv,
    export_excel,
    export_pdf,
    save_report_record,
)

router = APIRouter(prefix="/reports", tags=["reports"])

_EDITORES = ("ADMIN", "GERENTE", "AUXILIAR")
_GESTORES = ("ADMIN", "GERENTE")


@router.get("", response_model=dict)
def list_reports(
    page: int = 1,
    page_size: int = 50,
    client_id=None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Report)
    if client_id:
        q = q.filter(Report.client_id == client_id)
    q = q.order_by(Report.created_at.desc())
    page, page_size = clamp_page(page, page_size)
    items, total = paginate(q, page, page_size)
    out = []
    for r in items:
        data = {
            "id": str(r.id), "client_id": str(r.client_id) if r.client_id else None,
            "tipo": r.tipo, "mes": r.mes, "ano": r.ano, "titulo": r.titulo,
            "arquivo_url": r.arquivo_url, "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        if r.client_id:
            cli = db.get(Client, r.client_id)
            data["client_name"] = cli.nome_fantasia or cli.razao_social if cli else None
        out.append(data)
    return {"total": total, "page": page, "page_size": page_size, "items": out}


@router.post("/monthly/generate", response_model=dict)
def generate_monthly(
    request: Request,
    client_id: str,
    mes: int,
    ano: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_GESTORES)),
):
    """Gera o relatório gerencial mensal baseado em dados (sem IA)."""
    try:
        conteudo = build_monthly_report(db, client_id, mes, ano)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    rep = save_report_record(db, client_id, mes, ano, conteudo, user)
    register_audit(
        db, user, "Relatório gerado", "RELATORIOS", registro_id=rep.id,
        valor_novo={"mes": mes, "ano": ano},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return {
        "id": str(rep.id),
        "titulo": rep.titulo,
        "conteudo": conteudo,
    }


@router.get("/monthly/export")
def export_monthly(
    client_id: str,
    mes: int,
    ano: int,
    formato: str = "pdf",  # pdf | xlsx | csv
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        conteudo = build_monthly_report(db, client_id, mes, ano)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    cli = db.get(Client, client_id)
    nome = (cli.nome_fantasia or cli.razao_social or "cliente").replace(" ", "_")
    base = f"relatorio_mensal_{nome}_{mes:02d}_{ano}"

    if formato == "csv":
        return Response(
            export_csv(conteudo),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename={base}.csv"},
        )
    if formato == "xlsx":
        from openpyxl import Workbook

        # gera bytes
        data = export_excel(conteudo)
        return Response(
            data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={base}.xlsx"},
        )
    # pdf
    pdf = export_pdf(conteudo)
    return Response(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={base}.pdf"},
    )


# ------------------------------------------------------------------ PRECIFICAÇÃO
@router.post("/pricing/calculate", response_model=list)
def pricing_calculate(payload: dict, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Calcula os três cenários de preço sugerido (não persiste)."""
    return calculate(payload)


@router.get("/pricing", response_model=dict)
def list_pricing(
    page: int = 1,
    page_size: int = 50,
    client_id=None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(PricingSimulation)
    if client_id:
        q = q.filter(PricingSimulation.client_id == client_id)
    q = q.order_by(PricingSimulation.created_at.desc())
    page, page_size = clamp_page(page, page_size)
    items, total = paginate(q, page, page_size)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [PricingOut.model_validate(p).model_dump() for p in items],
    }


@router.post("/pricing", response_model=PricingOut, status_code=201)
def save_pricing(
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    """Calcula e salva uma simulação (cenário escolhido)."""
    cenarios = calculate(payload)
    escolhido = next(
        (c for c in cenarios if c["cenario"] == payload.get("cenario", "RECOMENDADO")),
        cenarios[0],
    )
    sim = PricingSimulation(
        client_id=payload.get("client_id"),
        titulo=payload.get("titulo"),
        servico=payload.get("servico", ""),
        horas=payload.get("horas", 0),
        custo_hora=payload.get("custo_hora", 0),
        equipe=payload.get("equipe") or [],
        despesas=payload.get("despesas", 0),
        impostos_pct=payload.get("impostos_pct", 0),
        margem_desejada_pct=payload.get("margem_desejada_pct", 0),
        prazo_dias=payload.get("prazo_dias"),
        complexidade=payload.get("complexidade"),
        cenario=escolhido["cenario"],
        custo_direto=escolhido["custo_direto"],
        custos_indiretos=escolhido["custos_indiretos"],
        impostos_valor=escolhido["impostos_valor"],
        margem_valor=escolhido["margem_valor"],
        preco_sugerido=escolhido["preco_sugerido"],
        created_by=user.id,
    )
    db.add(sim)
    db.flush()
    register_audit(
        db, user, "Simulação de precificação salva", "PRECIFICACAO", registro_id=sim.id,
        valor_novo={"servico": sim.servico, "preco": sim.preco_sugerido},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return sim


@router.delete("/pricing/{sim_id}", response_model=MessageOut)
def delete_pricing(
    sim_id,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("ADMIN", "GERENTE")),
):
    sim = db.get(PricingSimulation, sim_id)
    if sim is None:
        raise HTTPException(status_code=404, detail="Simulação não encontrada.")
    db.delete(sim)
    db.commit()
    return MessageOut(message="Simulação excluída.")
