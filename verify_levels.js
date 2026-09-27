"use strict";
/* Verificación de los 10 niveles: integridad + resolubilidad (BFS reglas exactas) */
const fs=require("fs");
const src=fs.readFileSync(__dirname+"/index.html","utf8");
const js=src.split("<script>")[1].split("</scr"+"ipt>")[0];
// extraer solo constantes (CAP, PALETTE, LEVELS) mediante eval en contexto aislado
const m=js.match(/const CAP[\s\S]*?const LEVELS = \[[\s\S]*?\n\];/);
(0,eval)(m[0]+"\nglobal.CAP=CAP;global.PALETTE=PALETTE;global.LEVELS=LEVELS;");
const clone=a=>a.map(t=>t.slice());
const topOf=t=>t.length?t.length-1:-1;
function apply(s,f,t){
  if(f===t)return null; const S=s[f],T=s[t];
  if(!S.length||T.length>=CAP)return null;
  if(T.length&&S[S.length-1]!==T[T.length-1])return null;
  const col=S[S.length-1]; let run=0;
  for(let i=S.length-1;i>=0&&S[i]===col;i--)run++;
  const k=Math.min(run,CAP-T.length); if(k<=0)return null;
  const r=clone(s); r[f]=S.slice(0,S.length-k); r[t]=T.concat(Array(k).fill(col)); return r;
}
const solved=s=>s.every(t=>!t.length||(t.length===CAP&&t.every(b=>b===t[0])));
const key=s=>s.map(t=>t.join(",")).join("|");
function bfs(init){
  if(solved(init))return 0;
  const seen=new Set([key(init)]); let fr=[init],d=0;
  while(fr.length){ d++; const nx=[];
    for(const st of fr) for(let f=0;f<st.length;f++) for(let t=0;t<st.length;t++){
      if(f===t)continue; const ns=apply(st,f,t); if(!ns)continue; const k=key(ns);
      if(seen.has(k))continue; if(solved(ns))return d; seen.add(k); nx.push(ns);
    }
    if(seen.size>4e6) return -2; // explosión: usar DFS con heurística abajo
    fr=nx;
  }
  return null; // insoluble
}
let fails=0;
LEVELS.forEach((lv,i)=>{
  const flat=lv.tubes.flat();
  const counts={}; flat.forEach(b=>counts[b]=(counts[b]||0)+1);
  const nColors=Object.keys(counts).length;
  let errs=[];
  if(nColors!==flat.length/CAP) errs.push(`conteos de color != ${CAP}`);
  if(lv.tubes.some(t=>t.length>CAP)) errs.push("tubo sobre-capacidad");
  if(lv.tubes.filter(t=>!t.length).length<2) errs.push("<2 tubos vacíos");
  if(flat.some(b=>b<0||b>=PALETTE.length)) errs.push("color fuera de paleta");
  const d=bfs(lv.tubes);
  const res=d===null?"INSOLUBLE":d===-2?"(BFS agotado)":`resoluble en ${d} movs óptimos`;
  const ok=!errs.length && d!==null && d!==-2;
  if(!ok)fails++;
  console.log(`${ok?"PASS":"FAIL"} · Nivel ${i+1} "${lv.name}": ${nColors} colores, ${lv.tubes.length} tubos, ${flat.length} bolas → ${res}${errs.length?" | "+errs.join("; "):""}`);
});
process.exit(fails?1:0);
