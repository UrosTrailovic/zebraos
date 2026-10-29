/* Echo Racer — ZebraOS. Curving phosphor tunnel, rendered entirely
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
/* The player keeps an angular position on the tunnel wall, but the visual
 * centerline now bends through space. Gates and collectibles share the same
 * curved projection while the exact original angular collision rules stay.
 * Experimental arcade curvature rather than full rigid-body 3D physics. */
const SECTORS=16,STEP=TAU/SECTORS,HIT_Z=1.6,SPAWN_Z=29.4,RENDER_FAR_Z=32.6;
const APPEAR_FADE_DEPTH=7.2;
const PATTERN_COUNT=16;
const LEVELS=[
 {id:"1",name:"INITIATION",subtitle:"PASSAGES LARGES",speed:.77,gap:1.55,spin:.04,patterns:[0,1,3,7,10,13]},
 {id:"2",name:"CIRCUIT",subtitle:"RYTHME CROISSANT",speed:.91,gap:1.2,spin:.14,patterns:[0,1,2,3,5,7,10,11,13,14]},
 {id:"3",name:"RAPIDE",subtitle:"RÈGLES CLASSIQUES",speed:1,gap:1,spin:.28,patterns:null},
 {id:"4",name:"EXTRÊME",subtitle:"VITESSE MAXIMALE",speed:1.16,gap:.84,spin:.44,patterns:null},
 {id:"free",name:"FREE ROAM",subtitle:"SANS OBSTACLES · BOOST ∞",speed:1,gap:1,spin:0,patterns:[]}
];
// Distances are in world units. Short double-gates punctuate longer stretches.
const GAP_MIN=15.2,GAP_MAX=21.4,START_GATE_AT=.48;
// A separate rhythm of collectible wall pads between the hazard waves.
const PAD_START=7.2,PAD_GAP_MIN=33,PAD_GAP_MAX=47;
const SHIELD_START=34,SHIELD_GAP_MIN=51,SHIELD_GAP_MAX=77;
const NITRO_BURN_SECONDS=3.2,NITRO_REFILL_SECONDS=5,NITRO_REGEN_WAIT=.45;
function angularDelta(a,b){return ((a-b+PI)%TAU+TAU)%TAU-PI;}
function inGap(i,start,width){
 return ((i-start+SECTORS)%SECTORS)<width;
}
// 16 distinct silhouettes: long slit, twin gates, zig-zag, teeth, broken
// pillars, forked bridges, rotating shutters, etc. Every design has a
// passage; the actual gate may rotate by sector offsets and animate.
function pattern(kind){
 const blocks=[];
 for(let i=0;i<SECTORS;i++){
  let wall=false;
  switch(kind%PATTERN_COUNT){
   case 0: wall=!inGap(i,0,6);break;                    // wide escape bay
   case 1: wall=!inGap(i,0,4)&&!inGap(i,9,4);break;    // twin doors
   case 2: wall=!inGap(i,0,3);break;                    // tight single slit
   case 3: wall=(i%8)<5;break;                         // two fork gaps
   case 4: wall=(i%4)<2;break;                         // alternating stripes
   case 5: wall=inGap(i,0,8)||inGap(i,11,2);break;     // broad wall + island
   case 6: wall=(i%5)<3;break;                         // staggered teeth
   case 7: wall=!inGap(i,2,5)&&!inGap(i,11,3);break;   // asymmetric doors
   case 8: wall=i%3!==0&&i!==9;break;                  // dotted grate
   case 9: wall=inGap(i,0,7)||inGap(i,9,5);break;      // paired shutters
   case 10:wall=(i%8)===0||(i%8)===1||(i%8)===2;break;// two broad ribs
   case 11:wall=!inGap(i,0,5)&&!inGap(i,10,2);break;  // big/small split
   case 12:wall=(i%6)<3;break;                         // triple stepped teeth
   case 13:wall=inGap(i,0,6)||inGap(i,10,3);break;    // uneven opposing arches
   case 14:wall=!inGap(i,0,4)&&!inGap(i,7,4);break;   // close double holes
   default:wall=inGap(i,0,5)||inGap(i,8,4)||i===14;  // scattered blocks
  }
  if(wall)blocks.push(i);
 }
 return blocks;
}
function obstacleAngle(wave,sector){
 return (sector+.5)*STEP+(wave.rotation||0);
}
function collisionAt(player,wave){
 if(!wave||wave.cleared)return false;
 const angle=typeof player==="number"?player:player.angle||0;
 return wave.sectors.some(id=>Math.abs(angularDelta(angle,obstacleAngle(wave,id)))<=STEP*.5);
}
function nearMiss(player,wave){
 if(!wave||wave.cleared||collisionAt(player,wave))return false;
 const angle=typeof player==="number"?player:player.angle||0;
 return wave.sectors.some(id=>Math.abs(angularDelta(angle,obstacleAngle(wave,id)))<STEP*.72);
}
function mount(root){
 if(root._zebraDispose)root._zebraDispose();
 root.innerHTML="";
 let live=true,raf=0,ro=null,last=0,mode="menu",keys=new Set();
 let renderDpr=1,hudTimer=0,bestSaveTimer=0,audioSampleTimer=0;
 let geometryCache={cx:W*.5,cy:H*.39,R:Math.max(W,H)*1.23,offset:5/9};
 let selectedLevel=LEVELS.find(x=>x.id===load("level","3"))||LEVELS[2];
 let angle=0,turnVelocity=0,lives=MAX_LIVES,score=0;
 let best=Number(load("best."+selectedLevel.id,selectedLevel.id==="3"?load("best","0"):"0"))||0;
 let distance=0,travel=0,passed=0,combo=0,waves=[],pads=[],shields=[],
  nextGateAt=START_GATE_AT,nextPadAt=PAD_START,nextShieldAt=SHIELD_START,
  lastGateAt=-100,trail=[],sparks=[],currentSpeed=0,gateCount=0,padCount=0,shieldCount=0,scoreMultiplier=1;
 let invuln=0,pulseCharge=2,pulseGlow=0,padBoostTime=0;
 let nitroHeld=false,nitroActive=false,nitroFuel=1,nitroRegenWait=0,nitroBurnTime=0;
 let flash=0,shake=0,elapsed=0,nextWave=0,message="",messageLife=0;
 let menuStage="home",menuIndex=Math.max(0,LEVELS.indexOf(selectedLevel)),pauseIndex=0,overIndex=0,warningLife=0,warningBeepDelay=0,warningChirp=0;
 const DEATH_FADE_SECONDS=1.15,DEATH_ANIMATION_SECONDS=1.15;
 let deathFade=0,deathLock=0;
 let soundEnabled=load("sfx","on")!=="off",audioCtx=null;
 // Dedicated Echo Racer audio system: never touch ZebraAMP or other games.
 let music=null,musicSource=null,musicAnalyser=null,musicBins=null,musicError=false;
 // Dedicated song boost; do not alter engine SFX or ZebraAMP's audio graph.
 let musicGain=null,musicLimiter=null;
 const MUSIC_GAIN=1.9;
 const musicUrl="/assets/games/echoraccaersong.mp3?v=1";
 // Two lightweight players independent of the music analyser.
 const flyUrl="/assets/spaceship-fly-sfx.mp3";
 const boostUrl="/assets/boostsfx.mp3?v=2";
 const FLY_VOLUME=.13,BOOST_VOLUME=.43,FLY_FADE_SECONDS=1.5;
 // The 0.967 s MP3 is already mastered to loop at its endpoints.
 const BOOST_FADE_IN_SECONDS=.11,BOOST_FADE_OUT_SECONDS=.23;
 let flySound=null,boostSound=null,flyFade=0,boostGain=0;
 let boostBuffer=null,boostSource=null,boostOutput=null,boostLoad=null,boostAudioFailed=false;
 const audioFx={bass:0,mid:0,high:0,kick:0,previousBass:0,slowBass:0,beatCooldown:0,energy:0};
 let dragPointer=null,dragX=0,dragLastTs=0,dragVelocity=0;
 const wrap=node("section","er zg zg-retro");
 wrap.setAttribute("aria-label","Echo Racer — jeu du tunnel phosphore");
 const heading=node("div","er-heading");
 const wordmark=node("div","er-wordmark");
 const headerLogo=node("img","er-header-logo");
 headerLogo.src="/assets/games/echo-raccer-logo.png";
 headerLogo.alt="ECHO RACER";
 wordmark.appendChild(headerLogo);
 heading.appendChild(wordmark);wrap.appendChild(heading);
 // Seven-segment phosphor digits: genuine segmented geometry, without a font
 // download or a canvas redraw each time a score changes.
 const SEGMENTS={0:"abcdef",1:"bc",2:"abdeg",3:"abcdg",4:"bcfg",
  5:"acdfg",6:"acdefg",7:"abc",8:"abcdefg",9:"abcdfg","-":"g"};
 const SEGMENT_NAMES="abcdefg";
 function setDigital(display,value){
  const text=String(value);
  if(display._erDisplayValue===text)return;
  display._erDisplayValue=text;
  display.setAttribute("aria-label",text);
  if(display.children.length!==text.length)display.replaceChildren();
  for(let i=0;i<text.length;i++){
   const char=text[i],glyph=char==="∞";
   let digit=display.children[i];
   if(!digit||digit.classList.contains("er-digit-symbol")!==glyph){
    digit=node("span",glyph?"er-digit-symbol":"er-digit");
    digit.setAttribute("aria-hidden","true");
    if(!glyph)for(const seg of SEGMENT_NAMES)digit.appendChild(node("i","er-seg er-seg-"+seg));
    if(display.children[i])display.replaceChild(digit,display.children[i]);
    else display.appendChild(digit);
   }
   if(digit.dataset.char===char)continue;
   digit.dataset.char=char;
   if(glyph)digit.textContent="∞";
   else{
    const active=SEGMENTS[char]||"";
    for(let j=0;j<7;j++)digit.children[j].classList.toggle("lit",active.includes(SEGMENT_NAMES[j]));
   }
  }
 }
 function digital(cls){
  const el=node("strong","er-digital "+(cls||""));
  el.setAttribute("role","img");
  return el;
 }
 const hud=node("div","er-hud");
 hud.setAttribute("aria-label","Instrumentation Echo Racer");
 let scoreLabel=null;
 function metric(label,kind,footer){
  const box=node("div","er-meter er-meter-"+kind);
  const title=node("span","er-meter-label",label);
  if(label==="SCORE")scoreLabel=title;
  const value=digital("er-meter-number");
  const base=node("div","er-meter-foot",footer);
  box.append(title,value,base);
  if(kind==="shield"||kind==="pulse"){
   const rack=node("div","er-meter-rack");
   value._erSlots=[];
   for(let i=0;i<3;i++){
    const indicator=node("i","er-meter-slot");
    indicator.setAttribute("aria-hidden","true");
    rack.appendChild(indicator);value._erSlots.push(indicator);
   }
   box.appendChild(rack);
  }
  hud.appendChild(box);
  return value;
 }
 const scoreEl=metric("SCORE","score","TOTAL / PTS"),
  bestEl=metric("RECORD","best","PERSONAL BEST"),
  shieldEl=metric("BOUCLIERS","shield","HULL STATUS"),
  energyEl=metric("PULSE","pulse","WAVE CHARGE");
 const frame=node("div","er-frame");
 const screen=node("div","er-screen");
 const canvas=node("canvas","er-canvas");canvas.width=W;canvas.height=H;canvas.setAttribute("aria-label","Tunnel spatial violet et rose, rotation autour des barrières lumineuses");
 const c=canvas.getContext("2d",{alpha:false});
 if(!c)throw Error("Canvas 2D indisponible");
 // Transparent pixel-art hood, loaded only when Echo Racer opens.
 // The original PNGs are untouched; a failed download preserves gameplay.
 const shipSprites={idle:new Image(),boost:new Image()};
 const shipReady={idle:false,boost:false};
 let shipBoostFade=0,turboLight=0,featheredBoost=null;
 // Uploaded boost artwork is cut at the extreme sides; softly blend them
 // into the complete idle hull to hide hard rectangular exhaust edges.
 function softenBoostEdges(sprite){
  const offscreen=document.createElement("canvas");
  offscreen.width=sprite.naturalWidth;offscreen.height=sprite.naturalHeight;
  const pen=offscreen.getContext("2d");
  if(!pen)return sprite;
  pen.drawImage(sprite,0,0);
  pen.globalCompositeOperation="destination-in";
  const edge=pen.createLinearGradient(0,0,offscreen.width,0);
  edge.addColorStop(0,"rgba(255,255,255,0)");
  edge.addColorStop(.105,"rgba(255,255,255,1)");
  edge.addColorStop(.895,"rgba(255,255,255,1)");
  edge.addColorStop(1,"rgba(255,255,255,0)");
  pen.fillStyle=edge;pen.fillRect(0,0,offscreen.width,offscreen.height);
  return offscreen;
 }
 for(const state of ["idle","boost"]){
  const sprite=shipSprites[state];
  sprite.decoding="async";
  sprite.onload=()=>{
   if(!live)return;
   shipReady[state]=sprite.naturalWidth>0;
   if(state==="boost"&&shipReady.boost)
    featheredBoost=softenBoostEdges(sprite);
  };
  sprite.onerror=()=>{if(live)shipReady[state]=false;};
  sprite.src="/assets/games/echo-ship-"+state+".png";
 }
 const sheen=node("div","er-crt");sheen.setAttribute("aria-hidden","true");
 const overlay=node("div","er-overlay");
 const brandLogo=node("img","er-brand-logo");
 brandLogo.src="/assets/games/echo-raccer-logo.png";
 brandLogo.alt="Echo Racer";
 const logo=node("h2","er-title","ECHO RACER");
 const crashIcon=node("img","er-crash-icon");
 crashIcon.src="/assets/games/warning.png";crashIcon.alt="";
 crashIcon.hidden=true;
 const crashSub=node("div","er-crash-sub","SIGNAL PERDU — VAISSEAU DÉTRUIT");
 crashSub.hidden=true;
 const status=node("div","er-title-sub","PHOSPHOR TUNNEL / SYSTEM 01");
 const prompt=node("div","er-start-call","SYSTEM READY");
 const introDiagnostic=node("div","er-intro-diagnostic");
 introDiagnostic.setAttribute("aria-hidden","true");
 introDiagnostic.append(node("span","er-intro-tag","NEURAL LINK / 01"),
  node("span","er-intro-light","● CORE ONLINE"));
 const introTrack=node("div","er-intro-track");
 introTrack.setAttribute("aria-hidden","true");
 for(let i=0;i<21;i++)introTrack.appendChild(node("i","er-intro-cell"));
 const expl=node("p","er-help","VUE SUBJECTIVE · TOURNE AUTOUR DU TUNNEL POUR TROUVER LE PASSAGE");
 const hint=node("p","er-hint","← → TOURNE · ↑ ↓ VITESSE · ESPACE NITRO (MAINTENIR) · Q PULSE · P PAUSE");
 const overlayButton=node("button","er-overlay-button","▶ DÉMARRER");
 overlayButton.type="button";
 const levelPicker=node("div","er-level-picker");
 levelPicker.setAttribute("role","group");levelPicker.setAttribute("aria-label","Choisir un niveau");
 const levelButtons=LEVELS.map((level,index)=>{
  const btn=node("button","er-level-button");
  btn.type="button";btn.title=level.subtitle;
  btn.setAttribute("aria-label",(level.id==="free"?"Free Roam":"Niveau "+level.id)+" — "+level.name);
  btn.style.setProperty("--level-texture",'url("/assets/games/lvl'+(index+1)+'.png")');
  // Entire native pixel-art image is the button; no CSS or text overlay.
  btn.onclick=()=>{
   if(mode!=="menu"||menuStage!=="levels")return;
   menuIndex=index;
   confirmLevel();
  };
  levelPicker.appendChild(btn);return btn;
 });
 const backButton=node("button","er-menu-back","MENU");
 backButton.type="button";backButton.setAttribute("aria-label","Retour au menu principal");
 backButton.onclick=()=>toMenu();
 function paintMenuSelection(){
  levelButtons.forEach((btn,i)=>{
   const active=mode==="menu"&&menuStage==="levels"&&i===menuIndex;
   btn.classList.toggle("selected",active);
   btn.setAttribute("aria-current",active?"true":"false");
  });
  overlayButton.classList.toggle("selected",mode==="menu"&&menuStage==="home"||
   mode==="paused"&&pauseIndex===0||mode==="over"&&overIndex===0);
  backButton.classList.toggle("selected",mode==="over"&&overIndex===1);
  [pauseRestart,pauseSound,pauseMenu].forEach((btn,i)=>btn.classList.toggle("selected",mode==="paused"&&pauseIndex===i+1));
 }
 function confirmLevel(){
  if(mode!=="menu"||menuStage!=="levels")return;
  selectedLevel=LEVELS[menuIndex];save("level",selectedLevel.id);
  best=Number(load("best."+selectedLevel.id,selectedLevel.id==="3"?load("best","0"):"0"))||0;
  start();
 }
 function controllerInput(which){
  if(mode==="crashing"||(mode==="over"&&deathLock>0))return;
  const backward=which==="up"||which==="left";
  const forward=which==="down"||which==="right";
  if(mode==="menu"){
   if(menuStage==="home"){
    if(which==="pulse"||which==="pause")showLevelSelect();
    return;
   }
   if(backward||forward){
    menuIndex=(menuIndex+(forward?1:-1)+LEVELS.length)%LEVELS.length;
    beep("switch");paintMenuSelection();return;
   }
   if(which==="pulse"){confirmLevel();return;}
   if(which==="boost"||which==="pause"){renderMenuStage("home");return;}
   return;
  }
  if(mode==="paused"){
   if(backward||forward){
    pauseIndex=(pauseIndex+(forward?1:-1)+4)%4;beep("switch");paintMenuSelection();return;
   }
   if(which==="pulse"){
    if(pauseIndex===0)togglePause();
    else if(pauseIndex===1)start();
    else if(pauseIndex===2)soundButton.click();
    else toMenu();
   }else if(which==="boost"||which==="pause")togglePause();
   return;
  }
  if(mode==="over"){
   if(backward||forward){overIndex=1-overIndex;beep("switch");paintMenuSelection();return;}
   if(which==="pulse"){if(overIndex===0)start();else toMenu();}
   else if(which==="boost"||which==="pause")toMenu();
   return;
  }
  if(mode==="running")tap(which);
 }
 function renderMenuStage(stage){
  menuStage=stage;
  const choosing=stage==="levels";
  overlay.classList.toggle("er-stage-levels",choosing);
  overlay.classList.toggle("er-stage-home",!choosing);
  brandLogo.hidden=false;logo.hidden=true;crashIcon.hidden=true;crashSub.hidden=true;
  overlay.classList.remove("er-stage-over","er-stage-pause");screen.classList.remove("er-death");
  pauseActions.hidden=true;
  levelPicker.hidden=!choosing;overlayButton.hidden=choosing;
  backButton.hidden=!choosing;status.hidden=!choosing;
  prompt.hidden=choosing;introDiagnostic.hidden=choosing;introTrack.hidden=choosing;
  expl.hidden=true;hint.hidden=!choosing;
  if(choosing){status.textContent="CHOISIS TON CIRCUIT";
   hint.textContent="↑ ↓ CHOISIR · A VALIDER · B RETOUR · 1–5 AU CLAVIER";
  }
  overlayButton.classList.remove("er-overlay-restart");
  overlayButton.textContent="▶ JOUER";
  overlayButton.setAttribute("aria-label","Jouer — sélectionner un niveau");
  backButton.setAttribute("aria-label","Retour à l'accueil Echo Racer");
  paintMenuSelection();
 }
 function showLevelSelect(){
  if(mode!=="menu"||menuStage==="levels")return;
  menuIndex=Math.max(0,LEVELS.indexOf(selectedLevel));
  renderMenuStage("levels");
 }
 // SELECT opens these controls via the pause overlay, not a permanent bar.
 const pauseActions=node("div","er-pause-actions");
 pauseActions.setAttribute("role","group");
 pauseActions.setAttribute("aria-label","Commandes en pause");
 function pauseAction(label,cls,fn){
  const btn=node("button","er-pause-action "+cls,label);
  btn.type="button";btn.onclick=fn;return btn;
 }
 const pauseRestart=pauseAction("↻ RESTART","er-pause-restart",()=>start());
 const pauseSound=pauseAction("♫ SON ON","er-pause-sound",()=>soundButton.click());
 const pauseMenu=pauseAction("☷ MENU","er-pause-menu",()=>toMenu());
 pauseActions.append(pauseRestart,pauseSound,pauseMenu);pauseActions.hidden=true;
 overlay.append(introDiagnostic,brandLogo,introTrack,crashIcon,logo,crashSub,status,prompt,levelPicker,expl,hint,overlayButton,backButton,pauseActions);
 const dashboard=node("div","er-dashboard");
 dashboard.setAttribute("role","group");dashboard.setAttribute("aria-label","Tableau de bord vitesse et boost");
 const dashHeader=node("div","er-dashboard-header");
 dashHeader.append(node("span","","ECHO / TELEMETRY"),node("span","","HYPERDRIVE · 02"));
 dashboard.appendChild(dashHeader);
 function instrument(label,cls,unit){
  const row=node("div","er-dashboard-row "+cls),
   readout=node("div","er-dashboard-readout");
  const labelEl=node("span","er-dashboard-name",label);
  const value=digital("er-dashboard-digits");
  const unitEl=node("span","er-dashboard-unit",unit);
  readout.append(labelEl,value,unitEl);
  const bar=node("div","er-dashboard-bar");bar.setAttribute("aria-hidden","true");
  const segments=[];
  for(let i=0;i<17;i++){
   const led=node("span","er-dashboard-led");
   const progress=i/16;
   // Real raised, curved tachometer sweep, not one skewed straight bar.
   // Boost climbs in an opposite accelerating curve.
   const rise=cls==="er-dashboard-speed"
    ? 10+75*Math.sin(progress*Math.PI*.5)
    : 8+78*(progress*progress*(3-2*progress));
   led.style.setProperty("--gauge-x",(3+i*5.55).toFixed(2)+"%");
   led.style.setProperty("--gauge-rise",rise.toFixed(2)+"%");
   led.style.setProperty("--gauge-tilt",String(cls==="er-dashboard-speed"?-24:-31));
   bar.appendChild(led);segments.push(led);
  }
  const statusEl=node("span","er-dashboard-status","");
  row.append(readout,bar,statusEl);dashboard.appendChild(row);
  return{row,value,segments,statusEl};
 }
 const speedGauge=instrument("VITESSE","er-dashboard-speed","KM/H");
 const boostGauge=instrument("BOOST","er-dashboard-boost","%");
 const eventText=node("div","er-race-event","");
 const warningLayer=node("div","er-shield-warning");
 const warningIcon=node("img","er-shield-warning-icon");
 warningIcon.src="/assets/games/warning.png";warningIcon.alt="";
 warningLayer.setAttribute("role","status");
 warningLayer.setAttribute("aria-label","Attention : dernier bouclier");
 warningLayer.append(warningIcon,node("span","er-shield-warning-label","DERNIER BOUCLIER"));
 warningLayer.hidden=true;
 const crashCurtain=node("div","er-crash-curtain");
 crashCurtain.hidden=true;crashCurtain.setAttribute("aria-hidden","true");
 // Instruments are part of frame: overlay on desktop, physical strip on mobile.
 screen.append(canvas,sheen,eventText,warningLayer,overlay,crashCurtain);
 frame.append(screen,dashboard);
 wrap.append(hud,frame);
 const footer=node("div","er-footer zg-buttons zt-buttons");
 function button(label,cls,callback){const b=node("button","er-hardware "+cls,label);b.type="button";b.onclick=()=>{beep("switch");callback();};return b;}
 const startButton=button("▶ JOUER","er-play",()=>{
  if(mode==="menu")showLevelSelect();
  else if(mode==="over")start();
  else togglePause();
 });
 const restartButton=button("↻ RESTART","er-restart",start);
 const soundButton=button("♫ SON ON","er-sound",()=>{
  soundEnabled=!soundEnabled;save("sfx",soundEnabled?"on":"off");
   if(!soundEnabled)pauseMusic();
   else if(mode==="running")startMusic(false);
   renderSound();
 });
 const menuButton=button("☷ MENU","er-menu",toMenu);
 footer.append(startButton,restartButton,soundButton,menuButton);
 const pad=node("div","er-pad zt-handheld");pad.appendChild(footer);
 pad.setAttribute("aria-label","Manette tactile Echo Racer");
 const dpad=node("div","zt-dpad"),cross=node("div","zt-cross");
 cross.appendChild(node("div","zt-cross-shape"));
 function holdButton(label,cls,which){
  const b=node("button","zt-control "+cls,label);b.type="button";b.setAttribute("aria-label",label);
  // Virtual controller has one action per press in menus. Pointerdown, not
  // synthetic click, keeps mobile and keyboard behavior consistent.
  b.onclick=function(e){
   if(e.detail===0&&which!=="boost")controllerInput(which);
  };
  if(which==="boost"){
   b.addEventListener("keydown",e=>{
    if(e.key!==" "&&e.key!=="Enter")return;
    e.preventDefault();e.stopPropagation();
    if(mode==="running")beginNitro();
    else if(!e.repeat)controllerInput("boost");
   });
   b.addEventListener("keyup",e=>{
    if(e.key===" "||e.key==="Enter"){e.preventDefault();e.stopPropagation();endNitro();}
   });
  }
  b.addEventListener("pointerdown",function(e){
   if(e.button!==undefined&&e.button!==0)return;
   e.preventDefault();
   if(mode!=="running"){controllerInput(which);return;}
   tap(which);
   if(["up","down","left","right"].includes(which))keys.add(which);
   try{b.setPointerCapture(e.pointerId);}catch(_){}
  });
  const up=()=>{keys.delete(which);if(which==="boost")endNitro();};
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
 const bAction=holdButton("B — Nitro (maintenir)","zt-ab-button zt-b","boost");
 const aAction=holdButton("A — Pulse","zt-ab-button zt-a","pulse");
 bAction.textContent="B";aAction.textContent="A";
 ab.append(bAction,aAction);actionSide.appendChild(ab);
 const select=holdButton("SELECT — Pause","zt-select","pause");select.textContent="SELECT";
 actionSide.append(select,node("span","zt-control-caption","B : NITRO · A : PULSE"));
 pad.append(dpad,actionSide);
 const spriteJobs=buttons.map(pair=>attachSprite(pair[0],pair[1]));
 spriteJobs.push(attachSprite(aAction,"btnAtetris.png"),attachSprite(bAction,"btnBtetris.png"),attachSprite(select,"selectTetris.png"));
 const skin=new Image();spriteJobs.push(new Promise(resolve=>{
  skin.onload=()=>resolve(true);skin.onerror=()=>resolve(false);skin.src=spriteRoot+"interfaceTetris.png";
 }));
 Promise.all(spriteJobs).then(results=>{if(live&&pad.isConnected&&results.every(Boolean))pad.classList.add("zt-skin-ready");});
 wrap.append(pad);
 root.appendChild(wrap);
 function fitCanvas(){
  if(!live)return;
  const bounds=screen.getBoundingClientRect();
  if(!bounds.width||!bounds.height)return;
  W=Math.max(150,Math.round(bounds.width));H=Math.max(180,Math.round(bounds.height));
  renderDpr=Math.min(W<520?1.25:1.5,window.devicePixelRatio||1);
  geometryCache={cx:W*.5,cy:H*.39,R:Math.max(W,H)*1.23,offset:5/9};
  const bw=Math.round(W*renderDpr),bh=Math.round(H*renderDpr);
  if(canvas.width!==bw||canvas.height!==bh){canvas.width=bw;canvas.height=bh;}
 }
 fitCanvas();
 function globalMuted(){
  try{return localStorage.getItem("zebra.sfx.muted")==="1";}catch(_){return false;}
 }
 function ensureAudioContext(){
  if(audioCtx)return audioCtx;
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)return null;
  try{audioCtx=new Ctx();return audioCtx;}catch(_){return null;}
 }
 function ensureMusic(){
  if(music)return music;
  if(!window.Audio)return null;
  try{
   music=new window.Audio(musicUrl);
   music.loop=true;music.volume=.82;music.preload="none";
   music.onerror=function(){musicError=true;};
   const context=ensureAudioContext();
   if(context&&context.createMediaElementSource&&context.createAnalyser){
    try{
     const analyser=context.createAnalyser();
     analyser.fftSize=1024;analyser.smoothingTimeConstant=.74;
     const source=context.createMediaElementSource(music);
     musicSource=source;
     // Keep the analyser upstream of the playback gain so the visual
     // reactivity still tracks the unboosted song rather than a clipped feed.
     source.connect(analyser);
     let output=analyser;
     if(context.createGain){
      try{
       musicGain=context.createGain();
       musicGain.gain.value=MUSIC_GAIN;
       output.connect(musicGain);
       output=musicGain;
      }catch(_){musicGain=null;}
     }
     // Peak protection for quieter MP3s that need more perceived loudness.
     if(context.createDynamicsCompressor){
      try{
       musicLimiter=context.createDynamicsCompressor();
       musicLimiter.threshold.value=-2.5;
       musicLimiter.knee.value=2;
       musicLimiter.ratio.value=12;
       musicLimiter.attack.value=.003;
       musicLimiter.release.value=.13;
       output.connect(musicLimiter);
       output=musicLimiter;
      }catch(_){musicLimiter=null;}
     }
     output.connect(context.destination);
     musicAnalyser=analyser;
     musicBins=new Uint8Array(analyser.frequencyBinCount);
    }catch(_){
     // One source node per music element; fall back to direct playback.
     if(musicSource)try{musicSource.connect(context.destination);}catch(_){}
     musicAnalyser=null;musicBins=null;
    }
   }
  }catch(_){music=null;musicAnalyser=null;musicBins=null;}
  return music;
 }
 // Audio elements are created lazily inside the first game start gesture.
 function ensureEngineAudio(){
  if(!window.Audio)return false;
  try{
   if(!flySound){
    flySound=new window.Audio(flyUrl);
    flySound.loop=true;flySound.preload="auto";flySound.volume=0;
   }
   if(!boostSound){
    boostSound=new window.Audio(boostUrl);
    boostSound.loop=true;boostSound.preload="auto";boostSound.volume=0;
   }
  }catch(_){return false;}
  return !!flySound;
 }
 function startEngine(rewind){
  if(!live||mode!=="running"||!soundEnabled||globalMuted()||document.hidden)return;
  if(!ensureEngineAudio())return;
  if(rewind){
   stopBoostSource();primeBoostAudio();
   flyFade=0;
   try{flySound.pause();flySound.currentTime=0;flySound.volume=0;}catch(_){}
   if(boostSound)try{boostSound.pause();boostSound.currentTime=0;boostSound.volume=0;}catch(_){}
   boostGain=0;
  }
  if(flySound.paused)try{
   const started=flySound.play();
   if(started&&started.catch)started.catch(()=>{});
  }catch(_){}
 }
 function pauseEngine(){
  stopBoostSource();
  if(flySound)try{flySound.pause();}catch(_){}
  if(boostSound)try{boostSound.pause();boostSound.volume=0;}catch(_){}
  boostGain=0;
 }
 function stopEngine(){
  pauseEngine();flyFade=0;
  if(flySound)try{flySound.currentTime=0;flySound.volume=0;}catch(_){}
  if(boostSound)try{boostSound.currentTime=0;}catch(_){}
 }
 function tickEngine(dt){
  if(!flySound||mode!=="running")return;
  if(!soundEnabled||globalMuted()||document.hidden){pauseEngine();return;}
  if(flySound.paused)return;
  flyFade=clamp(flyFade+clamp(dt,0,.07)/FLY_FADE_SECONDS,0,1);
  const t=flyFade;
  flySound.volume=FLY_VOLUME*t*t*(3-2*t);
 }
 // MP3 element loops can pause at decoder frame boundaries. Decode once
 // into an AudioBufferSourceNode with a trimmed, crossfaded seamless seam.
 function primeBoostAudio(){
  if(boostBuffer||boostLoad||boostAudioFailed||!live)return boostLoad;
  const ctx=ensureAudioContext();
  if(!ctx||typeof ctx.createBufferSource!=="function"||typeof ctx.createBuffer!=="function"||typeof fetch!=="function"){
   boostAudioFailed=true;return null;
  }
  boostLoad=fetch(boostUrl).then(response=>{
   if(!response.ok)throw Error("Boost asset unavailable");
   return response.arrayBuffer();
  }).then(bytes=>ctx.decodeAudioData(bytes)).then(raw=>{
   if(!live)return null;
   // Trim encoder silence at each end before stitching the seam.
   let peak=0;
   for(let ch=0;ch<raw.numberOfChannels;ch++){
    const data=raw.getChannelData(ch);
    for(let i=0;i<data.length;i++)peak=Math.max(peak,Math.abs(data[i]));
   }
   const threshold=Math.max(.0004,peak*.011);
   let first=0,last=raw.length;
   const loudAt=i=>{
    for(let ch=0;ch<raw.numberOfChannels;ch++)
     if(Math.abs(raw.getChannelData(ch)[i])>threshold)return true;
    return false;
   };
   while(first<raw.length&& !loudAt(first))first++;
   while(last>first&& !loudAt(last-1))last--;
   const margin=Math.floor(raw.sampleRate*.004);
   first=Math.max(0,first-margin);last=Math.min(raw.length,last+margin);
   if(last-first<raw.sampleRate*.16){first=0;last=raw.length;}
   const overlap=Math.min(Math.round(raw.sampleRate*.040),Math.floor((last-first)/6));
   if(overlap<2){boostBuffer=raw;return raw;}
   const len=last-first-overlap;
   const buffer=ctx.createBuffer(raw.numberOfChannels,len,raw.sampleRate);
   for(let ch=0;ch<raw.numberOfChannels;ch++){
    const input=raw.getChannelData(ch),output=buffer.getChannelData(ch);
    output.set(input.subarray(first,first+len));
    // The final overlap is moved to the head: the loop ends where the
    // blended tail begins, so there is no discontinuity or MP3 padding gap.
    for(let i=0;i<overlap;i++){
     const t=(i+1)/(overlap+1);
     output[i]=input[last-overlap+i]*(1-t)+input[first+i]*t;
    }
   }
   boostBuffer=buffer;
   if(mode==="running"&&(nitroActive||padBoostTime>0))startBoostLoop();
   return buffer;
  }).catch(()=>{boostAudioFailed=true;return null;});
  return boostLoad;
 }
 function stopBoostSource(){
  if(boostSource){
   try{boostSource.stop();boostSource.disconnect();}catch(_){}
   boostSource=null;
  }
  if(boostOutput){try{boostOutput.disconnect();}catch(_){}boostOutput=null;}
 }
 function startBoostLoop(){
  if(!live||mode!=="running"||!soundEnabled||globalMuted()||document.hidden)return;
  primeBoostAudio();
  if(boostBuffer&&!boostSource&&audioCtx){
   try{
    const src=audioCtx.createBufferSource(),gain=audioCtx.createGain();
    src.buffer=boostBuffer;src.loop=true;
    gain.gain.value=BOOST_VOLUME*boostGain;
    src.connect(gain);gain.connect(audioCtx.destination);src.start();
    boostSource=src;boostOutput=gain;
    if(boostSound&&!boostSound.paused)try{boostSound.pause();}catch(_){}
   }catch(_){boostAudioFailed=true;boostSource=null;boostOutput=null;}
  }
  // Fallback only while decoding or if a browser lacks AudioBufferSourceNode.
  if(!boostSource&&boostSound&&boostSound.paused){
   try{
    boostSound.loop=true;boostSound.volume=BOOST_VOLUME*boostGain;
    const task=boostSound.play();if(task&&task.catch)task.catch(()=>{});
   }catch(_){}
  }
 }
 function tickBoostLoop(dt){
  if(!boostSound&&!boostSource)return;
  const enabled=live&&mode==="running"&&soundEnabled&&!globalMuted()&&!document.hidden;
  const wanted=enabled&&(nitroActive||padBoostTime>0);
  if(!enabled){
   stopBoostSource();
   if(boostSound&&!boostSound.paused)try{boostSound.pause();}catch(_){}
   if(boostSound)boostSound.volume=0;
   boostGain=0;return;
  }
  if(wanted)startBoostLoop();
  const fade=wanted?BOOST_FADE_IN_SECONDS:BOOST_FADE_OUT_SECONDS;
  boostGain=clamp(boostGain+(wanted?1:-1)*clamp(dt,0,.07)/fade,0,1);
  if(boostOutput)boostOutput.gain.value=BOOST_VOLUME*boostGain;
  if(boostSound)boostSound.volume=boostSource?0:BOOST_VOLUME*boostGain;
  // Maintain the decoded loop, silent, between rapid presses; no reset/click.
  if(!wanted&&boostGain===0&&!boostSource&&boostSound&&!boostSound.paused)
   try{boostSound.pause();}catch(_){}
 }
 function startMusic(rewind){
  if(!live||!soundEnabled||globalMuted()||document.hidden)return;
  startEngine(rewind);
  if(nitroActive||padBoostTime>0)startBoostLoop();
  const track=ensureMusic();if(!track)return;
  const context=audioCtx;
  if(context&&context.state==="suspended")try{
   const p=context.resume();if(p&&p.catch)p.catch(()=>{});
  }catch(_){}
  if(rewind)try{track.currentTime=0;}catch(_){}
  musicError=false;
  try{
   const started=track.play();
   if(started&&started.catch)started.catch(()=>{musicError=true;});
  }catch(_){musicError=true;}
 }
 function pauseMusic(){
  if(music)try{music.pause();}catch(_){}
  pauseEngine();
 }
 function stopMusic(){
  pauseMusic();stopEngine();
  if(music)try{music.currentTime=0;}catch(_){}
  audioFx.bass=audioFx.mid=audioFx.high=audioFx.kick=audioFx.previousBass=audioFx.slowBass=audioFx.energy=0;
  audioFx.beatCooldown=0;
 }
 function sampleMusic(dt){
  audioSampleTimer+=clamp(dt,0,.08);
  if(audioSampleTimer<.04)return;
  dt=Math.min(.12,audioSampleTimer);audioSampleTimer=0;
  const shouldRead=mode==="running"&&soundEnabled&&!globalMuted()&&
    music&&!music.paused&&musicAnalyser&&musicBins;
  if(!shouldRead){
   const decay=Math.exp(-dt*7);
   audioFx.bass*=decay;audioFx.mid*=decay;audioFx.high*=decay;
   audioFx.kick=Math.max(0,audioFx.kick-dt*2.9);
   audioFx.previousBass*=decay;audioFx.slowBass*=decay;audioFx.energy*=decay;
   return;
  }
  try{musicAnalyser.getByteFrequencyData(musicBins);}catch(_){return;}
  function avg(start,end){
   let sum=0;const endBin=Math.min(end,musicBins.length);
   for(let k=start;k<endBin;k++)sum+=musicBins[k];
   return sum/Math.max(1,endBin-start);
  }
  // High-sensitivity normalization for mixed, mastered MP3 material.
  // Leave headroom for loud mastered MP3s: avoid permanent saturation.
  const bass=clamp((avg(1,10)-12)/175,0,1),
        mid=clamp((avg(11,50)-10)/166,0,1),
        high=clamp((avg(51,180)-8)/156,0,1);
  const attack=1-Math.exp(-dt*23),release=1-Math.exp(-dt*7);
  audioFx.bass+=(bass-audioFx.bass)*(bass>audioFx.bass?attack:release);
  audioFx.mid+=(mid-audioFx.mid)*(mid>audioFx.mid?attack:release);
  audioFx.high+=(high-audioFx.high)*(high>audioFx.high?attack:release);
  const baseline=audioFx.slowBass;
  audioFx.slowBass+=(bass-audioFx.slowBass)*(1-Math.exp(-dt*1.6));
  audioFx.beatCooldown=Math.max(0,audioFx.beatCooldown-dt);
  if(bass>.25&&bass-baseline>.085&&audioFx.beatCooldown<=0){
   audioFx.kick=1;audioFx.beatCooldown=.17;
  }else audioFx.kick=Math.max(0,audioFx.kick-dt*3.2);
  audioFx.energy=clamp(audioFx.bass*.55+audioFx.mid*.33+
    audioFx.high*.22+audioFx.kick*.25,0,1);
  audioFx.previousBass=bass;
 }
 function renderSound(){
  soundButton.textContent="♫ SON "+(soundEnabled?"ON":"OFF");
  soundButton.setAttribute("aria-pressed",String(soundEnabled));
  pauseSound.textContent=soundEnabled?"♫ SON ON":"♫ SON OFF";
  pauseSound.setAttribute("aria-pressed",String(soundEnabled));
 }
 function beep(kind){
  if(!soundEnabled||!live||globalMuted())return;
  try{
   const context=ensureAudioContext();
   if(!context)return;
   if(audioCtx.state==="suspended")audioCtx.resume().catch(()=>{});
   const o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime;
   const freq=kind==="hit"?104:kind==="pulse"?720:kind==="pass"?445:kind==="collect"?880:
    kind==="warning"?(++warningChirp%2?980:760):260;
   o.type=kind==="hit"?"sawtooth":kind==="warning"?"square":"triangle";
   o.frequency.setValueAtTime(freq,t);
   if(kind!=="warning")o.frequency.exponentialRampToValueAtTime(Math.max(60,freq*(kind==="hit"?.38:1.32)),t+.14);
   g.gain.setValueAtTime(.0001,t);
   g.gain.exponentialRampToValueAtTime(kind==="hit"?.06:kind==="warning"?.022:.028,t+.008);
   g.gain.exponentialRampToValueAtTime(.0001,t+.19);
   o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+.20);
  }catch(_){}
 }
 function playDeathSound(){
  if(!live||!soundEnabled||globalMuted())return;
  try{
   const context=ensureAudioContext();
   if(!context)return;
   if(context.state==="suspended")context.resume().catch(()=>{});
   const now=context.currentTime;
   for(const [start,freq,volume,duration] of [[0,510,.045,.56],[.095,155,.052,.88]]){
    const osc=context.createOscillator(),gain=context.createGain();
    osc.type="sawtooth";
    osc.frequency.setValueAtTime(freq,now+start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40,freq*.22),now+start+duration);
    gain.gain.setValueAtTime(.0001,now+start);
    gain.gain.exponentialRampToValueAtTime(volume,now+start+.025);
    gain.gain.exponentialRampToValueAtTime(.0001,now+start+duration);
    osc.connect(gain);gain.connect(context.destination);
    osc.start(now+start);osc.stop(now+start+duration+.02);
   }
  }catch(_){}
 }
 function lightSegments(segments,ratio){
  const n=clamp(Math.round(ratio*segments.length),0,segments.length);
  segments.forEach((led,i)=>led.classList.toggle("lit",i<n));
 }
 function renderHud(){
  scoreLabel.textContent="SCORE";
  setDigital(scoreEl,String(Math.floor(score)).padStart(5,"0"));
  setDigital(bestEl,String(Math.floor(best)).padStart(5,"0"));
  setDigital(shieldEl,String(lives).padStart(2,"0"));
  setDigital(energyEl,String(pulseCharge).padStart(2,"0"));
  shieldEl._erSlots.forEach((el,i)=>el.classList.toggle("lit",i<lives));
  energyEl._erSlots.forEach((el,i)=>el.classList.toggle("lit",i<pulseCharge));
  const speed=Math.round((mode==="menu"?0:currentSpeed)*25);
  setDigital(speedGauge.value,String(speed).padStart(3,"0"));
  lightSegments(speedGauge.segments,clamp(speed/310,0,1));
  const free=selectedLevel.id==="free";
  const active=mode==="running"&&(nitroActive||padBoostTime>0);
  const charge=free?1:nitroFuel;
  setDigital(boostGauge.value,free?"∞":String(Math.round(charge*100)).padStart(3,"0"));
  boostGauge.statusEl.textContent=padBoostTime>0?"TURBO":nitroActive?"NITRO":free?"ILLIMITÉ":
   charge>=.999?"PRÊT":nitroRegenWait>0?"PAUSE":"RECHARGE";
  boostGauge.row.classList.toggle("er-dashboard-active",active);
  dashboard.classList.toggle("er-boost-active",active);
  lightSegments(boostGauge.segments,charge);
  eventText.textContent=mode==="running"&&messageLife>0?message:"";
  eventText.classList.toggle("visible",mode==="running"&&messageLife>0);
  warningLayer.hidden=!(mode==="running"&&warningLife>0);
  startButton.textContent=mode==="running"?"Ⅱ PAUSE":mode==="paused"?"▶ REPRENDRE":"▶ JOUER";
  startButton.setAttribute("aria-label",startButton.textContent);
  startButton.classList.toggle("er-footer-playing",mode==="running");
 }
 function lockDeathControls(locked){
  root.classList.toggle("er-death-locked",locked);
  for(const btn of [startButton,restartButton,soundButton,menuButton,overlayButton,backButton,pauseRestart,pauseSound,pauseMenu])
   btn.disabled=locked;
 }
 function advanceDeathSequence(dt){
  if(mode==="crashing"){
   deathFade=Math.min(DEATH_FADE_SECONDS,deathFade+Math.max(0,dt));
   crashCurtain.style.opacity=String(deathFade/DEATH_FADE_SECONDS);
   if(deathFade>=DEATH_FADE_SECONDS)revealGameOver();
  }else if(mode==="over"&&deathLock>0){
   deathLock=Math.max(0,deathLock-Math.max(0,dt));
   if(deathLock===0)lockDeathControls(false);
  }
 }
 function start(){
  if(mode==="crashing"||(mode==="over"&&deathLock>0))return;
  deathFade=deathLock=0;crashCurtain.hidden=true;crashCurtain.style.opacity="0";
  lockDeathControls(false);
  mode="running";angle=0;turnVelocity=0;lives=MAX_LIVES;score=distance=travel=passed=combo=0;
  hudTimer=bestSaveTimer=audioSampleTimer=0;
  waves=[];pads=[];shields=[];
  nextGateAt=selectedLevel.id==="free"?Infinity:START_GATE_AT;
  nextPadAt=selectedLevel.id==="free"?Infinity:PAD_START;
  nextShieldAt=selectedLevel.id==="free"?Infinity:SHIELD_START;
  lastGateAt=-100;elapsed=0;nextWave=-1;gateCount=0;padCount=0;shieldCount=0;
  trail=[];sparks=[];currentSpeed=0;scoreMultiplier=1;
  invuln=0;pulseCharge=2;pulseGlow=padBoostTime=flash=shake=0;
  nitroHeld=false;nitroActive=false;nitroFuel=1;nitroRegenWait=0;nitroBurnTime=0;
  shipBoostFade=0;turboLight=0;warningLife=0;warningBeepDelay=0;warningChirp=0;
  screen.classList.remove("er-death","er-crashing");
  overlay.classList.remove("er-stage-over","er-stage-pause");pauseActions.hidden=true;
  crashIcon.hidden=true;crashSub.hidden=true;
  message=selectedLevel.id==="free"?"FREE ROAM · BOOST ILLIMITÉ":"TROUVE LE PASSAGE";messageLife=2;keys.clear();levelPicker.hidden=true;backButton.hidden=true;overlay.hidden=true;
  beep("collect");startMusic(true);renderHud();
 }
 function toMenu(){
  if(mode==="crashing"||(mode==="over"&&deathLock>0))return;
  deathFade=deathLock=0;crashCurtain.hidden=true;crashCurtain.style.opacity="0";
  screen.classList.remove("er-crashing");lockDeathControls(false);
  if(mode!=="menu"&&score>0)save("best."+selectedLevel.id,best);
  stopMusic();mode="menu";keys.clear();waves=[];pads=[];shields=[];trail=[];turnVelocity=0;
  elapsed=0;padBoostTime=0;nitroHeld=false;nitroActive=false;nitroFuel=1;nitroRegenWait=0;nitroBurnTime=0;
  currentSpeed=0;score=0;scoreMultiplier=1;warningLife=0;warningBeepDelay=0;
  overlay.hidden=false;renderMenuStage("home");
  renderHud();
 }
 function gameOver(){
  if(mode!=="running")return;
  stopMusic();nitroHeld=false;nitroActive=false;mode="crashing";
  keys.clear();dragPointer=null;deathFade=0;deathLock=0;
  warningLife=0;warningBeepDelay=0;
  flash=.55;shake=7;
  if(score>best){best=Math.floor(score);save("best."+selectedLevel.id,best);}
  overlay.hidden=true;screen.classList.remove("er-death");
  screen.classList.add("er-crashing");
  crashCurtain.style.opacity="0";crashCurtain.hidden=false;
  lockDeathControls(true);renderHud();
 }
 function revealGameOver(){
  if(mode!=="crashing")return;
  mode="over";deathFade=DEATH_FADE_SECONDS;deathLock=DEATH_ANIMATION_SECONDS;
  screen.classList.remove("er-crashing");
  // Existing red impact, glitch and death synth play AFTER blackout.
  flash=1.8;shake=12;playDeathSound();
  screen.classList.add("er-death");
  overlay.hidden=false;introDiagnostic.hidden=true;introTrack.hidden=true;
  brandLogo.hidden=true;logo.hidden=false;logo.textContent="GAME OVER";
  crashIcon.hidden=false;crashSub.hidden=false;
  overlay.classList.remove("er-stage-home","er-stage-levels","er-stage-pause");
  pauseActions.hidden=true;
  overlay.classList.add("er-stage-over");
  levelPicker.hidden=true;backButton.hidden=false;
  status.hidden=false;status.textContent="SCORE "+Math.floor(score)+"  ·  RECORD "+best;
  prompt.hidden=true;expl.hidden=true;hint.hidden=true;
  overlayButton.hidden=false;overlayButton.classList.add("er-overlay-restart");
  overlayButton.textContent="↻ REJOUER";overlayButton.setAttribute("aria-label","Rejouer le niveau");
  crashCurtain.hidden=true;lockDeathControls(true);overIndex=0;paintMenuSelection();renderHud();
 }
 function togglePause(){
  if(mode==="crashing"||(mode==="over"&&deathLock>0))return;
  if(mode==="running"){endNitro();mode="paused";pauseIndex=0;
   introDiagnostic.hidden=true;introTrack.hidden=true;pauseMusic();turnVelocity=0;dragPointer=null;keys.clear();levelPicker.hidden=true;backButton.hidden=true;overlay.hidden=false;
   overlay.classList.add("er-stage-pause");pauseActions.hidden=false;
   brandLogo.hidden=true;logo.hidden=false;logo.textContent="PAUSE";
   prompt.hidden=false;prompt.textContent="SIGNAL SUSPENDU";
   status.hidden=false;status.textContent="LE TUNNEL T'ATTEND";
   expl.hidden=true;hint.hidden=true;
   overlay.classList.remove("er-stage-home","er-stage-levels");
   overlayButton.hidden=false;overlayButton.classList.remove("er-overlay-restart");
   overlayButton.textContent="▶ REPRENDRE";overlayButton.setAttribute("aria-label","Reprendre la course");
   paintMenuSelection();
  }else if(mode==="paused"){mode="running";overlay.hidden=true;overlay.classList.remove("er-stage-pause");pauseActions.hidden=true;startMusic(false);}
  else start();renderHud();
 }
 function tap(which){
  if(which==="pause"){togglePause();return;}
  if(which==="pulse"){pulse();return;}
  if(which==="boost"){beginNitro();return;}
  if(mode!=="running")return;
  // Single press = tiny rotation; holding the key rotates continuously.
  if(which==="left"||which==="right"){
   const d=which==="right"?-1:1;
   angle=(angle+d*STEP*.085+TAU)%TAU;
   turnVelocity=clamp(turnVelocity+d*.56,-3.25,3.25);
  }
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
   burst(angle,"#8defff",24);
  }else{message="ONDE LIBÉRÉE";messageLife=.7;}
  renderHud();
 }
 function beginNitro(){
  if(mode!=="running"||nitroHeld)return;
  nitroHeld=true;
  if(selectedLevel.id!=="free"&&nitroFuel<=0)return;
  nitroActive=true;nitroRegenWait=0;
  shipBoostFade=1;turboLight=1;nitroBurnTime=0;
  message=selectedLevel.id==="free"?"NITRO ∞":"NITRO";messageLife=.7;
  startBoostLoop();renderHud();
 }
 function endNitro(){
  nitroHeld=false;
  if(!nitroActive)return;
  nitroActive=false;nitroBurnTime=0;
  if(selectedLevel.id!=="free"&&nitroFuel<1)nitroRegenWait=NITRO_REGEN_WAIT;
  // The fade-out is finished on animation frames, not at key release.
  renderHud();
 }
 function updateNitro(dt){
  if(mode!=="running")return;
  if(nitroActive)nitroBurnTime+=dt;
  if(nitroActive&&selectedLevel.id!=="free"){
   nitroFuel=clamp(nitroFuel-dt/NITRO_BURN_SECONDS,0,1);
   if(nitroFuel<=0){
    nitroActive=false;nitroBurnTime=0;nitroRegenWait=NITRO_REGEN_WAIT;
   }
  }else if(!nitroHeld&&selectedLevel.id!=="free"&&nitroFuel<1){
   nitroRegenWait=Math.max(0,nitroRegenWait-dt);
   if(nitroRegenWait<=0)nitroFuel=clamp(nitroFuel+dt/NITRO_REFILL_SECONDS,0,1);
  }
 }
 function createWave(){
  const choices=selectedLevel.patterns||Array.from({length:PATTERN_COUNT},(_,i)=>i);
  let kind=choices[Math.floor(rand(0,choices.length))];
  if(kind===nextWave&&choices.length>1)
   kind=choices[(choices.indexOf(kind)+1+Math.floor(rand(0,choices.length-1)))%choices.length];
  nextWave=kind;
  const rotation=Math.floor(rand(0,SECTORS))*STEP;
  // 1 in 4 waves slowly spins; spin affects both drawing and hit detection.
  const spins=(gateCount>2&&Math.random()<selectedLevel.spin);
  const spin=spins?(Math.random()<.5?-1:1)*rand(.26,.55):0;
  const twist=rand(-.14,.14);
  const sectors=pattern(kind);
  return {
   kind,sectors,z:SPAWN_Z,
   length:kind===2||kind===8?rand(.6,.9):rand(.85,1.5),
   rotation,spin,twist,cleared:false,credited:false
  };
 }
 function nextGateGap(){
  const hard=nextWave===2||nextWave===8||nextWave===9;
  // Variety of breathing room: double-gate sets, long open accelerations,
  // normal gaps. The tightest shutters get EXTRA distance.
  let gap;
  if(gateCount%7===5)gap=rand(12.1,13.9);         // occasional fast double gate
  else if(gateCount%7===6)gap=rand(21.0,24.5);  // relief after the double gate
  else gap=rand(GAP_MIN,GAP_MAX);
  if(hard)gap+=2.4;
  return gap*selectedLevel.gap;
 }
 function advance(dt){
  if(mode!=="running"||document.hidden)return;
  dt=clamp(dt,0,.05);elapsed+=dt;
  // Inverted orbital steering: pressing LEFT rotates the camera/ship toward
  // the opposite tunnel angle. Keep keyboard and touch D-pad consistent.
  const steer=(keys.has("left")?1:0)-(keys.has("right")?1:0);
  const targetTurn=steer*3.50;
  // Accelerate decisively, coast when released, brake quickly by counter-steer.
  const turnRate=steer?(turnVelocity*steer<0?10.2:7.1):3.5;
  turnVelocity+=(targetTurn-turnVelocity)*(1-Math.exp(-dt*turnRate));
  if(!steer&&Math.abs(turnVelocity)<.01)turnVelocity=0;
  if(dragPointer===null)angle=(angle+turnVelocity*dt+TAU)%TAU;
  const throttle=(keys.has("up")?.52:0)-(keys.has("down")?.55:0);
  // A boost pad is stronger than manual boost, but they do not multiply
  // together into an uncontrollable/untestable collision speed.
  updateNitro(dt);
  // Score-driven cruise progression: uninterrupted growth in every mode.
  const growthRate=selectedLevel.id==="1"?.50:selectedLevel.id==="2"?.61:
   selectedLevel.id==="3"?.72:selectedLevel.id==="4"?.84:.58;
  const growth=Math.min(2.25,Math.log1p(Math.max(0,score)/3500)*growthRate);
  const base=(clamp(4.15+Math.min(1.55,distance/3000*.43)+throttle,3.5,5.7)+growth)*selectedLevel.speed;
  // A held nitro continues to gain thrust, instead of jumping to a ceiling.
  const nitroThrust=1.38+1.1*(1-Math.exp(-nitroBurnTime*.72));
  const multiplier=padBoostTime>0?2.5:nitroActive?nitroThrust:1;
  const targetSpeed=base*multiplier;
  const response=targetSpeed>=currentSpeed?6.7:.62;
  currentSpeed+=(targetSpeed-currentSpeed)*(1-Math.exp(-dt*response));
  const speed=currentSpeed;
  // Score multiplier follows ACTUAL travel speed (including pad/manual boost).
  scoreMultiplier= speed>=8.2?5:speed>=6.85?4:speed>=5.65?3:speed>=4.7?2:1;
  // One physical depth displacement: both geometry (travel) and gates use it.
  const dz=speed*dt;
  travel+=dz;
  distance+=dz*125;
  score+=dt*(15+Math.min(35,distance/210))*scoreMultiplier;
  invuln=Math.max(0,invuln-dt);
  padBoostTime=Math.max(0,padBoostTime-dt);
  pulseGlow=Math.max(0,pulseGlow-dt);messageLife=Math.max(0,messageLife-dt);
  flash=Math.max(0,flash-dt*1.8);shake=Math.max(0,shake-dt*16);
  if(warningLife>0){
   warningLife=Math.max(0,warningLife-dt);
   warningBeepDelay-=dt;
   if(warningLife>0&&warningBeepDelay<=0){
    beep("warning");warningBeepDelay+=.47;
   }
  }
  // Separate obstacles by WORLD distance, not seconds. At faster speeds,
  // each gate still has a long, empty tunnel leading to the next one.
  while(travel>=nextGateAt){
   gateCount++;
   const spawnAt=nextGateAt;
   const wave=createWave();
   wave.z=SPAWN_Z-(travel-spawnAt);
   waves.push(wave);
   lastGateAt=spawnAt;
   nextGateAt+=nextGateGap();
  }
  // Pads have their OWN calendar and cannot appear on top of a hazard.
  while(travel>=nextPadAt){
   const gapPrevious=nextPadAt-lastGateAt;
   const gapNext=nextGateAt-nextPadAt;
   if(gapPrevious<5.3||gapNext<5.3){nextPadAt+=5.4;continue;}
   const targetSector=(Math.floor((angle/TAU)*SECTORS)-1+SECTORS)%SECTORS;
   const center=padCount===0?targetSector:Math.floor(rand(0,SECTORS));
   const pad={z:SPAWN_Z-(travel-nextPadAt),sectors:[center,(center+1)%SECTORS,(center+2)%SECTORS],
     length:1.1,cleared:false,credited:false};
   pads.push(pad);padCount++;
   nextPadAt+=rand(PAD_GAP_MIN,PAD_GAP_MAX);
  }
  // Independent world-space shield calendar. Skip positions beside gates.
  while(travel>=nextShieldAt){
   if(nextShieldAt-lastGateAt<7||nextGateAt-nextShieldAt<7){
    nextShieldAt+=7.5;continue;
   }
   const nearSector=Math.floor(angle/STEP);
   const center=(shieldCount===0||Math.random()<.58)?
    (nearSector+Math.floor(rand(-2,3))+SECTORS)%SECTORS:
    Math.floor(rand(0,SECTORS));
   shields.push({z:SPAWN_Z-(travel-nextShieldAt),
     sectors:[center,(center+1)%SECTORS],credited:false,shimmer:rand(0,TAU)});
   shieldCount++;
   nextShieldAt+=rand(SHIELD_GAP_MIN,SHIELD_GAP_MAX);
  }
  for(const pickup of shields){
   const oldZ=pickup.z;pickup.z-=dz;
   if(oldZ>HIT_Z&&pickup.z<=HIT_Z&&!pickup.credited){
    pickup.credited=true;
    if(collisionAt(angle,pickup)){
     const gained=lives<MAX_LIVES;
     if(gained){lives++;warningLife=0;warningBeepDelay=0;}
     else score+=100*scoreMultiplier;
     message=gained?"BOUCLIER +1":"BOUCLIER MAX +100";
     messageLife=1.4;
     burst(angle,"#a1ffe0",26);beep("collect");renderHud();
    }
   }
  }
  shields=shields.filter(p=>p.z>-.8);
  for(const pad of pads){
   const oldZ=pad.z;pad.z-=dz;
   if(oldZ>HIT_Z&&pad.z<=HIT_Z&&!pad.credited){
    pad.credited=true;
    if(collisionAt(angle,pad)){
     padBoostTime=Math.max(padBoostTime,2.8);
     shipBoostFade=1;turboLight=1;
     score+=275*scoreMultiplier;
     pulseGlow=.68;message="TURBO PAD +275";messageLife=1.2;
     burst(angle,"#72f7ff",34);startBoostLoop();beep("collect");
    }
   }
  }
  pads=pads.filter(p=>p.z>-.8);
  for(const w of waves){
   const oldZ=w.z;
   w.z-=dz;
   if(w.spin)w.rotation+=w.spin*dt;
   // Swept collision at the exact same plane at which the obstacles pass
   // the fixed cyan HUD arc. Frame rate cannot skip the detection.
   if(oldZ>HIT_Z&&w.z<=HIT_Z&&!w.credited){
    w.credited=true;passed++;
    if(!w.cleared&&collisionAt(angle,w)&&invuln<=0){
     lives--;combo=0;invuln=1.35;flash=.47;shake=3;beep("hit");
     if(lives===1){
      warningLife=2.25;warningBeepDelay=.15;warningChirp=0;
     }
     message="IMPACT !";messageLife=1.05;burst(angle,"#ff5caa",23);
     if(lives<=0){gameOver();break;}
    }else{
     const near=!w.cleared&&nearMiss(angle,w);
     combo++;const multiplier=Math.min(4,1+Math.floor(combo/5));
     const bonus=(near?90:50)*multiplier;
     score+=bonus*scoreMultiplier;
     if(near){message="NEAR MISS +"+bonus;messageLife=.8;beep("pass");}
     else if(combo%5===0){message="COMBO ×"+multiplier;messageLife=.75;}
     if(passed%4===0){pulseCharge=Math.min(3,pulseCharge+1);beep("collect");}
    }
   }
  }
  waves=waves.filter(w=>w.z>-.8);
  sparks.forEach(p=>{p.a+=p.va*dt;p.z+=p.vz*dt;p.life-=dt;});
  sparks=sparks.filter(p=>p.life>0);
  if(score>best){
   best=Math.floor(score);
   bestSaveTimer+=dt;
   // Do not synchronously write localStorage on every animation frame.
   if(bestSaveTimer>=1.5){save("best."+selectedLevel.id,best);bestSaveTimer=0;}
  }
  hudTimer+=dt;
  if(hudTimer>=.09){hudTimer=0;renderHud();}
 }
 function point(theta,z){
  return wallPoint(theta,z);
 }
 function wallGeom(){return geometryCache;}
 const bendCache=new Map();
 // Distance-driven course director: the opening is calm, then each stretch
 // becomes less predictable with more bends and fewer straight sections.
 // Events are deterministic, and all bends have zero slope at both ends.
 const TRACK_STRETCH=155;
 const bendProfiles=new Map();
 function hashTrack(n){
  n=Math.imul(n^0x45d9f3b,0x45d9f3b);
  n=Math.imul(n^(n>>>16),0x45d9f3b);
  return ((n^(n>>>16))>>>0)/4294967296;
 }
 function trackDifficulty(cell){
  if(cell===0)return{stage:0,count:1,amplitude:.42,label:"DÉPART"};
  if(cell===1)return{stage:1,count:1,amplitude:.63,label:"ÉCHAUFFEMENT"};
  if(cell===2)return{stage:2,count:1,amplitude:.92,label:"COURBES"};
  if(cell<=4)return{stage:3,count:2,amplitude:1.07,label:"ENCHAÎNEMENTS"};
  if(cell<=6)return{stage:4,count:3,amplitude:1.20,label:"SÉRIEUX"};
  return{stage:5,count:4,amplitude:1.33,label:"CHAOS"};
 }
 function trackProfile(cell){
  if(bendProfiles.has(cell))return bendProfiles.get(cell);
  const difficulty=trackDifficulty(cell),events=[];
  const count=difficulty.count;
  for(let i=0;i<count;i++){
   // One smooth pulse per slot: wide gaps early, tightly packed curves late.
   const slot=TRACK_STRETCH/count;
   const duration=(cell===0?32:count===1?43:count===2?31:count===3?28:25)+
     hashTrack(cell*131+i*17+29)*(cell===0?4:count===1?11:count===2?8:count===3?6:5);
   // First 18 seconds or so are straight, then one mild introductory
   // curve. Later bends progressively fill more of each segment.
   const start=cell===0?77+hashTrack(11)*8:
     i*slot+(slot-duration)*(.42+hashTrack(cell*43+i*61+11)*.16);
   const mix=hashTrack(cell*19+i*71+19),pace=hashTrack(cell*37+i*83+93);
   const motif=((cell+i*3)%6+6)%6;
   let ax=0,ay=0;
   if(motif===0){ax=W*(.18+mix*.06);ay=H*(.025+pace*.025);}
   else if(motif===1){ax=-W*(.035+pace*.055);ay=-H*(.265+mix*.07);}
   else if(motif===2){ax=-W*(.18+mix*.065);ay=H*(pace-.5)*.1;}
   else if(motif===3){ax=W*(pace-.5)*.15;ay=H*(.27+mix*.07);}
   else if(motif===4){ax=W*(.12+mix*.04);ay=-H*(.11+pace*.09);}
   else {ax=-W*(.11+pace*.06);ay=H*(.10+mix*.09);}
   events.push({start,duration,ax:ax*difficulty.amplitude,
    ay:ay*difficulty.amplitude,motif});
  }
  const profile={...difficulty,events,stretch:TRACK_STRETCH};
  bendProfiles.set(cell,profile);return profile;
 }
 function trackCenter(position){
  const world=Math.max(0,position);
  const cell=Math.floor(world/TRACK_STRETCH);
  const local=world-cell*TRACK_STRETCH,events=trackProfile(cell).events;
  let x=0,y=0;
  for(const e of events){
   const t=(local-e.start)/e.duration;
   if(t<=0||t>=1)continue;
   // Quintic ease on both ends: camera has no kink entering or leaving.
   const u=t<.5?t*2:(1-t)*2;
   const smooth=u*u*u*(u*(u*6-15)+10);
   x+=e.ax*smooth;y+=e.ay*smooth;
  }
  return{x,y};
 }
 // Render relative to the player's position along the world-space track,
 // not as independent per-frame sine waves. Both wall and hazards use it.
 function tunnelBend(z){
  z=Math.max(0,z);
  const cached=bendCache.get(z);if(cached)return cached;
  const p=trackCenter(travel+z),origin=trackCenter(travel);
  const amount=1-Math.exp(-z*.16);
  const offset={x:(p.x-origin.x)*amount,y:(p.y-origin.y)*amount};
  bendCache.set(z,offset);
  return offset;
 }
 function wallPoint(theta,z,shift){
  const g=geometryCache,r=g.R/(1+Math.max(0,z)*.68);
  const bend=shift||tunnelBend(z);
  return{x:g.cx+bend.x+Math.cos(theta)*r,
    y:g.cy+bend.y+(Math.sin(theta)-g.offset)*r,r};
 }
 function revealOpacity(z){
  const t=clamp((SPAWN_Z-z)/APPEAR_FADE_DEPTH,0,1);
  return t*t*(3-2*t);
 }
 function screenAngle(worldAngle){return worldAngle-angle+PI/2;}
 // A lightweight PS2-era techno tunnel: dark segmented metal plates, glowing
 // magenta hoops, cyan energy conduits and animated wall LEDs. Every surface
 // uses wallPoint(z), the *same* cylinder as the actual obstacle geometry.
 function wallPatch(a0,a1,z0,z1,fill,stroke,steps){
  // Direct canvas path: no arrays (near/far) allocated for each tile.
  const n=steps||2,da=(a1-a0)/n;
  const b0=tunnelBend(z0),b1=tunnelBend(z1);
  c.beginPath();
  for(let k=0;k<=n;k++){
   const p=wallPoint(a0+da*k,z0,b0);
   if(k)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);
  }
  for(let k=n;k>=0;k--){
   const p=wallPoint(a0+da*k,z1,b1);c.lineTo(p.x,p.y);
  }
  c.closePath();c.fillStyle=fill;c.fill();
  if(stroke){c.strokeStyle=stroke;c.lineWidth=.6;c.stroke();}
 }
 function drawRing(z,index){
  if(z<0||z>RENDER_FAR_Z)return;
  const g=geometryCache,r=wallPoint(0,z).r,shift=tunnelBend(z);
  const near=clamp(1-z/RENDER_FAR_Z,0,1),cyan=index%5===0;
  // Controlled changes of the line itself, not a fat bloom filter.
  const beat=clamp(audioFx.kick*.65+audioFx.bass*.35,0,1);
  const high=clamp(audioFx.high,0,1);
  c.beginPath();c.arc(g.cx+shift.x,g.cy+shift.y-g.offset*r,r,0,TAU);
  c.strokeStyle=cyan?
   "rgba(111,239,255,"+clamp(.32+.54*near+high*.12,0,.97)+")":
   "rgba(255,62,209,"+clamp(.25+.53*near+beat*.18,0,.97)+")";
  c.lineWidth=(cyan?1.7:1.2)+near*(cyan?1.6:1.1)+beat*1.1;
  c.shadowColor=cyan?"#50f6ff":"#ff35d5";
  c.shadowBlur=cyan?2:0;c.stroke();c.shadowBlur=0;
 }
 function drawTunnel(now){
  const g=wallGeom();
  bendCache.clear();
  c.fillStyle="#05020a";c.fillRect(0,0,W,H);
  const vanishing=tunnelBend(RENDER_FAR_Z);
  const gradient=c.createRadialGradient(g.cx+vanishing.x,g.cy+vanishing.y,3,g.cx,g.cy,g.R*1.35);
  gradient.addColorStop(0,"#0b0619");
  gradient.addColorStop(.4,"#0e071b");
  gradient.addColorStop(.81,"#1b0a24");
  gradient.addColorStop(1,"#05020b");
  c.fillStyle=gradient;c.fillRect(0,0,W,H);
  c.save();c.lineCap="round";c.lineJoin="round";
  // An indigo panel skin follows the camera's angular roll. The panels move
  // at exactly the same world speed as the neon hoops and the obstacle walls.
  const panelLength=.81,panelOffset=(mode==="menu"?(now*.0016):travel)%panelLength;
  const panelRows=Math.ceil(RENDER_FAR_Z/panelLength)+1;
  for(let row=panelRows;row>=0;row--){
   const z=row*panelLength-panelOffset;
   if(z<0||z>RENDER_FAR_Z)continue;
   const fade=clamp(1-z/RENDER_FAR_Z,0,1);
   const bassLight=clamp(audioFx.bass*.13+audioFx.kick*.1,0,.23);
   const highLight=clamp(audioFx.high*.48,0,.48);
   // LOD: distant plates span two sectors. Keep close-up seams at full
   // resolution while cutting geometry cost in the extended distance.
   const sectorStep=z>15?2:1;
   for(let sector=0;sector<SECTORS;sector+=sectorStep){
    const a=screenAngle(sector*STEP),b=a+sectorStep*STEP;
    const fill=(sector+row)%4===0?"rgba(107,30,113,"+(.37+bassLight)+")":
      (sector+row)%2?"rgba(44,16,62,"+(.48+bassLight*.55)+")":
      "rgba(67,18,79,"+(.43+bassLight*.8)+")";
    wallPatch(a+.006,b-.006,z,z+panelLength,fill,
      row<5&&sector%4===0?"rgba(180,76,195,.12)":null,row<5?2:1);
    // Treble-driven cyan bands are painted onto the tunnel itself.
    if(row%3===1&&sector%4===2&&z<RENDER_FAR_Z*.75){
     wallPatch(a+.09,b-.09,z+.19,z+.25,
      "rgba(107,241,255,"+(.12+highLight)+")",null,1);
    }
    // Tiny luminous rivets flash toward the camera along with the wall.
    if(row%3===0&&sector%4===1&&z<RENDER_FAR_Z*.75){
     const p=wallPoint((a+b)*.5,z+.28);
     c.fillStyle="rgba(248,73,226,"+clamp(.24+.5*fade+highLight*.65,0,.9)+")";
     c.beginPath();c.arc(p.x,p.y,Math.max(.8,2.5*fade),0,TAU);c.fill();
    }
   }
  }
  // Industrial radial rails: structural shadow first, phosphor trace on top.
  for(let i=0;i<24;i++){
   const a=screenAngle(i*TAU/24);
   const near=wallPoint(a,.04);
   const cyan=i%4===0;
   c.beginPath();c.moveTo(near.x,near.y);
   // Long rails curve through every bend, not straight to the old pupil.
   for(let step=1;step<=24;step++){
    const z=(RENDER_FAR_Z+.35)*step/24,pt=wallPoint(a,z);
    c.lineTo(pt.x,pt.y);
   }
   c.strokeStyle=cyan?"rgba(65,218,246,.13)":"rgba(253,75,210,.1)";
   c.lineWidth=cyan?9:5;c.shadowBlur=0;c.stroke();
   c.strokeStyle=cyan?"rgba(109,240,255,"+clamp(.72+audioFx.high*.28,0,1)+")":
                           "rgba(210,76,237,"+clamp(.43+audioFx.mid*.36,0,1)+")";
   c.lineWidth=(cyan?2.4:1.4)+audioFx.high*(cyan?.8:.5)+audioFx.kick*.35;
   c.shadowColor=cyan?"#48eefe":"#ff48c6";
   c.shadowBlur=cyan?2:0;
   c.stroke();c.shadowBlur=0;
  }
  const spacing=.48;
  const phase=(mode==="menu"?(now*.0016):travel)%spacing;
  const ringCount=Math.ceil(RENDER_FAR_Z/spacing)+1;
  for(let i=ringCount;i>=0;i--)drawRing(i*spacing-phase,i);
  c.restore();
  if(turboLight>.005){
   c.fillStyle="rgba(187,117,238,"+(turboLight*.092)+")";
   c.fillRect(0,0,W,H);
  }
  // Deep indigo pupil, feathered rather than a flat black pasted circle.
  const core=c.createRadialGradient(g.cx+vanishing.x,g.cy+vanishing.y,0,
   g.cx+vanishing.x,g.cy+vanishing.y,g.R*.17);
  core.addColorStop(0,"rgba(8,1,17,.9)");
  core.addColorStop(1,"rgba(8,1,17,0)");
  c.fillStyle=core;
  c.fillRect(g.cx+vanishing.x-g.R*.2,g.cy+vanishing.y-g.R*.2,g.R*.4,g.R*.4);
  // Physically small, music-driven phosphor strips instead of a blurred
  // full-screen radial gradient. Kicks pulse pink, treble cyan.
  const kick=clamp(audioFx.kick*.65+audioFx.bass*.3,0,1);
  const treble=clamp(audioFx.high*.8,0,.8);
  if(kick>.12||treble>.12){
   for(let i=0;i<8;i++){
    const a=screenAngle(i*TAU/8+.11),z=1.7+(i%3)*1.12;
    const amount=i%2===0?kick:treble;
    if(amount<.13)continue;
    wallPatch(a,a+STEP*.67,z,z+.10+amount*.30,
     i%2===0?
      "rgba(255,112,225,"+(.17+amount*.58)+")":
      "rgba(110,246,255,"+(.17+amount*.55)+")",null,1);
   }
  }
 }
 function drawWave(w){
  if(w.cleared||w.z>RENDER_FAR_Z||w.z<-.40)return;
  const reveal=revealOpacity(w.z);
  if(reveal<.003)return;
  // Fade in from the distance without popping at the creation position.
  c.save();c.globalAlpha*=reveal;c.lineJoin="round";
  for(const id of w.sectors){
   // Draw EXACTLY the rotation used by collisionAt, including moving gates.
   const rot=w.rotation||0;
   const a=screenAngle(id*STEP+rot)+.013,b=screenAngle((id+1)*STEP+rot)-.013;
   const z=Math.max(.04,w.z),far=z+w.length;
   // Distinct material families help players identify gate silhouettes.
   const skin=w.kind%4;
   const skinFill=skin===0?"#ef3a5c":skin===1?"#d9267b":
     skin===2?"#eb493d":"#a52ed2";
   const skinEdge=skin===0?"#ffb19c":skin===1?"#ffc1de":
     skin===2?"#ffe4aa":"#eb96ff";
   c.shadowColor=skin===3?"#db4aff":"#ff4e82";c.shadowBlur=2;
   wallPatch(a,b,z,far,skinFill,skinEdge,6);
   c.shadowBlur=0;
   // Pale amber warning edge separates dangerous gates from pink wall trim.
   const q0=wallPoint(a+.025,z+.035),q1=wallPoint(b-.025,z+.035);
   c.beginPath();c.moveTo(q0.x,q0.y);c.lineTo(q1.x,q1.y);
   c.strokeStyle="rgba(255,226,173,.88)";c.lineWidth=1.35;
   c.shadowBlur=0;c.stroke();
  }
  c.restore();
 }
 // Shield collectible attached to the same bent tube as every obstacle.
 function drawShieldPickup(pickup){
  if(pickup.credited||pickup.z>RENDER_FAR_Z||pickup.z<-.45)return;
  const alpha=revealOpacity(pickup.z);if(alpha<.003)return;
  const a=screenAngle((pickup.sectors[0]+1)*STEP);
  const pos=wallPoint(a,Math.max(0,pickup.z));
  const size=clamp(pos.r*.22,3.6,47),glow=.78+.22*Math.sin(elapsed*7+pickup.shimmer);
  c.save();c.globalAlpha*=alpha;c.translate(pos.x,pos.y);
  c.shadowColor="#66ffe2";c.shadowBlur=9*glow;
  c.fillStyle="rgba(6,51,58,.74)";c.strokeStyle="#9fffe4";
  c.lineWidth=Math.max(.9,size*.095);
  c.beginPath();c.moveTo(0,-size);
  c.lineTo(size*.77,-size*.66);c.lineTo(size*.65,size*.34);
  c.quadraticCurveTo(0,size*1.15,0,size*1.22);
  c.quadraticCurveTo(-size*.65,size*.42,-size*.65,size*.34);
  c.lineTo(-size*.77,-size*.66);c.closePath();c.fill();c.stroke();
  c.shadowBlur=0;c.lineWidth=Math.max(.7,size*.085);
  c.strokeStyle="#fff1ae";c.beginPath();
  c.moveTo(-size*.38,-size*.04);c.lineTo(-size*.07,size*.32);
  c.lineTo(size*.43,-size*.4);c.stroke();
  c.restore();
 }
 function drawPad(pad){
  if(pad.z>RENDER_FAR_Z||pad.z<-.45||pad.credited)return;
  const reveal=revealOpacity(pad.z);
  if(reveal<.003)return;
  c.save();c.globalAlpha*=reveal;c.lineJoin="round";c.lineCap="round";
  const near=Math.max(.04,pad.z),far=near+pad.length;
  const pulse=.74+.26*Math.sin(elapsed*13+near);
  for(const id of pad.sectors){
   const a=screenAngle(id*STEP)+.016,b=screenAngle((id+1)*STEP)-.016;
   c.shadowColor="#3af6ff";c.shadowBlur=3;
   wallPatch(a,b,near,far,
     "rgba(20,184,221,"+clamp(.66+pulse*.28,0,1)+")",
     "#dbfcff",5);
   const mid=(a+b)*.5,span=(b-a)*.25;
   for(let k=0;k<2;k++){
    const z=near+.18+k*.39;
    const p0=wallPoint(mid-span,z),pc=wallPoint(mid,z+.24),
          p1=wallPoint(mid+span,z);
    c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(pc.x,pc.y);c.lineTo(p1.x,p1.y);
    c.lineWidth=2.8;c.strokeStyle="#fff9a9";
    c.shadowBlur=0;c.stroke();
   }
  }
  c.restore();
 }
 function drawShip(){
  if(!shipReady.idle&&!shipReady.boost)return;
  const sprite=shipReady.idle?shipSprites.idle:shipSprites.boost;
  const iw=sprite.naturalWidth,ih=sprite.naturalHeight;
  if(!iw||!ih)return;
  // Fit the full silhouette, including thruster tips, inside the screen.
  // Cap the height to preserve visibility of incoming hazards.
  const scale=Math.min(W*.88/iw,H*.46/ih);
  const dw=iw*scale,dh=ih*scale;
  const steer=clamp(turnVelocity/3.50,-1,1);
  const bob=mode==="running"?
    Math.sin(elapsed*14)*Math.min(1.2,currentSpeed*.15)+audioFx.kick*1.2:0;
  c.save();
  c.translate(W*.5-steer*Math.min(W*.014,9),H+2+bob);
  c.rotate(-steer*.023);
  c.imageSmoothingEnabled=false; // Crisp retro pixels.
  if(shipReady.idle)c.drawImage(shipSprites.idle,-dw*.5,-dh,dw,dh);
  if(shipReady.boost){
   c.globalAlpha=shipReady.idle?shipBoostFade:1;
   if(c.globalAlpha>.005)c.drawImage(featheredBoost||shipSprites.boost,-dw*.5,-dh,dw,dh);
  }
  c.restore();
 }
 function drawPulseWave(){
  // Ship replaces the persistent curved aiming arc + cyan triangle.
  // Only the temporary pulse shockwave remains.
  if(pulseGlow<=0)return;
  const g=wallGeom(),p=wallPoint(PI/2,HIT_Z);
  c.save();c.beginPath();c.arc(g.cx,g.cy,p.r+(1-pulseGlow)*W*.3,0,TAU);
  c.lineWidth=3;c.strokeStyle="rgba(99,245,255,"+(pulseGlow*1.6)+")";
  c.stroke();c.restore();
 }
 function paint(now){
  if(!live||!root.isConnected)return;
  c.setTransform(renderDpr,0,0,renderDpr,0,0);c.clearRect(0,0,W,H);
  c.save();
  if(shake>0)c.translate(rand(-shake,shake),rand(-shake,shake));
  drawTunnel(now);
  // Newest waves/pads are already the farthest; no per-frame copies or sort.
  for(let i=pads.length-1;i>=0;i--)drawPad(pads[i]);
  for(let i=shields.length-1;i>=0;i--)drawShieldPickup(shields[i]);
  for(let i=waves.length-1;i>=0;i--)drawWave(waves[i]);
  c.restore();
  for(const p of sparks){
   const t=wallPoint(screenAngle(p.a),p.z);
   c.globalAlpha=clamp(p.life/p.max,0,1);
   c.fillStyle=p.color;c.fillRect(t.x-2,t.y-2,4,4);
  }
  c.globalAlpha=1;
  drawPulseWave();
  drawShip(); // Ship is now the only permanent POV marker.
  if(flash>0){
   c.fillStyle="rgba(255,70,143,"+(flash*.23)+")";c.fillRect(0,0,W,H);
  }
 }
 function frameTick(now){
  if(!live)return;
  raf=requestAnimationFrame(frameTick);
  const dt=last?clamp((now-last)/1000,0,.07):0;last=now;
  const parent=root.closest(".window");
  if(document.hidden||parent&&parent.classList.contains("minimized")){
   if(mode==="running")togglePause();
   return;
  }
  if(mode==="running")advance(dt);
  advanceDeathSequence(dt);
  tickEngine(dt);
  tickBoostLoop(dt);
  const turbo=mode==="running"&&(nitroActive||padBoostTime>0)?1:0;
  if(turbo){shipBoostFade=1;turboLight=1;}
  else{
   shipBoostFade*=Math.exp(-dt*10);
   turboLight*=Math.exp(-dt*5.8);
   if(shipBoostFade<.002)shipBoostFade=0;
   if(turboLight<.002)turboLight=0;
  }
  sampleMusic(dt);paint(now);
 }
 function keyDown(e){
  if(!live||document.hidden||e.altKey||e.ctrlKey||e.metaKey)return;
  const parent=root.closest(".window");
  if(parent&&(!parent.classList.contains("focused")||parent.classList.contains("minimized")))return;
  if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable)return;
  if(mode==="crashing"||(mode==="over"&&deathLock>0)){e.preventDefault();return;}
  // Native buttons handle their own Enter/Space; no double activation.
  if((e.key==="Enter"||e.key===" ")&&e.target.closest&&e.target.closest(".er-pad button, .er-overlay button"))return;
  const k=e.key.toLowerCase(),control={
   arrowleft:"left",a:"left",arrowright:"right",d:"right",
   arrowup:"up",w:"up",arrowdown:"down",s:"down"
  };
  const dir=control[k];
  if(mode==="menu"){
   if(menuStage==="levels"&&/^[1-5]$/.test(k)){
    e.preventDefault();if(e.repeat)return;
    menuIndex=Number(k)-1;confirmLevel();return;
   }
   if(dir){e.preventDefault();if(!e.repeat){
    if(menuStage==="home")showLevelSelect();else controllerInput(dir);
   }return;}
   if(k==="enter"||k===" "||k==="q"){e.preventDefault();if(!e.repeat){
    if(menuStage==="home")showLevelSelect();else confirmLevel();
   }return;}
   if(k==="escape"||k==="backspace"){e.preventDefault();if(!e.repeat)renderMenuStage("home");return;}
   return;
  }
  if(mode==="paused"||mode==="over"){
   if(dir){e.preventDefault();if(!e.repeat)controllerInput(dir);return;}
   if(k==="enter"||k==="q"||k===" "){e.preventDefault();if(!e.repeat)controllerInput("pulse");return;}
   if(k==="escape"||k==="backspace"){e.preventDefault();if(!e.repeat)controllerInput("boost");return;}
   if(k==="p"&&mode==="paused"){e.preventDefault();if(!e.repeat)togglePause();return;}
  }
  if(dir){e.preventDefault();if(mode==="running")keys.add(dir);return;}
  if(k==="enter"||k===" "||k==="q"||k==="p"||k==="escape"){
   e.preventDefault();if(e.repeat)return;
   if(k==="p"||k==="escape"){togglePause();return;}
   if(k===" ")beginNitro();
   else if(k==="q")pulse();
  }
 }
 function keyUp(e){
  const map={arrowleft:"left",a:"left",arrowright:"right",d:"right",arrowup:"up",w:"up",arrowdown:"down",s:"down"};
  const k=e.key.toLowerCase();
  if(k===" ")endNitro();
  if(map[k])keys.delete(map[k]);
 }
 function boardDown(e){
  if(mode==="crashing"||(mode==="over"&&deathLock>0))return;
  if(e.button!==undefined&&e.button!==0)return;
  if(e.target.closest&&e.target.closest("button"))return;
  if(mode!=="running"){
   // Mobile screen is a display: menu navigation belongs to the controller.
   if(e.pointerType==="touch"||e.pointerType==="pen")return;
   if(mode==="menu"&&menuStage==="home")showLevelSelect();
   return;
  }
  if(e.pointerType!=="touch"&&e.pointerType!=="pen")return;
  dragPointer=e.pointerId;dragX=e.clientX;
  dragLastTs=Number(e.timeStamp)||Date.now();dragVelocity=0;
  try{screen.setPointerCapture(e.pointerId);}catch(_){}
 }
 function boardMove(e){
  if(dragPointer!==e.pointerId||mode!=="running")return;
  const bounds=canvas.getBoundingClientRect();
  if(!bounds.width)return;
  // Horizontal swipe = orbital rotation, no teleporting inside the circle.
  const dx=clamp(e.clientX-dragX,-bounds.width*.25,bounds.width*.25);
  const delta=-dx/bounds.width*TAU*1.0;
  const stamp=Number(e.timeStamp)||Date.now();
  const sec=clamp((stamp-dragLastTs)/1000,.016,.12);
  dragVelocity=lerp(dragVelocity,clamp(delta/sec,-3.35,3.35),.43);
  angle=(angle+delta+TAU)%TAU;
  dragLastTs=stamp;dragX=e.clientX;
 }
 function boardUp(e){
  if(dragPointer!==e.pointerId)return;
  const stamp=Number(e.timeStamp)||Date.now();
  turnVelocity=clamp(dragVelocity*(stamp-dragLastTs>140?.28:.72),-3.15,3.15);
  dragPointer=null;dragVelocity=0;
}
 screen.addEventListener("pointerdown",boardDown);
 screen.addEventListener("pointermove",boardMove);
 screen.addEventListener("pointerup",boardUp);
 screen.addEventListener("pointercancel",boardUp);
 function onVisibility(){if(document.hidden&&mode==="running")togglePause();}
 function onBlur(){endNitro();keys.clear();}
 document.addEventListener("visibilitychange",onVisibility);
 window.addEventListener("blur",onBlur);
 overlayButton.onclick=function(){
  if(mode==="paused")togglePause();
  else if(mode==="menu")showLevelSelect();
  else start();
 };
 document.addEventListener("keydown",keyDown);
 document.addEventListener("keyup",keyUp);
 function dispose(){
  live=false;cancelAnimationFrame(raf);keys.clear();
  stopMusic();
  document.removeEventListener("visibilitychange",onVisibility);
  window.removeEventListener("blur",onBlur);
  document.removeEventListener("keydown",keyDown);
  document.removeEventListener("keyup",keyUp);
  if(ro){ro.disconnect();ro=null;}else window.removeEventListener("resize",fitCanvas);
  if(musicSource)try{musicSource.disconnect();}catch(_){}
  if(musicAnalyser)try{musicAnalyser.disconnect();}catch(_){}
  if(musicGain)try{musicGain.disconnect();}catch(_){}
  if(musicLimiter)try{musicLimiter.disconnect();}catch(_){}
  if(music){music.onerror=null;try{music.removeAttribute("src");music.load();}catch(_){}}
  stopBoostSource();boostBuffer=null;boostLoad=null;
  for(const sound of [flySound,boostSound]){
   if(sound)try{sound.pause();sound.removeAttribute("src");sound.load();}catch(_){}
  }
  flySound=null;boostSound=null;
  for(const state of ["idle","boost"]){
   shipSprites[state].onload=shipSprites[state].onerror=null;
   shipSprites[state].removeAttribute("src");
   shipReady[state]=false;
  }
  featheredBoost=null;
  music=null;musicSource=null;musicAnalyser=null;musicBins=null;musicGain=null;musicLimiter=null;
  if(audioCtx)try{const p=audioCtx.close();if(p&&p.catch)p.catch(()=>{});}catch(_){}
  root._echoDebug=null;
 }
 root._zebraDispose=dispose;
 root._echoDebug={
  snapshot:()=>({mode,angle,turnVelocity,lives,score,best,distance,travel,passed,combo,pulseCharge,music:{loaded:!!music,paused:music?music.paused:true,source:music?music.src:null,reactive:{bass:audioFx.bass,mid:audioFx.mid,high:audioFx.high,kick:audioFx.kick,energy:audioFx.energy},error:musicError},canvas:{width:W,height:H},gateCount,nextGateAt,waves:waves.map(w=>({z:w.z,kind:w.kind,cleared:w.cleared,credited:w.credited,sectors:[...w.sectors],rotation:w.rotation,spin:w.spin,twist:w.twist})),pads:pads.map(p=>({z:p.z,sectors:[...p.sectors],credited:p.credited})),padBoostTime,currentSpeed,scoreMultiplier,gateCount,padCount}),
  advance:advance,start:start,pulse:pulse,boost:beginNitro,endBoost:endNitro,menu:toMenu,pause:togglePause,
  ship:()=>({idleLoaded:shipReady.idle,boostLoaded:shipReady.boost,boostMix:shipBoostFade,tunnelLight:turboLight}),
  level:()=>({id:selectedLevel.id,free:selectedLevel.id==="free",gap:selectedLevel.gap}),
  gauges:()=>({speed:Math.round(currentSpeed*25),charge:selectedLevel.id==="free"?1:nitroFuel,boosting:nitroActive||padBoostTime>0,
   held:nitroHeld,manualBoost:nitroActive,burnTime:nitroBurnTime,regenWait:nitroRegenWait}),
  engineAudio:()=>({flyLoaded:!!flySound,boostLoaded:!!boostSound,
   flyPlaying:!!flySound&&!flySound.paused,boostPlaying:!!boostSound&&!boostSound.paused,
   flyVolume:flySound?flySound.volume:0,boostVolume:boostOutput?boostOutput.gain.value:boostSound?boostSound.volume:0,
   boostGain,boostLoop:!!boostSource||!!boostSound&&boostSound.loop,
   sampleAccurate:!!boostSource,bufferLoaded:!!boostBuffer,flyFade}),
  tickAudio:tickBoostLoop,
  selectLevel:(id)=>{
   if(mode!=="menu")return false;
   const level=LEVELS.find(x=>x.id===id);if(!level)return false;
   selectedLevel=level;save("level",id);
   best=Number(load("best."+id,id==="3"?load("best","0"):"0"))||0;
   renderHud();return true;
  },
  stage:()=>menuStage,menuSelection:()=>({index:menuIndex,id:LEVELS[menuIndex].id,pauseIndex,overIndex}),controller:controllerInput,openLevels:showLevelSelect,
  pauseMenu:()=>({visible:!pauseActions.hidden,mode,stage:overlay.classList.contains("er-stage-pause"),soundLabel:pauseSound.textContent}),
  warning:()=>({life:warningLife,beepDelay:warningBeepDelay,visible:!warningLayer.hidden}),
  deathSequence:()=>({phase:mode,blackoutTime:deathFade,lockTime:deathLock,
   curtainVisible:!crashCurtain.hidden,curtainOpacity:crashCurtain.style.opacity,
   locked:root.classList.contains("er-death-locked"),
   restartDisabled:restartButton.disabled,menuDisabled:menuButton.disabled}),
  tickDeath:advanceDeathSequence,
  simulateHit:()=>{
   if(mode!=="running")return;
   lives=Math.max(0,lives-1);invuln=1.35;flash=.47;shake=3;
   if(lives===1){warningLife=2.25;warningBeepDelay=.15;warningChirp=0;}
   if(lives===0)gameOver();
   renderHud();
  },
  death:()=>({active:screen.classList.contains("er-death"),overlay:overlay.classList.contains("er-stage-over"),icon:!crashIcon.hidden,title:logo.textContent}),
  viewDistance:()=>({far:RENDER_FAR_Z,spawn:SPAWN_Z,hit:HIT_Z,
   fadeDistance:APPEAR_FADE_DEPTH,
   ringCount:Math.ceil(RENDER_FAR_Z/.48)+1,panelRows:Math.ceil(RENDER_FAR_Z/.81)+1}),
  bendAt:(z)=>({...tunnelBend(z)}),revealOpacity,
  trackAt:(world)=>({...trackCenter(world)}),
  trackInfo:(world)=>{
   const cell=Math.floor(Math.max(0,world)/TRACK_STRETCH);
   return{cell,...trackProfile(cell)};
  },
  setTestTravel:(world)=>{travel=Math.max(0,world);bendCache.clear();},
  pickups:()=>shields.map(p=>({z:p.z,sectors:[...p.sectors],credited:p.credited})),
  addTestShield:(z,sector=0)=>{
   if(mode!=="running")return false;
   const id=((sector%SECTORS)+SECTORS)%SECTORS;
   shields.push({z,sectors:[id,(id+1)%SECTORS],credited:false,shimmer:0});
   return true;
  },
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