-- ============================================================================
-- BUILD FLOW BPO — GERADOR DE DADOS PARA APRESENTAÇÃO (100% fictícios)
-- ============================================================================
-- Gera um volume robusto de dados demonstrativos para mostrar o poder da
-- ferramenta: ~50 escritórios, ~150 projetos, ~80 contratos, ~300 contas a
-- receber, ~2.000 contas a pagar, ~1.000 lançamentos de fluxo de caixa
-- (12 meses), documentos, alertas, saúde financeira e relatórios.
--
-- COMO USAR:
--   1) (Recomendado) execute primeiro database/demo_clean.sql para começar limpo;
--   2) execute este script no SQL Editor do banco que o aplicativo usa.
--   Reexecutável somente após o clean (os CNPJs '00.' são únicos por execução).
--
-- No Render Postgres, o app executa este script automaticamente quando
-- DEMO_EXTENDED=true e há poucos clientes (sem precisar de SQL Editor).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) REFERÊNCIAS: planos, funcionalidades e categorias (se não existirem)
-- ---------------------------------------------------------------------------
INSERT INTO plans (id, codigo, nome, descricao, preco_mensal, ativo) VALUES
('00000000-0000-0000-0000-0000000000A1','ESSENCIAL','Essencial','Controle financeiro básico, fluxo de caixa, conciliação, relatórios essenciais e auxílio na precificação.',490.00,TRUE),
('00000000-0000-0000-0000-0000000000A2','FLOW','Flow','Tudo do Essencial + organização documental, indicadores estratégicos (KPIs), DRE gerencial e dashboards.',990.00,TRUE),
('00000000-0000-0000-0000-0000000000A3','PRO','Pro','Tudo do Flow + reuniões de acompanhamento consultivo, relatórios completos e planejamento orçamentário.',1990.00,TRUE)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO plan_features (id, plan_id, codigo, nome, grupo) VALUES
(gen_random_uuid(),'00000000-0000-0000-0000-0000000000A1','CONTROLE_FINANCEIRO','Controle financeiro básico','Financeiro'),
(gen_random_uuid(),'00000000-0000-0000-0000-0000000000A1','FLUXO_CAIXA','Fluxo de caixa','Financeiro'),
(gen_random_uuid(),'00000000-0000-0000-0000-0000000000A1','CONCILIACAO','Conciliação bancária','Financeiro'),
(gen_random_uuid(),'00000000-0000-0000-0000-0000000000A2','ORGANIZACAO_DOCUMENTAL','Organização documental','Documentos'),
(gen_random_uuid(),'00000000-0000-0000-0000-0000000000A2','INDICADORES_KPI','Indicadores estratégicos (KPIs)','Indicadores'),
(gen_random_uuid(),'00000000-0000-0000-0000-0000000000A2','DRE_DASHBOARDS','DRE gerencial e dashboards','Financeiro'),
(gen_random_uuid(),'00000000-0000-0000-0000-0000000000A3','REUNIOES_ACOMPANHAMENTO','Reuniões de acompanhamento consultivo','Consultoria'),
(gen_random_uuid(),'00000000-0000-0000-0000-0000000000A3','PLANEJAMENTO_ORCAMENTARIO','Planejamento orçamentário com apoio à decisão','Consultoria')
ON CONFLICT (plan_id, codigo) DO NOTHING;

INSERT INTO categories (id, nome, tipo, dre_line, ativo) VALUES
(gen_random_uuid(),'Honorários de Projeto','receita','receita_bruta',TRUE),
(gen_random_uuid(),'Consultoria Técnica','receita','receita_bruta',TRUE),
(gen_random_uuid(),'Acompanhamento de Obra','receita','receita_bruta',TRUE),
(gen_random_uuid(),'Aditivos e Revisões','receita','receita_bruta',TRUE),
(gen_random_uuid(),'Impostos e Taxas','despesa','impostos',TRUE),
(gen_random_uuid(),'Mão de Obra de Projeto','despesa','custos_diretos',TRUE),
(gen_random_uuid(),'Software e Licenças','despesa','custos_diretos',TRUE),
(gen_random_uuid(),'Impressões e Plotagem','despesa','custos_diretos',TRUE),
(gen_random_uuid(),'Deslocamentos e Diárias','despesa','custos_diretos',TRUE),
(gen_random_uuid(),'Aluguel e Condomínio','despesa','despesas_operacionais',TRUE),
(gen_random_uuid(),'Salários Administrativos','despesa','despesas_operacionais',TRUE),
(gen_random_uuid(),'Marketing e Divulgação','despesa','despesas_operacionais',TRUE),
(gen_random_uuid(),'Contabilidade','despesa','despesas_operacionais',TRUE),
(gen_random_uuid(),'Juros e Tarifas Bancárias','despesa','despesas_financeiras',TRUE)
ON CONFLICT (nome, tipo) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 1) CLIENTES (~50 escritórios) — CNPJs no padrão '00.'
-- ---------------------------------------------------------------------------
INSERT INTO clients (id, razao_social, nome_fantasia, cnpj_cpf, email, telefone,
                     endereco, cidade, estado, segmento, plano_id, data_inicio,
                     data_termino, status, observacoes)
SELECT
  gen_random_uuid(),
  'Escritório ' || LPAD(i::text, 3, '0') || ' ' ||
    (ARRAY['Arquitetura Ltda','Engenharia S/S','Interiores ME','Multidisciplinar Ltda'])[1 + i % 4],
  (ARRAY['Ateliê','Vetor','Studio','Núcleo'])[1 + i % 4] || ' ' || LPAD(i::text, 3, '0'),
  '00.' || LPAD(((i * 37) % 100)::text, 3, '0') || '.' || LPAD(((i * 89) % 100)::text, 3, '0')
    || '/0001-' || LPAD(((i * 17) % 100)::text, 2, '0'),
  'contato' || i || '@demo.buildflow.com.br',
  '(11) 9' || LPAD(((i * 1234) % 100000000)::text, 8, '0'),
  'Rua das Flores, ' || (i * 7),
  (ARRAY['São Paulo','Rio de Janeiro','Belo Horizonte','Curitiba','Porto Alegre','Florianópolis','Salvador','Recife'])[1 + i % 8],
  (ARRAY['SP','RJ','MG','PR','RS','SC','BA','PE'])[1 + i % 8],
  (ARRAY['ARQUITETURA','ENGENHARIA','DESIGN_INTERIORES','MULTIDISCIPLINAR'])[1 + i % 4],
  (SELECT id FROM plans WHERE codigo = (ARRAY['ESSENCIAL','FLOW','PRO'])[1 + i % 3]),
  (CURRENT_DATE - (((i % 24) + 6) * 30 || ' days')::interval)::date,
  NULL,
  (ARRAY['ATIVO','ATIVO','ATIVO','SUSPENSO'])[1 + i % 4],
  'Cliente demonstrativo gerado para apresentação.'
FROM generate_series(1, 50) AS i
ON CONFLICT (cnpj_cpf) DO NOTHING;

-- Contatos (2 por escritório)
INSERT INTO client_contacts (id, client_id, nome, cargo, email, telefone, principal)
SELECT gen_random_uuid(), c.id,
  (ARRAY['Marina','Ricardo','Lívia','Carlos','Paula','João'])[1 + k % 6] || ' ' || (ARRAY['Duarte','Veiga','Prado','Menezes','Nogueira','Silva'])[1 + k % 6],
  (ARRAY['Sócio(a)','Diretor(a)','Gerente de Projetos','Coordenador(a)'])[1 + k % 4],
  'contato' || (k + (row_number() OVER ())::int % 997) || '@demo.buildflow.com.br',
  '(11) 9' || LPAD(((k * 555) % 100000000)::text, 8, '0'),
  (k = 1)
FROM clients c CROSS JOIN generate_series(1, 2) AS k
WHERE c.cnpj_cpf LIKE '00.%';

-- ---------------------------------------------------------------------------
-- 2) PROJETOS (3 por escritório = ~150)
-- ---------------------------------------------------------------------------
INSERT INTO projects (id, client_id, nome, codigo, tipo, responsavel, data_inicio,
                      prazo, data_prevista, data_conclusao, orcamento, receita,
                      custo_estimado, custo_realizado, status)
SELECT
  gen_random_uuid(),
  c.id,
  (ARRAY['Residência','Edifício Comercial','Reforma','Projeto Estrutural','Interiores','Ponte','Clínica','Laudo'])[1 + ((idx + k) % 8)]
    || ' ' || (ARRAY['Alameda','Centro','Jardins','Parque','Praia','Bairro Sul','Torre','Vila'])[1 + ((idx + k * 3) % 8)],
  'PRJ-D' || LPAD(idx::text, 3, '0') || '-' || k,
  (ARRAY['Projeto Arquitetônico','Projeto Estrutural','Design de Interiores','Laudo Técnico','Consultoria'])[1 + ((idx + k) % 5)],
  (ARRAY['Marina Duarte','Ricardo Veiga','Ana Souza','Carlos Menezes'])[1 + ((idx + k) % 4)],
  (CURRENT_DATE - ((idx % 12 + k * 4) * 30 || ' days')::interval)::date,
  (4 + k) || ' meses',
  (CURRENT_DATE + (((idx % 6) + k * 2) * 30 || ' days')::interval)::date,
  CASE WHEN (idx + k) % 4 = 0 THEN (CURRENT_DATE - ((idx % 9) * 20 || ' days')::interval)::date ELSE NULL END,
  (20000 + (idx * 1370) % 150000)::numeric,
  CASE WHEN (idx + k) % 4 = 0 THEN (20000 + (idx * 1370) % 150000)::numeric ELSE ((20000 + (idx * 1370) % 150000) * 0.6)::numeric END,
  ((20000 + (idx * 1370) % 150000) * 0.5)::numeric,
  (((20000 + (idx * 1370) % 150000) * 0.5) * (1 + ((idx + k) % 5) * 0.02))::numeric,
  (ARRAY['PLANEJAMENTO','EM_ANDAMENTO','EM_ANDAMENTO','CONCLUIDO','PAUSADO'])[1 + ((idx + k) % 5)]
FROM (SELECT id, row_number() OVER (ORDER BY id) AS idx FROM clients WHERE cnpj_cpf LIKE '00.%') c
CROSS JOIN generate_series(1, 3) AS k;

-- ---------------------------------------------------------------------------
-- 3) CONTRATOS (2 por escritório = ~100) + PARCELAS (4 por contrato)
-- ---------------------------------------------------------------------------
INSERT INTO contracts (id, client_id, projeto_id, numero, data, inicio, termino,
                       valor, forma_pagamento, numero_parcelas, status,
                       arquivo_documento_id, responsavel, observacoes)
SELECT
  gen_random_uuid(),
  c.id,
  (SELECT p.id FROM projects p WHERE p.client_id = c.id ORDER BY p.created_at LIMIT 1),
  'CT-DEMO-' || LPAD((row_number() OVER ())::text, 5, '0'),
  (CURRENT_DATE - ((idx % 10 + 2) * 30 || ' days')::interval)::date,
  (CURRENT_DATE - ((idx % 10 + 2) * 30 || ' days')::interval)::date,
  CASE WHEN (idx + k) % 3 = 0 THEN (CURRENT_DATE + ((idx % 8 + 2) * 30 || ' days')::interval)::date ELSE NULL END,
  (30000 + (idx * 2230) % 180000)::numeric,
  (ARRAY['Parcelado 4x','À vista','Parcelado 6x'])[1 + ((idx + k) % 3)],
  4,
  (ARRAY['ATIVO','ATIVO','ATIVO','CONCLUIDO','EM_ANALISE'])[1 + ((idx + k) % 5)],
  NULL,
  (ARRAY['Marina Duarte','Ricardo Veiga'])[1 + ((idx + k) % 2)],
  'Contrato demonstrativo (apresentação).'
FROM (SELECT id, row_number() OVER (ORDER BY id) AS idx FROM clients WHERE cnpj_cpf LIKE '00.%') c
CROSS JOIN generate_series(1, 2) AS k;

INSERT INTO contract_installments (id, contract_id, numero, valor, vencimento,
                                   recebimento, status, juros, multa)
SELECT
  gen_random_uuid(), ct.id, n,
  (ct.valor / 4)::numeric,
  (ct.inicio + ((n - 1) * 30 || ' days')::interval)::date,
  CASE WHEN (ct.inicio + ((n - 1) * 30 || ' days')::interval)::date < CURRENT_DATE - 5
       THEN ((ct.inicio + ((n - 1) * 30 || ' days')::interval)::date + 3) ELSE NULL END,
  CASE WHEN (ct.inicio + ((n - 1) * 30 || ' days')::interval)::date < CURRENT_DATE - 5 THEN 'RECEBIDO'
       WHEN (ct.inicio + ((n - 1) * 30 || ' days')::interval)::date < CURRENT_DATE THEN 'ATRASADO'
       ELSE 'A_RECEBER' END,
  0, 0
FROM contracts ct CROSS JOIN generate_series(1, 4) AS n
WHERE ct.numero LIKE 'CT-DEMO-%';

-- ---------------------------------------------------------------------------
-- 4) CONTAS A RECEBER (espelha as parcelas dos contratos)
-- ---------------------------------------------------------------------------
INSERT INTO receivables (id, client_id, projeto_id, contrato_id, descricao, parcela,
                         valor, vencimento, recebimento, status, juros, multa)
SELECT
  gen_random_uuid(), ct.client_id, ct.projeto_id, ct.id,
  'Parcela ' || n || ' — ' || ct.numero, n,
  (ct.valor / 4)::numeric,
  (ct.inicio + ((n - 1) * 30 || ' days')::interval)::date,
  CASE WHEN (ct.inicio + ((n - 1) * 30 || ' days')::interval)::date < CURRENT_DATE - 5
       THEN ((ct.inicio + ((n - 1) * 30 || ' days')::interval)::date + 3) ELSE NULL END,
  CASE WHEN (ct.inicio + ((n - 1) * 30 || ' days')::interval)::date < CURRENT_DATE - 5 THEN 'RECEBIDO'
       WHEN (ct.inicio + ((n - 1) * 30 || ' days')::interval)::date < CURRENT_DATE THEN 'ATRASADO'
       ELSE 'A_RECEBER' END,
  0, 0
FROM contracts ct CROSS JOIN generate_series(1, 4) AS n
WHERE ct.numero LIKE 'CT-DEMO-%';

-- ---------------------------------------------------------------------------
-- 5) FLUXO DE CAIXA — entradas e saídas mensais (12 meses por escritório)
-- ---------------------------------------------------------------------------
INSERT INTO cashflow (id, client_id, data, tipo, categoria_id, valor, descricao,
                      forma_pagamento, conciliado, origem)
SELECT
  gen_random_uuid(), c.id,
  ((CURRENT_DATE - INTERVAL '11 months') + ((m - 1) * 30 || ' days')::interval)::date,
  'entrada',
  (SELECT id FROM categories WHERE nome = 'Honorários de Projeto'),
  (15000 + ((idx * 1733) % 40000))::numeric,
  'DEMO - Recebimento mensal de honorários',
  'PIX', TRUE, 'manual'
FROM (SELECT id, row_number() OVER (ORDER BY id) AS idx FROM clients WHERE cnpj_cpf LIKE '00.%') c
CROSS JOIN generate_series(1, 12) AS m;

INSERT INTO cashflow (id, client_id, data, tipo, categoria_id, valor, descricao,
                      forma_pagamento, conciliado, origem)
SELECT
  gen_random_uuid(), c.id,
  ((CURRENT_DATE - INTERVAL '11 months') + ((m - 1) * 30 || ' days')::interval)::date + 5,
  'saida',
  (SELECT id FROM categories WHERE nome = (ARRAY['Aluguel e Condomínio','Salários Administrativos','Impostos e Taxas','Software e Licenças','Marketing e Divulgação'])[1 + (m % 5)]),
  ((15000 + ((idx * 1733) % 40000)) * (0.45 + ((idx % 5) * 0.05)))::numeric,
  'DEMO - Despesa operacional mensal',
  'Débito', TRUE, 'manual'
FROM (SELECT id, row_number() OVER (ORDER BY id) AS idx FROM clients WHERE cnpj_cpf LIKE '00.%') c
CROSS JOIN generate_series(1, 12) AS m;

-- ---------------------------------------------------------------------------
-- 6) CONTAS A PAGAR — 4 compromissos mensais por escritório (12 meses)
-- ---------------------------------------------------------------------------
INSERT INTO payables (id, client_id, projeto_id, fornecedor, categoria_id, descricao,
                      valor, vencimento, data_pagamento, status, centro_custo)
SELECT
  gen_random_uuid(), c.id, NULL,
  (ARRAY['Imobiliária Central','Folha de Pagamento','Receita Federal','Gráfica PrintTech','Software SA','Agência Digital'])[1 + ((m + k) % 6)],
  (SELECT id FROM categories WHERE nome = (ARRAY['Aluguel e Condomínio','Salários Administrativos','Impostos e Taxas','Impressões e Plotagem','Software e Licenças','Marketing e Divulgação'])[1 + ((m + k) % 6)]),
  'DEMO - ' || (ARRAY['Aluguel','Folha mensal','Impostos','Plotagem','Licenças','Anúncios'])[1 + ((m + k) % 6)],
  ((1200 + ((idx * 211) % 9000)) * (1 + (k % 2) * 2))::numeric,
  ((CURRENT_DATE - INTERVAL '11 months') + ((m - 1) * 30 || ' days')::interval)::date + 8 + k,
  CASE WHEN ((CURRENT_DATE - INTERVAL '11 months') + ((m - 1) * 30 || ' days')::interval)::date + 8 + k < CURRENT_DATE
       THEN ((CURRENT_DATE - INTERVAL '11 months') + ((m - 1) * 30 || ' days')::interval)::date + 10 + k ELSE NULL END,
  CASE WHEN ((CURRENT_DATE - INTERVAL '11 months') + ((m - 1) * 30 || ' days')::interval)::date + 8 + k < CURRENT_DATE - 5 THEN 'PAGO'
       WHEN ((CURRENT_DATE - INTERVAL '11 months') + ((m - 1) * 30 || ' days')::interval)::date + 8 + k < CURRENT_DATE THEN 'ATRASADO'
       ELSE 'PENDENTE' END,
  (ARRAY['ADMINISTRATIVO','TRIBUTOS','FERRAMENTAS','MARKETING'])[1 + ((m + k) % 4)]
FROM (SELECT id, row_number() OVER (ORDER BY id) AS idx FROM clients WHERE cnpj_cpf LIKE '00.%') c
CROSS JOIN generate_series(1, 12) AS m
CROSS JOIN generate_series(1, 4) AS k;

-- ---------------------------------------------------------------------------
-- 7) CONCILIAÇÃO BANCÁRIA (espelha ~85% do caixa gerado)
-- ---------------------------------------------------------------------------
INSERT INTO bank_transactions (id, client_id, conta, data_movimento, descricao, valor,
                               tipo, status_conciliacao, cashflow_id, documento_id)
SELECT
  gen_random_uuid(), cf.client_id, 'Conta PJ — Demo', cf.data, cf.descricao,
  CASE WHEN cf.tipo = 'saida' THEN (-cf.valor) ELSE cf.valor END,
  cf.tipo,
  CASE WHEN random() < 0.85 THEN 'CONCILIADO' WHEN random() < 0.5 THEN 'PENDENTE' ELSE 'DIVERGENTE' END,
  CASE WHEN random() < 0.85 THEN cf.id ELSE NULL END,
  NULL
FROM cashflow cf
WHERE cf.origem = 'manual' AND cf.descricao LIKE 'DEMO-%';

-- ---------------------------------------------------------------------------
-- 8) DOCUMENTOS (4 por escritório)
-- ---------------------------------------------------------------------------
INSERT INTO documents (id, client_id, projeto_id, tipo, data_documento, arquivo_nome,
                       arquivo_url, tamanho, mime_type, status, observacao)
SELECT
  gen_random_uuid(), c.id,
  (SELECT p.id FROM projects p WHERE p.client_id = c.id ORDER BY p.created_at LIMIT 1),
  (ARRAY['CONTRATO','NOTA_FISCAL','RECIBO','EXTRATO'])[k],
  (CURRENT_DATE - ((k * 25 + idx % 20) || ' days')::interval)::date,
  'demo_' || idx || '_' || lower((ARRAY['contrato','nota_fiscal','recibo','extrato'])[k]) || '.pdf',
  '/documents/demo/' || idx || '/' || lower((ARRAY['contrato','nota_fiscal','recibo','extrato'])[k]) || '.pdf',
  (150000 + (idx * 791) % 900000)::bigint,
  'application/pdf',
  (ARRAY['VALIDADO','VALIDADO','PROCESSADO','AGUARDANDO_VALIDACAO','PENDENTE'])[1 + ((idx + k) % 5)],
  'Documento demonstrativo (apresentação).'
FROM (SELECT id, row_number() OVER (ORDER BY id) AS idx FROM clients WHERE cnpj_cpf LIKE '00.%') c
CROSS JOIN generate_series(1, 4) AS k;

-- ---------------------------------------------------------------------------
-- 9) ALERTAS (contas vencidas dos contratos demo)
-- ---------------------------------------------------------------------------
INSERT INTO alerts (id, client_id, tipo, prioridade, titulo, mensagem, status, origem, registro_id)
SELECT gen_random_uuid(), r.client_id, 'CONTA_VENCIDA',
  CASE WHEN r.valor > 50000 THEN 'ALTA' ELSE 'MEDIA' END,
  'Conta a receber vencida',
  'Parcela em atraso (dados demonstrativos).',
  'ABERTO', 'RECEIVABLE', r.id::text
FROM receivables r
JOIN contracts ct ON ct.id = r.contrato_id
WHERE r.status = 'ATRASADO' AND ct.numero LIKE 'CT-DEMO-%';

-- ---------------------------------------------------------------------------
-- 10) SAÚDE FINANCEIRA (snapshot do mês atual por escritório)
-- ---------------------------------------------------------------------------
INSERT INTO financial_health (id, client_id, mes, ano, classificacao, score, regras_json)
SELECT gen_random_uuid(), c.id,
  EXTRACT(MONTH FROM CURRENT_DATE)::int, EXTRACT(YEAR FROM CURRENT_DATE)::int,
  (ARRAY['SAUDAVEL','SAUDAVEL','ATENCAO','CRITICO'])[1 + (idx % 4)],
  (92 - (idx % 4) * 24)::numeric,
  jsonb_build_object('demo', true, 'idx', idx)
FROM (SELECT id, row_number() OVER (ORDER BY id) AS idx FROM clients WHERE cnpj_cpf LIKE '00.%') c
ON CONFLICT (client_id, mes, ano) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 11) RELATÓRIOS (um por escritório, mês atual)
-- ---------------------------------------------------------------------------
INSERT INTO reports (id, client_id, tipo, mes, ano, titulo, conteudo_json, arquivo_url)
SELECT gen_random_uuid(), c.id, 'MENSAL',
  EXTRACT(MONTH FROM CURRENT_DATE)::int, EXTRACT(YEAR FROM CURRENT_DATE)::int,
  'Relatório Gerencial Mensal — ' || c.nome_fantasia,
  jsonb_build_object(
    'resumo_executivo', 'Mês estável (dados demonstrativos).',
    'resultado_liquido', 1000 * (1 + idx % 40),
    'fluxo_caixa_final', 2000 * (1 + idx % 30),
    'pontos_atencao', jsonb_build_array('Atenção demonstrativa')
  ),
  '/reports/demo_' || c.id || '.pdf'
FROM (SELECT id, nome_fantasia, row_number() OVER (ORDER BY id) AS idx FROM clients WHERE cnpj_cpf LIKE '00.%') c;

-- ---------------------------------------------------------------------------
-- 12) COLETA SEMANAL (uma por escritório, semana atual) + ITENS
-- ---------------------------------------------------------------------------
INSERT INTO weekly_collections (id, client_id, usuario_id, semana, data_coleta, status, observacoes)
SELECT gen_random_uuid(), c.id, NULL,
  (CURRENT_DATE - ((EXTRACT(ISODOW FROM CURRENT_DATE)::int - 1) || ' days')::interval)::date,
  CURRENT_DATE - 1,
  (ARRAY['CONCLUIDA','CONCLUIDA','EM_ANDAMENTO'])[1 + (idx % 3)],
  'Coleta demonstrativa (apresentação).'
FROM (SELECT id, row_number() OVER (ORDER BY id) AS idx FROM clients WHERE cnpj_cpf LIKE '00.%') c
ON CONFLICT (client_id, semana) DO NOTHING;

INSERT INTO collection_items (id, collection_id, tipo, descricao, valor, data_item, status)
SELECT gen_random_uuid(), w.id,
  (ARRAY['ENTRADA','SAIDA','GASTO_EXTRA','DOCUMENTO'])[k],
  'DEMO - Item de coleta ' || k,
  (100 * (k * 137))::numeric,
  CURRENT_DATE - k,
  'REGISTRADO'
FROM weekly_collections w
JOIN clients c ON c.id = w.client_id
CROSS JOIN generate_series(1, 3) AS k
WHERE c.cnpj_cpf LIKE '00.%';

-- ---------------------------------------------------------------------------
-- 13) PRECIFICAÇÃO, AÇÕES E ATIVOS
-- ---------------------------------------------------------------------------
INSERT INTO pricing_simulations (id, client_id, titulo, servico, horas, custo_hora,
                                 equipe, despesas, impostos_pct, margem_desejada_pct,
                                 prazo_dias, complexidade, custo_direto, custos_indiretos,
                                 impostos_valor, margem_valor, preco_sugerido, cenario)
SELECT gen_random_uuid(), c.id,
  'Projeto demonstrativo ' || idx,
  'Projeto ' || (ARRAY['Arquitetônico','Estrutural','de Interiores'])[1 + (idx % 3)],
  (120 + (idx % 5) * 40), (90 + (idx % 4) * 10),
  '[{"funcao":"Profissional sênior","horas":100,"custo_hora":100}]'::jsonb,
  (1500 + idx * 50), 8, 30, 45, 'MEDIA',
  (10000 + idx * 500)::numeric, (2000 + idx * 100)::numeric,
  (1200 + idx * 60)::numeric, (3600 + idx * 180)::numeric,
  (16800 + idx * 800)::numeric,
  (ARRAY['CONSERVADOR','RECOMENDADO','AGRESSIVO'])[1 + (idx % 3)]
FROM (SELECT id, row_number() OVER (ORDER BY id) AS idx FROM clients WHERE cnpj_cpf LIKE '00.%') c;

INSERT INTO action_plans (id, client_id, titulo, descricao, responsavel_id, prioridade,
                          prazo, status, observacoes)
SELECT gen_random_uuid(), c.id,
  'Ação demonstrativa ' || idx,
  'Acompanhamento do BPO (dados fictícios).',
  NULL,
  (ARRAY['ALTA','MEDIA','BAIXA'])[1 + (idx % 3)],
  CURRENT_DATE + ((idx % 15)::int),   -- row_number() é bigint; date + integer exige cast
  (ARRAY['NAO_INICIADO','EM_ANDAMENTO','CONCLUIDO'])[1 + (idx % 3)],
  NULL
FROM (SELECT id, row_number() OVER (ORDER BY id) AS idx FROM clients WHERE cnpj_cpf LIKE '00.%') c
WHERE idx % 2 = 0;

INSERT INTO assets (id, client_id, nome, tipo, numero_serie, valor, data_aquisicao,
                    status, observacoes)
SELECT gen_random_uuid(), c.id,
  (ARRAY['Estação total topográfica','Impressora plotter A1','Notebook profissional','Licença de software','Mobiliário de showroom'])[1 + ((idx + k) % 5)],
  (ARRAY['EQUIPAMENTO','EQUIPAMENTO','INFORMATICA','SOFTWARE','MOBILIARIO'])[1 + ((idx + k) % 5)],
  'SERIE-' || LPAD((idx * 10 + k)::text, 6, '0'),
  (3000 + ((idx * 317) % 20000))::numeric,
  (CURRENT_DATE - ((idx % 24 + k * 6) * 30 || ' days')::interval)::date,
  (ARRAY['ATIVO','ATIVO','EM_MANUTENCAO'])[1 + ((idx + k) % 3)],
  'Ativo demonstrativo (apresentação).'
FROM (SELECT id, row_number() OVER (ORDER BY id) AS idx FROM clients WHERE cnpj_cpf LIKE '00.%') c
CROSS JOIN generate_series(1, 2) AS k;

-- ============================================================================
-- FIM — total aproximado: 50 clientes, 150 projetos, 100 contratos, 400 parcelas,
-- 400 recebíveis, 2.400 pagáveis, 1.200 lançamentos de caixa, ~1.000 transações
-- bancárias, 200 documentos, alertas, saúde, relatórios, coletas e ativos.
-- ============================================================================
