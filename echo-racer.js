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
const PATTERN_COUNT=28;
// Four distinct campaign levels; Free Roam remains diagnostic-only.
const LEVELS=[
 {id:"run",name:"SIGNAL",subtitle:"LE PREMIER TUNNEL",speed:1,gap:1,arcade:true,
  duration:105,track:"p1",musicAt:0,motion:0,patterns:[0,1,3,7,10,13],
  colors:{colorMain:"#ff3ed1",colorAccent:"#74efff",colorPanels:"#6b1e71",colorBackdrop:"#0b0619",colorHazard:"#ef3a5c"}},
 {id:"l2",name:"NÉON",subtitle:"PORTES MOBILES",speed:1.07,gap:.97,arcade:true,
  duration:101,track:"p1",musicAt:106,motion:1,patterns:[1,4,6,7,9,12,15,17,19,21],
  colors:{colorMain:"#24f0da",colorAccent:"#fa74e7",colorPanels:"#105c64",colorBackdrop:"#04151c",colorHazard:"#fe8d4c"}},
 {id:"l3",name:"MIRAGE",subtitle:"MURS OSCILLANTS",speed:1.13,gap:.95,arcade:true,
  duration:108,track:"p3",musicAt:0,motion:2,patterns:[2,5,8,11,14,18,20,22,23,25],
  colors:{colorMain:"#86a1ff",colorAccent:"#fc86f0",colorPanels:"#343b92",colorBackdrop:"#080c25",colorHazard:"#ff6dba"}},
 {id:"l4",name:"HYPERDRIVE",subtitle:"OBSTACLES QUI AVANCENT",speed:1.19,gap:.93,arcade:true,
  duration:103,track:"p3",musicAt:56,motion:3,patterns:[3,8,9,14,17,19,21,23,24,26,27],
  colors:{colorMain:"#ffc46c",colorAccent:"#6ffff3",colorPanels:"#854131",colorBackdrop:"#1b0913",colorHazard:"#ff486f"}},
 {id:"free",name:"FREE ROAM",subtitle:"DIAGNOSTIC SANS OBSTACLES",speed:1,gap:1,spin:0,patterns:[]}
];
const CAMPAIGN=LEVELS.slice(0,4);
const MUSIC_DROP_AT=68,MUSIC_SECOND_DROP_AT=162,MUSIC_TAIL_AT=217,MUSIC_LOOP_FROM=68;
const ENCORE_TRANSITION_SECONDS=5;
// Distances are in world units. Short double-gates punctuate longer stretches.
const GAP_MIN=15.2,GAP_MAX=21.4,START_GATE_AT=.48;
// A separate rhythm of collectible wall pads between the hazard waves.
const PAD_START=7.2,PAD_GAP_MIN=33,PAD_GAP_MAX=47;
const SHIELD_START=34,SHIELD_GAP_MIN=51,SHIELD_GAP_MAX=77;
const SHIELD_RARE_MIN=96,SHIELD_RARE_MAX=135;
const PICKUP_FRONT=1.05,PICKUP_BACK=.85,PAD_SIDE=STEP*.29,SHIELD_SIDE=STEP*.36;
const PULSE_REACH=8.4;
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
   case 15:wall=inGap(i,0,5)||inGap(i,8,4)||i===14;break;
   case 16:wall=!inGap(i,0,4)&&!inGap(i,8,3);break;   // twin offset windows
   case 17:wall=(i%6)<4;break;                         // broken teeth
   case 18:wall=inGap(i,0,10)&&i%3!==1;break;          // open-side grating
   case 19:wall=!inGap(i,0,2)&&!inGap(i,5,3)&&!inGap(i,11,2);break;
   case 20:wall=!inGap(i,1,4)&&!inGap(i,9,3);break;  // opposite offset gates
   case 21:wall=(i%4)<3&&i!==7&&i!==15;break;        // broken laser lattice
   case 22:wall=inGap(i,0,8)||inGap(i,11,3);break;    // long asymmetric dam
   case 23:wall=!inGap(i,0,2)&&!inGap(i,6,4)&&!inGap(i,13,2);break;
   case 24:wall=(i%6)<=2&&i!==6;break;                // interrupted spines
   case 25:wall=!inGap(i,1,5)&&!inGap(i,9,4);break;   // two wide staggered exits
   case 26:wall=(i%8)<6&&i!==4;break;                 // narrow parallel channels
   case 27:wall=inGap(i,0,6)||inGap(i,10,5);break;    // split shield wall
   default:wall=false;
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
function pickupContact(angle,pickup,margin){
 return pickup.sectors.some(i=>Math.abs(angularDelta(angle,obstacleAngle(pickup,i)))<=STEP*.5+margin);
}
function pickupDepth(oldZ,newZ,length=0){
 return oldZ+length>=HIT_Z-PICKUP_BACK&&newZ<=HIT_Z+PICKUP_FRONT;
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
 let selectedLevel=LEVELS[0];
 let unlockedLevel=clamp(Math.floor(Number(load("campaign.unlocked.v1","1")))||1,1,4);
 let completedLevels=clamp(Math.floor(Number(load("campaign.completed.v1","0")))||0,0,4);
 let angle=0,turnVelocity=0,lives=MAX_LIVES,score=0;
 let best=Number(load("best.run",load("best.3",load("best","0"))))||0;
 let distance=0,travel=0,passed=0,combo=0,waves=[],pads=[],shields=[],
  nextGateAt=START_GATE_AT,nextPadAt=PAD_START,nextShieldAt=SHIELD_START,
  lastGateAt=-100,trail=[],sparks=[],currentSpeed=0,gateCount=0,padCount=0,shieldCount=0,scoreMultiplier=1;
 let invuln=0,pulseCharge=2,pulseGlow=0,padBoostTime=0,pulseFx=0,pulseHitFx=0,shieldFlash=0;
 let nitroHeld=false,nitroActive=false,nitroFuel=0,nitroRegenWait=0,nitroBurnTime=0,freeChargeVisual=0;
 // Arcade risk/reward: event points stay pending until a safe cash-out.
 let skillBank=0,skillChain=0,skillMultiplier=1,skillTimer=0,skillAge=0;
 let bankedTotal=0,bankedCount=0,nearMisses=0;
 let cleanPassStreak=0,cleanBonusCount=0;
 let rewardText="",rewardKind="",rewardLife=0,nitroFullLatched=false;
 const rewardCueCounts={nitroReady:0,pulseReady:0,bank:0,chainStep:0};
 let phase3Elapsed=0,finaleTime=0,finaleCause="",finaleSelection=0;
 const FINALE_FADE_SECONDS=3.2,PHASE3_SILENT_FALLBACK=180;
 let flash=0,shake=0,elapsed=0,nextWave=0,message="",messageLife=0;
 let menuStage="home",menuIndex=0,pauseIndex=0,overIndex=0,warningLife=0,warningBeepDelay=0,warningChirp=0;
 let directorStage=0,musicDropSurge=0,musicLoops=0;
 // Five seconds without hazards: pink tunnel fades away, then reappears blue.
 let encoreMode="normal",encoreTime=0,homeIndex=0,testMode=false;
 const DEATH_FADE_SECONDS=1.15,DEATH_ANIMATION_SECONDS=1.15;
 let deathFade=0,deathLock=0;
 let soundEnabled=load("sfx","on")!=="off",audioCtx=null;
 // Dedicated Echo Racer audio system: never touch ZebraAMP or other games.
 let music=null,musicSource=null,musicAnalyser=null,musicBins=null,musicError=false;
 let musicTrackId="p1",musicRequest=0;
 // Dedicated song boost; do not alter engine SFX or ZebraAMP's audio graph.
 let musicGain=null,musicLimiter=null;
 const MUSIC_GAIN=1.9;
 const musicUrl="/assets/games/echoraccaersong.mp3?v=1";
 const musicUrlPhase3="/assets/games/echoraccersongpt2.mp3?v=1";
 // Two lightweight players independent of the music analyser.
 const flyUrl="/assets/spaceship-fly-sfx.mp3";
 const boostUrl="/assets/boostsfx.mp3?v=2";
 const FLY_VOLUME=.13,BOOST_VOLUME=.43,FLY_FADE_SECONDS=1.5;
 // The 0.967 s MP3 is already mastered to loop at its endpoints.
 const BOOST_FADE_IN_SECONDS=.11,BOOST_FADE_OUT_SECONDS=.23;
 let flySound=null,boostSound=null,flyFade=0,boostGain=0;
 let boostBuffer=null,boostSource=null,boostOutput=null,boostLoad=null,boostAudioFailed=false;
 const audioFx={bass:0,mid:0,high:0,kick:0,previousBass:0,slowBass:0,beatCooldown:0,energy:0};
 // Persistent TEST lab settings. Impact labels indicate likely rendering cost.
 const LAB_DEFAULTS={
   "baseSpeed": 6.15,
   "acceleration": 1,
   "phaseBonus": 0.62,
   "speedCap": 12.5,
   "speedRiseResponse": 6.4,
   "speedFallResponse": 0.75,
   "visualSpeed": 1.5,
   "boostPadsEnabled": true,
   "boostPadSpeed": 1.85,
   "boostPadDuration": 2.8,
   "boostPadFrequency": 1,
   "nitroStart": 1.43,
   "nitroGrowth": 0.3,
   "nitroBurnSeconds": 3.2,
   "nitroRefillSeconds": 5,
   "nitroRegenDelay": 0.45,
   "steerSpeed": 3.5,
   "steerResponse": 7.1,
   "steerReverse": 10.2,
   "steerInertia": 3.5,
   "obstacleDensity": 1,
   "obstaclesEnabled": true,
   "obstacleComplexity": 0,
   "spinRate": 1,
   "spinSpeed": 1,
   "gapMinimum": 11.5,
   "gateSize": 1,
   "obstacleFade": 7.2,
   "shieldFrequency": 1,
   "punch": 1,
   "light": 1,
   "musicSpeedInfluence": 1,
   "beatSensitivity": 1,
   "bassLight": 1,
   "trebleLight": 1,
   "lineCount": 16,
   "ringGap": 0.66,
   "panelDetail": 1,
   "railThickness": 1,
   "ringThickness": 1,
   "panelBrightness": 1,
   "backgroundBrightness": 1,
   "bendIntensity": 1,
   "verticalBend": 1,
   "bendFrequency": 1,
   "colorMain": "#ff3ed1",
   "colorAccent": "#74efff",
   "colorPanels": "#6b1e71",
   "colorBackdrop": "#0b0619",
   "colorHazard": "#ef3a5c",
   "colorPads": "#3af6ff",
   "colorShields": "#66ffe2",
   "displayScale": 25,
   "renderScale": 0.85,
   "warp": false,
   "shadows": false,
   "particles": 0.75,
   "invincible": true,
   "frameLimit": 60,
   "comboTimeout": 7.5,
   "comboCashout": 18,
   "comboEvery": 3,
   "comboMax": 12,
   "scoreClean": 65,
   "scoreNear": 150,
   "scorePulse": 225,
   "scorePad": 180,
   "scoreShield": 140,
   "rewardSfxVolume": 0.75
 };
 const LAB_META=[
  {section:"PILOTAGE & VITESSE"},
  {"id":"baseSpeed","label":"Vitesse de croisière","min":4,"max":14,"step":0.25,"unit":"u/s","cost":"JEU","help":"La vraie vitesse, même sans turbo"},
  {"id":"acceleration","label":"Progression de vitesse","min":0.2,"max":3,"step":0.1,"unit":"×","cost":"JEU","help":"Croissance avec le temps et les paliers musicaux"},
  {"id":"phaseBonus","label":"Bonus après la transition","min":0,"max":3,"step":0.05,"unit":"u/s","cost":"JEU","help":"Uniquement en phase 3","onlyPhase":"p3"},
  {"id":"speedCap","label":"Plafond de vitesse normale","min":7,"max":20,"step":0.25,"unit":"u/s","cost":"JEU","help":"Avant pads et nitro"},
  {"id":"speedRiseResponse","label":"Réactivité à l'accélération","min":1,"max":15,"step":0.25,"unit":"×","cost":"JEU","help":"Plus grand = accélération plus immédiate"},
  {"id":"speedFallResponse","label":"Freinage / retour normal","min":0.2,"max":5,"step":0.1,"unit":"×","cost":"JEU","help":"Plus grand = redescend plus vite après boost"},
  {"id":"visualSpeed","label":"Défilement du tunnel","min":0.5,"max":4,"step":0.1,"unit":"×","cost":"VISUEL","help":"Sensation de vitesse sans fausser les collisions"},
  {"id":"steerSpeed","label":"Vitesse de rotation","min":1,"max":6,"step":0.1,"unit":"rad/s","cost":"JEU","help":"Sensibilité de direction clavier/manette"},
  {"id":"steerResponse","label":"Réponse de la direction","min":1,"max":15,"step":0.25,"unit":"×","cost":"JEU","help":"Rapidité avec laquelle le vaisseau commence à tourner"},
  {"id":"steerInertia","label":"Glisse après relâchement","min":0.4,"max":10,"step":0.2,"unit":"×","cost":"JEU","help":"Bas = plus d'inertie ; haut = arrêt plus net"},
  {"id":"steerReverse","label":"Contre-braquage","min":1,"max":18,"step":0.25,"unit":"×","cost":"JEU","help":"Réponse lorsque tu inverses le sens"},
  {section:"TURBOS & BONUS"},
  {"id":"boostPadsEnabled","label":"Afficher les pads BOOST","cost":"JEU","help":"Désactivé : retire tous les pads de cette phase et annule leur accélération, sans toucher au nitro manuel","kind":"check"},
  {"id":"boostPadSpeed","label":"Puissance des pads BOOST","min":1,"max":3.5,"step":0.05,"unit":"×","cost":"JEU","help":"Multiplicateur après avoir pris un pad, pas la vitesse normale"},
  {"id":"boostPadDuration","label":"Durée d'un pad BOOST","min":0.4,"max":7,"step":0.1,"unit":"s","cost":"JEU","help":"Temps pendant lequel le pad accélère"},
  {"id":"boostPadFrequency","label":"Fréquence des pads","min":0.25,"max":3,"step":0.05,"unit":"×","cost":"JEU","help":"Plus haut = davantage de pads sur la piste"},
  {"id":"nitroStart","label":"Puissance du nitro manuel","min":1,"max":2.5,"step":0.05,"unit":"×","cost":"JEU","help":"Multiplicateur dès l'appui sur Boost"},
  {"id":"nitroGrowth","label":"Montée du nitro maintenu","min":0,"max":1.5,"step":0.05,"unit":"×","cost":"JEU","help":"Puissance gagnée en maintenant Boost"},
  {"id":"nitroBurnSeconds","label":"Autonomie du nitro","min":1,"max":10,"step":0.25,"unit":"s","cost":"JEU","help":"Temps de maintien avant jauge vide"},
  {"id":"nitroRefillSeconds","label":"Recharge du nitro","min":1,"max":14,"step":0.25,"unit":"s","cost":"JEU","help":"Temps pour recharger la jauge"},
  {"id":"nitroRegenDelay","label":"Délai avant recharge","min":0,"max":3,"step":0.05,"unit":"s","cost":"JEU","help":"Pause après avoir relâché Boost"},
  {section:"OBSTACLES & DIFFICULTÉ"},
  {"id":"obstacleDensity","label":"Densité d'obstacles","min":0.4,"max":2.5,"step":0.05,"unit":"×","cost":"JEU","help":"Plus haut = murs plus rapprochés"},
  {"id":"obstaclesEnabled","label":"Activer les obstacles","cost":"JEU","help":"Désactive la génération de murs","kind":"check"},
  {"id":"obstacleComplexity","label":"Variété des patterns","min":0,"max":3,"step":1,"unit":"niveau","cost":"JEU","help":"Débloque plus tôt les obstacles techniques"},
  {"id":"spinRate","label":"Probabilité de murs tournants","min":0,"max":3,"step":0.1,"unit":"×","cost":"JEU","help":"0 = aucun mur tournant"},
  {"id":"spinSpeed","label":"Vitesse de rotation des murs","min":0,"max":3,"step":0.1,"unit":"×","cost":"JEU","help":"0 = murs tournants immobiles"},
  {"id":"gapMinimum","label":"Espace minimum entre murs","min":8,"max":28,"step":0.5,"unit":"u","cost":"JEU","help":"Garde une distance minimale de réaction"},
  {"id":"gateSize","label":"Longueur des obstacles","min":0.5,"max":2,"step":0.05,"unit":"×","cost":"JEU","help":"Épaisseur des murs dans le sens de la piste"},
  {"id":"obstacleFade","label":"Distance d'apparition","min":3,"max":16,"step":0.5,"unit":"u","cost":"VISUEL","help":"Détermine combien de temps les obstacles émergent du fond"},
  {"id":"shieldFrequency","label":"Fréquence des boucliers","min":0.25,"max":3,"step":0.05,"unit":"×","cost":"JEU","help":"Plus haut = plus de chances de récupérer une vie"},
  {section:"SCORE & COMBOS"},
  {"id":"comboTimeout","label":"Temps avant encaissement","min":3,"max":14,"step":0.5,"unit":"s","cost":"JEU","help":"Sans nouvelle figure, la chaîne est encaissée"},
  {"id":"comboCashout","label":"Durée maximale d'une chaîne","min":8,"max":40,"step":1,"unit":"s","cost":"JEU","help":"Encaissement automatique pour créer des pics de score"},
  {"id":"comboEvery","label":"Figures par multiplicateur","min":2,"max":7,"step":1,"unit":"fig.","cost":"JEU","help":"Plus petit = combo qui grimpe plus vite"},
  {"id":"comboMax","label":"Multiplicateur combo maximum","min":3,"max":20,"step":1,"unit":"×","cost":"JEU","help":"En plus du multiplicateur lié à la vitesse"},
  {"id":"scoreClean","label":"Points passage propre","min":10,"max":400,"step":10,"unit":"pts","cost":"JEU","help":"Valeur par obstacle propre ; bonus versé par lot de 5 passages (×5) sans collision"},
  {"id":"scoreNear","label":"Points near miss","min":20,"max":700,"step":10,"unit":"pts","cost":"JEU","help":"Frôler un mur rapporte davantage"},
  {"id":"scorePulse","label":"Points mur détruit au pulse","min":20,"max":800,"step":10,"unit":"pts","cost":"JEU","help":"Un tir dans le vide ne rapporte rien"},
  {"id":"scorePad","label":"Points pad BOOST","min":10,"max":600,"step":10,"unit":"pts","cost":"JEU","help":"Récupérer un pad"},
  {"id":"scoreShield","label":"Points bouclier","min":10,"max":600,"step":10,"unit":"pts","cost":"JEU","help":"Récupérer une vie"},
  {section:"MUSIQUE & LUMIÈRES"},
  {"id":"rewardSfxVolume","label":"Sons des récompenses","min":0,"max":1,"step":0.05,"unit":"×","cost":"AUDIO","help":"Nitro prêt, pulse gagné, combo et encaissement"},
  {"id":"punch","label":"Réactivité générale au son","min":0,"max":3,"step":0.1,"unit":"×","cost":"VISUEL","help":"Amplifie les pulsations déclenchées par la musique"},
  {"id":"light","label":"Intensité générale des néons","min":0.2,"max":2.5,"step":0.05,"unit":"×","cost":"VISUEL","help":"Luminosité des rails et anneaux"},
  {"id":"musicSpeedInfluence","label":"Influence musicale sur la vitesse","min":0,"max":3,"step":0.1,"unit":"×","cost":"JEU","help":"La musique accélère réellement le vaisseau"},
  {"id":"beatSensitivity","label":"Sensibilité aux kicks","min":0.4,"max":2.5,"step":0.05,"unit":"×","cost":"VISUEL","help":"Plus haut = plus de kicks détectés"},
  {"id":"bassLight","label":"Réaction aux basses","min":0,"max":3,"step":0.1,"unit":"×","cost":"VISUEL","help":"Éclaire les panneaux dans les graves"},
  {"id":"trebleLight","label":"Réaction aux aigus","min":0,"max":3,"step":0.1,"unit":"×","cost":"VISUEL","help":"Éclats et rivets sur les fréquences aiguës"},
  {section:"TUNNEL & CAMÉRA"},
  {"id":"lineCount","label":"Nombre de lignes du tunnel","min":8,"max":40,"step":2,"unit":"","cost":"ÉLEVÉ","help":"Longitudinales, sans modifier les collisions"},
  {"id":"ringGap","label":"Distance entre les anneaux","min":0.3,"max":1.4,"step":0.02,"unit":"u","cost":"ÉLEVÉ","help":"Plus grand = moins d'anneaux, meilleur FPS"},
  {"id":"panelDetail","label":"Détail des panneaux","cost":"TRÈS ÉLEVÉ","help":"Géométrie des plaques et leurs subdivisions","kind":"select","options":[["0","Léger"],["1","Équilibré"],["2","Détaillé"]]},
  {"id":"railThickness","label":"Épaisseur des lignes","min":0.4,"max":2.5,"step":0.1,"unit":"×","cost":"VISUEL","help":"Largeur des rails lumineux"},
  {"id":"ringThickness","label":"Épaisseur des anneaux","min":0.4,"max":2.5,"step":0.1,"unit":"×","cost":"VISUEL","help":"Largeur du phosphore circulaire"},
  {"id":"panelBrightness","label":"Luminosité des panneaux","min":0.1,"max":2,"step":0.05,"unit":"×","cost":"VISUEL","help":"Sans changer les couleurs choisies"},
  {"id":"backgroundBrightness","label":"Luminosité du fond","min":0.2,"max":2,"step":0.05,"unit":"×","cost":"VISUEL","help":"N'affecte pas les obstacles"},
  {"id":"bendIntensity","label":"Force des courbes","min":0,"max":2.5,"step":0.1,"unit":"×","cost":"VISUEL","help":"Courbes horizontales du tunnel"},
  {"id":"verticalBend","label":"Force des montées / descentes","min":0,"max":2.5,"step":0.1,"unit":"×","cost":"VISUEL","help":"Dénivelés, indépendants des virages"},
  {"id":"bendFrequency","label":"Fréquence des courbes","min":0.5,"max":2,"step":0.1,"unit":"×","cost":"VISUEL","help":"Plus haut = plus de virages dans les segments"},
  {section:"PALETTE DE LA PHASE"},
  {"id":"colorMain","label":"Néon principal","cost":"VISUEL","help":"Anneaux et rails dominants","kind":"color"},
  {"id":"colorAccent","label":"Néon secondaire","cost":"VISUEL","help":"Rail alterné, éclats et détails","kind":"color"},
  {"id":"colorPanels","label":"Couleur des panneaux","cost":"VISUEL","help":"Plaques du tunnel, différente des rails","kind":"color"},
  {"id":"colorBackdrop","label":"Couleur du fond","cost":"VISUEL","help":"Fond et point de fuite, pas la couleur du décor","kind":"color"},
  {"id":"colorHazard","label":"Couleur des obstacles","cost":"VISUEL","help":"Murs dangereux, toutes les familles","kind":"color"},
  {"id":"colorPads","label":"Couleur des pads BOOST","cost":"VISUEL","help":"Plateformes d'accélération","kind":"color"},
  {"id":"colorShields","label":"Couleur des boucliers","cost":"VISUEL","help":"Bonus qui redonnent une vie","kind":"color"},
  {section:"PERFORMANCES & TEST"},
  {"id":"displayScale","label":"Échelle des KM/H affichés","min":10,"max":55,"step":1,"unit":"×","cost":"AFFICHAGE","help":"Les KM/H sont une mesure fictive de style arcade","global":true},
  {"id":"renderScale","label":"Résolution interne","min":0.5,"max":1.3,"step":0.05,"unit":"×","cost":"TRÈS ÉLEVÉ","help":"Plus basse = moins de pixels à calculer","global":true},
  {"id":"warp","label":"Déformation CRT","cost":"TRÈS ÉLEVÉ","help":"Post-traitement en 32 bandes","kind":"check","global":true},
  {"id":"shadows","label":"Halos des obstacles","cost":"ÉLEVÉ","help":"Désactiver pour réduire le travail de Canvas","kind":"check","global":true},
  {"id":"particles","label":"Quantité de particules","min":0,"max":1,"step":0.1,"unit":"×","cost":"MOYEN","help":"Réduire les effets secondaires","global":true},
  {"id":"frameLimit","label":"Limiteur d'affichage","cost":"MOYEN","help":"Limite les images dessinées, sans ralentir la simulation","kind":"select","options":[["0","Libre / 60 Hz"],["30","30 FPS"],["45","45 FPS"],["60","60 FPS"]],"global":true},
  {"id":"invincible","label":"Invincible en TEST","cost":"TEST","help":"Collisions non fatales en mode TEST","kind":"check","global":true},
 ];
 function loadLab(){
  let obj={};try{obj=JSON.parse(load("lab.v1","{}"))||{};}catch(_){}
  const next={...LAB_DEFAULTS};
  for(const spec of LAB_META){
   if(!spec.id||!Object.prototype.hasOwnProperty.call(obj,spec.id))continue;
   const val=obj[spec.id];
   if(spec.kind==="color"){if(typeof val==="string"&&/^#[0-9a-f]{6}$/i.test(val))next[spec.id]=val;}
   else if(spec.kind==="check")next[spec.id]=val===true;
   else if(spec.kind==="select"){
    const number=Number(val);
    if(spec.options.some(option=>Number(option[0])===number))next[spec.id]=number;
   }
   else if(Number.isFinite(Number(val)))next[spec.id]=clamp(Number(val),spec.min,spec.max);
  }
  return next;
 }
 const lab=loadLab();
 // Three musical chapters are distinct editable profiles. The performance
 // controls are common to every chapter and remain separate.
 const PHASES=[
  {id:"p1",title:"PHASE 1",subtitle:"INTRO · 0–68 s",seconds:0,stage:0},
  {id:"p2",title:"PHASE 2",subtitle:"DROP · 68–217 s",seconds:MUSIC_DROP_AT+2,stage:2},
  {id:"p3",title:"PHASE 3",subtitle:"TUNNEL BLEU · APRÈS 217 s",seconds:MUSIC_TAIL_AT,stage:5}
 ];
 const PHASE_FIELDS=LAB_META.filter(s=>s.id&&!s.global).map(s=>s.id);
 const PHASE_FIELD_SET=new Set(PHASE_FIELDS);
 const PHASE_KEY="lab.phases.v1";
 function phaseDefaultValue(id,key){
  const palette=id==="p3"?
   {colorMain:"#6099ff",colorAccent:"#74efff",colorPanels:"#1d598c",
    colorBackdrop:"#030e23",colorHazard:"#145e87",colorPads:"#3af6ff",colorShields:"#66ffe2"}:
   {colorMain:"#ff3ed1",colorAccent:"#74efff",colorPanels:"#6b1e71",
    colorBackdrop:"#0b0619",colorHazard:"#ef3a5c",colorPads:"#3af6ff",colorShields:"#66ffe2"};
  return Object.prototype.hasOwnProperty.call(palette,key)?palette[key]:LAB_DEFAULTS[key];
 }
 function loadPhaseProfiles(){
  let stored={};
  try{stored=JSON.parse(load(PHASE_KEY,"{}"))||{};}catch(_){}
  const output={};
  for(const phase of PHASES){
   const raw=stored[phase.id]||{};
   output[phase.id]={};
   for(const key of PHASE_FIELDS){
    const spec=LAB_META.find(s=>s.id===key);
    let prev=raw[key];
    // Migrate older colorPink/colorCyan/colorBlue settings without dropping
    // any previously saved P1, P2 or P3 palette.
    if(prev===undefined&&key==="colorMain")
     prev=phase.id==="p3"?raw.colorBlue:raw.colorPink;
    if(prev===undefined&&key==="colorAccent")prev=raw.colorCyan;
    let value=phaseDefaultValue(phase.id,key);
    if(spec&&prev!==undefined){
     if(spec.kind==="color"&&typeof prev==="string"&&/^#[0-9a-f]{6}$/i.test(prev))value=prev;
     else if(spec.kind==="check"&&typeof prev==="boolean")value=prev;
     else if(spec.kind==="select"&&spec.options.some(o=>Number(o[0])===Number(prev)))value=Number(prev);
     else if(!spec.kind&&Number.isFinite(Number(prev)))value=clamp(Number(prev),spec.min,spec.max);
    }
    output[phase.id][key]=value;
   }
  }
  return output;
 }
 const phaseProfiles=loadPhaseProfiles();
 let activePhase="p1",editorPhase="p3",testLaunchPhase="p3";
 function persistPhases(){save(PHASE_KEY,JSON.stringify(phaseProfiles));}
 function applyPhase(id){
  if(!phaseProfiles[id])return;
  const oldBendFrequency=lab.bendFrequency;
  const oldPadsEnabled=lab.boostPadsEnabled;
  activePhase=id;
  Object.assign(lab,phaseProfiles[id]);
  if(selectedLevel.arcade&&!testMode)Object.assign(lab,selectedLevel.colors);
  // A phase without pads must not inherit pickups/boost from the last one.
  if(!lab.boostPadsEnabled){
   pads=[];padBoostTime=0;shipBoostFade=0;turboLight=0;
  }
  if(oldPadsEnabled!==lab.boostPadsEnabled)nextPadAt=travel+PAD_START;
  if(oldBendFrequency!==lab.bendFrequency)bendProfiles.clear();
  bendCache.clear();
  // During a run, the settings of the actual musical phase take priority
  // over the phase currently being edited in the detached workshop.
  if(typeof labRefresh==="function"&&labPanel&&!labPanel.hidden)labRefresh();
 }
 function exportTuningJSON(){
  const common={};
  for(const k of Object.keys(LAB_DEFAULTS)){
   if(!PHASE_FIELD_SET.has(k))common[k]=lab[k];
  }
  return JSON.stringify({
   project:"ZebraOS / Echo Racer",version:3,
   chapters:PHASES.map(p=>({id:p.id,title:p.title,subtitle:p.subtitle,startSeconds:p.seconds})),
   phases:phaseProfiles,common
  },null,2);
 }
 function persistLab(){save("lab.v1",JSON.stringify(lab));}
 function labHex(hex,alpha=1){
  return "rgba("+parseInt(hex.slice(1,3),16)+","+parseInt(hex.slice(3,5),16)+","+parseInt(hex.slice(5,7),16)+","+clamp(alpha,0,1)+")";
 }
 // Tint that follows the phase's configurable main color even in the dark
 // backdrop. Hardcoded blue backgrounds previously ignored colorBlue.
 function labTint(hex,intensity,alpha=1){
  const k=clamp(intensity,0,1);
  return "rgba("+Math.round(parseInt(hex.slice(1,3),16)*k)+","+
   Math.round(parseInt(hex.slice(3,5),16)*k)+","+
   Math.round(parseInt(hex.slice(5,7),16)*k)+","+clamp(alpha,0,1)+")";
 }
 const labVisualTravel=()=>travel*lab.visualSpeed;
 let dragPointer=null,dragX=0,dragLastTs=0,dragVelocity=0;
 let sliderPointer=null,steerValue=0,menuSliderDir=0,menuSliderNext=0;
 const wrap=node("section","er zg zg-retro");
 wrap.setAttribute("aria-label","Echo Racer — jeu du tunnel phosphore");
 const heading=node("div","er-heading");
 const wordmark=node("div","er-wordmark");
 const headerLogo=node("img","er-header-logo");
 headerLogo.src="/assets/games/echo-racer-logo-2026.webp?v=1";
 headerLogo.alt="ECHO RACER";
 wordmark.appendChild(headerLogo);
 heading.appendChild(wordmark);wrap.appendChild(heading);
 // Seven-segment phosphor digits: genuine segmented geometry, without a font
 // download or a canvas redraw each time a score changes.
 const SEGMENTS={
  "0":"a b c d e f","1":"b c","2":"a b d e g1 g2","3":"a b c d g1 g2",
  "4":"b c f g1 g2","5":"a c d f g1 g2","6":"a c d e f g1 g2",
  "7":"a b c","8":"a b c d e f g1 g2","9":"a b c d f g1 g2",
  "A":"a b c e f g1 g2","B":"a b c d e f g1 g2 l m",
  "C":"a d e f","D":"a b c d e f l m","E":"a d e f g1 g2",
  "F":"a e f g1 g2","G":"a c d e f g2",
  "H":"b c e f g1 g2","I":"a d l m","J":"b c d e",
  "K":"e f g1 h k","L":"d e f","M":"b c e f h i",
  "N":"b c e f h k","O":"a b c d e f","P":"a b e f g1 g2",
  "Q":"a b c d e f k","R":"a b e f g1 g2 k",
  "S":"a c d f g1 g2","T":"a l m","U":"b c d e f",
  "V":"e f j k","W":"b c d e f j k","X":"h i j k",
  "Y":"b c d f g1 g2","Z":"a d i j","-":"g1 g2",
  ".":"m", "/":"i j"," ":""
 };
 const SEGMENT_NAMES="a b c d e f g1 g2 h i j k l m".split(" ");
 function setDigital(display,value){
  const text=String(value).toUpperCase();
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
   else {
    const active=new Set((SEGMENTS[char]||"").split(" "));
    for(let j=0;j<SEGMENT_NAMES.length;j++)
     digit.children[j].classList.toggle("lit",active.has(SEGMENT_NAMES[j]));
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
  const title=node("span","er-meter-label");setDigital(title,label);
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
 brandLogo.src="/assets/games/echo-racer-logo-2026.webp?v=1";
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
 const testButton=node("button","er-test-button","TEST");
 testButton.type="button";
 testButton.title="Essayer Echo Racer en mode TEST";
 testButton.setAttribute("aria-label","Mode TEST — paramètres et phases");
 testButton.onclick=()=>{selectedLevel=LEVELS[0];start(true);};
 const quitButton=node("button","er-quit-button","QUITTER");
 quitButton.type="button";
 quitButton.onclick=()=>{
  const w=root.closest(".window"),close=w&&w.querySelector(".titlebuttons [data-close]");
  if(close)close.click();
 };
 const levelPicker=node("div","er-level-picker");
 levelPicker.hidden=true;
 const levelButtons=[];
 function refreshLevelCards(){
  levelButtons.forEach((btn,i)=>{
   const locked=i>=unlockedLevel,complete=i<completedLevels;
   btn.classList.toggle("er-level-locked",locked);
   btn.classList.toggle("er-level-complete",complete);
   btn.setAttribute("aria-disabled",String(locked));
   btn.querySelector(".er-level-state").textContent=locked?"VERROUILLÉ":complete?"TERMINÉ":"DISPONIBLE";
  });
 }
 CAMPAIGN.forEach((level,i)=>{
  const btn=node("button","er-level-button");
  btn.type="button";btn.dataset.level=level.id;
  btn.setAttribute("aria-label","Niveau "+(i+1)+" — "+level.name);
  const image=node("img","er-level-art");
  image.src="/assets/games/lvl"+(i+1)+".png";image.alt="";image.loading="lazy";
  btn.append(image,node("span","er-level-name","0"+(i+1)+" · "+level.name),
   node("span","er-level-state"));
  btn.onclick=()=>{menuIndex=i;confirmLevel();};
  levelPicker.appendChild(btn);levelButtons.push(btn);
 });
 refreshLevelCards();
 const backButton=node("button","er-menu-back","MENU");
 backButton.type="button";backButton.setAttribute("aria-label","Retour au menu principal");
 backButton.onclick=()=>toMenu();
 function paintMenuSelection(){
  levelButtons.forEach((btn,i)=>{
   const active=mode==="menu"&&menuStage==="levels"&&i===menuIndex;
   btn.classList.toggle("selected",active);
   btn.setAttribute("aria-current",active?"true":"false");
  });
  const home=mode==="menu"&&menuStage==="home";
  overlayButton.classList.toggle("selected",home&&homeIndex===0||
   mode==="paused"&&pauseIndex===0||mode==="over"&&overIndex===0);
  testButton.classList.toggle("selected",home&&homeIndex===1);
  quitButton.classList.toggle("selected",home&&homeIndex===2);
  backButton.classList.toggle("selected",mode==="over"&&overIndex===1);
  finaleRestart.classList.toggle("selected",mode==="finished"&&finaleSelection===0);
  finaleMenu.classList.toggle("selected",mode==="finished"&&finaleSelection===1);
  [pauseRestart,pauseSound,pauseMenu].forEach((btn,i)=>btn.classList.toggle("selected",mode==="paused"&&pauseIndex===i+1));
 }
 function confirmLevel(){
  if(mode!=="menu"||menuStage!=="levels")return;
  if(menuIndex>=unlockedLevel){
   status.textContent="FINIS LE NIVEAU "+menuIndex+" POUR CONTINUER";
   beep("warning");return;
  }
  selectedLevel=CAMPAIGN[menuIndex];
  best=Number(load("best."+selectedLevel.id,"0"))||0;
  start(false);
 }
 function controllerInput(which){
  if(mode==="crashing"||(mode==="over"&&deathLock>0))return;
  const backward=which==="up"||which==="left";
  const forward=which==="down"||which==="right";
  if(mode==="menu"){
   if(menuStage==="levels"){
    if(backward||forward){menuIndex=(menuIndex+(forward?1:-1)+CAMPAIGN.length)%CAMPAIGN.length;beep("switch");paintMenuSelection();return;}
    if(which==="pulse"){confirmLevel();return;}
    if(which==="boost"||which==="pause"){renderMenuStage("home");return;}
   }else{
    if(backward||forward){homeIndex=(homeIndex+(forward?1:-1)+3)%3;beep("switch");paintMenuSelection();return;}
    if(which==="pulse"||which==="pause"||which==="boost"){
     if(homeIndex===0)showLevelSelect();
     else if(homeIndex===1){selectedLevel=LEVELS[0];start(true);}
     else quitButton.click();
    }
   }
   return;
  }
  if(mode==="paused"){
   if(backward||forward){pauseIndex=(pauseIndex+(forward?1:-1)+4)%4;beep("switch");paintMenuSelection();return;}
   if(which==="pulse"){
    if(pauseIndex===0)togglePause();
    else if(pauseIndex===1)restartRun();
    else if(pauseIndex===2)soundButton.click();
    else toMenu();
   }else if(which==="boost"||which==="pause")togglePause();
   return;
  }
  if(mode==="over"){
   if(backward||forward){overIndex=1-overIndex;beep("switch");paintMenuSelection();return;}
   if(which==="pulse"){if(overIndex===0)restartRun();else toMenu();}
   else if(which==="boost"||which==="pause")toMenu();
   return;
  }
  if(mode==="finished"){
   if(backward||forward){finaleSelection=1-finaleSelection;beep("switch");paintMenuSelection();return;}
   if(which==="pulse"){if(finaleSelection===0)restartRun();else finaleMenu.click();}
   else if(which==="boost"||which==="pause")finaleMenu.click();
   return;
  }
  if(mode==="running")tap(which);
 }
 function renderMenuStage(stage){
  menuStage=stage;if(stage==="home")homeIndex=0;
  const choosing=stage==="levels";
  overlay.classList.toggle("er-stage-levels",choosing);
  overlay.classList.toggle("er-stage-home",!choosing);
  brandLogo.hidden=false;logo.hidden=true;crashIcon.hidden=true;crashSub.hidden=true;
  overlay.classList.remove("er-stage-over","er-stage-pause");screen.classList.remove("er-death");
  pauseActions.hidden=true;
  levelPicker.hidden=!choosing;overlayButton.hidden=choosing;testButton.hidden=choosing;quitButton.hidden=choosing;
  backButton.hidden=!choosing;status.hidden=!choosing;
  prompt.hidden=true;introDiagnostic.hidden=true;introTrack.hidden=true;
  expl.hidden=true;hint.hidden=!choosing;
  if(choosing){
   status.textContent="CHOISIS TON NIVEAU";
   hint.textContent="↑ ↓ CHOISIR · A VALIDER · B RETOUR";
   refreshLevelCards();
  }
  overlayButton.classList.remove("er-overlay-restart");
  overlayButton.textContent="JOUER";
  overlayButton.setAttribute("aria-label","Choisir un niveau");
  backButton.textContent="← RETOUR";
  backButton.setAttribute("aria-label","Retour au menu principal");
  paintMenuSelection();
 }
 function showLevelSelect(){
  if(mode!=="menu")return;
  menuIndex=0;renderMenuStage("levels");
 }
 // SELECT opens these controls via the pause overlay, not a permanent bar.
 const pauseActions=node("div","er-pause-actions");
 pauseActions.setAttribute("role","group");
 pauseActions.setAttribute("aria-label","Commandes en pause");
 function pauseAction(label,cls,fn){
  const btn=node("button","er-pause-action "+cls,label);
  btn.type="button";btn.onclick=fn;return btn;
 }
 const pauseRestart=pauseAction("↻ RESTART","er-pause-restart",()=>restartRun());
 const pauseSound=pauseAction("♫ SON ON","er-pause-sound",()=>soundButton.click());
 const pauseMenu=pauseAction("☷ MENU","er-pause-menu",()=>toMenu());
 pauseActions.append(pauseRestart,pauseSound,pauseMenu);pauseActions.hidden=true;
 overlay.append(introDiagnostic,brandLogo,introTrack,crashIcon,logo,crashSub,status,prompt,levelPicker,expl,hint,overlayButton,testButton,quitButton,backButton,pauseActions);
 const dashboard=node("div","er-dashboard");
 dashboard.setAttribute("role","group");dashboard.setAttribute("aria-label","Tableau de bord vitesse et boost");
 const dashHeader=node("div","er-dashboard-header");
 dashHeader.append(node("span","","ECHO / TELEMETRY"),node("span","","HYPERDRIVE · 02"));
 dashboard.appendChild(dashHeader);
 function instrument(label,cls,unit){
  const row=node("div","er-dashboard-row "+cls);
  const readout=node("div","er-dashboard-readout");
  const labelEl=node("span","er-dashboard-name",label);
  const value=digital("er-dashboard-digits");
  const unitEl=node("span","er-dashboard-unit",unit);
  // A fixed-width physical display pod: center label and the complete
  // number+unit line together, instead of aligning them in a shared grid.
  const numberLine=node("div","er-dashboard-number-line");
  numberLine.append(value,unitEl);
  readout.append(labelEl,numberLine);

  // Two perfectly horizontal rails. The individual chips keep their
  // forward-leaning italic silhouette. The rails NEVER incline.
  const bar=node("div","er-dashboard-bar");
  bar.setAttribute("aria-hidden","true");
  const ns="http://www.w3.org/2000/svg";
  const rail=document.createElementNS(ns,"svg");
  rail.classList.add("er-gauge-rail");
  rail.setAttribute("viewBox","0 0 600 160");
  rail.setAttribute("preserveAspectRatio","none");
  rail.setAttribute("aria-hidden","true");
  const isBoost=cls==="er-dashboard-boost";
  const baseY=isBoost?53:105;
  function point(t){
   return {x:24+552*t,y:baseY};
  }
  const trace=document.createElementNS(ns,"path");
  trace.classList.add("er-gauge-curve");
  let d="";
  for(let k=0;k<=90;k++){
   const p=point(k/90);
   d+=(k?"L":"M")+p.x.toFixed(2)+" "+p.y.toFixed(2)+" ";
  }
  trace.setAttribute("d",d.trim());
  rail.appendChild(trace);
  if(isBoost){
   // A SINGLE thin continuous LCD strip, not an array of rectangles.
   const track=document.createElementNS(ns,"rect");
   track.classList.add("er-boost-track");
   track.setAttribute("x","24");track.setAttribute("y",String(baseY-3));
   track.setAttribute("width","552");track.setAttribute("height","6");
   track.setAttribute("rx","2.8");
   const lit=document.createElementNS(ns,"rect");
   lit.classList.add("er-boost-fill");
   lit.setAttribute("x","24");lit.setAttribute("y",String(baseY-3));
   lit.setAttribute("width","0");lit.setAttribute("height","6");
   lit.setAttribute("rx","2.8");
   rail.append(track,lit);bar.appendChild(rail);
   const statusEl=node("span","er-dashboard-status","");
   row.append(readout,bar,statusEl);dashboard.appendChild(row);
   return {row,value,segments:[],fill:lit,track,statusEl};
  }
  const ghost=document.createElementNS(ns,"g");
  ghost.classList.add("er-gauge-leds-ghost");
  const luminous=document.createElementNS(ns,"g");
  luminous.classList.add("er-gauge-leds-lit");
  const segments=[],COUNT=26;
  for(let i=0;i<COUNT;i++){
   const t=(i+.5)/COUNT,p=point(t);
   const halfW=7.0,halfH=12.4;
   // All cuts share the same shear (no rotation): the curve only
   // changes each segment's height/position, like the reference gauge.
   const corners=[
    [p.x-halfW+3.0,p.y-halfH],
    [p.x+halfW+3.0,p.y-halfH],
    [p.x+halfW-3.0,p.y+halfH],
    [p.x-halfW-3.0,p.y+halfH]
   ];
   const path=corners.map((v,j)=>(j?"L":"M")+v[0].toFixed(2)+" "+v[1].toFixed(2)).join(" ")+" Z";
   const dim=document.createElementNS(ns,"path");
   dim.classList.add("er-gauge-ghost");
   dim.setAttribute("d",path);
   ghost.appendChild(dim);
   const led=document.createElementNS(ns,"path");
   led.classList.add("er-dashboard-led");
   led.setAttribute("d",path);
   led.style.setProperty("--gauge-x",(p.x/6).toFixed(2)+"%");
   led.style.setProperty("--gauge-y",(p.y/1.6).toFixed(2)+"%");
   luminous.appendChild(led);segments.push(led);
  }
  rail.append(ghost,luminous);
  bar.appendChild(rail);
  const statusEl=node("span","er-dashboard-status","");
  row.append(readout,bar,statusEl);dashboard.appendChild(row);
  return {row,value,segments,statusEl};
 }
 const speedGauge=instrument("VITESSE","er-dashboard-speed","KM/H");
 const boostGauge=instrument("BOOST","er-dashboard-boost","%");
 const eventText=node("div","er-race-event","");
 // Minimal arcade HUD: one streak multiplier on the left, actual score and
 // the last scoring action on the right. The tunnel center remains empty.
 const scoreCombo=node("div","er-score-combo");
 scoreCombo.setAttribute("aria-label","Multiplicateur de combo");
 const skillComboEl=node("strong","er-score-multiplier","");
 scoreCombo.appendChild(skillComboEl);
 const scoreTop=node("div","er-score-top");
 scoreTop.setAttribute("aria-label","Score de la course");
 const scoreTotal=node("strong","er-score-total","0");
 const scoreToast=node("div","er-score-toast");
 scoreToast.setAttribute("aria-live","off");
 scoreToast.hidden=true;
 scoreTop.append(scoreTotal,scoreToast);
 const warningLayer=node("div","er-shield-warning");
 const warningIcon=node("img","er-shield-warning-icon");
 warningIcon.src="/assets/games/warning.png";warningIcon.alt="";
 warningLayer.setAttribute("role","status");
 warningLayer.setAttribute("aria-label","Attention : dernier bouclier");
 warningLayer.append(warningIcon,node("span","er-shield-warning-label","DERNIER BOUCLIER"));
 warningLayer.hidden=true;
 const shieldCollect=node("div","er-shield-collect","◆ BOUCLIER +1");
 shieldCollect.setAttribute("aria-hidden","true");
 shieldCollect.addEventListener("animationend",()=>shieldCollect.classList.remove("er-shield-collected"));
 function showShieldCollect(){
  shieldCollect.classList.remove("er-shield-collected");
  void shieldCollect.offsetWidth;
  shieldCollect.classList.add("er-shield-collected");
 }
 const finaleOverlay=node("div","er-finale-overlay");
 finaleOverlay.hidden=true;
 const finaleTitle=node("h2","er-finale-title","THANK YOU FOR PLAYING");
 const finaleSubtitle=node("p","er-finale-subtitle","ECHO RACER · COURSE TERMINÉE");
 const finaleScore=node("strong","er-finale-score","");
 const finaleStats=node("p","er-finale-stats","");
 const finaleActions=node("div","er-finale-actions");
 const finaleRestart=node("button","er-finale-button","↻ REJOUER");finaleRestart.type="button";
 finaleRestart.onclick=()=>restartRun();
 const finaleMenu=node("button","er-finale-button","⌂ MENU");finaleMenu.type="button";
 finaleMenu.onclick=()=>{const campaign=selectedLevel.arcade&&!testMode;toMenu();if(campaign)showLevelSelect();};
 finaleActions.append(finaleRestart,finaleMenu);
 finaleOverlay.append(finaleTitle,finaleSubtitle,finaleScore,finaleStats,finaleActions);
 const crashCurtain=node("div","er-crash-curtain");
 crashCurtain.hidden=true;crashCurtain.setAttribute("aria-hidden","true");
 // Instruments are part of frame: overlay on desktop, physical strip on mobile.
 screen.append(canvas,sheen,eventText,scoreCombo,scoreTop,warningLayer,shieldCollect,overlay,crashCurtain,finaleOverlay);
 frame.append(screen,dashboard);
 wrap.append(hud,frame);
 const footer=node("div","er-footer zg-buttons zt-buttons");
 function button(label,cls,callback){const b=node("button","er-hardware "+cls,label);b.type="button";b.onclick=()=>{beep("switch");callback();};return b;}
 const startButton=button("▶ JOUER","er-play",()=>{
  if(mode==="menu"){if(menuStage==="levels")confirmLevel();else showLevelSelect();}
  else if(mode==="over"||mode==="finished")restartRun();
  else togglePause();
 });
 const restartButton=button("↻ RESTART","er-restart",restartRun);
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
 const steering=node("div","er-steering");
 const steerTrack=node("div","er-steering-track");
 const steerThumb=node("div","er-steering-thumb");
 steerThumb.append(node("span","er-steering-grip"));
 steerTrack.append(node("div","er-steering-groove"),steerThumb);
 steerTrack.setAttribute("role","slider");
 steerTrack.setAttribute("aria-label","Direction du vaisseau");
 steerTrack.setAttribute("aria-valuemin","-100");
 steerTrack.setAttribute("aria-valuemax","100");
 steerTrack.setAttribute("aria-valuenow","0");
 steerTrack.tabIndex=0;
 steering.append(steerTrack,node("div","er-steering-markers","◀                     ●                     ▶"));
 dpad.appendChild(steering);
 function drawSteering(){
  steerThumb.style.left=(50+steerValue*42)+"%";
  steerTrack.setAttribute("aria-valuenow",String(Math.round(steerValue*100)));
  steerTrack.classList.toggle("er-steering-engaged",Math.abs(steerValue)>.05);
 }
 function updateSteering(value,now){
  steerValue=clamp(value,-1,1);drawSteering();
  if(mode==="running"||Math.abs(steerValue)<.48){menuSliderDir=0;return;}
  const dir=steerValue<0?-1:1;
  if(menuSliderDir!==dir||now>=menuSliderNext){
   controllerInput(dir<0?"left":"right");
   menuSliderDir=dir;menuSliderNext=now+380;
  }
 }
 function resetSteering(){
  sliderPointer=null;steerValue=0;menuSliderDir=0;menuSliderNext=0;
  steerThumb.classList.add("er-steering-return");drawSteering();
 }
 function steerFromPointer(e){
  const r=steerTrack.getBoundingClientRect();
  if(r.width)updateSteering(((e.clientX-r.left)/r.width-.5)/.42,performance.now());
 }
 dpad.addEventListener("pointerdown",e=>{
  if((e.button!==undefined&&e.button!==0)||sliderPointer!==null)return;
  e.preventDefault();sliderPointer=e.pointerId;
  steerThumb.classList.remove("er-steering-return");
  try{dpad.setPointerCapture(e.pointerId);}catch(_){}
  steerFromPointer(e);
 });
 dpad.addEventListener("pointermove",e=>{
  if(e.pointerId!==sliderPointer)return;
  e.preventDefault();steerFromPointer(e);
 });
 function endSteering(e){
  if(sliderPointer!==null&&e.pointerId===sliderPointer)resetSteering();
 }
 for(const event of ["pointerup","pointercancel","lostpointercapture"])
  dpad.addEventListener(event,endSteering);
 steerTrack.addEventListener("keydown",e=>{
  if(e.key!=="ArrowLeft"&&e.key!=="ArrowRight")return;
  e.preventDefault();e.stopPropagation();steerThumb.classList.remove("er-steering-return");
  updateSteering(e.key==="ArrowLeft"?-1:1,performance.now());
 });
 steerTrack.addEventListener("keyup",e=>{
  if(e.key==="ArrowLeft"||e.key==="ArrowRight"){
   e.preventDefault();e.stopPropagation();resetSteering();
  }
 });
 steerTrack.addEventListener("blur",resetSteering);
 drawSteering();
 const actionSide=node("div","zt-action-side"),ab=node("div","zt-ab");
 // Standalone Echo Racer hardware, no borrowed Tetris button sprites.
 const aAction=holdButton("A — Pulse","zt-ab-button zt-a","pulse");
 const bAction=holdButton("B — Nitro (maintenir)","zt-ab-button zt-b","boost");
 aAction.textContent="A";bAction.textContent="B";
 ab.append(aAction,bAction);actionSide.appendChild(ab);
 const select=holdButton("SELECT — Pause","zt-select","pause");select.textContent="SELECT";
 actionSide.append(select,node("span","zt-control-caption","B : NITRO · A : PULSE"));
 pad.append(dpad,actionSide);
 wrap.append(pad);
 root.appendChild(wrap);
 // A self-contained, movable desktop tuning window. No files to edit:
 // adjustments are saved in localStorage and apply live to this game only.
 const labToggle=node("button","er-lab-toggle","⚙ CONFIG TEST");
 labToggle.type="button";labToggle.hidden=true;
 labToggle.setAttribute("aria-label","Ouvrir la fenêtre des paramètres du mode test");
 const labPanel=node("section","er-lab-window");
 labPanel.setAttribute("role","dialog");
 labPanel.setAttribute("aria-label","Atelier Echo Racer, réglages de jeu et performances");
 labPanel.hidden=true;
 const labBar=node("header","er-lab-titlebar");
 const labHeading=node("strong","","ECHO RACER · ATELIER TEST");
 const labClose=node("button","er-lab-close","×");
 labClose.type="button";labClose.setAttribute("aria-label","Fermer la fenêtre de réglages");
 labBar.append(labHeading,labClose);
 const labBody=node("div","er-lab-body");
 const labIntro=node("p","er-lab-intro",
  "ÉDITEUR COMPLET · Trois phases indépendantes. Choisis la phase et la catégorie. Chaque couleur règle un élément précis du niveau.");
 const labPerfReadout=node("div","er-lab-fps","FPS — · chargement...");
 const labPresetBox=node("div","er-lab-presets");
 const labPhases=node("nav","er-lab-phases");
 labPhases.setAttribute("aria-label","Phases musicales à configurer");
 const labChapterInfo=node("p","er-lab-chapter-info","");
 const labPhaseTabs=new Map();
 const labTryPhase=node("button","er-lab-try-phase","▶ ESSAYER CETTE PHASE");
 labTryPhase.type="button";
 labTryPhase.title="Tester cette phase avec sa musique et son profil complet, sans changer le record";
 labTryPhase.onclick=()=>start(true,editorPhase);
 for(const phase of PHASES){
  const tab=node("button","er-lab-phase-tab",phase.title);
  tab.type="button";tab.dataset.phase=phase.id;
  tab.title=phase.subtitle;
  tab.setAttribute("aria-label",phase.title+" · "+phase.subtitle);
  tab.onclick=()=>{editorPhase=phase.id;labRefresh();};
  labPhaseTabs.set(phase.id,tab);
  labPhases.appendChild(tab);
 }
 // One category on screen at a time; the phase buttons remain accessible.
 // All controls are generated from LAB_META so there are no decorative sliders.
 const labControls=new Map();
 const labCategories=node("nav","er-lab-categories");
 labCategories.setAttribute("aria-label","Catégorie des paramètres");
 const labSections=node("div","er-lab-sections");
 const labCategoryButtons=new Map(),labSectionNodes=new Map();
 const LAB_DESCRIPTIONS={
  "PILOTAGE & VITESSE":"Vitesse réelle, sensation visuelle et direction du vaisseau.",
  "TURBOS & BONUS":"Pads automatiques et nitro manuel : deux accélérations indépendantes.",
  "OBSTACLES & DIFFICULTÉ":"Quantité, variété et comportement des murs, fréquence des boucliers.",
  "MUSIQUE & LUMIÈRES":"Le morceau déclenche la vitesse, les battements et la lumière.",
  "SCORE & COMBOS":"Passages propres, near misses, murs détruits : construis la chaîne puis encaisse. Un impact efface les points en attente.",
  "TUNNEL & CAMÉRA":"Géométrie, courbes, plaques, anneaux et sensation de profondeur.",
  "PALETTE DE LA PHASE":"Sept couleurs réellement actives dans cette phase. Aucune couleur réservée à une autre phase.",
  "PERFORMANCES & TEST":"Options communes aux trois phases, réglages graphiques et diagnostic FPS."
 };
 let selectedLabCategory="PILOTAGE & VITESSE";
 function labCategorySelect(id){
  selectedLabCategory=id;
  for(const [name,entry] of labCategoryButtons){
   const on=name===id;
   entry.classList.toggle("selected",on);
   entry.setAttribute("aria-selected",String(on));
  }
  for(const [name,entry] of labSectionNodes)entry.hidden=name!==id;
  if(labBody.scrollTop>90)labBody.scrollTop=0;
 }
 function labValueText(spec,val){
  if(spec.kind==="check")return val?"ACTIF":"DÉSACTIVÉ";
  if(spec.kind==="select")return spec.options.find(o=>Number(o[0])===val)?.[1]||String(val);
  if(spec.kind==="color")return String(val).toUpperCase();
  return String(Number(Number(val).toFixed(2)))+(spec.unit?" "+spec.unit:"");
 }
 function labRefresh(){
  const phase=PHASES.find(p=>p.id===editorPhase)||PHASES[2];
  labChapterInfo.textContent=phase.title+" · "+phase.subtitle+
   (activePhase===editorPhase?" · PHASE EN COURS":" · ÉDITION HORS JEU");
  for(const [id,tab] of labPhaseTabs){
   const current=id===editorPhase;
   tab.classList.toggle("selected",current);
   tab.setAttribute("aria-pressed",String(current));
  }
  for(const spec of LAB_META){
   if(!spec.id)continue;
   const entry=labControls.get(spec.id);if(!entry)continue;
   const val=PHASE_FIELD_SET.has(spec.id)?phaseProfiles[editorPhase][spec.id]:lab[spec.id];
   if(spec.kind==="check")entry.input.checked=!!val;
   else entry.input.value=String(val);
   entry.value.textContent=labValueText(spec,val);
   if(entry.exact&&document.activeElement!==entry.exact)entry.exact.value=
    spec.kind==="color"?String(val):String(Number(Number(val).toFixed(3)));
   if(spec.onlyPhase){
    entry.row.hidden=editorPhase!==spec.onlyPhase;
   }
  }
 }
 function labChange(spec,raw){
  const perPhase=PHASE_FIELD_SET.has(spec.id);
  const target=perPhase?phaseProfiles[editorPhase]:lab;
  if(spec.kind==="check")target[spec.id]=!!raw;
  else if(spec.kind==="color"){
   if(typeof raw!=="string"||!/^#[0-9a-f]{6}$/i.test(raw))return;
   target[spec.id]=raw.toLowerCase();
  }else if(spec.kind==="select")target[spec.id]=clamp(Number(raw)||0,0,Math.max(...spec.options.map(o=>Number(o[0]))));
  else if(Number.isFinite(Number(raw)))target[spec.id]=clamp(Number(raw),spec.min,spec.max);
  else return;
  if(perPhase){
   persistPhases();
   if(activePhase===editorPhase)lab[spec.id]=target[spec.id];
  }else persistLab();
  if(spec.id==="bendFrequency")bendProfiles.clear();
  if(spec.id==="frameLimit")labLastPaint=0;
  if(spec.id==="bendFrequency"||spec.id==="bendIntensity"||spec.id==="verticalBend")bendCache.clear();
  if(spec.id==="obstaclesEnabled"&&!target[spec.id]&&activePhase===editorPhase)waves=[];
  if(spec.id==="boostPadsEnabled"&&activePhase===editorPhase){
   if(!target[spec.id]){
    pads=[];padBoostTime=0;shipBoostFade=0;turboLight=0;
   }
   nextPadAt=travel+PAD_START;
  }
  labRefresh();
  if(spec.id==="renderScale")fitCanvas();
  renderHud();
  if(mode!=="running")try{paint(performance.now());}catch(_){}
 }
 function labPreset(label,values){
  const btn=node("button","er-lab-preset",label);btn.type="button";
  btn.onclick=()=>{
   for(const [key,value] of Object.entries(values)){
    if(PHASE_FIELD_SET.has(key)){
     phaseProfiles[editorPhase][key]=value;
     if(activePhase===editorPhase)lab[key]=value;
    }else lab[key]=value;
   }
   persistPhases();persistLab();
   labRefresh();fitCanvas();renderHud();
   if(mode!=="running")try{paint(performance.now());}catch(_){}
  };
  labPresetBox.appendChild(btn);return btn;
 }
 labPreset("FLUIDITÉ",{renderScale:.65,lineCount:8,ringGap:.93,panelDetail:0,warp:false,shadows:false,particles:.3,frameLimit:45});
 labPreset("ÉQUILIBRÉ",{renderScale:.85,lineCount:16,ringGap:.66,panelDetail:1,warp:false,shadows:false,particles:.75,frameLimit:60});
 labPreset("QUALITÉ",{renderScale:1.15,lineCount:24,ringGap:.48,panelDetail:2,warp:true,shadows:true,particles:1,frameLimit:60});
 labBody.append(labIntro,labPhases,labChapterInfo,labTryPhase,labCategories,labSections);
 let currentGroup=null;
 for(const spec of LAB_META){
  if(spec.section){
   const tab=node("button","er-lab-category",spec.section);
   tab.type="button";tab.dataset.category=spec.section;
   tab.setAttribute("role","tab");
   tab.onclick=()=>labCategorySelect(spec.section);
   labCategoryButtons.set(spec.section,tab);
   labCategories.appendChild(tab);
   const group=node("section","er-lab-section-group");
   group.dataset.section=spec.section;
   group.setAttribute("role","tabpanel");
   group.appendChild(node("h3","er-lab-section",spec.section));
   group.appendChild(node("p","er-lab-section-desc",LAB_DESCRIPTIONS[spec.section]||""));
   if(spec.section==="PERFORMANCES & TEST")group.append(labPerfReadout,labPresetBox);
   labSections.appendChild(group);
   labSectionNodes.set(spec.section,group);
   currentGroup=group;
   continue;
  }
  if(!currentGroup)throw Error("LAB_META group missing for "+spec.id);
  const line=node("div","er-lab-row");
  line.dataset.labKey=spec.id;
  line.dataset.scope=spec.global?"global":"phase";
  const top=node("div","er-lab-row-head");
  const label=node("label","er-lab-label",spec.label);
  label.htmlFor="er-lab-"+spec.id;
  const cost=node("span","er-lab-impact",spec.global?"GLOBAL · "+spec.cost:"PHASE · "+spec.cost);
  cost.dataset.impact=spec.cost;
  cost.title=spec.global?"Commun aux trois phases":"Ajusté uniquement dans la phase sélectionnée";
  top.append(label,cost);
  const controls=node("div","er-lab-row-controls");
  let input;
  if(spec.kind==="select"){
   input=node("select","er-lab-input");
   for(const [value,caption] of spec.options){
    const option=node("option","",caption);option.value=value;input.appendChild(option);
   }
  }else{
   input=node("input","er-lab-input");
   input.type=spec.kind==="check"?"checkbox":spec.kind==="color"?"color":"range";
   if(spec.min!==undefined){input.min=String(spec.min);input.max=String(spec.max);input.step=String(spec.step);}
  }
  input.id="er-lab-"+spec.id;
  input.dataset.labId=spec.id;
  input.setAttribute("aria-label",spec.label);
  const output=node("output","er-lab-output");
  let exact=null;
  if(spec.kind==="color"||!spec.kind){
   exact=node("input","er-lab-exact");
   exact.type=spec.kind==="color"?"text":"number";
   exact.setAttribute("aria-label","Valeur exacte : "+spec.label);
   if(spec.kind==="color"){exact.maxLength=7;exact.spellcheck=false;}
   else {exact.min=String(spec.min);exact.max=String(spec.max);exact.step=String(spec.step);}
   exact.addEventListener("change",()=>{
    labChange(spec,exact.value);
    labRefresh();
   });
  }
  controls.append(input,output);
  if(exact)controls.appendChild(exact);
  line.append(top,controls);
  if(spec.help)line.appendChild(node("small","er-lab-help",spec.help));
  input.addEventListener("input",()=>labChange(spec,spec.kind==="check"?input.checked:input.value));
  input.addEventListener("change",()=>labChange(spec,spec.kind==="check"?input.checked:input.value));
  labControls.set(spec.id,{row:line,input,value:output,exact});
  currentGroup.appendChild(line);
 }
 labCategorySelect(selectedLabCategory);
 const labActions=node("div","er-lab-actions");
 const labReset=node("button","er-lab-reset","RESET CETTE PHASE");
 labReset.type="button";
 labReset.title="Réinitialiser uniquement les paramètres de la phase sélectionnée";
 labReset.onclick=()=>{
  for(const key of PHASE_FIELDS)phaseProfiles[editorPhase][key]=phaseDefaultValue(editorPhase,key);
  persistPhases();
  if(activePhase===editorPhase)applyPhase(editorPhase);
  labRefresh();renderHud();
 };
 const labExport=node("button","er-lab-export-button","COPIER TOUTES LES PHASES");
 labExport.type="button";
 const labExportStatus=node("div","er-lab-export-status","");
 const labExportText=node("textarea","er-lab-export-text");
 labExportText.readOnly=true;labExportText.hidden=true;labExportText.rows=6;
 labExportText.setAttribute("aria-label","Paramètres complets à transmettre pour finaliser Echo Racer");
 labExport.onclick=()=>{
  const all=exportTuningJSON();
  labExportText.value=all;labExportText.hidden=false;
  labExportText.focus();labExportText.select();
  labExportStatus.textContent="Réglages des 3 phases prêts à envoyer.";
  if(navigator.clipboard&&navigator.clipboard.writeText){
   navigator.clipboard.writeText(all).then(()=>{
    labExportStatus.textContent="Copié. Colle le texte dans notre conversation pour valider tes réglages.";
   }).catch(()=>{
    labExportStatus.textContent="Sélectionne et copie le texte ci-dessous pour me l'envoyer.";
   });
  }else labExportStatus.textContent="Sélectionne et copie le texte ci-dessous pour me l'envoyer.";
 };
 const labCloseBottom=node("button","er-lab-close-bottom","FERMER");
 labCloseBottom.type="button";
 labActions.append(labReset,labCloseBottom);
 labBody.append(labActions,labExport,labExportStatus,labExportText,node("p","er-lab-disclaimer",
  "Envoie le JSON copié quand les 3 phases sont prêtes : je pourrai les intégrer comme réglages finaux du jeu. Coût estimé : TRÈS ÉLEVÉ → ÉLEVÉ → MOYEN → FAIBLE. Les FPS sont mesurés en direct ; KM/H est une échelle arcade."));
 labPanel.append(labBar,labBody);
 // Keep TEST configuration on the physical instrument housing, never over
 // the upper-right score or over the flight display.
 dashboard.appendChild(labToggle);
 wrap.appendChild(labPanel);
 function labOpen(){
  if(!testMode||window.matchMedia("(max-width:700px)").matches)return;
  const api=window.ZebraEchoLabWindow;
  const nativeHost=api&&typeof api.open==="function"?api.open():null;
  if(nativeHost){
   // Genuine sibling ZebraOS desktop window: independently movable,
   // resizable/minimizable and present in the taskbar, outside the game.
   nativeHost.replaceChildren(labPanel);
   nativeHost.classList.add("er-lab-native-host");
   nativeHost._zebraDispose=()=>{
    labPanel.hidden=true;
    labPanel.remove();
    labPanel.classList.remove("er-lab-native");
   };
   labPanel.classList.remove("er-lab-floating");
   labPanel.classList.add("er-lab-native");
  }else{
   // The standalone game harness has no desktop window manager.
   // Keep the editor genuinely outside the game canvas and clipping.
   document.body.appendChild(labPanel);
   labPanel.classList.remove("er-lab-native");
   labPanel.classList.add("er-lab-floating");
   labPanel.style.setProperty("left",Math.max(10,window.innerWidth-465)+"px","important");
   labPanel.style.setProperty("top","66px","important");
  }
  labPanel.hidden=false;
  labRefresh();
 }
 function labHide(){
  labPanel.hidden=true;
  if(labPanel.classList.contains("er-lab-native")&&
    window.ZebraEchoLabWindow&&window.ZebraEchoLabWindow.isOpen()){
   window.ZebraEchoLabWindow.close();
  }else{
   labPanel.remove();
  }
  labPanel.classList.remove("er-lab-native","er-lab-floating");
 }
 labToggle.onclick=()=>labPanel.hidden?labOpen():labHide();
 labClose.onclick=labCloseBottom.onclick=labHide;
 labRefresh();
 // Drag the floating window by its title bar; controls remain operable.
 let labDrag=null;
 labBar.addEventListener("pointerdown",e=>{
  // Native ZebraOS windows move via the OS titlebar, not this sub-header.
  if(!labPanel.classList.contains("er-lab-floating")||
    e.target.closest("button")||e.button!==0)return;
  const box=labPanel.getBoundingClientRect();
  labDrag={pointer:e.pointerId,x:e.clientX,y:e.clientY,
   left:box.left,top:box.top};
  try{labBar.setPointerCapture(e.pointerId);}catch(_){}
 });
 labBar.addEventListener("pointermove",e=>{
  if(!labDrag||e.pointerId!==labDrag.pointer)return;
  const left=clamp(labDrag.left+e.clientX-labDrag.x,0,Math.max(0,window.innerWidth-labPanel.offsetWidth));
  const top=clamp(labDrag.top+e.clientY-labDrag.y,0,Math.max(0,window.innerHeight-labPanel.offsetHeight));
  labPanel.style.setProperty("left",left+"px","important");
  labPanel.style.setProperty("top",top+"px","important");
  labPanel.style.right="auto";
 });
 for(const name of ["pointerup","pointercancel","lostpointercapture"]){
  labBar.addEventListener(name,e=>{if(labDrag&&e.pointerId===labDrag.pointer)labDrag=null;});
 }
 let labFps=0,labFpsFrames=0,labFpsStart=0,labLastPaint=0;
 // TEMPORARY LCD POSITION EDITOR — live drag on PC or phone, persisted
 // separately at narrow and wide breakpoints. No code editing required.
 const cfgButton=node("button","er-config-toggle","⚙ CONFIG");
 cfgButton.type="button";cfgButton.setAttribute("aria-label","Ouvrir les réglages temporaires du compteur");
 dashboard.appendChild(cfgButton);
 const cfgPanel=node("section","er-config-panel");
 cfgPanel.setAttribute("role","dialog");cfgPanel.setAttribute("aria-label","Placement du compteur");
 cfgPanel.hidden=true;
 const cfgHeading=node("div","er-config-heading");
 const cfgTitle=node("strong","","POSITION DES CHIFFRES");
 const cfgClose=node("button","er-config-close","✕");
 cfgClose.type="button";cfgClose.setAttribute("aria-label","Fermer les réglages");
 cfgHeading.append(cfgTitle,cfgClose);
 const cfgInstructions=node("p","er-config-help",
  "Choisis un élément puis déplace-le au doigt ou à la souris sur l'écran du compteur. Ajuste X/Y si besoin.");
 const cfgSelect=node("select","er-config-select");cfgSelect.setAttribute("aria-label","Élément à déplacer");
 const cfgTargets={
  speedTitle:{label:"VITESSE · titre",element:speedGauge.row.querySelector(".er-dashboard-name")},
  speedDigits:{label:"VITESSE · chiffres",element:speedGauge.value},
  speedUnit:{label:"VITESSE · KM/H",element:speedGauge.row.querySelector(".er-dashboard-unit")},
  boostTitle:{label:"BOOST · titre",element:boostGauge.row.querySelector(".er-dashboard-name")},
  boostDigits:{label:"BOOST · chiffres",element:boostGauge.value},
  boostUnit:{label:"BOOST · %",element:boostGauge.row.querySelector(".er-dashboard-unit")}
 };
 for(const [id,entry] of Object.entries(cfgTargets)){
  const option=node("option","",entry.label);option.value=id;cfgSelect.appendChild(option);
  entry.element.dataset.erConfigId=id;
 }
 // User-approved positions are now the built-in baseline for everyone.
 // On mobile, both BOOST and VITESSE share the exact same title/digit/unit Y.
 // CONFIG stays available for further tweaks without changing game code.
 const LCD_DEFAULTS={
  desktop:{
   speedTitle:{x:-3.5,y:8.5},speedDigits:{x:-1,y:10.75},speedUnit:{x:0,y:0},
   boostTitle:{x:-2,y:8.5},boostDigits:{x:0,y:10.75},boostUnit:{x:0,y:0}
  },
  mobile:{
   speedTitle:{x:-3,y:16.5},speedDigits:{x:0,y:18},speedUnit:{x:1.25,y:11.75},
   boostTitle:{x:-2.25,y:16.5},boostDigits:{x:0,y:18},boostUnit:{x:1,y:11.75}
  }
 };
 const LCD_LAYOUT_KEY="lcd.positions.v2.";
 let cfgChosen="speedDigits",cfgMode="",cfgLayout={};
 function cfgBreakpoint(){return window.matchMedia("(max-width:700px)").matches?"mobile":"desktop";}
 function cfgLoad(mode){
  let obj={};try{obj=JSON.parse(load(LCD_LAYOUT_KEY+mode,"{}"))||{};}catch(_){}
  const defaults=LCD_DEFAULTS[mode],result={};
  for(const id of Object.keys(cfgTargets)){
   const v=obj[id]||{};
   result[id]={
    x:clamp(Number.isFinite(Number(v.x))&&v.x!==undefined?Number(v.x):defaults[id].x,-30,30),
    y:clamp(Number.isFinite(Number(v.y))&&v.y!==undefined?Number(v.y):defaults[id].y,-45,45)
   };
  }
  return result;
 }
 function cfgSave(){save(LCD_LAYOUT_KEY+cfgMode,JSON.stringify(cfgLayout));}
 const cfgX=node("input","er-config-range"),cfgY=node("input","er-config-range");
 const cfgXNumber=node("output","er-config-value"),cfgYNumber=node("output","er-config-value");
 function cfgControl(label,input,output){
  const line=node("label","er-config-control");
  const name=node("span","",label);line.append(name,input,output);return line;
 }
 for(const input of [cfgX,cfgY]){input.type="range";input.min="-30";input.max="30";input.step=".25";}
 cfgY.min="-45";cfgY.max="45";
 const cfgReset=node("button","er-config-action","POSITION PAR DÉFAUT");
 cfgReset.type="button";
 const cfgResetAll=node("button","er-config-action","POSITIONS PAR DÉFAUT");
 cfgResetAll.type="button";
 const cfgCopy=node("button","er-config-action","COPIER MES POSITIONS");
 cfgCopy.type="button";
 const cfgInfo=node("div","er-config-info","Réglages enregistrés sur cet appareil.");
 const cfgActions=node("div","er-config-actions");
 cfgActions.append(cfgReset,cfgResetAll,cfgCopy);
 cfgPanel.append(cfgHeading,cfgInstructions,cfgSelect,
  cfgControl("Horizontal",cfgX,cfgXNumber),
  cfgControl("Vertical",cfgY,cfgYNumber),cfgActions,cfgInfo);
 wrap.appendChild(cfgPanel);
 function cfgApply(){
  const mode=cfgBreakpoint();
  if(cfgMode!==mode){cfgMode=mode;cfgLayout=cfgLoad(mode);}
  const width=dashboard.clientWidth||1,height=dashboard.clientHeight||1;
  for(const [id,entry] of Object.entries(cfgTargets)){
   const pos=cfgLayout[id]||{x:0,y:0};
   entry.element.style.translate=(pos.x*width/100).toFixed(2)+"px "+
    (pos.y*height/100).toFixed(2)+"px";
  }
 }
 function cfgRefresh(){
  cfgApply();
  const pos=cfgLayout[cfgChosen];
  cfgSelect.value=cfgChosen;
  cfgX.value=String(pos.x);cfgY.value=String(pos.y);
  cfgXNumber.textContent=pos.x.toFixed(2)+" %";
  cfgYNumber.textContent=pos.y.toFixed(2)+" %";
  for(const [id,entry] of Object.entries(cfgTargets))
   entry.element.classList.toggle("er-config-selected",id===cfgChosen&&!cfgPanel.hidden);
  cfgInfo.textContent="Mode "+(cfgMode==="mobile"?"MOBILE":"PC")+" · enregistré automatiquement";
 }
 function cfgSet(id,axis,v,commit=true){
  cfgApply();cfgLayout[id][axis]=clamp(Number(v)||0,axis==="x"?-30:-45,axis==="x"?30:45);
  cfgApply();if(commit)cfgSave();cfgRefresh();
 }
 function cfgOpen(){
  cfgPanel.hidden=false;wrap.classList.add("er-config-open");
  cfgButton.setAttribute("aria-expanded","true");
  keys.clear();endNitro();cfgRefresh();
 }
 function cfgHide(){
  cfgPanel.hidden=true;wrap.classList.remove("er-config-open");
  cfgButton.setAttribute("aria-expanded","false");cfgRefresh();
 }
 cfgButton.setAttribute("aria-expanded","false");
 cfgButton.addEventListener("click",()=>cfgPanel.hidden?cfgOpen():cfgHide());
 cfgClose.addEventListener("click",cfgHide);
 cfgSelect.addEventListener("change",()=>{cfgChosen=cfgSelect.value;cfgRefresh();});
 cfgX.addEventListener("input",()=>cfgSet(cfgChosen,"x",cfgX.value));
 cfgY.addEventListener("input",()=>cfgSet(cfgChosen,"y",cfgY.value));
 cfgReset.addEventListener("click",()=>{
  cfgLayout[cfgChosen]={...LCD_DEFAULTS[cfgMode][cfgChosen]};cfgApply();cfgSave();cfgRefresh();
 });
 cfgResetAll.addEventListener("click",()=>{
  for(const id of Object.keys(cfgTargets))cfgLayout[id]={...LCD_DEFAULTS[cfgMode][id]};
  cfgApply();cfgSave();cfgRefresh();
 });
 cfgCopy.addEventListener("click",async()=>{
  const msg="Echo Racer LCD "+cfgMode+": "+JSON.stringify(cfgLayout);
  try{await navigator.clipboard.writeText(msg);cfgInfo.textContent="POSITIONS COPIÉES";}
  catch(_){cfgInfo.textContent=msg;}
 });
 cfgPanel.addEventListener("pointerdown",e=>e.stopPropagation());
 cfgPanel.addEventListener("keydown",e=>e.stopPropagation());
 let cfgDragging=null;
 for(const [id,entry] of Object.entries(cfgTargets)){
  const el=entry.element;
  el.addEventListener("pointerdown",e=>{
   if(cfgPanel.hidden||cfgDragging||e.button!==0)return;
   e.preventDefault();e.stopPropagation();
   cfgChosen=id;cfgRefresh();
   cfgDragging={id,pointer:e.pointerId,clientX:e.clientX,clientY:e.clientY,
    x:cfgLayout[id].x,y:cfgLayout[id].y};
   try{el.setPointerCapture(e.pointerId);}catch(_){}
  });
  el.addEventListener("pointermove",e=>{
   if(!cfgDragging||cfgDragging.id!==id||cfgDragging.pointer!==e.pointerId)return;
   e.preventDefault();e.stopPropagation();
   cfgLayout[id].x=clamp(cfgDragging.x+(e.clientX-cfgDragging.clientX)*100/Math.max(1,dashboard.clientWidth),-30,30);
   cfgLayout[id].y=clamp(cfgDragging.y+(e.clientY-cfgDragging.clientY)*100/Math.max(1,dashboard.clientHeight),-45,45);
   cfgApply();cfgRefresh();
  });
  for(const type of ["pointerup","pointercancel","lostpointercapture"]){
   el.addEventListener(type,e=>{
    if(!cfgDragging||cfgDragging.id!==id||cfgDragging.pointer!==e.pointerId)return;
    e.stopPropagation();cfgDragging=null;cfgSave();cfgRefresh();
   });
  }
 }
 cfgApply();
 function fitCanvas(){
  if(!live)return;
  const bounds=screen.getBoundingClientRect();
  if(!bounds.width||!bounds.height)return;
  W=Math.max(150,Math.round(bounds.width));H=Math.max(180,Math.round(bounds.height));
  renderDpr=clamp(Math.min(W<520?1.25:1.5,window.devicePixelRatio||1)*lab.renderScale,.55,1.5);
  geometryCache={cx:W*.5,cy:H*.39,R:Math.max(W,H)*1.23,offset:5/9};
  const bw=Math.round(W*renderDpr),bh=Math.round(H*renderDpr);
  if(canvas.width!==bw||canvas.height!==bh){canvas.width=bw;canvas.height=bh;}
  cfgApply();
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
   music.loop=false;music.volume=.82;music.preload="none";
   // Song 1 has a silent encoded tail. Its audible finish at ~217 s
   // triggers the five-second blackout. Song 2 plays ONLY in blue phase.
   music.addEventListener("timeupdate",()=>{
    if(selectedLevel.arcade&&!testMode)return;
    if(!live||mode!=="running"||encoreMode!=="normal"
     ||musicTrackId!=="p1"||music.currentTime<MUSIC_TAIL_AT)return;
    beginEncore();
   });
   music.addEventListener("ended",()=>{
    if(!live||mode!=="running"||!soundEnabled)return;
    if(selectedLevel.arcade&&!testMode){finishArcadeLevel("music-ended");return;}
    if(musicTrackId==="p1"&&encoreMode==="normal"){beginEncore();return;}
    if(musicTrackId==="p3"&&encoreMode==="blue")
     beginFinale("song-ended");
   });
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
 function selectMusicTrack(phase){
  const track=ensureMusic();if(!track)return null;
  const wanted=phase==="p3"?"p3":"p1";
  if(musicTrackId!==wanted){
   musicRequest++;
   try{track.pause();}catch(_){}
   musicTrackId=wanted;
   track.src=wanted==="p3"?musicUrlPhase3:musicUrl;
   track.loop=false;
   track.preload="auto";
   try{track.load();}catch(_){}
  }else track.loop=false;
  return track;
 }
 function startMusicAtPhase(phase,seconds){
  if(!soundEnabled||globalMuted()||document.hidden)return;
  const track=selectMusicTrack(phase);if(!track)return;
  const request=++musicRequest,expected=phase==="p3"?"p3":"p1";
  const play=()=>{
   if(!live||mode!=="running"||encoreMode==="transition"||
      musicRequest!==request||musicTrackId!==expected)return;
   try{track.currentTime=Math.max(0,seconds);}catch(_){}
   startMusic(false);
  };
  if(track.readyState>=1)play();
  else{
   track.addEventListener("loadedmetadata",play,{once:true});
   try{track.load();}catch(_){}
  }
 }
 function startMusic(rewind){
  if(!live||!soundEnabled||globalMuted()||document.hidden||encoreMode==="transition")return;
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
 function startMusicAt(seconds){
  // Song 1 belongs to the first two chapters, song 2 to the blue chapter.
  startMusicAtPhase(encoreMode==="blue"?"p3":"p1",seconds);
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
  if(bass>.25/lab.beatSensitivity&&bass-baseline>.085/lab.beatSensitivity&&audioFx.beatCooldown<=0){
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
 function showReward(label,kind="skill",seconds=1.25){
  // Non-scoring cues have their own short SFX. Do not spam on-screen
  // messages with "nitro ready", "pulse earned", "banked" or collisions.
  if(kind!=="skill"&&kind!=="near")return;
  rewardText=label;rewardKind=kind;rewardLife=Math.min(1.6,Math.max(.4,seconds));
 }
 function playRewardCue(kind){
  if(Object.prototype.hasOwnProperty.call(rewardCueCounts,kind))rewardCueCounts[kind]++;
  if(!live||!soundEnabled||globalMuted()||!lab.rewardSfxVolume)return;
  try{
   const ctx=ensureAudioContext();if(!ctx)return;
   if(ctx.state==="suspended")ctx.resume().catch(()=>{});
   const t=ctx.currentTime;
   const notes=kind==="nitroReady"?[[0,520,.09],[.09,780,.105],[.19,1040,.19]]:
    kind==="pulseReady"?[[0,760,.075],[.075,1020,.14]]:
    kind==="chainStep"?[[0,400,.045],[.065,580,.10]]:
    [[0,490,.08],[.09,690,.085],[.18,920,.095],[.29,1170,.23]];
   for(const [delay,freq,duration] of notes){
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.type=kind==="bank"?"triangle":"sine";
    const start=t+delay,volume=Math.max(.0001,.034*lab.rewardSfxVolume);
    o.frequency.setValueAtTime(freq,start);
    o.frequency.exponentialRampToValueAtTime(freq*1.075,start+duration);
    g.gain.setValueAtTime(.0001,start);
    g.gain.exponentialRampToValueAtTime(volume,start+.012);
    g.gain.exponentialRampToValueAtTime(.0001,start+duration);
    o.connect(g);g.connect(ctx.destination);
    o.start(start);o.stop(start+duration+.012);
   }
  }catch(_){}
 }
 function bankSkill(reason="ENCAISSÉ"){
  if(skillBank<1)return 0;
  // Points have already been added as each action happened. Closing the
  // chain only resets its multiplier; it never awards them twice.
  const reward=Math.round(skillBank);
  bankedCount++;
  skillBank=0;skillChain=combo=0;skillMultiplier=0;skillTimer=skillAge=0;
  return reward;
 }
 function breakCombo(){
  // A collision cancels ONLY the multiplier, never the player's score.
  skillBank=0;skillChain=combo=0;skillMultiplier=0;skillTimer=skillAge=0;
  cleanPassStreak=0;
  rewardLife=0;rewardText="";rewardKind="";scoreToast.hidden=true;
 }
 function awardSkill(kind,base,title){
  if(mode!=="running"||encoreMode==="transition"||selectedLevel.id==="free")return 0;
  skillChain++;combo=skillChain;
  skillMultiplier=Math.min(lab.comboMax,1+Math.floor((skillChain-1)/lab.comboEvery));
  const gained=Math.round(base*skillMultiplier*scoreMultiplier);
  // Immediately update the real score, as in arcade racing games.
  score+=gained;bankedTotal+=gained;
  skillBank+=gained;skillTimer=lab.comboTimeout;
  if(kind==="near")nearMisses++;
  if(skillChain>1&&skillChain%lab.comboEvery===1)playRewardCue("chainStep");
  showReward(title+" +"+gained.toLocaleString("fr-CH"),
   kind==="near"?"near":"skill",1.15);
  // Give visual feedback on the exact scoring frame; the ordinary
  // 90ms HUD throttle would otherwise hide the fifth clean gate bonus.
  renderHud();
  return gained;
 }
 function tickSkill(dt){
  if(mode!=="running")return;
  rewardLife=Math.max(0,rewardLife-dt);
  if(skillBank<=0)return;
  skillTimer=Math.max(0,skillTimer-dt);
  skillAge+=dt;
  if(skillTimer===0||skillAge>=lab.comboCashout)bankSkill("COMBO ENCAISSÉ");
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
  // Fixed phosphor label already uses the same segmented font as the digits.
  setDigital(scoreEl,String(Math.floor(score)).padStart(5,"0"));
  const playing=mode==="running"||mode==="paused";
  const showMultiplier=playing&&skillChain>0&&skillMultiplier>=2;
  scoreCombo.classList.toggle("active",showMultiplier);
  scoreCombo.classList.toggle("hot",skillMultiplier>=5);
  scoreCombo.setAttribute("aria-hidden",String(!showMultiplier));
  skillComboEl.textContent=showMultiplier?"×"+skillMultiplier:"";
  scoreTop.classList.toggle("active",playing);
  scoreTotal.textContent=Math.floor(score).toLocaleString("fr-CH");
  scoreToast.hidden=!playing||rewardLife<=0||!rewardText;
  scoreToast.textContent=!scoreToast.hidden?rewardText:"";
  scoreToast.dataset.kind=rewardKind;
  setDigital(bestEl,String(Math.floor(best)).padStart(5,"0"));
  setDigital(shieldEl,String(lives).padStart(2,"0"));
  setDigital(energyEl,String(pulseCharge).padStart(2,"0"));
  shieldEl._erSlots.forEach((el,i)=>el.classList.toggle("lit",i<lives));
  energyEl._erSlots.forEach((el,i)=>el.classList.toggle("lit",i<pulseCharge));
  const speed=Math.round((mode==="menu"?0:currentSpeed)*lab.displayScale);
  setDigital(speedGauge.value,String(speed).padStart(3,"0"));
  lightSegments(speedGauge.segments,clamp(speed/310,0,1));
  const free=selectedLevel.id==="free";
  const active=mode==="running"&&(nitroActive||padBoostTime>0);
  // Show zero on the start screen; fill naturally after a race begins.
  const charge=mode==="menu"?0:free?freeChargeVisual:nitroFuel;
  setDigital(boostGauge.value,free&&mode!=="menu"&&charge>=.999?"∞":
   String(Math.round(charge*100)).padStart(3,"0"));
  boostGauge.statusEl.textContent=mode==="menu"?"EN VEILLE":padBoostTime>0?"TURBO":nitroActive?"NITRO":free?(charge>=.999?"ILLIMITÉ":"CHARGE"):
   charge>=.999?"PRÊT":nitroRegenWait>0?"PAUSE":"RECHARGE";
  boostGauge.row.classList.toggle("er-dashboard-active",active);
  dashboard.classList.toggle("er-boost-active",active);
  boostGauge.fill.setAttribute("width",String(Math.round(clamp(charge,0,1)*552*10)/10));
  // No duplicate "near miss/combo/boost" notifications elsewhere on the
  // canvas. Keep only actual game state notices in the small lower corner.
  const gameNotice=mode==="running"&&messageLife>0&&
   !/NEAR MISS|COMBO|TURBO PAD|BOUCLIER|MUR DÉTRUIT|PULSE \+1/.test(message);
  eventText.textContent=gameNotice?message:"";
  eventText.classList.toggle("visible",!!gameNotice);
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
 function restartRun(){start(testMode,testLaunchPhase);}
 function start(testPhase=false,requestedPhase=testLaunchPhase){
  if(mode==="crashing"||(mode==="over"&&deathLock>0))return;
  deathFade=deathLock=0;crashCurtain.hidden=true;crashCurtain.style.opacity="0";
  finaleOverlay.hidden=true;finaleTime=0;finaleCause="";phase3Elapsed=0;finaleSelection=0;
  lockDeathControls(false);
  musicRequest++;pauseMusic();
  resetSteering();mode="running";angle=0;turnVelocity=0;lives=MAX_LIVES;score=distance=travel=passed=combo=0;
  hudTimer=bestSaveTimer=audioSampleTimer=0;
  skillBank=skillChain=skillTimer=skillAge=bankedTotal=bankedCount=nearMisses=0;
  cleanPassStreak=cleanBonusCount=0;
  skillMultiplier=0;rewardLife=0;rewardText=rewardKind="";
  nitroFullLatched=false;
  for(const kind of Object.keys(rewardCueCounts))rewardCueCounts[kind]=0;
  scoreToast.hidden=true;scoreCombo.classList.remove("active");
  waves=[];pads=[];shields=[];
  nextGateAt=selectedLevel.id==="free"?Infinity:START_GATE_AT;
  nextPadAt=selectedLevel.id==="free"?Infinity:PAD_START;
  nextShieldAt=selectedLevel.id==="free"?Infinity:SHIELD_START;
  lastGateAt=-100;elapsed=0;nextWave=-1;gateCount=0;padCount=0;shieldCount=0;
  directorStage=0;musicDropSurge=0;musicLoops=0;
  encoreMode="normal";encoreTime=0;testMode=testPhase===true;
  wrap.dataset.circuit=!testMode&&selectedLevel.arcade?selectedLevel.id:"test";
  if(testMode&&PHASES.some(p=>p.id===requestedPhase))testLaunchPhase=requestedPhase;
  applyPhase("p1");
  trail=[];sparks=[];currentSpeed=0;scoreMultiplier=1;
  invuln=0;pulseCharge=2;pulseGlow=pulseFx=pulseHitFx=shieldFlash=padBoostTime=flash=shake=0;
  shieldCollect.classList.remove("er-shield-collected");
  nitroHeld=false;nitroActive=false;nitroFuel=0;nitroRegenWait=0;nitroBurnTime=0;freeChargeVisual=0;
  shipBoostFade=0;turboLight=0;warningLife=0;warningBeepDelay=0;warningChirp=0;
  screen.classList.remove("er-death","er-crashing");
  overlay.classList.remove("er-stage-over","er-stage-pause");pauseActions.hidden=true;
  crashIcon.hidden=true;crashSub.hidden=true;
  message=testMode?"MODE TEST · "+(PHASES.find(p=>p.id===testLaunchPhase)||PHASES[2]).title:
   selectedLevel.id==="free"?"FREE ROAM · BOOST ILLIMITÉ":"TROUVE LE PASSAGE";
  messageLife=testMode?3:2;keys.clear();levelPicker.hidden=true;
  testButton.hidden=true;labToggle.hidden=!testMode;
  if(!testMode)labHide();
  backButton.hidden=true;overlay.hidden=true;
  if(testMode){
   if(testLaunchPhase==="p3"){
    // Same final blue environment as the real song outro, instantly.
    encoreMode="transition";encoreTime=ENCORE_TRANSITION_SECONDS;
    completeEncore();
   }else if(testLaunchPhase==="p2"){
    elapsed=MUSIC_DROP_AT+2;directorStage=2;
    musicDropSurge=.55;applyPhase("p2");
   }
   message="MODE TEST · "+(PHASES.find(p=>p.id===testLaunchPhase)||PHASES[2]).title;
   messageLife=3;
  }
  // Draw the first tunnel frame immediately: avoid a blank panel when
  // Android throttles its first animation frame after a touch gesture.
  fitCanvas();
  try{paint(performance.now());}catch(error){console.error("Echo Racer initial frame",error);}
  beep("collect");
  if(!testMode&&selectedLevel.arcade)startMusicAtPhase(selectedLevel.track,selectedLevel.musicAt);
  else if(!testMode||testLaunchPhase==="p1")startMusicAtPhase("p1",0);
  else if(testLaunchPhase==="p2")startMusicAtPhase("p1",MUSIC_DROP_AT+2);
  renderHud();
 }
 function toMenu(){
  if(mode==="crashing"||(mode==="over"&&deathLock>0))return;
  deathFade=deathLock=0;crashCurtain.hidden=true;crashCurtain.style.opacity="0";
  screen.classList.remove("er-crashing");lockDeathControls(false);
  finaleOverlay.hidden=true;finaleTime=0;
  if(!testMode&&mode!=="menu"&&score>0)save("best."+selectedLevel.id,best);
  musicRequest++;resetSteering();stopMusic();mode="menu";keys.clear();waves=[];pads=[];shields=[];trail=[];turnVelocity=0;
  shieldCollect.classList.remove("er-shield-collected");pulseFx=pulseHitFx=shieldFlash=0;
  elapsed=0;encoreMode="normal";encoreTime=0;testMode=false;wrap.dataset.circuit="menu";labToggle.hidden=true;labHide();padBoostTime=0;nitroHeld=false;nitroActive=false;nitroFuel=0;nitroRegenWait=0;nitroBurnTime=0;freeChargeVisual=0;
  currentSpeed=0;score=0;scoreMultiplier=1;warningLife=0;warningBeepDelay=0;
  skillBank=skillChain=skillAge=skillTimer=0;skillMultiplier=0;rewardLife=0;
  cleanPassStreak=0;
  overlay.hidden=false;renderMenuStage("home");
  renderHud();
 }
 function gameOver(){
  if(mode!=="running")return;
  musicRequest++;stopMusic();nitroHeld=false;nitroActive=false;mode="crashing";labToggle.hidden=true;labHide();
  keys.clear();dragPointer=null;deathFade=0;deathLock=0;
  warningLife=0;warningBeepDelay=0;
  flash=.55;shake=7;
  // Score already belongs to the player. Game Over only ends the streak.
  breakCombo();
  if(!testMode&&score>best){best=Math.floor(score);save("best."+selectedLevel.id,best);}
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
  levelPicker.hidden=true;testButton.hidden=true;backButton.hidden=false;
  status.hidden=false;status.textContent="SCORE "+Math.floor(score)+"  ·  RECORD "+best;
  prompt.hidden=true;expl.hidden=true;hint.hidden=true;
  overlayButton.hidden=false;overlayButton.classList.add("er-overlay-restart");
  overlayButton.textContent="↻ REJOUER";overlayButton.setAttribute("aria-label","Recommencer le niveau");
  crashCurtain.hidden=true;lockDeathControls(true);overIndex=0;paintMenuSelection();renderHud();
 }
 function togglePause(){
  if(mode==="crashing"||(mode==="over"&&deathLock>0))return;
  if(mode==="running"){resetSteering();endNitro();mode="paused";pauseIndex=0;
   testButton.hidden=true;introDiagnostic.hidden=true;introTrack.hidden=true;pauseMusic();turnVelocity=0;dragPointer=null;keys.clear();levelPicker.hidden=true;backButton.hidden=true;overlay.hidden=false;
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
 function burst(position,color,count,depth=1.6,wide=false){
  const a=typeof position==="number"?position:angle;
  for(let i=0;i<count;i++){
   const life=rand(wide?.46:.20,wide?1.05:.58);
   sparks.push({
    a:a+rand(wide?-1.1:-.27,wide?1.1:.27),
    z:Math.max(.35,depth+rand(wide?-1.4:-.65,wide?1.4:.65)),
    va:rand(wide?-3:-1.2,wide?3:1.2),vz:rand(-3.5,1.3),
    life,max:life,color,size:wide?rand(2.5,6.3):4
   });
  }
  if(sparks.length>160)sparks.splice(0,sparks.length-160);
 }
 function shatterWave(target){
  // Actual debris comes from each part of the broken wall.
  for(const id of target.sectors){
   if(sparks.length>147)break;
   burst(obstacleAngle(target,id),"#ffd6f5",3,target.z,true);
  }
  burst(angle,"#b6f7ff",45,Math.max(1.4,target.z),true);
  pulseHitFx=1;shake=Math.max(shake,2.7);
 }
 function pulse(){
  if(mode!=="running"||pulseCharge<=0)return;
  pulseCharge--;pulseGlow=.95;pulseFx=1;beep("pulse");
  const target=waves.filter(w=>!w.cleared&&w.z>=HIT_Z-.6&&w.z<=HIT_Z+PULSE_REACH)
   .sort((a,b)=>a.z-b.z)[0];
  if(target){
   target.cleared=true;
   const gained=awardSkill("pulse",lab.scorePulse,"PULSE BREAK");
   message="MUR DÉTRUIT · +"+gained+" EN COMBO";messageLife=1.45;
   shatterWave(target);
  }else{message="ONDE LIBÉRÉE";messageLife=1.05;burst(angle,"#a6faff",30,2.1,true);}
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
  if(selectedLevel.id!=="free"&&nitroFuel<1)nitroRegenWait=lab.nitroRegenDelay;
  // The fade-out is finished on animation frames, not at key release.
  renderHud();
 }
 function updateNitro(dt){
  if(mode!=="running")return;
  if(selectedLevel.id==="free")freeChargeVisual=clamp(freeChargeVisual+dt/lab.nitroRefillSeconds,0,1);
  if(nitroActive)nitroBurnTime+=dt;
  if(nitroActive&&selectedLevel.id!=="free"){
   nitroFuel=clamp(nitroFuel-dt/lab.nitroBurnSeconds,0,1);
   if(nitroFuel<=0){
    nitroActive=false;nitroBurnTime=0;nitroRegenWait=lab.nitroRegenDelay;
   }
  }else if(!nitroHeld&&selectedLevel.id!=="free"&&nitroFuel<1){
   nitroRegenWait=Math.max(0,nitroRegenWait-dt);
   if(nitroRegenWait<=0)nitroFuel=clamp(nitroFuel+dt/lab.nitroRefillSeconds,0,1);
  }
  if(selectedLevel.id!=="free"){
   if(nitroFuel>=.999&&!nitroFullLatched){
    nitroFullLatched=true;
    playRewardCue("nitroReady");
    showReward("NITRO PRÊT · 100%","nitro",1.5);
   }else if(nitroFuel<.96)nitroFullLatched=false;
  }
 }
 function createWave(){
  const tiers=[
   [0,1,3,7,10,13],
   [0,1,3,7,10,13,2,5,11,14,16],
   [0,1,2,3,4,5,6,7,9,10,11,12,13,14,16,17,18],
   Array.from({length:PATTERN_COUNT},(_,i)=>i)
  ];
  const level=encoreMode==="blue"?3:directorStage<2?0:directorStage<4?1:directorStage<6?2:3;
  const choices=tiers[clamp(level+lab.obstacleComplexity,0,3)];
  let kind=choices[Math.floor(rand(0,choices.length))];
  const pool=!testMode&&selectedLevel.arcade?selectedLevel.patterns:choices;
  if(selectedLevel.arcade&&!testMode)kind=pool[Math.floor(rand(0,pool.length))];
  if(kind===nextWave&&pool.length>1)
   kind=pool[(pool.indexOf(kind)+1+Math.floor(rand(0,pool.length-1)))%pool.length];
  nextWave=kind;
  const rotation=Math.floor(rand(0,SECTORS))*STEP;
  const spinChance=(directorStage<2?.035:directorStage<4?.13:encoreMode==="blue"?.32:.18+Math.min(.20,directorStage*.025))*lab.spinRate;
  const spins=gateCount>3&&Math.random()<spinChance;
  const spin=spins?(Math.random()<.5?-1:1)*rand(.16,.42)*lab.spinSpeed:0;
  const twist=rand(-.14,.14);
  const move=!testMode&&selectedLevel.arcade?selectedLevel.motion:0;
  const moving=move>0&&gateCount>3;
  const swing=moving&&Math.random()<(move===1?.22:move===2?.55:.62);
  const rush=moving&&Math.random()<(move===1?.10:move===2?.24:.52);
  return {kind,sectors:pattern(kind),z:SPAWN_Z,
   length:(kind===2||kind===8?rand(.6,.9):rand(.85,1.5))*lab.gateSize,
   rotation,baseRotation:rotation,spin:move>0?spin*1.3:spin,twist,
   swingAmp:swing?rand(.20,move===3?.82:.56):0,
   swingFreq:swing?rand(1.05,move===3?2.6:1.95):0,
   rushFactor:rush?rand(1.07,move===3?1.27:1.16):1,age:0,
   cleared:false,credited:false};
 }
 function nextGateGap(){
  const hard=[2,8,9,19,21,23,26].includes(nextWave);
  // Endlessly increasing density, never a wall of impossible instant hits.
  const cycle=gateCount%9;
  let gap=cycle===5&&directorStage>=2?rand(12.8,15.2):
    cycle===6?rand(22.0,26.0):rand(GAP_MIN,GAP_MAX);
  if(hard)gap+=2.8;
  const density=clamp(1-directorStage*.055,.62,1);
  return Math.max(lab.gapMinimum,gap*density/lab.obstacleDensity)*selectedLevel.gap;
 }
 function smoothEncore(x){
  x=clamp(x,0,1);
  return x*x*(3-2*x);
 }
 function encoreVisibility(){
  if(encoreMode!=="transition")return 1;
  // Fade away for 2 seconds, hold a black tunnel for 1 second,
  // then fade the new blue course in over 2 seconds.
  return encoreTime<2?1-smoothEncore(encoreTime/2):
   encoreTime<3?0:smoothEncore((encoreTime-3)/2);
 }
 function blueTunnel(){
  return encoreMode==="blue"||encoreMode==="transition"&&encoreTime>=2;
 }
 function beginEncore(){
  if(selectedLevel.arcade&&!testMode)return false;
  if(mode!=="running"||encoreMode!=="normal"||selectedLevel.id==="free")return false;
  bankSkill("PHASE TERMINÉE");
  encoreMode="transition";encoreTime=0;
  waves=[];pads=[];shields=[];sparks=[];
  nextGateAt=nextPadAt=nextShieldAt=Infinity;
  invuln=Math.max(invuln,ENCORE_TRANSITION_SECONDS+2);
  padBoostTime=0;nitroHeld=false;nitroActive=false;nitroBurnTime=0;
  pulseFx=pulseGlow=pulseHitFx=flash=shake=0;
  pauseMusic();
  message="FIN DU MORCEAU · TRANSITION";messageLife=2.1;
  renderHud();
  return true;
 }
 function completeEncore(){
  if(encoreMode!=="transition")return;
  encoreMode="blue";encoreTime=ENCORE_TRANSITION_SECONDS;phase3Elapsed=0;
  directorStage=Math.max(directorStage,5);
  // A modest new base-speed step. Ordinary cruise is already engaging;
  // nitro remains optional, not essential.
  musicDropSurge=Math.max(musicDropSurge,.3);
  nextGateAt=travel+10;
  nextPadAt=travel+26;
  nextShieldAt=travel+(lives===1?38:54);
  invuln=Math.max(invuln,2);
  message="PHASE BLEUE · NOUVELLE PRESSION";messageLife=2.4;
  applyPhase("p3");
  // The user's new second song starts at 0 in Phase 3, in normal and TEST.
  // It is an independent audio file, not a loop of the first song.
  musicLoops++;
  startMusicAtPhase("p3",0);
 }
 function finishArcadeLevel(reason="time"){
  if(mode!=="running"||!selectedLevel.arcade||testMode)return false;
  bankSkill("NIVEAU TERMINÉ");
  finaleCause="level-"+reason;finaleTime=0;mode="finale";
  musicRequest++;stopMusic();resetSteering();endNitro();keys.clear();
  waves=[];pads=[];shields=[];sparks=[];
  padBoostTime=0;nitroActive=false;nitroHeld=false;
  labToggle.hidden=true;labHide();
  if(score>best){best=Math.floor(score);save("best."+selectedLevel.id,best);}
  const index=CAMPAIGN.indexOf(selectedLevel)+1;
  completedLevels=Math.max(completedLevels,index);
  unlockedLevel=Math.min(4,Math.max(unlockedLevel,index+1));
  save("campaign.unlocked.v1",unlockedLevel);
  save("campaign.completed.v1",completedLevels);
  refreshLevelCards();renderHud();
  return true;
 }
 function beginFinale(reason="song-ended"){
  if(mode!=="running"||encoreMode!=="blue")return false;
  bankSkill("DERNIER COMBO");
  finaleCause=reason;finaleTime=0;mode="finale";
  musicRequest++;stopMusic();
  resetSteering();endNitro();keys.clear();
  waves=[];pads=[];shields=[];sparks=[];
  padBoostTime=0;nitroActive=false;nitroHeld=false;
  labToggle.hidden=true;labHide();
  message="FIN DE COURSE";messageLife=2.5;
  if(!testMode&&score>best){
   best=Math.floor(score);save("best."+selectedLevel.id,best);
  }
  renderHud();
  return true;
 }
 function updateFinale(dt){
  if(mode!=="finale")return;
  finaleTime=Math.min(FINALE_FADE_SECONDS,finaleTime+Math.max(0,dt));
  if(finaleTime<FINALE_FADE_SECONDS)return;
  mode="finished";finaleSelection=0;
  finaleOverlay.hidden=false;
  const arcade=selectedLevel.arcade&&!testMode;
  finaleTitle.textContent=arcade?"NIVEAU TERMINÉ":"THANK YOU FOR PLAYING";
  finaleSubtitle.textContent=arcade?selectedLevel.name+" · CIRCUIT "+(CAMPAIGN.indexOf(selectedLevel)+1)+"/4":"ECHO RACER · COURSE TERMINÉE";
  finaleMenu.textContent=arcade?"NIVEAUX":"⌂ MENU";
  finaleScore.textContent=Math.floor(score).toLocaleString("fr-CH")+" POINTS";
  finaleStats.textContent=arcade?
   (completedLevels<4?"NIVEAU SUIVANT DÉBLOQUÉ":"LES 4 NIVEAUX TERMINÉS")+" · RECORD "+Math.floor(best).toLocaleString("fr-CH"):
   "RECORD "+Math.floor(best).toLocaleString("fr-CH")+
   " · COMBOS ENCAISSÉS "+bankedCount+
   " · POINTS DE FIGURES "+Math.round(bankedTotal).toLocaleString("fr-CH")+
   " · NEAR MISSES "+nearMisses;
  paintMenuSelection();renderHud();
 }
 function updateEncore(dt){
  if(selectedLevel.arcade&&!testMode)return;
  if(encoreMode==="normal"&&selectedLevel.id!=="free"){
   // If playback is muted, the same progression uses running elapsed time.
   const songClock=music&&!music.paused&&soundEnabled&&!globalMuted()?
    music.currentTime:elapsed;
   if(songClock>=MUSIC_TAIL_AT&&musicTrackId==="p1")beginEncore();
  }
  if(encoreMode==="transition"){
   encoreTime=Math.min(ENCORE_TRANSITION_SECONDS,encoreTime+dt);
   if(encoreTime>=ENCORE_TRANSITION_SECONDS)completeEncore();
  }
  if(encoreMode==="blue"){
   phase3Elapsed+=dt;
   // The media 'ended' event is authoritative. Muted or failed audio
   // still finishes via a game-clock fallback, never an endless loop.
   const fallback=musicTrackId==="p3"&&music&&Number.isFinite(music.duration)&&music.duration>1?
    music.duration:PHASE3_SILENT_FALLBACK;
   if((!soundEnabled||globalMuted()||musicError||!music)&&phase3Elapsed>=fallback)
    beginFinale("no-audio-fallback");
  }
 }
 function directMusicPressure(dt){
  if(selectedLevel.arcade&&!testMode){
   const target=selectedLevel.motion+Math.floor(elapsed/Math.max(22,selectedLevel.duration/3));
   directorStage=Math.max(directorStage,target);
   musicDropSurge=Math.max(0,musicDropSurge-dt*.2);
   return;
  }
  // Song analysed on CI: dominant rise at 68 s, a second at 162 s.
  // Actual media clock is authoritative when playing, elapsed is fallback
  // for muted/offline runs, so gameplay never stalls because audio is blocked.
  const songTime=music&&!music.paused&&soundEnabled?
   (musicTrackId==="p3"?MUSIC_SECOND_DROP_AT:music.currentTime):elapsed;
  const musicalStage=songTime>=MUSIC_SECOND_DROP_AT?4:songTime>=MUSIC_DROP_AT?2:0;
  const survivalStage=Math.min(8,Math.floor(elapsed/58));
  const target=Math.max(musicalStage,survivalStage);
  if(target>directorStage){
   const old=directorStage;
   directorStage=target;
   const isDrop=(old<2&&target>=2)||(old<4&&target>=4);
   musicDropSurge=isDrop?1.18:Math.max(musicDropSurge,.25);
   if(isDrop){
    message=target>=4?"SECOND DROP · HYPERDRIVE":"MUSIC DROP · ACCÉLÉRATION";
    messageLife=2.6;flash=Math.max(flash,.16);
    beep("collect");
   }else{
    message="PRESSION ×"+(directorStage+1);
    messageLife=1.05;
   }
  }
  musicDropSurge=Math.max(0,musicDropSurge-dt*.19);
 }
 function advance(dt){
  if(mode!=="running"||document.hidden)return;
  dt=clamp(dt,0,.05);elapsed+=dt;
  if(selectedLevel.arcade&&!testMode&&elapsed>=selectedLevel.duration){
   finishArcadeLevel("time");return;
  }
  updateEncore(dt);
  if(mode!=="running")return;
  // Apply the tuned profile at the real musical boundary. The editor may
  // meanwhile display a different phase without changing the active run.
  const songClock=music&&!music.paused&&soundEnabled&&!globalMuted()?
   music.currentTime:elapsed;
  const actualPhase=selectedLevel.arcade&&!testMode?selectedLevel.track:
   encoreMode==="blue"?"p3":songClock>=MUSIC_DROP_AT?"p2":"p1";
  if(activePhase!==actualPhase)applyPhase(actualPhase);
  directMusicPressure(dt);
  // Inverted orbital steering: pressing LEFT rotates the camera/ship toward
  // the opposite tunnel angle. Keep keyboard and touch D-pad consistent.
  const digitalSteer=(keys.has("left")?1:0)-(keys.has("right")?1:0);
  const analogSteer=Math.abs(steerValue)<.065?0:-Math.sign(steerValue)*Math.pow(Math.abs(steerValue),1.2);
  const steer=digitalSteer||analogSteer;
  const targetTurn=steer*lab.steerSpeed;
  // Accelerate decisively, coast when released, brake quickly by counter-steer.
  const turnRate=steer?(turnVelocity*steer<0?lab.steerReverse:lab.steerResponse):lab.steerInertia;
  turnVelocity+=(targetTurn-turnVelocity)*(1-Math.exp(-dt*turnRate));
  if(!steer&&Math.abs(turnVelocity)<.01)turnVelocity=0;
  if(dragPointer===null)angle=(angle+turnVelocity*dt+TAU)%TAU;
  const throttle=(keys.has("up")?.52:0)-(keys.has("down")?.55:0);
  // A boost pad is stronger than manual boost, but they do not multiply
  // together into an uncontrollable/untestable collision speed.
  updateNitro(dt);
  // The normal cruise is the core game, not a slow waiting room for pads.
  // Starts ~6.15 units/s (was 4.15) and ramps naturally with survival.
  const growth=Math.min(1.45,Math.log1p(Math.max(0,score)/3800)*.36)*lab.acceleration;
  const stageThrust=Math.min(2.6,directorStage*.44)*lab.acceleration;
  const survivalThrust=Math.min(2.05,elapsed/105)*lab.acceleration;
  const musicThrust=(audioFx.energy*.35+audioFx.kick*.09)*lab.punch*lab.musicSpeedInfluence;
  const encoreThrust=encoreMode==="blue"?lab.phaseBonus:0;
  const base=clamp(lab.baseSpeed+stageThrust+survivalThrust+growth+
   throttle*.65+musicThrust+musicDropSurge*.44+encoreThrust,
   5.4,lab.speedCap)*selectedLevel.speed;
  // Turbo is still rewarding, but the basic flight stays exciting.
  const nitroThrust=lab.nitroStart+lab.nitroGrowth*(1-Math.exp(-nitroBurnTime*.72));
  const multiplier=lab.boostPadsEnabled&&padBoostTime>0?lab.boostPadSpeed:nitroActive?nitroThrust:1;
  const targetSpeed=base*multiplier;
  const response=targetSpeed>=currentSpeed?lab.speedRiseResponse:lab.speedFallResponse;
  currentSpeed+=(targetSpeed-currentSpeed)*(1-Math.exp(-dt*response));
  const speed=currentSpeed;
  // Score multiplier follows ACTUAL travel speed (including pad/manual boost).
  scoreMultiplier= speed>=8.2?5:speed>=6.85?4:speed>=5.65?3:speed>=4.7?2:1;
  // One physical depth displacement: both geometry (travel) and gates use it.
  const dz=speed*dt;
  travel+=dz;
  distance+=dz*125;
  score+=dt*(15+Math.min(35,distance/210))*scoreMultiplier;
  tickSkill(dt);
  invuln=Math.max(0,invuln-dt);
  padBoostTime=Math.max(0,padBoostTime-dt);
  pulseGlow=Math.max(0,pulseGlow-dt);
  pulseFx=Math.max(0,pulseFx-dt/1.0);
  pulseHitFx=Math.max(0,pulseHitFx-dt/1.0);
  shieldFlash=Math.max(0,shieldFlash-dt/1.25);
  messageLife=Math.max(0,messageLife-dt);
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
   if(lab.obstaclesEnabled)waves.push(wave);
   lastGateAt=spawnAt;
   nextGateAt+=nextGateGap();
  }
  // Pads have their OWN calendar and cannot appear on top of a hazard.
  while(travel>=nextPadAt){
   if(!lab.boostPadsEnabled){
    nextPadAt=travel+PAD_START;
    break;
   }
   const gapPrevious=nextPadAt-lastGateAt;
   const gapNext=nextGateAt-nextPadAt;
   if(gapPrevious<5.3||gapNext<5.3){nextPadAt+=5.4;continue;}
   const targetSector=(Math.floor((angle/TAU)*SECTORS)-1+SECTORS)%SECTORS;
   const center=padCount===0?targetSector:Math.floor(rand(0,SECTORS));
   const pad={z:SPAWN_Z-(travel-nextPadAt),sectors:[center,(center+1)%SECTORS,(center+2)%SECTORS],
     length:1.1,cleared:false,credited:false};
   pads.push(pad);padCount++;
   nextPadAt+=rand(PAD_GAP_MIN,PAD_GAP_MAX)/lab.boostPadFrequency;
  }
  // Shield frequency depends on remaining lives: 3 = none; 2 = scarce;
  // 1 = existing frequency. The schedule never builds a spawn backlog.
  while(travel>=nextShieldAt){
   if(lives===MAX_LIVES){
    nextShieldAt+=rand(SHIELD_RARE_MIN,SHIELD_RARE_MAX)/lab.shieldFrequency;continue;
   }
   if(nextShieldAt-lastGateAt<7||nextGateAt-nextShieldAt<7){
    nextShieldAt+=7.5;continue;
   }
   const nearSector=Math.floor(angle/STEP);
   const center=(shieldCount===0||Math.random()<.58)?
    (nearSector+Math.floor(rand(-2,3))+SECTORS)%SECTORS:Math.floor(rand(0,SECTORS));
   shields.push({z:SPAWN_Z-(travel-nextShieldAt),
    sectors:[center,(center+1)%SECTORS],credited:false,shimmer:rand(0,TAU)});
   shieldCount++;
   nextShieldAt+=(lives===1?rand(SHIELD_GAP_MIN,SHIELD_GAP_MAX):
    rand(SHIELD_RARE_MIN,SHIELD_RARE_MAX))/lab.shieldFrequency;
  }
  // A pickup can be collected across a short depth window, including
  // just after passing its visible edge. Angular forgiveness is pickup-only.
  for(const pickup of shields){
   const oldZ=pickup.z;pickup.z-=dz;
   if(lives<MAX_LIVES&&!pickup.credited
     &&pickupDepth(oldZ,pickup.z)
     &&pickupContact(angle,pickup,SHIELD_SIDE)){
    pickup.credited=true;lives++;
    warningLife=0;warningBeepDelay=0;
    message="BOUCLIER +1";messageLife=1.6;
    shieldFlash=1;showShieldCollect();
    burst(angle,"#c6ffe8",44,1.7,true);
    awardSkill("shield",lab.scoreShield,"BOUCLIER +1");
    beep("collect");renderHud();
    // Full health never shows unneeded shield pickups.
    if(lives===MAX_LIVES){shields=[];nextShieldAt=Math.max(nextShieldAt,travel+SHIELD_RARE_MIN);}
   }
  }
  shields=shields.filter(p=>p.z>HIT_Z-PICKUP_BACK-.2&&!p.credited);
  for(const pad of pads){
   const oldZ=pad.z;pad.z-=dz;
   if(!pad.credited&&pickupDepth(oldZ,pad.z,pad.length)
     &&pickupContact(angle,pad,PAD_SIDE)){
    pad.credited=true;
    padBoostTime=Math.max(padBoostTime,lab.boostPadDuration);
    shipBoostFade=1;turboLight=1;
    const gained=awardSkill("pad",lab.scorePad,"BOOST PAD");
    pulseGlow=.68;message="TURBO PAD · +"+gained+" EN COMBO";messageLife=1.2;
    burst(angle,"#72f7ff",34);
    startBoostLoop();beep("collect");
   }
  }
  pads=pads.filter(p=>p.z+p.length>HIT_Z-PICKUP_BACK-.2&&!p.credited);
    for(const w of waves){
   const oldZ=w.z;
   w.z-=dz*(w.rushFactor||1);
   if(w.swingAmp){
    w.age+=dt;
    w.rotation=w.baseRotation+Math.sin(w.age*w.swingFreq)*w.swingAmp+w.spin*w.age;
   }else if(w.spin)w.rotation+=w.spin*dt;
   // Swept collision at the exact same plane at which the obstacles pass
   // the fixed cyan HUD arc. Frame rate cannot skip the detection.
   if(oldZ>HIT_Z&&w.z<=HIT_Z&&!w.credited){
    w.credited=true;passed++;
    if(!w.cleared&&collisionAt(angle,w)&&invuln<=0&&!(testMode&&lab.invincible)){
     lives--;invuln=1.35;flash=.47;shake=3;beep("hit");
     breakCombo();
     if(lives>0)nextShieldAt=Math.min(nextShieldAt,travel+rand(lives===1?5:12,lives===1?11:24));
     if(lives===1){
      warningLife=2.25;warningBeepDelay=.15;warningChirp=0;
     }
     message="IMPACT !";messageLife=1.05;burst(angle,"#ff5caa",23);
     if(lives<=0){gameOver();break;}
    }else{
     if(!w.cleared){
      const near=nearMiss(angle,w);
      if(near){
       // A genuine near miss is rewarded right away.
       const bonus=awardSkill("near",lab.scoreNear,"NEAR MISS");
       message="NEAR MISS · +"+bonus;messageLife=1.15;beep("pass");
      }else{
       // Ordinary avoidance is not an event on every single gate.
       // Only the fifth clean gate earns the grouped bonus/notice.
       cleanPassStreak++;
       if(cleanPassStreak>=5){
        cleanPassStreak=0;cleanBonusCount++;
        awardSkill("clean",lab.scoreClean*5,"PASSAGE PROPRE ×5");
       }
      }
     }
     if(passed%4===0&&pulseCharge<3){
      pulseCharge++;
      playRewardCue("pulseReady");
      showReward("PULSE +1 · RECHARGÉ","pulse",1.55);
     }
    }
   }
  }
  waves=waves.filter(w=>w.z>-.8);
  sparks.forEach(p=>{p.a+=p.va*dt;p.z+=p.vz*dt;p.life-=dt;});
  sparks=sparks.filter(p=>p.life>0);
  if(!testMode&&score>best){
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
  const count=clamp(Math.round(difficulty.count*lab.bendFrequency),1,6);
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
   x+=e.ax*smooth*lab.bendIntensity;y+=e.ay*smooth*lab.verticalBend;
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
  const t=clamp((SPAWN_Z-z)/lab.obstacleFade,0,1);
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
  const near=clamp(1-z/RENDER_FAR_Z,0,1),cyan=index%5===0,cold=blueTunnel();
  // Controlled changes of the line itself, not a fat bloom filter.
  const beat=clamp((audioFx.kick*.65+audioFx.bass*.35)*lab.punch,0,1);
  const high=clamp(audioFx.high*lab.punch,0,1);
  c.beginPath();c.arc(g.cx+shift.x,g.cy+shift.y-g.offset*r,r,0,TAU);
  c.strokeStyle=cyan?labHex(lab.colorAccent,clamp((.32+.54*near+high*.12)*lab.light,0,.97)):
   labHex(cold?lab.colorMain:lab.colorMain,clamp((.25+.53*near+beat*.18)*lab.light,0,.97));
  c.lineWidth=((cyan?1.7:1.2)+near*(cyan?1.6:1.1)+beat*1.1)*lab.ringThickness;
  c.shadowColor=cyan?lab.colorAccent:cold?lab.colorMain:lab.colorMain;
  c.shadowBlur=lab.shadows?(cyan?2:1):0;c.stroke();c.shadowBlur=0;
 }
 function drawTunnel(now){
  const g=wallGeom(),cold=blueTunnel();
  bendCache.clear();
  c.fillStyle=labTint(lab.colorBackdrop,.37*lab.backgroundBrightness);c.fillRect(0,0,W,H);
  const vanishing=tunnelBend(RENDER_FAR_Z);
  const gradient=c.createRadialGradient(g.cx+vanishing.x,g.cy+vanishing.y,3,g.cx,g.cy,g.R*1.35);
  gradient.addColorStop(0,labTint(lab.colorBackdrop,.55*lab.backgroundBrightness));
  gradient.addColorStop(.4,labTint(lab.colorBackdrop,.76*lab.backgroundBrightness));
  gradient.addColorStop(.81,labTint(lab.colorBackdrop,1.35*lab.backgroundBrightness));
  gradient.addColorStop(1,labTint(lab.colorBackdrop,.48*lab.backgroundBrightness));
  c.fillStyle=gradient;c.fillRect(0,0,W,H);
  c.save();c.lineCap="round";c.lineJoin="round";
  // An indigo panel skin follows the camera's angular roll. The panels move
  // at exactly the same world speed as the neon hoops and the obstacle walls.
  const panelLength=lab.panelDetail===0?1.30:lab.panelDetail===1?1.02:.81,panelOffset=(mode==="menu"?(now*.0016):labVisualTravel())%panelLength;
  const panelRows=Math.ceil(RENDER_FAR_Z/panelLength)+1;
  for(let row=panelRows;row>=0;row--){
   const z=row*panelLength-panelOffset;
   if(z<0||z>RENDER_FAR_Z)continue;
   const fade=clamp(1-z/RENDER_FAR_Z,0,1);
   const bassLight=clamp((audioFx.bass*.13+audioFx.kick*.1)*lab.punch*lab.light*lab.bassLight,0,.35);
   const highLight=clamp(audioFx.high*.48*lab.punch*lab.light*lab.trebleLight,0,.75);
   // LOD: distant plates span two sectors. Keep close-up seams at full
   // resolution while cutting geometry cost in the extended distance.
   const sectorStep=lab.panelDetail===0?4:lab.panelDetail===1?(z>15?4:2):(z>15?2:1);
   for(let sector=0;sector<SECTORS;sector+=sectorStep){
    const a=screenAngle(sector*STEP),b=a+sectorStep*STEP;
    const shade=(sector+row)%4===0?.85:(sector+row)%2?.47:.65;
    const alpha=(sector+row)%4===0?.37+bassLight:(sector+row)%2?.48+bassLight*.55:.43+bassLight*.8;
    const fill=labTint(lab.colorPanels,shade*lab.panelBrightness,clamp(alpha,0,1));
    wallPatch(a+.006,b-.006,z,z+panelLength,fill,
      row<5&&sector%4===0?labHex(lab.colorPanels,.13*lab.panelBrightness):null,row<5?2:1);
    // Treble-driven cyan bands are painted onto the tunnel itself.
    if(row%3===1&&sector%4===2&&z<RENDER_FAR_Z*.75){
     wallPatch(a+.09,b-.09,z+.19,z+.25,
      labHex(lab.colorAccent,clamp(.12+highLight,0,1)),null,1);
    }
    // Tiny luminous rivets flash toward the camera along with the wall.
    if(row%3===0&&sector%4===1&&z<RENDER_FAR_Z*.75){
     const p=wallPoint((a+b)*.5,z+.28);
     c.fillStyle=labHex(cold?lab.colorMain:lab.colorMain,clamp(.24+.5*fade+highLight*.65,0,.9));
     c.beginPath();c.arc(p.x,p.y,Math.max(.8,2.5*fade),0,TAU);c.fill();
    }
   }
  }
  // Industrial radial rails: structural shadow first, phosphor trace on top.
  for(let i=0;i<lab.lineCount;i++){
   const a=screenAngle(i*TAU/lab.lineCount);
   const near=wallPoint(a,.04);
   const cyan=i%4===0;
   c.beginPath();c.moveTo(near.x,near.y);
   // Long rails curve through every bend, not straight to the old pupil.
   for(let step=1;step<=24;step++){
    const z=(RENDER_FAR_Z+.35)*step/24,pt=wallPoint(a,z);
    c.lineTo(pt.x,pt.y);
   }
   c.strokeStyle=labHex(cyan?lab.colorAccent:cold?lab.colorMain:lab.colorMain,.12*lab.light);
   c.lineWidth=(cyan?9:5)*lab.railThickness;c.shadowBlur=0;c.stroke();
   c.strokeStyle=labHex(cyan?lab.colorAccent:cold?lab.colorMain:lab.colorMain,
    clamp((cyan?.72+audioFx.high*.28*lab.punch:.43+audioFx.mid*.36*lab.punch)*lab.light,0,1));
   c.lineWidth=((cyan?2.4:1.4)+audioFx.high*(cyan?.8:.5)+audioFx.kick*.35)*lab.railThickness;
   c.shadowColor=cyan?lab.colorAccent:cold?lab.colorMain:lab.colorMain;
   c.shadowBlur=lab.shadows?(cyan?2:1):0;
   c.stroke();c.shadowBlur=0;
  }
  const spacing=lab.ringGap;
  const phase=(mode==="menu"?(now*.0016):labVisualTravel())%spacing;
  const ringCount=Math.ceil(RENDER_FAR_Z/spacing)+1;
  for(let i=ringCount;i>=0;i--)drawRing(i*spacing-phase,i);
  c.restore();
  if(turboLight>.005){
   c.fillStyle=cold?labHex(lab.colorMain,turboLight*.092):"rgba(187,117,238,"+(turboLight*.092)+")";
   c.fillRect(0,0,W,H);
  }
  // Deep indigo pupil, feathered rather than a flat black pasted circle.
  const core=c.createRadialGradient(g.cx+vanishing.x,g.cy+vanishing.y,0,
   g.cx+vanishing.x,g.cy+vanishing.y,g.R*.17);
  core.addColorStop(0,labTint(lab.colorBackdrop,.12,.9));
  core.addColorStop(1,labTint(lab.colorBackdrop,.12,0));
  c.fillStyle=core;
  c.fillRect(g.cx+vanishing.x-g.R*.2,g.cy+vanishing.y-g.R*.2,g.R*.4,g.R*.4);
  // Physically small, music-driven phosphor strips instead of a blurred
  // full-screen radial gradient. Kicks pulse pink, treble cyan.
  const kick=clamp((audioFx.kick*.65+audioFx.bass*.3)*lab.punch,0,1);
  const treble=clamp(audioFx.high*.8*lab.punch,0,.8);
  if(kick>.12||treble>.12){
   for(let i=0;i<8;i++){
    const a=screenAngle(i*TAU/8+.11),z=1.7+(i%3)*1.12;
    const amount=i%2===0?kick:treble;
    if(amount<.13)continue;
    wallPatch(a,a+STEP*.67,z,z+.10+amount*.30,
     i%2===0?
      labHex(cold?lab.colorMain:lab.colorMain,.17+amount*.58):
      labHex(lab.colorAccent,.17+amount*.55),null,1);
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
   const newLaser=w.kind>=20;
   const skinFill=labTint(lab.colorHazard,newLaser?.65:skin===3?.74:skin===1?.85:1);
   const skinEdge=newLaser?lab.colorAccent:lab.colorHazard;
   c.shadowColor=lab.colorHazard;c.shadowBlur=lab.shadows?(newLaser?5:2):0;
   wallPatch(a,b,z,far,skinFill,skinEdge,newLaser?3:6);
   if(newLaser){
    // Light cross-braces mark the late-game barriers without altering hitboxes.
    const aa=wallPoint(a+.03,z+.10),bb=wallPoint(b-.03,far-.10);
    c.beginPath();c.moveTo(aa.x,aa.y);c.lineTo(bb.x,bb.y);
    c.strokeStyle=lab.colorAccent;c.lineWidth=1.5;c.stroke();
   }
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
  if(lives===MAX_LIVES||pickup.credited||pickup.z>RENDER_FAR_Z||pickup.z<-.45)return;
  const alpha=revealOpacity(pickup.z);if(alpha<.003)return;
  const a=screenAngle((pickup.sectors[0]+1)*STEP);
  const pos=wallPoint(a,Math.max(0,pickup.z));
  const size=clamp(pos.r*.22,3.6,47),glow=.78+.22*Math.sin(elapsed*7+pickup.shimmer);
  c.save();c.globalAlpha*=alpha;c.translate(pos.x,pos.y);
  c.shadowColor=lab.colorShields;c.shadowBlur=(lab.shadows?9:3)*glow;
  c.fillStyle=labTint(lab.colorShields,.24,.74);c.strokeStyle=lab.colorShields;
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
   c.shadowColor=lab.colorPads;c.shadowBlur=lab.shadows?3:0;
   wallPatch(a,b,near,far,
     labHex(lab.colorPads,clamp(.66+pulse*.28,0,1)),
     lab.colorPads,5);
   const mid=(a+b)*.5,span=(b-a)*.25;
   for(let k=0;k<2;k++){
    const z=near+.18+k*.39;
    const p0=wallPoint(mid-span,z),pc=wallPoint(mid,z+.24),
          p1=wallPoint(mid+span,z);
    c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(pc.x,pc.y);c.lineTo(p1.x,p1.y);
    c.lineWidth=2.8;c.strokeStyle=lab.colorPads;
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
  if(pulseFx<=0&&pulseGlow<=0&&shieldFlash<=0)return;
  c.save();c.globalCompositeOperation="lighter";
  const cx=W*.5,cy=H*.43;
  if(pulseFx>0){
   const progress=1-pulseFx;
   for(let i=0;i<3;i++){
    const radius=W*(.065+progress*(.49+i*.10));
    c.beginPath();c.ellipse(cx,cy,radius,radius*.76,0,0,TAU);
    c.lineWidth=2.5+(2-i)*1.1;
    c.strokeStyle="rgba(140,246,255,"+clamp(pulseFx*(.90-i*.15),0,1)+")";
    c.shadowColor="#68edff";c.shadowBlur=13;c.stroke();
   }
   c.strokeStyle="rgba(231,255,255,"+(pulseFx*.82)+")";
   c.lineWidth=2.4;c.shadowBlur=9;
   for(let i=0;i<18;i++){
    const a=i*TAU/18+elapsed*.23,r=W*(.1+progress*.36),out=r+W*(.1+progress*.11);
    c.beginPath();c.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r*.76);
    c.lineTo(cx+Math.cos(a)*out,cy+Math.sin(a)*out*.76);c.stroke();
   }
  }
  if(pulseHitFx>0){
   c.fillStyle="rgba(185,245,255,"+(pulseHitFx*.20)+")";
   c.fillRect(0,0,W,H);
  }
  if(shieldFlash>0){
   c.strokeStyle="rgba(210,255,235,"+(shieldFlash*.7)+")";
   c.lineWidth=6+shieldFlash*5;c.shadowColor="#9affd8";c.shadowBlur=21;
   c.strokeRect(8,8,W-16,H-16);
   c.beginPath();c.arc(cx,H*.77,W*(.09+(1-shieldFlash)*.44),0,TAU);
   c.lineWidth=4;c.stroke();
  }
  c.restore();
 }
 // Visible, restrained CRT wave: the course image bends with track curvature.
 // Cockpit and HUD are drawn afterwards. Physics, obstacles and collision
 // positions are never modified by the screen-space postprocess.
 const bendBuffer=document.createElement("canvas");
 const bendCtx=bendBuffer.getContext("2d",{alpha:false});
 function warpTrack(){
  if(!lab.warp||!bendCtx||mode!=="running")return;
  const near=trackCenter(travel+4),far=trackCenter(travel+19);
  const dx=far.x-near.x,dy=far.y-near.y;
  const strength=clamp(Math.hypot(dx,dy)/Math.max(110,Math.min(W,H)*.36),0,1);
  // At rest the glass breathes gently; pronounced bends produce about 9px
  // of displacement at native CSS resolution, without extreme stretching.
  const amplitude=(1.25+strength*8.5)*renderDpr;
  const width=canvas.width,height=canvas.height;
  if(bendBuffer.width!==width||bendBuffer.height!==height){
   bendBuffer.width=width;bendBuffer.height=height;
  }
  bendCtx.setTransform(1,0,0,1,0,0);
  bendCtx.drawImage(canvas,0,0);
  c.save();c.setTransform(1,0,0,1,0,0);
  c.fillStyle=blueTunnel()?labTint(lab.colorMain,.07):"#05020a";c.fillRect(0,0,width,height);
  const bands=32,phase=labVisualTravel()*.075;
  for(let i=0;i<bands;i++){
   const y0=Math.floor(i*height/bands);
   const y1=Math.min(height,Math.ceil((i+1)*height/bands)+1);
   const bh=y1-y0;
   if(bh<=0)continue;
   const t=(i+.5)/bands;
   const envelope=Math.sin(Math.PI*t);
   const wave=Math.sin(t*6.3+phase);
   const direction=clamp(dx/Math.max(1,W*.22),-1,1);
   const offset=Math.round(amplitude*envelope*(wave*.55+direction*.5));
   const shifted=Math.min(width-1,Math.abs(offset));
   const sampleWidth=width-shifted;
   if(offset>=0)c.drawImage(bendBuffer,0,y0,sampleWidth,bh,shifted,y0,sampleWidth,bh);
   else c.drawImage(bendBuffer,shifted,y0,sampleWidth,bh,0,y0,sampleWidth,bh);
  }
  c.restore();
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
  for(const p of (lab.particles<=0?[]:sparks)){
   const t=wallPoint(screenAngle(p.a),p.z);
   c.globalAlpha=clamp(p.life/p.max*lab.particles,0,1);
   c.fillStyle=p.color;
   const size=p.size||4;c.shadowColor=p.color;c.shadowBlur=size*1.7;
   c.fillRect(t.x-size*.5,t.y-size*.5,size,size);
   c.shadowBlur=0;
  }
  c.globalAlpha=1;
  if(lab.warp)warpTrack();
  // Only the world fades: controls and score stay present. The ship remains
  // visible in the five-second void while the tunnel disappears completely.
  if(encoreMode==="transition"){
   c.save();
   c.fillStyle="rgba(2,4,10,"+(1-encoreVisibility())+")";
   c.fillRect(0,0,W,H);
   c.restore();
  }else drawPulseWave();
  drawShip(); // Ship is now the only permanent POV marker.
  if(flash>0){
   c.fillStyle="rgba(255,70,143,"+(flash*.23)+")";c.fillRect(0,0,W,H);
  }
  if(mode==="finale"||mode==="finished"){
   const fade=mode==="finished"?1:smoothEncore(finaleTime/FINALE_FADE_SECONDS);
   c.fillStyle="rgba(0,0,0,"+fade+")";c.fillRect(0,0,W,H);
  }
 }
 function frameTick(now){
  if(!live)return;
  raf=requestAnimationFrame(frameTick);
  const dt=last?clamp((now-last)/1000,0,.07):0;last=now;
  if(!labFpsStart)labFpsStart=now;
  if(now-labFpsStart>=850){
   labFps=Math.round(labFpsFrames*1000/(now-labFpsStart));
   labFpsFrames=0;labFpsStart=now;
   if(!labPanel.hidden)labPerfReadout.textContent="FPS RENDUS "+labFps+
    " · RÉSOLUTION "+canvas.width+"×"+canvas.height+
    " · ÉCRAN "+Math.round(W)+"×"+Math.round(H);
  }
  const parent=root.closest(".window");
  if(document.hidden||parent&&parent.classList.contains("minimized")){
   if(mode==="running")togglePause();
   return;
  }
  if(mode!=="running"&&sliderPointer!==null&&Math.abs(steerValue)>=.48&&now>=menuSliderNext)
   updateSteering(steerValue,now);
  if(mode==="running")advance(dt);
  advanceDeathSequence(dt);
  updateFinale(dt);
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
  sampleMusic(dt);
  // Simulation updates every RAF, drawing can be capped independently.
  // The FPS meter counts the actual rendered frames, not animation callbacks.
  if(!lab.frameLimit||!labLastPaint||
    now-labLastPaint>=1000/lab.frameLimit-1.2){
   labLastPaint=now;labFpsFrames++;
   try{paint(now);}catch(error){
    if(!root._erLastRenderError||root._erLastRenderError!==String(error))
     console.error("Echo Racer render:",error);
    root._erLastRenderError=String(error);
   }
  }
 }
 function keyDown(e){
  if(!live||document.hidden||e.altKey||e.ctrlKey||e.metaKey)return;
  const parent=root.closest(".window");
  if(parent&&(!parent.classList.contains("focused")||parent.classList.contains("minimized")))return;
  if(!cfgPanel.hidden){if(e.key==="Escape"){e.preventDefault();cfgHide();}return;}
  if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable)return;
  if(mode==="crashing"||mode==="finale"||(mode==="over"&&deathLock>0)){e.preventDefault();return;}
  // Native buttons handle their own Enter/Space; no double activation.
  if((e.key==="Enter"||e.key===" ")&&e.target.closest&&e.target.closest(".er-pad button, .er-overlay button"))return;
  const k=e.key.toLowerCase(),control={
   arrowleft:"left",a:"left",arrowright:"right",d:"right",
   arrowup:"up",w:"up",arrowdown:"down",s:"down"
  };
  const dir=control[k];
  if(mode==="menu"){
   if(k==="escape"||k==="backspace"){e.preventDefault();if(menuStage==="levels")renderMenuStage("home");return;}
   if(menuStage==="levels"&&/^[1-4]$/.test(k)){e.preventDefault();menuIndex=Number(k)-1;confirmLevel();return;}
   if(dir){e.preventDefault();if(!e.repeat)controllerInput(dir);return;}
   if(k==="enter"||k===" "||k==="q"){
    e.preventDefault();if(!e.repeat)controllerInput("pulse");return;
   }
   return;
  }
  if(mode==="paused"||mode==="over"||mode==="finished"){
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
  if(!cfgPanel.hidden)return;
  const map={arrowleft:"left",a:"left",arrowright:"right",d:"right",arrowup:"up",w:"up",arrowdown:"down",s:"down"};
  const k=e.key.toLowerCase();
  if(k===" ")endNitro();
  if(map[k])keys.delete(map[k]);
 }
 function boardDown(e){
  if(mode==="crashing"||mode==="finale"||(mode==="over"&&deathLock>0))return;
  if(e.button!==undefined&&e.button!==0)return;
  if(e.target.closest&&e.target.closest("button"))return;
  if(mode!=="running"){
   // Mobile screen is a display: menu navigation belongs to the controller.
   if(e.pointerType==="touch"||e.pointerType==="pen")return;
   if(mode==="menu")showLevelSelect();
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
 function onVisibility(){
  if(document.hidden&&mode==="running")togglePause();
  else if(!document.hidden){
   fitCanvas();last=0;
   try{paint(performance.now());}catch(e){console.error("Echo Racer resume",e);}
  }
 }
 function onBlur(){resetSteering();endNitro();keys.clear();}
 document.addEventListener("visibilitychange",onVisibility);
 window.addEventListener("blur",onBlur);
 overlayButton.onclick=function(){
  if(mode==="paused")togglePause();
  else if(mode==="menu")showLevelSelect();
  else restartRun();
 };
 document.addEventListener("keydown",keyDown);
 document.addEventListener("keyup",keyUp);
 function dispose(){
  if(!live)return;
  // The editor lives in a sibling desktop window: close it when the game
  // closes or when the user signs out. Never leave a zombie settings window.
  labHide();
  live=false;cancelAnimationFrame(raf);resetSteering();keys.clear();
  stopMusic();
  document.removeEventListener("visibilitychange",onVisibility);
  window.removeEventListener("blur",onBlur);
  document.removeEventListener("keydown",keyDown);
  document.removeEventListener("keyup",keyUp);
  if(ro){ro.disconnect();ro=null;}else window.removeEventListener("resize",restoreCanvas);
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
  lcdEditor:()=>({open:!cfgPanel.hidden,mode:cfgMode,layout:JSON.parse(JSON.stringify(cfgLayout)),targets:Object.keys(cfgTargets)}),
  lcdSet:(id,x,y)=>{if(!cfgTargets[id])return false;cfgChosen=id;cfgSet(id,"x",x);cfgSet(id,"y",y);return true;},
  lcdOpen:cfgOpen,lcdClose:cfgHide,
  snapshot:()=>({mode,testMode,homeIndex,lab:{...lab},labOpen:!labPanel.hidden,
   finale:{time:finaleTime,cause:finaleCause,visible:!finaleOverlay.hidden,
    scoreText:finaleScore.textContent,stats:finaleStats.textContent},
   arcade:{bank:skillBank,chain:skillChain,multiplier:skillMultiplier,
    speedMultiplier:scoreMultiplier,bankedTotal,bankedCount,nearMisses,cleanPassStreak,cleanBonusCount,
    nitroReady:nitroFullLatched,cues:{...rewardCueCounts},toast:rewardText},
   labDetached:!wrap.contains(labPanel)&&!!labPanel.parentElement,
   phaseActive:activePhase,phaseEditing:editorPhase,
   phaseProfiles:JSON.parse(JSON.stringify(phaseProfiles)),fps:labFps,angle,turnVelocity,lives,score,best,distance,travel,passed,combo,directorStage,musicDropSurge,
   encore:{mode:encoreMode,time:encoreTime,visibility:encoreVisibility(),blue:blueTunnel()},pulseCharge,pulseFx,pulseHitFx,shieldFlash,shieldCount,nextShieldAt,music:{loaded:!!music,paused:music?music.paused:true,source:music?music.src:null,loop:music?music.loop:false,track:musicTrackId,phase:directorStage,loops:musicLoops,seconds:music?music.currentTime:elapsed,reactive:{bass:audioFx.bass,mid:audioFx.mid,high:audioFx.high,kick:audioFx.kick,energy:audioFx.energy},error:musicError},canvas:{width:W,height:H},gateCount,nextGateAt,waves:waves.map(w=>({z:w.z,kind:w.kind,cleared:w.cleared,credited:w.credited,sectors:[...w.sectors],rotation:w.rotation,spin:w.spin,twist:w.twist})),shields:shields.map(p=>({z:p.z,sectors:[...p.sectors],credited:p.credited})),pads:pads.map(p=>({z:p.z,sectors:[...p.sectors],credited:p.credited})),padBoostTime,currentSpeed,scoreMultiplier,gateCount,padCount}),
  advance:advance,start:start,pulse:pulse,boost:beginNitro,endBoost:endNitro,menu:toMenu,pause:togglePause,
  triggerEncore:beginEncore,triggerFinale:()=>beginFinale("debug"),tickFinale:updateFinale,
  simulateSongEnd:()=>{if(!music)return false;music.dispatchEvent(new Event("ended"));return true;},
  draw:()=>paint(performance.now()),
  test:()=>start(true),testPhase:(id)=>{if(!phaseProfiles[id])return false;start(true,id);return true;},
  editPhase:(id)=>{if(!phaseProfiles[id])return false;editorPhase=id;labRefresh();return true;},
  exportPhases:exportTuningJSON,labOpen:labOpen,labClose:labHide,labPreset:(name)=>{const buttons=[...labPresetBox.querySelectorAll("button")];const b=buttons.find(x=>x.textContent===name);if(b){b.click();return true;}return false;},
  injectPickup:(kind,sectors,z=HIT_Z+PICKUP_FRONT+.2)=>{
   const o={z,sectors:[...sectors],length:kind==="pad"?1.1:0,credited:false,shimmer:0};
   if(kind==="pad")pads.push(o);else if(kind==="shield")shields.push(o);
   return o;
  },
  injectWave:(sectors,z=HIT_Z+PULSE_REACH-.4)=>{
   const o={kind:0,sectors:[...sectors],z,length:1,rotation:0,spin:0,cleared:false,credited:false};
   waves.push(o);return o;
  },
  ship:()=>({idleLoaded:shipReady.idle,boostLoaded:shipReady.boost,boostMix:shipBoostFade,tunnelLight:turboLight}),
  level:()=>({id:selectedLevel.id,free:selectedLevel.id==="free",gap:selectedLevel.gap,
   duration:selectedLevel.duration||null,unlockedLevel,completedLevels,
   available:CAMPAIGN.map((l,i)=>({id:l.id,open:i<unlockedLevel,done:i<completedLevels,
    music:l.track,offset:l.musicAt,patterns:[...l.patterns],speed:l.speed,motion:l.motion}))}),
  gauges:()=>({speed:Math.round(currentSpeed*25),charge:mode==="menu"?0:selectedLevel.id==="free"?freeChargeVisual:nitroFuel,boosting:nitroActive||padBoostTime>0,
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
   if(level.arcade&&CAMPAIGN.indexOf(level)>=unlockedLevel)return false;
   selectedLevel=level;save("level",id);
   best=Number(load("best."+id,id==="3"?load("best","0"):"0"))||0;
   renderHud();return true;
  },
  lastRenderError:()=>root._erLastRenderError||null,
   steering:()=>({value:steerValue,pointer:sliderPointer,velocity:turnVelocity}),
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
   breakCombo();
   lives=Math.max(0,lives-1);invuln=1.35;flash=.47;shake=3;
   if(lives>0)nextShieldAt=Math.min(nextShieldAt,travel+rand(lives===1?5:12,lives===1?11:24));
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
 // A resize resets the backing bitmap to black. On battery-saving Android
 // requestAnimationFrame can be delayed, so repaint synchronously right here.
 function restoreCanvas(){
  fitCanvas();
  try{paint(performance.now());}catch(e){
   root._erLastRenderError=String(e);
   console.error("Echo Racer restore canvas",e);
  }
 }
 canvas.addEventListener("contextlost",e=>{e.preventDefault();root._erContextLost=true;});
 canvas.addEventListener("contextrestored",()=>{root._erContextLost=false;restoreCanvas();});
 if(typeof ResizeObserver!=="undefined"){
  ro=new ResizeObserver(restoreCanvas);ro.observe(screen);
 }else window.addEventListener("resize",restoreCanvas);
 restoreCanvas();
 raf=requestAnimationFrame(frameTick);
 return dispose;
}
window.ZebraEchoRacer={mount,pattern,collisionAt};
}());