"use strict";
/* ============================================================
   test_game.js — verificación automatizada de AURORA (index.html)
   1) Ejecuta el <script> real del juego con un DOM simulado.
   2) Comprueba invariantes del nivel (bolas, colores, capacidad).
   3) BFS con las reglas EXACTAS → replay tap-a-tap contra el motor.
   4) Reglas de bloqueo/selección, undo, contadores y victoria.
   ============================================================ */
const fs = require("fs");

/* ---------- DOM simulado mínimo ---------- */
function makeEl(tag){
  const el = { tag, children: [], style:{ setProperty(){} }, dataset:{},
    classList:{ _s:new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)}, contains(c){return this._s.has(c)} },
    get className(){ return [...this.classList._s].join(" "); },
    set className(v){ this.classList._s = new Set(String(v).split(/\s+/).filter(Boolean)); },
    setAttribute(){}, addEventListener(ev,fn){ this._on=this._on||{}; this._on[ev]=fn; },
    insertAdjacentHTML(){}, appendChild(ch){ this.children.push(ch); }, remove(){},
    textContent:"", disabled:false, lastChild:{}, offsetWidth:0 };
  Object.defineProperty(el,"innerHTML",{ get(){return el._h||""}, set(v){ el._h=v; if(v==="") el.children=[]; } });
  return el;
}
const ids = {};
global.document = { getElementById:id=>ids[id]||(ids[id]=makeEl("div")),
  createElement:t=>makeEl(t), addEventListener(){}, body:makeEl("body") };
global.window = { addEventListener(){}, AudioContext:null, webkitAudioContext:null };
global.localStorage = { _d:{}, getItem(k){return this._d[k]??null}, setItem(k,v){this._d[k]=String(v)} };
global.setInterval = ()=>0; global.clearInterval = ()=>{};
global.setTimeout = (fn)=>{ try{ fn(); }catch(e){} return 0; };
global.module = { exports:{} };

/* ---------- cargar el script REAL del juego ---------- */
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const js = html.split("<script>")[1].split("</scr"+"ipt>")[0];
eval(js);
const M = module.exports;
const CAP = M.CAP, L = M.LEVEL_TUBES;

let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log("  PASS:",m)):(fail++,console.log("  FAIL:",m)); };
const key = s => s.map(t=>t.join(",")).join("|");

/* ---------- BFS replicando las reglas exactas del motor ---------- */
function applyMove(s,f,t){
  if(f===t) return null;
  const src=s[f], dst=s[t];
  if(!src.length || dst.length>=CAP) return null;
  const c=src[src.length-1];
  if(dst.length && dst[dst.length-1]!==c) return null;
  let run=0; for(let i=src.length-1;i>=0&&src[i]===c;i--) run++;
  const k=Math.min(run,CAP-dst.length); if(k<=0) return null;
  const r=s.map(x=>x.slice());
  r[f]=src.slice(0,src.length-k); r[t]=dst.concat(Array(k).fill(c));
  return r;
}
const solvedC = s => s.every(t=>!t.length || (t.length===CAP && t.every(b=>b===t[0])));
function solve(init){
  const seen=new Set([key(init)]); let q=[{s:init,p:[]}];
  while(q.length){ const nx=[];
    for(const n of q) for(let f=0;f<n.s.length;f++) for(let t=0;t<n.s.length;t++){
      const ns=applyMove(n.s,f,t); if(!ns) continue; const k=key(ns); if(seen.has(k)) continue;
      seen.add(k); const p=n.p.concat([[f,t]]);
      if(solvedC(ns)) return p; nx.push({s:ns,p});
    }
    q=nx;
  }
  return null;
}

console.log("== 1. Invariantes del nivel único ==");
ok(L.length===7, "el nivel tiene exactamente 7 tubos");
const counts={}; L.forEach(t=>t.forEach(b=>counts[b]=(counts[b]||0)+1));
ok(Object.keys(counts).length===M.PALETTE.length, `usa los ${M.PALETTE.length} colores de la paleta`);
ok(Object.values(counts).every(c=>c===CAP), `cada color aparece exactamente ${CAP} veces: ${JSON.stringify(counts)}`);
ok(L.every(t=>t.length<=CAP), "ningún tubo excede la capacidad máxima de 4 bolas");
ok(L.filter(t=>!t.length).length===2, "hay exactamente 2 tubos vacíos");

console.log("== 2. Resolubilidad (BFS con reglas exactas) ==");
const sol = solve(L.map(t=>t.slice()));
ok(!!sol, sol ? `nivel RESOLUBLE en ${sol.length} movimientos óptimos` : "nivel INSOLUBLE");

console.log("== 3. Replay tap-a-tap contra el motor REAL ==");
M._setState(L);
let bad=null, done=0;
for(const [f,t] of (sol||[])){
  const before=M._get().tubes;
  const expected=applyMove(before,f,t);
  M.tapTube(f);
  if(M._get().sel!==f){ bad=`tap ${f} no seleccionó`; break; }
  M.tapTube(t);
  const after=M._get();
  if(key(after.tubes)!==key(expected)){ bad=`desfase tras ${f}→${t}`; break; }
  if(after.tubes.some(x=>x.length>CAP)){ bad="tubo desbordado"; break; }
  const tot=after.tubes.reduce((a,x)=>a+x.length,0);
  if(tot!==CAP*M.PALETTE.length){ bad=`conservación rota: ${tot} bolas`; break; }
  done++;
}
ok(!bad, bad ?? `replay completo sin errores (${done}/${(sol||[]).length} volcados)`);
ok(M._get().won===true, "VICTORIA declarada al terminar el replay");
ok(M._get().moves===(sol||[]).length, `MOVIMIENTOS = ${(sol||[]).length} (uno por volcado válido)`);

console.log("== 4. Reglas de selección y bloqueo ==");
M._setState(L);
M.tapTube(5); ok(M._get().sel===null, "tap en tubo vacío no selecciona nada");
M.tapTube(0); ok(M._get().sel===0, "tap en tubo con bolas selecciona la superior");
M.tapTube(0); ok(M._get().sel===null, "segundo tap en el mismo tubo deselecciona");
// inválido: top(0)=3 vs top(1)=4 → no vierte, re-selecciona destino
M.tapTube(0); M.tapTube(1);
ok(M._get().sel===1 && key(M._get().tubes)===key(L), "volcado inválido no mueve bolas y re-selecciona");
// destino lleno: llenar tubo 5 con 4 mentas y bloquear vertido a él
M._setState([[0],[0,0,0,0],[0],[],[],[],[]]);
M.tapTube(2); M.tapTube(1);
ok(M._get().sel===1 && M._get().moves===0, "no se puede verter en un tubo lleno (4 esferas)");
// semántica de racha: solo se vierte la racha superior
M._setState([[1,0,0,0],[2,0],[],[]]);
M.tapTube(0); M.tapTube(2);
ok(key(M._get().tubes)==="1|2,0|0,0,0|", "se vierte la racha superior completa (3 ceros), no toda la pila");

console.log("== 5. Deshacer / Reiniciar ==");
M._setState(L);
M.tapTube(0); M.tapTube(5);            // movimiento válido 0→5
ok(M._get().moves===1, "MOVIMIENTOS incrementa SOLO con movimiento válido");
M.undo();
ok(key(M._get().tubes)===key(L) && M._get().moves===0, "Deshacer revierte estado y contador (pila)");
M.undo(); ok(M._get().moves===0, "Deshacer con historial vacío es inofensivo");

console.log(`\nRESULTADO: ${pass} pasadas, ${fail} fallidas`);
process.exit(fail?1:0);
