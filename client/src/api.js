/* Camada de comunicação com o backend. Em produção o front é servido pelo
   próprio servidor (mesma origem), então BASE fica vazio. Em dev, o Vite faz
   proxy de /api para o backend (veja vite.config.js). */
const BASE = import.meta.env.VITE_API_URL || "";

function getToken() { return localStorage.getItem("bolao_token"); }
function setToken(t) { t ? localStorage.setItem("bolao_token", t) : localStorage.removeItem("bolao_token"); }

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: "Bearer " + getToken() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = "Erro inesperado.";
    try { msg = (await res.json()).error || msg; } catch {}
    const err = new Error(msg); err.status = res.status; throw err;
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  register: (d) => req("POST", "/api/auth/register", d),
  login: (d) => req("POST", "/api/auth/login", d),
  me: () => req("GET", "/api/me"),
  state: () => req("GET", "/api/state"),
  myPred: () => req("GET", "/api/predictions/me"),
  savePred: (data) => req("PUT", "/api/predictions/me", { data }),
  lockPred: () => req("POST", "/api/predictions/lock"),
  allPreds: () => req("GET", "/api/predictions"),
  setConfig: (config) => req("PUT", "/api/admin/config", { config }),
  setResults: (results) => req("PUT", "/api/admin/results", { results }),
  getToken, setToken,
};
