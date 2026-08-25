"""Geração automática de alertas a partir de regras objetivas."""
from datetime import date, timedelta

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.alerts import Alert
from app.models.clients import Client
from app.models.collections import WeeklyCollection
from app.models.contracts import Contract
from app.models.documents import Document
from app.models.financial import BankTransaction, Payable, Receivable
from app.models.projects import Project


def _open_alerts(db: Session, tipo: str, registro_id: str | None) -> bool:
    q = db.query(Alert.id).filter(
        Alert.tipo == tipo,
        Alert.status.in_(["ABERTO", "EM_ANDAMENTO"]),
    )
    if registro_id:
        q = q.filter(Alert.registro_id == registro_id)
    return db.query(q.exists()).scalar()


def _create(db: Session, tipo, prioridade, titulo, mensagem, client_id=None,
            origem=None, registro_id=None):
    if _open_alerts(db, tipo, registro_id):
        return None
    alert = Alert(
        tipo=tipo,
        prioridade=prioridade,
        titulo=titulo,
        mensagem=mensagem,
        client_id=client_id,
        origem=origem,
        registro_id=registro_id,
    )
    db.add(alert)
    return alert


def generate_alerts(db: Session) -> int:
    """Varre as regras e cria alertas que ainda não estão abertos."""
    today = date.today()
    criados = 0

    # 1) Contas a receber vencidas
    overdue = (
        db.query(Receivable)
        .filter(
            or_(
                Receivable.status == "ATRASADO",
                and_(Receivable.status == "A_RECEBER", Receivable.vencimento < today),
            )
        )
        .all()
    )
    for r in overdue:
        if _create(
            db, "CONTA_VENCIDA", "ALTA",
            "Conta a receber vencida",
            f"Título de R$ {float(r.valor):,.2f} vencido. Cliente: {r.client_id}.",
            client_id=r.client_id, origem="RECEIVABLE", registro_id=str(r.id),
        ):
            criados += 1

    # 2) Contas a pagar vencidas
    payables_overdue = (
        db.query(Payable)
        .filter(
            or_(
                Payable.status == "ATRASADO",
                and_(Payable.status == "PENDENTE", Payable.vencimento < today),
            )
        )
        .all()
    )
    for p in payables_overdue:
        if _create(
            db, "CONTA_PAGAR_VENCIDA", "MEDIA",
            "Conta a pagar vencida",
            f"Fornecedor {p.fornecedor} — R$ {float(p.valor):,.2f} vencido.",
            client_id=p.client_id, origem="PAYABLE", registro_id=str(p.id),
        ):
            criados += 1

    # 3) Contratos próximos do vencimento
    contracts = (
        db.query(Contract)
        .filter(Contract.status == "ATIVO", Contract.termino.isnot(None))
        .all()
    )
    for c in contracts:
        dias = (c.termino - today).days
        if 0 <= dias <= 60:
            if _create(
                db, "CONTRATO_VENCIMENTO", "MEDIA",
                "Contrato próximo do vencimento",
                f"Contrato {c.numero} termina em {dias} dias.",
                client_id=c.client_id, origem="CONTRACT", registro_id=str(c.id),
            ):
                criados += 1

    # 4) Documentos pendentes / aguardando validação
    docs = (
        db.query(Document)
        .filter(Document.status.in_(["PENDENTE", "AGUARDANDO_VALIDACAO"]))
        .all()
    )
    for d in docs:
        tipo = "DOCUMENTO_PENDENTE" if d.status == "PENDENTE" else "DOCUMENTO_VALIDACAO"
        titulo = "Documento pendente" if d.status == "PENDENTE" else "Documento aguardando validação"
        if _create(
            db, tipo, "MEDIA", titulo,
            f"Arquivo {d.arquivo_nome}.",
            client_id=d.client_id, origem="DOCUMENT", registro_id=str(d.id),
        ):
            criados += 1

    # 5) Conciliação divergente
    div = db.query(BankTransaction).filter(BankTransaction.status_conciliacao == "DIVERGENTE").all()
    for bt in div:
        if _create(
            db, "CONCILIACAO_DIVERGENTE", "ALTA",
            "Conciliação bancária divergente",
            f"Transação de R$ {float(bt.valor):,.2f} sem correspondência.",
            client_id=bt.client_id, origem="BANK", registro_id=str(bt.id),
        ):
            criados += 1

    # 6) Projetos acima do orçamento
    projects = db.query(Project).all()
    for p in projects:
        if p.orcamento and p.custo_realizado and p.custo_realizado > p.orcamento:
            if _create(
                db, "PROJETO_ACIMA_ORCAMENTO", "ALTA",
                "Projeto acima do orçamento",
                f"Projeto {p.nome} com custo realizado acima do orçamento.",
                client_id=p.client_id, origem="PROJECT", registro_id=str(p.id),
            ):
                criados += 1

    # 7) Coleta semanal pendente (clientes ativos sem coleta na semana atual)
    seg = today - timedelta(days=today.weekday())
    ativos = db.query(Client).filter(Client.status == "ATIVO").all()
    for cli in ativos:
        tem_coleta = db.query(
            db.query(WeeklyCollection.id)
            .filter(
                WeeklyCollection.client_id == cli.id,
                WeeklyCollection.semana == seg,
            )
            .exists()
        ).scalar()
        if not tem_coleta:
            if _create(
                db, "COLETA_PENDENTE", "MEDIA",
                "Coleta semanal pendente",
                f"Cliente {cli.nome_fantasia or cli.razao_social} sem coleta na semana.",
                client_id=cli.id, origem="COLLECTION", registro_id=str(cli.id),
            ):
                criados += 1

    db.commit()
    return criados
