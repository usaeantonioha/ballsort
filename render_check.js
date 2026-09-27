"use strict";
/* ============================================================
   render_check.js — verificación ESTRUCTURAL del render (flujo DOM)
   Reglas que se comprueban en cada jugada:
   · Cada tubo contiene EXACTAMENTE un .ball-stack con tantas
     .ball como bolas en el estado → imposible bolas "esparcidas".
   · Ninguna bola vive fuera de su tubo (board solo tiene tubos).
   · Orden DOM = orden físico: primera bola = fondo, última = arriba.
   · Solo la ÚLTIMA bola del tubo seleccionado lleva .lift.
   ============================================================ */
const fs = require("fs");

/* ---------- DOM simulado con registro real de clases ---------- */
function makeEl(tag){
  const el = { tag, children: [], style:{ _p:{}, setProperty(k,v){this._p[k]=v} }, dataset:{},
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

const html = fs.readFileSync(__dirname + "/index.html", "utf8");
eval(html.split("<script>")[1].split("</scr"+"ipt>")[0]);
const M = module.exports, board = ids["board"];

let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log("  PASS:",m)):(fail++,console.log("  FAIL:",m)); };

function findDesc(el, pred, acc=[]) { for(const ch of el.children){ if(pred(ch)) acc.push(ch); findDesc(ch,pred,acc);} return acc; }

function checkBoard(label){
  const tubes = M._get().tubes;
  // 1) El tablero solo contiene tubos (nada suelto → sin bolas sobre header/HUD)
  const loose = board.children.filter(el=>!el.classList.contains("tube"));
  ok(loose.length===0, `${label}: tablero contiene SOLO tubos (${loose.length} elementos sueltos)`);
  // 2) Cada tubo tiene exactamente un ball-stack con N bolas = estado
  let mismatch=null, lifts=0, totalBalls=0;
  board.children.forEach((tube,i)=>{
    const stacks = tube.children.filter(c=>c.classList.contains("ball-stack"));
    if(stacks.length!==1){ mismatch=`tubo ${i}: ${stacks.length} ball-stack`; return; }
    const balls = stacks[0].children.filter(c=>c.classList.contains("ball"));
    totalBalls += balls.length;
    if(balls.length!==tubes[i].length) mismatch=`tubo ${i}: render ${balls.length} ≠ estado ${tubes[i].length}`;
    // 3) orden DOM = orden lógico (colores coinciden posición a posición)
    balls.forEach((b,j)=>{
      if(tubes[i][j]===undefined) return;
      const [c1] = M.PALETTE[tubes[i][j]];
      if(b.style._p["--c1"]!==c1) mismatch=`tubo ${i}: bola DOM ${j} color ≠ estado`;
    });
    // 4) lift solo en la última bola del tubo seleccionado
    balls.forEach((b,j)=>{ if(b.classList.contains("lift")){ lifts++;
      if(!(j===balls.length-1 && i===M._get().sel)) mismatch=`tubo ${i}: .lift en bola no superior/no seleccionada`; } });
  });
  ok(mismatch===null, `${label}: apilamiento DOM correcto${mismatch?` → ${mismatch}`:""}`);
  ok(totalBalls===M.CAP*M.PALETTE.length, `${label}: ${totalBalls}/${M.CAP*M.PALETTE.length} bolas dentro de tubos (ninguna perdida ni esparcida)`);
  ok(lifts<=1, `${label}: máximo una bola levantada (${lifts})`);
}

console.log("== Verificación estructural del render ==");
checkBoard("inicial");
M.tapTube(0); checkBoard("con selección (bola superior levantada)");
M.tapTube(5); checkBoard("tras volcado 0→5");
M.tapTube(0); M.tapTube(1); checkBoard("tras intento inválido 0→1");
M.undo(); checkBoard("tras deshacer");
// jugar la solución completa y validar render final
M._setState(M.LEVEL_TUBES);
const sol=[[0,5],[4,0],[3,4],[2,3],[1,2],[1,5],[0,1],[4,0],[3,4],[2,3],[2,5],[1,2],[0,1],[4,0],[3,4],[3,5]];
for(const [f,t] of sol){ M.tapTube(f); M.tapTube(t); }
checkBoard("estado ganado");
ok(M._get().won===true, "victoria declarada por el motor");
const doneTubes = board.children.filter(el=>el.classList.contains("done")).length;
ok(doneTubes===5, `5 tubos marcados como completos (.done) → ${doneTubes}`);
ok(ids["win"].classList.contains("show"), "modal '¡NIVEL COMPLETADO!' visible");
console.log(`\nRESULTADO RENDER: ${pass} pasadas, ${fail} fallidas`);
process.exit(fail?1:0);
