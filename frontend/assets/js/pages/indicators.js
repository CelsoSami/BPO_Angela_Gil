/* ============================================================================
   Build Flow BPO — Indicadores (KPIs financeiros e operacionais)
   ============================================================================ */
(() => {
  "use strict";
  window.Pages = window.Pages || {};

  let _clientOptions = [];
  async function clientsSelect() {
    if (_clientOptions.length) return _clientOptions;
    const data = await API.get("/clients", { page_size: 200 });
    _clientOptions = data.items.map((c) => [c.id, c.nome_fantasia || c.razao_social]);
    return _clientOptions;
  }

  async function list(container) {
    UI.pageLoader(container);
    const clients = await clientsSelect();
    let state = { client_id: "" };

    async function render() {
      const [geral, inad] = await Promise.all([
        API.get("/dashboard/overview"),
        API.get("/financial/inadimplencia", { client_id: state.client_id || undefined }),
      ]);
      const k = geral.kpis;
      const trend = geral.receita_despesa;
      const health = await (async () => {
        if (!state.client_id) return null;
        const h = await API.get("/admin/health", { client_id: state.client_id });
        return h.items[0] || null;
      })();

      container.innerHTML = `
        <div class="page-head">
          <div><div class="page-title">Indicadores</div><div class="page-sub">KPIs financeiros e operacionais do BPO.</div></div>
          <div class="page-actions">
            <button class="btn btn-ghost" id="btn-gerar">${UI.icon("alert")} Gerar alertas (regras)</button>
          </div>
        </div>
        <div class="filter-bar">
          <label class="field"><span>Cliente</span><select id="f-cliente"><option value="">Todos (visão BPO)</option>${clients.map(([v, l]) => `<option value="${v}" ${state.client_id === v ? "selected" : ""}>${UI.esc(l)}</option>`).join("")}</select></label>
          ${state.client_id && health ? `<span class="health-pill ${health.classificacao.toLowerCase()}" style="margin-bottom:4px">${UI.esc(health.classificacao)} · ${health.score}</span>` : ""}
        </div>
        <div class="kpi-grid">
          ${UI.kpi({ label: "Faturamento (90d)", value: UI.money(k.receita), iconName: "receive", tone: "positive" })}
          ${UI.kpi({ label: "Despesas (90d)", value: UI.money(k.despesas), iconName: "pay", tone: "negative" })}
          ${UI.kpi({ label: "Resultado", value: UI.money(k.resultado), iconName: "trendUp", tone: k.resultado >= 0 ? "positive" : "negative", sub: `Margem ${UI.pct(k.margem)}` })}
          ${UI.kpi({ label: "Inadimplência", value: UI.money(inad.total_vencido), iconName: "alert", tone: inad.total_vencido ? "negative" : "positive", sub: `${inad.quantidade_titulos} títulos · ${inad.dias_medio_atraso} dias médios` })}
          ${UI.kpi({ label: "Clientes ativos", value: k.clientes_ativos, iconName: "building" })}
          ${UI.kpi({ label: "Projetos ativos", value: k.projetos_ativos, iconName: "box" })}
          ${UI.kpi({ label: "Contratos ativos", value: k.contratos_ativos, iconName: "doc" })}
          ${UI.kpi({ label: "Docs pendentes", value: k.documentos_pendentes, iconName: "doc", tone: k.documentos_pendentes ? "negative" : "positive" })}
        </div>
        <div class="grid-2">
          <div class="card">
            <div class="card-header"><div><div class="card-title">Receita × Despesa (6 meses)</div></div></div>
            <div class="chart-box"><canvas id="c-trend"></canvas></div>
          </div>
          <div class="card">
            <div class="card-header"><div><div class="card-title">Inadimplência por faixa</div></div></div>
            <div class="chart-box"><canvas id="c-inad"></canvas></div>
          </div>
        </div>
        <div class="grid-2">
          <div class="card">
            <div class="card-header"><div><div class="card-title">Indicadores financeiros</div></div></div>
            <div id="tbl-fin"></div>
          </div>
          <div class="card">
            <div class="card-header"><div><div class="card-title">Indicadores operacionais</div></div></div>
            <div id="tbl-op"></div>
          </div>
        </div>`;

      document.getElementById("f-cliente").addEventListener("change", (e) => { state.client_id = e.target.value; render(); });
      document.getElementById("btn-gerar").addEventListener("click", async () => {
        try {
          const r = await API.post("/alerts/generate", {});
          UI.toast(r.message || "Varredura concluída.", "success");
          render();
        } catch (e) { UI.toast(e.message, "error"); }
      });

      const p = Charts.palette();
      Charts.bar("c-trend", trend.map((r) => r.mes), [
        { label: "Entradas", data: trend.map((r) => r.entradas), backgroundColor: p.accent },
        { label: "Saídas", data: trend.map((r) => r.saidas), backgroundColor: p.danger },
      ]);
      const faixas = inad.faixas || [];
      Charts.doughnut("c-inad", faixas.map((f) => f.faixa), faixas.map((f) => f.valor), [p.accent, p.warning, p.danger, "#7C3AED", p.accent2]);

      const fin = [
        ["Faturamento", UI.money(k.receita)], ["Despesas", UI.money(k.despesas)],
        ["Custos", "—"], ["Lucro", UI.money(k.resultado)], ["Margem", UI.pct(k.margem)],
        ["Ticket médio", k.clientes_ativos ? UI.money(k.receita / k.clientes_ativos) : "—"],
        ["Inadimplência", UI.money(inad.total_vencido)], ["A receber", "—"],
        ["A pagar", "—"], ["Saldo", "—"],
      ];
      const op = [
        ["Clientes ativos", k.clientes_ativos], ["Projetos ativos", k.projetos_ativos],
        ["Projetos concluídos", "—"], ["Contratos ativos", k.contratos_ativos],
        ["Contratos próximos do vencimento", geral.contratos_proximos.length],
        ["Documentos pendentes", k.documentos_pendentes],
        ["Alertas abertos", k.alertas_abertos],
      ];
      document.getElementById("tbl-fin").innerHTML = UI.table({
        columns: [{ label: "Indicador", key: "k" }, { label: "Valor", key: "v", align: "right" }],
        rows: fin.map(([k2, v]) => ({ k: k2, v })),
      });
      document.getElementById("tbl-op").innerHTML = UI.table({
        columns: [{ label: "Indicador", key: "k" }, { label: "Valor", key: "v", align: "right" }],
        rows: op.map(([k2, v]) => ({ k: k2, v })),
      });
    }
    await render();
  }

  window.Pages.indicators = { list };
})();
