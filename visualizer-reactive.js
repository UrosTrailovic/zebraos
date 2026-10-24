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
 for(var i=0;i<(mobile?110:230);i++){
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
 ctx.shadowBlur=mobile?6:12;
 ctx.strokeStyle="hsla("+hue+",100%,61%,"+(a*.23)+")";
 ctx.lineWidth=3+a*4;ctx.stroke();
 ctx.strokeStyle="hsla("+hue+",100%,80%,"+(a*.7)+")";
 ctx.lineWidth=1.3+a*1.4;ctx.stroke();
 ctx.shadowBlur=0;
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
/* Lower-cost phosphor: actual FFT-controlled geometry and velocity, but
 * never hundreds of blurred strokes or expensive whole-frame blur passes. */
function tunnel(ctx,w,h,m,r,dt){
 dt=clamp(Number(dt)||.032,.001,.06);
 if(!r.tunnelFx)r.tunnelFx={seed:0x4A13B63,sparks:[],credit:0};
 var fx=r.tunnelFx,active=!!r.playing;
 var energy=active?clamp(.52*r.level+.22*r.bass+.23*r.hit+.19*r.flash,0,1):0;
 var extent=Math.hypot(w,h)*.81,depth=r.depth*.39;
 var impact=clamp(r.bass*.6+r.hit*.7+r.flash*.35,0,1);
 var twist=r.phase*.31+r.mid*.3;
 ctx.save();
 ctx.translate(w*.5+Math.sin(r.phase*.91)*r.hit*w*.012,
               h*.5+Math.cos(r.phase*.73)*r.hit*h*.012);
 ctx.rotate((.05+r.mid*.07)*Math.sin(r.phase*.45));
 ctx.globalCompositeOperation="source-over";
 ctx.lineCap="round";ctx.lineJoin="round";
 for(var g=0,rails=mobile?8:12;g<rails;g++){
  var ang=g/rails*TAU+twist*.25;
  var band=m.levels[(g*4)%48]||0;
  var power=active?clamp(.15+energy*.3+band*.3,0,.62):.04;
  ctx.beginPath();
  ctx.moveTo(Math.cos(ang)*10,Math.sin(ang)*8);
  ctx.lineTo(Math.cos(ang)*extent,Math.sin(ang)*extent*.8);
  ctx.shadowColor=g%4===0?"#a269ed":"#42eeca";
  ctx.shadowBlur=mobile?2:4;ctx.lineWidth=.8+band*.6;
  ctx.strokeStyle=g%4===0?"rgba(126,82,225,"+power*.6+")":"rgba(43,202,176,"+power*.7+")";
  ctx.stroke();
 }
 for(var i=(mobile?14:20)-1,rings=mobile?14:20,points=mobile?34:48;i>=0;i--){
  var z=(i/rings+depth)%1;
  var radius=(8+Math.pow(z,1.72)*extent)*(1+r.bass*.23+impact*.12);
  var rotate=twist+z*(.33+r.mid*.32)+i*.007;
  ctx.beginPath();
  for(var j=0;j<=points;j++){
   var angle=j/points*TAU;
   var band=m.levels[(Math.floor(j/points*48)+i*3)%48]||0;
   var v=Math.sin(angle*6+rotate*2+i*.32)*(.023+r.mid*.075);
   var ripple=Math.cos(angle*11-r.phase*.72+i*.83)*(.008+r.high*.025);
   var shape=1+v+ripple+band*(.13+r.high*.12)+r.hit*.075;
   var a=angle+rotate+Math.sin(angle*3+i*.29)*r.mid*.03;
   if(!j)ctx.moveTo(Math.cos(a)*radius*shape,Math.sin(a)*radius*shape*.8);
   else ctx.lineTo(Math.cos(a)*radius*shape,Math.sin(a)*radius*shape*.8);
  }
  var hue=i%7===0?262:i%5===0?196:157+z*38;
  var alpha=active?clamp(.33+energy*.34+z*.09,.29,.78):.08;
  ctx.shadowColor="hsla("+hue+",100%,62%,1)";
  ctx.shadowBlur=mobile?4:9;ctx.lineWidth=2.6+z*1.45+impact*.8;
  ctx.strokeStyle="hsla("+hue+",98%,59%,"+alpha*.48+")";ctx.stroke();
  ctx.shadowBlur=mobile?2:4;ctx.lineWidth=.85+z*.56+impact*.28;
  ctx.strokeStyle="hsla("+hue+",94%,"+Math.round(69+energy*12)+"%,"+
   clamp(alpha*.92,0,.82)+")";ctx.stroke();
  var bin=m.levels[(i*7+29)%48]||0;
  if(i%3===0&&(bin+r.high+r.hit)>.55){
   var a=i*2.399963+twist*.25;
   var dot=1.3+bin*1.4+r.hit*.6;
   ctx.shadowBlur=0;ctx.fillStyle="rgba(154,255,218,"+
    clamp(.16+bin*.32+r.high*.18,0,.7)+")";
   ctx.fillRect(Math.cos(a)*radius-dot*.5,Math.sin(a)*radius*.8-dot*.5,dot,dot);
  }
 }
 ctx.shadowBlur=0;
 var flare=12+r.bass*54+r.hit*72;
 var grad=ctx.createRadialGradient(0,0,0,0,0,flare);
 grad.addColorStop(0,"rgba(108,239,203,"+(active?clamp(.03+r.bass*.11+r.hit*.18,0,.3):0)+")");
 grad.addColorStop(.45,"rgba(36,178,197,"+clamp(r.bass*.06+r.hit*.045,0,.13)+")");
 grad.addColorStop(1,"rgba(35,75,179,0)");
 ctx.fillStyle=grad;ctx.beginPath();ctx.arc(0,0,flare,0,TAU);ctx.fill();
 // Light, short-lived, audio-triggered flecks with strict caps.
 var sparks=fx.sparks;
 if(active){
  fx.credit=Math.min(4,fx.credit+dt*(r.high*43+r.hit*57+r.level*9));
  var emit=Math.min(mobile?2:3,Math.floor(fx.credit));
  fx.credit=Math.min(.99,fx.credit-emit);
  for(var n=0;n<emit;n++){
   var a=tunnelRand(fx)*TAU,rad=(.12+tunnelRand(fx)*.76)*extent;
   var speed=30+(.4+r.high*.65+r.hit*.55)*(45+tunnelRand(fx)*55);
   var dx=Math.cos(a),dy=Math.sin(a),side=(tunnelRand(fx)-.5)*speed;
   sparks.push({x:dx*rad,y:dy*rad*.8,vx:dx*speed-dy*side,
    vy:(dy*speed+dx*side)*.8,age:0,life:.17+tunnelRand(fx)*.35,
    hue:tunnelRand(fx)<.24?275:168});
  }
  var cap=mobile?14:28;
  if(sparks.length>cap)sparks.splice(0,sparks.length-cap);
 }else fx.credit=0;
 for(var k=sparks.length-1;k>=0;k--){
  var s=sparks[k];s.age+=dt;
  if(s.age>=s.life||!active){sparks.splice(k,1);continue;}
  s.x+=s.vx*dt;s.y+=s.vy*dt;
  var strength=(1-s.age/s.life)*clamp(.35+energy*.55,0,.86);
  ctx.beginPath();ctx.moveTo(s.x-s.vx*.07,s.y-s.vy*.07);
  ctx.lineTo(s.x,s.y);
  ctx.shadowBlur=mobile?2:5;ctx.shadowColor="hsla("+s.hue+",100%,65%,1)";
  ctx.strokeStyle="hsla("+s.hue+",100%,73%,"+strength+")";
  ctx.lineWidth=1+.6*r.hit;ctx.stroke();
 }
 ctx.restore();
}
function hyper(ctx,w,h,m,r,dt){
 var scale=Math.max(w,h)*.47,cx=w/2,cy=h/2;
 var moving=r.velocity>.009,speed=moving?r.velocity:0;
 ctx.save();ctx.translate(cx+Math.sin(r.phase*.48)*r.mid*w*.023,
  cy+Math.cos(r.phase*.4)*r.bass*h*.023);
 ctx.globalCompositeOperation="source-over";
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
  var glow=clamp(.12+r.level*.23+r.hit*.25+r.flash*.16,.09,.7);
  ctx.shadowColor=color[0];ctx.shadowBlur=(mobile?3:7)+r.flash*3;
  ctx.lineWidth=2.4+r.hit*1.65+r.flash*.7;ctx.strokeStyle=color[1]+clamp(glow*.84,0,.52)+")";ctx.stroke();
  ctx.shadowBlur=mobile?2:4;
  ctx.lineWidth=1+Math.min(1,r.high*.5+r.hit*.45);
  ctx.strokeStyle=color[1]+clamp(.29+glow*.7,0,.7)+")";ctx.stroke();
  ctx.shadowBlur=0;
  for(var j=0;j<parts.length;j++){
   var p=parts[j];if(p[4]<.14)continue;
   var size=p[5]*(.5+p[4]*1.4+r.hit*.8);
   ctx.fillStyle=color[2]+clamp(p[4]*(.40+r.level*.58+r.flash*.24),.08,.86)+")";
   ctx.fillRect(p[2]-size*.5,p[3]-size*.5,size,size);
  }
 }
 var flare=11+r.bass*54+r.hit*69+r.flash*67;
 var nebula=ctx.createRadialGradient(0,0,0,0,0,flare);
 nebula.addColorStop(0,"rgba(221,255,248,"+clamp(.06+r.bass*.26+r.hit*.34+r.flash*.27,0,.83)+")");
 nebula.addColorStop(.32,"rgba(42,255,218,"+clamp(.025+r.hit*.12,0,.5)+")");
 nebula.addColorStop(1,"rgba(46,90,245,0)");
 ctx.shadowBlur=0;ctx.fillStyle=nebula;
 ctx.beginPath();ctx.arc(0,0,flare,0,TAU);ctx.fill();
 shock(ctx,r,Math.min(w,h)*.62,186);
 ctx.restore();
}
window.ZebraVISReactive={create:create,update:update,tunnel:tunnel,hyper:hyper};
}());