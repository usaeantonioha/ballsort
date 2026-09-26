"use strict";
/* Depurador de replay: BFS óptimo + reproducción contra el motor real */
const fs = require("fs"), vm = require("vm");
function makeEl(id){ return {id,children:[],style:{},dataset:{},_text:"",_html:"",
 classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(){},contains(){return false}},
 set innerHTML(v){this._html=v; if(v==="")this.children=[];}, get innerHTML(){return this._html;},
 set textContent(v){this._text=v;}, get textContent(){return this._text;},
 lastChild:{textContent:""}, appendChild(ch){this.children.push(ch);return ch;},
 insertAdjacentHTML(){},setAttribute(){},getAttribute(){return null},addEventListener(){},removeEventListener(){},
 get offsetWidth(){return 0;} }; }
const els={}; ["board","moves","best","time","undo","reset","sound","win","wintext","again","lvl-name"].forEach(i=>els[i]=makeEl(i));
const sandbox={ console, setTimeout:(f,t)=>undefined, clearTimeout, setInterval:()=>0, clearInterval,
 document:{getElementById:i=>els[i]||makeEl(i),createElement:()=>makeEl(""),addEventListener(){},body:makeEl("body")},
 window:{}, localStorage:{_d:{},getItem(k){return this._d[k]??null},setItem(k,v){this._d[k]=String(v)}},
 module:{exports:null} };
vm.createContext(sandbox);
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const m=html.match(/<script>([\s\S]*?)<\/script>/);
const f=vm.runInContext("(function(module){"+m[1]+"\n})",sandbox); f(sandbox.module);
const G=sandbox.module.exports, CAP=G.CAP;

function key(ts){return ts.map(t=>t.join(".")).join("|");}
function pourOn(ts,a,b){
  const F=ts[a], T=ts[b];
  if(F.length===0 || T.length>=CAP) return null;
  const c=F[F.length-1];
  if(T.length>0 && T[T.length-1]!==c) return null;
  let n=0; for(let i=F.length-1;i>=0&&F[i]===c;i--) n++;
  n=Math.min(n, CAP-T.length);
  if(n<=0) return null;
  const r=ts.map(x=>x.slice()); r[a]=F.slice(0,F.length-n); r[b]=T.concat(Array(n).fill(c));
  return r;
}
const solved=ts=>ts.every(t=>t.length===0 || (t.length===CAP && t.every(b=>b===t[0])));
const start=G.LEVEL_TUBES.map(t=>t.slice());
const parent=new Map([[key(start),{prev:null,mv:null}]]);
const q=[start]; let sol=null;
while(q.length>0 && sol===null){
  const st=q.shift();
  if(st!==start && solved(st)){ sol=st; break; }
  for(let a=0;a<st.length && sol===null;a++)
    for(let b=0;b<st.length && sol===null;b++){
      if(a===b) continue;
      const ns=pourOn(st,a,b); if(ns===null) continue;
      const k=key(ns); if(parent.has(k)) continue;
      parent.set(k,{prev:st,mv:[a,b]}); q.push(ns);
    }
}
if(sol===null){ console.log("SIN SOLUCIÓN"); process.exit(1); }
const path=[]; let cur=key(sol);
while(parent.get(cur).mv){ path.unshift(parent.get(cur).mv); cur=key(parent.get(cur).prev); }
console.log("ruta BFS:", JSON.stringify(path), "("+path.length+" movs)");

G._setState(start.map(t=>t.slice()));
for(const [a,b] of path){
  const before=JSON.stringify(G._get().tubes);
  G.tapTube(a); G.tapTube(b);
  const g=G._get();
  console.log("tap",a,"->",b,"| después",JSON.stringify(g.tubes),"| moves",g.moves,"sel",g.sel,"won",g.won);
  if(g.won) break;
}
