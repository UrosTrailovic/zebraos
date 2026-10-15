/* ZebraTetris — puzzle jouable hors ligne, ZebraOS v1. */
(function(){
"use strict";
const W=10,H=20,BLOCK=24;
const COLORS=["","#28def0","#ffde0c","#bd12e4","#3be931","#ff3232","#2147ff","#ff9118"];
const SHAPES=[
 [[1,1,1,1]],
 [[2,0,0],[2,2,2]],
 [[0,0,3],[3,3,3]],
 [[4,4],[4,4]],
 [[0,5,5],[5,5,0]],
 [[0,6,0],[6,6,6]],
 [[7,7,0],[0,7,7]]
];
function piece(idx){return SHAPES[idx].map(r=>r.slice());}
function randBag(){let b=[0,1,2,3,4,5,6];for(let i=b.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
function best(){try{return Number(localStorage.getItem("zebra.tetris.best"))||0}catch(_){return 0}}
function saveBest(n){try{localStorage.setItem("zebra.tetris.best",String(n))}catch(_){}}
function make(tag,cls,txt){let e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;}
function btn(label,fn){let b=make("button","zg-button",label);b.type="button";b.onclick=fn;return b;}
function mount(root){
 if(root._zebraDispose)root._zebraDispose();
 root.innerHTML="";
 let active=true,paused=true,over=false,lines=0,score=0,level=1,records=best(),held=null,holdUsed=false;
 let grid,upcoming=[],bag=[],current=null,clock=null,observer=null;
 let clearRows=[],clearDeadline=0,audioContext=null,lastSound={};
 let wrap=make("div","zg zg-tetris zg-retro zt-assembling");
 let bar=make("div","zg-topline");
 let logo=make("img","zt-logo");
 logo.alt="Zebra Tetris";
 logo.loading="eager";
 bar.appendChild(logo);
 let status=make("span","zg-state","PRÊT");
 bar.appendChild(status);wrap.appendChild(bar);
 let main=make("div","zg-game-layout");
 let stage=make("div","zg-tetris-stage"),canvas=make("canvas","zg-tetris-board");
 canvas.width=W*BLOCK;canvas.height=H*BLOCK;canvas.setAttribute("aria-label","Plateau Tetris");
 stage.appendChild(canvas);
 let overlay=make("div","zg-overlay");
 let overlayArt=make("img","zt-overlay-art");
 overlayArt.alt="";
 overlay.appendChild(overlayArt);
 overlay.appendChild(make("span","zt-overlay-caption","Appuie sur Jouer pour commencer"));
 stage.appendChild(overlay);main.appendChild(stage);
 let statsPanel=make("div","zg-side zg-side-stats");
 let previewPanel=make("div","zg-side zg-side-previews");
 function stat(title){let box=make("div","zg-stat");box.appendChild(make("small","",title));let count=make("strong","","0");box.appendChild(count);statsPanel.appendChild(box);return count;}
 let scoreEl=stat("SCORE"),levelEl=stat("NIVEAU"),linesEl=stat("LIGNES"),bestEl=stat("RECORD");
 let nextBox=make("div","zg-preview-wrap");nextBox.appendChild(make("small","","SUIVANT"));
 let next=make("canvas","zg-mini");next.width=96;next.height=96;nextBox.appendChild(next);previewPanel.appendChild(nextBox);
 let holdBox=make("div","zg-preview-wrap");holdBox.appendChild(make("small","","RÉSERVE (Q)"));
 let hold=make("canvas","zg-mini");hold.width=96;hold.height=96;holdBox.appendChild(hold);previewPanel.appendChild(holdBox);
 // Vrai panneau DESKTOP, assorti aux cadres SCORE et SUIVANT.
 // Sur téléphone la manette illustrée reste prioritaire.
 let legend=make("section","zt-keyboard-guide");
 legend.setAttribute("aria-label","Commandes clavier Zebra Tetris");
 legend.appendChild(make("div","zt-guide-title","COMMANDES"));
 legend.appendChild(make("span","zt-guide-subtitle","CLAVIER · JOUEUR 1"));
 const keyRows=[
  [["W"],"TOURNER"],
  [["A","D"],"DÉPLACER"],
  [["S"],"DESCENDRE"],
  [["Q"],"RÉSERVE"],
  [["SPACE"],"POSER"],
  [["P"],"PAUSE"]
 ];
 keyRows.forEach(function(entry){
  let row=make("div","zt-guide-row"),keys=make("div","zt-guide-keys");
  entry[0].forEach(function(k){keys.appendChild(make("kbd","zt-guide-key"+(k==="SPACE"?" wide":""),k));});
  row.appendChild(keys);row.appendChild(make("span","zt-guide-label",entry[1]));
  legend.appendChild(row);
 });
 previewPanel.appendChild(legend);
 // Le plateau reste centré, avec les scores à gauche et les pièces à droite.
 main.insertBefore(statsPanel,stage);
 main.appendChild(previewPanel);
 wrap.appendChild(main);
 // Bande séparatrice issue de la vraie texture de bordure fournie avec le jeu.
 wrap.appendChild(make("div","zt-panel-divider"));
 let controls=make("div","zg-buttons zt-buttons");
 const start=btn("JOUER",()=>{sound("ui");if(over||(!current&&!clearRows.length)){reset();return;}menuOpen=false;paused=!paused;updateStatus();});
 start.classList.add("zt-image-button","zt-play");
 const restart=btn("RECOMMENCER",()=>{sound("ui");reset();});
 restart.classList.add("zt-image-button","zt-restart");
 const menu=btn("MENU",()=>{sound("ui");if(!menuOpen){menuOpen=true;paused=true;}else menuOpen=false;updateStatus();});
 menu.classList.add("zt-image-button","zt-menu");
 let menuOpen=false;
 controls.append(start,restart,menu);
 // Manette tactile Zebra Tetris 6.0 : les vrais PNG de l'auteur habillent
 // les sept commandes. Les zones interactives et le repeat restent natifs.
 let pad=make("div","zt-handheld");
 pad.appendChild(controls);
 pad.setAttribute("aria-label","Commandes tactiles Tetris");
 let dpad=make("div","zt-dpad"),cross=make("div","zt-cross");
 let repeatDelay=null,repeatTimer=null,heldControl=null;
 function clearHeld(){
  if(repeatDelay!==null){clearTimeout(repeatDelay);repeatDelay=null;}
  if(repeatTimer!==null){clearInterval(repeatTimer);repeatTimer=null;}
  heldControl=null;
 }
 function control(label,cls,action,repeat){
  let b=make("button","zt-control "+cls,label);
  b.type="button";b.setAttribute("aria-label",label);
  b.onclick=function(e){if(e.detail===0)action();}; // Activation clavier ; ne double pas le toucher.
  b.addEventListener("pointerdown",function(e){
   if(e.button!==undefined&&e.button!==0)return;
   e.preventDefault();
   clearHeld();heldControl=b;action();
   if(repeat){
    repeatDelay=setTimeout(function(){
     repeatDelay=null;repeatTimer=setInterval(function(){if(active&&!paused&&!over)action();},95);
    },270);
   }
   try{b.setPointerCapture(e.pointerId);}catch(_){}
  });
  b.addEventListener("pointerup",function(){if(heldControl===b)clearHeld();});
  b.addEventListener("pointercancel",function(){if(heldControl===b)clearHeld();});
  b.addEventListener("lostpointercapture",function(){if(heldControl===b)clearHeld();});
  b.addEventListener("contextmenu",function(e){e.preventDefault();});
  return b;
 }
 cross.appendChild(make("div","zt-cross-shape"));
 cross.appendChild(control("Haut — tourner","zt-dir zt-dir-up",rotate,false));
 cross.appendChild(control("Bas — descendre","zt-dir zt-dir-down",soft,true));
 cross.appendChild(control("Gauche","zt-dir zt-dir-left",function(){move(-1,0);},true));
 cross.appendChild(control("Droite","zt-dir zt-dir-right",function(){move(1,0);},true));
 cross.appendChild(make("span","zt-cross-center"));
 dpad.appendChild(cross);
 dpad.appendChild(make("span","zt-control-caption","DIRECTION"));
 pad.appendChild(dpad);
 let actionSide=make("div","zt-action-side"),ab=make("div","zt-ab");
 let bAction=control("B — poser la pièce","zt-ab-button zt-b",hardDrop,false);
 let aAction=control("A — tourner la pièce","zt-ab-button zt-a",rotate,false);
 bAction.textContent="B";aAction.textContent="A";
 ab.appendChild(bAction);ab.appendChild(aAction);
 actionSide.appendChild(ab);
 let select=control("SELECT — réserve","zt-select",holdPiece,false);
 select.textContent="SELECT";
 actionSide.appendChild(select);
 actionSide.appendChild(make("span","zt-control-caption","B : POSER  ·  A : TOURNER"));
 pad.appendChild(actionSide);
 // Précharger les vraies textures avant de masquer les contrôles de secours.
 // Chaque bouton garde sa propre hitbox et ses handlers pointerdown/up.
 const spriteRoot="assets/games/tetris-controls/";
 const spriteItems=[
  [cross.querySelector(".zt-dir-up"),"upTetris.png"],
  [cross.querySelector(".zt-dir-down"),"downTetris.png"],
  [cross.querySelector(".zt-dir-left"),"leftTetris.png"],
  [cross.querySelector(".zt-dir-right"),"rightTetris.png"],
  [aAction,"btnAtetris.png"],[bAction,"btnBtetris.png"],[select,"selectTetris.png"]
 ];
 const spriteLoads=spriteItems.map(function(item){
  const sprite=make("img","zt-control-sprite");
  sprite.alt="";sprite.draggable=false;sprite.decoding="async";
  item[0].appendChild(sprite);
  return new Promise(function(resolve,reject){
   sprite.onload=resolve;sprite.onerror=reject;
   sprite.src=spriteRoot+item[1];
  });
 });
 const skinPanel=new Image();
 spriteLoads.push(new Promise(function(resolve,reject){
  skinPanel.onload=resolve;skinPanel.onerror=reject;
  skinPanel.src=spriteRoot+"interfaceTetris.png";
 }));
 Promise.all(spriteLoads).then(function(){
  if(active&&pad.isConnected)pad.classList.add("zt-skin-ready");
 }).catch(function(){/* Manette CSS de secours conservée. */}).then(function(){
  startupSkinReady=true;
  revealTogether();
 });
 wrap.appendChild(pad);
 wrap.appendChild(make("div","zg-help","WASD : tourner / bouger / descendre · Q : réserve · ESPACE : poser · P : pause"));
 root.appendChild(wrap);
 // Tous les éléments visuels doivent se révéler ENSEMBLE après l'ouverture
 // Windows 95, et non le logo / PAUSE avant les panneaux et le plateau.
 const startupLoader=make("div","zt-startup-loader","CHARGEMENT DE ZEBRA TETRIS…");
 startupLoader.setAttribute("role","status");
 startupLoader.setAttribute("aria-live","polite");
 root.appendChild(startupLoader);
 let atlasReady=false,startupArtworkReady=false,startupSkinReady=false;
 let startupBoardReady=false,startupShown=false,startupFrame=0,startupFrame2=0;
 let startupWatchdog=setTimeout(function(){
  // Réseau lent : préserver un Tetris jouable au lieu de rester bloqué.
  startupArtworkReady=true;startupSkinReady=true;startupBoardReady=true;
  revealTogether();
 },3500);
 function revealTogether(){
  if(!active||startupShown||!startupArtworkReady||!startupSkinReady||!startupBoardReady)return;
  startupShown=true;
  clearTimeout(startupWatchdog);
  // Deux frames pour que la mise en page, les tailles du plateau et
  // les textures soient composées avant le premier pixel visible.
  startupFrame=requestAnimationFrame(function(){
   startupFrame2=requestAnimationFrame(function(){
    if(!active||!wrap.isConnected)return;
    wrap.classList.remove("zt-assembling");
    startupLoader.remove();
   });
  });
 }
 // Les textures viennent de la planche fournie par l'auteur.
 if(window.ZebraTetrisArtwork){
  window.ZebraTetrisArtwork.apply({
   wrap:wrap,logo:logo,overlay:overlayArt,start:start,restart:restart,menu:menu,
   onReady:function(){
    atlasReady=true;render();updateStatus();
    startupArtworkReady=true;revealTogether();
   },
   onError:function(){startupArtworkReady=true;revealTogether();}
  });
 }else{startupArtworkReady=true;}
 let ctx=canvas.getContext("2d"),nextCtx=next.getContext("2d"),holdCtx=hold.getContext("2d");
 // Petits sons arcade synthétisés localement, sans musique ni lecture automatique.
 // AudioContext n'est créé qu'après une interaction (tactile, souris ou clavier).
 function sound(type){
  if(!active||document.hidden)return;
  const nowMs=performance.now(),minGap=type==="move"?65:type==="soft"?95:0;
  if(minGap&&nowMs-(lastSound[type]||0)<minGap)return;
  lastSound[type]=nowMs;
  try{
   const Audio=window.AudioContext||window.webkitAudioContext;
   if(!Audio)return;
   if(!audioContext)audioContext=new Audio();
   if(audioContext.state==="suspended")audioContext.resume().catch(()=>{});
   const notes={
    ui:[[560,0,.035]],move:[[240,0,.027]],soft:[[170,0,.027]],
    rotate:[[390,0,.044],[540,.035,.05]],
    hold:[[390,0,.035],[270,.05,.06]],
    hard:[[300,0,.045],[135,.045,.085]],lock:[[125,0,.07]],
    clear:[[580,0,.065],[760,.105,.065],[950,.21,.12]],
    tetris:[[530,0,.07],[690,.09,.07],[870,.18,.085],[1080,.29,.16]],
    level:[[680,0,.09],[960,.12,.15]],
    gameover:[[420,0,.13],[300,.16,.13],[170,.32,.2]]
   }[type];
   if(!notes)return;
   const startTime=audioContext.currentTime;
   notes.forEach(([freq,offset,duration])=>{
    const osc=audioContext.createOscillator(),gain=audioContext.createGain();
    osc.type=type==="ui"||type==="move"?"square":"triangle";
    osc.frequency.setValueAtTime(freq,startTime+offset);
    gain.gain.setValueAtTime(.0001,startTime+offset);
    gain.gain.linearRampToValueAtTime(type==="move"?.022:.045,startTime+offset+.007);
    gain.gain.exponentialRampToValueAtTime(.0001,startTime+offset+duration);
    osc.connect(gain);gain.connect(audioContext.destination);
    osc.start(startTime+offset);osc.stop(startTime+offset+duration+.015);
    osc.onended=()=>{osc.disconnect();gain.disconnect();};
   });
  }catch(_){/* Audio facultatif : le jeu reste jouable sans Web Audio. */}
 }

 function blank(){return Array.from({length:H},()=>Array(W).fill(0));}
 function nextIndex(){if(!bag.length)bag=randBag();return bag.pop();}
 function refill(){while(upcoming.length<5)upcoming.push(nextIndex());}
 function collision(matrix,x,y){
   return matrix.some((row,dy)=>row.some((n,dx)=>n && (x+dx<0||x+dx>=W||y+dy>=H||(y+dy>=0&&grid[y+dy][x+dx]))));
 }
 function spawn(){
  refill();let type=upcoming.shift();refill();
  let mat=piece(type);
  current={type,mat,x:Math.floor((W-mat[0].length)/2),y:-1};
  if(collision(mat,current.x,current.y)){over=true;paused=true;sound("gameover");updateStatus();}
 }
 function reset(){
  grid=blank();bag=[];upcoming=[];lines=0;score=0;level=1;held=null;holdUsed=false;
  over=false;paused=false;menuOpen=false;current=null;clearRows=[];clearDeadline=0;spawn();render();updateStatus();
 }
 function merged(){
  current.mat.forEach((row,y)=>row.forEach((v,x)=>{if(v&&current.y+y>=0){grid[current.y+y][current.x+x]=v;}}));
  const completed=[];
  for(let y=0;y<H;y++)if(grid[y].every(Boolean))completed.push(y);
  sound("lock");
  if(completed.length){
   // Lignes figées pendant 420 ms ; on ne les efface pas avant les flashes.
   clearRows=completed;clearDeadline=performance.now()+420;current=null;
   sound(completed.length===4?"tetris":"clear");
  }else{holdUsed=false;spawn();}
 }
 function completeClear(){
  if(!clearRows.length)return;
  const cleared=clearRows.length,oldLevel=level;
  // Du bas vers le haut pour préserver les indices des lignes multiples.
  for(let i=clearRows.length-1;i>=0;i--)grid.splice(clearRows[i],1);
  for(let i=0;i<cleared;i++)grid.unshift(Array(W).fill(0));
  clearRows=[];clearDeadline=0;
  score+=([0,100,300,500,800][cleared]||800)*level;
  lines+=cleared;level=Math.floor(lines/10)+1;
  if(score>records){records=score;saveBest(records);}
  if(level>oldLevel)sound("level");
  holdUsed=false;spawn();
 }
 function move(dx,dy){
  if(paused||over||clearRows.length||!current)return false;
  if(!collision(current.mat,current.x+dx,current.y+dy)){current.x+=dx;current.y+=dy;if(dx)sound("move");render();return true;}
  if(dy){merged();render();}return false;
 }
 function soft(){if(!move(0,1))return;sound("soft");if(!paused){score++;if(score>records){records=score;saveBest(records);}}render();}
 function hardDrop(){
  if(paused||over||clearRows.length||!current)return;
  let steps=0;while(!collision(current.mat,current.x,current.y+1)){current.y++;steps++;}
  score+=steps*2;if(score>records){records=score;saveBest(records);}
  sound("hard");merged();render();
 }
 function rotate(){
  if(paused||over||clearRows.length||!current)return;
  const m=current.mat,rot=m[0].map((_,i)=>m.map(r=>r[i]).reverse());
  for(const dx of [0,-1,1,-2,2]){
   if(!collision(rot,current.x+dx,current.y)){current.mat=rot;current.x+=dx;sound("rotate");render();return;}
  }
 }
 function holdPiece(){
  if(paused||over||clearRows.length||holdUsed||!current)return;
  let previous=current.type;
  if(held===null){held=previous;spawn();}
  else{
   let type=held;held=previous;let mat=piece(type);
   current={type,mat,x:Math.floor((W-mat[0].length)/2),y:-1};
   if(collision(mat,current.x,current.y)){over=true;paused=true;}
  }
  holdUsed=true;sound("hold");render();updateStatus();
 }
 function updateStatus(){
  status.textContent=over?"FIN DE PARTIE":menuOpen?"MENU":paused?"PAUSE":"EN COURS";
  start.setAttribute("aria-label",paused?"Jouer":"Pause");
  start.title=paused?"Jouer":"Pause";
  start.classList.toggle("zt-paused-button",!paused);
  start.textContent=paused?"JOUER":"PAUSE";
  overlay.style.display=paused?"flex":"none";
  overlay.dataset.state=over?"gameover":menuOpen?"menu":"pause";
  overlayArt.style.display=menuOpen?"none":"block";
  overlay.lastChild.textContent=over?"Recommencer pour rejouer":
    menuOpen?"P : pause · Q : réserve · ESPACE : poser":
    (!current?"Appuie sur Jouer pour commencer":"Appuie sur Jouer pour continuer");
  if(window.ZebraTetrisArtwork&&atlasReady)
   window.ZebraTetrisArtwork.setState(overlayArt,start,over?"gameover":menuOpen?"menu":"pause",!paused);
 }
 function rect(context,x,y,size,val,alpha){
  if(!val)return;
  let col=COLORS[val], x0=Math.round(x),y0=Math.round(y),n=Math.round(size);
  context.globalAlpha=alpha===undefined?1:alpha;
  context.fillStyle="#060606";context.fillRect(x0,y0,n,n);
  context.fillStyle=col;context.fillRect(x0+2,y0+2,n-4,n-4);
  context.fillStyle="rgba(255,255,255,.48)";context.fillRect(x0+2,y0+2,n-4,3);
  context.fillStyle="rgba(255,255,255,.26)";context.fillRect(x0+2,y0+3,3,n-7);
  context.fillStyle="rgba(0,0,0,.34)";context.fillRect(x0+2,y0+n-5,n-4,3);
  context.fillStyle="rgba(0,0,0,.29)";context.fillRect(x0+n-5,y0+3,3,n-7);
  context.globalAlpha=1;
 }
 function preview(context,index){
  context.fillStyle="#050505";context.fillRect(0,0,96,96);
  if(index===null||index===undefined)return;
  let mat=piece(index),size=20,x=Math.floor((96-mat[0].length*size)/2),y=Math.floor((96-mat.length*size)/2);
  mat.forEach((row,yy)=>row.forEach((v,xx)=>rect(context,x+xx*size,y+yy*size,size,v)));
 }
 function render(){
  ctx.fillStyle="#040405";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle="rgba(255,255,255,.025)";
  for(let x=0;x<=W;x++){ctx.beginPath();ctx.moveTo(x*BLOCK,0);ctx.lineTo(x*BLOCK,H*BLOCK);ctx.stroke();}
  for(let y=0;y<=H;y++){ctx.beginPath();ctx.moveTo(0,y*BLOCK);ctx.lineTo(W*BLOCK,y*BLOCK);ctx.stroke();}
  if(grid)grid.forEach((row,y)=>row.forEach((v,x)=>rect(ctx,x*BLOCK,y*BLOCK,BLOCK,v)));
  if(clearRows.length){
   // Trois flashes nets dans la grille (chaque phase dure ~70 ms).
   const phase=Math.floor((420-Math.max(0,clearDeadline-performance.now()))/70);
   ctx.fillStyle=phase%2===0?"rgba(255,255,235,.93)":"rgba(230,47,255,.48)";
   clearRows.forEach(y=>ctx.fillRect(0,y*BLOCK,W*BLOCK,BLOCK));
  }
  if(current){
    let ghostY=current.y;
    while(!collision(current.mat,current.x,ghostY+1))ghostY++;
    current.mat.forEach((row,y)=>row.forEach((v,x)=>{if(v&&ghostY+y>=0)rect(ctx,(current.x+x)*BLOCK,(ghostY+y)*BLOCK,BLOCK,v,.24);}));
    current.mat.forEach((row,y)=>row.forEach((v,x)=>{if(v&&current.y+y>=0)rect(ctx,(current.x+x)*BLOCK,(current.y+y)*BLOCK,BLOCK,v);}));
  }
  preview(nextCtx,upcoming[0]);preview(holdCtx,held);
  scoreEl.textContent=score;levelEl.textContent=level;linesEl.textContent=lines;bestEl.textContent=records;
 }
 function key(e){
  if(!active||root.closest(".window")?.classList.contains("minimized"))return;
  if(!root.closest(".window")?.classList.contains("focused"))return;
  if(["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName))return;
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  const action={
   a:()=>move(-1,0),d:()=>move(1,0),s:soft,w:rotate,
   q:holdPiece," ":hardDrop,
   p:()=>{if(!over){menuOpen=false;paused=!paused;updateStatus();}},
   // Les flèches restent disponibles pour les habitués.
   arrowleft:()=>move(-1,0),arrowright:()=>move(1,0),
   arrowdown:soft,arrowup:rotate
  };
  const pressed=e.key===" "?" ":e.key.toLowerCase();
  if(!action[pressed])return;
  e.preventDefault();
  if(e.repeat&&[" ","q","w","p","arrowup"].includes(pressed))return;
  action[pressed]();
 }
 function tick(){
  if(!active)return;
  if(!root.isConnected){dispose();return;}
  if(!paused&&!over&&!clearRows.length&&!document.hidden)move(0,1);
 }
 // Garder les 20 lignes du plateau entièrement visibles, même après un resize.
 // La scène se dimensionne selon l'espace réel de la fenêtre.
 function fitBoard(){
  if(!active||!main.isConnected)return;
  const css=getComputedStyle(main);
  const sideWidth=Math.max(statsPanel.getBoundingClientRect().width,previewPanel.getBoundingClientRect().width)||75;
  const gap=parseFloat(css.columnGap)||6;
  const horizontal=(parseFloat(css.paddingLeft)||0)+(parseFloat(css.paddingRight)||0);
  const vertical=(parseFloat(css.paddingTop)||0)+(parseFloat(css.paddingBottom)||0);
  // Le plateau occupe exactement la colonne centrale d'une grille symétrique.
  // On réserve donc assez de largeur à GAUCHE pour les scores, et autant à droite
  // pour que le centre du plateau coïncide avec celui de la fenêtre.
  const sideGutter=sideWidth+gap+6;
  const maxWidth=Math.max(48,main.clientWidth-horizontal-2*sideGutter);
  const maxHeight=Math.max(96,main.clientHeight-vertical-6);
  // Les 20 lignes restent visibles, y compris sur petit écran.
  const pixels=Math.max(48,Math.floor(Math.min(420,maxWidth,maxHeight/2)));
  if(!Number.isFinite(pixels))return;
  if(stage.style.width!==pixels+"px"){
   stage.style.width=pixels+"px";stage.style.height=(pixels*2)+"px";
  }
  if(!startupBoardReady&&main.clientWidth>0&&main.clientHeight>0){
   startupBoardReady=true;revealTogether();
  }
 }
 function dispose(){
  active=false;clearHeld();clearInterval(clock);clearTimeout(startupWatchdog);
  cancelAnimationFrame(startupFrame);cancelAnimationFrame(startupFrame2);
  document.removeEventListener("keydown",key);
  if(audioContext){audioContext.close().catch(()=>{});audioContext=null;}
  window.removeEventListener("resize",fitBoard);
  if(observer){observer.disconnect();observer=null;}
 }
 root._zebraDispose=dispose;
 document.addEventListener("keydown",key);
 let last=performance.now(),accum=0;
 clock=setInterval(()=>{
  if(!active)return;if(!root.isConnected){dispose();return;}
  let now=performance.now(),delta=Math.min(now-last,130);last=now;
  if(clearRows.length){
   accum=0;
   if(now>=clearDeadline)completeClear();
   render();
  }else if(!paused&&!over&&!document.hidden){
   accum+=delta;
   if(accum>Math.max(85,750*Math.pow(.83,level-1))){accum=0;tick();}
  }
 },40);
 reset();paused=true;updateStatus();render();
 if(typeof ResizeObserver!=="undefined"){
  observer=new ResizeObserver(fitBoard);
  observer.observe(main);
 }else window.addEventListener("resize",fitBoard);
 requestAnimationFrame(fitBoard);
 return dispose;
}
window.ZebraTetris={mount};
}());