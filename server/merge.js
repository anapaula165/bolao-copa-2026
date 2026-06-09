// Mescla os palpites recebidos com os já salvos, aceitando só o que está liberado:
// - jogos de grupo: travam (kickoffs[id] - lockMin) ; só aceita os ainda abertos
// - especiais: travam no prazo config.deadline
// - mata-mata: só quando aberto e não travado
// globalLock congela tudo.
export function mergeAllowed(cur, incoming, config, now, kickoffs, lockMin) {
  cur = cur || {}; incoming = incoming || {}; config = config || {};
  const out = {
    groups: { ...(cur.groups || {}) },
    bracket: cur.bracket || { slots: {}, winners: {}, scores: {} },
    special: cur.special || {},
  };
  const global = !!config.globalLock;
  const inG = incoming.groups || {};
  if (!global) {
    for (const id of Object.keys(kickoffs)) {
      const locked = now >= kickoffs[id] - lockMin * 60000;
      if (!locked && Object.prototype.hasOwnProperty.call(inG, id)) out.groups[id] = inG[id];
    }
  }
  const specialsClosed = global || (config.deadline && now > new Date(config.deadline).getTime());
  if (!specialsClosed && incoming.special) out.special = incoming.special;
  const koEditable = config.bracketOpen && !config.bracketLocked && !global;
  if (koEditable && incoming.bracket) {
    out.bracket = {
      slots: (cur.bracket && cur.bracket.slots) || {},
      winners: incoming.bracket.winners || {},
      scores: incoming.bracket.scores || {},
    };
  }
  return out;
}
