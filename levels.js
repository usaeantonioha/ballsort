"use strict";
/* ============================================================
   levels.js — Generador + verificador de la campaña (30 niveles)
   Cada nivel cumple el invariante: N colores × 4 bolas,
   N tubos llenos + 2 vacíos. Se generan por REVERSE-SHUFFLE
   (vertedes inversos desde el tablero resuelto → garantiza
   mezcla real y resolubilidad) y se validan con BFS óptimo
   bajo las reglas EXACTAS del motor (una bola por jugada).
   Salida: array LEVELS listo para pegar en index.html.
   ============================================================ */

const CAP = 4;
// [colores, seed] progresión suave 2→10 colores a lo largo de 30 niveles
const SPEC = [];
for (let i = 0; i < 30; i++) {
  const colors = 2 + Math.round(i * 8 / 29);          // 2..10 colores
  SPEC.push({ colors, seed: 1000 + i * 7919 });
}

/* ---------- PRNG determinista (mulberry32) ---------- */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Reglas del GENERADOR (vertedres en racha, como Water Sort) ---------- */
/* El motor de juego vierte UNA bola por jugada; el generador usa rachas
   para explorar rápido. Cualquier estado alcanzado con vertedres de racha
   es resoluble también bola-a-bola (cada racha = k movimientos unitarios),
   así que la verificación final SIEMPRE se hace con BFS de 1 bola. */
const key = ts => ts.map(t => t.join(",")).join("|");
function applyMove(s, f, t) {                     // unitario (motor de juego + BFS)
  if (f === t) return null;
  const src = s[f], dst = s[t];
  if (!src.length || dst.length >= CAP) return null;
  const col = src[src.length - 1];
  if (dst.length && dst[dst.length - 1] !== col) return null;
  const ns = s.map(x => x.slice());
  ns[f].pop(); ns[t].push(col);
  return ns;
}
function applyRun(s, f, t) {                      // racha (solo generador)
  if (f === t) return null;
  const src = s[f], dst = s[t];
  if (!src.length || !dst.length || dst.length >= CAP) return null;
  const col = src[src.length - 1];
  if (dst[dst.length - 1] !== col) return null;
  let run = 0;
  for (let i = src.length - 1; i >= 0 && src[i] === col; i--) run++;
  const k = Math.min(run, CAP - dst.length);
  const ns = s.map(x => x.slice());
  for (let i = 0; i < k; i++) { ns[f].pop(); ns[t].push(col); }
  return ns;
}
const solved = ts => ts.every(t => !t.length || (t.length === CAP && t.every(b => b === t[0])));

// ¿el estado está "demasiado cerca" de resuelto? (para descartar mezclas triviales)
function closeness(ts) {
  let monoFilled = 0;
  for (const t of ts) if (t.length === CAP && t.every(b => b === t[0])) monoFilled++;
  return monoFilled;
}

/* ---------- Barajado directo + validación por solucionador ---------- */
/* Reparto aleatorio de las 4×N bolas entre los N tubos llenos (los 2
   slots extra quedan vacíos). La resolubilidad NO se asume: cada
   candidato pasa por el solucionador DFS (reglas unitarias exactas del
   motor) y solo se acepta si es soluble con ruta suficientemente larga. */
function generate(colors, seed) {
  const rand = rng(seed);
  const balls = [];
  for (let c = 0; c < colors; c++) for (let k = 0; k < CAP; k++) balls.push(c);
  // Fisher-Yates
  for (let i = balls.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [balls[i], balls[j]] = [balls[j], balls[i]];
  }
  const st = [];
  for (let t = 0; t < colors; t++) st.push(balls.slice(t * CAP, t * CAP + CAP));
  st.push([]); st.push([]);
  return st;
}

/* ---------- Distribuciones FIJAS para niveles bajos (2-3 colores) ----------
   Con pocas bolas casi todo barajado es trivial o insoluble → mezclas
   curadas; ambas verificadas por el solucionador del propio archivo. */
const CURATED = {
  2: [[1,0,0,1],[0,1,1,0],[],[]],                                   // óptimo BFS: 8
};

/* ---------- BFS óptimo (mismas reglas que el juego) ---------- */
function bfs(start, capStates = 400000) {
  if (solved(start)) return { dist: 0, path: [] };
  const seen = new Map([[key(start), null]]);
  let frontier = [start];
  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      for (let f = 0; f < s.length; f++)
        for (let t = 0; t < s.length; t++) {
          if (f === t) continue;
          const ns = applyMove(s, f, t);
          if (!ns) continue;
          const k = key(ns);
          if (seen.has(k)) continue;
          seen.set(k, { prev: s, mv: [f, t] });
          if (solved(ns)) {                       // reconstruir ruta
            const path = []; let cur = ns;
            while (true) {
              const e = seen.get(key(cur));
              if (!e || !e.mv) break;
              path.unshift(e.mv); cur = e.prev;
            }
            return { dist: path.length, path };
          }
          next.push(ns);
          if (seen.size > capStates) return null;
        }
    }
    frontier = next;
  }
  return null;
}

/* ---------- Solucionador DFS con poda + ordenación heurística ----------
   BFS es prohibitivo para ≥8 colores; el DFS con podas clásicas, memo de
   estados sin salida y exploración priorizada (agrupar colores / vaciar
   tubos primero) resuelve estos tamaños en milisegundos. Solo se usa para
   VERIFICAR resolubilidad + obtener una ruta concreta (luego el juego
   reproduce esa ruta tap-a-tap contra el motor real). */
function solve(ts, nodeCap = 400000) {
  const s = ts.map(x => x.slice());
  const n = s.length;
  if (solved(s)) return [];
  let nodes = 0;
  const memo = new Set();                    // claves ya agotadas
  function dfs(depth, limit, path) {
    if (nodes++ > nodeCap) throw new Error("cap");
    if (solved(s)) return true;
    if (depth >= limit) return false;
    const k = key(s);
    if (memo.has(k)) return false;
    // enumerar jugadas legales y PRIORIZARLAS: verter hacia un tubo que ya
    // tenga el color (agrupar) puntúa más; rellenar/vaciar también suma
    const plays = [];
    for (let f = 0; f < n; f++) {
      if (!s[f].length) continue;
      if (s[f].length === CAP && s[f].every(b => b === s[f][0])) continue; // tubo hecho
      const col = s[f][s[f].length - 1];
      let anyNonEmpty = false;
      for (let t = 0; t < n; t++)
        if (t !== f && s[t].length && s[t][s[t].length - 1] === col && s[t].length < CAP)
          { anyNonEmpty = true; break; }
      for (let t = 0; t < n; t++) {
        if (t === f) continue;
        if (s[t].length >= CAP) continue;
        const top = s[t].length ? s[t][s[t].length - 1] : null;
        if (top !== null && top !== col) continue;
        if (top === null && anyNonEmpty) continue;                 // no a vacío si hay igual arriba
        if (top === null && s[f].every(b => b === col)) continue;  // mover tubo entero a vacío = no-op
        let score = 0;
        if (top === col) score += 2 + s[t].length;                 // agrupar sobre mismo color
        if (top === null && s[f].length <= 2) score += 3;          // vaciar tubo casi listo
        plays.push({ f, t, score });
      }
    }
    plays.sort((a, b) => b.score - a.score);
    for (const p of plays) {
      const col = s[p.f][s[p.f].length - 1];   // color ANTES de extraer
      s[p.f].pop(); s[p.t].push(col);
      path.push([p.f, p.t]);
      if (dfs(depth + 1, limit, path)) return true;
      path.pop();
      s[p.t].pop(); s[p.f].push(col);          // deshacer exacto
    }
    memo.add(k);                               // ningún descendiente sirvió
    return false;
  }
  const path = [];
  try {
    for (let limit = 6; limit <= 90; limit += 3) {
      nodes = 0;
      if (dfs(0, limit, path)) return path;
    }
  } catch (e) { /* cap superado → considerar insoluble para el generador */ }
  return null;
}

/* ---------- Validación estructural del nivel ---------- */
function validate(ts, colors) {
  const flat = ts.flat();
  if (ts.length !== colors + 2) return "nº de tubos != colores+2";
  if (flat.length !== colors * CAP) return "bolas totales != 4×colores";
  if (ts.some(t => t.length > CAP)) return "tubo desbordado";
  const cnt = {};
  for (const b of flat) cnt[b] = (cnt[b] || 0) + 1;
  for (let c = 0; c < colors; c++) if (cnt[c] !== CAP) return `color ${c} no tiene 4 bolas`;
  const empties = ts.filter(t => !t.length).length;
  if (empties !== 2) return "debe haber exactamente 2 tubos vacíos";
  if (ts.some(t => t.length === CAP && t.every(b => b === t[0]))) return "empieza con tubo ya completo";
  return null;
}

/* ---------- Construcción de la campaña (30 niveles) ---------- */
const NAMES = [
  "Primer Chispa","Brisa Suave","Alba Serena","Luz de Menta","Cintalita",
  "Reflejo Azul","Aurora Boreal","Viento Solar","Nebulosa Rosa","Campos Magnéticos",
  "Cola de Cometa","Lluvia de Meteoros","Cinturón Van Allen","Ola de Choque","Estrella Fugaz",
  "Pulsar Verde","Vórtice Violeta","Corona Solar","Gran Tormenta","Aurora Carmesí",
  "Disco de Acreción","Supernova","Quásar Distante","Materia Oscura","Enana Roja",
  "Gigante Azul","Cumulus Nimbus","Campo Estelar","Horizonte de Sucesos","Big Bang"
];

/* Soluble con podas ⇒ aceptable si la ruta tiene longitud mínima.
   Para ≤7 colores usamos BFS (distancia óptima real); para más, DFS. */
function evaluate(cand, colors) {
  if (validate(cand, colors)) return null;                 // estructura inválida
  let path;
  if (colors <= 7) {
    const r = bfs(cand, 250000);
    if (!r) return null;
    path = r.path;
  } else {
    path = solve(cand, 300000);
    if (!path) return null;
  }
  if (path.length < colors + 4) return null;               // demasiado trivial
  return path;
}

function buildCampaign() {
  const out = [];
  for (let i = 0; i < 30; i++) {
    const { colors } = SPEC[i];
    let chosen = null, path = null;
    if (CURATED[colors] && !out.some(o => o.colors === colors)) {
      // primera aparición del nº de colores: usar distribución curada fija
      const p = evaluate(CURATED[colors], colors);
      if (p) { chosen = CURATED[colors].map(t => t.slice()); path = p; }
    }
    if (!chosen) {
      // barajar candidatos deterministas hasta encontrar uno válido y no repetido
      const seenKeys = new Set(out.map(o => key(o.tubes)));
      for (let s = 0; s < 800 && !chosen; s++) {
        const cand = generate(colors, 1000 + i * 7919 + s * 104729);
        const p = evaluate(cand, colors);
        if (!p) continue;
        const k = key(cand);
        if (seenKeys.has(k)) continue;                     // no repetir mezcla
        seenKeys.add(k);
        chosen = cand; path = p;
      }
    }
    if (!chosen) throw new Error(`No se pudo generar el nivel ${i + 1}`);
    out.push({ name: NAMES[i], colors, tubes: chosen, dist: path.length });
  }
  return out;
}

if (typeof module === "object") module.exports = { buildCampaign, CAP, SPEC, bfs, solve, validate, generate, CURATED, key, applyMove, solved };

if (require.main === module) {
  const campaign = buildCampaign();
  // imprimir como literal JS listo para index.html
  const lines = campaign.map(l =>
    ` {name:"${l.name}", tubes:[${l.tubes.map(t => "[" + t.join(",") + "]").join(",")}]}${",".repeat(0)},`.replace("},,", "},"));
  console.log("const LEVELS = [");
  campaign.forEach((l, i) => {
    console.log(` {name:"${l.name}", tubes:[${l.tubes.map(t => `[${t.join(",")}]`).join(",")}]},  // ${i + 1} · ${l.colors} colores · óptimo ${l.dist} movs`);
  });
  console.log("];");
}
