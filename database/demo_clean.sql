-- ============================================================================
-- BUILD FLOW BPO — LIMPEZA DOS DADOS DE DEMONSTRAÇÃO
-- ============================================================================
-- Remove TODOS os dados de demonstração (seed básico + gerador estendido),
-- incluindo planos, categorias e configurações (referências recriadas pelo
-- seed no próximo boot). O usuário admin é MANTIDO (login preservado).
--
-- Após limpar, o app regenera tudo automaticamente no próximo boot
-- (SEED_DEMO_ON_STARTUP=true + DEMO_EXTENDED=true).
-- ============================================================================

TRUNCATE TABLE
  reports,
  financial_health,
  action_plans,
  pricing_simulations,
  alerts,
  collection_items,
  weekly_collections,
  bank_transactions,
  cashflow,
  receivables,
  payables,
  contract_installments,
  contracts,
  document_extractions,
  documents,
  projects,
  client_contacts,
  clients,
  plans,
  plan_features,
  categories,
  settings,
  audit_logs,
  sessions
CASCADE;
