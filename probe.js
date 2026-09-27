const L=require('./levels.js');
for(const c of [2,3]){
  const st=L.CURATED[c];
  const r=L.bfs(st);
  console.log('curated',c,'->',r?('dist '+r.dist):'INSOLUBLE');
}
for(const c of [4,5,6,7,8,9,10]){
  let found=null;
  for(let s=0;s<300 && !found;s++){
    const cand=L.generate(c, 500+c*97+s*13);
    if(L.validate(cand,c)) continue;
    const r=L.bfs(cand, 250000);
    if(r && r.dist>=c+4) found={t:cand,d:r.dist};
  }
  console.log('colors',c,'->',found?('OK dist '+found.d):'SIN CANDIDATO');
}
