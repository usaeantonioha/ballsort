"use strict";
/* ================= CONFIG — un solo nivel ================= */
const CAP = 4;                       // bolas por tubo
const PALETTE = [                    // degradados radiales por color
  ["#5ee6a8","#0f9d6e"],            // menta
  ["#7ec8ff","#2563eb"],            // celeste
  ["#c99bff","#7c3aed"],            // violeta
  ["#ffa8d5","#e0447f"],            // rosa
  ["#ffd97a","#e09a1f"],            // ámbar
];
/* NIVEL ÚNICO — "Aurora Boreal". Distribución FIJA y verificada:
   cada tubo tiene exactamente CAP(4) bolas (invariante requerido por
   el motor de reglas y la detección de victoria). Resolubilidad
   comprobada por búsqueda DFS con poda desde esta semilla hasta el
   estado ganado (ver test automatizado `test_game.js`).
   Índice de color → PALETTE. Tubos 7 y 8 empiezan vacíos. */
const LEVEL_TUBES = [
  [0,1,2,3],
  [4,0,1,2],
  [3,4,0,1],
  [2,3,4,0],
  [1,2,3,4],
  [0,3,1,4],
  [],             // vacío
  [],             // vacío
];

/* ================= ESTADO ================= */
let tubes, sel, moves, history, startT, timerId, won, soundOn = true;
const $ = id => document.getElementById(id);
const boardEl = $("board");

/* ================= AUDIO procedural (sin assets) ================= */
let AC = null;
function ac(){ if(!AC) AC = new (window.AudioContext||window.webkitAudioContext)(); return AC; }
function tone(f, dur=.12, type="sine", vol=.18, when=0){
  if(!soundOn) return;
  try{
    const c = ac(), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, c.currentTime+when);
    g.gain.linearRampToValueAtTime(vol, c.currentTime+when+.015);
    g.gain.exponentialRampToValueAtTime(.0001, c.currentTime+when+dur);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime+when); o.stop(c.currentTime+when+dur+.05);
  }catch(e){}
}
const sfx = {
  pick:  ()=> tone(620,.09,"triangle",.14),
  drop:  ()=> { tone(340,.1,"sine",.16); tone(510,.08,"sine",.08,.02); },
  block: ()=> tone(150,.16,"sawtooth",.08),
  done:  ()=> { [523,659,784].forEach((f,i)=>tone(f,.2,"triangle",.14,i*.07)); },
  win:   ()=> { [523,659,784,1046,1318].forEach((f,i)=>tone(f,.5,"triangle",.15,i*.12)); },
};

/* ================= LÓGICA ================= */
const topOf = t => { for(let i=t.length-1;i>=0;i--) if(t[i]!==null) return i; return -1; };
function clone(a){ return a.map(x=>x.slice()); }

function canPour(from,to){
  if(to.length >= CAP) return false;
  const ti = topOf(tubes[from]), si = topOf(tubes[to]);
  if(ti === -1) return false;
  if(si === -1) return true;
  return tubes[from][ti] === tubes[to][si];
}
function isSolved(){
  return tubes.every(t => t.length===CAP && t.every(b=>b===t[0]));
}
function pourCount(from,to){
  const ti=topOf(tubes[from]), col=tubes[from][ti];
  let n=0; for(let i=ti;i>=0&&tubes[from][i]===col;i--) n++;
  return Math.min(n, CAP - tubes[to].length);
}

function doMove(from,to){
  history.push({tubes:clone(tubes), moves});
  const col = tubes[from][topOf(tubes[from])];
  for(let k=0;k<pourCount(from,to);k++){
    tubes[from].pop(); tubes[to].push(col);
  }
  moves++;
  sfx.drop();
  render(from, to);
  checkTubeDone(to);
  updateHud();
  if(isSolved()) victory();
}
function undo(){
  if(!history.length || won) return;
  const st = history.pop();
  tubes = st.tubes; moves = st.moves; sel = null;
  sfx.pick();
  render();
  updateHud();
}

function tapTube(idx){
  if(won) return;
  ensureTimer();
  if(sel === null){
    if(topOf(tubes[idx]) === -1){ bump(idx); return; }
    sel = idx; sfx.pick(); render();
    return;
  }
  if(sel === idx){ sel = null; render(); return; }
  if(canPour(sel, idx)){
    const from = sel; sel = null;
    doMove(from, idx);
  }else{
    bump(idx); sfx.block();
    if(topOf(tubes[idx]) !== -1){ sel = idx; sfx.pick(); render(); }
    else { sel = null; render(); }
  }
}
function bump(idx){
  const el = boardEl.children[idx];
  if(el){ el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); }
}

/* ================= RENDER ================= */
function ballHTML(colorIdx, slot, lift){
  const [c1,c2] = PALETTE[colorIdx];
  const inset = (slot*(CAP-0.001))*(100/CAP);
  return `<span class="ball${lift?" lift":""}" data-slot="${slot}"
          style="--c1:${c1};--c2:${c2};bottom:${inset}%"></span>`;
}
function render(liftFrom){
  boardEl.innerHTML = "";
  tubes.forEach((t,i)=>{
    const d = document.createElement("div");
    d.className = "tube" + (sel===i?" sel":"") +
      (t.length===CAP && t.every(b=>b===t[0]) ? " done":"");
    d.setAttribute("role","button");
    d.setAttribute("aria-label", `Tubo ${i+1}`);
    const lifted = (sel===i) ? topOf(t) : (liftFrom===i ? -2 : -1);
    t.forEach((b,slot)=>{ if(b!==null) d.insertAdjacentHTML("beforeend", ballHTML(b,slot,slot===lifted)); });
    d.addEventListener("click", ()=>tapTube(i));
    boardEl.appendChild(d);
  });
  $("undo").disabled = !history.length || won;
}
function checkTubeDone(idx){
  const t = tubes[idx];
  if(t.length===CAP && t.every(b=>b===t[0])){
    sfx.done();
    burst(boardEl.children[idx]);
  }
}
function burst(el){
  if(!el) return;
  const colors = ["#5ee6a8","#7ec8ff","#c99bff","#ffa8d5","#ffd97a"];
  for(let i=0;i<14;i++){
    const s = document.createElement("span");
    s.className = "spark";
    s.style.background = colors[Math.floor(Math.random()*colors.length)];
    s.style.setProperty("--dx",(Math.random()*140-70)+"px");
    s.style.setProperty("--dy",(-Math.random()*130-10)+"px");
    s.style.animationDelay = (Math.random()*.15)+"s";
    el.appendChild(s);
    setTimeout(()=>s.remove(), 1100);
  }
}

/* ================= HUD / TIEMPO ================= */
function fmt(ms){ const s=Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`; }
function ensureTimer(){
  if(timerId || won || startT) return;
  startT = Date.now();
  timerId = setInterval(()=>{ $("time").textContent = fmt(Date.now()-startT); }, 500);
}
function updateHud(){
  $("moves").textContent = moves;
  const best = localStorage.getItem("aurora_best");
  $("best").textContent = best ? best : "—";
}

/* ================= VICTORIA ================= */
function victory(){
  won = true; clearInterval(timerId);
  const secs = startT ? Math.floor((Date.now()-startT)/1000) : 0;
  const best = parseInt(localStorage.getItem("aurora_best")||"9999",10);
  if(moves < best) localStorage.setItem("aurora_best", moves);
  updateHud();
  $("wintext").innerHTML =
    `Completaste <b>Aurora Boreal</b> en <b>${moves}</b> movimientos<br>y <b>${fmt(secs*1000)}</b>. El cielo vuelve a brillar.`;
  setTimeout(()=>{ $("win").classList.add("show"); sfx.win(); starRain(); }, 500);
}
function starRain(){
  const colors = ["#5ee6a8","#7ec8ff","#c99bff","#ffa8d5","#ffd97a","#fff"];
  for(let i=0;i<40;i++){
    const s = document.createElement("span");
    s.className = "spark";
    s.style.position = "fixed";
    s.style.left = Math.random()*100+"vw";
    s.style.top = "-10px";
    s.width = s.height = (3+Math.random()*5)+"px";
    s.style.background = colors[i%colors.length];
    s.style.zIndex = 60;
    s.style.setProperty("--dx",(Math.random()*60-30)+"px");
    s.style.setProperty("--dy","110vh");
    s.style.animationDuration = (1.4+Math.random()*1.6)+"s";
    s.style.animationDelay = (Math.random()*.9)+"s";
    document.body.appendChild(s);
    setTimeout(()=>s.remove(), 3500);
  }
}

/* ================= INIT ================= */
function newGame(){
  tubes = clone(LEVEL_TUBES);
  sel = null; moves = 0; history = []; won = false;
  startT = 0; clearInterval(timerId);
  $("time").textContent = "0:00";
  $("win").classList.remove("show");
  render(); updateHud();
}
$("undo").addEventListener("click", undo);
$("reset").addEventListener("click", newGame);
$("again").addEventListener("click", newGame);
$("sound").addEventListener("click", e=>{
  soundOn = !soundOn;
  const b = e.currentTarget;
  b.style.opacity = soundOn ? 1 : .55;
  b.lastChild.textContent = soundOn ? "Sonido" : "Silencio";
  if(soundOn) sfx.pick();
});
document.addEventListener("pointerdown", ()=>{ if(AC && AC.state==="suspended") AC.resume(); }, {once:false});
newGame();
