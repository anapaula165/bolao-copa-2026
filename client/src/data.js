/* ============================================================
   DADOS E LÓGICA DO BOLÃO — Copa do Mundo 2026
   (times, tabela oficial dos 72 jogos, chaveamento FIFA, pontuação)
   ============================================================ */

const POINTS = {
  placarExato: 3,
  resultadoCerto: 1,
  mataMataAvanca: 3,   // acertar quem avança em cada confronto
  mataMataPlacar: 1,   // bônus se o placar (opcional) estiver exato
  campeao: 8,
  vice: 5,
  terceiro: 3,
  artilheiro: 5,
  melhorJogador: 5,
};

const T = {
  // A
  MEX:{n:"México",iso:"mx",g:"A"}, RSA:{n:"África do Sul",iso:"za",g:"A"}, KOR:{n:"Coreia do Sul",iso:"kr",g:"A"}, CZE:{n:"Rep. Tcheca",iso:"cz",g:"A"},
  // B
  CAN:{n:"Canadá",iso:"ca",g:"B"}, BIH:{n:"Bósnia e Herz.",iso:"ba",g:"B"}, QAT:{n:"Catar",iso:"qa",g:"B"}, SUI:{n:"Suíça",iso:"ch",g:"B"},
  // C
  BRA:{n:"Brasil",iso:"br",g:"C"}, MAR:{n:"Marrocos",iso:"ma",g:"C"}, HAI:{n:"Haiti",iso:"ht",g:"C"}, SCO:{n:"Escócia",iso:"gb-sct",g:"C"},
  // D
  USA:{n:"Estados Unidos",iso:"us",g:"D"}, PAR:{n:"Paraguai",iso:"py",g:"D"}, AUS:{n:"Austrália",iso:"au",g:"D"}, TUR:{n:"Turquia",iso:"tr",g:"D"},
  // E
  GER:{n:"Alemanha",iso:"de",g:"E"}, CUW:{n:"Curaçao",iso:"cw",g:"E"}, CIV:{n:"Costa do Marfim",iso:"ci",g:"E"}, ECU:{n:"Equador",iso:"ec",g:"E"},
  // F
  NED:{n:"Holanda",iso:"nl",g:"F"}, JPN:{n:"Japão",iso:"jp",g:"F"}, SWE:{n:"Suécia",iso:"se",g:"F"}, TUN:{n:"Tunísia",iso:"tn",g:"F"},
  // G
  BEL:{n:"Bélgica",iso:"be",g:"G"}, EGY:{n:"Egito",iso:"eg",g:"G"}, IRN:{n:"Irã",iso:"ir",g:"G"}, NZL:{n:"Nova Zelândia",iso:"nz",g:"G"},
  // H
  ESP:{n:"Espanha",iso:"es",g:"H"}, CPV:{n:"Cabo Verde",iso:"cv",g:"H"}, KSA:{n:"Arábia Saudita",iso:"sa",g:"H"}, URU:{n:"Uruguai",iso:"uy",g:"H"},
  // I
  FRA:{n:"França",iso:"fr",g:"I"}, SEN:{n:"Senegal",iso:"sn",g:"I"}, IRQ:{n:"Iraque",iso:"iq",g:"I"}, NOR:{n:"Noruega",iso:"no",g:"I"},
  // J
  ARG:{n:"Argentina",iso:"ar",g:"J"}, ALG:{n:"Argélia",iso:"dz",g:"J"}, AUT:{n:"Áustria",iso:"at",g:"J"}, JOR:{n:"Jordânia",iso:"jo",g:"J"},
  // K
  POR:{n:"Portugal",iso:"pt",g:"K"}, COD:{n:"RD Congo",iso:"cd",g:"K"}, UZB:{n:"Uzbequistão",iso:"uz",g:"K"}, COL:{n:"Colômbia",iso:"co",g:"K"},
  // L
  ENG:{n:"Inglaterra",iso:"gb-eng",g:"L"}, CRO:{n:"Croácia",iso:"hr",g:"L"}, PAN:{n:"Panamá",iso:"pa",g:"L"}, GHA:{n:"Gana",iso:"gh",g:"L"},
};
const ALL_CODES = Object.keys(T);
const GROUPS = {};
ALL_CODES.forEach((c) => { (GROUPS[T[c].g] = GROUPS[T[c].g] || []).push(c); });
const GROUP_LETTERS = ["A","B","C","D","E","F","G","H","I","J","K","L"];

/* ---------- JOGOS DA FASE DE GRUPOS (tabela oficial FIFA · horários de Brasília) ---------- */
// [id, grupo, mandante, visitante, rodada, data, dia, hora, estádio]
const GM = [
  // GRUPO A
  ["GA1","A","MEX","RSA",1,"11/jun","qui","16h","Cidade do México"],
  ["GA2","A","KOR","CZE",1,"11/jun","qui","23h","Guadalajara"],
  ["GA3","A","CZE","RSA",2,"18/jun","qui","13h","Atlanta"],
  ["GA4","A","MEX","KOR",2,"18/jun","qui","22h","Guadalajara"],
  ["GA5","A","CZE","MEX",3,"24/jun","qua","22h","Cidade do México"],
  ["GA6","A","RSA","KOR",3,"24/jun","qua","22h","Monterrey"],
  // GRUPO B
  ["GB1","B","CAN","BIH",1,"12/jun","sex","16h","Toronto"],
  ["GB2","B","QAT","SUI",1,"13/jun","sáb","16h","San Francisco"],
  ["GB3","B","SUI","BIH",2,"18/jun","qui","16h","Los Angeles"],
  ["GB4","B","CAN","QAT",2,"18/jun","qui","19h","Vancouver"],
  ["GB5","B","SUI","CAN",3,"24/jun","qua","16h","Vancouver"],
  ["GB6","B","BIH","QAT",3,"24/jun","qua","16h","Seattle"],
  // GRUPO C
  ["GC1","C","BRA","MAR",1,"13/jun","sáb","19h","Nova York/NJ"],
  ["GC2","C","HAI","SCO",1,"13/jun","sáb","22h","Boston"],
  ["GC3","C","SCO","MAR",2,"19/jun","sex","19h","Boston"],
  ["GC4","C","BRA","HAI",2,"19/jun","sex","21h30","Filadélfia"],
  ["GC5","C","SCO","BRA",3,"24/jun","qua","19h","Miami"],
  ["GC6","C","MAR","HAI",3,"24/jun","qua","19h","Atlanta"],
  // GRUPO D
  ["GD1","D","USA","PAR",1,"12/jun","sex","22h","Los Angeles"],
  ["GD2","D","AUS","TUR",1,"13/jun","sáb","1h","Vancouver"],
  ["GD3","D","TUR","PAR",2,"19/jun","sex","1h","San Francisco"],
  ["GD4","D","USA","AUS",2,"19/jun","sex","16h","Seattle"],
  ["GD5","D","TUR","USA",3,"25/jun","qui","23h","Los Angeles"],
  ["GD6","D","PAR","AUS",3,"25/jun","qui","23h","San Francisco"],
  // GRUPO E
  ["GE1","E","GER","CUW",1,"14/jun","dom","14h","Houston"],
  ["GE2","E","CIV","ECU",1,"14/jun","dom","20h","Filadélfia"],
  ["GE3","E","GER","CIV",2,"20/jun","sáb","17h","Toronto"],
  ["GE4","E","ECU","CUW",2,"20/jun","sáb","21h","Kansas City"],
  ["GE5","E","ECU","GER",3,"25/jun","qui","17h","Nova York/NJ"],
  ["GE6","E","CUW","CIV",3,"25/jun","qui","17h","Filadélfia"],
  // GRUPO F
  ["GF1","F","NED","JPN",1,"14/jun","dom","17h","Dallas"],
  ["GF2","F","SWE","TUN",1,"14/jun","dom","23h","Monterrey"],
  ["GF3","F","NED","SWE",2,"20/jun","sáb","14h","Houston"],
  ["GF4","F","TUN","JPN",2,"21/jun","dom","1h","Monterrey"],
  ["GF5","F","JPN","SWE",3,"25/jun","qui","20h","Dallas"],
  ["GF6","F","TUN","NED",3,"25/jun","qui","20h","Kansas City"],
  // GRUPO G
  ["GG1","G","BEL","EGY",1,"15/jun","seg","16h","Seattle"],
  ["GG2","G","IRN","NZL",1,"15/jun","seg","22h","Los Angeles"],
  ["GG3","G","BEL","IRN",2,"21/jun","dom","16h","Los Angeles"],
  ["GG4","G","NZL","EGY",2,"21/jun","dom","22h","Vancouver"],
  ["GG5","G","EGY","IRN",3,"27/jun","sáb","0h","Seattle"],
  ["GG6","G","NZL","BEL",3,"27/jun","sáb","0h","Vancouver"],
  // GRUPO H
  ["GH1","H","ESP","CPV",1,"15/jun","seg","13h","Atlanta"],
  ["GH2","H","KSA","URU",1,"15/jun","seg","19h","Miami"],
  ["GH3","H","ESP","KSA",2,"21/jun","dom","13h","Atlanta"],
  ["GH4","H","URU","CPV",2,"21/jun","dom","19h","Miami"],
  ["GH5","H","CPV","KSA",3,"26/jun","sex","21h","Houston"],
  ["GH6","H","URU","ESP",3,"26/jun","sex","21h","Guadalajara"],
  // GRUPO I
  ["GI1","I","FRA","SEN",1,"16/jun","ter","16h","Nova York/NJ"],
  ["GI2","I","IRQ","NOR",1,"16/jun","ter","19h","Boston"],
  ["GI3","I","FRA","IRQ",2,"22/jun","seg","18h","Filadélfia"],
  ["GI4","I","NOR","SEN",2,"22/jun","seg","21h","Nova York/NJ"],
  ["GI5","I","NOR","FRA",3,"26/jun","sex","16h","Boston"],
  ["GI6","I","SEN","IRQ",3,"26/jun","sex","16h","Toronto"],
  // GRUPO J
  ["GJ1","J","ARG","ALG",1,"16/jun","ter","14h","Kansas City"],
  ["GJ2","J","AUT","JOR",1,"17/jun","qua","1h","San Francisco"],
  ["GJ3","J","ARG","AUT",2,"22/jun","seg","14h","Dallas"],
  ["GJ4","J","JOR","ALG",2,"23/jun","ter","0h","San Francisco"],
  ["GJ5","J","ALG","AUT",3,"27/jun","sáb","23h","Kansas City"],
  ["GJ6","J","JOR","ARG",3,"27/jun","sáb","23h","Dallas"],
  // GRUPO K
  ["GK1","K","POR","COD",1,"17/jun","qua","14h","Houston"],
  ["GK2","K","UZB","COL",1,"17/jun","qua","23h","Cidade do México"],
  ["GK3","K","POR","UZB",2,"23/jun","ter","14h","Houston"],
  ["GK4","K","COL","COD",2,"23/jun","ter","23h","Guadalajara"],
  ["GK5","K","COL","POR",3,"27/jun","sáb","20h30","Miami"],
  ["GK6","K","COD","UZB",3,"27/jun","sáb","20h30","Atlanta"],
  // GRUPO L
  ["GL1","L","ENG","CRO",1,"17/jun","qua","17h","Dallas"],
  ["GL2","L","GHA","PAN",1,"17/jun","qua","20h","Toronto"],
  ["GL3","L","ENG","GHA",2,"23/jun","ter","17h","Boston"],
  ["GL4","L","PAN","CRO",2,"23/jun","ter","20h","Toronto"],
  ["GL5","L","PAN","ENG",3,"27/jun","sáb","18h","Nova York/NJ"],
  ["GL6","L","CRO","GHA",3,"27/jun","sáb","18h","Filadélfia"],
];
const GROUP_MATCHES = GM.map(([id,group,home,away,md,date,dow,time,venue]) =>
  ({ id, group, home, away, md, date, dow, time, venue })); // 72

const pos = (label, group, p) => ({ type: "pos", label, group, pos: p });
const third = (label, groups) => ({ type: "third", label, groups });
const BRACKET = {
  // LADO ESQUERDO — 32-avos
  M73:{side:"L",round:"R32",slots:[pos("2ºA","A",2),pos("2ºB","B",2)]},
  M74:{side:"L",round:"R32",slots:[pos("1ºE","E",1),third("Melhor 3º (A/B/C/D/F)",["A","B","C","D","F"])]},
  M75:{side:"L",round:"R32",slots:[pos("1ºF","F",1),pos("2ºC","C",2)]},
  M76:{side:"L",round:"R32",slots:[pos("1ºC","C",1),pos("2ºF","F",2)]},
  M77:{side:"L",round:"R32",slots:[pos("1ºI","I",1),third("Melhor 3º (C/D/F/G/H)",["C","D","F","G","H"])]},
  M78:{side:"L",round:"R32",slots:[pos("2ºE","E",2),pos("2ºI","I",2)]},
  M79:{side:"L",round:"R32",slots:[pos("1ºA","A",1),third("Melhor 3º (C/E/F/H/I)",["C","E","F","H","I"])]},
  M80:{side:"L",round:"R32",slots:[pos("1ºL","L",1),third("Melhor 3º (E/H/I/J/K)",["E","H","I","J","K"])]},
  // LADO DIREITO — 32-avos
  M81:{side:"R",round:"R32",slots:[pos("1ºD","D",1),third("Melhor 3º (B/E/F/I/J)",["B","E","F","I","J"])]},
  M82:{side:"R",round:"R32",slots:[pos("1ºG","G",1),third("Melhor 3º (A/E/H/I/J)",["A","E","H","I","J"])]},
  M83:{side:"R",round:"R32",slots:[pos("1ºB","B",1),third("Melhor 3º (E/F/I/J/L)",["E","F","I","J","L"])]},
  M84:{side:"R",round:"R32",slots:[pos("1ºH","H",1),pos("2ºG","G",2)]},
  M85:{side:"R",round:"R32",slots:[pos("1ºJ","J",1),third("Melhor 3º (C/D/G/H/I)",["C","D","G","H","I"])]},
  M86:{side:"R",round:"R32",slots:[pos("1ºK","K",1),pos("2ºJ","J",2)]},
  M87:{side:"R",round:"R32",slots:[pos("2ºK","K",2),pos("2ºL","L",2)]},
  M88:{side:"R",round:"R32",slots:[pos("2ºD","D",2),pos("2ºH","H",2)]},
  // Oitavas
  M89:{side:"L",round:"R16",feeders:["M74","M77"]},
  M90:{side:"L",round:"R16",feeders:["M73","M75"]},
  M91:{side:"L",round:"R16",feeders:["M76","M78"]},
  M92:{side:"L",round:"R16",feeders:["M79","M80"]},
  M93:{side:"R",round:"R16",feeders:["M83","M84"]},
  M94:{side:"R",round:"R16",feeders:["M81","M82"]},
  M95:{side:"R",round:"R16",feeders:["M86","M88"]},
  M96:{side:"R",round:"R16",feeders:["M85","M87"]},
  // Quartas
  M97:{side:"L",round:"QF",feeders:["M89","M90"]},
  M98:{side:"L",round:"QF",feeders:["M91","M92"]},
  M99:{side:"R",round:"QF",feeders:["M93","M94"]},
  M100:{side:"R",round:"QF",feeders:["M95","M96"]},
  // Semifinais
  M101:{side:"L",round:"SF",feeders:["M97","M98"]},
  M102:{side:"R",round:"SF",feeders:["M99","M100"]},
  // 3º lugar e Final
  M103:{side:"C",round:"3P",feeders:["M101","M102"],losers:true},
  M104:{side:"C",round:"F",feeders:["M101","M102"]},
};
const KO_IDS = Object.keys(BRACKET);
const ROUND_LABEL = { R32:"32-avos de final", R16:"Oitavas de final", QF:"Quartas de final", SF:"Semifinais", "3P":"Disputa de 3º lugar", F:"Final" };

function computeStandings(pred) {
  // retorna { A:[code ordenado 1º..4º], ... } pelos placares palpitados
  const st = {};
  GROUP_LETTERS.forEach((g)=>{
    const tbl = {}; GROUPS[g].forEach((c)=> tbl[c]={c,pts:0,gf:0,ga:0});
    GROUP_MATCHES.filter(m=>m.group===g).forEach((m)=>{
      const p = pred.groups[m.id]; if(!p||p.a===""||p.b===""||p.a==null||p.b==null) return;
      const a=+p.a, b=+p.b; tbl[m.home].gf+=a; tbl[m.home].ga+=b; tbl[m.away].gf+=b; tbl[m.away].ga+=a;
      if(a>b) tbl[m.home].pts+=3; else if(b>a) tbl[m.away].pts+=3; else { tbl[m.home].pts++; tbl[m.away].pts++; }
    });
    st[g] = Object.values(tbl).sort((x,y)=> y.pts-x.pts || (y.gf-y.ga)-(x.gf-x.ga) || y.gf-x.gf || x.c.localeCompare(y.c)).map(r=>r.c);
  });
  return st;
}

function resolveBracketTeams(pred) {
  // resolve as duas seleções de cada confronto a partir de slots(R32) e vencedores(propaga)
  const teams = {}; // Mxx -> [code|null, code|null]
  const w = pred.bracket.winners || {};
  const slots = pred.bracket.slots || {};
  KO_IDS.forEach((id)=>{
    const m = BRACKET[id];
    if (m.round==="R32") {
      teams[id] = [ slots[`${id}-0`]||null, slots[`${id}-1`]||null ];
    } else if (m.losers) { // 3º lugar = perdedores das semis
      teams[id] = m.feeders.map((f)=>{
        const pair = teams[f]; const win = w[f];
        if(!pair||!win) return null;
        return pair[0]===win ? pair[1] : (pair[1]===win ? pair[0] : null);
      });
    } else {
      teams[id] = m.feeders.map((f)=> w[f]||null);
    }
  });
  return teams;
}

function scoreUser(pred, results) {
  let pts = 0, det = { grupos:0, mata:0, especiais:0 };
  // grupos
  GROUP_MATCHES.forEach((m)=>{
    const p = pred.groups[m.id], r = results.groups[m.id];
    if(!p||!r||p.a===""||p.b===""||r.a===""||r.b===""||p.a==null||r.a==null) return;
    const pa=+p.a,pb=+p.b,ra=+r.a,rb=+r.b;
    if(pa===ra&&pb===rb){ pts+=POINTS.placarExato; det.grupos+=POINTS.placarExato; }
    else if(Math.sign(pa-pb)===Math.sign(ra-rb)){ pts+=POINTS.resultadoCerto; det.grupos+=POINTS.resultadoCerto; }
  });
  // mata-mata: vencedor + placar opcional
  KO_IDS.forEach((id)=>{
    const rw = results.koWinners[id]; const pw = pred.bracket.winners[id];
    if(rw && pw && rw===pw){ pts+=POINTS.mataMataAvanca; det.mata+=POINTS.mataMataAvanca; }
    const rs = results.koScores[id], ps = pred.bracket.scores[id];
    if(rs && ps && rs.a!==""&&rs.b!==""&&ps.a!==""&&ps.b!==""&&rs.a!=null&&ps.a!=null
       && +rs.a===+ps.a && +rs.b===+ps.b){ pts+=POINTS.mataMataPlacar; det.mata+=POINTS.mataMataPlacar; }
  });
  // especiais
  const sp = results.special||{};
  const eq = (a,b)=> a&&b&&String(a).trim().toLowerCase()===String(b).trim().toLowerCase();
  if(eq(pred.special.campeao, sp.campeao)){ pts+=POINTS.campeao; det.especiais+=POINTS.campeao; }
  if(eq(pred.special.vice, sp.vice)){ pts+=POINTS.vice; det.especiais+=POINTS.vice; }
  if(eq(pred.special.terceiro, sp.terceiro)){ pts+=POINTS.terceiro; det.especiais+=POINTS.terceiro; }
  if(eq(pred.special.artilheiro, sp.artilheiro)){ pts+=POINTS.artilheiro; det.especiais+=POINTS.artilheiro; }
  if(eq(pred.special.melhorJogador, sp.melhorJogador)){ pts+=POINTS.melhorJogador; det.especiais+=POINTS.melhorJogador; }
  return { pts, det };
}

const MAX_POINTS = GROUP_MATCHES.length*POINTS.placarExato
  + KO_IDS.length*(POINTS.mataMataAvanca+POINTS.mataMataPlacar)
  + POINTS.campeao+POINTS.vice+POINTS.terceiro+POINTS.artilheiro+POINTS.melhorJogador;

export const emptyData = () => ({ groups:{}, bracket:{ slots:{}, winners:{}, scores:{} }, special:{} });

export { T, ALL_CODES, GROUPS, GROUP_LETTERS, GM, GROUP_MATCHES, BRACKET, KO_IDS, ROUND_LABEL, POINTS, MAX_POINTS, computeStandings, resolveBracketTeams, scoreUser };
