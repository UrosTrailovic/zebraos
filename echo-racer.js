/* Echo Racer — ZebraOS. Straight-ahead phosphor tunnel, rendered entirely
 * in Canvas 2D. Gameplay and soundtrack are independent of other ZebraOS apps.
 * No WebGL, no external rendering library, no duplicate audio source nodes. */
(function(){
"use strict";
const W=620,H=640,PI=Math.PI,TAU=PI*2,MAX_LIVES=3;
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
function pattern(n){
 // Five-by-five tiles; every pattern has several genuinely open escape routes.
 const cells=[],key=n%7;
 for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){
  let block=false;
  if(key===0)block=j===0;                           // horizontal shutter
  if(key===1)block=i===0;                           // vertical shutter
  if(key===2)block=(i===0||j===0)&&!(i===0&&j===0);// central escape window
  if(key===3)block=(i<=-1&&j>=0)||(i>=1&&j<=0);    // opposing corners
  if(key===4)block=Math.abs(i)===2&&Math.abs(j)<=1;// twin pillars
  if(key===5)block=(i===j||i===-j)&&Math.abs(i)>0;  // diagonal X
  if(key===6)block=(j===-1&&i<2)||(j===1&&i>-2);   // offset gates
  if(block)cells.push({x:i*.35,y:j*.35});
 }
 return cells;
}
function collisionAt(ship,wave){
 // All tile and ship positions refer to the *same* foreground play plane.
 // This is an actual 2D collision test, not a projected pixel approximation.
 for(const t of wave.tiles){
  if(Math.abs(t.x-ship.x)<.235&&Math.abs(t.y-ship.y)<.235)return true;
 }
 return false;
}
function nearMiss(ship,wave){
 let closest=Infinity;
 for(const t of wave.tiles){
  const d=Math.hypot(t.x-ship.x,t.y-ship.y);
  if(d<closest)closest=d;
 }
 return closest<.44&&!collisionAt(ship,wave);
}
function mount(root){
 if(root._zebraDispose)root._zebraDispose();
 root.innerHTML="";
 let live=true,raf=0,ro=null,last=0,mode="menu",keys=new Set();
 let x=0,y=.42,vx=0,vy=0,lives=MAX_LIVES,score=0,best=Number(load("best","0"))||0;
 let distance=0,passed=0,combo=0,waves=[],spawnDelay=1.1,trail=[],sparks=[];
 let invuln=0,pulseCharge=2,pulseGlow=0,boostTime=0,boostCooldown=0;
 let flash=0,shake=0,elapsed=0,nextWave=0,message="",messageLife=0;
 let soundEnabled=load("sfx","on")!=="off",audioCtx=null;
 let shipPointer=null;
 const wrap=node("section","er zg zg-retro");
 wrap.setAttribute("aria-label","Echo Racer — jeu du tunnel phosphore");
 const heading=node("div","er-heading");
 const wordmark=node("div","er-wordmark");wordmark.append(
  node("span","er-echo","ECHO"),node("span","er-racer","RACER"));
 const headline=node("span","er-heading-sub","PHOSPHOR DRIVE · 2D");
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
 const expl=node("p","er-help","DÉPLACE LE VAISSEAU · ÉVITE LES BLOCS ROUGES");
 const hint=node("p","er-hint","WASD / FLÈCHES · ESPACE : PULSE · Q : BOOST · P : PAUSE");
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
  b.onclick=function(e){if(e.detail===0){if(mode!=="running")start();else tap(which);}};
  b.addEventListener("pointerdown",function(e){
   if(e.button!==undefined&&e.button!==0)return;
   e.preventDefault();if(mode!=="running"){start();return;}
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
  [holdButton("Haut","zt-dir zt-dir-up","up"),"upTetris.png"],
  [holdButton("Bas","zt-dir zt-dir-down","down"),"downTetris.png"],
  [holdButton("Gauche","zt-dir zt-dir-left","left"),"leftTetris.png"],
  [holdButton("Droite","zt-dir zt-dir-right","right"),"rightTetris.png"]
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
 wrap.appendChild(node("div","er-key-guide","WASD / FLÈCHES  ·  Q BOOST  ·  ESPACE PULSE  ·  P PAUSE"));
 root.appendChild(wrap);
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
  mode="running";x=0;y=.42;vx=vy=0;lives=MAX_LIVES;score=distance=passed=combo=0;
  waves=[];spawnDelay=1.25;elapsed=0;nextWave=0;trail=[];sparks=[];
  invuln=0;pulseCharge=2;pulseGlow=boostTime=boostCooldown=flash=shake=0;
  message="ÉVITE LES OBSTACLES";messageLife=2;keys.clear();overlay.hidden=true;
  beep("collect");renderHud();
 }
 function toMenu(){
  mode="menu";keys.clear();waves=[];trail=[];vx=vy=0;elapsed=0;
  overlay.hidden=false;logo.textContent="ECHO RACER";prompt.textContent="PRESS BUTTON TO PLAY";
  status.textContent="PHOSPHOR TUNNEL / SYSTEM 01";
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
  if(["up","down","left","right"].includes(which)&&mode==="running"){
   const step=.07;
   if(which==="left")x-=step;if(which==="right")x+=step;
   if(which==="up")y-=step;if(which==="down")y+=step;
   constrain();
  }
 }
 function constrain(){
  x=clamp(x,-.89,.89);y=clamp(y,-.89,.89);
  const d=Math.hypot(x,y);
  if(d>.94){x*=.94/d;y*=.94/d;}
 }
 function burst(px,py,color,count){
  for(let i=0;i<count;i++)sparks.push({
   x:px,y:py,vx:rand(-.9,.9),vy:rand(-.9,.9),life:rand(.18,.7),max:.7,color
  });
  if(sparks.length>140)sparks.splice(0,sparks.length-140);
 }
 function pulse(){
  if(mode!=="running"||pulseCharge<=0)return;
  pulseCharge--;pulseGlow=.5;beep("pulse");
  const target=waves.filter(w=>!w.cleared&&w.z>.05&&w.z<.62).sort((a,b)=>a.z-b.z)[0];
  if(target){
   target.cleared=true;score+=120;combo++;message="PULSE +120";messageLife=1;
   burst(x,y,"#a6fff5",24);
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
  if(nextWave===kind)kind=(kind+2)%7;
  nextWave=kind;
  const base=pattern(kind),rotation=(Math.floor(rand(0,4))*PI)/2;
  const tiles=base.map(t=>({
   x:Math.round((t.x*Math.cos(rotation)-t.y*Math.sin(rotation))*1000)/1000,
   y:Math.round((t.x*Math.sin(rotation)+t.y*Math.cos(rotation))*1000)/1000
  }));
  return {tiles,kind,z:1.18,cleared:false,credited:false};
 }
 function advance(dt){
  if(mode!=="running"||document.hidden)return;
  dt=clamp(dt,0,.05);elapsed+=dt;
  const boostMultiplier=boostTime>0?1.42:1;
  const speed=(.25+Math.min(.22,distance/9500*.35))*boostMultiplier;
  const slide=1.38*dt;
  let ax=0,ay=0;
  if(keys.has("left"))ax-=1;if(keys.has("right"))ax+=1;
  if(keys.has("up"))ay-=1;if(keys.has("down"))ay+=1;
  const mag=Math.hypot(ax,ay)||1;
  x+=ax/mag*slide;y+=ay/mag*slide;constrain();
  vx=lerp(vx,ax*1.6,Math.min(1,dt*12));vy=lerp(vy,ay*1.6,Math.min(1,dt*12));
  distance+=dt*110*boostMultiplier;
  score+=dt*(12+Math.min(20,distance/300))*boostMultiplier;
  spawnDelay-=dt;invuln=Math.max(0,invuln-dt);boostTime=Math.max(0,boostTime-dt);
  boostCooldown=Math.max(0,boostCooldown-dt);
  pulseGlow=Math.max(0,pulseGlow-dt);messageLife=Math.max(0,messageLife-dt);
  flash=Math.max(0,flash-dt*1.8);shake=Math.max(0,shake-dt*16);
  if(spawnDelay<=0){
   waves.push(createWave());
   spawnDelay=Math.max(1.22,2.07-distance/6000)+rand(-.13,.13);
  }
  for(const w of waves){
   w.z-=speed*dt;
   if(w.z<=.08&&!w.credited){
    w.credited=true;passed++;
    if(!w.cleared&&collisionAt({x,y},w)&&invuln<=0){
     lives--;combo=0;invuln=1.4;flash=.52;shake=7;beep("hit");
     message="IMPACT !";messageLife=1.1;burst(x,y,"#ff464e",27);
     if(lives<=0){gameOver();break;}
    }else{
     const near=!w.cleared&&nearMiss({x,y},w);
     combo++;const bonus=(near?90:50)*Math.min(4,1+Math.floor(combo/5));
     score+=bonus*(boostTime>0?2:1);
     if(near){message="NEAR MISS +"+bonus;messageLife=.7;beep("pass");}
     else if(combo%5===0){message="COMBO ×"+Math.min(4,1+Math.floor(combo/5));messageLife=.7;}
     if(passed%4===0){pulseCharge=Math.min(3,pulseCharge+1);beep("collect");}
    }
   }
  }
  waves=waves.filter(w=>w.z>-.18);
  sparks.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;});
  sparks=sparks.filter(p=>p.life>0);
  trail.push({x,y,life:.24});if(trail.length>20)trail.shift();
  trail.forEach(p=>p.life-=dt);trail=trail.filter(p=>p.life>0);
  if(score>best){best=Math.floor(score);save("best",best);}
  renderHud();
 }
 function point(nx,ny,scale){
  const cx=W*.5,cy=H*.49,r=Math.min(W,H)*.505;
  return {x:cx+nx*r*.88*scale,y:cy+ny*r*.88*scale};
 }
 function ringScale(depth){
  // Depth is just a scalar for Canvas 2D projection: no 3D world/renderer.
  return .06+.98*Math.pow(clamp(1-depth,0,1),1.5);
 }
 function drawTunnel(now){
  c.fillStyle="#020805";c.fillRect(0,0,W,H);
  const cx=W*.5,cy=H*.49,r=Math.min(W,H)*.505;
  const bg=c.createRadialGradient(cx,cy,6,cx,cy,r*1.18);
  bg.addColorStop(0,"#071a0e");bg.addColorStop(.55,"#020b06");bg.addColorStop(1,"#000302");
  c.fillStyle=bg;c.fillRect(0,0,W,H);
  const phase=mode==="running"?distance/190:(now*.000045);
  c.save();c.lineCap="round";
  // Radial rails are straight: the tunnel does not turn left or right.
  c.strokeStyle="rgba(91,255,37,.65)";c.lineWidth=1.65;c.shadowBlur=9;c.shadowColor="#56ff28";
  for(let i=0;i<24;i++){
   const a=TAU*i/24,co=Math.cos(a),si=Math.sin(a);
   c.beginPath();c.moveTo(cx+co*r*.046,cy+si*r*.046);
   c.lineTo(cx+co*r*1.18,cy+si*r*1.18);c.stroke();
  }
  // A rolling series of concentric hoops creates forward motion in 2D.
  for(let i=0;i<19;i++){
   const depth=1-((i/19+phase%1)%1);
   const rad=r*1.15*ringScale(depth);
   const fade=.12+.78*Math.pow(1-depth,.75);
   c.strokeStyle="rgba(105,255,38,"+fade.toFixed(3)+")";
   c.lineWidth=1.2+3*Math.pow(1-depth,2);
   c.shadowBlur=7+8*(1-depth);
   c.beginPath();c.ellipse(cx,cy,rad,rad*.98,0,0,TAU);c.stroke();
  }
  c.restore();
  const center=c.createRadialGradient(cx,cy,0,cx,cy,r*.26);
  center.addColorStop(0,"rgba(5,18,9,.66)");center.addColorStop(1,"rgba(0,0,0,0)");
  c.fillStyle=center;c.fillRect(cx-r*.3,cy-r*.3,r*.6,r*.6);
 }
 function drawWave(w){
  if(w.cleared)return;
  const scale=ringScale(w.z);
  const r=Math.min(W,H)*.505;
  if(scale<=.065)return;
  c.save();c.lineJoin="miter";c.shadowColor="#ff243b";c.shadowBlur=7+18*scale;
  for(const t of w.tiles){
   const p=point(t.x,t.y,scale);
   const side=r*.265*scale;
   c.fillStyle="rgba(255,35,52,"+(clamp(.3+scale*.72,0,1)).toFixed(2)+")";
   c.strokeStyle="#ff656b";c.lineWidth=Math.max(.5,1.4*scale);
   c.fillRect(p.x-side/2,p.y-side/2,side-1,side-1);
   c.strokeRect(p.x-side/2+.6,p.y-side/2+.6,side-2,side-2);
   if(scale>.3){
    c.strokeStyle="rgba(37,0,5,.82)";c.lineWidth=Math.max(.7,1.8*scale);
    c.beginPath();c.moveTo(p.x,p.y-side/2);c.lineTo(p.x,p.y+side/2);
    c.moveTo(p.x-side/2,p.y);c.lineTo(p.x+side/2,p.y);c.stroke();
   }
  }
  c.restore();
 }
 function drawShip(){
  const p=point(x,y,1);
  c.save();c.translate(p.x,p.y);c.rotate(Math.max(-.24,Math.min(.24,vx*.13)));
  if(invuln>0&&Math.floor(elapsed*12)%2===0)c.globalAlpha=.30;
  c.shadowColor="#72ffe1";c.shadowBlur=24;
  c.fillStyle="#8fffe7";c.strokeStyle="#f0fff6";c.lineWidth=2.5;
  c.beginPath();c.moveTo(0,-19);c.lineTo(15,13);c.lineTo(0,7);
  c.lineTo(-15,13);c.closePath();c.fill();c.stroke();
  c.shadowBlur=0;c.fillStyle="#09291c";c.beginPath();c.moveTo(0,-10);
  c.lineTo(5,5);c.lineTo(0,2);c.lineTo(-5,5);c.closePath();c.fill();
  c.fillStyle=boostTime>0?"#effbff":"#4dffd0";c.shadowBlur=12;
  c.beginPath();c.moveTo(-5,13);c.lineTo(0,24+Math.sin(elapsed*40)*6);
  c.lineTo(5,13);c.closePath();c.fill();
  c.restore();
  if(pulseGlow>0){
   c.save();c.strokeStyle="rgba(140,255,238,"+(pulseGlow*1.3)+")";
   c.lineWidth=3;c.shadowBlur=22;c.shadowColor="#6fffe1";
   c.beginPath();c.arc(p.x,p.y,(.5-pulseGlow)*520+22,0,TAU);c.stroke();c.restore();
  }
 }
 function paint(now){
  if(!live||!root.isConnected)return;
  c.setTransform(1,0,0,1,0,0);
  c.clearRect(0,0,W,H);c.save();
  if(shake>0)c.translate(rand(-shake,shake),rand(-shake,shake));
  drawTunnel(now);
  // Far waves first, near waves above them, then the foreground ship.
  for(const w of waves.slice().sort((a,b)=>b.z-a.z))drawWave(w);
  for(const p of trail){
   const t=point(p.x,p.y,1);
   c.fillStyle="rgba(88,255,180,"+(Math.max(0,p.life)*.9)+")";
   c.beginPath();c.arc(t.x,t.y,Math.max(1,p.life*18),0,TAU);c.fill();
  }
  for(const p of sparks){
   const t=point(p.x,p.y,1);c.globalAlpha=clamp(p.life/.6,0,1);
   c.fillStyle=p.color;c.fillRect(t.x-2,t.y-2,4,4);
  }c.globalAlpha=1;
  drawShip();
  if(flash>0){
   c.fillStyle="rgba(255,51,64,"+(flash*.30)+")";c.fillRect(0,0,W,H);
  }
  c.restore();
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
  // Actual buttons start themselves; avoid a double reset on pointerdown.
  if(e.target.closest&&e.target.closest("button"))return;
  if(mode!=="running"){start();return;}
  if(e.pointerType!=="touch"&&e.pointerType!=="pen")return;
  shipPointer=e.pointerId;
  boardMove(e);
  try{screen.setPointerCapture(e.pointerId);}catch(_){}
 }
 function boardMove(e){
  if(shipPointer!==e.pointerId||mode!=="running")return;
  const rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  // A touchscreen drag may place the ship directly on the playing plane.
  x=clamp(((e.clientX-rect.left)/rect.width-.5)*2.18,-.89,.89);
  y=clamp(((e.clientY-rect.top)/rect.height-.49)*2.18,-.89,.89);
  constrain();
 }
 function boardUp(e){if(shipPointer===e.pointerId)shipPointer=null;}
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
  if(ro){ro.disconnect();ro=null;}
  if(audioCtx)try{const p=audioCtx.close();if(p&&p.catch)p.catch(()=>{});}catch(_){}
  root._echoDebug=null;
 }
 root._zebraDispose=dispose;
 root._echoDebug={
  snapshot:()=>({mode,x,y,lives,score,best,distance,passed,combo,pulseCharge,waves:waves.map(w=>({z:w.z,kind:w.kind,cleared:w.cleared,credited:w.credited,tiles:w.tiles.map(t=>({x:t.x,y:t.y}))}))}),
  advance:advance,start:start,pulse:pulse,boost:boost,menu:toMenu,pause:togglePause,
  pattern:pattern,collisionAt:collisionAt
 };
 renderSound();toMenu();renderHud();
 raf=requestAnimationFrame(frameTick);
 return dispose;
}
window.ZebraEchoRacer={mount,pattern,collisionAt};
}());