const L=require('./levels.js');
// nivel 21: colores según SPEC
console.log('SPEC[20] =', JSON.stringify(L.SPEC[20]));
const c=L.SPEC[20].colors;
let solvedCnt=0, tried=0, nulls=0;
for(let s=0;s<40;s++){
  const cand=L.generate(c, 1000+20*7919+s*104729);
  if(L.validate(cand,c)){continue;}
  tried++;
  const p=L.solve(cand,300000);
  if(p===null) nulls++; else { solvedCnt++; if(solvedCnt<=3) console.log('dist',p.length, JSON.stringify(cand)); }
}
console.log({c,tried,solvedCnt,nulls});
