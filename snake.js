/* Zebra Snake — classic grid rules, self-contained pixel artwork. */
(function(){
'use strict';
const W=24,H=20,C=16,B=0,CW=W*C+B*2,CH=H*C+B*2;
const DIR={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
function createGame(random=Math.random){
 const g={snake:[],queue:[],direction:'right',food:null,score:0,state:'ready',impact:null};
 function food(){
  const free=[];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(!g.snake.some(p=>p.x===x&&p.y===y))free.push({x,y});
  g.food=free.length?free[Math.min(free.length-1,Math.floor(random()*free.length))]:null;
  if(!g.food)g.state='won';
 }
 g.reset=function(){g.snake=[{x:9,y:10},{x:8,y:10},{x:7,y:10},{x:6,y:10}];g.direction='right';g.queue=[];g.score=0;g.state='ready';g.impact=null;food();};
 g.turn=function(d){
  if(!DIR[d]||g.state==='hurt'||g.state==='over'||g.state==='won'||g.state==='paused')return false;
  const prev=DIR[g.queue[g.queue.length-1]||g.direction],next=DIR[d];
  if(g.queue.length>=2||(prev[0]===next[0]&&prev[1]===next[1])||(prev[0]===-next[0]&&prev[1]===-next[1]))return false;
  g.queue.push(d);if(g.state==='ready')g.state='running';return true;
 };
 g.finishCrash=function(){if(g.state==='hurt')g.state='over';};
 g.toggle=function(){if(g.state==='hurt')return;if(g.state==='over'||g.state==='won')g.reset();g.state=g.state==='running'?'paused':'running';};
 g.tick=function(){
  if(g.state!=='running')return;
  if(g.queue.length)g.direction=g.queue.shift();
  const d=DIR[g.direction],p={x:g.snake[0].x+d[0],y:g.snake[0].y+d[1]};
  const eats=g.food&&p.x===g.food.x&&p.y===g.food.y;
  const body=eats?g.snake:g.snake.slice(0,-1);
  if(p.x<0||p.x>=W||p.y<0||p.y>=H||body.some(q=>q.x===p.x&&q.y===p.y)){g.state='hurt';g.impact={x:Math.max(0,Math.min(W-1,p.x)),y:Math.max(0,Math.min(H-1,p.y))};g.queue=[];return;}
  g.snake.unshift(p);if(eats){g.score+=10;food();}else g.snake.pop();
 };
 g.reset();return g;
}
function make(tag,cls,text){const e=document.createElement(tag);e.className=cls||'';if(text!==undefined)e.textContent=text;return e;}
// A small fixed palette and flat symbols, like an early handheld game.
const FIELD='#9eaf76',DECOR='#75885c',INK='#263c2b',STRIPE='#dfe6b9';
function drawBackground(ctx){
 ctx.imageSmoothingEnabled=false;
 ctx.fillStyle=FIELD;ctx.fillRect(0,0,CW,CH);
 ctx.fillStyle=DECOR;
 // Quiet, single-colour scenery. Every symbol remains traversable.
 function tree(x,y){
  ctx.fillRect(x+7,y,4,4);ctx.fillRect(x+4,y+4,10,4);
  ctx.fillRect(x+1,y+8,16,4);ctx.fillRect(x+7,y+12,4,7);
 }
 function bush(x,y){ctx.fillRect(x+3,y,8,4);ctx.fillRect(x,y+4,14,6);}
 for(const p of [[24,28],[151,40],[331,29],[43,153],[302,151],[27,267],[181,277],[335,266]])tree(...p);
 for(const p of [[92,55],[244,32],[113,139],[237,214],[79,283]])bush(...p);
}
function draw(ctx,g,background){
 ctx.imageSmoothingEnabled=false;
 if(background)ctx.drawImage(background,0,0);else drawBackground(ctx);
 if(g.food){
  const x=B+g.food.x*C,y=B+g.food.y*C;
  ctx.fillStyle='#963e36';ctx.fillRect(x+4,y+5,8,8);
  ctx.fillStyle=INK;ctx.fillRect(x+8,y+2,2,3);
 }
 const hurt=g.state==='hurt'||g.state==='over';
 // Square cells and one plain zebra stripe: no volume, shading or outlines.
 for(let i=g.snake.length-1;i>=0;i--){
  const p=g.snake[i],x=B+p.x*C+1,y=B+p.y*C+1;
  ctx.fillStyle=hurt?'#c92d34':INK;ctx.fillRect(x,y,14,14);
  if(i){
   const prev=g.snake[i-1],horizontal=prev.y===p.y;
   ctx.fillStyle=STRIPE;
   if(horizontal){ctx.fillRect(x+5,y+1,3,7);ctx.fillRect(x+7,y+7,3,6);}
   else{ctx.fillRect(x+1,y+5,7,3);ctx.fillRect(x+7,y+7,6,3);}
  }
 }
 const head=g.snake[0],d=DIR[g.direction],side=[-d[1],d[0]];
 ctx.fillStyle=STRIPE;
 for(const sign of [-1,1])ctx.fillRect(B+head.x*C+7+d[0]*3+side[0]*sign*3,B+head.y*C+7+d[1]*3+side[1]*sign*3,2,2);
 if(hurt&&g.impact){
  const x=g.impact.x*C+8,y=g.impact.y*C+8;
  ctx.fillStyle=STRIPE;ctx.fillRect(x-1,y-11,2,5);ctx.fillRect(x-1,y+7,2,5);ctx.fillRect(x-11,y-1,5,2);ctx.fillRect(x+7,y-1,5,2);
 }
}
/* Small chip sounds, unlocked by an input gesture and disposed with the window. */
function createSounds(){
 let context=null,unlocked=false,disposed=false,mode='silent',ambienceTimer=null,beat=0,track=null,assets={};
 const voices=new Set();
 const notes={
  start:[[440,0,.07],[660,.09,.12]],eat:[[740,0,.045],[990,.05,.075]],turn:[[180,0,.022]],
  pause:[[440,0,.055],[280,.075,.085]],resume:[[280,0,.055],[440,.075,.085]],
  pulse:[[110,0,.12],[220,.16,.06]],chime:[[330,0,.1],[440,.15,.09]],
  impact:[[90,0,.2],[55,.03,.45],[880,.01,.035]],lose:[[392,0,.25],[311,.4,.25],[196,.8,2.18]],
  menu:[[220,0,.055]],over:[[392,0,.13],[311,.2,.13],[196,.4,.46]],
  won:[[440,0,.09],[554,.12,.09],[660,.24,.09],[880,.36,.23]]
 };
 function muted(){try{return localStorage.getItem('zebra.sfx.muted')==='1';}catch(_){return false;}}
 function stopVoices(){
  voices.forEach(v=>{try{v.osc.stop();}catch(_){}try{v.osc.disconnect();v.gain.disconnect();}catch(_){}});
  voices.clear();
 }
 function unlock(){
  if(disposed||muted())return;
  unlocked=true;
  try{
   const Audio=window.AudioContext||window.webkitAudioContext;
   if(!context&&Audio)context=new Audio();
   if(context&&context.state==='suspended'){const pending=context.resume();if(pending&&pending.catch)pending.catch(()=>{});}
  }catch(_){}
 }
 function play(type){
  if(disposed||!unlocked||!context||document.hidden||!notes[type])return;
  if(muted()){stop();return;}
  try{
   const start=context.currentTime;
   for(const [freq,offset,duration]of notes[type]){
    const osc=context.createOscillator(),gain=context.createGain(),at=start+offset;
    const voice={osc,gain};voices.add(voice);
    osc.type=type==='impact'?'sawtooth':type==='pulse'?'triangle':'square';osc.frequency.setValueAtTime(freq,at);
    if((type==='over'&&offset===.4)||(type==='lose'&&offset===.8)||type==='impact')osc.frequency.exponentialRampToValueAtTime(140,at+duration);
    gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(type==='turn'?.009:(type==='pulse'||type==='chime')?.012:.035,at+.006);
    gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    osc.connect(gain);gain.connect(context.destination);
    osc.onended=()=>{voices.delete(voice);try{osc.disconnect();gain.disconnect();}catch(_){}};
    osc.start(at);osc.stop(at+duration+.012);
   }
  }catch(_){}
 }
 function clearTrack(){if(track){track.pause();track.removeAttribute('src');track.load();track=null;}}
 function stop(){if(ambienceTimer!==null){clearInterval(ambienceTimer);ambienceTimer=null;}clearTrack();stopVoices();mode='silent';}
 function file(name,loop){
  if(!assets[name]||!window.Audio||!unlocked||muted()||document.hidden)return false;
  try{
   const audio=new window.Audio(assets[name]);track=audio;audio.loop=loop;audio.volume=loop?.23:.65;
   const fallback=()=>{if(track!==audio||disposed)return;clearTrack();if(name==='lose')play('lose');else if(mode==='running')startAmbience();};
   audio.onerror=fallback;const pending=audio.play();if(pending&&pending.catch)pending.catch(fallback);return true;
  }catch(_){return false;}
 }
 function startAmbience(){
  if(ambienceTimer!==null||disposed||mode!=='running')return;
  const pulse=()=>{if(document.hidden||muted()){stopVoices();if(track)track.pause();return;}play(beat++%8===7?'chime':'pulse');};
  pulse();ambienceTimer=setInterval(pulse,560);
 }
 function setMode(next){
  stop();mode=next;
  if(!unlocked||muted()||document.hidden)return;
  if(next==='running'){if(!file('music',true))startAmbience();}
  else if(next==='hurt'){play('impact');if(!file('lose',false))play('lose');}
 }
 function configure(value){assets=value&&typeof value==='object'?value:{};}
 function dispose(){disposed=true;stop();if(context){try{const closed=context.close();if(closed&&closed.catch)closed.catch(()=>{});}catch(_){}context=null;}}
 function sync(){if(muted()||document.hidden)stop();}
 return {unlock,play,stop,dispose,setMode,configure,sync};
}
function mount(root){
 if(root._zebraDispose)root._zebraDispose();root.innerHTML='';
 const g=createGame(),sounds=createSounds();let alive=true,best=0,observer,lastState=g.state,lastScore=0,crashTimer=null;
 fetch('/assets/games/snake/audio.json?v=1',{cache:'no-cache'}).then(r=>r.ok?r.json():{}).then(a=>{if(alive)sounds.configure(a);}).catch(()=>{});
 try{best=Number(localStorage.getItem('zebra.snake.best'))||0;}catch(_){}
 const wrap=make('div','zs-machine');
 wrap.innerHTML='<header class="zs-header"><img class="zs-logo" src="/assets/games/snake/znaklogo.png?v=1" alt="Znak" width="165" height="98"></header><div class="zs-hud"><span class="zs-state" role="status" aria-live="polite">PRÊT</span><div>SCORE <b class="zs-score">0000</b></div><div>RECORD <b class="zs-best">0000</b></div></div><div class="zs-arena"><div class="zs-stage"><canvas aria-label="Terrain de Znak : manger les pommes, éviter les murs et sa queue"></canvas><div class="zs-overlay"><strong role="heading" aria-level="2"></strong><span></span><button type="button" class="zs-button zs-start">Jouer</button></div></div></div><footer class="zs-console zg-retro"><div class="zs-handheld zt-handheld zt-skin-ready"><div class="zs-toolbar zg-buttons zt-buttons"></div><div class="zs-dpad zt-dpad" aria-label="Direction"><div class="zs-cross zt-cross"></div></div><div class="zs-action-side zt-action-side"><div class="zs-ab zt-ab"></div><span class="zs-select-space zt-select" aria-hidden="true"></span></div></div><p class="zs-help">FLÈCHES / ZQSD · ESPACE : PAUSE</p></footer>';
 root.appendChild(wrap);
 const $=s=>wrap.querySelector(s),canvas=$('canvas'),ctx=canvas.getContext('2d');canvas.width=CW;canvas.height=CH;
 const stage=$('.zs-stage'),arena=$('.zs-arena'),hud=$('.zs-hud'),overlay=$('.zs-overlay'),status=$('.zs-state');
 function button(label,cls,fn,parent){const e=make('button','zs-button '+cls,label);e.type='button';e.onclick=function(event){sounds.unlock();fn(event);};parent.appendChild(e);return e;}
 const background=document.createElement('canvas');background.width=CW;background.height=CH;
 drawBackground(background.getContext('2d'));
 function clearCrash(){if(crashTimer!==null){clearTimeout(crashTimer);crashTimer=null;}}
 function restart(){if(g.state==='hurt')return;clearCrash();sounds.stop();lastState='ready';lastScore=0;g.reset();g.toggle();render();}
 const play=button('Jouer','zs-play',()=>{g.toggle();render();},$('.zs-toolbar'));
 button('Recommencer','zs-restart',restart,$('.zs-toolbar'));
 button('Menu','zs-menu',()=>{if(g.state==='hurt')return;clearCrash();sounds.stop();g.reset();sounds.play('menu');render();},$('.zs-toolbar'));
 for(const [d,label]of Object.entries({up:'▲',left:'◀',right:'▶',down:'▼'})){
  const b=button(label,'zs-dir zt-control zt-dir zt-dir-'+d+' zs-'+d,e=>{if(e.detail===0){turn(d);}},$('.zs-cross'));
  b.setAttribute('aria-label',({up:'Haut',down:'Bas',left:'Gauche',right:'Droite'})[d]);
  b.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();sounds.unlock();turn(d);};
 }
 const a=button('A','zs-a zt-control zt-ab-button zt-a',()=>{g.toggle();render();},$('.zs-ab'));a.setAttribute('aria-label','Jouer ou pause');
 const b=button('B','zs-b zt-control zt-ab-button zt-b',restart,$('.zs-ab'));b.setAttribute('aria-label','Recommencer');
 $('.zs-start').onclick=()=>{sounds.unlock();g.toggle();render();};
 function turn(d){const wasRunning=g.state==='running';if(g.turn(d)&&wasRunning)sounds.play('turn');render();}
 function render(){
  if(!alive)return;
  if(g.state!==lastState){
   if(g.state==='hurt'){sounds.setMode('hurt');crashTimer=setTimeout(()=>{crashTimer=null;if(alive){g.finishCrash();render();}},2000);}
   else if(g.state==='won'){sounds.stop();sounds.play('won');}
   else if(g.state==='paused'){sounds.stop();sounds.play('pause');}
   else if(g.state==='running'){sounds.stop();sounds.setMode('running');sounds.play(lastState==='paused'?'resume':'start');}
   lastState=g.state;
  }
  if(g.score>lastScore&&g.state==='running')sounds.play('eat');lastScore=g.score;
  if(g.score>best){best=g.score;try{localStorage.setItem('zebra.snake.best',String(best));}catch(_){}}
  $('.zs-score').textContent=String(g.score).padStart(4,'0');$('.zs-best').textContent=String(best).padStart(4,'0');
  status.textContent=({ready:'PRÊT',running:'EN JEU',paused:'PAUSE',hurt:'AÏE',over:'GAME OVER',won:'VICTOIRE'})[g.state];
  play.textContent=g.state==='running'?'Pause':g.state==='paused'?'Reprendre':g.state==='ready'?'Jouer':'Rejouer';
  wrap.dataset.state=g.state;
  wrap.querySelectorAll('button').forEach(b=>{b.disabled=g.state==='hurt';});
  overlay.hidden=g.state==='running'||g.state==='hurt';overlay.dataset.state=g.state;
  overlay.querySelector('strong').textContent=({ready:'ZNAK',paused:'PAUSE',hurt:'AÏE',over:'GAME OVER',won:'VICTOIRE'})[g.state]||'';
  overlay.querySelector('span').textContent=g.state==='ready'?'ESPACE : JOUER':g.state==='paused'?'ESPACE : REPRENDRE':g.state==='over'?'Appuyer sur espace pour recommencer':'SCORE : '+g.score;
  $('.zs-start').textContent=play.textContent;
  draw(ctx,g,background);
 }
 function fit(){const w=Math.max(1,Math.min(arena.clientWidth,arena.clientHeight*CW/CH));stage.style.width=w+'px';stage.style.height=w*CH/CW+'px';hud.style.width=w+'px';}
 function focused(){const w=root.closest('.window');return !w||w.classList.contains('active')||w.classList.contains('focused')||w.style.zIndex===String(Math.max(...Array.from(document.querySelectorAll('.window')).map(e=>Number(e.style.zIndex)||0)));}
 function key(e){
  if(!alive||!focused()||e.altKey||e.ctrlKey||e.metaKey||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable)return;
  const d=({ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',z:'up',s:'down',a:'left',q:'left',d:'right'})[e.key];
  if(d){e.preventDefault();if(!e.repeat){sounds.unlock();turn(d);}}else if(e.code==='Space'||e.key===' '||e.key.toLowerCase()==='p'){e.preventDefault();if(!e.repeat){sounds.unlock();g.toggle();render();}}
 }
 function hide(){if(document.hidden){sounds.stop();if(g.state==='running'){g.state='paused';render();}}}
 function blur(){sounds.stop();if(g.state==='running'){g.state='paused';render();}}
 document.addEventListener('keydown',key);document.addEventListener('visibilitychange',hide);window.addEventListener('blur',blur);
 const clock=setInterval(()=>{sounds.sync();if(g.state==='running'){if(!focused()){blur();return;}g.tick();render();}},140);
 if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(fit);observer.observe(arena);}else window.addEventListener('resize',fit);
 fit();render();
 root._zebraDispose=function(){alive=false;clearCrash();sounds.dispose();clearInterval(clock);if(observer)observer.disconnect();window.removeEventListener('resize',fit);window.removeEventListener('blur',blur);document.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',hide);};
}
window.ZebraSnake={mount,createGame,createSounds,draw,drawBackground,width:CW,height:CH};
}());
