import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { api } from "./api.js";
import {
  T, ALL_CODES, GROUPS, GROUP_LETTERS, GROUP_MATCHES, BRACKET, KO_IDS,
  ROUND_LABEL, POINTS, MAX_POINTS, computeStandings, resolveBracketTeams,
  scoreUser, emptyData,
} from "./data.js";

const DEADLINE_FALLBACK = "2026-06-11T12:00";

function Flag({ code }) {
  const t = T[code];
  if (!t) return null;
  return <span className={`fi fi-${t.iso} bz-fl`} role="img" aria-label={t.n} title={t.n} />;
}

/* ============================== APP ============================== */
export default function App() {
  const [booted, setBooted] = useState(false);
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState("grupos");
  const [pred, setPred] = useState(emptyData());
  const [locked, setLocked] = useState(false);
  const [config, setConfig] = useState({ deadline: DEADLINE_FALLBACK, globalLock: false });
  const [results, setResults] = useState({ groups: {}, koWinners: {}, koScores: {}, special: {} });
  const [allPreds, setAllPreds] = useState([]);
  const [adminMode, setAdminMode] = useState(false);
  const [saveState, setSaveState] = useState("");
  const [now, setNow] = useState(Date.now());
  const saveTimer = useRef(null);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  const loadAll = useCallback(async () => {
    const [st, mine, all] = await Promise.all([api.state(), api.myPred(), api.allPreds()]);
    if (st?.config) setConfig({ deadline: DEADLINE_FALLBACK, globalLock: false, ...st.config });
    if (st?.results) setResults({ groups: {}, koWinners: {}, koScores: {}, special: {}, ...st.results });
    const d = mine?.data && Object.keys(mine.data).length ? mine.data : emptyData();
    setPred({ ...emptyData(), ...d, bracket: { ...emptyData().bracket, ...(d.bracket || {}) }, special: { ...(d.special || {}) }, groups: { ...(d.groups || {}) } });
    setLocked(!!mine?.locked);
    setAllPreds(all || []);
  }, []);

  useEffect(() => { (async () => {
    if (api.getToken()) {
      try { const u = await api.me(); setMe(u); await loadAll(); }
      catch { api.setToken(null); }
    }
    setBooted(true);
  })(); }, [loadAll]);

  // atualiza o ranking ao abrir a aba
  useEffect(() => { if (tab === "ranking" && me) refreshRanking(); /* eslint-disable-next-line */ }, [tab]);

  const deadlinePassed = useMemo(() => { const d = new Date(config.deadline); return !isNaN(d) && now > d.getTime(); }, [config.deadline, now]);
  const isLocked = locked || config.globalLock || deadlinePassed;

  const persist = useCallback((nextData) => {
    setPred(nextData);
    setAllPreds((prev) => prev.map((p) => (me && p.id === me.id ? { ...p, data: nextData } : p)));
    if (isLocked) return;
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await api.savePred(nextData); setSaveState("saved"); setTimeout(() => setSaveState((s) => (s === "saved" ? "" : s)), 1500); }
      catch { setSaveState("error"); }
    }, 700);
  }, [isLocked, me]);

  async function onAuthed(u) { setMe(u); await loadAll(); setTab("grupos"); }
  function logout() { api.setToken(null); setMe(null); setAdminMode(false); setPred(emptyData()); setLocked(false); }

  async function lockMine() { clearTimeout(saveTimer.current); try { await api.savePred(pred); } catch {} await api.lockPred(); setLocked(true); }
  async function saveConfig(next) { setConfig(next); await api.setConfig({ deadline: next.deadline, globalLock: next.globalLock }); }
  async function saveResults(next) { setResults(next); await api.setResults(next); const all = await api.allPreds(); setAllPreds(all || []); }
  async function refreshRanking() { try { const all = await api.allPreds(); setAllPreds(all || []); const st = await api.state(); if (st?.results) setResults({ groups: {}, koWinners: {}, koScores: {}, special: {}, ...st.results }); } catch {} }

  const groupFilled = useMemo(() => GROUP_MATCHES.filter((m) => { const p = pred.groups[m.id]; return p && p.a !== "" && p.a != null && p.b !== "" && p.b != null; }).length, [pred]);
  const specialFilled = useMemo(() => ["campeao", "vice", "terceiro", "artilheiro", "melhorJogador"].filter((k) => pred.special[k] && String(pred.special[k]).trim() !== "").length, [pred]);

  if (!booted) return <div className="bz-center">Carregando…</div>;
  if (!me) return <AuthScreen onAuthed={onAuthed} />;

  const tabs = [["grupos", "Grupos"], ["palpites", "Palpites"], ["especiais", "Especiais"], ["ranking", "Ranking"], ["perfil", "Perfil"]];
  const reason = locked ? "Você bloqueou seus palpites." : config.globalLock ? "O administrador encerrou os palpites." : deadlinePassed ? "O prazo encerrou." : "";

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
          <DeadlineBadge deadline={config.deadline} now={now} passed={deadlinePassed} />
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
            {k === "especiais" && <span className="bz-pill">{specialFilled}/5</span>}
          </button>
        ))}
      </nav>

      {saveState && <div className={"bz-flash" + (saveState === "error" ? " err" : "")}>{saveState === "saving" ? "Salvando…" : saveState === "saved" ? "Salvo ✓" : "Erro ao salvar"}</div>}

      <main className="bz-main">
        {tab === "grupos" && <GruposTab />}
        {tab === "palpites" && <PalpitesTab pred={pred} savePred={persist} isLocked={isLocked} lockReason={reason} />}
        {tab === "especiais" && <EspeciaisTab pred={pred} savePred={persist} isLocked={isLocked} />}
        {tab === "ranking" && <RankingTab everyone={allPreds} results={results} meId={me.id} onRefresh={refreshRanking} />}
        {tab === "perfil" && (
          <PerfilTab me={me} pred={pred} locked={locked} isLocked={isLocked} lockMine={lockMine}
            groupFilled={groupFilled} specialFilled={specialFilled}
            adminMode={adminMode} setAdminMode={setAdminMode}
            config={config} saveConfig={saveConfig} results={results} saveResults={saveResults}
            everyone={allPreds} />
        )}
      </main>

      <footer className="bz-footer">
        Pontuação: placar exato {POINTS.placarExato} pts · resultado certo {POINTS.resultadoCerto} pt ·
        mata-mata {POINTS.mataMataAvanca} pts (+{POINTS.mataMataPlacar} placar) · Campeão {POINTS.campeao} · Vice {POINTS.vice} · 3º {POINTS.terceiro} · Artilheiro {POINTS.artilheiro} · Craque {POINTS.melhorJogador} · Máximo {MAX_POINTS} pts
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
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(""); setBusy(true);
    try {
      const res = mode === "register"
        ? await api.register({ name, email, password })
        : await api.login({ email, password });
      api.setToken(res.token);
      await onAuthed(res.user);
    } catch (e) { setErr(e.message || "Erro."); } finally { setBusy(false); }
  }

  return (
    <div className="bz-root">
      <div className="bz-login">
        <div className="bz-login-card">
          <div className="bz-cup big">🏆</div>
          <h1 className="bz-title">BOLÃO DA COPA <span>2026</span></h1>
          <p className="bz-sub">Serviços Internacionais IBBA</p>

          <div className="bz-authtabs">
            <button className={mode === "login" ? "on" : ""} onClick={() => { setMode("login"); setErr(""); }}>Entrar</button>
            <button className={mode === "register" ? "on" : ""} onClick={() => { setMode("register"); setErr(""); }}>Criar conta</button>
          </div>

          {mode === "register" && (
            <input className="bz-input" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <input className="bz-input" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="bz-input" type="password" placeholder="Senha (mín. 6 caracteres)" value={password}
            onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />

          {err && <p className="bz-warn small">{err}</p>}
          <button className="bz-btn primary full" disabled={busy} onClick={submit}>
            {busy ? "Aguarde…" : mode === "register" ? "Criar conta e entrar" : "Entrar"}
          </button>
          <p className="bz-fine">Prazo para palpitar: até 11/06/2026, 12h00 (Brasília).</p>
        </div>
      </div>
    </div>
  );
}

function DeadlineBadge({ deadline, now, passed }) {
  const d = new Date(deadline);
  const diff = d.getTime() - now;
  let txt = "Prazo encerrado";
  if (!passed && !isNaN(d)) {
    const days = Math.floor(diff / 86400000);
    const hrs = Math.floor((diff % 86400000) / 3600000);
    txt = days > 0 ? `Faltam ${days}d ${hrs}h` : `Faltam ${hrs}h`;
  }
  return <div className={"bz-deadline" + (passed ? " off" : "")}>⏳ {txt}</div>;
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
            <ul>
              {GROUPS[g].map((c) => (
                <li key={c}><Flag code={c} /><span className="bz-tn">{T[c].n}</span><span className="bz-code">{c}</span></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== ABA 2 — PALPITES ============================== */
function PalpitesTab({ pred, savePred, isLocked, lockReason }) {
  const [view, setView] = useState("A");
  return (
    <div>
      <SectionTitle k="Aba 2" t="Palpites" s="Placar da fase de grupos (obrigatório) e o chaveamento do mata-mata" />
      {isLocked && <div className="bz-locked">🔒 {lockReason} Seus palpites estão em modo leitura.</div>}
      <div className="bz-subtabs">
        {GROUP_LETTERS.map((g) => (
          <button key={g} className={"bz-subtab" + (view === g ? " on" : "")} onClick={() => setView(g)}>Grupo {g}</button>
        ))}
        <button className={"bz-subtab chave" + (view === "chave" ? " on" : "")} onClick={() => setView("chave")}>⚔ Mata-mata</button>
      </div>
      {view !== "chave"
        ? <GroupPredictions letter={view} pred={pred} savePred={savePred} isLocked={isLocked} />
        : <BracketPredictions pred={pred} savePred={savePred} isLocked={isLocked} />}
    </div>
  );
}

function GroupPredictions({ letter, pred, savePred, isLocked }) {
  const matches = GROUP_MATCHES.filter((m) => m.group === letter);
  function setScore(id, side, val) {
    if (isLocked) return;
    const v = val === "" ? "" : Math.max(0, Math.min(20, parseInt(val || "0", 10) || 0));
    const groups = { ...pred.groups, [id]: { ...(pred.groups[id] || { a: "", b: "" }), [side]: v } };
    savePred({ ...pred, groups });
  }
  return (
    <div className="bz-matchlist">
      {[1, 2, 3].map((md) => (
        <div key={md}>
          <div className="bz-md">Rodada {md}</div>
          {matches.filter((m) => m.md === md).map((m) => (
            <div className="bz-matchwrap" key={m.id}>
              <div className="bz-matchmeta">
                <span className="bz-when">{m.dow.charAt(0).toUpperCase() + m.dow.slice(1)} {m.date} · {m.time} (Brasília)</span>
                <span className="bz-venue">📍 {m.venue}</span>
              </div>
              <div className="bz-match">
                <div className="bz-team home"><span className="bz-tn">{T[m.home].n}</span><Flag code={m.home} /></div>
                <div className="bz-scorebox">
                  <input className="bz-score" inputMode="numeric" disabled={isLocked} value={pred.groups[m.id]?.a ?? ""} onChange={(e) => setScore(m.id, "a", e.target.value)} />
                  <span className="bz-x">×</span>
                  <input className="bz-score" inputMode="numeric" disabled={isLocked} value={pred.groups[m.id]?.b ?? ""} onChange={(e) => setScore(m.id, "b", e.target.value)} />
                </div>
                <div className="bz-team away"><Flag code={m.away} /><span className="bz-tn">{T[m.away].n}</span></div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function BracketPredictions({ pred, savePred, isLocked }) {
  const teams = useMemo(() => resolveBracketTeams(pred), [pred]);
  const standings = useMemo(() => computeStandings(pred), [pred]);

  function setSlot(matchId, idx, code) {
    if (isLocked) return;
    const slots = { ...pred.bracket.slots, [`${matchId}-${idx}`]: code };
    const winners = { ...pred.bracket.winners };
    if (winners[matchId] && ![slots[`${matchId}-0`], slots[`${matchId}-1`]].includes(winners[matchId])) delete winners[matchId];
    savePred({ ...pred, bracket: { ...pred.bracket, slots, winners } });
  }
  function setWinner(matchId, code) {
    if (isLocked) return;
    const winners = { ...pred.bracket.winners, [matchId]: code };
    let changed = true;
    while (changed) {
      changed = false;
      const t = resolveBracketTeams({ ...pred, bracket: { ...pred.bracket, winners } });
      KO_IDS.forEach((id) => { if (winners[id] && !(t[id] || []).includes(winners[id])) { delete winners[id]; changed = true; } });
    }
    savePred({ ...pred, bracket: { ...pred.bracket, winners } });
  }
  function setScore(matchId, side, val) {
    if (isLocked) return;
    const v = val === "" ? "" : Math.max(0, Math.min(20, parseInt(val || "0", 10) || 0));
    const scores = { ...pred.bracket.scores, [matchId]: { ...(pred.bracket.scores[matchId] || { a: "", b: "" }), [side]: v } };
    savePred({ ...pred, bracket: { ...pred.bracket, scores } });
  }
  function autoFill() {
    if (isLocked) return;
    const slots = { ...pred.bracket.slots };
    KO_IDS.forEach((id) => {
      const m = BRACKET[id]; if (m.round !== "R32") return;
      m.slots.forEach((s, idx) => { if (s.type === "pos") { const ord = standings[s.group]; if (ord && ord[s.pos - 1]) slots[`${id}-${idx}`] = ord[s.pos - 1]; } });
    });
    savePred({ ...pred, bracket: { ...pred.bracket, slots } });
  }

  const left = KO_IDS.filter((id) => BRACKET[id].side === "L");
  const right = KO_IDS.filter((id) => BRACKET[id].side === "R");
  const byRound = (ids, r) => ids.filter((id) => BRACKET[id].round === r);

  return (
    <div className="bz-bracket-wrap">
      <div className="bz-bracket-tools">
        <button className="bz-btn ghost" onClick={autoFill} disabled={isLocked}>↺ Preencher posições pelos meus placares</button>
        <span className="bz-hint">Escolha os classificados nos 32-avos; ao marcar o vencedor de cada jogo, a próxima fase se atualiza sozinha.</span>
      </div>
      <div className="bz-bracket">
        <div className="bz-side">
          {["R32", "R16", "QF", "SF"].map((r) => (
            <div className={"bz-col r-" + r} key={"L" + r}>
              <div className="bz-colhead">{ROUND_LABEL[r]}</div>
              {byRound(left, r).map((id) => (
                <KoMatch key={id} id={id} teams={teams[id]} pred={pred} setSlot={setSlot} setWinner={setWinner} setScore={setScore} isLocked={isLocked} />
              ))}
            </div>
          ))}
        </div>
        <div className="bz-center-col">
          <div className="bz-colhead final">{ROUND_LABEL.F}</div>
          <KoMatch id="M104" teams={teams.M104} pred={pred} big setSlot={setSlot} setWinner={setWinner} setScore={setScore} isLocked={isLocked} />
          {pred.bracket.winners.M104 && (
            <div className="bz-champ">🏆 Seu campeão: <strong><Flag code={pred.bracket.winners.M104} /> {T[pred.bracket.winners.M104]?.n}</strong></div>
          )}
          <div className="bz-colhead third">{ROUND_LABEL["3P"]}</div>
          <KoMatch id="M103" teams={teams.M103} pred={pred} setSlot={setSlot} setWinner={setWinner} setScore={setScore} isLocked={isLocked} />
        </div>
        <div className="bz-side right">
          {["SF", "QF", "R16", "R32"].map((r) => (
            <div className={"bz-col r-" + r} key={"R" + r}>
              <div className="bz-colhead">{ROUND_LABEL[r]}</div>
              {byRound(right, r).map((id) => (
                <KoMatch key={id} id={id} teams={teams[id]} pred={pred} setSlot={setSlot} setWinner={setWinner} setScore={setScore} isLocked={isLocked} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KoMatch({ id, teams, pred, setSlot, setWinner, setScore, isLocked, big }) {
  const m = BRACKET[id];
  const w = pred.bracket.winners[id];
  const sc = pred.bracket.scores[id] || { a: "", b: "" };
  const isR32 = m.round === "R32";
  function slotOptions(slot) {
    if (slot.type === "pos") return GROUPS[slot.group];
    let arr = []; slot.groups.forEach((g) => (arr = arr.concat(GROUPS[g]))); return arr;
  }
  function feederLabel(i) { if (!m.feeders) return "?"; return (m.losers ? "Perdedor " : "Vencedor ") + m.feeders[i]; }
  return (
    <div className={"bz-ko" + (big ? " big" : "")}>
      <div className="bz-ko-id">{id}</div>
      {[0, 1].map((i) => {
        const code = teams ? teams[i] : null;
        return (
          <div className={"bz-ko-row" + (w && code && w === code ? " win" : "")} key={i}>
            <button className="bz-pickwin" disabled={isLocked || !code} title="Marcar como classificado" onClick={() => code && setWinner(id, code)}>
              {w && code && w === code ? "●" : "○"}
            </button>
            {isR32 ? (
              <select className="bz-ko-select" disabled={isLocked} value={code || ""} onChange={(e) => setSlot(id, i, e.target.value)}>
                <option value="">{m.slots[i].label}</option>
                {slotOptions(m.slots[i]).map((c) => (<option key={c} value={c}>{T[c].n}</option>))}
              </select>
            ) : (
              <span className="bz-ko-team">{code ? <><Flag code={code} /> <b>{code}</b></> : <i className="bz-ko-tbd">{feederLabel(i)}</i>}</span>
            )}
            <input className="bz-ko-score" inputMode="numeric" disabled={isLocked || !code} value={i === 0 ? sc.a : sc.b} onChange={(e) => setScore(id, i === 0 ? "a" : "b", e.target.value)} />
          </div>
        );
      })}
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
        {GROUP_LETTERS.map((g) => (
          <optgroup key={g} label={"Grupo " + g}>{GROUPS[g].map((c) => <option key={c} value={c}>{T[c].n}</option>)}</optgroup>
        ))}
      </select>
    </div>
  );
  return (
    <div>
      <SectionTitle k="Aba 3" t="Palpites Especiais" s="Valem pontos bônus pelo resultado final do torneio" />
      {isLocked && <div className="bz-locked">🔒 Palpites em modo leitura.</div>}
      <div className="bz-specgrid">
        {teamSelect("campeao", "🥇 Campeão", POINTS.campeao)}
        {teamSelect("vice", "🥈 Vice-Campeão", POINTS.vice)}
        {teamSelect("terceiro", "🥉 3º Lugar", POINTS.terceiro)}
        <div className="bz-spec">
          <div className="bz-spec-h"><span>⚽ Artilheiro</span><span className="bz-spec-pts">+{POINTS.artilheiro} pts</span></div>
          <input className="bz-input" disabled={isLocked} placeholder="Nome do jogador" value={pred.special.artilheiro || ""} onChange={(e) => set("artilheiro", e.target.value)} />
        </div>
        <div className="bz-spec">
          <div className="bz-spec-h"><span>⭐ Melhor Jogador</span><span className="bz-spec-pts">+{POINTS.melhorJogador} pts</span></div>
          <input className="bz-input" disabled={isLocked} placeholder="Nome do jogador" value={pred.special.melhorJogador || ""} onChange={(e) => set("melhorJogador", e.target.value)} />
        </div>
      </div>
    </div>
  );
}

/* ============================== ABA 4 — RANKING ============================== */
function RankingTab({ everyone, results, meId, onRefresh }) {
  const rows = useMemo(() => everyone.map((e) => {
    const data = e.data || emptyData();
    const { pts } = scoreUser(data, results);
    const gf = GROUP_MATCHES.filter((m) => { const p = (data.groups || {})[m.id]; return p && p.a !== "" && p.b !== "" && p.a != null && p.b != null; }).length;
    const sf = ["campeao", "vice", "terceiro", "artilheiro", "melhorJogador"].filter((k) => (data.special || {})[k] && String(data.special[k]).trim() !== "").length;
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
            <span>{r.gf}/72</span>
            <span>{r.sf}/5</span>
            <span className="bz-pts">{r.pts}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== ABA 5 — PERFIL + ADMIN ============================== */
function PerfilTab({ me, pred, locked, isLocked, lockMine, groupFilled, specialFilled, adminMode, setAdminMode, config, saveConfig, results, saveResults, everyone }) {
  const [confirmLock, setConfirmLock] = useState(false);
  const { pts, det } = scoreUser(pred, results);
  function doLock() { if (locked) return; if (!confirmLock) { setConfirmLock(true); return; } lockMine(); setConfirmLock(false); }
  return (
    <div>
      <SectionTitle k="Aba 5" t="Perfil" s={`${me.name} · ${me.email}`} />
      <div className="bz-profile">
        <div className="bz-card">
          <h3>Resumo das suas apostas</h3>
          <div className="bz-stats">
            <div><b>{groupFilled}/72</b><span>placares de grupo</span></div>
            <div><b>{specialFilled}/5</b><span>palpites especiais</span></div>
            <div><b>{pred.bracket.winners?.M104 ? <Flag code={pred.bracket.winners.M104} /> : "—"}</b><span>seu campeão</span></div>
            <div className="bz-stat-pts"><b>{pts}</b><span>pontos até agora</span></div>
          </div>
          <div className="bz-detail">Grupos {det.grupos} · Mata-mata {det.mata} · Especiais {det.especiais}</div>
          {groupFilled < 72 && !isLocked && <p className="bz-hint">Faltam {72 - groupFilled} placares de grupo para completar.</p>}
        </div>

        <div className="bz-card">
          <h3>Salvar e bloquear</h3>
          <p className="bz-hint">Quando terminar, bloqueie para garantir seus palpites. {locked && <strong>Bloqueado ✓</strong>}</p>
          <button className={"bz-btn " + (confirmLock ? "" : "primary")} onClick={doLock} disabled={locked}>
            {locked ? "🔒 Palpites bloqueados" : confirmLock ? "Confirmar? (não dá pra editar depois)" : "🔒 Salvar e bloquear palpites"}
          </button>
          {confirmLock && <button className="bz-link" onClick={() => setConfirmLock(false)} style={{ marginLeft: 10 }}>cancelar</button>}
          {!locked && isLocked && <p className="bz-hint">O prazo geral encerrou — seus palpites já estão travados.</p>}
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
  const [flash, setFlash] = useState("");
  useEffect(() => setR(results), [results]);
  function num(val) { return val === "" ? "" : Math.max(0, Math.min(20, parseInt(val || "0", 10) || 0)); }
  function setGroupRes(id, side, val) { setR({ ...r, groups: { ...r.groups, [id]: { ...(r.groups[id] || { a: "", b: "" }), [side]: num(val) } } }); }
  function setKoWinner(id, code) { setR({ ...r, koWinners: { ...r.koWinners, [id]: code } }); }
  function setKoScore(id, side, val) { setR({ ...r, koScores: { ...r.koScores, [id]: { ...(r.koScores[id] || { a: "", b: "" }), [side]: num(val) } } }); }
  function setSpec(k, v) { setR({ ...r, special: { ...r.special, [k]: v } }); }
  async function save() { await saveResults(r); setFlash("Salvo ✓"); setTimeout(() => setFlash(""), 1500); }

  return (
    <div className="bz-card admin">
      <div className="bz-admin-h"><h3>⚙ Administrador</h3>{flash && <span className="bz-savedtag">{flash}</span>}<button className="bz-link" onClick={onExit}>fechar</button></div>
      <div className="bz-subtabs">
        {[["config", "Prazo & trava"], ["grupos", "Result. grupos"], ["mata", "Result. mata-mata"], ["especiais", "Especiais"], ["users", "Participantes"]].map(([k, l]) => (
          <button key={k} className={"bz-subtab" + (sec === k ? " on" : "")} onClick={() => setSec(k)}>{l}</button>
        ))}
      </div>

      {sec === "config" && (
        <div className="bz-admin-body">
          <label className="bz-field">Prazo final (Brasília)
            <input className="bz-input" type="datetime-local" value={config.deadline} onChange={(e) => saveConfig({ ...config, deadline: e.target.value })} />
          </label>
          <label className="bz-check"><input type="checkbox" checked={config.globalLock} onChange={(e) => saveConfig({ ...config, globalLock: e.target.checked })} /> Encerrar palpites de todos agora (trava geral)</label>
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
          <button className="bz-btn primary" onClick={save}>Salvar resultados</button>
        </div>
      )}

      {sec === "mata" && (
        <div className="bz-admin-body scroll">
          <p className="bz-hint">Quem avançou em cada confronto (código FIFA, ex.: BRA) e, se quiser, o placar para o bônus.</p>
          {KO_IDS.map((id) => (
            <div className="bz-koadmin" key={id}>
              <span className="bz-ko-id">{id}</span>
              <span className="bz-ko-lbl">{ROUND_LABEL[BRACKET[id].round]}</span>
              <input className="bz-input small" placeholder="Avançou (ex.: BRA)" value={r.koWinners[id] || ""} onChange={(e) => setKoWinner(id, e.target.value.toUpperCase())} list="codes" />
              <input className="bz-score" placeholder="-" value={r.koScores[id]?.a ?? ""} onChange={(e) => setKoScore(id, "a", e.target.value)} />
              <span className="bz-x">×</span>
              <input className="bz-score" placeholder="-" value={r.koScores[id]?.b ?? ""} onChange={(e) => setKoScore(id, "b", e.target.value)} />
            </div>
          ))}
          <datalist id="codes">{ALL_CODES.map((c) => <option key={c} value={c}>{T[c].n}</option>)}</datalist>
          <button className="bz-btn primary" onClick={save}>Salvar resultados</button>
        </div>
      )}

      {sec === "especiais" && (
        <div className="bz-admin-body">
          {[["campeao", "Campeão"], ["vice", "Vice"], ["terceiro", "3º Lugar"]].map(([k, l]) => (
            <label className="bz-field" key={k}>{l}
              <select className="bz-input" value={r.special?.[k] || ""} onChange={(e) => setSpec(k, e.target.value)}>
                <option value="">—</option>
                {GROUP_LETTERS.map((g) => <optgroup key={g} label={"Grupo " + g}>{GROUPS[g].map((c) => <option key={c} value={c}>{T[c].n}</option>)}</optgroup>)}
              </select>
            </label>
          ))}
          <label className="bz-field">Artilheiro <input className="bz-input" value={r.special?.artilheiro || ""} onChange={(e) => setSpec("artilheiro", e.target.value)} /></label>
          <label className="bz-field">Melhor Jogador <input className="bz-input" value={r.special?.melhorJogador || ""} onChange={(e) => setSpec("melhorJogador", e.target.value)} /></label>
          <button className="bz-btn primary" onClick={save}>Salvar especiais</button>
        </div>
      )}

      {sec === "users" && (
        <div className="bz-admin-body">
          <p className="bz-hint">{everyone.length} participante(s).</p>
          <div className="bz-userlist">
            {everyone.map((e) => (<div className="bz-userrow" key={e.id}><span>{e.name}{e.isAdmin && " · ADM"}</span><span>{e.locked ? "🔒 bloqueado" : "aberto"}</span></div>))}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ k, t, s }) {
  return (<div className="bz-sectiontitle"><span className="bz-kicker">{k}</span><h2>{t}</h2>{s && <p>{s}</p>}</div>);
}
