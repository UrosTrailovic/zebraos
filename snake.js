/* Zebra Snake — classic grid rules, self-contained pixel artwork. */
(function(){
'use strict';
const W=24,H=20,C=16,B=16,CW=W*C+B*2,CH=H*C+B*2;
const DIR={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
function createGame(random=Math.random){
 const g={snake:[],queue:[],direction:'right',food:null,score:0,state:'ready'};
 function food(){
  const free=[];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(!g.snake.some(p=>p.x===x&&p.y===y))free.push({x,y});
  g.food=free.length?free[Math.min(free.length-1,Math.floor(random()*free.length))]:null;
  if(!g.food)g.state='won';
 }
 g.reset=function(){g.snake=[{x:9,y:10},{x:8,y:10},{x:7,y:10},{x:6,y:10}];g.direction='right';g.queue=[];g.score=0;g.state='ready';food();};
 g.turn=function(d){
  if(!DIR[d]||g.state==='over'||g.state==='won'||g.state==='paused')return false;
  const prev=DIR[g.queue[g.queue.length-1]||g.direction],next=DIR[d];
  if(g.queue.length>=2||(prev[0]===next[0]&&prev[1]===next[1])||(prev[0]===-next[0]&&prev[1]===-next[1]))return false;
  g.queue.push(d);if(g.state==='ready')g.state='running';return true;
 };
 g.toggle=function(){if(g.state==='over'||g.state==='won')g.reset();g.state=g.state==='running'?'paused':'running';};
 g.tick=function(){
  if(g.state!=='running')return;
  if(g.queue.length)g.direction=g.queue.shift();
  const d=DIR[g.direction],p={x:g.snake[0].x+d[0],y:g.snake[0].y+d[1]};
  const eats=g.food&&p.x===g.food.x&&p.y===g.food.y;
  const body=eats?g.snake:g.snake.slice(0,-1);
  if(p.x<0||p.x>=W||p.y<0||p.y>=H||body.some(q=>q.x===p.x&&q.y===p.y)){g.state='over';g.queue=[];return;}
  g.snake.unshift(p);if(eats){g.score+=10;food();}else g.snake.pop();
 };
 g.reset();return g;
}
function make(tag,cls,text){const e=document.createElement(tag);e.className=cls||'';if(text!==undefined)e.textContent=text;return e;}
function draw(ctx,g){
 ctx.imageSmoothingEnabled=false;
 ctx.fillStyle='#071d30';ctx.fillRect(0,0,CW,CH);
 for(let y=0;y<CH;y+=8)for(let x=0;x<CW;x+=8){ctx.fillStyle=(x+y)%16?'#1435a1':'#204bc4';ctx.fillRect(x+1,y+1,6,6);}
 ctx.fillStyle='#55523c';ctx.fillRect(B,B,W*C,H*C);
 for(let y=0;y<H*C;y+=4)for(let x=0;x<W*C;x+=4){const n=(x*31+y*17+(x*y)%71)%29;ctx.fillStyle=n<3?'#626047':n<6?'#494c38':'#55563d';ctx.fillRect(B+x,B+y,2,2);}
 // Dry leaves, scattered sparsely enough to keep the food and ribbon clear.
 for(let i=0;i<30;i++){const x=B+8+(i*79)%(W*C-16),y=B+8+(i*47)%(H*C-16);ctx.fillStyle=i%3?'#956538':'#b78a49';ctx.fillRect(x,y,3,2);}
 // Tiny scenery stays outside the playable grid; nothing invisible blocks movement.
 function tree(x,y){ctx.fillStyle='#101e24';ctx.fillRect(x+3,y+6,3,5);ctx.fillStyle='#9b6036';ctx.fillRect(x+1,y+2,7,6);ctx.fillRect(x+3,y,3,2);ctx.fillStyle='#d59b4a';ctx.fillRect(x+2,y+2,2,3);}
 function rock(x,y){ctx.fillStyle='#111d29';ctx.fillRect(x,y+3,10,5);ctx.fillStyle='#74888b';ctx.fillRect(x+2,y+1,6,5);ctx.fillStyle='#acb2a1';ctx.fillRect(x+3,y+1,3,2);}
 for(let i=0;i<9;i++){const x=24+i*44;(i%3?tree:rock)(x,2);(i%3?rock:tree)(x,CH-13);}
 for(let i=0;i<7;i++){(i%2?tree:rock)(3,30+i*44);(i%2?rock:tree)(CW-13,30+i*44);}
 if(g.food){const x=B+g.food.x*C,y=B+g.food.y*C;ctx.fillStyle='#123021';ctx.fillRect(x+3,y+13,11,2);ctx.fillStyle='#fe7552';ctx.fillRect(x+3,y+5,10,8);ctx.fillRect(x+5,y+3,6,2);ctx.fillStyle='#ffce79';ctx.fillRect(x+4,y+5,3,3);ctx.fillStyle='#a5cf59';ctx.fillRect(x+8,y+1,4,2);}
 // Draw one connected ribbon, then a narrow highlight. Corners stay joined.
 const points=g.snake.map(p=>({x:B+p.x*C+8,y:B+p.y*C+8}));
 function ribbon(color,width,offset){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y+offset):ctx.moveTo(p.x,p.y+offset));ctx.stroke();}
 ribbon('#202522',14,2);ribbon('#e0d9ae',11,0);ribbon('#faf0c5',4,-2);
 // Simple zebra marks on each straight segment, clipped away from the head.
 ctx.fillStyle='#282b2c';
 for(let i=1;i<points.length;i++){
  const p=points[i],prev=points[i-1],horizontal=prev.y===p.y;
  if(horizontal){ctx.fillRect(p.x-3,p.y-5,3,7);ctx.fillRect(p.x+2,p.y,3,5);}
  else{ctx.fillRect(p.x-5,p.y-3,7,3);ctx.fillRect(p.x,p.y+2,5,3);}
 }
 const head=points[0],d=DIR[g.direction],side=[-d[1],d[0]];
 for(const s of [-1,1]){const x=head.x+d[0]*3+side[0]*s*3,y=head.y+d[1]*3+side[1]*s*3;ctx.fillStyle='#fff6b0';ctx.fillRect(x-1,y-1,3,3);ctx.fillStyle='#112b27';ctx.fillRect(x+d[0],y+d[1],2,2);}
}
function mount(root){
 if(root._zebraDispose)root._zebraDispose();root.innerHTML='';
 const g=createGame();let alive=true,best=0,observer;
 try{best=Number(localStorage.getItem('zebra.snake.best'))||0;}catch(_){}
 const wrap=make('div','zs-machine');
 wrap.innerHTML='<header class="zs-header"><strong class="zs-logo">ZEBRA <span>SNAKE</span></strong><span class="zs-state">PRÊT</span></header><div class="zs-hud"><div>SCORE <b class="zs-score">0000</b></div><div>RECORD <b class="zs-best">0000</b></div></div><div class="zs-arena"><div class="zs-stage"><canvas aria-label="Terrain de Snake : manger les pommes, éviter les murs et sa queue"></canvas><div class="zs-overlay"><strong></strong><span></span><button type="button" class="zs-button zs-start">Jouer</button></div></div></div><footer class="zs-console"><div class="zs-toolbar"></div><div class="zs-handheld"><div class="zs-dpad" aria-label="Direction"></div><div class="zs-ab"></div></div><p class="zs-help">FLÈCHES / ZQSD · ESPACE : PAUSE</p></footer>';
 root.appendChild(wrap);
 const $=s=>wrap.querySelector(s),canvas=$('canvas'),ctx=canvas.getContext('2d');canvas.width=CW;canvas.height=CH;
 const stage=$('.zs-stage'),arena=$('.zs-arena'),overlay=$('.zs-overlay'),status=$('.zs-state');
 function button(label,cls,fn,parent){const e=make('button','zs-button '+cls,label);e.type='button';e.onclick=fn;parent.appendChild(e);return e;}
 const play=button('Jouer','zs-play',()=>{g.toggle();render();},$('.zs-toolbar'));
 button('Recommencer','zs-restart',()=>{g.reset();g.toggle();render();},$('.zs-toolbar'));
 button('Menu','zs-menu',()=>{g.reset();render();},$('.zs-toolbar'));
 for(const [d,label]of Object.entries({up:'▲',left:'◀',right:'▶',down:'▼'})){
  const b=button(label,'zs-dir zs-'+d,e=>{if(e.detail===0){g.turn(d);render();}},$('.zs-dpad'));
  b.setAttribute('aria-label',({up:'Haut',down:'Bas',left:'Gauche',right:'Droite'})[d]);
  b.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();g.turn(d);render();};
 }
 const a=button('A','zs-a',()=>{g.toggle();render();},$('.zs-ab'));a.setAttribute('aria-label','Jouer ou pause');
 const b=button('B','zs-b',()=>{g.reset();g.toggle();render();},$('.zs-ab'));b.setAttribute('aria-label','Recommencer');
 $('.zs-start').onclick=()=>{g.toggle();render();};
 function render(){
  if(!alive)return;
  if(g.score>best){best=g.score;try{localStorage.setItem('zebra.snake.best',String(best));}catch(_){}}
  $('.zs-score').textContent=String(g.score).padStart(4,'0');$('.zs-best').textContent=String(best).padStart(4,'0');
  status.textContent=({ready:'PRÊT',running:'EN JEU',paused:'PAUSE',over:'PERDU',won:'BRAVO'})[g.state];
  play.textContent=g.state==='running'?'Pause':g.state==='paused'?'Reprendre':g.state==='ready'?'Jouer':'Rejouer';
  overlay.hidden=g.state==='running';
  overlay.querySelector('strong').textContent=({ready:'ON JOUE ?',paused:'PETITE PAUSE',over:'ENCORE UNE ?',won:'BIEN JOUÉ'})[g.state]||'';
  overlay.querySelector('span').textContent=g.state==='ready'?'Une pomme, dix points. Garde le cap.':g.state==='paused'?'Reprends quand tu veux.':'Score : '+g.score;
  $('.zs-start').textContent=play.textContent;draw(ctx,g);
 }
 function fit(){const w=Math.max(1,Math.min(arena.clientWidth,arena.clientHeight*CW/CH));stage.style.width=w+'px';stage.style.height=w*CH/CW+'px';}
 function focused(){const w=root.closest('.window');return !w||w.classList.contains('active')||w.classList.contains('focused')||w.style.zIndex===String(Math.max(...Array.from(document.querySelectorAll('.window')).map(e=>Number(e.style.zIndex)||0)));}
 function key(e){
  if(!alive||!focused()||e.altKey||e.ctrlKey||e.metaKey||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable)return;
  const d=({ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',z:'up',s:'down',a:'left',q:'left',d:'right'})[e.key];
  if(d){e.preventDefault();if(!e.repeat){g.turn(d);render();}}else if(e.code==='Space'||e.key.toLowerCase()==='p'){e.preventDefault();if(!e.repeat){g.toggle();render();}}
 }
 function hide(){if(document.hidden&&g.state==='running'){g.state='paused';render();}}
 function blur(){if(g.state==='running'){g.state='paused';render();}}
 document.addEventListener('keydown',key);document.addEventListener('visibilitychange',hide);window.addEventListener('blur',blur);
 const clock=setInterval(()=>{if(g.state==='running'){if(!focused()){blur();return;}g.tick();render();}},140);
 if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(fit);observer.observe(arena);}else window.addEventListener('resize',fit);
 fit();render();
 root._zebraDispose=function(){alive=false;clearInterval(clock);if(observer)observer.disconnect();window.removeEventListener('resize',fit);window.removeEventListener('blur',blur);document.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',hide);};
}
window.ZebraSnake={mount,createGame,draw,width:CW,height:CH};
}());
