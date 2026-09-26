"use strict";
/* Automated tap-by-tap replay of index.html game logic under a DOM stub. */

// ---------- minimal DOM stub ----------
function makeEl(tag) {
  return {
    tag, children: [], style: { setProperty(){} }, dataset: {},
    classList: { _s:new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, contains(c){return this._s.has(c);} },
    setAttribute(){}, addEventListener(ev, fn){ this._on = this._on||{}; this._on[ev]=fn; },
    insertAdjacentHTML(pos, html){
      // parse balls minimally: count spans with class ball and capture bottom% & lift
      const m = [...html.matchAll(/class="ball([^"]*)"[^>]*bottom:([\d.]+)%/g)];
      for (const g of m) this.children.push({ className:"ball"+g[1], bottom: parseFloat(g[2]), isSpark:false });
    },
    appendChild(ch){ this.children.push(ch); },
    remove(){}, textContent:"", innerHTML:"", disabled:false, lastChild:{}, offsetWidth:0
  };
}
const ids = {};
["board","moves","best","time","undo","reset","sound","win","wintext","again","lvl-name"].forEach(i=>ids[i]=makeEl("div"));
global.document = {
  getElementById: id => ids[id] || (ids[id]=makeEl("div")),
  createElement: t => makeEl(t),
  addEventListener(){},
  body: makeEl("body"),
};
global.window = { addEventListener(){}, AudioContext:null, webkitAudioContext:null };
global.localStorage = { _d:{}, getItem(k){return this._d[k]??null;}, setItem(k,v){this._d[k]=String(v);} };
global.setInterval = () => 0;
global.clearInterval = () => {};
global.setTimeout = (fn) => { try{ fn(); }catch(e){} return 0; };
global.module = { exports: {} };

// ---------- load game script from index.html ----------
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/index.html", "utf8");
const js = src.split("<script>")[1].split("</scr" + "ipt>")[0];
eval(js);
const M = module.exports;

let pass = 0, fail = 0;
function ok(cond, msg){ if(cond){pass++; console.log("  PASS:", msg);} else {fail++; console.log("  FAIL:", msg);} }

// ---------- BFS solver replicating the engine's EXACT rules ----------
const CAP = M.CAP;
const clone = a => a.map(x => x.slice());
const topOf = t => { for(let i=t.length-1;i>=0;i--) if(t[i]!==null) return i; return -1; };
function pourCountC(nt,f,t){ const ti=topOf(nt[f]); if(ti<0)return 0; const col=nt[f][ti]; let n=0; for(let i=ti;i>=0&&nt[f][i]===col;i--)n++; return Math.min(n, CAP-nt[t].length); }
function applyMove(s,f,t){ if(f===t)return null; if(s[t].length>=CAP)return null; const ti=topOf(s[f]); if(ti<0)return null; const si=topOf(s[t]); if(si>=0 && s[f][ti]!==s[t][si])return null;
  const nt=clone(s); const k=pourCountC(nt,f,t); if(k<=0)return null; const col=nt[f][topOf(nt[f])]; for(let i=0;i<k;i++){nt[f].pop();nt[t].push(col);} 
  // invariant: no trailing nulls
  for(const tu of nt){ while(tu.length && tu[tu.length-1]===null) tu.pop(); }
  return nt; }
const stateKey = s => s.map(t=>t.join(",")).join("|");
function solvedC(tu){ return tu.every(t => t.length===0 || (t.length===CAP && t.every(b=>b===t[0]))); }
function solve(init){
  const seen=new Set([stateKey(init)]); let frontier=[{s:init,path:[]}];
  while(frontier.length){ const next=[];
    for(const node of frontier){
      for(let f=0;f<node.s.length;f++)for(let t=0;t<node.s.length;t++){
        const ns=applyMove(node.s,f,t); if(!ns)continue; const k=stateKey(ns); if(seen.has(k))continue; seen.add(k);
        const path=node.path.concat([[f,t]]); if(solvedC(ns))return path; next.push({s:ns,path});
      }
    }
    frontier=next;
  }
  return null;
}

console.log("== 1. Level integrity ==");
const L = M.LEVEL_TUBES;
const counts = {};
L.forEach(t=>t.forEach(b=>counts[b]=(counts[b]||0)+1));
ok(Object.keys(counts).length === M.PALETTE.length, `usa los ${M.PALETTE.length} colores de la paleta`);
ok(Object.values(counts).every(c=>c===CAP), `cada color tiene exactamente ${CAP} bolas: ${JSON.stringify(counts)}`);
ok(L.every(t=>t.length<=CAP), "ningún tubo excede la capacidad");
ok(L.filter(t=>t.length===0).length >= 2, "hay al menos 2 tubos vacíos");
ok(L.every(t=>t.length===0 || t.every(b=>typeof b==="number" && b>=0 && b<M.PALETTE.length)), "todos los índices de color válidos");

console.log("== 2. Solvability (BFS bajo reglas exactas del motor) ==");
const sol = solve(clone(L));
ok(sol !== null, sol ? `nivel RESOLUBLE en ${sol.length} movimientos: ${sol.map(m=>m.join("→")).join(", ")}` : "nivel INSOLUBLE");

console.log("== 3. Tap-by-tap replay usando la función tapTube REAL ==");
M._setState(L);
let st = M._get();
ok(st.tubes.map(t=>t.length).join(",") === L.map(t=>t.length).join(","), "estado inicial restaurado");

// helper: perform a real tap pair through the shipped tapTube()
function tapPair(f,t){
  M.tapTube(f);            // select source
  const mid = M._get();
  if(mid.sel !== f) return false;
  M.tapTube(t);            // pour into target
  return true;
}
let movesDone = 0, badStep = null;
for (const [f,t] of (sol||[])) {
  const before = stateKey(M._get().tubes);
  const expected = stateKey(applyMove(M._get().tubes, f, t));
  if (!tapPair(f,t)) { badStep = `tap ${f}→${t} rechazado por el motor`; break; }
  const after = stateKey(M._get().tubes);
  if (after !== expected) { badStep = `discrepancia tras ${f}→${t}: motor=${after} esperado=${expected}`; break; }
  // invariants after every move
  const tubes = M._get().tubes;
  for (const tu of tubes) {
    if (tu.length > CAP) { badStep = "tubo desbordado"; break; }
    if (tu.includes(null)) { badStep = "agujero null dentro de un tubo"; break; }
  }
  const tot = tubes.reduce((a,t)=>a+t.length,0);
  if (tot !== CAP*M.PALETTE.length) { badStep = `conservación rota: ${tot} bolas`; break; }
  movesDone++;
}
ok(badStep === null, badStep ?? `replay completo sin errores (${movesDone}/${(sol||[]).length} volcados)`);
ok(M._get().won === true, "el juego declaró VICTORIA tras el último movimiento");
ok(M._get().moves === (sol||[]).length, `contador de movimientos = ${(sol||[]).length}`);

console.log("== 4. Reglas de bloqueo y selección ==");
M._setState(L);
// tap empty tube → nothing selected
M.tapTube(L.findIndex(t=>t.length===0));
ok(M._get().sel === null, "tocar tubo vacío no selecciona nada");
// select tube 0 then tap it again → deselect
M.tapTube(0); ok(M._get().sel === 0, "tocar tubo con bolas lo selecciona");
M.tapTube(0); ok(M._get().sel === null, "tocarlo de nuevo lo deselecciona");
// invalid pour: tube0 top=3, tube1 top=0 → cannot pour; tapping tube1 should switch selection to tube1
M.tapTube(0); M.tapTube(1);
const g = M._get();
ok(g.sel === 1 && stateKey(g.tubes) === stateKey(L), "volcado inválido no mueve bolas y re-selecciona el tubo tocado");
// valid partial pour semantics: pourCount caps at run length and free space
M._setState([[0,0,1,1],[0,0,1,1],[],[]]);
M.tapTube(0); M.tapTube(2);
ok(stateKey(M._get().tubes) === "0,0|0,0,1,1|1,1|", "run de 2 bolas idénticas se vierte completo en tubo vacío");
M._setState([[1,0],[0,0],[]]); // top of 0 is 0, run length 1
M.tapTube(0); M.tapTube(2);
ok(stateKey(M._get().tubes) === "1|0,0|0", "solo se vierte la racha superior (1 bola), no toda la pila");

console.log("== 5. Undo ==");
M._setState(L);
M.tapTube(0); M.tapTube(4); // first solution move
const after1 = stateKey(M._get().tubes);
M.undo();
ok(stateKey(M._get().tubes) === stateKey(L) && M._get().moves === 0, "undo restaura estado y contador");

console.log("");
console.log(`RESULTADO: ${pass} pasadas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
