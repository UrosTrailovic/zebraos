/* ZebraVIS 2.0 — audio-reactive visuals for ZebraAMP.
   Web Audio API analyser + Canvas 2D. No external dependencies or WebGL requirement.
   Presets: Spectrum 2000, Phosphor Scope, Neon Tunnel, Kaleido Reactor, Hyperdrive.
   Animation is based on real audio data; silent sources show NO SIGNAL. */
(function(){
"use strict";
var presets=[
  ["SPECTRE 2000","Analyseur à bandes logarithmiques"],
  ["OSCILLOSCOPE","Courbe analogique verte"],
  ["TUNNEL NÉON","Tunnels réactifs aux basses"],
  ["HYPERVITESSE","Traînées phosphorescentes synchronisées au son"]
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
  try{var saved=localStorage.getItem("zebra.viz.preset.v2");
    if(saved!==null)return rounded(Number(saved)||0,0,presets.length-1);
    var old=Number(localStorage.getItem("zebra.viz.preset"));
    return old===4?3:old===3?2:rounded(old||0,0,presets.length-1);}catch(e){return 0;}
}
function saveMode(mode){
  try{localStorage.setItem("zebra.viz.preset.v2",String(mode));}catch(e){}
}
/* Temporary tuning desk for the two experimental visualizers.
 * Defaults are the approved current look (100%). Persistence is per browser,
 * independent of ZebraOS user sessions. No audio graph is modified. */
var VIZ_TUNE_KEY="zebra.viz.tuning.v1";
var VIZ_TUNE_SPECS={
  2:[
    ["speed","Vitesse du tunnel",0,230,5],
    ["kick","Punch des kicks",0,250,5],
    ["snare","Réaction aux snares",0,250,5],
    ["high","Réaction aux aigus",0,250,5],
    ["warp","Déformation des anneaux",0,220,5],
    ["idle","Lumière en passage calme",0,200,5],
    ["flash","Éclaircissement sur les kicks",0,240,5],
    ["glow","Intensité du phosphore",0,180,5],
    ["line","Épaisseur des lignes",30,200,5],
    ["crt","Effet CRT",0,100,5]
  ],
  3:[
    ["speed","Vitesse des étoiles",0,240,5],
    ["kick","Accélération sur les kicks",0,240,5],
    ["high","Réaction aux aigus",0,250,5],
    ["trails","Longueur des traînées",0,220,5],
    ["density","Densité des étoiles",20,100,5],
    ["idle","Lumière en passage calme",0,200,5],
    ["glow","Intensité du phosphore",0,180,5],
    ["line","Épaisseur des traînées",30,180,5],
    ["crt","Effet CRT",0,100,5]
  ]
};
function defaultVizTuning(){
  var saved={2:{},3:{}};
  [2,3].forEach(function(mode){
    VIZ_TUNE_SPECS[mode].forEach(function(spec){saved[mode][spec[0]]=100;});
  });
  return saved;
}
function loadVizTuning(){
  var values=defaultVizTuning(),saved=null;
  try{saved=JSON.parse(localStorage.getItem(VIZ_TUNE_KEY)||"null");}catch(e){}
  if(!saved||typeof saved!=="object")return values;
  [2,3].forEach(function(mode){
    VIZ_TUNE_SPECS[mode].forEach(function(spec){
      var val=Number(saved[mode]&&saved[mode][spec[0]]);
      if(Number.isFinite(val))values[mode][spec[0]]=rounded(val,spec[2],spec[3]);
    });
  });
  return values;
}
function saveVizTuning(values){
  try{localStorage.setItem(VIZ_TUNE_KEY,JSON.stringify(values));}catch(e){}
}
function vizGain(tune,key){
  return tune&&typeof tune[key]==="number"?rounded(tune[key],0,300)/100:1;
}
function shareVizTuning(values){
  var lines=["ZebraVIS — ma configuration de test",""];
  [2,3].forEach(function(mode){
    lines.push(presets[mode][0]);
    VIZ_TUNE_SPECS[mode].forEach(function(spec){
      lines.push(spec[1]+" : "+values[mode][spec[0]]+" %");
    });
    lines.push("");
  });
  return lines.join("\n").trim();
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
// Average energy across frequency BANDS, not isolated FFT bins. Limit the
// display to useful musical frequencies; compensate gently for spectral tilt.
// Do not change the shared analyser: Phosphor Scope keeps its original signal.
function sampleBands(data,node,count,out){
  out=out||new Float32Array(count);
  var nyquist=(node.context?node.context.sampleRate:44100)/2;
  var top=Math.min(14000,nyquist*.9),bottom=75;
  var minDb=Number.isFinite(node.minDecibels)?node.minDecibels:-100;
  var maxDb=Number.isFinite(node.maxDecibels)?node.maxDecibels:-30;
  for(var i=0;i<count;i++){
    var lo=bottom*Math.pow(top/bottom,i/count);
    var hi=bottom*Math.pow(top/bottom,(i+1)/count);
    var start=Math.max(1,Math.floor(lo/nyquist*data.length));
    var end=Math.min(data.length,Math.max(start+1,Math.ceil(hi/nyquist*data.length)));
    var power=0,n=0;
    for(var j=start;j<end;j++){
      var byte=data[j];
      if(byte>0)power+=Math.pow(10,(minDb+byte/255*(maxDb-minDb))/10);
      n++;
    }
    var db=power>0?10*Math.log10(power/Math.max(1,n)):-150;
    var center=Math.sqrt(lo*hi);
    var tilt=rounded(Math.log2(center/150)*2.1,0,9);
    var raw=rounded((db+tilt+76)/54,0,1);
    // Les graves transportent beaucoup plus d'énergie : garder du headroom
    // évite les premières bandes collées au plafond tout en laissant les kicks taper.
    var headroom=center<140 ? .78 : center<300 ? .86 : center<650 ? .92 : .96;
    var shaped=raw/(1+.34*raw);
    out[i]=rounded(shaped*1.18*headroom,0,headroom);
  }
  return out;
}
function follow(value,target,dt,attack,release){
  return value+(target-value)*(1-Math.exp(-dt/(target>value?attack:release)));
}
function makeMotion(){
  return {bands:new Float32Array(48),levels:new Float32Array(48),
    peaks:new Float32Array(48),holds:new Float32Array(48),clock:0,tunnelClock:0,
    bass:0,mids:0,treble:0,level:0,hit:0,previousBass:0,bed:0,
    fx:{kickFast:0,kickSlow:0,snareFast:0,snareSlow:0,highFast:0,highSlow:0,
        kickPrev:0,snarePrev:0,highPrev:0,kick:0,snare:0,rise:0,air:0,velocity:0}};
}
function readMotion(m,node,playing,dt){
  var rms=0;
  for(var i=0;i<wave.length;i++){var v=wave[i]/128-1;rms+=v*v;}
  rms=Math.sqrt(rms/Math.max(1,wave.length));
  // No automatic gain on silence: it would turn noise into movement.
  var gate=playing?rounded((rms-.0015)/.018,0,1):0;
  sampleBands(spectrum,node,m.bands.length,m.bands);
  for(var j=0;j<m.bands.length;j++){
    var target=m.bands[j]*gate;
    m.levels[j]=follow(m.levels[j],target,dt,.028,.19);
    if(m.levels[j]>=m.peaks[j]){m.peaks[j]=m.levels[j];m.holds[j]=.22;}
    else{m.holds[j]-=dt;if(m.holds[j]<=0)m.peaks[j]=Math.max(m.levels[j],m.peaks[j]-dt*.55);}
  }
  function mean(from,to){var sum=0;for(var k=from;k<to;k++)sum+=m.bands[k];return sum/(to-from)*gate;}
  var rawBass=mean(0,15);
  m.bed=follow(m.bed,rawBass,dt,.45,.45);
  var onset=rawBass>m.bed*1.08+.025?rounded((rawBass-m.previousBass)*5,0,1):0;
  m.hit=Math.max(onset,m.hit*Math.exp(-dt/.13));m.previousBass=rawBass;
  m.bass=follow(m.bass,rawBass,dt,.025,.14);
  m.mids=follow(m.mids,mean(15,34),dt,.035,.13);
  m.treble=follow(m.treble,mean(34,48),dt,.018,.1);
  m.level=follow(m.level,rounded(rms*3.8,0,1)*gate,dt,.018,.14);
  // Integrate velocity, never multiply wall-clock time by changing bass.
  // Pauses freeze motion instead of letting the effect run on its own.
  m.clock+=dt*(.12*m.level+.3*m.mids+.2*m.bass);
  return gate>.02;
}
/* Frequency-sensitive tunnel response only. Kick, snare and treble each
 * compare a quick envelope against their slower local baseline. The analyser
 * and readMotion() remain unchanged for Spectrum 2000 / Oscilloscope. */
function averageVizBand(a,first,last){
  var sum=0;for(var n=first;n<last;n++)sum+=a[n];
  return sum/(last-first);
}
function updateTunnelDynamics(m,playing,dt,tune){
  var f=m.fx,gate=playing?1:0;
  var kick=averageVizBand(m.bands,0,12)*gate;
  var snare=averageVizBand(m.bands,14,33)*gate;
  var high=averageVizBand(m.bands,33,48)*gate;
  f.kickFast=follow(f.kickFast,kick,dt,.019,.09);
  f.kickSlow=follow(f.kickSlow,kick,dt,.24,.28);
  f.snareFast=follow(f.snareFast,snare,dt,.016,.082);
  f.snareSlow=follow(f.snareSlow,snare,dt,.19,.23);
  f.highFast=follow(f.highFast,high,dt,.027,.12);
  f.highSlow=follow(f.highSlow,high,dt,.31,.35);
  var dKick=Math.max(0,kick-f.kickPrev);
  var dSnare=Math.max(0,snare-f.snarePrev);
  var dHigh=Math.max(0,high-f.highPrev);
  f.kickPrev=kick;f.snarePrev=snare;f.highPrev=high;
  var kickHit=playing?rounded(Math.max(0,f.kickFast-f.kickSlow-.012)*5.4+dKick*2.3,0,1):0;
  var snareHit=playing?rounded(Math.max(0,f.snareFast-f.snareSlow-.01)*5.9+dSnare*2.6,0,1):0;
  var melodyHit=playing?rounded(Math.max(0,f.highFast-f.highSlow-.015)*3.6+dHigh*2.1,0,1):0;
  f.kick=Math.max(kickHit,f.kick*Math.exp(-dt/.17));
  f.snare=Math.max(snareHit,f.snare*Math.exp(-dt/.15));
  f.rise=Math.max(melodyHit,f.rise*Math.exp(-dt/.23));
  f.air=follow(f.air,playing?rounded(high*1.45,0,1):0,dt,.055,.20);
  var kickGain=vizGain(tune,"kick"),snareGain=vizGain(tune,"snare");
  var highGain=vizGain(tune,"high");
  var speedGain=vizGain(tune,"speed");
  var target=playing?(.14+m.level*.44+m.bass*.75+
                     f.kick*2.25*kickGain+f.snare*.95*snareGain+
                     f.rise*.85*highGain+f.air*.45*highGain)*speedGain:0;
  f.velocity=follow(f.velocity,target,dt,.032,.20);
  if(playing)m.tunnelClock+=dt*f.velocity;
}
function drawSpectrum(ctx,w,h,m){
  var margin=w*.055,base=h*.84,usable=w-margin*2;
  grid(ctx,w,h,Math.max(22,h/6),"rgba(45,150,111,.12)");
  var count=m.levels.length,step=usable/count,bw=Math.max(1,step*.72);
  var cap=h*.65,segments=Math.max(10,Math.min(32,Math.floor(cap/5)));
  var sh=cap/segments;
  // Draw the unlit matrix first: it must never paint over the bloom.
  ctx.shadowBlur=0;ctx.fillStyle="rgba(83,168,117,.045)";
  for(var i=0;i<count;i++){
    for(var k=0;k<segments;k++)ctx.fillRect(margin+i*step,base-(k+1)*sh,bw,Math.max(1,sh-1.3));
  }
  // A compound emissive mask gets three additive phosphor passes. The
  // wide green bloom, hot inner halo and near-white core all come from
  // the actual lit cells, so silence cannot illuminate a static rectangle.
  ctx.beginPath();
  for(var i=0;i<count;i++){
    var lit=Math.floor(m.levels[i]*segments),x=margin+i*step;
    for(var k=0;k<lit;k++)ctx.rect(x,base-(k+1)*sh,bw,Math.max(1,sh-1.3));
  }
  ctx.save();ctx.globalCompositeOperation="lighter";
  ctx.shadowColor="#00ff69";
  ctx.shadowBlur=(lowPower?23:36)+m.hit*10;
  ctx.fillStyle="rgba(10,255,102,.46)";ctx.fill();
  ctx.shadowColor="#30ff8d";ctx.shadowBlur=lowPower?10:17;
  ctx.fillStyle="rgba(92,255,160,.63)";ctx.fill();
  ctx.shadowColor="#b5ffd2";ctx.shadowBlur=lowPower?4:7;
  ctx.fillStyle="rgba(190,255,218,.83)";ctx.fill();
  ctx.restore();ctx.shadowBlur=0;
  // Small brilliant cores retain the segmented LED structure inside the glow.
  for(var i=0;i<count;i++){
    var value=m.levels[i],x=margin+i*step,lit=Math.floor(value*segments);
    ctx.fillStyle="#dfffeb";
    for(var k=0;k<lit;k++)ctx.fillRect(x+bw*.14,base-(k+1)*sh,bw*.72,Math.max(.8,(sh-1.3)*.48));
    if(m.peaks[i]>.015){
      ctx.shadowColor="#71ffab";ctx.shadowBlur=lowPower?11:20;
      ctx.fillStyle="#f2fff5";ctx.fillRect(x,base-m.peaks[i]*cap-2,bw,2);
    }
    ctx.shadowBlur=0;
    var reflection=ctx.createLinearGradient(0,base+3,0,base+6+value*h*.1);
    reflection.addColorStop(0,"rgba(103,255,169,"+(value*.45)+")");
    reflection.addColorStop(1,"rgba(45,255,130,0)");
    ctx.fillStyle=reflection;ctx.fillRect(x,base+3,bw,3+value*h*.1);
  }
  ctx.font="10px monospace";ctx.fillStyle="#75b99b";ctx.textAlign="left";
  ctx.fillText("SPECTRE / 75 Hz — 14 kHz",margin,22);
  var labels=[[80,"80"],[250,"250"],[1000,"1k"],[4000,"4k"],[12000,"12k Hz"]];
  labels.forEach(function(p){var x=margin+Math.log(p[0]/75)/Math.log(14000/75)*usable;ctx.fillText(p[1],Math.min(w-margin-30,x),h-12);});
}
function drawScope(ctx,w,h,bass,mids,time,zoom){
  var cy=h/2;
  grid(ctx,w,h,25,"rgba(38,187,100,.16)");
  ctx.strokeStyle="rgba(71,201,131,.45)";
  ctx.beginPath();ctx.moveTo(0,cy);ctx.lineTo(w,cy);ctx.stroke();
  ctx.shadowColor="#49ef9b";ctx.shadowBlur=lowPower?5:14;
  for(var layer=0;layer<3;layer++){
    ctx.beginPath();
    ctx.strokeStyle=layer===0?"rgba(39,165,104,.18)":layer===1?"rgba(56,226,140,.45)":"rgba(177,255,202,.94)";
    ctx.lineWidth=layer===0?7:layer===1?3:1.4;
    var n=Math.min(wave.length,Math.max(32,Math.round(512/(zoom||1))));
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
function glowStroke(ctx,color,width,blur){
  ctx.strokeStyle=color;ctx.lineWidth=width;
  ctx.shadowColor=color;ctx.shadowBlur=lowPower?blur*.45:blur;ctx.stroke();
}
/* Actual CRT phosphor: the same triple-pass emission used in Spectre 2000
 * and the oscilloscope. The wide colored aura and the thin saturated center
 * share ONE untouched tunnel path; no screen-size filter, no global wash.
 * Caps keep multiple crossing rings from overexposing the frame. */
function phosphorLine(ctx,hue,width,alpha,pulse,tune){
  var a=rounded(alpha,0,1),hit=rounded(pulse,0,1);
  var light=vizGain(tune,"glow");
  ctx.save();ctx.globalCompositeOperation="lighter";
  ctx.shadowColor="hsla("+hue+",100%,62%,1)";
  ctx.shadowBlur=(lowPower?12:19)+hit*(lowPower?2:4);
  ctx.lineWidth=width*2.75;
  ctx.strokeStyle="hsla("+hue+",100%,54%,"+rounded((.15+a*.17)*light,0,Math.min(.7,.36*light))+")";ctx.stroke();
  ctx.shadowColor="hsla("+hue+",100%,70%,1)";
  ctx.shadowBlur=(lowPower?6:11)+hit*2;
  ctx.lineWidth=width*1.65;
  ctx.strokeStyle="hsla("+hue+",100%,73%,"+rounded((.38+a*.25)*light,0,Math.min(.94,.7*light))+")";ctx.stroke();
  ctx.shadowColor="hsla("+hue+",100%,86%,1)";
  ctx.shadowBlur=lowPower?2:4;
  ctx.lineWidth=Math.max(.7,width*.78);
  ctx.strokeStyle="hsla("+hue+",96%,87%,"+rounded((.59+a*.27+hit*.08)*light,0,Math.min(.98,.9*light))+")";ctx.stroke();
  ctx.restore();
}
function drawTunnel(ctx,w,h,m,tune){
  var clock=m.tunnelClock,cx=w/2,cy=h/2,extent=Math.hypot(w,h)*.65,f=m.fx;
  var kickGain=vizGain(tune,'kick'),snareGain=vizGain(tune,'snare');
  var highGain=vizGain(tune,'high'),warpGain=vizGain(tune,'warp');
  ctx.save();
  ctx.translate(cx+Math.sin(clock*12)*f.kick*kickGain*2.1,
                cy+Math.cos(clock*15)*f.kick*kickGain*1.4);
  var rings=lowPower?18:26,points=64;
  for(var n=rings-1;n>=0;n--){
    var z=(n/rings+clock*.26)%1;
    // Kick: physical tunnel pressure. Snare: very brief geometric twitch.
    var radius=(9+z*z*extent)*(1+f.kick*.18*kickGain);
    var twist=clock*.48+z*.65+f.snare*.18*snareGain*Math.sin(n*.7+clock*4);
    ctx.beginPath();
    for(var j=0;j<points;j++){
      var angle=j/points*TAU;
      // Wrap/interpolate last FFT band to first: no seam on a closed ring.
      var bpos=j/points*48,bi=Math.floor(bpos)%48,bmix=bpos-Math.floor(bpos);
      var band=m.levels[bi]*(1-bmix)+m.levels[(bi+1)%48]*bmix;
      var snareRipple=f.snare*.035*snareGain*Math.sin(angle*9+clock*5+n*.42);
      var airRipple=f.rise*.025*highGain*Math.cos(angle*12+clock*3+n*.2);
      var shape=1+(.08*Math.cos(angle*6+twist)+band*.13+
                m.hit*.035+snareRipple+airRipple)*warpGain;
      var x=Math.cos(angle+twist)*radius*shape,y=Math.sin(angle+twist)*radius*shape;
      if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.closePath();
    var hue=178+z*100+Math.sin(clock*.3)*22;
    var base=vizGain(tune,"idle"),flash=vizGain(tune,"flash");
    var alpha=(.19+.73*z)*(.62*base+m.level*.47+
                    f.air*.19*highGain+f.snare*.14*snareGain+
                    f.rise*.22*highGain+f.kick*.28*kickGain*(flash-1));
    var thin=(.55+z*.77+f.kick*.11*kickGain)*vizGain(tune,"line");
    phosphorLine(ctx,hue,thin,alpha,rounded(
                 (f.kick*.65*kickGain*flash+f.snare*.45*snareGain+
                  f.rise*.34*highGain),0,1),tune);
    // High notes and snares briefly excite pixels ON the existing rings.
    if(n%4===0&&(f.snare*snareGain+f.rise*highGain)>.13){
      var ang=clock*1.4+n*2.399963;
      var px=Math.cos(ang+twist)*radius;
      var py=Math.sin(ang+twist)*radius;
      var size=1.2+f.snare*1.5*snareGain+f.rise*.9*highGain;
      ctx.shadowColor="#b1ffe1";ctx.shadowBlur=lowPower?2:6;
      ctx.fillStyle="rgba(181,255,229,"+
        rounded((f.snare*snareGain+f.rise*highGain)*.44*vizGain(tune,"glow"),0,.72)+")";
      ctx.fillRect(px-size*.5,py-size*.5,size,size);
      ctx.shadowBlur=0;
    }
  }
  ctx.shadowBlur=0;
  var coreRadius=32+m.bass*45+m.hit*28+f.kick*46*kickGain;
  var core=ctx.createRadialGradient(0,0,0,0,0,coreRadius);
  core.addColorStop(0,"rgba(177,255,238,"+
    rounded((.08*vizGain(tune,"idle")+m.hit*.35+f.kick*.25*kickGain*vizGain(tune,"flash")+f.snare*.10*snareGain)*vizGain(tune,"glow"),0,.7)+")");
  core.addColorStop(1,"rgba(45,101,255,0)");
  ctx.fillStyle=core;circle(ctx,0,0,coreRadius);ctx.fill();
  ctx.restore();
}
function makeStars(){
  var particles=[],seed=261;
  function random(){seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;}
  for(var i=0;i<(lowPower?140:320);i++)particles.push({x:random()*2-1,y:random()*2-1,z:.04+random()*.96,hue:180+random()*90});
  return particles;
}
function drawHyperdrive(ctx,w,h,m,dt,stars,tune){
  var cx=w/2,cy=h/2,scale=Math.min(w,h)*.38;
  // Visible acceleration on transients, with quiet sections slowing down.
  var velocity=(m.level*.17+m.bass*.39+m.hit*1.38*vizGain(tune,"kick"))*dt*vizGain(tune,"speed");
  var highGain=vizGain(tune,"high"),glowGain=vizGain(tune,"glow");
  var idleGain=vizGain(tune,"idle"),lineGain=vizGain(tune,"line");
  var density=vizGain(tune,"density"),trails=vizGain(tune,"trails");
  var densityThreshold=rounded(density*100,0,100);
  ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.sin(m.clock*.25)*.09);
  ctx.globalCompositeOperation="lighter";
  for(var i=0;i<stars.length;i++){
    var s=stars[i],old=s.z;s.z-=velocity;
    if((i*37)%100>=densityThreshold)continue;
    if(s.z<.04){s.z=1+(s.z%1);old=s.z;}
    var x=s.x*scale/s.z,y=s.y*scale/s.z;
    var trail=Math.min(.22*trails,velocity*(2+m.hit*5)*trails);
    var back=Math.min(1.2,Math.max(s.z,old)+trail);
    ctx.beginPath();ctx.moveTo(s.x*scale/back,s.y*scale/back);ctx.lineTo(x,y);
    var alpha=rounded(((1-s.z)*(.3*idleGain+m.level*.6)+m.treble*.22*highGain)*glowGain,.0,.95);
    // Same original trails, with a little green/blue/violet CRT fringe.
    // Only one in four gets an extra pass to remain fast on mobile.
    if(i%4===0){
      ctx.shadowColor="hsla("+s.hue+",100%,64%,1)";
      ctx.shadowBlur=lowPower?6:13;
      ctx.lineWidth=(2.5+(1-s.z)*2)*lineGain;
      ctx.strokeStyle="hsla("+s.hue+",98%,56%,"+rounded(alpha*.40,0,.36)+")";
      ctx.stroke();
    }
    ctx.shadowColor="hsla("+s.hue+",100%,72%,1)";
    ctx.shadowBlur=lowPower?2:(i%4===0?7:3);
    ctx.lineWidth=(.55+(1-s.z)*1.6)*lineGain;
    ctx.strokeStyle="hsla("+s.hue+",94%,"+(70+m.treble*12*highGain)+"%,"+
      rounded(alpha*(1.08+m.hit*.14),0,.86)+")";
    ctx.stroke();
    if(velocity<.0001){ctx.fillStyle="rgba(140,210,230,.12)";ctx.fillRect(x,y,1,1);}
  }
  ctx.restore();
}
function mount(host,media,options){
  if(!host)return;
  if(active&&active.stop)active.stop();
  var state={stopped:false,request:0};
  active=state;
  host.innerHTML="";
  var shell=element("div","zviz");
  var heading=element("div","zviz-top");
  var branding=element("div","zviz-brand","ZEBRAVIS 2.0");
  var led=element("span","zviz-led","● SIGNAL AUDIO");
  heading.appendChild(branding);heading.appendChild(led);shell.appendChild(heading);
  var stage=element("div","zviz-stage");
  var canvas=element("canvas","zviz-canvas");
  canvas.setAttribute("aria-label","Visualisation audio animée de ZebraAMP");
  stage.appendChild(canvas);
  var crt=element("div","zviz-crt");crt.setAttribute("aria-hidden","true");
  stage.appendChild(crt);
  var overlay=element("div","zviz-overlay");
  overlay.appendChild(element("span","zviz-no-signal","AUCUN SIGNAL — LANCE UN MORCEAU DANS ZEBRAAMP"));
  stage.appendChild(overlay);
  shell.appendChild(stage);
  var zoomPanel=element("div","zviz-zoom");
  var zoomLabel=element("label","zviz-zoom-label");
  var zoomText=element("span","","ZOOM ONDE");
  var zoomInput=element("input","zviz-zoom-range");
  zoomInput.type="range";zoomInput.min="0";zoomInput.max="100";zoomInput.step="1";zoomInput.value="25";
  zoomInput.setAttribute("aria-label","Zoom horizontal de l’onde de l’oscilloscope");
  var zoomValue=element("output","zviz-zoom-value","1×");
  var scopeZoom=1;
  zoomInput.oninput=function(){
    scopeZoom=Math.pow(2,(Number(zoomInput.value)-25)/25);
    var value=(Math.round(scopeZoom*100)/100).toLocaleString("fr-CH")+"×";
    zoomValue.textContent=value;zoomInput.setAttribute("aria-valuetext",value);
  };
  zoomLabel.append(zoomText,zoomInput,zoomValue);
  var zoomReset=element("button","zviz-zoom-reset","1×");
  zoomReset.type="button";zoomReset.title="Rétablir le zoom normal";
  zoomReset.onclick=function(){zoomInput.value="25";zoomInput.oninput();};
  zoomPanel.append(zoomLabel,zoomReset);shell.appendChild(zoomPanel);
  var bar=element("div","zviz-controls");
  var back=element("button","zviz-step","◀");
  var next=element("button","zviz-step","▶");
  var modeText=element("div","zviz-mode-name");
  var fullButton=element("button","zviz-fullscreen","⛶");
  var mode=readMode(),lastFrame=0,stars=makeStars(),motion=makeMotion();
  var tuneValues=loadVizTuning();
  var reactiveEngine=window.ZebraVISReactive||null,reactor=reactiveEngine&&reactiveEngine.create();
  var ctx=canvas.getContext("2d",{alpha:false});
  if(!ctx){host.appendChild(element("p","github-drive-error","Canvas 2D non disponible sur ce navigateur."));return;}
  var tuneButton=element("button","zviz-settings-toggle","⚙");
  tuneButton.type="button";tuneButton.title="Réglages du visualiseur";
  tuneButton.setAttribute("aria-label","Ouvrir les réglages ZebraVIS");
  tuneButton.setAttribute("aria-expanded","false");
  var tunePanel=element("section","zviz-tune-panel");
  tunePanel.hidden=true;
  tunePanel.setAttribute("role","region");
  tunePanel.setAttribute("aria-label","Réglages interactifs du visualiseur");
  var tuneHead=element("div","zviz-tune-head");
  var tuneHeading=element("div","zviz-tune-heading","RÉGLAGES");
  var tuneClose=element("button","zviz-tune-close","×");
  tuneClose.type="button";tuneClose.title="Fermer les réglages";
  tuneHead.append(tuneHeading,tuneClose);
  var tuneHelp=element("p","zviz-tune-help",
    "Bouge les curseurs pendant la lecture. Les changements sont immédiats.");
  var tuneList=element("div","zviz-tune-list");
  var tuneFoot=element("div","zviz-tune-foot");
  var tuneReset=element("button","zviz-tune-action","RÉINITIALISER");
  tuneReset.type="button";tuneReset.title="Restaurer les valeurs de ce visualiseur";
  var tuneCopy=element("button","zviz-tune-action zviz-tune-copy","COPIER MES RÉGLAGES");
  tuneCopy.type="button";tuneCopy.title="Partager les réglages des deux modes";
  tuneFoot.append(tuneReset,tuneCopy);
  var tuneStatus=element("div","zviz-tune-status","Sauvegardé automatiquement sur cet appareil");
  var tuneExport=element("textarea","zviz-tune-export");
  tuneExport.readOnly=true;tuneExport.hidden=true;
  tuneExport.setAttribute("aria-label","Mes valeurs ZebraVIS à copier");
  tunePanel.append(tuneHead,tuneHelp,tuneList,tuneFoot,tuneStatus,tuneExport);
  shell.appendChild(tunePanel);
  function setTunePanelOpen(open){
    tunePanel.hidden=!open;
    tuneButton.setAttribute("aria-expanded",String(!!open));
    if(open)renderTunePanel();
  }
  function renderTunePanel(){
    if(mode<2)return;
    tuneHeading.textContent="RÉGLAGES / "+presets[mode][0];
    tuneList.textContent="";
    VIZ_TUNE_SPECS[mode].forEach(function(spec){
      var name=spec[0],row=element("label","zviz-tune-row");
      var header=element("span","zviz-tune-row-head");
      var labelText=element("span","zviz-tune-row-label",spec[1]);
      var output=element("output","zviz-tune-value",tuneValues[mode][name]+" %");
      header.append(labelText,output);
      var input=element("input","zviz-tune-slider");
      input.type="range";input.min=String(spec[2]);input.max=String(spec[3]);
      input.step=String(spec[4]);input.value=String(tuneValues[mode][name]);
      input.setAttribute("aria-label",spec[1]);
      input.addEventListener("input",function(){
        tuneValues[mode][name]=Number(input.value);
        output.textContent=input.value+" %";
        saveVizTuning(tuneValues);
        if(name==="crt")applyTuneCRT();
        if(!tuneExport.hidden)tuneExport.value=shareVizTuning(tuneValues);
        tuneStatus.textContent="Sauvegardé automatiquement sur cet appareil";
      });
      row.append(header,input);
      tuneList.appendChild(row);
    });
  }
  function applyTuneCRT(){
    crt.style.opacity=String(rounded(vizGain(tuneValues[mode],"crt"),0,1));
  }
  tuneButton.onclick=function(){
    if(mode<2)return;
    setTunePanelOpen(tunePanel.hidden);
  };
  tuneClose.onclick=function(){setTunePanelOpen(false);};
  tuneReset.onclick=function(){
    if(mode<2)return;
    VIZ_TUNE_SPECS[mode].forEach(function(spec){
      tuneValues[mode][spec[0]]=100;
    });
    saveVizTuning(tuneValues);
    applyTuneCRT();
    renderTunePanel();
    if(!tuneExport.hidden)tuneExport.value=shareVizTuning(tuneValues);
    tuneStatus.textContent="Valeurs d'origine restaurées pour ce mode";
  };
  tuneCopy.onclick=function(){
    tuneExport.value=shareVizTuning(tuneValues);
    tuneExport.hidden=false;
    tuneExport.focus();tuneExport.select();
    var msg=tuneExport.value;
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(msg).then(function(){
        tuneStatus.textContent="Copié ! Colle ces valeurs dans notre conversation.";
      }).catch(function(){
        tuneStatus.textContent="Sélectionne le texte ci-dessous et copie-le.";
        tuneExport.focus();tuneExport.select();
      });
    }else{
      var success=false;
      try{success=document.execCommand("copy");}catch(e){}
      tuneStatus.textContent=success?"Copié ! Colle ces valeurs dans notre conversation.":
        "Sélectionne le texte ci-dessous et copie-le.";
    }
  };
  function updatePreset(){
    modeText.textContent=(mode+1)+"/"+presets.length+"  "+presets[mode][0];
    back.title="Mode précédent";next.title="Mode suivant";
    zoomPanel.hidden=mode!==1;
    crt.hidden=mode<2;
    applyTuneCRT();
    tuneButton.disabled=mode<2;
    if(mode<2)setTunePanelOpen(false);
    else if(!tunePanel.hidden)renderTunePanel();
    saveMode(mode);
  }
  back.onclick=function(){mode=(mode+presets.length-1)%presets.length;updatePreset();};
  next.onclick=function(){mode=(mode+1)%presets.length;updatePreset();};
  fullButton.title="Plein écran";
  fullButton.onclick=function(){
    if(document.fullscreenElement===shell&&document.exitFullscreen){document.exitFullscreen().catch(function(){});}
    else if(shell.requestFullscreen){var p=shell.requestFullscreen();if(p&&p.catch)p.catch(function(){});}
  };
  bar.appendChild(back);bar.appendChild(modeText);bar.appendChild(next);bar.appendChild(tuneButton);bar.appendChild(fullButton);
  shell.appendChild(bar);
  var footer=element("div","zviz-footer");
  var hint=element("span","","EFFETS RÉACTIFS AU SON / CANVAS 2D");
  footer.appendChild(hint);shell.appendChild(footer);
  var transport=element("div","zviz-transport");
  transport.setAttribute("role","group");transport.setAttribute("aria-label","Commandes de lecture de ZebraAMP");
  var previousTrack=element("button","zviz-track","Ⅰ◀");
  var playTrack=element("button","zviz-track zviz-play","▶");
  var nextTrack=element("button","zviz-track","▶Ⅰ");
  previousTrack.title="Morceau précédent";previousTrack.setAttribute("aria-label",previousTrack.title);
  nextTrack.title="Morceau suivant";nextTrack.setAttribute("aria-label",nextTrack.title);
  [previousTrack,playTrack,nextTrack].forEach(function(button){button.type="button";});
  previousTrack.disabled=!(options&&options.previous);
  nextTrack.disabled=!(options&&options.next);
  previousTrack.onclick=function(){if(options&&options.previous)options.previous();};
  nextTrack.onclick=function(){if(options&&options.next)options.next();};
  function syncTransport(){
    var paused=media.paused||media.ended;
    playTrack.textContent=paused?"▶":"Ⅱ";
    playTrack.setAttribute("aria-label",paused?"Lire le morceau":"Mettre en pause");
    playTrack.title=paused?"Lecture":"Pause";
    playTrack.setAttribute("aria-pressed",String(!paused));
  }
  playTrack.onclick=function(){
    if(options&&options.toggle)options.toggle();
    else if(media.paused){var result=media.play();if(result&&result.catch)result.catch(function(){});}
    else media.pause();
  };
  ["play","pause","ended","emptied"].forEach(function(event){media.addEventListener(event,syncTransport);});
  syncTransport();transport.append(previousTrack,playTrack,nextTrack);shell.appendChild(transport);
  host.appendChild(shell);
  // ZebraAMP owns the MediaElementSource. Do not create a competing node.
  function connectNow(){
    var managed=options&&typeof options.getAnalyser==="function";
    var external=managed?options.getAnalyser():options&&options.analyser;
    if(managed&&!external){analyser=null;led.classList.remove("on");return false;}
    var ok=connect(media,external);
    led.classList.toggle("on",ok);
    if(ok&&audioContext)requestAnimationFrame(function(){if(audioContext&&audioContext.state==="suspended")audioContext.resume().catch(function(){});});
    return ok;
  }
  var linked=connectNow(),lastLinkCheck=0;
  updatePreset();
  var startX=0;
  canvas.addEventListener("touchstart",function(e){if(e.touches.length)startX=e.touches[0].clientX;},{passive:true});
  canvas.addEventListener("touchend",function(e){if(e.changedTouches.length){var dx=e.changedTouches[0].clientX-startX;if(Math.abs(dx)>55){mode=(mode+(dx>0?-1:1)+presets.length)%presets.length;updatePreset();}}},{passive:true});
  var dpr=0,w=0,h=0;
  var signal=false;
  function frame(t){
    if(state.stopped||!shell.isConnected){state.stop();return;}
    state.request=requestAnimationFrame(frame);
    if(document.hidden||shell.closest(".window")?.classList.contains("minimized"))return;
    var step=lowPower?36:18;
    if(t-lastFrame<step)return;
    var dt=rounded(t-lastFrame,1,50);lastFrame=t;
    var box=stage.getBoundingClientRect();
    var cw=Math.max(160,Math.round(box.width)),ch=Math.max(80,Math.round(box.height));
    var pix=Math.min(window.devicePixelRatio||1,lowPower?1.25:1.6);
    if(w!==cw||h!==ch||dpr!==pix){
      w=cw;h=ch;dpr=pix;
      canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    if(options&&typeof options.getAnalyser==="function"&&t-lastLinkCheck>450){
      lastLinkCheck=t;
      var newest=options.getAnalyser();
      if(newest!==analyser||(!linked&&newest))linked=connectNow();
    }
    ctx.clearRect(0,0,w,h);
    backdrop(ctx,w,h);
    if(linked&&analyser){
      analyser.getByteFrequencyData(spectrum);
      analyser.getByteTimeDomainData(wave);
    }
    if(!linked||media.paused||media.ended){spectrum.fill(0);wave.fill(128);}
    var playing=linked&&!media.paused&&!media.ended;
    var hasSignal=analyser?readMotion(motion,analyser,playing,dt/1000):false;
    var bass=linked?energy(spectrum,1,20):0;
    var mids=linked?energy(spectrum,20,170):0;
    var treble=linked?energy(spectrum,170,500):0;
    var sounding=playing&&hasSignal;
    if(mode===2)updateTunnelDynamics(motion,sounding,dt/1000,tuneValues[2]);
    if(mode>=2&&reactiveEngine&&reactor)reactiveEngine.update(reactor,motion,sounding,dt/1000);
    overlay.style.opacity=sounding?"0":"1";
    led.classList.toggle("pulsing",sounding);
    if(mode===0)drawSpectrum(ctx,w,h,motion);
    else if(mode===1)drawScope(ctx,w,h,bass,mids,t,scopeZoom);
    else if(mode===2){
      if(reactiveEngine&&reactor)reactiveEngine.tunnel(ctx,w,h,motion,reactor);
      else drawTunnel(ctx,w,h,motion,tuneValues[2]);
    }else{
      if(reactiveEngine&&reactor)reactiveEngine.hyper(ctx,w,h,motion,reactor,dt/1000);
      else drawHyperdrive(ctx,w,h,motion,dt/1000,stars,tuneValues[3]);
    }
  }
  state.stop=function(){
    if(state.stopped)return;
    state.stopped=true;if(state.request)cancelAnimationFrame(state.request);
    ["play","pause","ended","emptied"].forEach(function(event){media.removeEventListener(event,syncTransport);});
  };
  state.request=requestAnimationFrame(frame);
}
window.ZebraVisualizer={mount:mount,presets:presets,sampleBands:sampleBands};
}());
