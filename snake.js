/* Zebra Snake — classic grid rules, self-contained pixel artwork. */
(function(){
'use strict';
const W=24,H=24,C=16,B=0,CW=W*C+B*2,CH=H*C+B*2;
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
const LEVEL_MS=[180,135,95,75];
function createDuel(options={},random=Math.random){
 const level=Math.max(1,Math.min(4,Number(options.level)||1)),humans=options.players===2?2:1;
 const g={state:'ready',players:[],food:null,impact:null,winner:null,level,humans,ticks:0,kind:'duel'};
 let aiWait=0;
 Object.defineProperties(g,{snake:{get:()=>g.players[0].snake},direction:{get:()=>g.players[0].direction},score:{get:()=>g.players[0].score}});
 const same=(a,b)=>a.x===b.x&&a.y===b.y;
 const inside=p=>p.x>=0&&p.x<W&&p.y>=0&&p.y<H;
 function food(){const free=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(!g.players.some(p=>p.snake.some(q=>q.x===x&&q.y===y)))free.push({x,y});g.food=free.length?free[Math.min(free.length-1,Math.floor(random()*free.length))]:null;}
 g.reset=function(){
  g.players=[{snake:Array.from({length:6},(_,i)=>({x:6-i,y:6})),direction:'right',queue:[],score:0,lost:false},{snake:Array.from({length:6},(_,i)=>({x:17+i,y:13})),direction:'left',queue:[],score:0,lost:false}];
  g.state='ready';g.impact=null;g.winner=null;g.ticks=0;aiWait=0;food();
 };
 g.turn=function(d,index=0){
  if(g.state!=='running'&&g.state!=='ready')return false;
  const p=g.players[index];if(!p||!DIR[d])return false;
  const previous=DIR[p.queue[p.queue.length-1]||p.direction],next=DIR[d];
  if(p.queue.length>=2||(previous[0]===next[0]&&previous[1]===next[1])||(previous[0]===-next[0]&&previous[1]===-next[1]))return false;
  p.queue.push(d);return true;
 };
 function ai(){
  if(aiWait>0){aiWait--;return;}
  aiWait=[3,2,1,1][level-1];
  const p=g.players[1],head=p.snake[0],current=DIR[p.direction];
  const occupied=new Set(g.players.flatMap(p=>p.snake.slice(0,-1).map(q=>q.x+q.y*W)));
  const candidates=[];
  for(const [name,d]of Object.entries(DIR)){
   if(d[0]===-current[0]&&d[1]===-current[1])continue;
   const next={x:head.x+d[0],y:head.y+d[1]};if(!inside(next)||occupied.has(next.x+next.y*W))continue;
   const seen=new Set(),queue=[next];
   for(let i=0;i<queue.length;i++){
    const q=queue[i],key=q.x+q.y*W;if(seen.has(key))continue;seen.add(key);
    for(const v of Object.values(DIR)){const n={x:q.x+v[0],y:q.y+v[1]},k=n.x+n.y*W;if(inside(n)&&!occupied.has(k)&&!seen.has(k))queue.push(n);}
   }
   const target=g.food||g.players[0].snake[0];
   const distance=Math.abs(next.x-target.x)+Math.abs(next.y-target.y);
   const enemy=g.players[0].snake[0],near=Math.abs(next.x-enemy.x)+Math.abs(next.y-enemy.y);
   const score=Math.min(seen.size,80)*(level>=3?1.45:.55)-distance+(name===p.direction?1.5:0)-(near<2?20:0)+random()*3;
   candidates.push({name,score});
  }
  candidates.sort((a,b)=>b.score-a.score);
  if(!candidates.length)return;
  const mistakeChance=[.34,.25,.17,.11][level-1];
  let pick=candidates[0];
  if(candidates.length>1&&random()<mistakeChance){
   const pool=candidates.slice(1,Math.min(3,candidates.length));
   pick=pool[Math.floor(random()*pool.length)]||pick;
  }
  if(pick.name!==p.direction)g.turn(pick.name,1);
 }
 g.tick=function(){
  if(g.state!=='running')return;if(humans===1)ai();g.ticks++;
  const next=g.players.map(p=>{if(p.queue.length)p.direction=p.queue.shift();const d=DIR[p.direction];return {x:p.snake[0].x+d[0],y:p.snake[0].y+d[1]};});
  const eats=next.map(n=>g.food&&same(n,g.food));
  const bodies=g.players.map((p,i)=>eats[i]?p.snake:p.snake.slice(0,-1));
  const headOn=same(next[0],next[1])||(same(next[0],g.players[1].snake[0])&&same(next[1],g.players[0].snake[0]));
  const dead=next.map((n,i)=>!inside(n)||headOn||bodies[i].some(q=>same(q,n))||bodies[1-i].some(q=>same(q,n)));
  if(dead.some(Boolean)){
   g.players.forEach((p,i)=>{p.lost=dead[i];p.queue=[];});
   g.state='hurt';g.winner=dead[0]&&dead[1]?0:dead[0]?2:1;
   const hit=next[dead[0]?0:1];g.impact={x:Math.max(0,Math.min(W-1,hit.x)),y:Math.max(0,Math.min(H-1,hit.y))};
   return;
  }
  g.players.forEach((p,i)=>{p.snake.unshift(next[i]);if(eats[i])p.score+=10;else p.snake.pop();});
  if(eats.some(Boolean))food();
 };
 g.finishCrash=function(){if(g.state==='hurt')g.state='over';};
 g.toggle=function(){if(g.state==='hurt')return;if(g.state==='over')g.reset();g.state=g.state==='running'?'paused':'running';};
 g.reset();return g;
}
function make(tag,cls,text){const e=document.createElement(tag);e.className=cls||'';if(text!==undefined)e.textContent=text;return e;}
const FIELD='#9eaf76',DECOR='#75885c',INK='#263c2b',STRIPE='#dfe6b9';
function drawBackground(ctx){
 ctx.imageSmoothingEnabled=false;
 // Saturated grass with painted, fully traversable trees and bushes.
 ctx.fillStyle='#238f20';ctx.fillRect(0,0,CW,CH);
 for(let y=0;y<CH;y+=4)for(let x=0;x<CW;x+=4){
  const n=(x*31+y*17+(x*y)%71)%29;
  ctx.fillStyle=n<3?'#31a62a':n<7?'#1c7e1d':'#259422';ctx.fillRect(x,y,2,2);
 }
 for(let i=0;i<110;i++){
  const x=3+(i*73)%(CW-6),y=3+(i*47)%(CH-6);
  ctx.fillStyle=i%3?'#329f26':'#4eb82e';ctx.fillRect(x,y,1,3);ctx.fillRect(x+2,y+1,1,2);
 }
 // All trees and bushes belong to the painted background, never to collisions.
 function bush(x,y){
  ctx.fillStyle='#1b6422';ctx.fillRect(x-1,y+8,19,5);
  ctx.fillStyle='#0e5927';ctx.fillRect(x,y+3,17,8);ctx.fillRect(x+3,y,10,3);
  ctx.fillStyle='#267a2c';ctx.fillRect(x+2,y+3,13,6);ctx.fillRect(x+5,y+1,7,2);
  ctx.fillStyle='#50a938';ctx.fillRect(x+3,y+3,4,2);ctx.fillRect(x+10,y+5,3,2);
 }
 function tree(x,y){
  ctx.fillStyle='#1b6422';ctx.fillRect(x+1,y+23,22,5);
  ctx.fillStyle='#553b24';ctx.fillRect(x+10,y+15,4,12);ctx.fillStyle='#957044';ctx.fillRect(x+10,y+19,1,6);
  ctx.fillStyle='#124f27';ctx.fillRect(x+2,y+6,20,13);ctx.fillRect(x+6,y+2,12,4);ctx.fillRect(x+8,y,8,3);ctx.fillRect(x+6,y+19,12,3);
  ctx.fillStyle='#236d2b';ctx.fillRect(x+4,y+6,16,10);ctx.fillRect(x+7,y+3,10,5);
  ctx.fillStyle='#4e9c32';ctx.fillRect(x+6,y+5,7,4);ctx.fillRect(x+4,y+9,4,3);ctx.fillRect(x+14,y+12,4,3);
 }
 for(const p of [[21,22],[139,34],[325,27],[53,121],[289,139],[18,257],[165,267],[328,262]])tree(...p);
 for(const p of [[76,38],[227,22],[347,94],[117,116],[191,83],[20,199],[237,202],[320,222],[84,279],[271,287]])bush(...p);
}
function drawLevel3Background(ctx,tiles={}){
 ctx.imageSmoothingEnabled=false;
 ctx.fillStyle='#282622';ctx.fillRect(0,0,CW,CH);
 const base=tiles.tile1,frame=tiles.tile2,center=tiles.tile3;
 if(base)for(let y=0;y<CH;y+=64)for(let x=0;x<CW;x+=64)ctx.drawImage(base,x,y,64,64);
 if(frame){
  // A native 64 px ring, one tile in from the board edge.
  for(let x=64;x<=256;x+=64){ctx.drawImage(frame,x,64,64,64);ctx.drawImage(frame,x,256,64,64);}
  for(let y=128;y<=192;y+=64){ctx.drawImage(frame,64,y,64,64);ctx.drawImage(frame,256,y,64,64);}
 }
 // The supplied 130 px emblem stays unscaled and lands on the exact board centre.
 if(center)ctx.drawImage(center,127,127,130,130);
}
function drawLevel4Background(ctx,source){
 ctx.imageSmoothingEnabled=false;
 ctx.fillStyle='#090a14';ctx.fillRect(0,0,CW,CH);
 if(!source)return;
 ctx.filter='contrast(1.22) saturate(1.35) brightness(.72)';ctx.drawImage(source,0,0);ctx.filter='none';
 const wash=ctx.createLinearGradient?ctx.createLinearGradient(0,0,CW,0):null;
 if(wash){wash.addColorStop(0,'rgba(0,50,190,.48)');wash.addColorStop(.5,'rgba(20,0,55,.16)');wash.addColorStop(1,'rgba(210,0,28,.46)');ctx.globalCompositeOperation='screen';ctx.fillStyle=wash;ctx.fillRect(0,0,CW,CH);ctx.globalCompositeOperation='source-over';}
}
function draw(ctx,g,background){
 ctx.imageSmoothingEnabled=false;
 if(background&&background.duelLayer){}else if(background)ctx.drawImage(background,0,0);else drawBackground(ctx);
 if(g.food){const x=B+g.food.x*C,y=B+g.food.y*C;ctx.fillStyle='#123021';ctx.fillRect(x+3,y+13,11,2);ctx.fillStyle='#fe7552';ctx.fillRect(x+3,y+5,10,8);ctx.fillRect(x+5,y+3,6,2);ctx.fillStyle='#ffce79';ctx.fillRect(x+4,y+5,3,3);ctx.fillStyle='#a5cf59';ctx.fillRect(x+8,y+1,4,2);}
 if(g.kind==='duel'){g.players.forEach((p,i)=>draw(ctx,{snake:p.snake,direction:p.direction,food:null,state:p.lost?'hurt':'running',impact:p.lost?g.impact:null},{duelLayer:true,second:i===1}));return;}
 // Draw one connected ribbon, then a narrow highlight. Corners stay joined.
 const points=g.snake.map(p=>({x:B+p.x*C+8,y:B+p.y*C+8}));
 function ribbon(color,width,offset){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y+offset):ctx.moveTo(p.x,p.y+offset));ctx.stroke();}
 const hurt=g.state==='hurt'||g.state==='over';
 ribbon(hurt?'#4b080e':'#202522',14,2);ribbon(hurt?'#fa263c':background&&background.second?'#88bbef':'#e0d9ae',11,0);ribbon(hurt?'#ff9970':background&&background.second?'#c9e7ff':'#faf0c5',4,-2);
 // Simple zebra marks on each straight segment, clipped away from the head.
 ctx.fillStyle='#282b2c';
 for(let i=1;i<points.length;i++){
  const p=points[i],prev=points[i-1],horizontal=prev.y===p.y;
  if(horizontal){ctx.fillRect(p.x-3,p.y-5,3,7);ctx.fillRect(p.x+2,p.y,3,5);}
  else{ctx.fillRect(p.x-5,p.y-3,7,3);ctx.fillRect(p.x,p.y+2,5,3);}
 }
 if(hurt&&g.impact){const x=g.impact.x*C+8,y=g.impact.y*C+8;ctx.fillStyle='#ffe39a';for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.fillRect(Math.round(x+Math.cos(a)*12)-1,Math.round(y+Math.sin(a)*12)-1,3,3);}ctx.fillStyle='#ff3b36';ctx.fillRect(x-2,y-2,5,5);}
 const head=points[0],d=DIR[g.direction],side=[-d[1],d[0]];
 for(const s of [-1,1]){const x=head.x+d[0]*3+side[0]*s*3,y=head.y+d[1]*3+side[1]*s*3;ctx.fillStyle='#fff6b0';ctx.fillRect(x-1,y-1,3,3);ctx.fillStyle='#112b27';ctx.fillRect(x+d[0],y+d[1],2,2);}
}
/* Small chip sounds, unlocked by an input gesture and disposed with the window. */
function createSounds(){
 let context=null,unlocked=false,disposed=false,mode='silent',ambienceTimer=null,beat=0,track=null,assets={},musicEnabled=true;
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
  if(name==='music'&&!musicEnabled)return false;
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
  if(next==='running'){if(musicEnabled){if(!file('music',true))startAmbience();}}
  else if(next==='hurt'){play('impact');if(!file('lose',false))play('lose');}
 }
 function configure(value){assets=value&&typeof value==='object'?value:{};}
 function setMusicEnabled(value){
  musicEnabled=!!value;
  if(!musicEnabled){if(ambienceTimer!==null){clearInterval(ambienceTimer);ambienceTimer=null;}if(track&&mode==='running')clearTrack();}
  else if(mode==='running'&&unlocked&&!muted()&&!document.hidden&&!track){if(!file('music',true))startAmbience();}
 }
 function dispose(){disposed=true;stop();if(context){try{const closed=context.close();if(closed&&closed.catch)closed.catch(()=>{});}catch(_){}context=null;}}
 function sync(){if(muted()||document.hidden)stop();}
 return {unlock,play,stop,dispose,setMode,configure,setMusicEnabled,sync};
}
function mount(root){
 if(root._zebraDispose)root._zebraDispose();root.innerHTML='';
 const sounds=createSounds(),settings={mode:'solo',players:1,level:1};let g=createGame(),menuPage='mode',menuIndex=0,elapsed=0;let alive=true,records={},observer,lastState=g.state,lastScore=0,crashTimer=null;
 let musicEnabled=true;
 fetch('/assets/games/snake/audio.json?v=2',{cache:'no-cache'}).then(r=>r.ok?r.json():{}).then(a=>{if(alive)sounds.configure(a);}).catch(()=>{});
 try{
  const saved=JSON.parse(localStorage.getItem('zebra.snake.records')||'{}');
  if(saved&&typeof saved==='object')records=saved;
  const legacy=Number(localStorage.getItem('zebra.snake.best'))||0;
  if(legacy&&!records['solo-1'])records['solo-1']=legacy;
  musicEnabled=localStorage.getItem('zebra.snake.music')!=='off';
 }catch(_){}
 sounds.setMusicEnabled(musicEnabled);
 function recordKey(mode=settings.mode,level=settings.level){return mode+'-'+level;}
 function currentBest(){return Number(records[recordKey()]||0);}
 function saveRecord(value){
  const key=recordKey(),score=Math.max(0,Number(value)||0);
  if(score<=Number(records[key]||0))return;
  records[key]=score;
  try{localStorage.setItem('zebra.snake.records',JSON.stringify(records));}catch(_){}
 }
 const wrap=make('div','zs-machine');
 wrap.innerHTML='<header class="zs-header"><img class="zs-logo" src="/assets/games/snake/znaklogo.png?v=1" alt="Znake" width="165" height="98"></header><div class="zs-hud"><span class="zs-state" role="status" aria-live="polite">PRÊT</span><div><label class="zs-score-label">SCORE</label> <b class="zs-score">0000</b></div><div><label class="zs-best-label">RECORD</label> <b class="zs-best">0000</b></div></div><div class="zs-arena"><div class="zs-stage"><canvas aria-label="Terrain de Znake : manger les pommes, éviter les murs et sa queue"></canvas><section class="zs-launch" aria-label="Menu de Znake"><div class="zs-menu-page zs-mode-page"><h1>Znake</h1><canvas class="zs-title-art" aria-hidden="true"></canvas><div class="zs-menu-list" role="group" aria-label="Mode de jeu"><button type="button" data-mode="solo">SOLO</button><button type="button" data-mode="robot">CONTRE ROBOT</button><button type="button" data-mode="local">VS LOCAL</button><button type="button" data-scoreboard="true">SCOREBOARD</button></div><small>FLÈCHES : CHOISIR · ESPACE : VALIDER</small></div><div class="zs-menu-page zs-level-page" hidden><h2>CHOISIS TON NIVEAU</h2><div class="zs-level-list" role="group" aria-label="Niveau"><button type="button" data-level="1">NIVEAU 1</button><button type="button" data-level="2">NIVEAU 2</button><button type="button" data-level="3">NIVEAU 3</button><button type="button" data-level="4">NIVEAU 4</button></div><button type="button" class="zs-menu-back">◀ RETOUR</button><small>ESPACE : JOUER</small></div><div class="zs-menu-page zs-scoreboard-page" hidden><h2>SCOREBOARD</h2><div class="zs-scoreboard-list"></div><button type="button" class="zs-scoreboard-back">◀ RETOUR</button><small>RECORDS PAR MODE ET NIVEAU</small></div></section><div class="zs-overlay"><strong role="heading" aria-level="2"></strong><em class="zs-result"></em><span></span><button type="button" class="zs-button zs-start">Jouer</button></div></div></div><footer class="zs-console zg-retro"><div class="zs-handheld zt-handheld zt-skin-ready"><div class="zs-toolbar zg-buttons zt-buttons"></div><div class="zs-dpad zt-dpad" aria-label="Direction"><div class="zs-cross zt-cross"></div></div><div class="zs-action-side zt-action-side"><div class="zs-ab zt-ab"></div><span class="zs-select-space zt-select" aria-hidden="true"></span></div></div><p class="zs-help">FLÈCHES / ZQSD · ESPACE : PAUSE</p></footer>';
 root.appendChild(wrap);
 const $=s=>wrap.querySelector(s),canvas=$('canvas'),ctx=canvas.getContext('2d');canvas.width=CW;canvas.height=CH;
 const stage=$('.zs-stage'),arena=$('.zs-arena'),hud=$('.zs-hud'),overlay=$('.zs-overlay'),status=$('.zs-state');
 $('.zs-handheld').classList.remove('zt-skin-ready');
 $('.zs-cross').appendChild(make('div','zt-cross-shape'));
 $('.zs-select-space').remove();
 function button(label,cls,fn,parent){const e=make('button','zs-button '+cls,label);e.type='button';e.onclick=function(event){sounds.unlock();fn(event);};parent.appendChild(e);return e;}
 const background=document.createElement('canvas');background.width=CW;background.height=CH;
 drawBackground(background.getContext('2d'));
 const level3Background=document.createElement('canvas');level3Background.width=CW;level3Background.height=CH;
 const level4Background=document.createElement('canvas');level4Background.width=CW;level4Background.height=CH;
 drawLevel3Background(level3Background.getContext('2d'));
 drawLevel4Background(level4Background.getContext('2d'));
 const level3Tiles={};
 for(const [name,src]of Object.entries({tile1:'/assets/games/snake/tile1.png?v=1',tile2:'/assets/games/snake/tile2.png?v=1',tile3:'/assets/games/snake/tile3.png?v=1'})){
  const image=new Image();image.onload=()=>{level3Tiles[name]=image;if(Object.keys(level3Tiles).length===3){drawLevel3Background(level3Background.getContext('2d'),level3Tiles);drawLevel4Background(level4Background.getContext('2d'),level3Background);wrap.dataset.level3Ready='true';wrap.dataset.level4Ready='true';if(alive&&settings.level>=3)render();}};image.src=src;
 }
 function clearCrash(){if(crashTimer!==null){clearTimeout(crashTimer);crashTimer=null;}}
 function selectedGame(){return settings.mode==='solo'?createGame():createDuel(settings);}
 function restart(){if(g.state==='hurt')return;clearCrash();sounds.stop();lastState='ready';lastScore=0;elapsed=0;g=g.state==='ready'?selectedGame():g;g.reset();g.toggle();render();}
 function action(){if(g.state==='ready'){chooseMenu();return;}if(g.state==='over'||g.state==='won')restart();else{g.toggle();render();}}
 function menu(){if(g.state==='hurt')return;clearCrash();sounds.stop();g.reset();sounds.play('menu');elapsed=0;menuPage='mode';menuIndex=0;render();}
 const play=button('Jouer','zs-play zg-button zt-image-button zt-play',action,$('.zs-toolbar'));
 const restartButton=button('Recommencer','zs-restart zg-button zt-image-button zt-restart',restart,$('.zs-toolbar'));
 const menuButton=button('Menu','zs-menu zg-button zt-image-button zt-menu',menu,$('.zs-toolbar'));
 const musicButton=button('','zs-music zg-button zt-image-button zt-music-button',()=>{
  musicEnabled=!musicEnabled;
  try{localStorage.setItem('zebra.snake.music',musicEnabled?'on':'off');}catch(_){}
  sounds.setMusicEnabled(musicEnabled);
  updateMusicButton();
 },$('.zs-toolbar'));
 function updateMusicButton(){
  const label=musicEnabled?'MUSIC ON':'MUSIC OFF';
  musicButton.textContent='';
  musicButton.title=label;
  musicButton.setAttribute('aria-label',musicEnabled?'Couper la musique':'Activer la musique');
  musicButton.setAttribute('aria-pressed',musicEnabled?'true':'false');
  musicButton.classList.toggle('is-off',!musicEnabled);
  musicButton.style.backgroundImage='url("'+(musicEnabled?'/assets/games/musicOnbtnTetris.png?v=1':'/assets/games/musicOffbtnTetris.png?v=1')+'")';
 }
 updateMusicButton();
 $('.zs-toolbar').insertBefore(musicButton,menuButton);
 for(const [d,label]of Object.entries({up:'▲',left:'◀',right:'▶',down:'▼'})){
  const b=button(label,'zs-dir zt-control zt-dir zt-dir-'+d+' zs-'+d,e=>{if(e.detail===0){turn(d);}},$('.zs-cross'));
  b.setAttribute('aria-label',({up:'Haut',down:'Bas',left:'Gauche',right:'Droite'})[d]);
  b.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();sounds.unlock();turn(d);};
 }
 $('.zs-cross').appendChild(make('span','zt-cross-center'));
 const a=button('A','zs-a zt-control zt-ab-button zt-a',action,$('.zs-ab'));a.setAttribute('aria-label','Jouer ou pause');
 const b=button('B','zs-b zt-control zt-ab-button zt-b',restart,$('.zs-ab'));b.setAttribute('aria-label','Recommencer');
 const select=button('SELECT','zs-select zt-control zt-select',menu,$('.zs-action-side'));select.setAttribute('aria-label','Retour au menu');
 $('.zs-action-side').appendChild(make('span','zt-control-caption','B : RECOMMENCER · A : PAUSE'));
 const CONTROL_ROOT='/assets/games/snake/controls/';
 const controlFiles={
  up:'Upad.png',down:'Dpad.png',left:'Lpad.png',right:'Rpad.png',
  a:'Abtn.png',b:'Bbtn.png',select:'select.png'
 };
 function applyControlTexture(control,key){
  const file=controlFiles[key];if(!file)return;
  const image=make('img','zs-control-art');image.alt='';image.draggable=false;image.decoding='async';
  image.src=CONTROL_ROOT+file+'?v=1';
  control.appendChild(image);
 }
 [['up',$('.zs-up')],['down',$('.zs-down')],['left',$('.zs-left')],['right',$('.zs-right')],['a',a],['b',b],['select',select]].forEach(([key,node])=>applyControlTexture(node,key));
 wrap.style.setProperty('--zs-control-panel','url("'+CONTROL_ROOT+'INTfond.png?v=1")');
 $('.zs-handheld').classList.add('zs-skin-ready');
 const ATLAS='/assets/games/zebra-tetris-ui.png?v=57',AW=280,AH=252;
 function atlasSprite(node,[x,y,w,h]){
  node.style.backgroundImage='url("'+ATLAS+'")';node.style.backgroundRepeat='no-repeat';
  node.style.backgroundSize=(100*AW/w)+'% '+(100*AH/h)+'%';
  node.style.backgroundPosition=(100*x/(AW-w))+'% '+(100*y/(AH-h))+'%';node.style.imageRendering='pixelated';
 }
 function skinToolbar(){
  atlasSprite(play,g.state==='running'?[168,35,108,32]:[168,0,108,32]);
  atlasSprite(restartButton,[168,70,108,32]);atlasSprite(menuButton,[168,105,108,32]);
 }
 const toolbarAtlas=new Image();toolbarAtlas.onload=()=>{if(alive){$('.zs-console').classList.add('zt-art-loaded');skinToolbar();}};toolbarAtlas.src=ATLAS;
 $('.zs-start').onclick=()=>{sounds.unlock();action();};
 const launch=$('.zs-launch');
 function renderMenu(){
  const modePage=$('.zs-mode-page'),levelPage=$('.zs-level-page'),scorePage=$('.zs-scoreboard-page');
  modePage.hidden=menuPage!=='mode';levelPage.hidden=menuPage!=='level';scorePage.hidden=menuPage!=='scores';launch.dataset.page=menuPage;
  if(menuPage==='scores'){
   const names=[['solo','SOLO'],['robot','CONTRE ROBOT'],['local','VS LOCAL']];
   $('.zs-scoreboard-list').innerHTML=names.map(([mode,label])=>'<section><b>'+label+'</b><div>'+[1,2,3,4].map(level=>'<span>N'+level+' <strong>'+String(Number(records[mode+'-'+level]||0)).padStart(4,'0')+'</strong></span>').join('')+'</div></section>').join('');
   return;
  }
  const choices=menuPage==='mode'?Array.from(launch.querySelectorAll('.zs-mode-page [data-mode],.zs-mode-page [data-scoreboard]')):Array.from(launch.querySelectorAll('[data-level]'));
  choices.forEach((b,i)=>b.setAttribute('aria-current',i===menuIndex?'true':'false'));
 }
 function chooseMode(mode){settings.mode=mode;settings.players=mode==='local'?2:1;menuPage='level';menuIndex=0;sounds.play('turn');renderMenu();}
 function chooseLevel(level){settings.level=Math.max(1,Math.min(4,Number(level)||1));sounds.unlock();restart();}
 function chooseMenu(){
  if(menuPage==='scores')return;
  if(menuPage==='mode'){
   if(menuIndex===3){menuPage='scores';sounds.play('menu');renderMenu();return;}
   chooseMode(['solo','robot','local'][menuIndex]);return;
  }
  chooseLevel(menuIndex+1);
 }
 function navigate(d){
  if(menuPage==='scores')return;
  const count=menuPage==='mode'?4:4;
  if(d==='up'||d==='left')menuIndex=(menuIndex-1+count)%count;
  else if(d==='down'||d==='right')menuIndex=(menuIndex+1)%count;
  sounds.play('turn');renderMenu();
 }
 launch.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{sounds.unlock();chooseMode(b.dataset.mode);});
 launch.querySelector('[data-scoreboard]').onclick=()=>{sounds.unlock();menuPage='scores';sounds.play('menu');renderMenu();};
 launch.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>chooseLevel(b.dataset.level));
 $('.zs-menu-back').onclick=()=>{sounds.unlock();menuPage='mode';menuIndex=settings.mode==='solo'?0:settings.mode==='robot'?1:2;sounds.play('menu');renderMenu();};
 $('.zs-scoreboard-back').onclick=()=>{sounds.unlock();menuPage='mode';menuIndex=3;sounds.play('menu');renderMenu();};
 // An original, simple two-ink title illustration, drawn at handheld resolution.
 const art=$('.zs-title-art');art.width=384;art.height=100;const ac=art.getContext('2d');
 ac.fillStyle=DECOR;for(let y=0;y<35;y+=12)for(let x=-24;x<384;x+=48)ac.fillRect(x+(y%24?24:0),y,44,9);
 ac.fillStyle=INK;for(let i=0;i<6;i++){ac.fillRect(145+i*40,56,30,28);ac.fillRect(150+i*40,86,20,4);}
 ac.fillRect(38,52,95,33);ac.fillRect(55,43,70,10);ac.fillRect(26,65,15,17);ac.fillRect(42,85,84,6);
 ac.fillStyle=STRIPE;ac.fillRect(39,70,68,10);ac.fillRect(75,47,22,20);ac.fillStyle=INK;ac.fillRect(82,51,8,12);ac.fillRect(44,61,4,4);
 // Two independent touch pads in local two-player games.
 const second=make('div','zs-second-pad');second.setAttribute('aria-label','Direction du joueur 2');
 second.appendChild(make('span','zs-p2-label','J2'));
 for(const [d,label]of Object.entries({up:'▲',left:'◀',right:'▶',down:'▼'})){
  const control=button(label,'zs-p2-dir zs-p2-'+d,e=>{if(e.detail===0)turn(({up:'down',down:'up',left:'right',right:'left'})[d],1);},second);
  control.setAttribute('aria-label','Joueur 2 : '+({up:'Haut',left:'Gauche',right:'Droite',down:'Bas'})[d]);
  applyControlTexture(control,d);
  control.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();sounds.unlock();turn(({up:'down',down:'up',left:'right',right:'left'})[d],1);};
 }
 wrap.insertBefore(second,$('.zs-hud'));
 renderMenu();
 function turn(d,index=0){if(g.state==='ready'){navigate(d);return;}const wasRunning=g.state==='running';if(g.turn(d,index)&&wasRunning)sounds.play('turn');render();}
 function render(){
  if(!alive)return;
  if(g.state!==lastState){
   if(g.state==='hurt'){if(g.kind==='duel'&&settings.players===1&&g.winner===1){sounds.stop();sounds.play('won');}else sounds.setMode('hurt');crashTimer=setTimeout(()=>{crashTimer=null;if(alive){g.finishCrash();render();}},2000);}
   else if(g.state==='won'){sounds.stop();sounds.play('won');}
   else if(g.state==='paused'){sounds.stop();sounds.play('pause');}
   else if(g.state==='running'){sounds.stop();sounds.setMode('running');sounds.play(lastState==='paused'?'resume':'start');}
   lastState=g.state;
  }
  if(g.score>lastScore&&g.state==='running')sounds.play('eat');lastScore=g.score;
  if(g.score>currentBest())saveRecord(g.score);
  const best=currentBest();
  $('.zs-score-label').textContent=g.kind==='duel'&&g.state!=='ready'?'J1':'SCORE';$('.zs-best-label').textContent=g.kind==='duel'&&g.state!=='ready'?(settings.players===1?'ORDI':'J2'):'RECORD';
  $('.zs-score').textContent=String(g.score).padStart(4,'0');$('.zs-best').textContent=String(g.kind==='duel'&&g.state!=='ready'?g.players[1].score:best).padStart(4,'0');
  const duelResult=g.kind==='duel'&&g.state==='over'?(g.winner===0?'DRAW':g.winner===1?'PLAYER 1 WIN':settings.players===1?'ZNAKEBOT WIN':'PLAYER 2 WIN'):'';
  status.textContent=duelResult||({ready:'PRÊT',running:'EN JEU',paused:'PAUSE',hurt:'AÏE',over:'GAME OVER',won:'VICTOIRE'})[g.state];
  play.textContent=g.state==='running'?'Pause':g.state==='paused'?'Reprendre':g.state==='ready'?'Jouer':'Rejouer';
  if($('.zs-console').classList.contains('zt-art-loaded'))skinToolbar();
  wrap.dataset.state=g.state;wrap.dataset.duo=String(g.kind==='duel'&&settings.players===2&&g.state!=='ready');fit();
  launch.hidden=g.state!=='ready';renderMenu();
  $('.zs-result').textContent='';
  wrap.querySelectorAll('button').forEach(b=>{b.disabled=g.state==='hurt';});
  overlay.hidden=g.state==='ready'||g.state==='running'||g.state==='hurt';overlay.dataset.state=g.state;
  overlay.querySelector('strong').textContent=duelResult||({ready:'ZNAKE',paused:'PAUSE',hurt:'AÏE',over:'GAME OVER',won:'VICTOIRE'})[g.state]||'';
  overlay.querySelector('span').textContent=g.state==='ready'?'ESPACE : JOUER':g.state==='paused'?'ESPACE : REPRENDRE':g.state==='over'?'Appuyer sur espace pour recommencer':'SCORE : '+g.score;
  $('.zs-start').textContent=play.textContent;
  draw(ctx,g,settings.level===4?level4Background:settings.level===3?level3Background:background);
 }
 function fit(){const w=Math.max(1,Math.min(arena.clientWidth,arena.clientHeight*CW/CH));stage.style.width=w+'px';stage.style.height=w*CH/CW+'px';hud.style.width=w+'px';}
 function focused(){const w=root.closest('.window');return !w||w.classList.contains('active')||w.classList.contains('focused')||w.style.zIndex===String(Math.max(...Array.from(document.querySelectorAll('.window')).map(e=>Number(e.style.zIndex)||0)));}
 function key(e){
  if(!alive||!focused()||e.altKey||e.ctrlKey||e.metaKey||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable)return;
  const letter=e.key.toLowerCase(),arrows={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};
  const keys={w:'up',z:'up',s:'down',a:'left',q:'left',d:'right'},d=arrows[e.key]||keys[letter];
    if(d){e.preventDefault();if(!e.repeat){sounds.unlock();turn(d,g.state!=='ready'&&settings.players===2&&arrows[e.key]?1:0);}}
  else if(e.code==='Space'||e.key===' '||e.key==='Enter'||letter==='p'){e.preventDefault();if(!e.repeat){sounds.unlock();action();}}
  else if(e.key==='Escape'){e.preventDefault();if(g.state==='ready'&&(menuPage==='level'||menuPage==='scores')){const previousPage=menuPage;menuPage='mode';menuIndex=previousPage==='scores'?3:(settings.mode==='solo'?0:settings.mode==='robot'?1:2);renderMenu();}else menu();}
 }
 function hide(){if(document.hidden){sounds.stop();if(g.state==='running'){g.state='paused';render();}}}
 function blur(){sounds.stop();if(g.state==='running'){g.state='paused';render();}}
 document.addEventListener('keydown',key);document.addEventListener('visibilitychange',hide);window.addEventListener('blur',blur);
 const clock=setInterval(()=>{sounds.sync();if(g.state==='running'){if(!focused()){blur();return;}elapsed+=20;if(elapsed>=LEVEL_MS[settings.level-1]){elapsed=0;g.tick();render();}}},20);
 if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(fit);observer.observe(arena);}else window.addEventListener('resize',fit);
 fit();render();
 root._zebraDispose=function(){alive=false;clearCrash();sounds.dispose();clearInterval(clock);if(observer)observer.disconnect();window.removeEventListener('resize',fit);window.removeEventListener('blur',blur);document.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',hide);};
}
window.ZebraSnake={mount,createGame,createDuel,LEVEL_MS,createSounds,draw,drawBackground,drawLevel3Background,drawLevel4Background,width:CW,height:CH};
}());
