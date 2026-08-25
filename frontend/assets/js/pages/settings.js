/* ============================================================================
   Build Flow BPO — Configurações (credenciais, tema, configurações do sistema)
   ============================================================================ */
(() => {
  "use strict";
  window.Pages = window.Pages || {};

  async function main(container) {
    UI.pageLoader(container);
    const me = JSON.parse(localStorage.getItem("bf_user") || "{}");
    const settings = await API.get("/admin/settings");
    const isAdmin = me.role === "ADMIN";

    container.innerHTML = `
      <div class="page-head">
        <div><div class="page-title">Configurações</div><div class="page-sub">Credenciais, preferências e configurações do sistema.</div></div>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><div><div class="card-title">Minhas credenciais</div><div class="card-sub">Altere sua senha — ela é armazenada com hash seguro (Argon2id).</div></div></div>
          <form id="form-senha">
            <label class="field"><span>Senha atual *</span><input type="password" name="current_password" required /></label>
            <label class="field"><span>Nova senha *</span><input type="password" name="new_password" required minlength="8" placeholder="mín. 8 caracteres" /></label>
            <button type="submit" class="btn btn-primary">${UI.icon("check")} Alterar senha</button>
          </form>
        </div>
        <div class="card">
          <div class="card-header"><div><div class="card-title">Preferências</div><div class="card-sub">Tema visual (salvo no navegador, sem recarregar).</div></div></div>
          <div class="field">
            <span>Tema</span>
            <select id="sel-tema">
              <option value="dark" ${document.documentElement.getAttribute("data-theme") === "dark" ? "selected" : ""}>Dark (padrão)</option>
              <option value="light" ${document.documentElement.getAttribute("data-theme") === "light" ? "selected" : ""}>Light</option>
            </select>
          </div>
        </div>
      </div>
      ${isAdmin ? `
      <div class="section-title">Configurações do sistema (somente ADMIN)</div>
      <div class="card">
        <div class="card-header"><div><div class="card-title">Regras objetivas — saúde financeira</div><div class="card-sub">Edite e salve; a classificação usa estas regras (sem IA).</div></div></div>
        <div id="health-rules-form"></div>
      </div>` : ""}`;

    document.getElementById("form-senha").addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = UI.formData(e.target);
      try {
        await API.post("/auth/change-password", data);
        UI.toast("Senha alterada com sucesso.", "success");
        e.target.reset();
      } catch (err) { UI.toast(err.message, "error"); }
    });

    document.getElementById("sel-tema").addEventListener("change", (e) => {
      document.documentElement.setAttribute("data-theme", e.target.value);
      localStorage.setItem("bf_theme", e.target.value);
      document.dispatchEvent(new CustomEvent("bf:theme-change"));
      UI.toast("Tema atualizado.", "success");
    });

    if (isAdmin) {
      const hr = settings.find((s) => s.chave === "health_rules");
      let regras = {};
      try { regras = JSON.parse(hr ? hr.valor : "{}"); } catch { regras = {}; }
      const defs = [
        ["inadimplencia_pct_max", "Inadimplência máx. (%)", regras.inadimplencia_pct_max ?? 5],
        ["margem_min", "Margem mínima (%)", regras.margem_min ?? 15],
        ["resultado_negativo_max_meses", "Meses com resultado negativo", regras.resultado_negativo_max_meses ?? 2],
        ["vencidas_max", "Títulos vencidos máx.", regras.vencidas_max ?? 2],
      ];
      const form = document.getElementById("health-rules-form");
      form.innerHTML = `
        <form id="health-rules-inner">
          <div class="field-row-3">
            ${defs.map(([k, l, v]) => UI.field({ label: l, name: k, type: "number", value: v })).join("")}
          </div>
          <div class="form-actions"><button class="btn btn-primary btn-sm" id="btn-salvar-regras">${UI.icon("check")} Salvar regras</button></div>
        </form>`;
      document.getElementById("btn-salvar-regras").addEventListener("click", async () => {
        const data = UI.formData(document.getElementById("health-rules-inner"));
        const valor = JSON.stringify({
          inadimplencia_pct_max: Number(data.inadimplencia_pct_max),
          margem_min: Number(data.margem_min),
          resultado_negativo_max_meses: Number(data.resultado_negativo_max_meses),
          vencidas_max: Number(data.vencidas_max),
        });
        try {
          await API.put("/admin/settings", { chave: "health_rules", valor, descricao: "Regras objetivas de classificação da saúde financeira" });
          UI.toast("Regras salvas.", "success");
        } catch (e) { UI.toast(e.message, "error"); }
      });
    }
  }

  window.Pages.settings = { main };
})();
