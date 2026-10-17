/* Zebra Pursuit — original sunset pseudo-3D arcade racer for ZebraOS. */
(function(){
'use strict';
const WIDTH=960,HEIGHT=540,HORIZON=176,VIEW_DISTANCE=1550,MAX_SPEED=318,FINISH=7800;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function curveAt(distance){
 const d=distance/520;
 return Math.sin(d*.72)*.46+Math.sin(d*.19+1.3)*.27+Math.sin(d*1.67)*.12;
}
function hillAt(distance){return Math.sin(distance/880)*18+Math.sin(distance/310+2)*7;}
function createGame(random=Math.random){
 const g={state:'title',speed:0,x:0,distance:0,time:0,nitro:100,integrity:100,flash:0,shake:0,traffic:[],controls:{left:false,right:false,gas:false,brake:false,nitro:false}};
 function spawn(i){
  const lanes=[-.68,-.34,0,.34,.68],type=i%5===3?'police':i%3===0?'rival':'civil';
  return {distance:420+i*275+random()*160,lane:lanes[Math.floor(random()*lanes.length)],speed:105+random()*105,type,hit:false,color:['#23b7ca','#f4d35e','#f06b59','#d6d7dd'][i%4]};
 }
 g.reset=function(){g.speed=0;g.x=0;g.distance=0;g.time=0;g.nitro=100;g.integrity=100;g.flash=0;g.shake=0;g.traffic=Array.from({length:11},(_,i)=>spawn(i));g.state='title';};
 g.start=function(){if(g.state==='title'||g.state==='over'||g.state==='won'){if(g.state!=='title')g.reset();g.state='running';}};
 g.toggle=function(){if(g.state==='running')g.state='paused';else if(g.state==='paused')g.state='running';else g.start();};
 g.tick=function(dt){
  dt=clamp(Number(dt)||0,0,.05);if(g.state!=='running')return;
  g.time+=dt;g.flash=Math.max(0,g.flash-dt);g.shake=Math.max(0,g.shake-dt);
  const c=g.controls,boost=c.nitro&&c.gas&&g.nitro>0&&g.speed>75;
  if(c.gas)g.speed+=88*dt;else g.speed-=30*dt;
  if(c.brake)g.speed-=142*dt;
  if(boost){g.speed+=168*dt;g.nitro=Math.max(0,g.nitro-25*dt);}else g.nitro=Math.min(100,g.nitro+5.5*dt);
  g.speed=clamp(g.speed,0,boost?365:MAX_SPEED);
  const steer=(.62+g.speed/MAX_SPEED*1.1)*dt;
  if(c.left)g.x-=steer;if(c.right)g.x+=steer;
  g.x-=curveAt(g.distance)*g.speed/MAX_SPEED*.34*dt;
  if(Math.abs(g.x)>1){g.speed=Math.max(0,g.speed-105*dt);g.shake=Math.max(g.shake,.08);}
  g.x=clamp(g.x,-1.42,1.42);
  g.distance+=g.speed/3.6*dt;
  for(const car of g.traffic){
   car.distance+=car.speed/3.6*dt;
   if(car.distance<g.distance-90){car.distance=g.distance+VIEW_DISTANCE*.75+random()*VIEW_DISTANCE*.7;car.lane=[-.68,-.34,0,.34,.68][Math.floor(random()*5)];car.hit=false;}
   const gap=car.distance-g.distance;
   if(!car.hit&&gap>-4&&gap<15&&Math.abs(car.lane-g.x)<.27){
    car.hit=true;g.speed*=.42;g.integrity=Math.max(0,g.integrity-(car.type==='police'?24:15));g.flash=.34;g.shake=.5;
   }
  }
  if(g.integrity<=0){g.speed=0;g.state='over';}
  else if(g.distance>=FINISH){g.state='won';g.speed=0;}
 };
 g.reset();return g;
}
function polygon(ctx,points,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fill();}
function drawSky(ctx,g){
 const grad=ctx.createLinearGradient(0,0,0,HORIZON+90);grad.addColorStop(0,'#35186f');grad.addColorStop(.35,'#b7348b');grad.addColorStop(.69,'#ff765e');grad.addColorStop(1,'#ffc56d');ctx.fillStyle=grad;ctx.fillRect(0,0,WIDTH,HORIZON+100);
 ctx.fillStyle='#ffe8a3';ctx.beginPath();ctx.arc(720,116,54,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,101,99,.36)';ctx.fillRect(660,113,120,7);ctx.fillRect(670,132,100,5);
 ctx.fillStyle='#62366f';polygon(ctx,[[0,164],[90,113],[164,158],[250,98],[344,166],[440,125],[530,172],[0,190]],'#62366f');
 polygon(ctx,[[105,164],[250,98],[300,150],[337,166]],'#3b316e');polygon(ctx,[[202,126],[250,98],[281,137]],'#ffb58a');
 ctx.fillStyle='#176d86';ctx.fillRect(0,HORIZON-3,WIDTH,HORIZON+40);ctx.fillStyle='rgba(255,183,113,.38)';for(let y=HORIZON;y<HORIZON+65;y+=9)ctx.fillRect(560+(y%18)*4,y,300-(y-HORIZON)*3,2);
 // Skyline and palms, kept behind the road.
 ctx.fillStyle='#162d4b';for(let x=0;x<WIDTH;x+=37){const h=12+(x*17)%34;ctx.fillRect(x,HORIZON-h,29,h);}
 function palm(x,y,s){ctx.strokeStyle='#14243c';ctx.lineWidth=5*s;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+7*s,y-28*s,x+2*s,y-64*s);ctx.stroke();ctx.fillStyle='#14243c';for(let i=0;i<7;i++){const a=-2.9+i*.55;ctx.beginPath();ctx.moveTo(x+2*s,y-64*s);ctx.quadraticCurveTo(x+Math.cos(a)*30*s,y-70*s+Math.sin(a)*16*s,x+Math.cos(a)*45*s,y-60*s+Math.sin(a)*28*s);ctx.lineTo(x+2*s,y-60*s);ctx.fill();}}
 palm(70,HORIZON+23,.72);palm(870,HORIZON+19,.85);palm(914,HORIZON+29,.58);
}
function roadPoint(g,yIndex,count){
 const t=yIndex/count,p=Math.pow(t,1.72),ahead=(1-p)*VIEW_DISTANCE;
 const y=HORIZON+p*(HEIGHT-HORIZON+65)+hillAt(g.distance+ahead)-hillAt(g.distance);
 const half=27+p*520;
 const bend=(curveAt(g.distance+ahead)-curveAt(g.distance))*245*(1-p*.2);
 return {y,half,center:WIDTH/2+bend-g.x*half*.78,p,ahead};
}
function drawRoad(ctx,g){
 ctx.fillStyle='#174957';ctx.fillRect(0,HORIZON,WIDTH,HEIGHT-HORIZON);
 const count=84;
 for(let i=0;i<count;i++){
  const a=roadPoint(g,i,count),b=roadPoint(g,i+1,count),world=Math.floor((g.distance+a.ahead)/42),alt=world%2===0;
  ctx.fillStyle=alt?'#195658':'#174a51';ctx.fillRect(0,a.y,WIDTH,Math.max(2,b.y-a.y+1));
  polygon(ctx,[[a.center-a.half-16,a.y],[a.center-a.half,a.y],[b.center-b.half,b.y],[b.center-b.half-21,b.y]],alt?'#f06b60':'#f7e4c0');
  polygon(ctx,[[a.center+a.half,a.y],[a.center+a.half+16,a.y],[b.center+b.half+21,b.y],[b.center+b.half,b.y]],alt?'#f06b60':'#f7e4c0');
  polygon(ctx,[[a.center-a.half,a.y],[a.center+a.half,a.y],[b.center+b.half,b.y],[b.center-b.half,b.y]],alt?'#343547':'#3a3a4c');
  if(world%3!==0){
   for(const lane of [-1/3,1/3]){const aw=2+a.p*4,bw=2+b.p*4;polygon(ctx,[[a.center+a.half*lane-aw,a.y],[a.center+a.half*lane+aw,a.y],[b.center+b.half*lane+bw,b.y],[b.center+b.half*lane-bw,b.y]],'#ffd98a');}
  }
  if(i%9===0&&i>4){
   const side=i%18===0?-1:1,x=b.center+side*(b.half+28+b.p*70),s=.15+b.p*.78;
   ctx.fillStyle='#15243e';ctx.fillRect(x-2*s,b.y-44*s,4*s,44*s);ctx.beginPath();ctx.arc(x,b.y-47*s,17*s,0,Math.PI*2);ctx.fill();
   ctx.fillStyle=i%27===0?'#f0627f':'#1e8371';ctx.beginPath();ctx.arc(x,b.y-52*s,11*s,0,Math.PI*2);ctx.fill();
  }
 }
}
function projectCar(g,car){
 const gap=car.distance-g.distance;if(gap<2||gap>VIEW_DISTANCE)return null;
 const p=1-gap/VIEW_DISTANCE,depth=Math.pow(p,1.72),half=27+depth*520;
 const bend=(curveAt(car.distance)-curveAt(g.distance))*245*(1-depth*.2);
 return {x:WIDTH/2+bend-g.x*half*.78+car.lane*half*.76,y:HORIZON+depth*(HEIGHT-HORIZON+65)+hillAt(car.distance)-hillAt(g.distance),scale:.1+depth*1.18,gap};
}
function drawTrafficCar(ctx,g,car){
 const p=projectCar(g,car);if(!p)return;const s=p.scale,w=58*s,h=34*s,x=p.x,y=p.y;
 ctx.fillStyle='rgba(7,8,18,.5)';ctx.beginPath();ctx.ellipse(x,y+4*s,w*.58,h*.22,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#090b16';ctx.fillRect(x-w*.52,y-h*.52,w*.18,h*.53);ctx.fillRect(x+w*.34,y-h*.52,w*.18,h*.53);
 polygon(ctx,[[x-w*.48,y],[x-w*.38,y-h*.62],[x-w*.19,y-h],[x+w*.2,y-h],[x+w*.4,y-h*.62],[x+w*.48,y]],car.type==='police'?'#d9e1e7':car.type==='rival'?'#121525':car.color);
 polygon(ctx,[[x-w*.24,y-h*.77],[x-w*.13,y-h*.98],[x+w*.14,y-h*.98],[x+w*.28,y-h*.77]],'#17233e');
 ctx.fillStyle='#ff433f';ctx.fillRect(x-w*.37,y-h*.38,w*.13,5*s);ctx.fillRect(x+w*.24,y-h*.38,w*.13,5*s);
 if(car.type==='police'){ctx.fillStyle=Math.floor(g.time*9)%2?'#ff304d':'#328dff';ctx.fillRect(x-w*.2,y-h*1.05,w*.4,4*s);ctx.fillStyle='#1d3154';ctx.fillRect(x-w*.33,y-h*.6,w*.66,4*s);}
}
function drawPlayerCar(ctx,g){
 const x=WIDTH/2+(g.controls.left?-5:g.controls.right?5:0),y=HEIGHT-34+(g.shake?Math.sin(g.time*90)*4:0),s=1.42;
 ctx.fillStyle='rgba(7,4,18,.55)';ctx.beginPath();ctx.ellipse(x,y-3,118,22,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#080913';ctx.fillRect(x-104,y-61,30,63);ctx.fillRect(x+74,y-61,30,63);
 polygon(ctx,[[x-98,y-6],[x-90,y-66],[x-61,y-94],[x-42,y-123],[x+40,y-123],[x+62,y-94],[x+91,y-66],[x+99,y-6]],g.flash?'#fff1cf':'#e33155');
 polygon(ctx,[[x-57,y-92],[x-39,y-118],[x+38,y-118],[x+57,y-92]],'#151a38');
 ctx.fillStyle='#ff6c45';ctx.fillRect(x-91,y-68,182,17);ctx.fillStyle='#802046';ctx.fillRect(x-80,y-48,160,38);
 ctx.fillStyle='#ffdf75';ctx.fillRect(x-68,y-43,31,13);ctx.fillRect(x+37,y-43,31,13);ctx.fillStyle='#ff355c';ctx.fillRect(x-68,y-40,27,8);ctx.fillRect(x+41,y-40,27,8);
 ctx.fillStyle='#111528';ctx.fillRect(x-112,y-91,224,13);ctx.fillRect(x-92,y-97,12,20);ctx.fillRect(x+80,y-97,12,20);
 ctx.fillStyle='#28d2d2';ctx.fillRect(x-28,y-46,56,18);ctx.fillStyle='#0d2848';ctx.fillRect(x-20,y-42,40,10);
 if(g.controls.nitro&&g.controls.gas&&g.nitro>0){polygon(ctx,[[x-22,y-23],[x-6,y+22],[x,y-17]],'#6ff7ff');polygon(ctx,[[x+22,y-23],[x+6,y+22],[x,y-17]],'#ff6bd6');}
}
function formatTime(seconds){const m=Math.floor(seconds/60),s=Math.floor(seconds%60),cs=Math.floor(seconds*100)%100;return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'.'+String(cs).padStart(2,'0');}
function render(ctx,g){
 ctx.save();if(g.shake)ctx.translate(Math.sin(g.time*110)*3,Math.cos(g.time*87)*2);drawSky(ctx,g);drawRoad(ctx,g);
 g.traffic.map(car=>({car,p:projectCar(g,car)})).filter(x=>x.p).sort((a,b)=>b.p.gap-a.p.gap).forEach(x=>drawTrafficCar(ctx,g,x.car));drawPlayerCar(ctx,g);ctx.restore();
 ctx.fillStyle='rgba(8,8,29,.7)';ctx.fillRect(18,18,218,78);ctx.strokeStyle='#ff88b8';ctx.strokeRect(18.5,18.5,218,78);
 ctx.fillStyle='#ffe5ac';ctx.font='700 29px monospace';ctx.fillText(String(Math.round(g.speed)).padStart(3,'0')+' KM/H',31,53);ctx.font='15px monospace';ctx.fillText(formatTime(g.time),31,80);ctx.fillText((g.distance/1000).toFixed(1)+' / '+(FINISH/1000).toFixed(1)+' KM',126,80);
 ctx.fillStyle='rgba(8,8,29,.7)';ctx.fillRect(WIDTH-210,18,192,78);ctx.fillStyle='#f5a0ce';ctx.font='13px monospace';ctx.fillText('NITRO',WIDTH-195,42);ctx.fillStyle='#281b52';ctx.fillRect(WIDTH-195,50,158,12);ctx.fillStyle='#29d8e1';ctx.fillRect(WIDTH-195,50,158*g.nitro/100,12);ctx.fillStyle='#f5a0ce';ctx.fillText('CAR '+Math.round(g.integrity)+'%',WIDTH-195,82);
 if(g.state==='title'||g.state==='paused'||g.state==='over'||g.state==='won'){
  ctx.fillStyle='rgba(13,7,35,.63)';ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.textAlign='center';ctx.fillStyle='#ffbf7c';ctx.font='italic 900 72px sans-serif';ctx.fillText('ZEBRA PURSUIT',WIDTH/2,174);ctx.fillStyle='#ff5caa';ctx.font='700 22px monospace';ctx.fillText(g.state==='title'?'MIAMI COAST · 8 KM':g.state==='paused'?'PAUSE':g.state==='won'?'FINISH · '+formatTime(g.time):'WRECKED',WIDTH/2,218);ctx.fillStyle='#fff1c9';ctx.font='18px monospace';ctx.fillText(g.state==='title'?'FLÈCHES / WASD · ESPACE NITRO':g.state==='paused'?'ESPACE POUR REPRENDRE':'ESPACE POUR REJOUER',WIDTH/2,264);ctx.textAlign='start';
 }
}
function createAudio(){
 let context=null,osc=null,gain=null,filter=null;
 function start(){try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;if(!context)context=new AC();if(context.state==='suspended')context.resume();if(!osc){osc=context.createOscillator();gain=context.createGain();filter=context.createBiquadFilter();osc.type='sawtooth';filter.type='lowpass';gain.gain.value=.025;osc.connect(filter);filter.connect(gain);gain.connect(context.destination);osc.start();}}catch(_){}}
 function update(speed,running){if(!osc||!context)return;const now=context.currentTime;osc.frequency.setTargetAtTime(42+speed*.55,now,.05);filter.frequency.setTargetAtTime(180+speed*4,now,.06);gain.gain.setTargetAtTime(running?.028:.0001,now,.08);}
 function crash(){if(!context)return;try{const o=context.createOscillator(),v=context.createGain(),now=context.currentTime;o.type='square';o.frequency.setValueAtTime(90,now);o.frequency.exponentialRampToValueAtTime(38,now+.26);v.gain.setValueAtTime(.08,now);v.gain.exponentialRampToValueAtTime(.0001,now+.3);o.connect(v);v.connect(context.destination);o.start();o.stop(now+.31);}catch(_){}}
 function dispose(){try{if(osc)osc.stop();if(context)context.close();}catch(_){}osc=null;context=null;}
 return {start,update,crash,dispose};
}
function mount(root){
 if(root._zebraDispose)root._zebraDispose();root.innerHTML='';
 const game=createGame(),audio=createAudio(),wrap=document.createElement('div');wrap.className='zr-game';
 wrap.innerHTML='<div class="zr-screen"><canvas width="960" height="540" aria-label="Zebra Pursuit, course automobile arcade"></canvas><button type="button" class="zr-start">START</button></div><div class="zr-controls"><div class="zr-steer"><button data-control="left" aria-label="Tourner à gauche">◀</button><button data-control="right" aria-label="Tourner à droite">▶</button></div><div class="zr-pedals"><button data-control="brake" aria-label="Freiner">BRAKE</button><button data-control="nitro" aria-label="Nitro">N₂O</button><button data-control="gas" aria-label="Accélérer">GAS</button></div></div><p class="zr-help">WASD / FLÈCHES · ESPACE NITRO · P PAUSE</p>';
 root.appendChild(wrap);const canvas=wrap.querySelector('canvas'),ctx=canvas.getContext('2d'),startButton=wrap.querySelector('.zr-start');ctx.imageSmoothingEnabled=false;
 let alive=true,raf=0,last=performance.now(),previousIntegrity=game.integrity;
 function start(){audio.start();if(game.state==='title'||game.state==='over'||game.state==='won')game.start();else if(game.state==='paused')game.toggle();startButton.hidden=true;}
 function frame(now){if(!alive)return;const dt=Math.min(.05,(now-last)/1000);last=now;game.tick(dt);if(game.integrity<previousIntegrity)audio.crash();previousIntegrity=game.integrity;audio.update(game.speed,game.state==='running');render(ctx,game);startButton.hidden=game.state==='running';startButton.textContent=game.state==='paused'?'RESUME':game.state==='title'?'START':'RESTART';wrap.dataset.state=game.state;wrap.dataset.speed=String(Math.round(game.speed));wrap.dataset.integrity=String(game.integrity);raf=requestAnimationFrame(frame);}
 const map={ArrowLeft:'left',a:'left',q:'left',ArrowRight:'right',d:'right',ArrowUp:'gas',w:'gas',z:'gas',ArrowDown:'brake',s:'brake'};
 function keydown(e){if(e.altKey||e.ctrlKey||e.metaKey||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;const key=map[e.key]||map[e.key.toLowerCase()];if(key){e.preventDefault();game.controls[key]=true;start();}else if(e.code==='Space'){e.preventDefault();if(game.state==='title'||game.state==='over'||game.state==='won')start();else game.controls.nitro=true;}else if(e.key.toLowerCase()==='p'||e.key==='Escape'){e.preventDefault();game.toggle();}}
 function keyup(e){const key=map[e.key]||map[e.key.toLowerCase()];if(key)game.controls[key]=false;if(e.code==='Space')game.controls.nitro=false;}
 wrap.querySelectorAll('[data-control]').forEach(button=>{const control=button.dataset.control;const on=e=>{e.preventDefault();audio.start();game.controls[control]=true;start();button.setPointerCapture?.(e.pointerId);};const off=e=>{e.preventDefault();game.controls[control]=false;};button.addEventListener('pointerdown',on);button.addEventListener('pointerup',off);button.addEventListener('pointercancel',off);button.addEventListener('lostpointercapture',off);});
 startButton.onclick=start;document.addEventListener('keydown',keydown);document.addEventListener('keyup',keyup);render(ctx,game);raf=requestAnimationFrame(frame);
 root._zebraRacerGame=game;root._zebraDispose=function(){alive=false;cancelAnimationFrame(raf);audio.dispose();document.removeEventListener('keydown',keydown);document.removeEventListener('keyup',keyup);};
}
window.ZebraRacer={mount,createGame,curveAt,hillAt,render,width:WIDTH,height:HEIGHT,finish:FINISH,maxSpeed:MAX_SPEED};
}());
