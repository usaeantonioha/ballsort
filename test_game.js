"use strict";
/* ============================================================
   Test automatizado de AURORA Ball Sort Zen
   1) Extrae el <script> de index.html y lo ejecuta con un DOM
      mínimo simulado → verifica que el juego arranca sin errores.
   2) Prueba mecánica "tap-to-select, tap-to-pour" paso a paso.
   3) Verifica invariantes del nivel (bolas completas, conteos).
   4) Resuelve el nivel con DFS usando la MISMA lógica del juego
      (garantía de resolubilidad + solución óptima).
   ============================================================ */
const fs = require("fs");
const vm = require("vm");

/* ---------- DOM simulado mínimo ---------- */
function makeEl(id){
  return {
    id, children: [], style:{}, dataset:{}, _text:"", _html:"",
    classList:{ _s:new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)},
                toggle(c,f){f?this._s.add(c):this._s.delete(c)}, contains(c){return this._s.has(c)} },
    set innerHTML(v){ this._html=v; if(v==="") this.children=[]; },
    get innerHTML(){ return this._html; },
    set textContent(v){ this._text=v; },
    get textContent(){ return this._text; },
    lastChild:{ textContent:"" },
    appendChild(ch){ this.children.push(ch); return ch; },
    insertAdjacentHTML(){}, setAttribute(){}, getAttribute(){return null},
    addEventListener(){}, removeEventListener(){},
    get offsetWidth(){ return 0; },
  };
}
const ids = ["board","moves","best","time","undo","reset","sound","win","wintext","again","lvl-name"];
const els = {}; ids.forEach(i=>els[i]=makeEl(i));

let gameExports = null;
const sandbox = {
  console, setTimeout:(f,t)=>t<5000?f():undefined, clearTimeout, setInterval:()=>0, clearInterval,
  document:{ getElementById:i=>els[i]||makeEl(i), createElement:()=>makeEl(""),
             addEventListener(){}, body:makeEl("body") },
  window:{ AudioContext:undefined, webkitAudioContext:undefined },
  localStorage:{ _d:{}, getItem(k){return this._d[k]??null}, setItem(k,v){this._d[k]=String(v)} },
  module:{ exports:null },
};
vm.createContext(sandbox);

/* ---------- extraer y ejecutar el script del juego ---------- */
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if(!m) throw new Error("No se encontró <script> en index.html");
// envolver en función para que `module` del sandbox sea visible y "use strict" no bloquee reasignaciones
const wrapped = "(function(module){\n" + m[1] + "\n})";
const factory = vm.runInContext(wrapped, sandbox, {filename:"game.js"});
factory(sandbox.module);
gameExports = sandbox.module.exports;
if(!gameExports) throw new Error("El script no expuso API de pruebas");

const G = gameExports;
let pass = 0, fail = 0;
const ok = (cond,msg)=>{ cond?(pass++,console.log("  ✔ "+msg)):(fail++,console.log("  ✘ "+msg)); };

/* ---------- 1. Invariantes del nivel ---------- */
console.log("\n[1] Invariantes del nivel");
const NC = G.PALETTE.length;                       // nº de colores
const totalBalls = G.LEVEL_TUBES.reduce((a,t)=>a+t.length,0);
ok(G.LEVEL_TUBES.every(t=>t.length<=G.CAP), "ningún tubo supera la capacidad (CAP=4)");
ok(totalBalls === NC*G.CAP, `total de bolas = ${NC*G.CAP} (${NC} colores × ${G.CAP})`);
for(let c=0;c<NC;c++){
  const n = G.LEVEL_TUBES.flat().filter(b=>b===c).length;
  ok(n===G.CAP, `color ${c} aparece exactamente ${G.CAP} veces`);
}
ok(G.LEVEL_TUBES.filter(t=>t.length===0).length>=2, "hay al menos 2 tubos vacíos");

/* ---------- 2. Render inicial ---------- */
console.log("\n[2] Render e interacción básica");
ok(els.board.children.length === G.LEVEL_TUBES.length, `se renderizan ${G.LEVEL_TUBES.length} tubos en el tablero`);

/* Simular taps sobre el motor real del juego */
function tap(i){ G.tapTube(i); }

// reset a semilla conocida
G._setState(G.LEVEL_TUBES.map(t=>t.slice()));
let s = G._get();
ok(s.sel===null && s.moves===0, "estado inicial: sin selección, 0 movimientos");

// tap en tubo lleno → selecciona (levanta bola superior)
tap(0); s = G._get();
ok(s.sel===0, "tap en tubo con bolas → selecciona/levanta la bola superior");

// tap mismo tubo → deselecciona
tap(0); s = G._get();
ok(s.sel===null, "tap repetido en el mismo tubo → deselecciona");

// tap tubo vacío primero → no selecciona nada
const EMPTY1 = G.LEVEL_TUBES.findIndex(t=>t.length===0);
tap(EMPTY1); s = G._get();
ok(s.sel===null, "tap en tubo vacío sin selección previa → no hace nada (sin error)");

/* ---------- 3. Vertido real entre tubos ---------- */
console.log("\n[3] Vertido (tap origen → tap destino)");
// Tubo vacío recibe la superior del tubo 0 (color 3)
tap(0);            // seleccionar tubo 0
tap(EMPTY1);       // verter en el primer tubo vacío
s = G._get();
ok(s.tubes[EMPTY1].length===1 && s.tubes[EMPTY1][0]===3, `la bola viaja del tubo 0 al tubo ${EMPTY1+1}`);
ok(s.tubes[0].length===3, "el tubo de origen pierde una bola");
ok(s.moves===1, "contador de movimientos = 1");
ok(s.sel===null, "tras verter, no queda selección activa");

// undo restaura
G.undo();
s = G._get();
ok(s.tubes[EMPTY1].length===0 && s.tubes[0].length===4 && s.moves===0, "deshacer restaura el estado anterior");

// vertido inválido: color distinto sobre tubo no-vacío → se re-selecciona destino, no se vierte
tap(0); tap(1);    // tubo 1 superior=color 2, tubo 0 superior=color 3 → inválido
s = G._get();
ok(s.moves===0, "vertido inválido NO mueve bolas");
ok(s.sel===1, "tras vertido inválido, la selección pasa al tubo tocado");

// vertido multi-bola (mismo color apilado): caso válido dentro de CAP
// origen [0,2,2,2] vierte DOS '2' al destino [1,2] → [1,2,2,2]
G._setState([[0,2,2,2],[1,2],[],[]]);
tap(0); tap(1);
s = G._get();
ok(s.tubes[1].join()==="1,2,2,2" && s.tubes[0].join()==="0", "vierte varias bolas iguales a la vez (vertido múltiple)");
ok(s.moves===1, "el vertido múltiple cuenta como UN movimiento");
ok(s.won===false, "no se declara victoria prematura (quedan tubos sin completar)");

// victoria del motor real en escenario trivial: [x,y],[y,x] → 4 taps
G._setState([[0,1],[1,0],[],[]]);
tap(0); tap(2);   // mueve 1 → vacío
tap(1); tap(0);   // 0 sobre 0… verificar sin excepción
s = G._get();
ok(typeof s.won === "boolean", "escenario mixto no lanza errores");

/* ---------- 4. Resolución completa con la lógica del juego ---------- */
console.log("\n[4] ¿Es jugable hasta ganar? Búsqueda DFS con las reglas del juego");
function key(ts){ return ts.map(t=>t.join(".")).join("|"); }
function pourOn(ts, from, to, CAP){
  const f = ts[from], t = ts[to];
  if(!f.length || t.length>=CAP) return null;
  const col = f[f.length-1];
  if(t.length && t[t.length-1]!==col) return null;
  let n=0; for(let i=f.length-1;i>=0&&f[i]===col;i--) n++;
  n = Math.min(n, CAP-t.length);
  if(n<=0) return null;
  const nf = f.slice(0,f.length-n), nt = t.concat(Array(n).fill(col));
  const r = ts.map(x=>x.slice()); r[from]=nf; r[to]=nt; return r;
}
const CAP = G.CAP;
const solvedState = ts => ts.every(t=>t.length===0||(t.length===CAP&&t.every(b=>b===t[0])));
// nota: el juego exige todos los tubos llenos; con 8 tubos y 20 bolas hay 5 llenos+3... 
// nuestro nivel tiene 6 llenos? verificar con isSolved del propio juego abajo.

const start = G.LEVEL_TUBES.map(t=>t.slice());
// BFS para solución ÓPTIMA con las mismas reglas del motor
const parent = new Map([[key(start), {prev:null, mv:null}]]);
const queue = [start];
let solution = null, visited = 0;
while(queue.length && !solution){
  const st = queue.shift(); visited++;
  if(visited > 500000) break; // cota de seguridad
  if(st !== start && solvedState(st)){ solution = st; break; }
  for(let f=0; f<st.length && !solution; f++){
    for(let t=0; t<st.length && !solution; t++){
      if(f===t) continue;
      const ns = pourOn(st, f, t, CAP);
      if(!ns) continue;
      const k = key(ns);
      if(parent.has(k)) continue;
      parent.set(k, {prev:st, mv:[f,t]});
      queue.push(ns);
    }
  }
}
ok(solution!==null, `nivel RESOLUBLE (BFS exploró ${visited} estados)`);

if(solution){
  // reconstruir camino y replayarlo contra el MOTOR REAL del juego
  const path = [];
  let cur = key(solution);
  while(parent.get(cur).mv){ path.unshift(parent.get(cur).mv); cur = key(parent.get(cur).prev); }
  console.log(`  solución óptima: ${path.length} movimientos → reproduciendo contra el motor real…`);
  G._setState(start.map(t=>t.slice()));
  let engineWon = false, desyncAt = -1;
  for(let mi=0; mi<path.length; mi++){
    const [f,t] = path[mi];
    const pre = G._get().tubes;                       // estado ANTES del par de taps
    const expected = pourOn(pre, f, t, CAP);          // lo que las reglas prometen
    G.tapTube(f); G.tapTube(t);                       // taps reales sobre el motor
    const g = G._get();
    if(expected===null || g.sel!==null ||
       g.tubes.map(x=>x.join(",")).join("|") !== expected.map(x=>x.join(",")).join("|")){
      desyncAt = mi; break;
    }
    if(g.won){ engineWon = true; break; }
  }
  ok(desyncAt===-1, `motor y reglas coinciden movimiento a movimiento${desyncAt>=0?" (divergencia en mov #"+(desyncAt+1)+")":""}`);
  ok(engineWon, "VICTORIA alcanzada pulsando tubos con la interfaz real (tap→tap)");
  const g = G._get();
  ok(g.tubes.every(t=>t.length===CAP && t.every(b=>b===t[0])), "estado final: cada tubo lleno con un solo color");
  ok(g.moves === path.length, `movimientos contados = longitud de la solución (${path.length})`);
}

/* ---------- resumen ---------- */
console.log(`\n=== RESULTADO: ${pass} pasadas, ${fail} fallidas ===`);
process.exit(fail ? 1 : 0);
