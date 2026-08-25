/* ============================================================================
   Build Flow BPO — Central de Documentos (upload, extração, validação)
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
    let state = { page: 1, client_id: "", status: "", tipo: "" };

    async function render() {
      const data = await API.get("/documents", {
        page: state.page, page_size: 15, client_id: state.client_id || undefined,
        status: state.status || undefined, tipo: state.tipo || undefined,
      });
      container.innerHTML = `
        <div class="page-head">
          <div><div class="page-title">Central de Documentos</div><div class="page-sub">Upload de PDF/XLSX/CSV → validação → extração estruturada → validação humana.</div></div>
          <div class="page-actions"><button class="btn btn-primary" id="btn-upload">${UI.icon("plus")} Enviar documento</button></div>
        </div>
        <div class="filter-bar">
          <label class="field"><span>Cliente</span><select id="f-cliente"><option value="">Todos</option>${clients.map(([v, l]) => `<option value="${v}" ${state.client_id === v ? "selected" : ""}>${UI.esc(l)}</option>`).join("")}</select></label>
          <label class="field"><span>Status</span><select id="f-status"><option value="">Todos</option>${["PENDENTE", "PROCESSADO", "AGUARDANDO_VALIDACAO", "VALIDADO", "REJEITADO"].map((s) => `<option value="${s}" ${state.status === s ? "selected" : ""}>${UI.esc(s.replace(/_/g, " "))}</option>`).join("")}</select></label>
          <label class="field"><span>Tipo</span><select id="f-tipo"><option value="">Todos</option>${["CONTRATO", "NOTA_FISCAL", "RECIBO", "COMPROVANTE", "EXTRATO", "ADMINISTRATIVO", "FINANCEIRO", "OUTRO"].map((t) => `<option value="${t}" ${state.tipo === t ? "selected" : ""}>${UI.esc(t.replace(/_/g, " "))}</option>`).join("")}</select></label>
        </div>
        <div id="tbl"></div><div id="pag"></div>`;

      document.getElementById("f-cliente").addEventListener("change", (e) => { state.client_id = e.target.value; state.page = 1; render(); });
      document.getElementById("f-status").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; render(); });
      document.getElementById("f-tipo").addEventListener("change", (e) => { state.tipo = e.target.value; state.page = 1; render(); });
      document.getElementById("btn-upload").addEventListener("click", () => openUpload(render));

      const box = document.getElementById("tbl");
      if (!data.items.length) box.innerHTML = UI.emptyState("Nenhum documento. Envie o primeiro arquivo.", "doc");
      else {
        box.innerHTML = UI.table({
          columns: [
            { label: "Arquivo", render: (r) => `<strong>${UI.esc(r.arquivo_nome)}</strong><div class="muted" style="font-size:11px">${(r.tamanho / 1024).toFixed(0)} KB · ${UI.date(r.data_documento)}</div>` },
            { label: "Cliente", key: "client_name" },
            { label: "Tipo", render: (r) => UI.esc(r.tipo.replace(/_/g, " ")) },
            { label: "Extração", render: (r) => (r.extractions.length ? `<span class="badge blue">${r.extractions.length} campos</span>` : "—") },
            { label: "Status", render: (r) => UI.badge(r.status) },
            { label: "", align: "right", render: (r) => `
              <button class="btn btn-ghost btn-sm" data-open="${r.id}">Validar</button>
              <a class="btn btn-ghost btn-sm" href="/documents/${r.id}/download" target="_blank">${UI.icon("download")}</a>
              <button class="btn btn-ghost btn-sm" data-del="${r.id}">${UI.icon("trash")}</button>` },
          ],
          rows: data.items,
        });
        box.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openDetail(b.dataset.open, render)));
        box.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
          UI.confirm({ title: "Excluir documento", message: "Deseja excluir este documento?", onConfirm: async () => {
            try { await API.del(`/documents/${b.dataset.del}`); UI.toast("Documento excluído.", "success"); render(); }
            catch (e) { UI.toast(e.message, "error"); }
          } });
        }));
      }
      const pag = document.getElementById("pag");
      pag.innerHTML = UI.pagination({ page: state.page, pageSize: 15, total: data.total, onChange: () => {} });
      UI.bindPagination(pag, (p) => { state.page = p; render(); });
    }

    function openUpload(onDone) {
      (async () => {
        const clienteSel = await clientsSelect();
        const body = `
          <form id="form-upload">
            <div class="field"><span>Arquivo *</span><input type="file" name="file" required accept=".pdf,.xlsx,.csv,.png,.jpg,.jpeg" /></div>
            <div class="field-row">
              <label class="field"><span>Cliente *</span><select name="client_id" required><option value="">Selecione…</option>${clienteSel.map(([v, l]) => `<option value="${v}">${UI.esc(l)}</option>`).join("")}</select></label>
              <label class="field"><span>Tipo</span><select name="tipo">${["CONTRATO", "NOTA_FISCAL", "RECIBO", "COMPROVANTE", "EXTRATO", "ADMINISTRATIVO", "FINANCEIRO", "OUTRO"].map((t) => `<option>${t}</option>`).join("")}</select></label>
            </div>
            <div class="field-row">
              <label class="field"><span>Data do documento</span><input type="date" name="data_documento" /></label>
              <label class="field"><span>Projeto (opcional)</span><input name="projeto_id" placeholder="—" disabled title="Vincular projeto não disponível no upload; use a edição." /></label>
            </div>
            <label class="field"><span>Observação</span><textarea name="observacao" rows="2"></textarea></label>
            <p class="muted" style="font-size:12px">Após o envio, um script em Python extrai as informações relevantes (número, datas, fornecedor, valor) para preenchimento estruturado.</p>
          </form>`;
        const footer = document.createElement("div");
        footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
        footer.innerHTML = `<button class="btn btn-ghost btn-sm" data-act="c">Cancelar</button><button class="btn btn-primary btn-sm" data-act="s">Enviar e processar</button>`;
        const m = UI.modal({ title: "Enviar documento", body, footer });
        footer.querySelector('[data-act="c"]').addEventListener("click", m.close);
        footer.querySelector('[data-act="s"]').addEventListener("click", async () => {
          const form = document.getElementById("form-upload");
          const fd = new FormData(form);
          try {
            const doc = await API.upload("/documents/upload", fd);
            UI.toast(`Documento processado. ${doc.extractions.length} campo(s) extraído(s) aguardando validação.`, "success");
            m.close();
            onDone();
          } catch (e) { UI.toast(e.message, "error"); }
        });
      })();
    }

    function openDetail(docId, onDone) {
      (async () => {
        const d = await API.get(`/documents/${docId}`);
        const rows = d.extractions.length
          ? d.extractions.map((e) => `
            <tr>
              <td><strong>${UI.esc(e.campo)}</strong></td>
              <td><input class="input" style="width:100%" data-eid="${e.id}" value="${UI.esc(e.valor || "")}" /></td>
              <td>${UI.badge(e.status)}</td>
              <td style="display:flex;gap:6px">
                <button class="btn btn-success btn-sm" data-st="VALIDADA">Validar</button>
                <button class="btn btn-ghost btn-sm" data-st="CORRIGIDA">Corrigir</button>
                <button class="btn btn-danger btn-sm" data-st="REJEITADA">Rejeitar</button>
              </td>
            </tr>`).join("")
          : `<tr><td colspan="4" class="muted">Nenhum campo extraído automaticamente.</td></tr>`;
        const body = `
          <div class="muted" style="margin-bottom:10px">${UI.esc(d.arquivo_nome)} · ${UI.badge(d.status)} · ${UI.esc(d.observacao || "")}</div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Campo</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        const footer = document.createElement("div");
        footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
        footer.innerHTML = `<a class="btn btn-ghost btn-sm" href="/documents/${docId}/download" target="_blank">${UI.icon("download")} Baixar</a><button class="btn btn-primary btn-sm" data-act="c">Fechar</button>`;
        const m = UI.modal({ title: "Validação de extração", body, footer, wide: true });
        footer.querySelector('[data-act="c"]').addEventListener("click", m.close);
        m.backdrop.querySelectorAll("[data-st]").forEach((b) => b.addEventListener("click", async () => {
          const eid = b.closest("tr").querySelector("[data-eid]").dataset.eid;
          const valor = b.closest("tr").querySelector("[data-eid]").value;
          try {
            await API.put(`/documents/${docId}/extractions/${eid}`, { valor, status: b.dataset.st });
            UI.toast("Extração atualizada.", "success");
            m.close();
            onDone();
          } catch (e) { UI.toast(e.message, "error"); }
        }));
      })();
    }
    await render();
  }

  window.Pages.documents = { list };
})();
