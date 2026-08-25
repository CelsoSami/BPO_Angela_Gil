/* ============================================================================
   Build Flow BPO — Relatórios Gerenciais Mensais
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
    let state = { page: 1, client_id: "" };

    async function render() {
      const data = await API.get("/reports", { page: state.page, page_size: 15, client_id: state.client_id || undefined });
      container.innerHTML = `
        <div class="page-head">
          <div><div class="page-title">Relatórios Gerenciais</div><div class="page-sub">Relatório mensal baseado nos dados do sistema (sem IA) · exportação em PDF, Excel e CSV.</div></div>
        </div>
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <div><div class="card-title">Gerar relatório mensal</div></div>
            <button class="btn btn-primary btn-sm" id="btn-gerar">${UI.icon("report")} Gerar</button>
          </div>
          <div class="field-row" style="max-width:640px">
            <label class="field"><span>Cliente *</span><select id="g-cliente">${clients.map(([v, l]) => `<option value="${v}">${UI.esc(l)}</option>`).join("")}</select></label>
            <label class="field"><span>Mês</span><select id="g-mes">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${new Date().getMonth() === i ? "selected" : ""}>${String(i + 1).padStart(2, "0")}</option>`).join("")}</select></label>
            <label class="field"><span>Ano</span><select id="g-ano">${[new Date().getFullYear(), new Date().getFullYear() - 1].map((a) => `<option value="${a}">${a}</option>`).join("")}</select></label>
          </div>
        </div>
        <div class="filter-bar">
          <label class="field"><span>Cliente</span><select id="f-cliente"><option value="">Todos</option>${clients.map(([v, l]) => `<option value="${v}" ${state.client_id === v ? "selected" : ""}>${UI.esc(l)}</option>`).join("")}</select></label>
        </div>
        <div id="tbl"></div><div id="pag"></div>`;

      document.getElementById("f-cliente").addEventListener("change", (e) => { state.client_id = e.target.value; state.page = 1; render(); });
      document.getElementById("btn-gerar").addEventListener("click", async () => {
        const cid = document.getElementById("g-cliente").value;
        const mes = document.getElementById("g-mes").value;
        const ano = document.getElementById("g-ano").value;
        try {
          const r = await API.post(`/reports/monthly/generate?client_id=${cid}&mes=${mes}&ano=${ano}`, {});
          UI.toast("Relatório gerado com sucesso.", "success");
          render();
          openPreview(r.conteudo, cid);
        } catch (e) { UI.toast(e.message, "error"); }
      });

      const box = document.getElementById("tbl");
      if (!data.items.length) box.innerHTML = UI.emptyState("Nenhum relatório gerado ainda.", "report");
      else {
        box.innerHTML = UI.table({
          columns: [
            { label: "Relatório", render: (r) => `<strong>${UI.esc(r.titulo)}</strong>` },
            { label: "Cliente", key: "client_name" },
            { label: "Período", render: (r) => `${String(r.mes).padStart(2, "0")}/${r.ano}` },
            { label: "Gerado em", render: (r) => UI.datetime(r.created_at) },
            { label: "Exportar", align: "right", render: (r) => `
              <a class="btn btn-ghost btn-sm" href="/reports/monthly/export?client_id=${r.client_id}&mes=${r.mes}&ano=${r.ano}&formato=pdf" target="_blank">PDF</a>
              <a class="btn btn-ghost btn-sm" href="/reports/monthly/export?client_id=${r.client_id}&mes=${r.mes}&ano=${r.ano}&formato=xlsx" target="_blank">Excel</a>
              <a class="btn btn-ghost btn-sm" href="/reports/monthly/export?client_id=${r.client_id}&mes=${r.mes}&ano=${r.ano}&formato=csv" target="_blank">CSV</a>` },
          ],
          rows: data.items,
        });
      }
      const pag = document.getElementById("pag");
      pag.innerHTML = UI.pagination({ page: state.page, pageSize: 15, total: data.total, onChange: () => {} });
      UI.bindPagination(pag, (p) => { state.page = p; render(); });
    }

    function openPreview(c, cid) {
      const s = c.secoes;
      const body = `
        <p class="muted" style="margin-bottom:12px">${UI.esc(s.resumo_executivo)}</p>
        <details class="accordion" open><summary>2. Resultado financeiro</summary><div class="acc-body">
          <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
            ${UI.kpi({ label: "Receita", value: UI.money(s.resultado_financeiro.receita), iconName: "receive", tone: "positive" })}
            ${UI.kpi({ label: "Despesas", value: UI.money(s.resultado_financeiro.despesas), iconName: "pay", tone: "negative" })}
            ${UI.kpi({ label: "Resultado", value: UI.money(s.resultado_financeiro.resultado), iconName: "trendUp", tone: s.resultado_financeiro.resultado >= 0 ? "positive" : "negative" })}
          </div></div></details>
        <details class="accordion"><summary>3. Fluxo de caixa & 4. DRE</summary><div class="acc-body">
          <div class="muted" style="font-size:12.5px">Entradas: ${UI.money(s.fluxo_de_caixa.entradas)} · Saídas: ${UI.money(s.fluxo_de_caixa.saidas)} · Saldo: ${UI.money(s.fluxo_de_caixa.saldo_final)}</div>
          <div style="margin-top:8px">${UI.table({
            columns: [
              { label: "Conta", render: (r) => UI.esc(r.n) },
              { label: "Valor", align: "right", render: (r) => UI.money(r.v) },
            ],
            rows: [
              ["Receita Bruta", s.dre.receita_bruta], ["(−) Impostos", s.dre.impostos],
              ["= Receita Líquida", s.dre.receita_liquida], ["(−) Custos Diretos", s.dre.custos_diretos],
              ["= Margem de Contribuição", s.dre.margem_contribuicao], ["(−) Despesas Operacionais", s.dre.despesas_operacionais],
              ["= Resultado Operacional", s.dre.resultado_operacional], ["(−) Despesas Financeiras", s.dre.despesas_financeiras],
              ["= Resultado Líquido", s.dre.resultado_liquido],
            ].map(([n, v]) => ({ n, v })),
          })}</div></div></details>
        <details class="accordion"><summary>5/7. Contas a receber e a pagar</summary><div class="acc-body">
          <div class="muted" style="font-size:12.5px">A receber: ${s.contas_a_receber.length} · A pagar: ${s.contas_a_pagar.length} · Inadimplência: ${UI.money(s.inadimplencia.total_vencido)}</div>
        </div></details>
        <details class="accordion"><summary>13. Pontos de atenção</summary><div class="acc-body">
          ${s.pontos_de_atencao.map((p) => `<div style="display:flex;gap:8px;align-items:center;margin:6px 0;color:var(--text-2)"><span style="color:var(--danger)">${UI.icon("alert")}</span>${UI.esc(p)}</div>`).join("")}
        </div></details>`;
      const footer = document.createElement("div");
      footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
      footer.innerHTML = `
        <a class="btn btn-ghost btn-sm" href="/reports/monthly/export?client_id=${cid}&mes=${c.mes}&ano=${c.ano}&formato=pdf" target="_blank">PDF</a>
        <a class="btn btn-ghost btn-sm" href="/reports/monthly/export?client_id=${cid}&mes=${c.mes}&ano=${c.ano}&formato=xlsx" target="_blank">Excel</a>
        <a class="btn btn-ghost btn-sm" href="/reports/monthly/export?client_id=${cid}&mes=${c.mes}&ano=${c.ano}&formato=csv" target="_blank">CSV</a>
        <button class="btn btn-primary btn-sm" data-act="c">Fechar</button>`;
      const m = UI.modal({ title: `Relatório — ${String(c.mes).padStart(2, "0")}/${c.ano}`, body, footer, wide: true });
      footer.querySelector('[data-act="c"]').addEventListener("click", m.close);
    }
    await render();
  }

  window.Pages.reports = { list };
})();
