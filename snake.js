/* ZebraSnake — jeu de serpent rétro, clavier + tactile. */
(function(){
"use strict";
const N=20,S=20;
const node=(tag,cls,text)=>{let e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
function button(label,fn){let b=node("button","zg-button",label);b.type="button";b.onclick=fn;return b;}
function best(){try{return Number(localStorage.getItem("zebra.snake.best"))||0}catch(_){return 0;}}
function save(n){try{localStorage.setItem("zebra.snake.best",String(n));}catch(_){}}
function mount(root){
 if(root._zebraDispose)root._zebraDispose();
 root.innerHTML="";
 let active=true,playing=false,over=false,snake=[],food=null,dir={x:1,y:0},queued={x:1,y:0},score=0,bestScore=best(),timer=null,speed="normal",wrapWalls=false,canTurn=true;
 const outer=node("div","zg zg-snake"),head=node("div","zg-topline");
 head.appendChild(node("strong","","ZEBRA SNAKE"));
 let status=node("span","zg-state","PRÊT");head.appendChild(status);outer.appendChild(head);
 const stats=node("div","zg-snake-stats"),scoreEl=node("strong","","SCORE 0"),bestEl=node("strong","","RECORD "+bestScore);
 stats.append(scoreEl,bestEl);outer.appendChild(stats);
 const stage=node("div","zg-snake-stage"),canvas=node("canvas","zg-snake-board");
 canvas.width=N*S;canvas.height=N*S;canvas.setAttribute("aria-label","Plateau Snake");
 stage.appendChild(canvas);
 const overlay=node("div","zg-overlay");overlay.appendChild(node("strong","","SNAKE"));overlay.appendChild(node("span","","Appuie sur Jouer"));
 stage.appendChild(overlay);outer.appendChild(stage);
 const options=node("div","zg-snake-options");
 let speedLabel=node("label","","Vitesse ");
 const speedSelect=node("select","zg-select");[["lent","Lente"],["normal","Normale"],["vite","Rapide"]].forEach(([value,label])=>{let o=node("option","",label);o.value=value;speedSelect.appendChild(o);});
 speedSelect.value=speed;speedSelect.onchange=()=>{speed=speedSelect.value;setupClock();};speedLabel.appendChild(speedSelect);options.appendChild(speedLabel);
 const walls=node("label","zg-snake-wrap"),wallCheck=node("input");wallCheck.type="checkbox";
 wallCheck.onchange=()=>{wrapWalls=wallCheck.checked;};walls.append(wallCheck,node("span","","Traverser les murs"));options.appendChild(walls);
 outer.appendChild(options);
 const buttons=node("div","zg-buttons");
 const start=button("▶ Jouer",()=>{if(over){reset();playing=true;}else playing=!playing;update();});
 buttons.append(start,button("↻ Recommencer",()=>{reset();playing=true;update();}));
 outer.appendChild(buttons);
 const pad=node("div","zg-snake-pad");
 [["",""],["▲","up"],["",""],["◀","left"],["▼","down"],["▶","right"]].forEach(([label,action])=>{
  if(!action){pad.appendChild(node("span"));return;}
  pad.appendChild(button(label,()=>turn(action)));
 });
 outer.appendChild(pad);
 outer.appendChild(node("div","zg-help","Flèches / ZQSD / WASD · P pause · Mange les carrés pour grandir"));
 root.appendChild(outer);
 const c=canvas.getContext("2d");
 function randomFood(){
  let free=[];for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(!snake.some(p=>p.x===x&&p.y===y))free.push({x,y});
  food=free.length?free[Math.floor(Math.random()*free.length)]:null;
  if(!food){over=true;playing=false;status.textContent="VICTOIRE";}
 }
 function reset(){
  snake=[{x:7,y:10},{x:6,y:10},{x:5,y:10}];
  dir={x:1,y:0};queued={x:1,y:0};canTurn=true;
  score=0;over=false;playing=false;randomFood();render();update();
 }
 function turn(which){
  if(over)return;
  let dirs={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
  const d=dirs[which];
  if(d&&canTurn&&!(d.x===-dir.x&&d.y===-dir.y)){queued=d;canTurn=false;}
 }
 function advance(){
  if(!playing||over||document.hidden)return;
  dir=queued;let h={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
  if(wrapWalls){h.x=(h.x+N)%N;h.y=(h.y+N)%N;}
  const eat=food&&h.x===food.x&&h.y===food.y;
  let body=eat?snake:snake.slice(0,-1);
  if(h.x<0||h.x>=N||h.y<0||h.y>=N||body.some(p=>p.x===h.x&&p.y===h.y)){
    playing=false;over=true;update();render();return;
  }
  snake.unshift(h);
  if(eat){
   score+=10;if(score>bestScore){bestScore=score;save(bestScore);}
   randomFood();
  }else snake.pop();
  canTurn=true;render();update();
 }
 function update(){
  status.textContent=over?"PARTIE TERMINÉE":playing?"EN COURS":"PAUSE";
  start.textContent=over?"▶ Rejouer":playing?"Ⅱ Pause":"▶ Jouer";
  scoreEl.textContent="SCORE "+score;bestEl.textContent="RECORD "+bestScore;
  overlay.style.display=!playing?"flex":"none";
  overlay.firstChild.textContent=over?"PERDU":"SNAKE";
  overlay.children[1].textContent=over?"Recommence pour rejouer":"Appuie sur Jouer pour continuer";
 }
 function rect(x,y,color){c.fillStyle=color;c.fillRect(x*S+2,y*S+2,S-4,S-4);}
 function render(){
  c.fillStyle="#13201a";c.fillRect(0,0,N*S,N*S);
  c.strokeStyle="#23362c";c.lineWidth=.5;
  for(let n=0;n<=N;n++){c.beginPath();c.moveTo(n*S,0);c.lineTo(n*S,N*S);c.moveTo(0,n*S);c.lineTo(N*S,n*S);c.stroke();}
  if(food){rect(food.x,food.y,"#eac34c");c.fillStyle="#fff6b0";c.fillRect(food.x*S+7,food.y*S+5,5,5);}
  snake.forEach((p,i)=>rect(p.x,p.y,i===0?"#b9e6bc":"#569a68"));
 }
 function key(e){
  if(!active||!root.isConnected||root.closest(".window")?.classList.contains("minimized")||!root.closest(".window")?.classList.contains("focused"))return;
  if(["INPUT","SELECT","TEXTAREA"].includes(e.target.tagName))return;
  const k=e.key.toLowerCase();
  const dirs={arrowup:"up",arrowdown:"down",arrowleft:"left",arrowright:"right",w:"up",z:"up",s:"down",a:"left",q:"left",d:"right"};
  if(dirs[k]){e.preventDefault();turn(dirs[k]);}
  if(k==="p"||k===" "){e.preventDefault();if(over){reset();playing=true;}else playing=!playing;update();}
 }
 function setupClock(){
  if(timer)clearInterval(timer);
  let ms={lent:190,normal:125,vite:82}[speed]||125;
  timer=setInterval(()=>{
   if(!active)return;if(!root.isConnected){dispose();return;}
   if(root.closest(".window")?.classList.contains("minimized"))return;
   advance();
  },ms);
 }
 function dispose(){active=false;clearInterval(timer);document.removeEventListener("keydown",key);}
 root._zebraDispose=dispose;
 document.addEventListener("keydown",key);
 setupClock();reset();return dispose;
}
window.ZebraSnake={mount};
}());