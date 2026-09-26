"use strict";
/* Verificación del RENDER: tras cada movimiento, las bolas deben estar
   ancladas de abajo hacia arriba dentro de su tubo (bottom = 2 + slot*25 %),
   sin posiciones "esparcidas", y la bola levantada debe conservar su ranura. */
function makeEl(tag){const el={tag,children:[],style:{setProperty(){}},dataset:{},
  classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},contains(c){return this._s.has(c)}},
  get className(){return [...this.classList._s].join(" ")},
  set className(v){this.classList._s=new Set(String(v).split(/\s+/).filter(Boolean))},
  setAttribute(){},addEventListener(ev,fn){this._on=this._on||{};this._on[ev]=fn},
  insertAdjacentHTML(pos,html){
    const m=[...html.matchAll(/class="ball([^"]*)"[^>]*data-slot="(\d+)"[^>]*bottom:([\d.\-]+)%/g)];
    for(const g of m)this.children.push({className:"ball"+g[1],slot:+g[2],bottom:parseFloat(g[3])});
  },
  appendChild(ch){ if(ch && ch.className==="ball-stack") this.children.push(...ch.children); else this.children.push(ch);},remove(){},textContent:"",disabled:false,lastChild:{},offsetWidth:0};
  Object.defineProperty(el,"innerHTML",{get(){return el._h||""},set(v){el._h=v;el.children=[]}});return el;}
const ids={};
global.document={getElementById:id=>ids[id]||(ids[id]=makeEl("div")),createElement:t=>makeEl(t),addEventListener(){},body:makeEl("body")};
global.window={addEventListener(){},AudioContext:null,webkitAudioContext:null};
global.localStorage={_d:{},getItem(k){return this._d[k]??null},setItem(k,v){this._d[k]=String(v)}};
global.setInterval=()=>0;global.clearInterval=()=>{};global.setTimeout=(fn)=>{try{fn()}catch(e){}return 0};
global.module={exports:{}};
const fs=require("fs");
const js=fs.readFileSync(__dirname+"/index.html","utf8").split("<script>")[1].split("</scr"+"ipt>")[0];
eval(js);
const M=module.exports, CAP=M.CAP, board=ids["board"];
/* tras el wrapper .ball-stack: aplanar hijos del tubo hasta las bolas */
function ballsOf(tubeEl){
  const out=[];
  const walk=n=>{ for(const ch of n.children||[]) (ch.className||"").startsWith("ball")?out.push(ch):walk(ch); };
  walk(tubeEl); return out;
}

let pass=0,fail=0;
const ok=(c,m)=>{c?(pass++,console.log("  PASS:",m)):(fail++,console.log("  FAIL:",m))};

function checkBoard(label){
  const tubes=M._get().tubes;
  let bad=null, totalBalls=0;
  board.children.forEach((tubeEl,i)=>{
    const balls=ballsOf(tubeEl);
    if(balls.length!==tubes[i].length) bad=`tubo ${i}: render ${balls.length} bolas, estado ${tubes[i].length}`;
    balls.forEach((b,j)=>{
      const expected=j*(100/CAP);                  // apilamiento compacto: ranura exacta
      if(Math.abs(b.bottom-expected)>0.001) bad=`tubo ${i} bola ${j}: bottom=${b.bottom}% esperado ${expected}%`;
      if(b.slot!==j) bad=`tubo ${i}: data-slot desordenado`;
    });
    const lifts=balls.filter(b=>b.className.includes("lift"));
    if(lifts.length>1) bad=`tubo ${i}: más de una bola levantada`;
    totalBalls+=balls.length;
  });
  ok(totalBalls===CAP*M.PALETTE.length, `${label}: ${totalBalls} bolas en pantalla (sin bolas perdidas/esparcidas)`);
  ok(bad===null, `${label}: todas las bolas ancladas a su ranura`+(bad?` → ${bad}`:""));
}

console.log("== Render estructural ==");
M._setState(M.LEVEL_TUBES);            // newGame-like render via _setState? _setState doesn't render; call tap to force render
checkBoard("inicial (post-render de newGame)");
// select tube 0 → lifted ball must keep its bottom anchor
M.tapTube(0);
checkBoard("con bola levantada (sel=0)");
// perform valid pour 0→4
M.tapTube(4);
checkBoard("tras volcado 0→4");
// invalid pour attempt 0→1 (tops 3 vs 0): bump path re-selects 1
M.tapTube(0); M.tapTube(1);
checkBoard("tras intento inválido 0→1");
// undo
M.undo();
checkBoard("tras undo");
// play through the known solution and verify final state renders full uniform tubes
M._setState(M.LEVEL_TUBES);
/* solución calculada por BFS sobre las reglas EXACTAS del motor */
function pourOn(ts,f,t){
  if(f===t)return null; const src=ts[f],dst=ts[t];
  if(dst.length>=CAP||src.length===0)return null;
  const col=src[src.length-1];
  if(dst.length&&dst[dst.length-1]!==col)return null;
  let run=0;for(let i=src.length-1;i>=0&&src[i]===col;i--)run++;
  const k=Math.min(run,CAP-dst.length);if(k<=0)return null;
  const r=ts.map(x=>x.slice());r[f]=src.slice(0,src.length-k);r[t]=dst.concat(Array(k).fill(col));return r;
}
const solvedC=ts=>ts.every(t=>t.length===0||(t.length===CAP&&t.every(b=>b===t[0])));
function bfs(init){
  const key=s=>s.map(t=>t.join(",")).join("|");
  const seen=new Set([key(init)]);let q=[{s:init,p:[]}];
  while(q.length){const nx=[];
    for(const n of q)for(let f=0;f<n.s.length;f++)for(let t=0;t<n.s.length;t++){
      const ns=pourOn(n.s,f,t);if(!ns)continue;const k=key(ns);if(seen.has(k))continue;seen.add(k);
      const p=n.p.concat([[f,t]]);if(solvedC(ns))return p;nx.push({s:ns,p});
    }
    q=nx;}
  return null;
}
const sol=bfs(M.LEVEL_TUBES.map(t=>t.slice()));
ok(sol!==null, `nivel resuelto por BFS (${sol?sol.length:"?"} volcados)`);
for(const [f,t] of (sol||[])){ M.tapTube(f); M.tapTube(t); }
checkBoard("estado ganado");
ok(M._get().won===true, "victoria declarada");
const doneTubes=board.children.filter(el=>el.classList.contains("done")).length;
ok(doneTubes===M.PALETTE.length, `${M.PALETTE.length} tubos marcados como completos (done) → ${doneTubes}`);
console.log(`\nRESULTADO RENDER: ${pass} pasadas, ${fail} fallidas`);
process.exit(fail?1:0);
