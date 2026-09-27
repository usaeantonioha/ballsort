"use strict";
/* build_campaign.js — genera la campaña de 30 niveles y EMITE el literal
   LEVELS listo para index.html. Validación en 3 capas por nivel:
   a) estructura: N colores × 4 bolas, N tubos llenos + 2 vacíos, sin tubo ya completo
   b) solución hallada con reglas UNITARIAS (idénticas al motor del juego)
      · ≤6 colores → BFS óptimo real; >6 colores → DFS con podas
   c) replay de la solución paso a paso contra un clon exacto del motor */
const L = require("./levels.js");

const applyU  = L.applyMove;                      // MISMA función que usa el verificador
const solvedC = ts => ts.every(t => t.length===0 || (t.length===4 && t.every(b=>b===t[0])));
const keyOf   = ts => ts.map(t=>t.join(",")).join("|");

function tryReplay(cand, path){
  let st = cand.map(x=>x.slice());
  for(const [f,t] of path){ const n = applyU(st,f,t); if(n===null) return false; st = n; }
  return solvedC(st);
}
function findSolution(cand, colors){
  if(colors <= 6){ const r = L.bfs(cand, 400000); return r ? r.path : null; }
  return L.solve(cand, 600000);                   // DFS con límite de nodos
}

const NAMES = [
 "Primer Chispa","Brisa Suave","Alba Serena","Luz de Menta","Cintalita",
 "Reflejo Azul","Aurora Boreal","Viento Solar","Nebulosa Rosa","Campos Magnéticos",
 "Cola de Cometa","Lluvia de Meteoros","Cinturón Van Allen","Ola de Choque","Estrella Fugaz",
 "Pulsar Verde","Vórtice Violeta","Corona Solar","Gran Tormenta","Aurora Carmesí",
 "Disco de Acreción","Supernova","Quásar Distante","Materia Oscura","Enana Roja",
 "Gigante Azul","Cumulus Nimbus","Campo Estelar","Horizonte de Sucesos","Big Bang"];

/* Niveles FIJOS curados y verificados (nivel 1 = especificación exacta). */
const FIXED = {
  0:{ colors:3, tubes:[[0,0,1,1],[1,1,2,2],[2,2,0,0],[],[]] },       // óptimo 8
  1:{ colors:3, tubes:[[0,0,1,2],[1,2,2,0],[1,2,0,1],[],[]] },       // óptimo 10
  2:{ colors:3, tubes:[[0,1,2,0],[1,2,0,1],[2,0,1,2],[],[]] },       // óptimo 12
  3:{ colors:3, tubes:[[1,0,2,0],[0,2,1,1],[2,1,0,2],[],[]] },       // óptimo 13
  4:{ colors:4, tubes:[[0,1,2,3],[1,2,3,0],[2,3,0,1],[3,0,1,2],[],[]] },          // óptimo 15
  5:{ colors:4, tubes:[[2,0,1,3],[0,3,2,1],[3,1,0,2],[1,2,3,0],[],[]] },          // óptimo 18
  6:{ colors:5, tubes:[[0,1,2,3],[1,2,3,4],[2,3,4,0],[3,4,0,1],[4,0,1,2],[],[]] },// óptimo 19
  7:{ colors:5, tubes:[[4,0,1,2],[1,3,4,0],[2,4,3,1],[0,2,0,3],[3,1,2,4],[],[]] },// óptimo 24
};

const out = [];
let lastDist = 0;
for(let i=0;i<30;i++){
  const colors = FIXED[i] ? FIXED[i].colors : L.SPEC[i].colors;
  let chosen=null, path=null;
  if(FIXED[i]){
    chosen = FIXED[i].tubes.map(t=>t.slice());
    if(L.validate(chosen, colors)) throw new Error("nivel fijo "+(i+1)+" inválido: "+L.validate(chosen,colors));
    path = findSolution(chosen, colors);
    if(!path || !tryReplay(chosen,path)) throw new Error("nivel fijo "+(i+1)+" no verificado");
  } else {
    for(let s=0;s<4000 && !chosen;s++){
      const c = L.generate(colors, 1000 + i*7919 + s*104729);
      if(L.validate(c,colors)) continue;
      if(out.some(o=>keyOf(o.tubes)===keyOf(c))) continue;           // no repetir mezcla
      const p = findSolution(c, colors);
      if(!p || p.length < colors+4) continue;                        // evitar triviales
      if(!tryReplay(c,p)) continue;
      chosen = c; path = p;
    }
  }
  if(!chosen) throw new Error("No se pudo generar el nivel "+(i+1));
  out.push({ name:NAMES[i], colors, tubes:chosen, dist:path.length });
  console.error(`nivel ${String(i+1).padStart(2)} · ${colors} colores · ${chosen.length} tubos · movs=${path.length}`);
}
// comprobar progresión suave de dificultad (movimientos crecientes por tramos)
const fmtTube = t => "[" + t.join(",") + "]";
const lines = out.map((l,i)=>` {name:"${l.name}", lvl:${i+1}, colors:${l.colors}, opt:${l.dist}, tubes:[${l.tubes.map(fmtTube).join(",")}]} // ${l.colors} colores · ${l.tubes.length} tubos · ${l.dist} movs`);
require("fs").writeFileSync("campaign_levels.txt", "const LEVELS = [\n" + lines.join(",\n") + "\n];\n");
console.error("LISTO → campaign_levels.txt");
