/* ============================================================================
   Build Flow BPO — Visão Geral (dashboard executivo)
   ============================================================================ */
(() => {
  "use strict";
  window.Pages = window.Pages || {};

  async function overview(container) {
    UI.pageLoader(container);
    const data = await API.get("/dashboard/overview");
    const k = data.kpis;
    const user = JSON.parse(localStorage.getItem("bf_user") || "{}");
    const greet = window.Pages._greeting || "Olá";

    const kpis = [
      UI.kpi({ label: "Clientes ativos", value: k.clientes_ativos, iconName: "building", sub: "escritórios sob gestão" }),
      UI.kpi({ label: "Receita (90d)", value: UI.money(k.receita), iconName: "receive", tone: "positive", sub: `Margem ${UI.pct(k.margem)}` }),
      UI.kpi({ label: "Despesas (90d)", value: UI.money(k.despesas), iconName: "pay", tone: "negative" }),
      UI.kpi({ label: "Resultado (90d)", value: UI.money(k.resultado), iconName: "trendUp", tone: k.resultado >= 0 ? "positive" : "negative" }),
      UI.kpi({ label: "Contas vencidas", value: k.contas_vencidas, iconName: "alert", tone: k.contas_vencidas ? "negative" : "", sub: `${UI.money(k.valor_vencido)} em atraso` }),
      UI.kpi({ label: "Projetos ativos", value: k.projetos_ativos, iconName: "box" }),
      UI.kpi({ label: "Contratos ativos", value: k.contratos_ativos, iconName: "doc" }),
      UI.kpi({ label: "Alertas abertos", value: k.alertas_abertos, iconName: "alert", tone: k.alertas_abertos ? "negative" : "positive", sub: `${k.documentos_pendentes} docs pendentes` }),
    ];

    container.innerHTML = `
      <div class="page-head">
        <div>
          <div class="page-title">${greet}, ${UI.esc((user.nome || "").split(" ")[0] || "equipe")}.</div>
          <div class="page-sub">Visão geral do Build Flow — controle financeiro, organização e inteligência gerencial.</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" data-go="#/clients/new">${UI.icon("plus")} Novo cliente</button>
          <button class="btn btn-ghost" data-go="#/reports">${UI.icon("report")} Relatórios</button>
        </div>
      </div>
      <div class="kpi-grid">${kpis.join("")}</div>
      <div class="grid-2-1">
        <div class="card">
          <div class="card-header"><div><div class="card-title">Receitas × Despesas</div><div class="card-sub">Últimos 6 meses</div></div></div>
          <div class="chart-box"><canvas id="chart-revdesp"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><div><div class="card-title">Inadimplência</div><div class="card-sub">Títulos vencidos por faixa</div></div></div>
          <div class="chart-box sm"><canvas id="chart-inad"></canvas></div>
        </div>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><div><div class="card-title">Contratos próximos do vencimento</div><div class="card-sub">Renovações nos próximos 60 dias</div></div></div>
          <div id="box-contratos"></div>
        </div>
        <div class="card">
          <div class="card-header"><div><div class="card-title">Alertas</div><div class="card-sub">${k.alertas_abertos} aberto(s)</div></div></div>
          <div id="box-alertas"></div>
        </div>
      </div>
      <div class="section-title">Rentabilidade — rankings</div>
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><div><div class="card-title">Mais rentáveis</div></div></div>
          <div id="box-mais"></div>
        </div>
        <div class="card">
          <div class="card-header"><div><div class="card-title">Menor rentabilidade</div></div></div>
          <div id="box-menos"></div>
        </div>
      </div>
    `;

    container.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => (location.hash = b.dataset.go)));

    // gráfico receita x despesa
    const p = Charts.palette();
    const rd = data.receita_despesa;
    Charts.bar("chart-revdesp", rd.map((r) => r.mes), [
      { label: "Entradas", data: rd.map((r) => r.entradas), backgroundColor: p.accent, borderRadius: 5 },
      { label: "Saídas", data: rd.map((r) => r.saidas), backgroundColor: p.danger, borderRadius: 5 },
    ]);

    const inad = data.inadimplencia;
    const faixas = inad.faixas || [];
    Charts.doughnut(
      "chart-inad",
      faixas.map((f) => f.faixa),
      faixas.map((f) => f.valor),
      [p.accent, p.warning, p.danger, "#7C3AED", p.accent2]
    );

    // contratos próximos
    const boxC = document.getElementById("box-contratos");
    if (!data.contratos_proximos.length) boxC.innerHTML = UI.emptyState("Nenhum contrato próximo do vencimento.", "doc");
    else {
      boxC.innerHTML = data.contratos_proximos
        .map((c) => `
          <div class="alert-item">
            <div class="alert-icon" style="background:var(--accent-soft);color:var(--accent)">${UI.icon("doc")}</div>
            <div style="flex:1">
              <div class="alert-title">${UI.esc(c.numero)} <span class="muted">— ${c.dias} dia(s)</span></div>
              <div class="alert-msg">Vencimento: ${UI.date(c.termino)}</div>
            </div>
          </div>`)
        .join("");
    }

    // alertas
    const boxA = document.getElementById("box-alertas");
    boxA.innerHTML = `<button class="btn btn-ghost btn-sm" id="btn-gen-alertas">${UI.icon("alert")} Executar varredura de regras</button><div style="margin-top:10px" id="alerta-lista"></div>`;
    document.getElementById("btn-gen-alertas").addEventListener("click", async () => {
      try {
        const r = await API.post("/alerts/generate", {});
        UI.toast(r.message || "Alertas verificados.", "success");
        location.reload();
      } catch (e) { UI.toast(e.message, "error"); }
    });
    const lista = document.getElementById("alerta-lista");
    const alerts = await API.get("/alerts", { status: "ABERTO", page_size: 5 });
    lista.innerHTML = alerts.items.length
      ? alerts.items.map((a) => `
          <div class="alert-item">
            <div class="alert-icon" style="background:${a.prioridade === "ALTA" ? "rgba(239,68,68,.14)" : "rgba(245,158,11,.16)"};color:${a.prioridade === "ALTA" ? "var(--danger)" : "var(--warning)"}">${UI.icon("alert")}</div>
            <div style="flex:1">
              <div class="alert-title">${UI.esc(a.titulo)}</div>
              <div class="alert-msg">${UI.esc(a.mensagem || "")} ${a.client_name ? "· " + UI.esc(a.client_name) : ""}</div>
            </div>
            ${UI.badge(a.prioridade)}
          </div>`).join("")
      : UI.emptyState("Nenhum alerta aberto.", "check");

    // rankings
    const rank = (items, boxId, tone) => {
      const box = document.getElementById(boxId);
      if (!items.length) { box.innerHTML = UI.emptyState("Sem dados.", "chart"); return; }
      box.innerHTML = UI.table({
        columns: [
          { label: "Projeto", key: "nome", render: (r) => `<strong>${UI.esc(r.nome)}</strong><div class="muted" style="font-size:11px">${UI.esc(r.client_name || "")}</div>` },
          { label: "Margem", align: "right", render: (r) => `<span class="${tone(r.margem)} strong">${UI.pct(r.margem)}</span>` },
          { label: "Lucro", align: "right", render: (r) => UI.money(r.lucro) },
        ],
        rows: items,
      });
    };
    rank(data.rankings.mais_rentaveis || [], "box-mais", (m) => (m >= 15 ? "positive" : "negative"));
    rank(data.rankings.menos_rentaveis || [], "box-menos", () => "negative");
  }

  window.Pages.dashboard = { overview };
})();
