const L=require('./levels.js');
// test del solve con un estado 8-colores generado por paseo desde resuelto (siempre soluble)
// usar el generate viejo no existe; simulemos: tomar nivel curado y resolverlo
console.log('curated2 dist:', L.solve(L.CURATED[2],300000)?.length);
// crear un 8-colores trivialmente soluble: cada tubo [c,c,otroX] ... mejor: barajado y DFS sin memo-check manual
const cand=L.generate(8,500);
console.log(JSON.stringify(cand));
console.log('validate:',L.validate(cand,8));
// DFS iterativo profundo sin nodeCap para ver si realmente es insoluble o el cap lo mata
const p=L.solve(cand,50000000);
console.log('solve bigcap ->', p?p.length:null);
