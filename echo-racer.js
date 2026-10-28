/* Echo Racer — ZebraOS. Straight-ahead phosphor tunnel, rendered entirely
 * in Canvas 2D. Gameplay and soundtrack are independent of other ZebraOS apps.
 * No WebGL, no external rendering library, no duplicate audio source nodes. */
(function(){
"use strict";
let W=620,H=640;
const PI=Math.PI,TAU=PI*2,MAX_LIVES=3;
const PATH="zebra.echo-racer.";
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
const lerp=(a,b,t)=>a+(b-a)*t;
function node(tag,cls,txt){
 const n=document.createElement(tag);if(cls)n.className=cls;
 if(txt!==undefined)n.textContent=txt;return n;
}
function save(key,val){try{localStorage.setItem(PATH+key,String(val));}catch(_){}}
function load(key,fallback){try{const v=localStorage.getItem(PATH+key);return v===null?fallback:v;}catch(_){return fallback;}}
function rectRound(ctx,x,y,w,h,r){
 r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);
 ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
 ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
 ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
 ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}
/* Player travels along the INNER CIRCUMFERENCE of a perfectly straight tube.
 * The camera is the player: position is one world-space ANGLE, not an XY ship. */
const SECTORS=16,STEP=TAU/SECTORS,HIT_Z=1.6,SPAWN_Z=6.3;
function angularDelta(a,b){return ((a-b+PI)%TAU+TAU)%TAU-PI;}
function pattern(kind){
 const cells=[];
 for(let i=0;i<SECTORS;i++){
  let block=false;
  if(kind===0)block=i<10;                               // wide single gap
  if(kind===1)block=i<5||i>11;                            // clear seven-lane gate
  if(kind===2)block=(i>=1&&i<=6)||(i>=10&&i<=13);        // split forks
  if(kind===3)block=(i<=4)||(i>=8&&i<=11);               // offset passages
  if(kind===4)block=i%4===0||i%4===1;                    // alternating bands
  if(kind===5)block=i<12;                                // tighter single gap
  if(kind===6)block=(i<=5)||(i>=9&&i<=13);              // two unequal exits
  if(block)cells.push(i);
 }
 return cells;
}
function collisionAt(player,wave){
 if(!wave||wave.cleared)return false;
 const angle=typeof player==="number"?player:player.angle||0;
 return wave.sectors.some(id=>{
  const center=(id+.5)*STEP;
  return Math.abs(angularDelta(angle,center))<=STEP*.5;
 });
}
function nearMiss(player,wave){
 if(!wave||wave.cleared||collisionAt(player,wave))return false;
 const angle=typeof player==="number"?player:player.angle||0;
 return wave.sectors.some(id=>Math.abs(angularDelta(angle,(id+.5)*STEP))<STEP*.69);
}
function mount(root){
 if(root._zebraDispose)root._zebraDispose();
 root.innerHTML="";
 let live=true,raf=0,ro=null,last=0,mode="menu",keys=new Set();
 let angle=0,turnVelocity=0,lives=MAX_LIVES,score=0,best=Number(load("best","0"))||0;
 let distance=0,travel=0,passed=0,combo=0,waves=[],spawnDelay=1.1,trail=[],sparks=[];
 let invuln=0,pulseCharge=2,pulseGlow=0,boostTime=0,boostCooldown=0;
 let flash=0,shake=0,elapsed=0,nextWave=0,message="",messageLife=0;
 let soundEnabled=load("sfx","on")!=="off",audioCtx=null;
 let dragPointer=null,dragX=0;
 const wrap=node("section","er zg zg-retro");
 wrap.setAttribute("aria-label","Echo Racer — jeu du tunnel phosphore");
 const heading=node("div","er-heading");
 const wordmark=node("div","er-wordmark");wordmark.append(
  node("span","er-echo","ECHO"),node("span","er-racer","RACER"));
 const headline=node("span","er-heading-sub","FPV / TUNNEL 360°");
 heading.append(wordmark,headline);wrap.appendChild(heading);
 const hud=node("div","er-hud");
 function metric(label){const box=node("div","er-meter");box.appendChild(node("span","",label));const value=node("strong","","0");box.appendChild(value);hud.appendChild(box);return value;}
 const scoreEl=metric("SCORE"),bestEl=metric("RECORD"),shieldEl=metric("BOUCLIERS"),energyEl=metric("PULSE");
 const frame=node("div","er-frame");
 const screen=node("div","er-screen");
 const canvas=node("canvas","er-canvas");canvas.width=W;canvas.height=H;canvas.setAttribute("aria-label","Tunnel vert phosphore, esquive les obstacles rouges");
 const c=canvas.getContext("2d",{alpha:false});
 if(!c)throw Error("Canvas 2D indisponible");
 const sheen=node("div","er-crt");sheen.setAttribute("aria-hidden","true");
 const overlay=node("div","er-overlay");
 const logo=node("h2","er-title","ECHO RACER");
 const status=node("div","er-title-sub","PHOSPHOR TUNNEL / SYSTEM 01");
 const prompt=node("div","er-start-call","PRESS BUTTON TO PLAY");
 const expl=node("p","er-help","VUE SUBJECTIVE · TOURNE AUTOUR DU TUNNEL POUR TROUVER LE PASSAGE");
 const hint=node("p","er-hint","← → TOURNE · ↑ ↓ VITESSE · ESPACE PULSE · Q BOOST · P PAUSE");
 const overlayButton=node("button","er-overlay-button","▶ DÉMARRER");
 overlayButton.type="button";
 overlay.append(logo,status,prompt,expl,hint,overlayButton);
 const telemetry=node("div","er-telemetry");
 const signal=node("span","er-signal","● VEILLE");
 const speedEl=node("span","","VITESSE 01");
 const warning=node("span","","—");
 telemetry.append(signal,speedEl,warning);
 screen.append(canvas,sheen,overlay,telemetry);frame.appendChild(screen);
 wrap.append(hud,frame);
 const footer=node("div","er-footer zg-buttons zt-buttons");
 function button(label,cls,callback){const b=node("button","er-hardware "+cls,label);b.type="button";b.onclick=()=>{beep("switch");callback();};return b;}
 const startButton=button("▶ JOUER","er-play",()=>{if(mode==="menu"||mode==="over")start();else togglePause();});
 const restartButton=button("↻ RESTART","",start);
 const soundButton=button("♫ SON ON","",()=>{
  soundEnabled=!soundEnabled;save("sfx",soundEnabled?"on":"off");renderSound();
 });
 const menuButton=button("☷ MENU","",toMenu);
 footer.append(startButton,restartButton,soundButton,menuButton);
 const pad=node("div","er-pad zt-handheld");pad.appendChild(footer);
 pad.setAttribute("aria-label","Manette tactile Echo Racer");
 const dpad=node("div","zt-dpad"),cross=node("div","zt-cross");
 cross.appendChild(node("div","zt-cross-shape"));
 function holdButton(label,cls,which){
  const b=node("button","zt-control "+cls,label);b.type="button";b.setAttribute("aria-label",label);
  b.onclick=function(e){if(e.detail===0){if(mode==="menu"||mode==="over")start();else if(mode==="running")tap(which);}};
  b.addEventListener("pointerdown",function(e){
   if(e.button!==undefined&&e.button!==0)return;
   e.preventDefault();if(mode!=="running"){if(mode==="menu"||mode==="over")start();return;}
   tap(which);if(["up","down","left","right"].includes(which))keys.add(which);
   try{b.setPointerCapture(e.pointerId);}catch(_){}
  });
  const up=()=>keys.delete(which);
  b.addEventListener("pointerup",up);b.addEventListener("pointercancel",up);
  b.addEventListener("lostpointercapture",up);
  b.addEventListener("contextmenu",e=>e.preventDefault());
  return b;
 }
 const spriteRoot="/assets/games/tetris-controls/";
 function attachSprite(button,path){
  const img=node("img","zt-control-sprite");img.alt="";img.draggable=false;
  button.appendChild(img);img.src=spriteRoot+path;
  return new Promise(resolve=>{img.onload=()=>resolve(true);img.onerror=()=>resolve(false);});
 }
 const buttons=[
  [holdButton("Accélérer","zt-dir zt-dir-up","up"),"upTetris.png"],
  [holdButton("Ralentir","zt-dir zt-dir-down","down"),"downTetris.png"],
  [holdButton("Tourner à gauche","zt-dir zt-dir-left","left"),"leftTetris.png"],
  [holdButton("Tourner à droite","zt-dir zt-dir-right","right"),"rightTetris.png"]
 ];
 buttons.forEach(pair=>cross.appendChild(pair[0]));
 cross.appendChild(node("span","zt-cross-center"));dpad.appendChild(cross);
 dpad.appendChild(node("span","zt-control-caption","DIRECTION"));
 const actionSide=node("div","zt-action-side"),ab=node("div","zt-ab");
 const bAction=holdButton("B — Boost","zt-ab-button zt-b","boost");
 const aAction=holdButton("A — Pulse","zt-ab-button zt-a","pulse");
 bAction.textContent="B";aAction.textContent="A";
 ab.append(bAction,aAction);actionSide.appendChild(ab);
 const select=holdButton("SELECT — Pause","zt-select","pause");select.textContent="SELECT";
 actionSide.append(select,node("span","zt-control-caption","B : BOOST · A : PULSE"));
 pad.append(dpad,actionSide);
 const spriteJobs=buttons.map(pair=>attachSprite(pair[0],pair[1]));
 spriteJobs.push(attachSprite(aAction,"btnAtetris.png"),attachSprite(bAction,"btnBtetris.png"),attachSprite(select,"selectTetris.png"));
 const skin=new Image();spriteJobs.push(new Promise(resolve=>{
  skin.onload=()=>resolve(true);skin.onerror=()=>resolve(false);skin.src=spriteRoot+"interfaceTetris.png";
 }));
 Promise.all(spriteJobs).then(results=>{if(live&&pad.isConnected&&results.every(Boolean))pad.classList.add("zt-skin-ready");});
 wrap.append(pad);
 wrap.appendChild(node("div","er-key-guide","← / → TOURNER  ·  ↑ / ↓ VITESSE  ·  Q BOOST  ·  ESPACE PULSE  ·  P PAUSE"));
 root.appendChild(wrap);
 function fitCanvas(){
  if(!live)return;
  const bounds=screen.getBoundingClientRect();
  if(!bounds.width||!bounds.height)return;
  W=Math.max(150,Math.round(bounds.width));H=Math.max(180,Math.round(bounds.height));
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const bw=Math.round(W*dpr),bh=Math.round(H*dpr);
  if(canvas.width!==bw||canvas.height!==bh){canvas.width=bw;canvas.height=bh;}
 }
 fitCanvas();
 function renderSound(){soundButton.textContent="♫ SON "+(soundEnabled?"ON":"OFF");soundButton.setAttribute("aria-pressed",String(soundEnabled));}
 function beep(kind){
  if(!soundEnabled||!live||load("sfx","on")==="off")return;
  try{
   const Ctx=window.AudioContext||window.webkitAudioContext;
   if(!Ctx)return;
   if(!audioCtx)audioCtx=new Ctx();
   if(audioCtx.state==="suspended")audioCtx.resume().catch(()=>{});
   const o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime;
   const freq=kind==="hit"?104:kind==="pulse"?720:kind==="pass"?445:kind==="collect"?880:260;
   o.type=kind==="hit"?"sawtooth":"triangle";o.frequency.setValueAtTime(freq,t);
   o.frequency.exponentialRampToValueAtTime(Math.max(60,freq*(kind==="hit"?.38:1.32)),t+.14);
   g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(kind==="hit"?.06:.028,t+.008);
   g.gain.exponentialRampToValueAtTime(.0001,t+.19);
   o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+.20);
  }catch(_){}
 }
 function renderHud(){
  scoreEl.textContent=Math.floor(score).toLocaleString("fr");
  bestEl.textContent=Math.floor(best).toLocaleString("fr");
  shieldEl.textContent="◆".repeat(lives)+"◇".repeat(MAX_LIVES-lives);
  energyEl.textContent="✦".repeat(pulseCharge)+"·".repeat(3-pulseCharge);
  speedEl.textContent="VITESSE "+String(Math.min(9,1+Math.floor(distance/550))).padStart(2,"0");
  signal.textContent=mode==="running"?"● SIGNAL":mode==="paused"?"● PAUSE":"● VEILLE";
  signal.classList.toggle("on",mode==="running");
  warning.textContent=boostTime>0?"BOOST ×2":invuln>0?"BOUCLIER":messageLife>0?message:"—";
  startButton.textContent=mode==="running"?"Ⅱ PAUSE":mode==="paused"?"▶ REPRENDRE":"▶ JOUER";
 }
 function start(){
  mode="running";angle=0;turnVelocity=0;lives=MAX_LIVES;score=distance=travel=passed=combo=0;
  waves=[];spawnDelay=1.1;elapsed=0;nextWave=0;trail=[];sparks=[];
  invuln=0;pulseCharge=2;pulseGlow=boostTime=boostCooldown=flash=shake=0;
  message="ÉVITE LES OBSTACLES";messageLife=2;keys.clear();overlay.hidden=true;
  beep("collect");renderHud();
 }
 function toMenu(){
  mode="menu";keys.clear();waves=[];trail=[];turnVelocity=0;elapsed=0;
  overlay.hidden=false;logo.textContent="ECHO RACER";prompt.textContent="PRESS BUTTON TO PLAY";
  status.textContent="FPV / TOUR DU TUNNEL 360°";
  overlayButton.textContent="▶ DÉMARRER";renderHud();
 }
 function gameOver(){
  mode="over";keys.clear();flash=.5;shake=6;beep("hit");
  if(score>best){best=Math.floor(score);save("best",best);}
  overlay.hidden=false;logo.textContent="GAME OVER";prompt.textContent="RUN TERMINÉ";
  status.textContent="SCORE "+Math.floor(score)+"  ·  RECORD "+best;
  overlayButton.textContent="↻ REJOUER";renderHud();
 }
 function togglePause(){
  if(mode==="running"){mode="paused";keys.clear();overlay.hidden=false;
   logo.textContent="PAUSE";prompt.textContent="SIGNAL SUSPENDU";status.textContent="LE TUNNEL T'ATTEND";
   overlayButton.textContent="▶ REPRENDRE";
  }else if(mode==="paused"){mode="running";overlay.hidden=true;}
  else start();renderHud();
 }
 function tap(which){
  if(which==="pause"){togglePause();return;}
  if(which==="pulse"){pulse();return;}
  if(which==="boost"){boost();return;}
  if(mode!=="running")return;
  // Single press = tiny rotation; holding the key rotates continuously.
  if(which==="left")angle-=STEP*.38;
  if(which==="right")angle+=STEP*.38;
  // Up/down control forward speed only. There is no 2D ship translation.
 }
 function burst(position,color,count){
  const a=typeof position==="number"?position:angle;
  for(let i=0;i<count;i++)sparks.push({
   a:a+rand(-.25,.25),z:rand(.9,2.0),va:rand(-1.2,1.2),vz:rand(-2.2,.7),
   life:rand(.15,.55),max:.55,color
  });
  if(sparks.length>90)sparks.splice(0,sparks.length-90);
 }
 function pulse(){
  if(mode!=="running"||pulseCharge<=0)return;
  pulseCharge--;pulseGlow=.5;beep("pulse");
  const target=waves.filter(w=>!w.cleared&&w.z>HIT_Z-.1&&w.z<HIT_Z+2.6).sort((a,b)=>a.z-b.z)[0];
  if(target){
   target.cleared=true;score+=120;combo++;message="PULSE +120";messageLife=1;
   burst(angle,"#a6fff5",24);
  }else{message="ONDE LIBÉRÉE";messageLife=.7;}
  renderHud();
 }
 function boost(){
  if(mode!=="running"||boostCooldown>0)return;
  boostTime=1.7;boostCooldown=5;message="BOOST ×2";messageLife=.8;
  beep("collect");renderHud();
 }
 function createWave(){
  let kind=Math.floor(rand(0,7));
  if(nextWave===kind)kind=(kind+2)%7;nextWave=kind;
  const offset=Math.floor(rand(0,SECTORS));
  const sectors=pattern(kind).map(id=>(id+offset)%SECTORS);
  return {kind,sectors,z:SPAWN_Z,length:.7,cleared:false,credited:false};
 }
 function advance(dt){
  if(mode!=="running"||document.hidden)return;
  dt=clamp(dt,0,.05);elapsed+=dt;
  const steer=(keys.has("right")?1:0)-(keys.has("left")?1:0);
  const targetTurn=steer*2.85;
  turnVelocity+=(targetTurn-turnVelocity)*Math.min(1,dt*11);
  angle=(angle+turnVelocity*dt+TAU)%TAU;
  const throttle=(keys.has("up")?.27:0)-(keys.has("down")?.23:0);
  const boostMultiplier=boostTime>0?1.5:1;
  const speed=clamp(.78+Math.min(.37,distance/1800*.4)+throttle,.47,1.65)*boostMultiplier;
  // One physical depth displacement: both geometry (travel) and gates use it.
  const dz=speed*dt;
  travel+=dz;
  distance+=dz*125;
  score+=dt*(12+Math.min(28,distance/240))*boostMultiplier;
  spawnDelay-=dt;
  invuln=Math.max(0,invuln-dt);boostTime=Math.max(0,boostTime-dt);
  boostCooldown=Math.max(0,boostCooldown-dt);
  pulseGlow=Math.max(0,pulseGlow-dt);messageLife=Math.max(0,messageLife-dt);
  flash=Math.max(0,flash-dt*1.8);shake=Math.max(0,shake-dt*16);
  if(spawnDelay<=0){
   waves.push(createWave());
   // A full revolution is possible between distant gates at normal speed.
   spawnDelay=Math.max(1.8,2.7-distance/3000)+rand(-.10,.15);
  }
  for(const w of waves){
   const oldZ=w.z;
   w.z-=dz;
   // Swept collision at the exact same plane at which the obstacles pass
   // the fixed cyan HUD arc. Frame rate cannot skip the detection.
   if(oldZ>HIT_Z&&w.z<=HIT_Z&&!w.credited){
    w.credited=true;passed++;
    if(!w.cleared&&collisionAt(angle,w)&&invuln<=0){
     lives--;combo=0;invuln=1.35;flash=.47;shake=3;beep("hit");
     message="IMPACT !";messageLife=1.05;burst(angle,"#ff4654",23);
     if(lives<=0){gameOver();break;}
    }else{
     const near=!w.cleared&&nearMiss(angle,w);
     combo++;const multiplier=Math.min(4,1+Math.floor(combo/5));
     const bonus=(near?90:50)*multiplier;
     score+=bonus*(boostTime>0?2:1);
     if(near){message="NEAR MISS +"+bonus;messageLife=.8;beep("pass");}
     else if(combo%5===0){message="COMBO ×"+multiplier;messageLife=.75;}
     if(passed%4===0){pulseCharge=Math.min(3,pulseCharge+1);beep("collect");}
    }
   }
  }
  waves=waves.filter(w=>w.z>-.8);
  sparks.forEach(p=>{p.a+=p.va*dt;p.z+=p.vz*dt;p.life-=dt;});
  sparks=sparks.filter(p=>p.life>0);
  if(score>best){best=Math.floor(score);save("best",best);}
  renderHud();
 }
 function point(theta,z){
  return wallPoint(theta,z);
 }
 function wallGeom(){return{cx:W*.5,cy:H*.5,R:Math.min(W,H)*.81};}
 function wallPoint(theta,z){
  const g=wallGeom(),r=g.R/(1+Math.max(0,z)*.68);
  return{x:g.cx+Math.cos(theta)*r,y:g.cy+Math.sin(theta)*r,r};
 }
 function screenAngle(worldAngle){return worldAngle-angle+PI/2;}
 function drawRing(z){
  if(z<0)return;
  const g=wallGeom(),r=wallPoint(0,z).r;
  const alpha=clamp(1-z/13,0,1);
  c.beginPath();c.arc(g.cx,g.cy,r,0,TAU);
  c.strokeStyle="rgba(120,255,45,"+(.22+alpha*.75)+")";
  c.lineWidth=1.15+alpha*2.1;c.shadowColor="#72ff28";c.shadowBlur=9;
  c.stroke();
 }
 function drawPlate(a0,a1,z,length){
  const near=Math.max(.05,z),far=near+length;
  const front=[],back=[];
  for(let i=0;i<=12;i++){
   const a=a0+(a1-a0)*i/12;
   front.push(wallPoint(a,near));back.push(wallPoint(a,far));
  }
  c.save();c.beginPath();
  front.forEach((p,i)=>{if(!i)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);});
  for(let i=back.length-1;i>=0;i--)c.lineTo(back[i].x,back[i].y);
  c.closePath();
  c.fillStyle="#e8293d";c.strokeStyle="#ff7983";
  c.lineWidth=1.3;c.shadowColor="#ff293a";c.shadowBlur=13;
  c.fill();c.stroke();c.shadowBlur=0;
  c.beginPath();
  back.forEach((p,i)=>{if(!i)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);});
  c.strokeStyle="#7d1320";c.lineWidth=2;c.stroke();c.restore();
 }
 function drawTunnel(now){
  const g=wallGeom();
  c.fillStyle="#000502";c.fillRect(0,0,W,H);
  const gradient=c.createRadialGradient(g.cx,g.cy,4,g.cx,g.cy,g.R*1.2);
  gradient.addColorStop(0,"#001109");
  gradient.addColorStop(.42,"#001008");
  gradient.addColorStop(1,"#000100");
  c.fillStyle=gradient;c.fillRect(0,0,W,H);
  c.save();c.lineCap="round";
  // The camera is straight down the axis at every angle; only tube ROLL
  // changes. Vanishing point is always EXACTLY at canvas center.
  for(let i=0;i<24;i++){
   const theta=screenAngle(i*TAU/24);
   const near=wallPoint(theta,.05),far=wallPoint(theta,13);
   c.beginPath();c.moveTo(near.x,near.y);c.lineTo(far.x,far.y);
   const accent=i%6===0;
   c.strokeStyle=accent?"rgba(68,245,188,.73)":"rgba(108,255,44,.57)";
   c.lineWidth=accent?2.6:1.55;
   c.shadowColor=accent?"#31ffd5":"#73ff35";c.shadowBlur=8;
   c.stroke();
  }
  const spacing=.48,phase=mode==="menu"?(now*.00012)%spacing:travel%spacing;
  for(let i=30;i>=0;i--)drawRing(i*spacing-phase);
  c.restore();
 }
 function drawWave(w){
  if(w.cleared||w.z>13||w.z<-.35)return;
  // Plates sit on the INNER WALL. Same angular coordinate and depth as rings.
  for(const id of w.sectors){
   const a=screenAngle(id*STEP),b=screenAngle((id+1)*STEP);
   drawPlate(a+.014,b-.014,w.z,w.length);
  }
 }
 function drawFPV(){
  const g=wallGeom(),plane=HIT_Z,p=wallPoint(PI/2,plane);
  const nearest=waves.filter(w=>!w.cleared&&w.z>=HIT_Z&&w.z<HIT_Z+1.55).sort((a,b)=>a.z-b.z)[0];
  const blocked=nearest&&collisionAt(angle,nearest);
  c.save();c.beginPath();
  c.arc(g.cx,g.cy,p.r,PI/2-.19,PI/2+.19);
  c.strokeStyle=blocked?"#ff5665":"#80fff0";
  c.shadowColor=blocked?"#ff253b":"#32ffe1";
  c.shadowBlur=15;c.lineWidth=4;c.stroke();
  c.beginPath();c.moveTo(p.x,p.y+5);c.lineTo(p.x-6,p.y+16);
  c.lineTo(p.x+6,p.y+16);c.closePath();
  c.fillStyle=blocked?"#ffced2":"#d4fffa";c.fill();
  if(pulseGlow>0){
   c.beginPath();c.arc(g.cx,g.cy,p.r+(1-pulseGlow)*W*.3,0,TAU);
   c.lineWidth=3;c.strokeStyle="rgba(126,255,236,"+(pulseGlow*1.6)+")";
   c.stroke();
  }
  c.restore();
 }
 function paint(now){
  if(!live||!root.isConnected)return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
  c.save();
  if(shake>0)c.translate(rand(-shake,shake),rand(-shake,shake));
  drawTunnel(now);
  waves.slice().sort((a,b)=>b.z-a.z).forEach(drawWave);
  c.restore();
  for(const p of sparks){
   const t=wallPoint(screenAngle(p.a),p.z);
   c.globalAlpha=clamp(p.life/p.max,0,1);
   c.fillStyle=p.color;c.fillRect(t.x-2,t.y-2,4,4);
  }
  c.globalAlpha=1;
  drawFPV();
  if(flash>0){
   c.fillStyle="rgba(255,42,56,"+(flash*.28)+")";c.fillRect(0,0,W,H);
  }
 }
 function frameTick(now){
  if(!live)return;
  raf=requestAnimationFrame(frameTick);
  const dt=last?clamp((now-last)/1000,0,.07):0;last=now;
  const parent=root.closest(".window");
  if(document.hidden||parent&&parent.classList.contains("minimized"))return;
  if(mode==="running")advance(dt);
  paint(now);
 }
 function keyDown(e){
  if(!live||document.hidden||e.altKey||e.ctrlKey||e.metaKey)return;
  const parent=root.closest(".window");
  if(parent&&(!parent.classList.contains("focused")||parent.classList.contains("minimized")))return;
  if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable)return;
  const k=e.key.toLowerCase(),control={
   arrowleft:"left",a:"left",arrowright:"right",d:"right",
   arrowup:"up",w:"up",arrowdown:"down",s:"down"
  };
  const dir=control[k];
  if(dir){e.preventDefault();if(mode!=="running"){if(!e.repeat)start();return;}keys.add(dir);return;}
  if(k==="enter"||k===" "||k==="q"||k==="p"||k==="escape"){
   e.preventDefault();if(e.repeat)return;
   if(mode==="menu"||mode==="over"){start();return;}
   if(k==="p"||k==="escape"){togglePause();return;}
   if(mode==="paused"){togglePause();return;}
   if(k===" "){pulse();return;}
   if(k==="q"){boost();return;}
  }
 }
 function keyUp(e){
  const map={arrowleft:"left",a:"left",arrowright:"right",d:"right",arrowup:"up",w:"up",arrowdown:"down",s:"down"};
  if(map[e.key.toLowerCase()])keys.delete(map[e.key.toLowerCase()]);
 }
 function boardDown(e){
  if(e.button!==undefined&&e.button!==0)return;
  if(e.target.closest&&e.target.closest("button"))return;
  if(mode!=="running"){start();return;}
  if(e.pointerType!=="touch"&&e.pointerType!=="pen")return;
  dragPointer=e.pointerId;dragX=e.clientX;
  try{screen.setPointerCapture(e.pointerId);}catch(_){}
 }
 function boardMove(e){
  if(dragPointer!==e.pointerId||mode!=="running")return;
  const bounds=canvas.getBoundingClientRect();
  if(!bounds.width)return;
  // Horizontal swipe = orbital rotation, no teleporting inside the circle.
  const dx=clamp(e.clientX-dragX,-bounds.width*.25,bounds.width*.25);
  angle=(angle+dx/bounds.width*TAU*1.25+TAU)%TAU;
  turnVelocity=0;dragX=e.clientX;
 }
 function boardUp(e){if(dragPointer===e.pointerId)dragPointer=null;}
 screen.addEventListener("pointerdown",boardDown);
 screen.addEventListener("pointermove",boardMove);
 screen.addEventListener("pointerup",boardUp);
 screen.addEventListener("pointercancel",boardUp);
 overlayButton.onclick=function(){if(mode==="paused")togglePause();else start();};
 document.addEventListener("keydown",keyDown);
 document.addEventListener("keyup",keyUp);
 function dispose(){
  live=false;cancelAnimationFrame(raf);keys.clear();
  document.removeEventListener("keydown",keyDown);
  document.removeEventListener("keyup",keyUp);
  if(ro){ro.disconnect();ro=null;}else window.removeEventListener("resize",fitCanvas);
  if(audioCtx)try{const p=audioCtx.close();if(p&&p.catch)p.catch(()=>{});}catch(_){}
  root._echoDebug=null;
 }
 root._zebraDispose=dispose;
 root._echoDebug={
  snapshot:()=>({mode,angle,turnVelocity,lives,score,best,distance,travel,passed,combo,pulseCharge,canvas:{width:W,height:H},waves:waves.map(w=>({z:w.z,kind:w.kind,cleared:w.cleared,credited:w.credited,sectors:[...w.sectors]}))}),
  advance:advance,start:start,pulse:pulse,boost:boost,menu:toMenu,pause:togglePause,
  pattern:pattern,collisionAt:collisionAt,hitDepth:HIT_Z
 };
 renderSound();toMenu();renderHud();
 if(typeof ResizeObserver!=="undefined"){ro=new ResizeObserver(fitCanvas);ro.observe(screen);}
 else window.addEventListener("resize",fitCanvas);
 requestAnimationFrame(fitCanvas);
 raf=requestAnimationFrame(frameTick);
 return dispose;
}
window.ZebraEchoRacer={mount,pattern,collisionAt};
}());