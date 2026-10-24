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
function tunnel(ctx,w,h,m,r){
 var extent=Math.hypot(w,h)*.70;
 ctx.save();ctx.translate(w*.5,h*.5);
 ctx.rotate(Math.sin(r.phase*.43)*(.02+r.mid*.07));
 beginBackground(ctx);
 for(var j=0;j<16;j++){
  var a=j/16*TAU+r.phase*.13;
  var band=m.levels[(j*3)%48]||0;
  ctx.beginPath();ctx.moveTo(Math.cos(a)*8,Math.sin(a)*8);
  ctx.lineTo(Math.cos(a)*extent,Math.sin(a)*extent);
  ctx.strokeStyle="rgba(46,236,219,"+clamp(.035+r.high*.19+band*.53+r.flash*.16,0,.75)+")";
  ctx.lineWidth=.9+r.flash*.9;ctx.shadowColor="#28ffe3";ctx.shadowBlur=mobile?6:12;ctx.stroke();
 }
 var count=mobile?18:27,points=mobile?48:68;
 for(var i=count-1;i>=0;i--){
  var z=(i/count+r.depth*.21)%1,p=Math.pow(z,1.84);
  var radius=(9+p*extent)*(1+r.bass*.24+r.hit*.14+r.flash*.09);
  var twist=r.phase*.27+z*.33+r.mid*.46;
  ctx.beginPath();
  for(var k=0;k<=points;k++){
   var a=k/points*TAU;
   var band=m.levels[(Math.floor(k/points*48)+i*2)%48]||0;
   var shape=1+Math.cos(a*5+twist*2+i*.32)*(.025+r.mid*.085)+
     band*(.13+r.high*.16)+r.hit*.08;
   var angle=a+twist;
   var x=Math.cos(angle)*radius*shape,y=Math.sin(angle)*radius*shape*.81;
   if(!k)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  var hue=i%6===0?263:164+z*53+r.high*21;
  var glow=clamp((.17+r.level*.66+r.bass*.46+r.hit*.34+r.flash*.20)*(.26+z*.74),.04,1);
  ctx.shadowColor="hsla("+hue+",100%,62%,1)";
  ctx.shadowBlur=(mobile?13:28)+r.hit*24+r.flash*12;ctx.lineWidth=5.1+z*3.6+r.flash*2;
  ctx.strokeStyle="hsla("+hue+",100%,53%,"+(glow*.36)+")";ctx.stroke();
  ctx.shadowBlur=mobile?7:15;ctx.lineWidth=2.3+z*1.8+r.flash*.9;
  ctx.strokeStyle="hsla("+hue+",100%,68%,"+(glow*.85)+")";ctx.stroke();
  ctx.shadowBlur=mobile?2:5;ctx.lineWidth=.75+z*.7;
  ctx.strokeStyle="hsla("+hue+",100%,91%,"+(glow*.92)+")";ctx.stroke();
 }
 var flare=16+r.bass*105+r.hit*130+r.flash*70;
 var g=ctx.createRadialGradient(0,0,0,0,0,flare);
 g.addColorStop(0,"rgba(217,255,241,"+clamp(.07+r.bass*.55+r.hit*.48+r.flash*.22,0,.99)+")");
 g.addColorStop(.3,"rgba(37,255,198,"+clamp(.035+r.bass*.19,0,.5)+")");
 g.addColorStop(1,"rgba(52,85,255,0)");
 ctx.shadowBlur=0;ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,flare,0,TAU);ctx.fill();
 shock(ctx,r,extent*.88,165);
 lightWash(ctx,w,h,r);
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