"""Modelos ORM — reexporta todas as entidades."""
from app.models.auth import Session as SessionModel
from app.models.auth import User
from app.models.plans import Plan, PlanFeature
from app.models.clients import Client, ClientContact
from app.models.projects import Project
from app.models.documents import Document, DocumentExtraction
from app.models.contracts import Contract, ContractInstallment
from app.models.financial import (
    BankTransaction,
    Cashflow,
    Category,
    Payable,
    Receivable,
)
from app.models.collections import CollectionItem, WeeklyCollection
from app.models.alerts import Alert
from app.models.pricing import PricingSimulation
from app.models.admin import (
    ActionPlan,
    Asset,
    AuditLog,
    FinancialHealth,
    Process,
    Report,
    Setting,
)

__all__ = [
    "User",
    "SessionModel",
    "Plan",
    "PlanFeature",
    "Client",
    "ClientContact",
    "Project",
    "Document",
    "DocumentExtraction",
    "Contract",
    "ContractInstallment",
    "Category",
    "Payable",
    "Receivable",
    "Cashflow",
    "BankTransaction",
    "WeeklyCollection",
    "CollectionItem",
    "Alert",
    "PricingSimulation",
    "ActionPlan",
    "Asset",
    "Process",
    "FinancialHealth",
    "Report",
    "Setting",
    "AuditLog",
]
