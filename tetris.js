/* ZebraTetris — puzzle jouable hors ligne, ZebraOS v1. */
(function(){
"use strict";
const W=10,H=20,BLOCK=24;
const COLORS=["","#30c7d7","#e8bb3c","#b061d9","#5caf69","#c75457","#4974cb","#dc9657"];
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
 let wrap=make("div","zg zg-tetris zg-retro");
 let bar=make("div","zg-topline");
 let logo=make("img","zt-logo");
 logo.alt="Zebra Tetris";
 logo.src="";
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
 let right=make("div","zg-side");
 function stat(title){let box=make("div","zg-stat");box.appendChild(make("small","",title));let count=make("strong","","0");box.appendChild(count);right.appendChild(box);return count;}
 let scoreEl=stat("SCORE"),levelEl=stat("NIVEAU"),linesEl=stat("LIGNES"),bestEl=stat("RECORD");
 let nextBox=make("div","zg-preview-wrap");nextBox.appendChild(make("small","","SUIVANT"));
 let next=make("canvas","zg-mini");next.width=96;next.height=96;nextBox.appendChild(next);right.appendChild(nextBox);
 let holdBox=make("div","zg-preview-wrap");holdBox.appendChild(make("small","","RÉSERVE (C)"));
 let hold=make("canvas","zg-mini");hold.width=96;hold.height=96;holdBox.appendChild(hold);right.appendChild(holdBox);
 main.insertBefore(right,stage);wrap.appendChild(main);
 let controls=make("div","zg-buttons zt-buttons");
 const start=btn("JOUER",()=>{if(over||!current){reset();return;}paused=!paused;updateStatus();});
 start.classList.add("zt-image-button","zt-play");
 const restart=btn("RECOMMENCER",()=>reset());
 restart.classList.add("zt-image-button","zt-restart");
 const menu=btn("MENU",()=>{if(!menuOpen){menuOpen=true;paused=true;}else menuOpen=false;updateStatus();});
 menu.classList.add("zt-image-button","zt-menu");
 let menuOpen=false;
 controls.append(start,restart,menu);wrap.appendChild(controls);
 let pad=make("div","zg-control-pad");
 [["◀",()=>move(-1,0)],["⟳",rotate],["▶",()=>move(1,0)],["▼",()=>soft()],["⤓",hardDrop],["Réserve",holdPiece]].forEach(([label,action])=>pad.appendChild(btn(label,action)));
 wrap.appendChild(pad);
 wrap.appendChild(make("div","zg-help","← → déplacer · ↑ tourner · ↓ descendre · Espace poser · C réserve · P pause"));
 root.appendChild(wrap);
 // Les textures viennent de la planche fournie par l'auteur. Aucun asset généré à l'exécution.
 let atlasReady=false;
 if(window.ZebraTetrisArtwork){
  window.ZebraTetrisArtwork.apply({
   wrap:wrap,logo:logo,overlay:overlayArt,start:start,restart:restart,menu:menu,
   onReady:function(){atlasReady=true;render();updateStatus();}
  });
 }
 let ctx=canvas.getContext("2d"),nextCtx=next.getContext("2d"),holdCtx=hold.getContext("2d");
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
  if(collision(mat,current.x,current.y)){over=true;paused=true;updateStatus();}
 }
 function reset(){
  grid=blank();bag=[];upcoming=[];lines=0;score=0;level=1;held=null;holdUsed=false;
  over=false;paused=false;current=null;spawn();render();updateStatus();
 }
 function merged(){
  current.mat.forEach((row,y)=>row.forEach((v,x)=>{if(v&&current.y+y>=0){grid[current.y+y][current.x+x]=v;}}));
  let cleared=0;
  for(let y=H-1;y>=0;y--){
   if(grid[y].every(Boolean)){grid.splice(y,1);grid.unshift(Array(W).fill(0));cleared++;y++;}
  }
  if(cleared){
   score+=([0,100,300,500,800][cleared]||800)*level;
   lines+=cleared;level=Math.floor(lines/10)+1;
   if(score>records){records=score;saveBest(records);}
  }
  holdUsed=false;spawn();
 }
 function move(dx,dy){
  if(paused||over||!current)return false;
  if(!collision(current.mat,current.x+dx,current.y+dy)){current.x+=dx;current.y+=dy;render();return true;}
  if(dy){merged();render();}return false;
 }
 function soft(){if(!move(0,1))return;if(!paused){score++;if(score>records){records=score;saveBest(records);}}render();}
 function hardDrop(){
  if(paused||over||!current)return;
  let steps=0;while(!collision(current.mat,current.x,current.y+1)){current.y++;steps++;}
  score+=steps*2;if(score>records){records=score;saveBest(records);}
  merged();render();
 }
 function rotate(){
  if(paused||over||!current)return;
  const m=current.mat,rot=m[0].map((_,i)=>m.map(r=>r[i]).reverse());
  for(const dx of [0,-1,1,-2,2]){
   if(!collision(rot,current.x+dx,current.y)){current.mat=rot;current.x+=dx;render();return;}
  }
 }
 function holdPiece(){
  if(paused||over||holdUsed||!current)return;
  let previous=current.type;
  if(held===null){held=previous;spawn();}
  else{
   let type=held;held=previous;let mat=piece(type);
   current={type,mat,x:Math.floor((W-mat[0].length)/2),y:-1};
   if(collision(mat,current.x,current.y)){over=true;paused=true;}
  }
  holdUsed=true;render();updateStatus();
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
    menuOpen?"P : pause · C : réserve · Espace : poser":
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
  const action={"ArrowLeft":()=>move(-1,0),"ArrowRight":()=>move(1,0),"ArrowDown":soft,"ArrowUp":rotate," ":hardDrop,"c":holdPiece,"C":holdPiece,"p":()=>{if(!over){menuOpen=false;paused=!paused;updateStatus();}},"P":()=>{if(!over){menuOpen=false;paused=!paused;updateStatus();}}};
  if(action[e.key]){e.preventDefault();action[e.key]();}
 }
 function tick(){
  if(!active)return;
  if(!root.isConnected){dispose();return;}
  if(!paused&&!over&&!document.hidden)move(0,1);
 }
 // Garder les 20 lignes du plateau entièrement visibles, même après un resize.
 // La scène se dimensionne selon l'espace réel de la fenêtre.
 function fitBoard(){
  if(!active||!main.isConnected)return;
  const sideWidth=right.getBoundingClientRect().width||155;
  const gap=parseFloat(getComputedStyle(main).columnGap)||9;
  const availableWidth=Math.max(60,main.clientWidth-sideWidth-gap-28);
  const availableHeight=Math.max(125,main.clientHeight-22);
  const width=Math.max(48,Math.min(240,availableWidth,availableHeight/2));
  if(!Number.isFinite(width))return;
  const pixels=Math.floor(width);
  stage.style.width=pixels+"px";
  stage.style.height=(pixels*2)+"px";
 }
 function dispose(){
  active=false;clearInterval(clock);document.removeEventListener("keydown",key);
  window.removeEventListener("resize",fitBoard);
  if(observer){observer.disconnect();observer=null;}
 }
 root._zebraDispose=dispose;
 document.addEventListener("keydown",key);
 let last=performance.now(),accum=0;
 clock=setInterval(()=>{
  if(!active)return;if(!root.isConnected){dispose();return;}
  let now=performance.now(),delta=Math.min(now-last,130);last=now;
  if(!paused&&!over&&!document.hidden){accum+=delta;if(accum>Math.max(85,750*Math.pow(.83,level-1))){accum=0;tick();}}
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