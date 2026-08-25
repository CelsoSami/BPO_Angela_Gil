-- ============================================================================
-- BUILD FLOW BPO — FASE 1
-- Schema PostgreSQL (executar no Supabase: SQL Editor -> New query)
-- ============================================================================
-- NOTA DE SEGURANÇA:
-- A Fase 1 usa autenticação própria no backend (FastAPI). As tabelas abaixo
-- NÃO possuem RLS habilitado porque o backend é o único gateway de acesso.
-- Em produção avançada, pode-se habilitar RLS por role do banco.
-- ============================================================================

-- Extensão para geração de UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TRIGGER: updated_at automático
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- USUÁRIOS INTERNOS E SESSÕES
-- ============================================================================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT NOT NULL UNIQUE,
  nome          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  cargo         TEXT,
  role          TEXT NOT NULL DEFAULT 'AUXILIAR'
                CHECK (role IN ('ADMIN','GERENTE','AUXILIAR','CONSULTOR')),
  password_hash TEXT NOT NULL,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_login  TIMESTAMPTZ,
  criado_por    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT NOT NULL UNIQUE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip          TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ============================================================================
-- PLANOS E FUNCIONALIDADES
-- ============================================================================
CREATE TABLE plans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo       TEXT NOT NULL UNIQUE,
  nome         TEXT NOT NULL,
  descricao    TEXT,
  preco_mensal NUMERIC(12,2) NOT NULL DEFAULT 0,
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE plan_features (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id   UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  codigo    TEXT NOT NULL,
  nome      TEXT NOT NULL,
  grupo     TEXT,
  ativo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id, codigo)
);

-- ============================================================================
-- CLIENTES (escritórios de arquitetura/engenharia/design)
-- ============================================================================
CREATE TABLE clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social    TEXT NOT NULL,
  nome_fantasia   TEXT,
  cnpj_cpf        TEXT UNIQUE,
  email           TEXT,
  telefone        TEXT,
  endereco        TEXT,
  cidade          TEXT,
  estado          TEXT,
  segmento        TEXT CHECK (segmento IN ('ARQUITETURA','ENGENHARIA','DESIGN_INTERIORES','MULTIDISCIPLINAR','OUTRO')),
  plano_id        UUID REFERENCES plans(id),
  responsavel_bpo UUID REFERENCES users(id),
  data_inicio     DATE,
  data_termino    DATE,
  status          TEXT NOT NULL DEFAULT 'ATIVO'
                  CHECK (status IN ('EM_IMPLANTACAO','ATIVO','SUSPENSO','ENCERRADO')),
  observacoes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_plano ON clients(plano_id);

CREATE TABLE client_contacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  cargo      TEXT,
  email      TEXT,
  telefone   TEXT,
  principal  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CATEGORIAS FINANCEIRAS (globais na Fase 1; cliente_id reservado p/ futuro)
-- dre_line classifica a linha do DRE: receita_bruta | impostos |
-- custos_diretos | despesas_operacionais | despesas_financeiras
-- ============================================================================
CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  tipo       TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
  dre_line   TEXT CHECK (dre_line IN ('receita_bruta','impostos','custos_diretos',
                                      'despesas_operacionais','despesas_financeiras')),
  cliente_id UUID REFERENCES clients(id),
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (nome, tipo)
);

-- ============================================================================
-- PROJETOS
-- ============================================================================
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  codigo          TEXT,
  tipo            TEXT,
  responsavel     TEXT,
  data_inicio     DATE,
  prazo           TEXT,
  data_prevista   DATE,
  data_conclusao  DATE,
  orcamento       NUMERIC(14,2) DEFAULT 0,
  receita         NUMERIC(14,2) DEFAULT 0,
  custo_estimado  NUMERIC(14,2) DEFAULT 0,
  custo_realizado NUMERIC(14,2) DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'PLANEJAMENTO'
                  CHECK (status IN ('PLANEJAMENTO','EM_ANDAMENTO','PAUSADO','CONCLUIDO','CANCELADO')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_projects_client ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);

-- ============================================================================
-- DOCUMENTOS E EXTRAÇÃO
-- (criada antes de contratos/pagar/receber porque estes referenciam documents)
-- ============================================================================
CREATE TABLE documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID REFERENCES clients(id),
  projeto_id   UUID REFERENCES projects(id),
  tipo         TEXT NOT NULL DEFAULT 'OUTRO'
               CHECK (tipo IN ('CONTRATO','NOTA_FISCAL','RECIBO','COMPROVANTE','EXTRATO',
                               'ADMINISTRATIVO','FINANCEIRO','OUTRO')),
  data_documento DATE,
  usuario_id   UUID REFERENCES users(id),
  arquivo_nome TEXT NOT NULL,
  arquivo_url  TEXT,
  tamanho      BIGINT DEFAULT 0,
  mime_type    TEXT,
  status       TEXT NOT NULL DEFAULT 'PENDENTE'
               CHECK (status IN ('PENDENTE','PROCESSADO','AGUARDANDO_VALIDACAO','VALIDADO','REJEITADO')),
  observacao   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_documents_client ON documents(client_id);
CREATE INDEX idx_documents_status ON documents(status);

CREATE TABLE document_extractions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  campo        TEXT NOT NULL,
  valor        TEXT,
  status       TEXT NOT NULL DEFAULT 'EXTRAIDA'
               CHECK (status IN ('EXTRAIDA','VALIDADA','CORRIGIDA','REJEITADA')),
  corrigido_por UUID REFERENCES users(id),
  corrigido_em TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, campo)
);

-- ============================================================================
-- CONTRATOS E PARCELAS
-- ============================================================================
CREATE TABLE contracts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  projeto_id         UUID REFERENCES projects(id),
  numero             TEXT NOT NULL,
  data               DATE,
  inicio             DATE,
  termino            DATE,
  valor              NUMERIC(14,2) DEFAULT 0,
  forma_pagamento    TEXT,
  numero_parcelas    INTEGER DEFAULT 1,
  status             TEXT NOT NULL DEFAULT 'EM_ANALISE'
                     CHECK (status IN ('EM_ANALISE','PENDENTE','ATIVO','CONCLUIDO','CANCELADO')),
  arquivo_documento_id UUID REFERENCES documents(id),
  responsavel        TEXT,
  observacoes        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_contracts_updated_at BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_contracts_client ON contracts(client_id);
CREATE INDEX idx_contracts_status ON contracts(status);

CREATE TABLE contract_installments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id  UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  numero       INTEGER NOT NULL,
  valor        NUMERIC(14,2) DEFAULT 0,
  vencimento   DATE,
  recebimento  DATE,
  status       TEXT NOT NULL DEFAULT 'A_RECEBER'
               CHECK (status IN ('A_RECEBER','RECEBIDO','ATRASADO','CANCELADO')),
  juros        NUMERIC(12,2) DEFAULT 0,
  multa        NUMERIC(12,2) DEFAULT 0,
  documento_id UUID REFERENCES documents(id),
  observacoes  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contract_id, numero)
);

CREATE INDEX idx_installments_contract ON contract_installments(contract_id);
CREATE INDEX idx_installments_status ON contract_installments(status);

-- ============================================================================
-- CONTAS A PAGAR
-- ============================================================================
CREATE TABLE payables (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID REFERENCES clients(id),
  projeto_id     UUID REFERENCES projects(id),
  fornecedor     TEXT NOT NULL,
  categoria_id   UUID REFERENCES categories(id),
  descricao      TEXT,
  valor          NUMERIC(14,2) NOT NULL DEFAULT 0,
  vencimento     DATE,
  data_pagamento DATE,
  status         TEXT NOT NULL DEFAULT 'PENDENTE'
                 CHECK (status IN ('PENDENTE','PAGO','ATRASADO','CANCELADO')),
  centro_custo   TEXT,
  documento_id   UUID REFERENCES documents(id),
  observacoes    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_payables_updated_at BEFORE UPDATE ON payables
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_payables_client ON payables(client_id);
CREATE INDEX idx_payables_status ON payables(status);
CREATE INDEX idx_payables_vencimento ON payables(vencimento);

-- ============================================================================
-- CONTAS A RECEBER
-- ============================================================================
CREATE TABLE receivables (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  projeto_id   UUID REFERENCES projects(id),
  contrato_id  UUID REFERENCES contracts(id),
  descricao    TEXT,
  parcela      INTEGER,
  valor        NUMERIC(14,2) NOT NULL DEFAULT 0,
  vencimento   DATE,
  recebimento  DATE,
  status       TEXT NOT NULL DEFAULT 'A_RECEBER'
               CHECK (status IN ('A_RECEBER','RECEBIDO','ATRASADO','CANCELADO')),
  juros        NUMERIC(12,2) DEFAULT 0,
  multa        NUMERIC(12,2) DEFAULT 0,
  documento_id UUID REFERENCES documents(id),
  observacoes  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_receivables_updated_at BEFORE UPDATE ON receivables
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_receivables_client ON receivables(client_id);
CREATE INDEX idx_receivables_status ON receivables(status);
CREATE INDEX idx_receivables_vencimento ON receivables(vencimento);

-- ============================================================================
-- FLUXO DE CAIXA (registro efetivo de entradas e saídas)
-- origem indica como o lançamento foi criado; origem_id aponta o registro fonte
-- ============================================================================
CREATE TABLE cashflow (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID REFERENCES clients(id),
  projeto_id       UUID REFERENCES projects(id),
  data             DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo             TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  categoria_id     UUID REFERENCES categories(id),
  valor            NUMERIC(14,2) NOT NULL DEFAULT 0,
  descricao        TEXT,
  forma_pagamento  TEXT,
  conciliado       BOOLEAN NOT NULL DEFAULT FALSE,
  origem           TEXT NOT NULL DEFAULT 'manual'
                   CHECK (origem IN ('manual','coleta','importacao','recebivel','pagavel')),
  origem_id        UUID,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cashflow_client ON cashflow(client_id);
CREATE INDEX idx_cashflow_data ON cashflow(data);
CREATE INDEX idx_cashflow_tipo ON cashflow(tipo);
CREATE INDEX idx_cashflow_origem ON cashflow(origem, origem_id);

-- ============================================================================
-- CONCILIAÇÃO BANCÁRIA (preparada para integração futura com bancos)
-- ============================================================================
CREATE TABLE bank_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  conta             TEXT,
  data_movimento    DATE NOT NULL,
  descricao         TEXT,
  valor             NUMERIC(14,2) NOT NULL DEFAULT 0,
  tipo              TEXT CHECK (tipo IN ('entrada','saida')),
  status_conciliacao TEXT NOT NULL DEFAULT 'PENDENTE'
                     CHECK (status_conciliacao IN ('CONCILIADO','PENDENTE','DIVERGENTE')),
  cashflow_id       UUID REFERENCES cashflow(id),
  documento_id      UUID REFERENCES documents(id),
  importado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bank_client ON bank_transactions(client_id);
CREATE INDEX idx_bank_status ON bank_transactions(status_conciliacao);
CREATE INDEX idx_bank_data ON bank_transactions(data_movimento);

-- ============================================================================
-- COLETA SEMANAL
-- ============================================================================
CREATE TABLE weekly_collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  usuario_id  UUID REFERENCES users(id),   -- NULL = criada pelo sistema/seed
  semana      DATE NOT NULL,          -- data da segunda-feira da semana
  data_coleta TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status      TEXT NOT NULL DEFAULT 'EM_ANDAMENTO'
              CHECK (status IN ('PENDENTE','EM_ANDAMENTO','CONCLUIDA')),
  observacoes TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, semana)
);

CREATE INDEX idx_collections_client ON weekly_collections(client_id);
CREATE INDEX idx_collections_semana ON weekly_collections(semana);

CREATE TABLE collection_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES weekly_collections(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL
                CHECK (tipo IN ('CONTRATO','GASTO_EXTRA','ENTRADA','SAIDA','PAGAMENTO',
                                'RECEBIMENTO','DIVERGENCIA','DOCUMENTO')),
  descricao     TEXT,
  valor         NUMERIC(14,2) DEFAULT 0,
  data_item     DATE,
  projeto_id    UUID REFERENCES projects(id),
  contrato_id   UUID REFERENCES contracts(id),
  status        TEXT DEFAULT 'REGISTRADO',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_collection_items_collection ON collection_items(collection_id);

-- ============================================================================
-- ALERTAS
-- ============================================================================
CREATE TABLE alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID REFERENCES clients(id),
  tipo          TEXT NOT NULL,
  prioridade    TEXT NOT NULL DEFAULT 'MEDIA' CHECK (prioridade IN ('ALTA','MEDIA','BAIXA')),
  titulo        TEXT NOT NULL,
  mensagem      TEXT,
  data          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responsavel_id UUID REFERENCES users(id),
  status        TEXT NOT NULL DEFAULT 'ABERTO'
                CHECK (status IN ('ABERTO','EM_ANDAMENTO','RESOLVIDO','CANCELADO')),
  origem        TEXT,
  registro_id   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);

CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_client ON alerts(client_id);
CREATE INDEX idx_alerts_prioridade ON alerts(prioridade);

-- ============================================================================
-- SIMULAÇÕES DE PRECIFICAÇÃO
-- ============================================================================
CREATE TABLE pricing_simulations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          UUID REFERENCES clients(id),
  titulo             TEXT,
  servico            TEXT NOT NULL,
  horas              NUMERIC(10,2) DEFAULT 0,
  custo_hora         NUMERIC(12,2) DEFAULT 0,
  equipe             JSONB DEFAULT '[]',
  despesas           NUMERIC(14,2) DEFAULT 0,
  impostos_pct       NUMERIC(6,2) DEFAULT 0,
  margem_desejada_pct NUMERIC(6,2) DEFAULT 0,
  prazo_dias         INTEGER,
  complexidade       TEXT CHECK (complexidade IN ('BAIXA','MEDIA','ALTA')),
  custo_direto       NUMERIC(14,2) DEFAULT 0,
  custos_indiretos   NUMERIC(14,2) DEFAULT 0,
  impostos_valor     NUMERIC(14,2) DEFAULT 0,
  margem_valor       NUMERIC(14,2) DEFAULT 0,
  preco_sugerido     NUMERIC(14,2) DEFAULT 0,
  cenario            TEXT NOT NULL DEFAULT 'RECOMENDADO'
                     CHECK (cenario IN ('CONSERVADOR','RECOMENDADO','AGRESSIVO')),
  created_by         UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PLANO DE ACOMPANHAMENTO (ações manuais)
-- ============================================================================
CREATE TABLE action_plans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID REFERENCES clients(id),
  titulo         TEXT NOT NULL,
  descricao      TEXT,
  responsavel_id UUID REFERENCES users(id),
  prioridade     TEXT NOT NULL DEFAULT 'MEDIA' CHECK (prioridade IN ('ALTA','MEDIA','BAIXA')),
  prazo          DATE,
  status         TEXT NOT NULL DEFAULT 'NAO_INICIADO'
                 CHECK (status IN ('NAO_INICIADO','EM_ANDAMENTO','CONCLUIDO','CANCELADO')),
  observacoes    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_action_plans_updated_at BEFORE UPDATE ON action_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- SAÚDE FINANCEIRA (snapshot mensal calculado por regras objetivas)
-- ============================================================================
CREATE TABLE financial_health (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  mes           INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano           INTEGER NOT NULL,
  classificacao TEXT NOT NULL CHECK (classificacao IN ('SAUDAVEL','ATENCAO','CRITICO')),
  score         NUMERIC(5,2) DEFAULT 0,
  regras_json   JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, mes, ano)
);

-- ============================================================================
-- RELATÓRIOS GERADOS
-- ============================================================================
CREATE TABLE reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID REFERENCES clients(id),
  tipo         TEXT NOT NULL DEFAULT 'MENSAL',
  mes          INTEGER,
  ano          INTEGER,
  titulo       TEXT,
  conteudo_json JSONB DEFAULT '{}',
  arquivo_url  TEXT,
  criado_por   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_client ON reports(client_id);

-- ============================================================================
-- ATIVOS E EQUIPAMENTOS
-- ============================================================================
CREATE TABLE assets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID REFERENCES clients(id),   -- NULL = ativo interno do BPO
  nome           TEXT NOT NULL,
  tipo           TEXT,
  numero_serie   TEXT,
  valor          NUMERIC(14,2) DEFAULT 0,
  data_aquisicao DATE,
  status         TEXT NOT NULL DEFAULT 'ATIVO'
                 CHECK (status IN ('ATIVO','EM_MANUTENCAO','BAIXADO')),
  observacoes    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_assets_updated_at BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- PROCESSOS INTERNOS
-- ============================================================================
CREATE TABLE processes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           TEXT NOT NULL,
  descricao      TEXT,
  responsavel_id UUID REFERENCES users(id),
  frequencia     TEXT,
  status         TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO','INATIVO')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_processes_updated_at BEFORE UPDATE ON processes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- AUDITORIA
-- ============================================================================
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID REFERENCES users(id),
  acao          TEXT NOT NULL,
  modulo        TEXT NOT NULL,
  registro_id   TEXT,
  valor_anterior JSONB,
  valor_novo    JSONB,
  ip            TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_modulo ON audit_logs(modulo);
CREATE INDEX idx_audit_usuario ON audit_logs(usuario_id);
CREATE INDEX idx_audit_data ON audit_logs(created_at);

-- ============================================================================
-- CONFIGURAÇÕES
-- ============================================================================
CREATE TABLE settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave       TEXT NOT NULL UNIQUE,
  valor       TEXT,
  descricao   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
