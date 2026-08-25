/* ============================================================================
   Build Flow BPO — Cliente de API (fetch com Bearer + tratamento de erros)
   ============================================================================ */
const API = (() => {
  const BASE = "";

  function token() {
    return localStorage.getItem("bf_token") || "";
  }

  async function request(method, path, body = null, isForm = false) {
    const headers = {};
    const t = token();
    if (t) headers["Authorization"] = `Bearer ${t}`;
    if (body && !isForm) headers["Content-Type"] = "application/json";

    let payload;
    if (body && !isForm) payload = JSON.stringify(body);
    else if (body && isForm) payload = body;

    const res = await fetch(BASE + path, {
      method,
      headers,
      body: payload,
    });

    if (res.status === 401) {
      localStorage.removeItem("bf_token");
      localStorage.removeItem("bf_user");
      if (!location.hash.startsWith("#/login")) {
        location.hash = "#/login";
      }
      throw new Error("Sessão expirada. Faça login novamente.");
    }

    let data = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      data = await res.json();
    } else if (res.status === 204) {
      data = null;
    }

    if (!res.ok) {
      const detail = data && data.detail ? data.detail : "Não foi possível concluir a operação.";
      const msg = Array.isArray(detail) ? detail.map((d) => d.msg).join("; ") : detail;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function qs(params = {}) {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== "") p.set(k, v);
    });
    const s = p.toString();
    return s ? `?${s}` : "";
  }

  return {
    token,
    get: (path, params) => request("GET", path + qs(params)),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
    del: (path) => request("DELETE", path),
    upload: (path, formData) => request("POST", path, formData, true),
    request,
  };
})();
