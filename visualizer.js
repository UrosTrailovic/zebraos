/* ZebraVIS 1.0 — audio-reactive visuals for ZebraAMP.
   Web Audio API analyser + Canvas 2D. No external dependencies or WebGL requirement.
   Presets: Spectrum 2000, Phosphor Scope, Neon Tunnel, Kaleido Reactor, Hyperdrive.
   Animation is based on real audio data; silent sources show NO SIGNAL. */
(function(){
"use strict";
var presets=[
  ["SPECTRE 2000","Barres lumineuses"],
  ["OSCILLOSCOPE","Courbe analogique verte"],
  ["TUNNEL NÉON","Tunnels réactifs aux basses"],
  ["KALÉIDOSCOPE","Géométrie néon symétrique"],
  ["HYPERVITESSE","Étoiles synchronisées au son"]
];
var audioContext=null,audioNode=null,analyser=null,mediaRef=null,active=null;
var spectrum=new Uint8Array(1024),wave=new Uint8Array(2048),lowPower=window.matchMedia?matchMedia("(pointer:coarse)").matches:false;
wave.fill(128);
var TAU=Math.PI*2;
function element(tag,cls,text){
  var n=document.createElement(tag);
  if(cls)n.className=cls;
  if(text!==undefined)n.textContent=text;
  return n;
}
function rounded(v,min,max){return Math.max(min,Math.min(max,v));}
function connect(media, externalAnalyser){
  if(!media)return false;
  if(externalAnalyser){
    analyser=externalAnalyser;
    spectrum=new Uint8Array(analyser.frequencyBinCount);
    wave=new Uint8Array(analyser.fftSize);
    mediaRef=media;
    return true;
  }
  var Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)return false;
  try{
    if(!audioContext)audioContext=new Ctx();
    if(!analyser){
      analyser=audioContext.createAnalyser();
      analyser.fftSize=2048;
      analyser.smoothingTimeConstant=0.78;
      spectrum=new Uint8Array(analyser.frequencyBinCount);
      wave=new Uint8Array(analyser.fftSize);
    }
    if(mediaRef!==media){
      // One MediaElementSourceNode per audio element, shared between all presets.
      if(audioNode)throw new Error("A different audio element is already connected");
      audioNode=audioContext.createMediaElementSource(media);
      audioNode.connect(analyser);
      analyser.connect(audioContext.destination);
      mediaRef=media;
    }
    if(audioContext.state==="suspended"){
      var promise=audioContext.resume();
      if(promise&&promise.catch)promise.catch(function(){});
    }
    return true;
  }catch(e){return false;}
}
function readMode(){
  try{return rounded(Number(localStorage.getItem("zebra.viz.preset"))||0,0,presets.length-1);}catch(e){return 0;}
}
function saveMode(mode){
  try{localStorage.setItem("zebra.viz.preset",String(mode));}catch(e){}
}
function energy(arr,from,to){
  if(!arr)return 0;
  var sum=0,count=0;
  for(var i=from;i<Math.min(to,arr.length);i++){sum+=arr[i];count++;}
  return count?sum/(count*255):0;
}
function circle(ctx,x,y,r){
  ctx.beginPath();ctx.arc(x,y,Math.max(0.1,r),0,TAU);
}
function backdrop(ctx,w,h){
  ctx.fillStyle="#03060b";ctx.fillRect(0,0,w,h);
  var grd=ctx.createRadialGradient(w/2,h/2,10,w/2,h/2,Math.max(w,h)*0.68);
  grd.addColorStop(0,"rgba(25,43,62,.48)");
  grd.addColorStop(1,"rgba(1,3,8,0)");
  ctx.fillStyle=grd;ctx.fillRect(0,0,w,h);
}
function grid(ctx,w,h,space,color){
  ctx.strokeStyle=color;ctx.lineWidth=.6;
  ctx.beginPath();
  for(var x=0;x<w;x+=space){ctx.moveTo(x,0);ctx.lineTo(x,h);}
  for(var y=0;y<h;y+=space){ctx.moveTo(0,y);ctx.lineTo(w,y);}
  ctx.stroke();
}
function drawSpectrum(ctx,w,h,bass,mids,time){
  grid(ctx,w,h,35,"rgba(45,126,129,.13)");
  var bars=lowPower?36:56,margin=w*.06,barGap=3;
  var bw=Math.max(2,(w-margin*2)/bars-barGap),floor=h*.82;
  ctx.shadowBlur=8;ctx.shadowColor="rgba(94,255,212,.6)";
  for(var i=0;i<bars;i++){
    var idx=Math.floor(Math.pow(i/bars,1.65)*Math.min(600,spectrum.length-1));
    var val=(spectrum[idx]||0)/255;
    var height=Math.max(2,val*(h*.66));
    var x=margin+i*((w-margin*2)/bars);
    ctx.fillStyle="hsl("+(166+i/bars*90)+",95%,"+(43+val*27)+"%)";
    ctx.fillRect(x,floor-height,bw,height);
    ctx.fillStyle="rgba(180,255,236,.75)";
    ctx.fillRect(x,floor-height-5,bw,2);
    ctx.fillStyle="rgba(33,130,109,.12)";
    ctx.fillRect(x,floor+4,bw,height*.17);
  }
  ctx.shadowBlur=0;
  ctx.strokeStyle="rgba(149,255,225,.72)";
  ctx.beginPath();ctx.moveTo(margin,floor);ctx.lineTo(w-margin,floor);ctx.stroke();
  ctx.textAlign="left";ctx.fillStyle="#6d9f9a";ctx.font="11px monospace";
  ctx.fillText("CH 01 / FREQ RESPONSE",margin,30);
  ctx.fillText("BASS "+Math.round(bass*100)+"%  MID "+Math.round(mids*100)+"%",margin,h-19);
}
function drawScope(ctx,w,h,bass,mids,time){
  var cy=h/2;
  grid(ctx,w,h,25,"rgba(38,187,100,.16)");
  ctx.strokeStyle="rgba(71,201,131,.45)";
  ctx.beginPath();ctx.moveTo(0,cy);ctx.lineTo(w,cy);ctx.stroke();
  ctx.shadowColor="#49ef9b";ctx.shadowBlur=lowPower?5:14;
  for(var layer=0;layer<3;layer++){
    ctx.beginPath();
    ctx.strokeStyle=layer===0?"rgba(39,165,104,.18)":layer===1?"rgba(56,226,140,.45)":"rgba(177,255,202,.94)";
    ctx.lineWidth=layer===0?7:layer===1?3:1.4;
    var n=Math.min(512,wave.length);
    for(var i=0;i<n;i++){
      var val=(wave[i]/128-1);
      var x=(i/(n-1))*w,y=cy+val*h*.38;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  ctx.shadowBlur=0;
  ctx.fillStyle="#82cfaa";ctx.font="11px monospace";
  ctx.fillText("OSCILLOSCOPE  /  CH A",17,27);
  ctx.fillText("STEREO  •  "+Math.round(bass*100)+" dB",17,h-17);
}
function drawTunnel(ctx,w,h,bass,mids,treble,time){
  var cx=w/2,cy=h/2;
  var rings=20;
  ctx.save();ctx.translate(cx,cy);
  for(var n=rings;n>=1;n--){
    var phase=(n/rings+time*.000085*(1+bass*4))%1;
    var radius=(phase*phase)*Math.min(w,h)*.98+4;
    var points=8;
    ctx.beginPath();
    for(var j=0;j<=points;j++){
      var angle=j/points*TAU+time*.00022*(n%2?1:-1)+n*.1;
      var r=radius*(1+.07*mids*Math.sin(j*3+time*.003));
      var x=Math.cos(angle)*r,y=Math.sin(angle)*r;
      if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.strokeStyle="hsla("+(190+n*11+time*.006)%360+",100%,"+(50+bass*20)+"%,"+rounded((1-phase)*.85,.05,.9)+")";
    ctx.lineWidth=1.2+bass*3;
    ctx.shadowBlur=lowPower?4:10;ctx.shadowColor="#b33eff";ctx.stroke();
  }
  var center=ctx.createRadialGradient(0,0,0,0,0,80+bass*80);
  center.addColorStop(0,"rgba(255,255,255,.55)");
  center.addColorStop(.18,"rgba(210,56,255,.2)");
  center.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=center;circle(ctx,0,0,75+bass*80);ctx.fill();
  ctx.restore();ctx.shadowBlur=0;
}
function drawKaleido(ctx,w,h,bass,mids,treble,time){
  var petals=lowPower?8:12;
  var radius=Math.min(w,h)*.45;
  ctx.save();ctx.translate(w/2,h/2);
  for(var i=0;i<petals;i++){
    var angle=i/petals*TAU+(time*.00012);
    ctx.save();ctx.rotate(angle);
    for(var j=0;j<7;j++){
      var r=18+j*(radius/8),v=(spectrum[Math.min(spectrum.length-1,j*12+i*4)]||0)/255;
      var span=Math.PI/petals*(1.2+v);
      var x=r*(1+v*.4);
      ctx.beginPath();ctx.moveTo(0,0);
      ctx.lineTo(Math.cos(span)*x,Math.sin(span)*x);
      ctx.lineTo(Math.cos(-span)*x,Math.sin(-span)*x);
      ctx.closePath();
      ctx.strokeStyle="hsla("+((i*23+j*18+time*.018)%360)+",100%,65%,"+(.28+v*.55)+")";
      ctx.lineWidth=1+v*2.2;ctx.stroke();
      if(j%2===0){ctx.fillStyle="hsla("+((j*55+i*8+time*.011)%360)+",95%,45%,"+(.018+v*.12)+")";ctx.fill();}
    }
    ctx.restore();
  }
  ctx.shadowColor="#d978fc";ctx.shadowBlur=lowPower?6:16;
  ctx.strokeStyle="rgba(244,180,255,.7)";
  ctx.lineWidth=2;
  circle(ctx,0,0,16+bass*45);ctx.stroke();
  ctx.restore();ctx.shadowBlur=0;
}
function makeStars(){
  var particles=[];
  var seed=261;
  function random(){seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;}
  for(var i=0;i<(lowPower?100:190);i++)particles.push({x:random()*2-1,y:random()*2-1,z:.08+random()*.95,hue:180+random()*130});
  return particles;
}
function drawHyperdrive(ctx,w,h,bass,mids,treble,time,dt,stars){
  var cx=w/2,cy=h/2,scale=Math.min(w,h)*.34,rate=(.0019+bass*.008)*dt;
  for(var i=0;i<stars.length;i++){
    var s=stars[i];s.z-=rate;
    if(s.z<.035){s.z=.9;s.x=(Math.sin(i*13.91+time*.00003));s.y=(Math.cos(i*19.57+time*.00005));}
    var z=Math.max(.03,s.z),x=cx+s.x*scale/z,y=cy+s.y*scale/z;
    var x2=cx+s.x*scale/Math.min(.98,z+rate*8),y2=cy+s.y*scale/Math.min(.98,z+rate*8);
    ctx.strokeStyle="hsla("+s.hue+",100%,"+(65+treble*25)+"%,"+Math.min(.95,.27+.6*(1-z))+")";
    ctx.lineWidth=rounded((1-z)*2.9, .7, 3.4);
    ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x,y);ctx.stroke();
  }
  ctx.strokeStyle="rgba(116,199,255,.34)";
  ctx.beginPath();ctx.ellipse(cx,cy,Math.min(w,h)*(.08+bass*.045),Math.min(w,h)*(.08+bass*.045),0,0,TAU);ctx.stroke();
  ctx.fillStyle="#a8d8ef";ctx.font="11px monospace";ctx.fillText("VECTOR WARP // "+Math.round(bass*100)+"%",16,26);
}
function mount(host,media,options){
  if(!host)return;
  if(active&&active.stop)active.stop();
  var state={stopped:false,request:0};
  active=state;
  host.innerHTML="";
  var shell=element("div","zviz");
  var heading=element("div","zviz-top");
  var branding=element("div","zviz-brand","ZEBRAVIS 1.0");
  var led=element("span","zviz-led","● SIGNAL AUDIO");
  heading.appendChild(branding);heading.appendChild(led);shell.appendChild(heading);
  var stage=element("div","zviz-stage");
  var canvas=element("canvas","zviz-canvas");
  canvas.setAttribute("aria-label","Visualisation audio animée de ZebraAMP");
  stage.appendChild(canvas);
  var overlay=element("div","zviz-overlay");
  overlay.appendChild(element("span","zviz-no-signal","AUCUN SIGNAL — LANCE UN MORCEAU DANS ZEBRAAMP"));
  stage.appendChild(overlay);
  shell.appendChild(stage);
  var bar=element("div","zviz-controls");
  var back=element("button","zviz-step","◀");
  var next=element("button","zviz-step","▶");
  var modeText=element("div","zviz-mode-name");
  var autoButton=element("button","zviz-auto","AUTO : NON");
  var fullButton=element("button","zviz-fullscreen","⛶");
  var mode=readMode(),auto=false,lastSwitch=0,lastFrame=0,stars=makeStars();
  var ctx=canvas.getContext("2d",{alpha:false});
  if(!ctx){host.appendChild(element("p","github-drive-error","Canvas 2D non disponible sur ce navigateur."));return;}
  function updatePreset(){
    modeText.textContent=(mode+1)+"/"+presets.length+"  "+presets[mode][0];
    back.title="Mode précédent";next.title="Mode suivant";
    saveMode(mode);
    lastSwitch=performance.now();
  }
  back.onclick=function(){mode=(mode+presets.length-1)%presets.length;updatePreset();};
  next.onclick=function(){mode=(mode+1)%presets.length;updatePreset();};
  autoButton.onclick=function(){auto=!auto;autoButton.textContent=auto?"AUTO: ON":"AUTO : NON";lastSwitch=performance.now();};
  fullButton.title="Plein écran";
  fullButton.onclick=function(){
    if(stage.requestFullscreen){var p=stage.requestFullscreen();if(p&&p.catch)p.catch(function(){});}
  };
  bar.appendChild(back);bar.appendChild(modeText);bar.appendChild(next);bar.appendChild(autoButton);bar.appendChild(fullButton);
  shell.appendChild(bar);
  var footer=element("div","zviz-footer");
  var hint=element("span","","EFFETS RÉACTIFS AU SON / CANVAS 2D");
  var connectButton=element("button","zviz-connect","LIER AUDIO");
  footer.appendChild(hint);footer.appendChild(connectButton);shell.appendChild(footer);
  host.appendChild(shell);
  function connectNow(){
    var ok=connect(media,options&&options.analyser);
    connectButton.textContent=ok?"AUDIO LIÉ":"RÉESSAYER";
    led.classList.toggle("on",ok);
    if(ok&&audioContext)requestAnimationFrame(function(){if(audioContext&&audioContext.state==="suspended")audioContext.resume().catch(function(){});});
    return ok;
  }
  connectButton.onclick=connectNow;
  var linked=connectNow();
  updatePreset();
  var startX=0;
  canvas.addEventListener("touchstart",function(e){if(e.touches.length)startX=e.touches[0].clientX;},{passive:true});
  canvas.addEventListener("touchend",function(e){if(e.changedTouches.length){var dx=e.changedTouches[0].clientX-startX;if(Math.abs(dx)>55){mode=(mode+(dx>0?-1:1)+presets.length)%presets.length;updatePreset();}}},{passive:true});
  var dpr=0,w=0,h=0;
  var signal=false;
  function frame(t){
    if(state.stopped||!shell.isConnected){state.stopped=true;return;}
    state.request=requestAnimationFrame(frame);
    if(document.hidden||shell.closest(".window")?.classList.contains("minimized"))return;
    var step=lowPower?36:18;
    if(t-lastFrame<step)return;
    var dt=rounded(t-lastFrame,1,50);lastFrame=t;
    var box=stage.getBoundingClientRect();
    var cw=Math.max(160,Math.round(box.width)),ch=Math.max(160,Math.round(box.height));
    var pix=Math.min(window.devicePixelRatio||1,lowPower?1.25:1.6);
    if(w!==cw||h!==ch||dpr!==pix){
      w=cw;h=ch;dpr=pix;
      canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    ctx.clearRect(0,0,w,h);
    backdrop(ctx,w,h);
    if(linked&&analyser){
      analyser.getByteFrequencyData(spectrum);
      analyser.getByteTimeDomainData(wave);
    }
    var bass=linked?energy(spectrum,1,20):0;
    var mids=linked?energy(spectrum,20,170):0;
    var treble=linked?energy(spectrum,170,500):0;
    var sounding=linked&&!media.paused&&!media.ended&&(bass+mids+treble>.014);
    overlay.style.opacity=sounding?"0":"1";
    led.classList.toggle("pulsing",sounding);
    if(auto&&t-lastSwitch>12000){mode=(mode+1)%presets.length;updatePreset();}
    if(mode===0)drawSpectrum(ctx,w,h,bass,mids,t);
    else if(mode===1)drawScope(ctx,w,h,bass,mids,t);
    else if(mode===2)drawTunnel(ctx,w,h,bass,mids,treble,t);
    else if(mode===3)drawKaleido(ctx,w,h,bass,mids,treble,t);
    else drawHyperdrive(ctx,w,h,bass,mids,treble,t,dt,stars);
  }
  state.stop=function(){state.stopped=true;if(state.request)cancelAnimationFrame(state.request);};
  state.request=requestAnimationFrame(frame);
}
window.ZebraVisualizer={mount:mount,presets:presets};
}());