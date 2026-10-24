/* ZebraVIS Reactor — three real-audio phosphor effects. Canvas 2D; no media graph. */
(function(){
"use strict";
var TAU=Math.PI*2;
var mobile=!!(window.matchMedia&&window.matchMedia("(pointer:coarse)").matches);
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function follow(v,t,dt,attack,release){return v+(t-v)*(1-Math.exp(-dt/(t>v?attack:release)));}
function makeStars(){
 var seed=0x5EED,arr=[];
 function random(){seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;}
 for(var i=0;i<(mobile?155:320);i++){
  var a=random()*TAU,r=Math.sqrt(random())*1.3;
  arr.push({x:Math.cos(a)*r,y:Math.sin(a)*r,z:.055+random()*.99,
    hue:Math.floor(random()*3),size:.6+random()*1.6});
 }
 return arr;
}
function create(){
 return{level:0,bass:0,mid:0,high:0,hit:0,velocity:0,
  prevBass:0,prevMid:0,prevLevel:0,
  bands:new Float32Array(48),phase:0,depth:0,
  pulseAge:2,pulsePower:0,stars:makeStars()};
}
function update(r,m,playing,dt){
 var flux=0;
 for(var k=0;k<48;k++){
  var val=m.levels[k]||0;flux+=Math.max(0,val-r.bands[k]);r.bands[k]=val;
 }
 flux/=48;
 var level=playing?clamp(m.level*1.7,0,1):0;
 var bass=playing?clamp(m.bass*1.9,0,1):0;
 var mid=playing?clamp(m.mids*1.9,0,1):0;
 var high=playing?clamp(m.treble*2,0,1):0;
 var attack=playing?clamp(flux*17+
   Math.max(0,bass-r.prevBass)*4+
   Math.max(0,mid-r.prevMid)*2.7+
   Math.max(0,level-r.prevLevel)*2.5,0,1):0;
 r.prevBass=bass;r.prevMid=mid;r.prevLevel=level;
 r.level=follow(r.level,level,dt,.025,.15);
 r.bass=follow(r.bass,bass,dt,.024,.17);
 r.mid=follow(r.mid,mid,dt,.028,.13);
 r.high=follow(r.high,high,dt,.018,.11);
 r.hit=Math.max(attack,r.hit*Math.exp(-dt/.18));
 r.pulseAge+=dt;
 if(playing&&attack>.17&&r.pulseAge>.17){r.pulseAge=0;r.pulsePower=clamp(.35+attack,0,1);}
 var speed=playing?.12+r.level*.9+r.bass*.9+r.hit*2.3:0;
 r.velocity=follow(r.velocity,speed,dt,.04,.11);
 if(playing){r.phase+=dt*(.09+r.mid*.4+r.bass*.8+r.hit*1.5);r.depth+=dt*r.velocity;}
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
function tunnel(ctx,w,h,m,r){
 var extent=Math.hypot(w,h)*.70;
 ctx.save();ctx.translate(w*.5,h*.5);
 ctx.rotate(Math.sin(r.phase*.43)*(.02+r.mid*.07));
 beginBackground(ctx);
 for(var j=0;j<12;j++){
  var a=j/12*TAU+r.phase*.12;
  var band=m.levels[(j*4)%48]||0;
  ctx.beginPath();ctx.moveTo(Math.cos(a)*8,Math.sin(a)*8);
  ctx.lineTo(Math.cos(a)*extent,Math.sin(a)*extent);
  ctx.strokeStyle="rgba(46,236,219,"+clamp(.03+r.high*.12+band*.35,0,.5)+")";
  ctx.lineWidth=.8;ctx.shadowColor="#28ffe3";ctx.shadowBlur=mobile?3:7;ctx.stroke();
 }
 var count=mobile?14:22,points=mobile?42:64;
 for(var i=count-1;i>=0;i--){
  var z=(i/count+r.depth*.21)%1,p=Math.pow(z,1.84);
  var radius=(9+p*extent)*(1+r.bass*.14+r.hit*.075);
  var twist=r.phase*.27+z*.33+r.mid*.46;
  ctx.beginPath();
  for(var k=0;k<=points;k++){
   var a=k/points*TAU;
   var band=m.levels[(Math.floor(k/points*48)+i*2)%48]||0;
   var shape=1+Math.cos(a*5+twist*2+i*.32)*(.025+r.mid*.05)+
     band*(.08+r.high*.11)+r.hit*.045;
   var angle=a+twist;
   var x=Math.cos(angle)*radius*shape,y=Math.sin(angle)*radius*shape*.81;
   if(!k)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  var hue=i%6===0?263:164+z*53+r.high*21;
  var glow=clamp((.15+r.level*.54+r.bass*.32+r.hit*.25)*(.26+z*.74),.04,1);
  ctx.shadowColor="hsla("+hue+",100%,62%,1)";
  ctx.shadowBlur=(mobile?9:20)+r.hit*13;ctx.lineWidth=4+z*3;
  ctx.strokeStyle="hsla("+hue+",100%,53%,"+(glow*.36)+")";ctx.stroke();
  ctx.shadowBlur=mobile?4:10;ctx.lineWidth=1.8+z*1.6;
  ctx.strokeStyle="hsla("+hue+",100%,68%,"+(glow*.85)+")";ctx.stroke();
  ctx.shadowBlur=mobile?2:5;ctx.lineWidth=.75+z*.7;
  ctx.strokeStyle="hsla("+hue+",100%,91%,"+(glow*.92)+")";ctx.stroke();
 }
 var flare=12+r.bass*75+r.hit*100;
 var g=ctx.createRadialGradient(0,0,0,0,0,flare);
 g.addColorStop(0,"rgba(217,255,241,"+clamp(.07+r.bass*.48+r.hit*.37,0,.95)+")");
 g.addColorStop(.3,"rgba(37,255,198,"+clamp(.035+r.bass*.19,0,.5)+")");
 g.addColorStop(1,"rgba(52,85,255,0)");
 ctx.shadowBlur=0;ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,flare,0,TAU);ctx.fill();
 shock(ctx,r,extent*.70,165);
 ctx.restore();
}
function kaleido(ctx,w,h,m,r){
 var outer=Math.hypot(w,h)*.65,sectorCount=12,slice=TAU/sectorCount;
 var layers=mobile?5:7,colors=[178,194,246,284,313,194,171];
 var amount=clamp(.1+r.level*.62+r.mid*.3,0,1);
 ctx.save();ctx.translate(w/2,h/2);ctx.rotate(r.phase*.17);
 beginBackground(ctx);
 for(var sector=0;sector<sectorCount;sector++){
  ctx.save();ctx.rotate(sector*slice);
  if(sector%2){ctx.rotate(slice);ctx.scale(1,-1);}
  ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,outer,0,slice);ctx.closePath();ctx.clip();
  for(var j=0;j<layers;j++){
   var band=m.levels[Math.min(47,j*6+4)]||0;
   var other=m.levels[Math.min(47,j*6+13)]||0;
   var inner=outer*(.09+j*.125);
   var tip=outer*(.22+j*.135)*(1+r.bass*.17+band*.23+r.hit*.08);
   var a=slice*(.17+r.mid*.06+other*.1);
   var b=slice*(.83-r.mid*.06-other*.1);
   var mid=slice*(.5+Math.sin(r.phase*.7+j*.85)*.06*r.level);
   var hue=colors[j]+r.high*20;
   var strength=clamp(amount*(.57+band*.6)+r.hit*.21,.05,1);
   // Hard-edged jewel silhouettes; no elliptical or blobby geometry.
   ctx.beginPath();
   ctx.moveTo(Math.cos(a)*inner,Math.sin(a)*inner);
   ctx.lineTo(Math.cos(mid)*tip,Math.sin(mid)*tip);
   ctx.lineTo(Math.cos(b)*inner,Math.sin(b)*inner);
   ctx.lineTo(Math.cos(mid)*inner*.58,Math.sin(mid)*inner*.58);
   ctx.closePath();
   ctx.fillStyle="hsla("+hue+",98%,"+(29+band*26)+"%,"+(strength*.22)+")";ctx.fill();
   ctx.shadowColor="hsla("+hue+",100%,65%,1)";
   ctx.shadowBlur=mobile?8:18;ctx.lineWidth=3.6+band*3;
   ctx.strokeStyle="hsla("+hue+",100%,61%,"+(strength*.3)+")";ctx.stroke();
   ctx.shadowBlur=mobile?4:8;ctx.lineWidth=1+band*1.2;
   ctx.strokeStyle="hsla("+hue+",98%,85%,"+(strength*.9)+")";ctx.stroke();
   // Crossed light fibres create sharp mirrored crystalline rosettes.
   ctx.beginPath();
   ctx.moveTo(Math.cos(a)*inner*.75,Math.sin(a)*inner*.75);
   ctx.lineTo(Math.cos(b)*tip*.92,Math.sin(b)*tip*.92);
   ctx.lineTo(Math.cos(a)*tip*.74,Math.sin(a)*tip*.74);
   ctx.shadowColor="#d3f6ff";ctx.shadowBlur=mobile?3:7;
   ctx.strokeStyle="hsla("+((hue+58)%360)+",100%,79%,"+(strength*.67)+")";
   ctx.lineWidth=.7+other;ctx.stroke();
   var sparkle=r.high*.7+band*.5+r.hit*.4;
   if(sparkle>.1){
    var dx=Math.cos(mid)*tip,dy=Math.sin(mid)*tip;
    ctx.shadowColor="#f5ffff";ctx.shadowBlur=mobile?4:10;
    ctx.fillStyle="rgba(225,255,249,"+clamp(sparkle*.75,0,.95)+")";
    ctx.fillRect(dx-1,dy-1,2+sparkle*2,2+sparkle*2);
   }
  }
  ctx.restore();
 }
 // Central star breathes to bass and blooms on drum attacks.
 var core=12+r.bass*24+r.hit*30;
 ctx.beginPath();
 for(var q=0;q<24;q++){
  var th=q/24*TAU,rr=core*(q%2?.42:1);
  if(!q)ctx.moveTo(Math.cos(th)*rr,Math.sin(th)*rr);
  else ctx.lineTo(Math.cos(th)*rr,Math.sin(th)*rr);
 }
 ctx.closePath();
 ctx.fillStyle="rgba(32,255,222,"+clamp(.08+r.bass*.23+r.hit*.24,0,.75)+")";ctx.fill();
 ctx.shadowColor="#aaffdf";ctx.shadowBlur=mobile?11:25;
 ctx.strokeStyle="rgba(219,255,248,"+clamp(.25+r.level*.65,0,1)+")";
 ctx.lineWidth=1.5+r.hit*1.7;ctx.stroke();
 shock(ctx,r,outer*.52,300);
 ctx.restore();
}
function hyper(ctx,w,h,m,r,dt){
 var scale=Math.max(w,h)*.43,cx=w/2,cy=h/2;
 var moving=r.velocity>.009,speed=moving?r.velocity:0;
 ctx.save();ctx.translate(cx+Math.sin(r.phase*.48)*r.mid*w*.023,
  cy+Math.cos(r.phase*.4)*r.bass*h*.023);
 beginBackground(ctx);
 var groups=[[],[],[]];
 for(var i=0;i<r.stars.length;i++){
  var s=r.stars[i];
  if(moving){
   s.z-=dt*(.13+speed*1.16);
   if(s.z<=.04)s.z=.94+i%9*.008;
  }
  var z=Math.max(.04,s.z),x=s.x*scale/z,y=s.y*scale/z;
  if(Math.abs(x)>w*.83||Math.abs(y)>h*.85)continue;
  var back=z+Math.max(.002,dt*speed*(4+r.hit*7));
  var x1=s.x*scale/back,y1=s.y*scale/back;
  var intensity=clamp((1-z)*(.26+r.level*.66+r.high*.12)+r.hit*.17,.05,1);
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
  var glow=clamp(.12+r.level*.22+r.hit*.26,.09,.7);
  ctx.shadowColor=color[0];ctx.shadowBlur=mobile?12:28;
  ctx.lineWidth=4+r.hit*3.3;ctx.strokeStyle=color[1]+glow+")";ctx.stroke();
  ctx.shadowBlur=mobile?5:13;ctx.lineWidth=1.8+r.high;
  ctx.strokeStyle=color[1]+clamp(glow*2.6,0,.98)+")";ctx.stroke();
  ctx.shadowBlur=mobile?2:5;ctx.lineWidth=.7+r.hit*.45;
  ctx.strokeStyle=color[2]+clamp(glow*2.8,0,.99)+")";ctx.stroke();
  ctx.shadowBlur=mobile?4:9;
  for(var j=0;j<parts.length;j++){
   var p=parts[j];if(p[4]<.14)continue;
   var size=p[5]*(.5+p[4]*1.4+r.hit*.8);
   ctx.fillStyle=color[2]+clamp(p[4]*(.38+r.level*.65),.08,.96)+")";
   ctx.fillRect(p[2]-size*.5,p[3]-size*.5,size,size);
  }
 }
 var flare=10+r.bass*40+r.hit*60;
 var nebula=ctx.createRadialGradient(0,0,0,0,0,flare);
 nebula.addColorStop(0,"rgba(221,255,248,"+clamp(.07+r.bass*.25+r.hit*.35,0,.8)+")");
 nebula.addColorStop(.32,"rgba(42,255,218,"+clamp(.025+r.hit*.12,0,.5)+")");
 nebula.addColorStop(1,"rgba(46,90,245,0)");
 ctx.shadowBlur=0;ctx.fillStyle=nebula;
 ctx.beginPath();ctx.arc(0,0,flare,0,TAU);ctx.fill();
 shock(ctx,r,Math.min(w,h)*.62,186);
 ctx.restore();
}
window.ZebraVISReactive={create:create,update:update,tunnel:tunnel,kaleido:kaleido,hyper:hyper};
}());