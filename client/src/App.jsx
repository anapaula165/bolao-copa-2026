import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { api } from "./api.js";
import {
  T, ALL_CODES, GROUPS, GROUP_LETTERS, GROUP_MATCHES, GROUP_MATCHES_SORTED,
  BRACKET, KO_IDS, ROUND_LABEL, POINTS, MAX_POINTS, computeStandings,
  resolveBracketTeams, scoreUser, emptyData, matchKickoff, matchLockMs, MATCH_LOCK_MIN,
} from "./data.js";

const DEADLINE_FALLBACK = "2026-06-11T12:00";
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function Flag({ code }) {
  const t = T[code];
  if (!t) return null;
  return <span className={`fi fi-${t.iso} bz-fl`} role="img" aria-label={t.n} title={t.n} />;
}

/* ============================== APP ============================== */
export default function App() {
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get("reset"));
  const [booted, setBooted] = useState(false);
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState("grupos");
  const [pred, setPred] = useState(emptyData());
  const [config, setConfig] = useState({ deadline: DEADLINE_FALLBACK, globalLock: false, bracketOpen: false, bracketLocked: false, bracketTeams: {} });
  const [results, setResults] = useState({ groups: {}, koWinners: {}, koScores: {}, special: {} });
  const [allPreds, setAllPreds] = useState([]);
  const [adminMode, setAdminMode] = useState(false);
  const [saveState, setSaveState] = useState("");
  const [now, setNow] = useState(Date.now());
  const saveTimer = useRef(null);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 20000); return () => clearInterval(t); }, []);

  const loadAll = useCallback(async () => {
    const [st, mine, all] = await Promise.all([api.state(), api.myPred(), api.allPreds()]);
    if (st?.config) setConfig({ deadline: DEADLINE_FALLBACK, globalLock: false, bracketOpen: false, bracketLocked: false, bracketTeams: {}, ...st.config });
    if (st?.results) setResults({ groups: {}, koWinners: {}, koScores: {}, special: {}, ...st.results });
    const d = mine?.data && Object.keys(mine.data).length ? mine.data : emptyData();
    setPred({ ...emptyData(), ...d, bracket: { ...emptyData().bracket, ...(d.bracket || {}) }, special: { ...(d.special || {}) }, groups: { ...(d.groups || {}) } });
    setAllPreds(all || []);
  }, []);

  useEffect(() => { (async () => {
    if (!resetToken && api.getToken()) {
      try { const u = await api.me(); setMe(u); await loadAll(); }
      catch { api.setToken(null); }
    }
    setBooted(true);
  })(); }, [loadAll, resetToken]);

  useEffect(() => { if (tab === "ranking" && me) refreshRanking(); /* eslint-disable-next-line */ }, [tab]);

  const specialsClosed = useMemo(() => {
    if (config.globalLock) return true;
    const d = new Date(config.deadline);
    return !isNaN(d) && now > d.getTime();
  }, [config.deadline, config.globalLock, now]);

  const persist = useCallback((nextData) => {
    setPred(nextData);
    setAllPreds((prev) => prev.map((p) => (me && p.id === me.id ? { ...p, data: nextData } : p)));
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await api.savePred(nextData); setSaveState("saved"); setTimeout(() => setSaveState((s) => (s === "saved" ? "" : s)), 1500); }
      catch { setSaveState("error"); }
    }, 700);
  }, [me]);

  async function onAuthed(u) { setMe(u); await loadAll(); setTab("grupos"); }
  function logout() { api.setToken(null); setMe(null); setAdminMode(false); setPred(emptyData()); }
  function stripConfig(c) { return { deadline: c.deadline, globalLock: c.globalLock, bracketOpen: c.bracketOpen, bracketLocked: c.bracketLocked, bracketTeams: c.bracketTeams || {} }; }
  async function saveConfig(next) { setConfig(next); await api.setConfig(stripConfig(next)); }
  async function saveResults(next) { setResults(next); await api.setResults(next); const all = await api.allPreds(); setAllPreds(all || []); }
  async function refreshRanking() { try { const all = await api.allPreds(); setAllPreds(all || []); const st = await api.state(); if (st?.results) setResults({ groups: {}, koWinners: {}, koScores: {}, special: {}, ...st.results }); } catch {} }
  async function renameMe(name) {
    const u = await api.updateName(name);
    setMe(u);
    setAllPreds((prev) => prev.map((p) => (p.id === u.id ? { ...p, name: u.name } : p)));
    return u;
  }

  const groupFilled = useMemo(() => GROUP_MATCHES.filter((m) => { const p = pred.groups[m.id]; return p && p.a !== "" && p.a != null && p.b !== "" && p.b != null; }).length, [pred]);
  const specialFilled = useMemo(() => ["campeao", "vice"].filter((k) => pred.special[k] && String(pred.special[k]).trim() !== "").length, [pred]);

  if (resetToken) return <ResetScreen token={resetToken} onDone={() => { window.history.replaceState({}, "", window.location.pathname); setResetToken(null); }} />;
  if (!booted) return <div className="bz-center">Carregando…</div>;
  if (!me) return <AuthScreen onAuthed={onAuthed} />;

  const tabs = [["grupos", "Grupos"], ["palpites", "Palpites"], ["especiais", "Especiais"], ["ranking", "Ranking"], ["perfil", "Perfil"]];

  return (
    <div className="bz-root">
      <header className="bz-header">
        <div className="bz-brand">
          <div className="bz-cup">🏆</div>
          <div>
            <div className="bz-title">BOLÃO DA COPA <span>2026</span></div>
            <div className="bz-sub">Serviços Internacionais IBBA</div>
          </div>
        </div>
        <div className="bz-headright">
          <SpecialsBadge deadline={config.deadline} now={now} closed={specialsClosed} />
          <div className="bz-user">
            <span className="bz-uname">{me.name}{me.isAdmin && <em> · ADM</em>}</span>
            <button className="bz-link" onClick={logout}>sair</button>
          </div>
        </div>
      </header>

      <nav className="bz-tabs">
        {tabs.map(([k, label]) => (
          <button key={k} className={"bz-tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>
            {label}
            {k === "palpites" && <span className="bz-pill">{groupFilled}/72</span>}
            {k === "especiais" && <span className="bz-pill">{specialFilled}/2</span>}
          </button>
        ))}
      </nav>

      {saveState && <div className={"bz-flash" + (saveState === "error" ? " err" : "")}>{saveState === "saving" ? "Salvando…" : saveState === "saved" ? "Salvo ✓" : "Erro ao salvar"}</div>}

      <main className="bz-main">
        {tab === "grupos" && <GruposTab />}
        {tab === "palpites" && <PalpitesTab pred={pred} savePred={persist} now={now} config={config} />}
        {tab === "especiais" && <EspeciaisTab pred={pred} savePred={persist} isLocked={specialsClosed} />}
        {tab === "ranking" && <RankingTab everyone={allPreds} results={results} meId={me.id} onRefresh={refreshRanking} />}
        {tab === "perfil" && (
          <PerfilTab me={me} pred={pred} results={results} groupFilled={groupFilled} specialFilled={specialFilled}
            adminMode={adminMode} setAdminMode={setAdminMode} onRename={renameMe}
            config={config} saveConfig={saveConfig} saveResults={saveResults} everyone={allPreds} />
        )}
      </main>

      <footer className="bz-footer">
        Pontuação: placar exato {POINTS.placarExato} · resultado certo {POINTS.resultadoCerto} · Campeão {POINTS.campeao} · Vice {POINTS.vice} · Máximo {MAX_POINTS} pts
      </footer>
    </div>
  );
}

/* ============================== AUTENTICAÇÃO ============================== */
function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(""); setMsg(""); setBusy(true);
    try {
      if (mode === "forgot") {
        await api.forgot(email);
        setMsg("Se houver uma conta com esse e-mail, enviaremos um link de redefinição. Não chegou? Peça ao administrador para gerar um link para você.");
      } else {
        const res = mode === "register" ? await api.register({ name, email, password }) : await api.login({ email, password });
        api.setToken(res.token);
        await onAuthed(res.user);
      }
    } catch (e) { setErr(e.message || "Erro."); } finally { setBusy(false); }
  }

  return (
    <div className="bz-root">
      <div className="bz-login">
        <div className="bz-login-card">
          <div className="bz-cup big">🏆</div>
          <h1 className="bz-title">BOLÃO DA COPA <span>2026</span></h1>
          <p className="bz-sub">Serviços Internacionais IBBA</p>

          {mode !== "forgot" && (
            <div className="bz-authtabs">
              <button className={mode === "login" ? "on" : ""} onClick={() => { setMode("login"); setErr(""); setMsg(""); }}>Entrar</button>
              <button className={mode === "register" ? "on" : ""} onClick={() => { setMode("register"); setErr(""); setMsg(""); }}>Criar conta</button>
            </div>
          )}

          {mode === "forgot" && <p className="bz-login-text">Informe seu e-mail para receber um link de redefinição de senha.</p>}
          {mode === "register" && <input className="bz-input" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />}
          <input className="bz-input" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          {mode !== "forgot" && <input className="bz-input" type="password" placeholder="Senha (mín. 6 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />}

          {err && <p className="bz-warn small">{err}</p>}
          {msg && <p className="bz-okmsg">{msg}</p>}
          <button className="bz-btn primary full" disabled={busy} onClick={submit}>
            {busy ? "Aguarde…" : mode === "register" ? "Criar conta e entrar" : mode === "forgot" ? "Enviar link" : "Entrar"}
          </button>

          {mode === "login" && <button className="bz-link center" onClick={() => { setMode("forgot"); setErr(""); setMsg(""); }}>Esqueci minha senha</button>}
          {mode === "forgot" && <button className="bz-link center" onClick={() => { setMode("login"); setErr(""); setMsg(""); }}>← Voltar ao login</button>}
          <p className="bz-fine">A fase de grupos trava jogo a jogo, 30 min antes de cada partida.</p>
        </div>
      </div>
    </div>
  );
}

function ResetScreen({ token, onDone }) {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit() {
    setErr("");
    if (password.length < 6) return setErr("A senha precisa ter ao menos 6 caracteres.");
    if (password !== password2) return setErr("As senhas não conferem.");
    setBusy(true);
    try { await api.reset(token, password); setOk(true); } catch (e) { setErr(e.message || "Erro."); } finally { setBusy(false); }
  }
  return (
    <div className="bz-root">
      <div className="bz-login">
        <div className="bz-login-card">
          <div className="bz-cup big">🔑</div>
          <h1 className="bz-title">Nova senha</h1>
          {ok ? (
            <>
              <p className="bz-okmsg">Senha redefinida com sucesso!</p>
              <button className="bz-btn primary full" onClick={onDone}>Ir para o login</button>
            </>
          ) : (
            <>
              <p className="bz-login-text">Crie uma nova senha para sua conta.</p>
              <input className="bz-input" type="password" placeholder="Nova senha" value={password} onChange={(e) => setPassword(e.target.value)} />
              <input className="bz-input" type="password" placeholder="Repita a nova senha" value={password2} onChange={(e) => setPassword2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
              {err && <p className="bz-warn small">{err}</p>}
              <button className="bz-btn primary full" disabled={busy} onClick={submit}>{busy ? "Salvando…" : "Salvar nova senha"}</button>
              <button className="bz-link center" onClick={onDone}>Cancelar</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SpecialsBadge({ deadline, now, closed }) {
  const d = new Date(deadline);
  if (closed) return <div className="bz-deadline off">⏳ Especiais encerrados</div>;
  const diff = d.getTime() - now;
  const days = Math.floor(diff / 86400000);
  const hrs = Math.floor((diff % 86400000) / 3600000);
  return <div className="bz-deadline">⏳ Especiais: {days > 0 ? `${days}d ${hrs}h` : `${hrs}h`}</div>;
}

/* ============================== ABA 1 — GRUPOS ============================== */
function GruposTab() {
  return (
    <div>
      <SectionTitle k="Aba 1" t="Grupos da Copa do Mundo 2026" s="48 seleções · 12 grupos · EUA, México e Canadá" />
      <div className="bz-groupgrid">
        {GROUP_LETTERS.map((g) => (
          <div className="bz-groupcard" key={g}>
            <div className="bz-groupcard-h">Grupo {g}</div>
            <ul>{GROUPS[g].map((c) => (<li key={c}><Flag code={c} /><span className="bz-tn">{T[c].n}</span><span className="bz-code">{c}</span></li>))}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== ABA 2 — PALPITES ============================== */
function PalpitesTab({ pred, savePred, now, config }) {
  return (
    <div>
      <SectionTitle k="Aba 2" t="Palpites" s="Jogos da fase de grupos em ordem cronológica. Cada um trava 30 min antes de começar." />
      <GroupPredictions pred={pred} savePred={savePred} now={now} globalLock={config.globalLock} />
    </div>
  );
}

function GroupPredictions({ pred, savePred, now, globalLock }) {
  function setScore(id, side, val) {
    const v = val === "" ? "" : Math.max(0, Math.min(20, parseInt(val || "0", 10) || 0));
    const groups = { ...pred.groups, [id]: { ...(pred.groups[id] || { a: "", b: "" }), [side]: v } };
    savePred({ ...pred, groups });
  }
  const days = [];
  let last = null;
  GROUP_MATCHES_SORTED.forEach((m) => {
    if (m.date !== last) { days.push({ key: m.date, dow: m.dow, label: m.date, items: [] }); last = m.date; }
    days[days.length - 1].items.push(m);
  });

  return (
    <div className="bz-matchlist">
      <p className="bz-hint">💡 Você pode preencher aos poucos: cada jogo fecha 30 minutos antes do apito inicial.</p>
      {days.map((day) => (
        <div key={day.key}>
          <div className="bz-dayhead">{cap(day.dow)} · {day.label}</div>
          {day.items.map((m) => {
            const locked = globalLock || now >= matchLockMs(m);
            return (
              <div className="bz-matchwrap" key={m.id}>
                <div className="bz-matchmeta">
                  <span className="bz-when">{m.time} (Brasília) · <span className="bz-gtag">Grupo {m.group}</span></span>
                  <span className="bz-venue">{locked ? <span className="bz-lockchip">🔒 fechado</span> : "📍 " + m.venue}</span>
                </div>
                <div className="bz-match">
                  <div className="bz-team home"><span className="bz-tn">{T[m.home].n}</span><Flag code={m.home} /></div>
                  <div className="bz-scorebox">
                    <input className="bz-score" inputMode="numeric" disabled={locked} value={pred.groups[m.id]?.a ?? ""} onChange={(e) => setScore(m.id, "a", e.target.value)} />
                    <span className="bz-x">×</span>
                    <input className="bz-score" inputMode="numeric" disabled={locked} value={pred.groups[m.id]?.b ?? ""} onChange={(e) => setScore(m.id, "b", e.target.value)} />
                  </div>
                  <div className="bz-team away"><Flag code={m.away} /><span className="bz-tn">{T[m.away].n}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ============================== ABA 3 — ESPECIAIS ============================== */
function EspeciaisTab({ pred, savePred, isLocked }) {
  function set(k, v) { if (isLocked) return; savePred({ ...pred, special: { ...pred.special, [k]: v } }); }
  const teamSelect = (k, label, pts) => (
    <div className="bz-spec">
      <div className="bz-spec-h"><span>{label}</span><span className="bz-spec-pts">+{pts} pts</span></div>
      <select className="bz-input" disabled={isLocked} value={pred.special[k] || ""} onChange={(e) => set(k, e.target.value)}>
        <option value="">Selecione…</option>
        {GROUP_LETTERS.map((g) => (<optgroup key={g} label={"Grupo " + g}>{GROUPS[g].map((c) => <option key={c} value={c}>{T[c].n}</option>)}</optgroup>))}
      </select>
    </div>
  );
  return (
    <div>
      <SectionTitle k="Aba 3" t="Palpites Especiais" s="Valem pontos bônus pelo resultado final do torneio" />
      {isLocked && <div className="bz-locked">🔒 Palpites especiais encerrados (somente leitura).</div>}
      <div className="bz-specgrid">
        {teamSelect("campeao", "🥇 Campeão", POINTS.campeao)}
        {teamSelect("vice", "🥈 Vice-Campeão", POINTS.vice)}
      </div>
    </div>
  );
}

/* ============================== ABA 4 — RANKING ============================== */
function RankingTab({ everyone, results, meId, onRefresh }) {
  const rows = useMemo(() => everyone.map((e) => {
    const data = e.data || {};
    let pts = 0; try { pts = scoreUser(data, results).pts; } catch { pts = 0; }
    const gf = GROUP_MATCHES.filter((m) => { const p = (data.groups || {})[m.id]; return p && p.a !== "" && p.b !== "" && p.a != null && p.b != null; }).length;
    const sf = ["campeao", "vice"].filter((k) => (data.special || {})[k] && String(data.special[k]).trim() !== "").length;
    return { id: e.id, name: e.name, isAdmin: e.isAdmin, pts, gf, sf };
  }).sort((a, b) => b.pts - a.pts || b.gf - a.gf || a.name.localeCompare(b.name)), [everyone, results]);

  return (
    <div>
      <SectionTitle k="Aba 4" t="Ranking" s={`Atualiza conforme os resultados saem · Máximo possível: ${MAX_POINTS} pts`} />
      <button className="bz-btn ghost" style={{ marginBottom: 12 }} onClick={onRefresh}>↻ Atualizar ranking</button>
      <div className="bz-rank">
        <div className="bz-rank-head"><span>#</span><span>Participante</span><span>Grupos</span><span>Especiais</span><span>Pontos</span></div>
        {rows.length === 0 && <div className="bz-empty">Ninguém entrou ainda.</div>}
        {rows.map((r, i) => (
          <div className={"bz-rank-row" + (r.id === meId ? " me" : "") + (i < 3 ? " top" + (i + 1) : "")} key={r.id}>
            <span className="bz-pos">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
            <span className="bz-rn">{r.name}{r.isAdmin && <em> · ADM</em>}</span>
            <span>{r.gf}/72</span><span>{r.sf}/2</span><span className="bz-pts">{r.pts}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== ABA 5 — PERFIL + ADMIN ============================== */
function NameEditor({ me, onRename }) {
  const [name, setName] = useState(me.name);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { setName(me.name); }, [me.name]);
  const dirty = name.trim() !== me.name && name.trim().length >= 2;
  async function save() {
    setErr(""); setMsg(""); setBusy(true);
    try { await onRename(name.trim()); setMsg("Nome atualizado ✓"); setTimeout(() => setMsg(""), 1800); }
    catch (e) { setErr(e.message || "Erro ao salvar."); } finally { setBusy(false); }
  }
  return (
    <div className="bz-card">
      <h3>Seu nome no ranking</h3>
      <p className="bz-hint">É assim que você aparece para todos no ranking. Você pode mudar quando quiser.</p>
      <div className="bz-nameedit">
        <input className="bz-input" value={name} maxLength={40} placeholder="Seu nome"
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && dirty && save()} />
        <button className="bz-btn primary" disabled={!dirty || busy} onClick={save}>{busy ? "Salvando…" : "Salvar nome"}</button>
      </div>
      {msg && <p className="bz-okmsg">{msg}</p>}
      {err && <p className="bz-warn small">{err}</p>}
    </div>
  );
}

function PerfilTab({ me, pred, results, groupFilled, specialFilled, adminMode, setAdminMode, onRename, config, saveConfig, saveResults, everyone }) {
  const { pts, det } = scoreUser(pred, results);
  return (
    <div>
      <SectionTitle k="Aba 5" t="Perfil" s={`${me.name} · ${me.email}`} />
      <div className="bz-profile">
        <NameEditor me={me} onRename={onRename} />
        <div className="bz-card">
          <h3>Resumo das suas apostas</h3>
          <div className="bz-stats">
            <div><b>{groupFilled}/72</b><span>placares de grupo</span></div>
            <div><b>{specialFilled}/5</b><span>palpites especiais</span></div>
            <div><b>{pred.special?.campeao ? <Flag code={pred.special.campeao} /> : "—"}</b><span>seu campeão</span></div>
            <div className="bz-stat-pts"><b>{pts}</b><span>pontos até agora</span></div>
          </div>
          <div className="bz-detail">Grupos {det.grupos} · Especiais {det.especiais}</div>
          <p className="bz-hint">Os jogos de grupo travam 30 min antes de cada partida — você pode ir ajustando até lá.</p>
        </div>

        {me.isAdmin ? (
          adminMode
            ? <AdminPanel config={config} saveConfig={saveConfig} results={results} saveResults={saveResults} everyone={everyone} onExit={() => setAdminMode(false)} />
            : <div className="bz-card"><h3>⚙ Área do Administrador</h3><p className="bz-hint">Você é administrador deste bolão.</p><button className="bz-btn" onClick={() => setAdminMode(true)}>Abrir painel do admin</button></div>
        ) : null}
      </div>
    </div>
  );
}

function AdminPanel({ config, saveConfig, results, saveResults, everyone, onExit }) {
  const [sec, setSec] = useState("config");
  const [r, setR] = useState(results);
  const [teams, setTeams] = useState(config.bracketTeams || {});
  const [flash, setFlash] = useState("");
  const [resetInfo, setResetInfo] = useState({});
  useEffect(() => setR(results), [results]);
  useEffect(() => setTeams(config.bracketTeams || {}), [config.bracketTeams]);

  function num(v) { return v === "" ? "" : Math.max(0, Math.min(20, parseInt(v || "0", 10) || 0)); }
  function setGroupRes(id, side, v) { setR({ ...r, groups: { ...r.groups, [id]: { ...(r.groups[id] || { a: "", b: "" }), [side]: num(v) } } }); }
  function setKoWinner(id, code) { setR({ ...r, koWinners: { ...r.koWinners, [id]: code } }); }
  function setKoScore(id, side, v) { setR({ ...r, koScores: { ...r.koScores, [id]: { ...(r.koScores[id] || { a: "", b: "" }), [side]: num(v) } } }); }
  function setSpec(k, v) { setR({ ...r, special: { ...r.special, [k]: v } }); }
  async function saveRes() { await saveResults(r); setFlash("Salvo ✓"); setTimeout(() => setFlash(""), 1500); }
  async function saveTeams() { await saveConfig({ ...config, bracketTeams: teams }); setFlash("Classificados salvos ✓"); setTimeout(() => setFlash(""), 1500); }
  function slotOptions(slot) { if (slot.type === "pos") return GROUPS[slot.group]; let a = []; slot.groups.forEach((g) => (a = a.concat(GROUPS[g]))); return a; }
  async function genReset(email) { try { const { resetUrl } = await api.adminResetLink(email); setResetInfo((p) => ({ ...p, [email]: resetUrl })); } catch (e) { setResetInfo((p) => ({ ...p, [email]: "Erro: " + e.message })); } }

  const r32 = KO_IDS.filter((id) => BRACKET[id].round === "R32");

  return (
    <div className="bz-card admin">
      <div className="bz-admin-h"><h3>⚙ Administrador</h3>{flash && <span className="bz-savedtag">{flash}</span>}<button className="bz-link" onClick={onExit}>fechar</button></div>
      <div className="bz-subtabs">
        {[["config", "Prazos & trava"], ["grupos", "Result. grupos"], ["especiais", "Especiais"], ["users", "Participantes"]].map(([k, l]) => (
          <button key={k} className={"bz-subtab" + (sec === k ? " on" : "")} onClick={() => setSec(k)}>{l}</button>
        ))}
      </div>

      {sec === "config" && (
        <div className="bz-admin-body">
          <label className="bz-field">Prazo dos palpites especiais (Brasília)
            <input className="bz-input" type="datetime-local" value={config.deadline} onChange={(e) => saveConfig({ ...config, deadline: e.target.value })} />
          </label>
          <p className="bz-hint">Os jogos da fase de grupos NÃO usam esse prazo — cada um trava sozinho 30 min antes de começar.</p>
          <label className="bz-check"><input type="checkbox" checked={config.globalLock} onChange={(e) => saveConfig({ ...config, globalLock: e.target.checked })} /> Trava geral de emergência (congela tudo agora)</label>
        </div>
      )}

      {sec === "grupos" && (
        <div className="bz-admin-body scroll">
          {GROUP_LETTERS.map((g) => (
            <div key={g}>
              <div className="bz-md">Grupo {g}</div>
              {GROUP_MATCHES.filter((m) => m.group === g).map((m) => (
                <div className="bz-match small" key={m.id}>
                  <span className="bz-tn"><Flag code={m.home} /> {T[m.home].n}</span>
                  <div className="bz-scorebox">
                    <input className="bz-score" value={r.groups[m.id]?.a ?? ""} onChange={(e) => setGroupRes(m.id, "a", e.target.value)} />
                    <span className="bz-x">×</span>
                    <input className="bz-score" value={r.groups[m.id]?.b ?? ""} onChange={(e) => setGroupRes(m.id, "b", e.target.value)} />
                  </div>
                  <span className="bz-tn">{T[m.away].n} <Flag code={m.away} /></span>
                </div>
              ))}
            </div>
          ))}
          <button className="bz-btn primary" onClick={saveRes}>Salvar resultados</button>
        </div>
      )}

      {sec === "especiais" && (
        <div className="bz-admin-body">
          {[["campeao", "Campeão"], ["vice", "Vice"]].map(([k, l]) => (
            <label className="bz-field" key={k}>{l}
              <select className="bz-input" value={r.special?.[k] || ""} onChange={(e) => setSpec(k, e.target.value)}>
                <option value="">—</option>
                {GROUP_LETTERS.map((g) => <optgroup key={g} label={"Grupo " + g}>{GROUPS[g].map((c) => <option key={c} value={c}>{T[c].n}</option>)}</optgroup>)}
              </select>
            </label>
          ))}
          <button className="bz-btn primary" onClick={saveRes}>Salvar especiais</button>
        </div>
      )}

      {sec === "users" && (
        <div className="bz-admin-body">
          <p className="bz-hint">{everyone.length} participante(s). Use "gerar link" para ajudar quem esqueceu a senha — copie o link e envie para a pessoa.</p>
          <div className="bz-userlist">
            {everyone.map((e) => (
              <div className="bz-userrow col" key={e.id}>
                <div className="bz-userrow-top"><span>{e.name}{e.isAdmin && " · ADM"} <em>{e.email}</em></span><button className="bz-btn tiny" onClick={() => genReset(e.email)}>gerar link</button></div>
                {resetInfo[e.email] && <input className="bz-input small" readOnly value={resetInfo[e.email]} onFocus={(ev) => ev.target.select()} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ k, t, s }) {
  return (<div className="bz-sectiontitle"><span className="bz-kicker">{k}</span><h2>{t}</h2>{s && <p>{s}</p>}</div>);
}
