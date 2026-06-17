/* Horários de início dos jogos de grupo.
   Derivado AUTOMATICAMENTE da tabela em client/src/data.js — assim, qualquer
   mudança de data/hora feita no data.js passa a valer no servidor sem precisar
   editar este arquivo. */
import { GROUP_MATCHES, matchKickoff, MATCH_LOCK_MIN } from "../client/src/data.js";

export { MATCH_LOCK_MIN };
export const KICKOFFS = Object.fromEntries(GROUP_MATCHES.map((m) => [m.id, matchKickoff(m)]));
