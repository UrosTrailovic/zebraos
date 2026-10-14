/* Zebra Snake : safari pixel art. Sprites tirés de la planche du studio.
   Dessin de jeu hors ligne, flèches/clavier et boutons mobiles. */
(function(){
"use strict";
const N=20, CELL=20, EDGE=16, SIZE=N*CELL+EDGE*2;
const node=(tag,cls,txt)=>{
 const e=document.createElement(tag);if(cls)e.className=cls;
 if(txt!==undefined)e.textContent=txt;return e;
};
const button=(label,action,cls)=>{
 const b=node("button",cls||"safari-btn",label);b.type="button";b.onclick=action;return b;
};
const art=()=>window.ZebraSnakeArt;
function best(){try{return Math.max(0,Number(localStorage.getItem("zebra.snake.best"))||0);}catch(_){return 0;}}
function save(n){try{localStorage.setItem("zebra.snake.best",String(n));}catch(_){}}
function mount(root){
 if(root._zebraDispose)root._zebraDispose();
 root.innerHTML="";
 let active=true,playing=false,over=false,snake=[],food=null;
 let dir={x:1,y:0},queued={x:1,y:0},score=0,record=best(),clock=null;
 let speed="normal",canTurn=true,wrapWalls=false,terrainReady=false,won=false;
 const outer=node("div","zg zg-snake safari");
 const sidebar=node("aside","safari-sidebar");
 const logoBox=node("div","safari-logo-wrap");
 const logo=node("canvas","safari-logo");
 logo.width=210;logo.height=108;logo.setAttribute("aria-label","Zebra Snake");
 logoBox.appendChild(logo);sidebar.appendChild(logoBox);
 const info=node("div","safari-info");
 function counter(label,cls){
  const card=node("div","safari-info-card "+cls),text=node("small","",label),value=node("strong","","0");
  card.append(text,value);info.appendChild(card);return value;
 }
 const scoreEl=counter("SCORE","safari-score");
 const recordEl=counter("RECORD","safari-record");
 sidebar.appendChild(info);
 const speedCard=node("div","safari-speed-box");
 const speedTitle=node("label","safari-speed-label","VITESSE");
 const speedSelect=node("select","safari-select");
 [["lent","Lente"],["normal","Normale"],["vite","Rapide"]].forEach(([id,name])=>{
   const o=node("option","",name);o.value=id;speedSelect.appendChild(o);
 });
 speedSelect.value=speed;
 speedSelect.onchange=()=>{speed=speedSelect.value;setupClock();};
 speedTitle.appendChild(speedSelect);speedCard.appendChild(speedTitle);
 sidebar.appendChild(speedCard);
 const wallLabel=node("label","safari-walls");
 const walls=node("input");walls.type="checkbox";
 walls.onchange=()=>{wrapWalls=walls.checked;};
 wallLabel.append(walls,node("span","","Traverser les bords"));sidebar.appendChild(wallLabel);
 const controls=node("div","safari-actions");
 const start=button("JOUER",()=>{
   if(over){reset();playing=true;}
   else playing=!playing;
   update();
 },"safari-btn safari-play");
 const restart=button("RECOMMENCER",()=>{
   reset();playing=true;update();
 },"safari-btn safari-restart");
 controls.append(start,restart);sidebar.appendChild(controls);
 const help=node("div","safari-help");
 help.appendChild(node("strong","","COMMANDES"));
 help.appendChild(node("div","","← ↑ ↓ → pour se diriger"));
 help.appendChild(node("div","","ZQSD / WASD · P pause"));
 help.appendChild(node("div","","Mange les pommes rouges"));
 sidebar.appendChild(help);
 const main=node("div","safari-main");
 const header=node("div","safari-main-heading");
 header.appendChild(node("span","","SAVANE"));
 const state=node("span","safari-state","PRÊT");
 header.appendChild(state);main.appendChild(header);
 const frame=node("div","safari-frame");
 const canvas=node("canvas","safari-canvas");
 canvas.width=SIZE;canvas.height=SIZE;
 canvas.setAttribute("aria-label","Serpent zébré dans une savane pixel art");
 frame.appendChild(canvas);
 const overlay=node("div","safari-overlay");
 overlay.appendChild(node("strong","","ZEBRA SNAKE"));
 overlay.appendChild(node("span","","Appuie sur Jouer"));
 frame.appendChild(overlay);
 main.appendChild(frame);
 const foot=node("div","safari-main-foot","LE SERPENT ZÉBRÉ · ÉDITION SAFARI");
 main.appendChild(foot);
 const touch=node("div","safari-touch");
 [["",""],["▲","up"],["",""],["◀","left"],["▼","down"],["▶","right"]].forEach(([label,d])=>{
  touch.appendChild(d?button(label,()=>turn(d),"safari-btn safari-direction"):node("span"));
 });
 outer.append(sidebar,main,touch);root.appendChild(outer);
 const c=canvas.getContext("2d",{alpha:false});
 const landscape=document.createElement("canvas");
 landscape.width=SIZE;landscape.height=SIZE;
 const lc=landscape.getContext("2d");
 if(!c||!lc)return;
 function pixel(ctx,name,x,y,w,h){
  const a=art();
  if(!a||!a.draw||!a.draw(ctx,name,x,y,w,h))return false;
  return true;
 }
 function rnd(seed){let x=Math.sin(seed*133.729+2.371)*45758.5453;return x-Math.floor(x);}
 function tile(name,x,y,w,h){
  if(!pixel(lc,name,x,y,w,h)){
   const fallback={grass_tile:"#a99a42",dry_tile:"#a88941",sand_tile:"#cbad65",dirt_tile:"#aa7639",dark_tile:"#836237"};
   lc.fillStyle=fallback[name]||"#bda44f";lc.fillRect(x,y,w,h);
  }
 }
 function terrain(){
  lc.imageSmoothingEnabled=false;
  lc.fillStyle="#ad9548";lc.fillRect(0,0,SIZE,SIZE);
  // Base : 10 × 10 fragments de sol, textures variées mais stables entre les parties.
  for(let y=0;y<N;y+=2)for(let x=0;x<N;x+=2){
   const n=rnd(x*19+y*41),which=n<.55?"grass_tile":n<.72?"dry_tile":n<.87?"sand_tile":n<.96?"dirt_tile":"dark_tile";
   tile(which,EDGE+x*CELL,EDGE+y*CELL,2*CELL,2*CELL);
  }
  // Décors derrière le serpent : jamais des obstacles de gameplay.
  const props=[
   ["tree",.03,.05,58,46],["tree",.83,.02,53,43],["tree",.82,.84,64,47],
   ["tree",.02,.82,57,44],["bush",.33,.09,33,29],["bush",.73,.64,29,25],
   ["rocks",.72,.17,33,27],["rocks",.09,.67,34,27],["rocks",.48,.81,28,22],
   ["dry_grass",.44,.21,26,25],["grass",.14,.37,23,27],["grass",.72,.41,24,28],
   ["grass",.40,.61,27,29],["dry_grass",.77,.78,23,23],
   ["stump",.21,.76,25,20],["grass",.25,.14,19,22],["bush",.60,.89,22,19]
  ];
  for(const [name,x,y,w,h] of props){
   lc.globalAlpha=.82;
   pixel(lc,name,EDGE+x*(N*CELL-50),EDGE+y*(N*CELL-50),w,h);
  }
  lc.globalAlpha=1;
  // Quatre bordures en pierre, issues du même atlas de sprites.
  lc.fillStyle="#38251c";
  lc.fillRect(0,0,SIZE,EDGE);lc.fillRect(0,SIZE-EDGE,SIZE,EDGE);
  lc.fillRect(0,0,EDGE,SIZE);lc.fillRect(SIZE-EDGE,0,EDGE,SIZE);
  for(let x=EDGE;x<SIZE-EDGE;x+=28){
   pixel(lc,"frame_h",x,0,28,EDGE);
   pixel(lc,"frame_h",x,SIZE-EDGE,28,EDGE);
  }
  for(let y=EDGE;y<SIZE-EDGE;y+=29){
   pixel(lc,"frame_v",0,y,EDGE,29);
   pixel(lc,"frame_v",SIZE-EDGE,y,EDGE,29);
  }
  for(const [x,y] of [[0,0],[SIZE-EDGE,0],[0,SIZE-EDGE],[SIZE-EDGE,SIZE-EDGE]]){
   pixel(lc,"frame_corner",x,y,EDGE,EDGE);
  }
  terrainReady=true;
 }
 function randomFood(){
  const free=[];
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
   if(!snake.some(p=>p.x===x&&p.y===y))free.push({x,y});
  }
  food=free.length?free[Math.floor(Math.random()*free.length)]:null;
  if(!food){over=true;playing=false;won=true;}
 }
 function reset(){
  snake=[{x:7,y:10},{x:6,y:10},{x:5,y:10}];
  dir={x:1,y:0};queued={x:1,y:0};canTurn=true;
  score=0;over=false;playing=false;won=false;
  randomFood();render();update();
 }
 function turn(which){
  if(over)return;
  const directions={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
  const d=directions[which];
  if(d&&canTurn&&!(d.x===-dir.x&&d.y===-dir.y)){queued=d;canTurn=false;}
 }
 function advance(){
  if(!playing||over||document.hidden)return;
  dir=queued;
  const h={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
  if(wrapWalls){h.x=(h.x+N)%N;h.y=(h.y+N)%N;}
  const eat=food&&h.x===food.x&&h.y===food.y;
  const body=eat?snake:snake.slice(0,-1);
  if(h.x<0||h.x>=N||h.y<0||h.y>=N||body.some(p=>p.x===h.x&&p.y===h.y)){
   playing=false;over=true;update();render();return;
  }
  snake.unshift(h);
  if(eat){
   score+=10;
   if(score>record){record=score;save(record);}
   randomFood();
  }else snake.pop();
  canTurn=true;render();update();
 }
 function headOrientation(){
  if(snake.length<2)return dir;
  const h=snake[0],n=snake[1];
  const dx=h.x-n.x,dy=h.y-n.y;
  if(Math.abs(dx)+Math.abs(dy)!==1)return dir;
  return {x:dx,y:dy};
 }
 function drawBody(s,i){
  const prev=snake[i-1],next=snake[i+1];
  if(!next)return sprite("body_h",s.x,s.y);
  const horizontal=prev.y===s.y&&next.y===s.y;
  const vertical=prev.x===s.x&&next.x===s.x;
  if(horizontal)return sprite("body_h",s.x,s.y);
  if(vertical)return sprite("body_v",s.x,s.y);
  // Angle : le sprite coudé est tourné pour raccorder les deux segments.
  let n1={x:prev.x-s.x,y:prev.y-s.y},n2={x:next.x-s.x,y:next.y-s.y};
  if(Math.abs(n1.x)>1)n1.x=-Math.sign(n1.x);
  if(Math.abs(n2.x)>1)n2.x=-Math.sign(n2.x);
  if(Math.abs(n1.y)>1)n1.y=-Math.sign(n1.y);
  if(Math.abs(n2.y)>1)n2.y=-Math.sign(n2.y);
  const neighbors=[n1,n2];
  const up=neighbors.some(n=>n.y===-1),right=neighbors.some(n=>n.x===1),
        down=neighbors.some(n=>n.y===1),left=neighbors.some(n=>n.x===-1);
  let angle=0;
  if(right&&down)angle=Math.PI/2;
  else if(down&&left)angle=Math.PI;
  else if(left&&up)angle=3*Math.PI/2;
  else if(!(up&&right))return sprite("body_h",s.x,s.y);
  const px=EDGE+s.x*CELL+CELL/2,py=EDGE+s.y*CELL+CELL/2;
  c.save();c.translate(px,py);c.rotate(angle);
  const ok=pixel(c,"bend_ne",-CELL/2,-CELL/2,CELL,CELL);
  c.restore();
  if(!ok)rect(s.x,s.y,"#f4ebd3");
 }
 function rect(x,y,color){
  c.fillStyle=color;c.fillRect(EDGE+x*CELL+2,EDGE+y*CELL+2,CELL-4,CELL-4);
  c.fillStyle="#29211d";c.fillRect(EDGE+x*CELL+7,EDGE+y*CELL+2,5,CELL-4);
 }
 function sprite(name,x,y){
  if(!pixel(c,name,EDGE+x*CELL-1,EDGE+y*CELL-1,CELL+2,CELL+2))rect(x,y,"#f6e8c4");
 }
 function render(){
  c.imageSmoothingEnabled=false;
  if(!terrainReady)terrain();
  c.drawImage(landscape,0,0);
  if(food){
   if(!pixel(c,"apple",EDGE+food.x*CELL-2,EDGE+food.y*CELL-5,CELL+5,CELL+6)){
    c.fillStyle="#c72b14";c.fillRect(EDGE+food.x*CELL+4,EDGE+food.y*CELL+3,12,14);
   }
  }
  for(let i=snake.length-1;i>=0;i--){
   const s=snake[i];
   if(i===0){
    const d=headOrientation();
    sprite(d.x===1?"head_e":d.x===-1?"head_w":d.y===-1?"head_n":"head_s",s.x,s.y);
   }else drawBody(s,i);
  }
 }
 function update(){
  state.textContent=won?"VICTOIRE":over?"TERMINÉ":playing?"EN COURS":"PAUSE";
  start.textContent=over?"REJOUER":playing?"PAUSE":"JOUER";
  scoreEl.textContent=score;recordEl.textContent=record;
  overlay.style.display=!playing?"flex":"none";
  overlay.firstChild.textContent=won?"VICTOIRE":over?"PERDU":"ZEBRA SNAKE";
  overlay.children[1].textContent=over?"Recommence pour rejouer":"Appuie sur Jouer pour continuer";
 }
 function key(e){
  if(!active||!root.isConnected)return;
  const win=root.closest(".window");
  if(win&&(win.classList.contains("minimized")||!win.classList.contains("focused")))return;
  if(["INPUT","SELECT","TEXTAREA"].includes(e.target.tagName))return;
  const k=e.key.toLowerCase();
  const keys={arrowup:"up",arrowdown:"down",arrowleft:"left",arrowright:"right",w:"up",z:"up",s:"down",a:"left",q:"left",d:"right"};
  if(keys[k]){e.preventDefault();turn(keys[k]);}
  else if(k==="p"||k===" "){e.preventDefault();if(over){reset();playing=true;}else playing=!playing;update();}
 }
 function setupClock(){
  if(clock)clearInterval(clock);
  const delay={lent:190,normal:125,vite:82}[speed]||125;
  clock=setInterval(()=>{
   if(!active)return;
   if(!root.isConnected){dispose();return;}
   const win=root.closest(".window");
   if(win?.classList.contains("minimized"))return;
   advance();
  },delay);
 }
 function drawLogo(){
  const ctx=logo.getContext("2d");if(!ctx)return;
  ctx.clearRect(0,0,logo.width,logo.height);
  ctx.imageSmoothingEnabled=false;
  if(!pixel(ctx,"logo",0,0,210,108)){
    ctx.fillStyle="#d59a46";ctx.font="bold 27px monospace";ctx.fillText("ZEBRA",12,46);ctx.fillText("SNAKE",12,80);
  }
 }
 function updateArt(){
  if(!active)return;
  terrainReady=false;drawLogo();render();
 }
 function dispose(){
  active=false;clearInterval(clock);document.removeEventListener("keydown",key);
  if(art()?.image)art().image.removeEventListener("load",updateArt);
 }
 root._zebraDispose=dispose;
 document.addEventListener("keydown",key);
 if(art()?.image)art().image.addEventListener("load",updateArt);
 setupClock();reset();drawLogo();
 return dispose;
}
window.ZebraSnake={mount};
}());