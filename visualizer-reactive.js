/* ZebraVIS Reactor — two real-audio phosphor effects. Canvas 2D; no media graph. */
(function(){
"use strict";
var TAU=Math.PI*2;
var mobile=!!(window.matchMedia&&window.matchMedia("(pointer:coarse)").matches);
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function follow(v,t,dt,attack,release){return v+(t-v)*(1-Math.exp(-dt/(t>v?attack:release)));}
function makeStars(){
 var seed=0x5EED,arr=[];
 function random(){seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;}
 for(var i=0;i<(mobile?240:500);i++){
  var a=random()*TAU,r=Math.sqrt(random())*1.3;
  arr.push({x:Math.cos(a)*r,y:Math.sin(a)*r,z:.055+random()*.99,
    hue:Math.floor(random()*3),size:.6+random()*1.6});
 }
 return arr;
}
function create(){
 return {level:0,bass:0,mid:0,high:0,hit:0,flash:0,
  velocity:0,prevBass:0,prevMid:0,prevLevel:0,
  bands:new Float32Array(48),phase:0,depth:0,
  pulseAge:2,pulsePower:0,stars:makeStars()};
}
function update(r,m,playing,dt){
 r.playing=!!playing;
 var flux=0;
 for(var k=0;k<48;k++){
  var val=playing?(m.levels[k]||0):0;
  flux+=Math.max(0,val-r.bands[k]);r.bands[k]=val;
 }
 flux/=48;
 var level=playing?clamp(m.level*2,0,1):0;
 var bass=playing?clamp(m.bass*2.2,0,1):0;
 var mid=playing?clamp(m.mids*2.15,0,1):0;
 var high=playing?clamp(m.treble*2.2,0,1):0;
 var rise=playing?Math.max(0,level-r.prevLevel):0;
 var attack=playing?clamp(flux*24+
  Math.max(0,bass-r.prevBass)*4.6+
  Math.max(0,mid-r.prevMid)*3.2+rise*3.4,0,1):0;
 r.prevBass=bass;r.prevMid=mid;r.prevLevel=level;
 r.level=follow(r.level,level,dt,.024,.16);
 r.bass=follow(r.bass,bass,dt,.018,.19);
 r.mid=follow(r.mid,mid,dt,.027,.15);
 r.high=follow(r.high,high,dt,.015,.12);
 r.hit=Math.max(attack,r.hit*Math.exp(-dt/.18));
 // Bright flash follows audible hits and the actual rise of RMS.
 r.flash=Math.max(attack*.95,rise*1.65,r.flash*Math.exp(-dt/.24));
 if(!playing)r.flash*=Math.exp(-dt/.045);
 r.pulseAge+=dt;
 if(playing&&attack>.15&&r.pulseAge>.13){r.pulseAge=0;r.pulsePower=clamp(.45+attack,0,1);}
 var speed=playing?.035+r.level*1.15+r.bass*1.5+r.hit*3.15:0;
 r.velocity=follow(r.velocity,speed,dt,.035,.11);
 if(playing){
  r.phase+=dt*(.08+r.mid*.6+r.bass*1.1+r.hit*1.9);
  r.depth+=dt*r.velocity;
 }
}
function beginBackground(ctx){
 ctx.globalCompositeOperation="lighter";
}
function shock(ctx,r,maxRadius,hue){
 if(r.pulseAge>=.75||r.pulsePower<.08)return;
 var u=r.pulseAge/.75,a=(1-u)*r.pulsePower,rad=8+(1-Math.pow(1-u,2))*maxRadius;
 ctx.beginPath();ctx.arc(0,0,rad,0,TAU);
 ctx.shadowColor="hsla("+hue+",100%,65%,1)";
 ctx.shadowBlur=mobile?12:28;
 ctx.strokeStyle="hsla("+hue+",100%,61%,"+(a*.3)+")";
 ctx.lineWidth=7+a*9;ctx.stroke();
 ctx.strokeStyle="hsla("+hue+",100%,92%,"+(a*.9)+")";
 ctx.lineWidth=1.3+a*1.4;ctx.stroke();
 ctx.shadowBlur=0;
}
/* White phosphor exposure reacts to RMS and drum transients,
 * never to a clock or a random flash generator. */
function lightWash(ctx,w,h,r){
 var loud=clamp(Math.pow(r.level,1.65)*.30+r.bass*.12+r.flash*.45,0,.82);
 if(loud<.012)return;
 var rad=Math.max(w,h)*.65;
 var glow=ctx.createRadialGradient(0,0,3,0,0,rad);
 glow.addColorStop(0,"rgba(227,255,248,"+(loud*.76)+")");
 glow.addColorStop(.19,"rgba(104,255,229,"+(loud*.29)+")");
 glow.addColorStop(.47,"rgba(37,142,231,"+(loud*.13)+")");
 glow.addColorStop(1,"rgba(34,99,194,0)");
 ctx.save();ctx.globalCompositeOperation="lighter";ctx.shadowBlur=0;
 ctx.fillStyle=glow;ctx.fillRect(-w*.55,-h*.55,w*1.1,h*1.1);
 ctx.restore();
}
/* TUNNEL NÉON V3 — phosphor overdrive.
 * SPEED: integrated audio energy (r.depth), bass and attack.
 * GEOMETRY: 48 real FFT bands deform all rings and guides.
 * LUMINANCE: RMS, kicks and treble control emission/afterglow.
 * SPARKS: energy/attack-driven emission only — never a timed fake beat. */
function tunnelRand(fx){
 fx.seed=(Math.imul(1664525,fx.seed)+1013904223)>>>0;
 return fx.seed/4294967296;
}
function tunnel(ctx,w,h,m,r,dt){
 dt=clamp(Number(dt)||.016,.001,.06);
 if(!r.tunnelFx)r.tunnelFx={seed:0x4A13B63,sparks:[],credit:0};
 var fx=r.tunnelFx,active=!!r.playing;
 var extent=Math.hypot(w,h)*.79;
 var burst=clamp(r.flash*.68+r.hit*.41,0,1);
 var exposure=clamp(.07+Math.pow(r.level,1.15)*.76+r.bass*.47+
                   burst*.63+r.high*.15,0,1.7);
 var impact=clamp(r.bass*.65+r.hit*.72+r.flash*.60,0,1.55);
 var depth=r.depth*.33; // Large travel differential between quiet and loud sections.
 var twist=r.phase*.31+r.mid*.3,tilt=(.05+r.mid*.07)*Math.sin(r.phase*.45);
 var cx=w/2,cy=h/2;
 ctx.save();
 // Small audio-driven camera punch; no automatic shaking when paused.
 ctx.translate(cx+Math.sin(r.phase*.91)*r.hit*w*.015,
               cy+Math.cos(r.phase*.73)*r.hit*h*.017);
 ctx.rotate(tilt);
 ctx.globalCompositeOperation="lighter";
 ctx.lineCap="round";ctx.lineJoin="round";

 // Laser rails make speed legible; each beam is linked to one FFT region.
 var rails=mobile?12:16;
 for(var g=0;g<rails;g++){
  var ang=g/rails*TAU+twist*.25;
  var band=m.levels[(g*3)%48]||0;
  var rayPower=clamp(exposure*.10+r.high*.18+band*.5+burst*.27,0,.85);
  ctx.beginPath();
  ctx.moveTo(Math.cos(ang)*6,Math.sin(ang)*5);
  ctx.lineTo(Math.cos(ang)*extent*1.02,Math.sin(ang)*extent*.82);
  ctx.shadowColor=g%4===0?"#c579ff":"#29ffe5";
  ctx.shadowBlur=mobile?11:21;
  ctx.strokeStyle=g%4===0?"rgba(176,94,255,"+(rayPower*.55)+")":
                        "rgba(23,255,221,"+(rayPower*.65)+")";
  ctx.lineWidth=1.2+band*1.8+burst*.9;ctx.stroke();
 }

 // Longitudinal speed is entirely driven by the integrated analyser energy.
 var ringCount=mobile?19:29,points=mobile?44:64;
 for(var i=ringCount-1;i>=0;i--){
  var z=(i/ringCount+depth)%1;
  var perspective=Math.pow(z,1.72);
  var radius=(8+perspective*extent)*(1+r.bass*.28+impact*.17);
  var rotate=twist+z*(.33+r.mid*.32)+i*.007;
  ctx.beginPath();
  for(var j=0;j<=points;j++){
   var angle=j/points*TAU;
   var band=m.levels[(Math.floor(j/points*48)+i*3)%48]||0;
   var vibration=Math.sin(angle*6+rotate*2+i*.32)*(.023+r.mid*.085);
   var ripple=Math.cos(angle*11-r.phase*.72+i*.83)*(.009+r.high*.029);
   var shape=1+vibration+ripple+band*(.15+r.high*.15)+burst*.09;
   var a=angle+rotate+Math.sin(angle*3+i*.29)*r.mid*.035;
   var x=Math.cos(a)*radius*shape,y=Math.sin(a)*radius*shape*.80;
   if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  // Cyan / radioactive mint / violet: near-white cores at hard hits.
  var hue=(i%6===0?278:i%5===0?197:162+z*59+r.high*18);
  var lit=clamp((.14+exposure*.93+r.hit*.23)*(.24+z*.76),.02,1.6);
  ctx.shadowColor="hsla("+hue+",100%,64%,1)";
  ctx.shadowBlur=(mobile?19:38)+burst*22;
  ctx.lineWidth=6+z*5+impact*3.4;
  ctx.strokeStyle="hsla("+hue+",100%,51%,"+clamp(lit*.37,0,.82)+")";
  ctx.stroke();
  ctx.shadowBlur=(mobile?9:21)+burst*11;
  ctx.lineWidth=2.5+z*2.1+impact*1.6;
  ctx.strokeStyle="hsla("+hue+",100%,72%,"+clamp(lit*.78,0,.99)+")";
  ctx.stroke();
  ctx.shadowBlur=mobile?4:9;
  ctx.lineWidth=1.15+z*.88+impact*.55;
  ctx.strokeStyle="hsla("+hue+",100%,"+(87+burst*9)+"%,"+
    clamp(lit*(.7+burst*.38),0,1)+")";
  ctx.stroke();

  // Little white electric glints on ring edges, modulated by high bins.
  var glitterBand=m.levels[(i*7+29)%48]||0;
  if(glitterBand+r.high+burst>.28){
   var angle=i*2.399963+twist*.25;
   var xx=Math.cos(angle)*radius,yy=Math.sin(angle)*radius*.8;
   var sparkLight=clamp((glitterBand*.55+r.high*.4+burst*.35)*lit,0,.95);
   var dot=1.2+glitterBand*2.6+burst*2.6;
   ctx.shadowColor="#bffff4";ctx.shadowBlur=mobile?8:16;
   ctx.fillStyle="rgba(242,255,252,"+sparkLight+")";
   ctx.fillRect(xx-dot*.5,yy-dot*.5,dot,dot);
  }
 }

 // A strong kick creates a short-lived expanding phosphor pressure wave.
 shock(ctx,r,extent*.96,166);
 var coreRadius=18+r.bass*107+r.hit*145+r.flash*90;
 var core=ctx.createRadialGradient(0,0,0,0,0,coreRadius);
 core.addColorStop(0,"rgba(244,255,251,"+
   clamp(.07+r.bass*.46+r.hit*.34+burst*.33,0,.97)+")");
 core.addColorStop(.22,"rgba(85,255,223,"+
   clamp(.05+r.bass*.28+r.flash*.21,0,.68)+")");
 core.addColorStop(.65,"rgba(73,105,255,"+clamp(burst*.12+r.bass*.035,0,.22)+")");
 core.addColorStop(1,"rgba(35,78,197,0)");
 ctx.shadowBlur=0;ctx.fillStyle=core;
 ctx.beginPath();ctx.arc(0,0,coreRadius,0,TAU);ctx.fill();

 // Energy-dependent exposure blooms over the geometry; never white-screen strobe.
 lightWash(ctx,w,h,{
  level:clamp(r.level*1.3,0,1),bass:r.bass,flash:clamp(r.flash*1.16,0,1)
 });

 // Flying phosphor dust: high frequencies sparkle, kicks throw larger sparks.
 // Deterministic RNG is only for position; emission is driven by audio signal.
 var sparks=fx.sparks;
 if(active){
  // Cap unused emission credit: an intense section must not schedule
  // delayed glitter after the music becomes quiet, especially on mobile.
  fx.credit=Math.min(mobile?7:12,fx.credit+dt*(r.high*125+r.hit*155+burst*105+r.level*23));
  var budget=Math.min(mobile?6:11,Math.floor(fx.credit));
  fx.credit=Math.min(.99,fx.credit-budget);
  for(var n=0;n<budget;n++){
   var angle=tunnelRand(fx)*TAU;
   var radius=(.12+tunnelRand(fx)*.76)*extent;
   var highBand=m.levels[24+Math.floor(tunnelRand(fx)*24)]||0;
   var force=.45+r.high*.85+burst*.88+highBand*.44;
   var speed=34+force*(65+tunnelRand(fx)*70);
   var dx=Math.cos(angle),dy=Math.sin(angle);
   var tangent=(tunnelRand(fx)-.5)*speed;
   var life=.20+tunnelRand(fx)*.48+burst*.12;
   sparks.push({
    x:dx*radius,y:dy*radius*.8,
    vx:dx*speed-dy*tangent,
    vy:(dy*speed+dx*tangent)*.8,
    age:0,life:life,size:.7+tunnelRand(fx)*2+burst*1.4,
    hue:tunnelRand(fx)<.22?280:tunnelRand(fx)<.48?198:166
   });
  }
  if(sparks.length>(mobile?65:135)){
   sparks.splice(0,sparks.length-(mobile?65:135));
  }
 }else fx.credit=0;
 for(var k=sparks.length-1;k>=0;k--){
  var s=sparks[k];
  s.age+=dt;
  if(s.age>=s.life||!active){sparks.splice(k,1);continue;}
  var fade=1-s.age/s.life;
  var power=fade*fade*clamp(.38+exposure*.48+burst*.4,0,1.4);
  s.x+=s.vx*dt;s.y+=s.vy*dt;
  var trail=.08+burst*.055;
  ctx.beginPath();
  ctx.moveTo(s.x-s.vx*trail,s.y-s.vy*trail);
  ctx.lineTo(s.x,s.y);
  ctx.shadowColor="hsla("+s.hue+",100%,65%,1)";
  ctx.shadowBlur=mobile?11:23;
  ctx.strokeStyle="hsla("+s.hue+",100%,60%,"+
     clamp(power*.62,0,.85)+")";
  ctx.lineWidth=2.7+s.size*.75;ctx.stroke();
  ctx.shadowBlur=mobile?5:11;ctx.lineWidth=.7+s.size*.35;
  ctx.strokeStyle="rgba(240,255,252,"+clamp(power,0,.98)+")";ctx.stroke();
  ctx.shadowBlur=0;
  ctx.fillStyle="rgba(250,255,255,"+clamp(power*.85,0,1)+")";
  ctx.fillRect(s.x-s.size*.5,s.y-s.size*.5,s.size,s.size);
 }
 ctx.restore();
}
function hyper(ctx,w,h,m,r,dt){
 var scale=Math.max(w,h)*.47,cx=w/2,cy=h/2;
 var moving=r.velocity>.009,speed=moving?r.velocity:0;
 ctx.save();ctx.translate(cx+Math.sin(r.phase*.48)*r.mid*w*.023,
  cy+Math.cos(r.phase*.4)*r.bass*h*.023);
 beginBackground(ctx);
 var groups=[[],[],[]];
 for(var i=0;i<r.stars.length;i++){
  var s=r.stars[i];
  if(moving){
   s.z-=dt*(.18+speed*1.24);
   if(s.z<=.04)s.z=.94+i%9*.008;
  }
  var z=Math.max(.04,s.z),x=s.x*scale/z,y=s.y*scale/z;
  if(Math.abs(x)>w*.83||Math.abs(y)>h*.85)continue;
  var back=z+Math.max(.002,dt*speed*(6+r.hit*12+r.flash*8));
  var x1=s.x*scale/back,y1=s.y*scale/back;
  var intensity=clamp((1-z)*(.30+r.level*.75+r.high*.18)+r.hit*.21+r.flash*.18,.05,1);
  groups[s.hue].push([x1,y1,x,y,intensity,s.size]);
 }
 var palettes=[
  ["#20ffca","rgba(35,255,199,","rgba(224,255,242,"],
  ["#70c6ff","rgba(68,184,255,","rgba(224,244,255,"],
  ["#b786ff","rgba(139,86,255,","rgba(243,222,255,"]
 ];
 for(var g=0;g<3;g++){
  var parts=groups[g],color=palettes[g];
  if(!parts.length)continue;
  ctx.beginPath();
  for(var j=0;j<parts.length;j++){
   var p=parts[j];ctx.moveTo(p[0],p[1]);ctx.lineTo(p[2],p[3]);
  }
  var glow=clamp(.17+r.level*.35+r.hit*.34+r.flash*.25,.10,.92);
  ctx.shadowColor=color[0];ctx.shadowBlur=(mobile?16:38)+r.flash*18;
  ctx.lineWidth=5.2+r.hit*4.3+r.flash*2;ctx.strokeStyle=color[1]+glow+")";ctx.stroke();
  ctx.shadowBlur=mobile?8:17;ctx.lineWidth=2.2+r.high*1.2+r.flash*.7;
  ctx.strokeStyle=color[1]+clamp(glow*2.6,0,.98)+")";ctx.stroke();
  ctx.shadowBlur=mobile?2:5;ctx.lineWidth=.7+r.hit*.45;
  ctx.strokeStyle=color[2]+clamp(glow*2.8,0,.99)+")";ctx.stroke();
  ctx.shadowBlur=mobile?4:9;
  for(var j=0;j<parts.length;j++){
   var p=parts[j];if(p[4]<.14)continue;
   var size=p[5]*(.5+p[4]*1.4+r.hit*.8);
   ctx.fillStyle=color[2]+clamp(p[4]*(.48+r.level*.8+r.flash*.3),.08,1)+")";
   ctx.fillRect(p[2]-size*.5,p[3]-size*.5,size,size);
  }
 }
 var flare=12+r.bass*64+r.hit*85+r.flash*75;
 var nebula=ctx.createRadialGradient(0,0,0,0,0,flare);
 nebula.addColorStop(0,"rgba(221,255,248,"+clamp(.09+r.bass*.34+r.hit*.44+r.flash*.28,0,.98)+")");
 nebula.addColorStop(.32,"rgba(42,255,218,"+clamp(.025+r.hit*.12,0,.5)+")");
 nebula.addColorStop(1,"rgba(46,90,245,0)");
 ctx.shadowBlur=0;ctx.fillStyle=nebula;
 ctx.beginPath();ctx.arc(0,0,flare,0,TAU);ctx.fill();
 shock(ctx,r,Math.min(w,h)*.75,186);
 lightWash(ctx,w,h,r);
 ctx.restore();
}
window.ZebraVISReactive={create:create,update:update,tunnel:tunnel,hyper:hyper};
}());