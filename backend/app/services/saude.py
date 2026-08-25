"""Saúde financeira por regras objetivas configuráveis (sem IA)."""
import json
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.admin import FinancialHealth, Setting
from app.services import inadimplencia
from app.services.dre import compute_dre
from app.utils.dates import month_range

DEFAULT_RULES = {
    "inadimplencia_pct_max": 5.0,
    "margem_min": 15.0,
    "resultado_negativo_max_meses": 2,
    "vencidas_max": 2,
    "peso_inadimplencia": 25,
    "peso_margem": 20,
    "peso_resultado": 15,
    "peso_vencidas": 15,
    "peso_saldo": 10,
}


def _dec(v) -> Decimal:
    return Decimal(str(v or 0))


def _load_rules(db: Session) -> dict:
    row = db.query(Setting).filter(Setting.chave == "health_rules").first()
    if not row or not row.valor:
        return dict(DEFAULT_RULES)
    try:
        rules = json.loads(row.valor)
        merged = dict(DEFAULT_RULES)
        merged.update(rules)
        return merged
    except Exception:
        return dict(DEFAULT_RULES)


def classify(db: Session, client_id, mes: int, ano: int) -> dict:
    """Classifica a saúde financeira do cliente no mês e persiste o snapshot."""
    rules = _load_rules(db)
    dre = compute_dre(db, client_id, mes, ano)
    inad = inadimplencia.compute_panel(db, client_id=client_id)

    total_receitas = _dec(dre["receita_bruta"])
    inad_pct = (
        _dec(inad["total_vencido"]) / total_receitas * 100
        if total_receitas
        else Decimal("0")
    )
    margem = _dec(dre["resultado_liquido"]) / total_receitas * 100 if total_receitas else Decimal("0")
    vencidas = inad["quantidade_titulos"]
    resultado_negativo = _dec(dre["resultado_liquido"]) < 0
    saldo = _dec(dre["receita_bruta"]) - _dec(dre["despesas_operacionais"]) - _dec(dre["custos_diretos"]) - _dec(dre["impostos"]) - _dec(dre["despesas_financeiras"])

    score = Decimal("100")
    motivos = []
    if inad_pct > _dec(rules["inadimplencia_pct_max"]):
        score -= _dec(rules["peso_inadimplencia"])
        motivos.append(f"Inadimplência de {inad_pct:.1f}% acima do limite")
    if margem < _dec(rules["margem_min"]):
        score -= _dec(rules["peso_margem"])
        motivos.append(f"Margem de {margem:.1f}% abaixo do mínimo")
    if resultado_negativo:
        score -= _dec(rules["peso_resultado"])
        motivos.append("Resultado líquido negativo no mês")
    if vencidas > int(rules["vencidas_max"]):
        score -= _dec(rules["peso_vencidas"])
        motivos.append(f"{vencidas} títulos vencidos acima do limite")
    if saldo < 0:
        score -= _dec(rules["peso_saldo"])
        motivos.append("Saldo do mês negativo")

    score = max(Decimal("0"), score)
    if score >= 70:
        classificacao = "SAUDAVEL"
    elif score >= 45:
        classificacao = "ATENCAO"
    else:
        classificacao = "CRITICO"

    regras = {
        "score": float(score),
        "classificacao": classificacao,
        "inadimplencia_pct": float(inad_pct),
        "margem": float(margem),
        "resultado": float(_dec(dre["resultado_liquido"])),
        "vencidas": vencidas,
        "motivos": motivos,
        "rules": rules,
    }

    # Upsert do snapshot mensal
    snap = (
        db.query(FinancialHealth)
        .filter(
            FinancialHealth.client_id == client_id,
            FinancialHealth.mes == mes,
            FinancialHealth.ano == ano,
        )
        .first()
    )
    if snap is None:
        snap = FinancialHealth(client_id=client_id, mes=mes, ano=ano)
        db.add(snap)
    snap.classificacao = classificacao
    snap.score = float(score)
    snap.regras_json = regras
    return regras
