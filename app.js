
/* ZebraOS 2.0 / Studio edition — prototype v0.1, plain JavaScript */
(function(){
"use strict";
var $=function(id){return document.getElementById(id)};
var users=[["visitor","Visitor","Guest account","V"],["zebra","Zebra","Studio owner","Z"],["admin","Admin","System operator","A"],["daniel","Daniel","...","?"]];
var wallpaper={visitor:"visitor",zebra:"zebra",admin:"admin",daniel:"daniel"};
var session=null,opened={},z=20,seq=0,selectedTrack=-1,localTracks=[],tracks=[],adminApproved=false,adminLoginUnlocked=false;
for(var t=1;t<=9;t++)tracks.push(("0"+t).slice(-2)+" - UNTITLED");
var music=new Audio(),musicLoaded=false;
/* Local filesystem replaces the former demo-only filenames. */
var docs={
readme:"ZEBRA RECORD // STUDIO COMPUTER\n\nBienvenue sur ZebraOS.\n\nCette machine contient ZEBRA TAPE 2, une map Counter-Strike 1.6, des documents et des archives du studio.\n\nLook around. Do not format C:.\n\nwww.zebratape2.net",
album:"ZEBRA TAPE 2\nDECEMBER 2026\n\nTRACKLIST TO BE CONFIRMED\n9 TRACKS\n\nwww.zebratape2.net",
install:"SADATE — COUNTER-STRIKE 1.6\n\nLa map sera téléchargeable ici une fois terminée.\nFichier ZIP et textures à venir.",
daniel:"DANIEL\n\nCe fichier n'est pas à toi.\n\nPourquoi tu l'ouvres ?\n\n-- Daniel",
mix:"final_final_FINAL_v17\n\nCelle-là c'est la bonne (peut-être).",
recycle:"DO NOT DELETE THIS FILE.\n\nToo late."
};
/* Lightweight, local CC0 sound effects. The user's settings are kept in localStorage. */
var soundCache={};
function sfx(name){
  if(getStore("zebra.sfx.muted")==="1")return;
  var data=window.ZebraSFXData;
  if(!data||!data[name])return;
  try {
    var clip=soundCache[name];
    if(!clip){clip=new Audio(data[name]);clip.preload="auto";soundCache[name]=clip;}
    if(!clip.paused){clip=clip.cloneNode(true);}
    else {try{clip.currentTime=0}catch(e){}}
    clip.volume=name==="mouseDown"?.58:name==="mouseUp"?.36:name==="error"?.24:.14;
    var promise=clip.play();
    if(promise&&promise.catch)promise.catch(function(){});
  }catch(e){}
}

/* Zebra Mouse Switch — native Web Audio, so touches are audible on mobile.
   Use a shaped mechanical transient immediately, then add the Kenney CC0 sample
   if OGG decoding is supported. No autoplay or remote files required. */
var mouseContext=null, mouseSamples={}, mouseSynth={}, mouseSamplesRequested=false;
function makeMechanicalSwitch(ctx,name){
  var release=name==="mouseUp",rate=ctx.sampleRate,seconds=release?.065:.082;
  var count=Math.ceil(rate*seconds),buffer=ctx.createBuffer(1,count,rate),pcm=buffer.getChannelData(0);
  var seed=release?19681:73243,previous=0,peak=.00001;
  for(var i=0;i<count;i++){
    var t=i/rate;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    var white=(seed/2147483648)-1;
    var sharp=white-previous*.7;
    previous=white;
    var main=Math.exp(-t*(release?175:130));
    var tickAt=release?.012:.016;
    var delayed=t>tickAt?Math.exp(-(t-tickAt)*220):0;
    var spring=Math.sin(2*Math.PI*(release?1450:1050)*t)*Math.exp(-t*115);
    var body=Math.sin(2*Math.PI*(release?460:325)*t)*Math.exp(-t*100);
    var value=sharp*(main*.85+delayed*.27)+spring*.32+body*.18;
    pcm[i]=value;
    peak=Math.max(peak,Math.abs(value));
  }
  var normalise=.93/peak;
  for(var j=0;j<count;j++)pcm[j]*=normalise;
  return buffer;
}
function decodeMouseSamples(ctx){
  if(mouseSamplesRequested)return;
  mouseSamplesRequested=true;
  var data=window.ZebraSFXData||{};
  ["mouseDown","mouseUp"].forEach(function(name){
    try{
      var uri=data[name];
      if(!uri||uri.indexOf("base64,")<0)return;
      var raw=atob(uri.split("base64,")[1]);
      var bytes=new Uint8Array(raw.length);
      for(var i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
      ctx.decodeAudioData(bytes.buffer).then(function(decoded){
        mouseSamples[name]=decoded;
      }).catch(function(){});
    }catch(e){}
  });
}
function playMechanicalClick(name){
  if(getStore("zebra.sfx.muted")==="1")return;
  try{
    var Context=window.AudioContext||window.webkitAudioContext;
    if(!Context){sfx(name);return;}
    if(!mouseContext)mouseContext=new Context();
    var ctx=mouseContext;
    if(!mouseSynth[name])mouseSynth[name]=makeMechanicalSwitch(ctx,name);
    // Touch pointerup and mouse pointerdown are user-activation events.
    if(ctx.state==="suspended"){
      var resumed=ctx.resume();
      if(resumed&&resumed.catch)resumed.catch(function(){});
    }
    var source=ctx.createBufferSource();
    source.buffer=mouseSynth[name];
    var gain=ctx.createGain();
    gain.gain.value=name==="mouseUp"?.44:.72;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    // Keep the original mechanical mouse sample alongside our instant transient.
    if(mouseSamples[name]){
      var sample=ctx.createBufferSource(),level=ctx.createGain();
      sample.buffer=mouseSamples[name];
      level.gain.value=name==="mouseUp"?.8:1.15;
      sample.connect(level);level.connect(ctx.destination);
      sample.start();
    }
    decodeMouseSamples(ctx);
  }catch(e){sfx(name);}
}

/* Custom ZebraOS desktop sprite: user-supplied 128px PNGs, optimised for small UI sizes. */
function osIcon(name,size){
  var pack=window.ZebraIconPack, i=pack&&pack.names?pack.names.indexOf(name):-1;
  var node=el("span","os-icon-graphic");
  node.setAttribute("aria-hidden","true");
  if(i<0){node.textContent="▣";return node;}
  var col=i%pack.columns,row=Math.floor(i/pack.columns);
  node.style.width=size+"px";
  node.style.height=size+"px";
  node.style.backgroundImage='url("'+pack.image+'")';
  node.style.backgroundSize=(pack.columns*size)+"px "+(Math.ceil(pack.names.length/pack.columns)*size)+"px";
  node.style.backgroundPosition=(-col*size)+"px "+(-row*size)+"px";
  return node;
}
function fileIcon(f){
  if(f[1]==="folder"){
    if(typeof f[2]==="string"&&f[2].indexOf("github:")===0)return "network";
    if(f[2]==="tape")return "zebratape2";
    if(f[2]==="screens"||f[2]==="art")return "jpg";
    if(f[2]==="maps"||f[2]==="sadate")return "zip";
    if(f[2]==="recycle")return "recycle-bin";
    return "folder";
  }
  if(f[1]==="audio")return "mp3";
  if(f[1]==="image")return "jpg";
  if(f[1]==="download")return "zip";
  if(f[2]==="readme")return "readme";
  return "txt";
}
function windowIcon(id){
  if(id==="amp")return "zebraamp";
  if(id==="explorer")return "computer";
  if(id==="settings")return "control-panel";
  if(id==="manager")return "computer";
  if(id==="viewer")return "jpg";
  if(id==="about")return "zebraos";
  if(id==="adminprompt")return "settings";
  return "txt";
}
function decorateSystemMenus(){
  var mappings={amp:"zebraamp",explorer:"computer",notepad:"txt",viewer:"jpg",settings:"control-panel",about:"zebraos"};
  document.querySelectorAll("#start-menu [data-start]").forEach(function(b){
    Array.prototype.slice.call(b.childNodes).forEach(function(n){if(n.nodeType===3)n.remove()});
    b.insertBefore(osIcon(mappings[b.dataset.start]||"folder",20),b.firstChild);
  });
  [["logout","computer"],["shutdown-desktop","shutdown"]].forEach(function(row){
    var b=$(row[0]);
    Array.prototype.slice.call(b.childNodes).forEach(function(n){if(n.nodeType===3)n.remove()});
    b.insertBefore(osIcon(row[1],20),b.firstChild);
  });
  var logo=document.querySelector("#start-button .start-z");
  if(logo){logo.textContent="";logo.appendChild(osIcon("zebraos",20));}
  var tray=document.querySelector(".tray-icon");
  if(tray){tray.textContent="";tray.appendChild(osIcon("network",16));}
}
function el(tag,cls,txt){var n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;}
function show(id){["power-screen","boot-screen","login-screen","session-boot-screen","desktop-screen"].forEach(function(s){$(s).classList.toggle("active",s===id)});}
/* Power / studio startup audio. The user clicks POWER so playback is permitted on phones. */
var studioBootAssets=window.ZebraBootAssets||{};
var bootAudio=new Audio(studioBootAssets.startup||"");
var sessionAudio=new Audio(studioBootAssets.sessionstartup||studioBootAssets.session||"");
document.querySelectorAll(".zboot-logo,.zboot-session-logo").forEach(function(img){
  if(studioBootAssets.logo)img.src=studioBootAssets.logo;
});
bootAudio.preload="auto";sessionAudio.preload="auto";
var bootTimer=0,sessionTimer=0,booting=false,sessionBooting=false,pendingSession=null;
function playBootTrack(track){
  try {track.pause();track.currentTime=0;var p=track.play();if(p&&p.catch)p.catch(function(){});}catch(e){}
}
function finishBoot(){
  if(!booting)return;
  booting=false;clearTimeout(bootTimer);
  bootAudio.pause();login();
}
function powerOn(){
  if(booting)return;
  booting=true;
  show("boot-screen");
  playBootTrack(bootAudio);
  bootTimer=setTimeout(finishBoot,5200);
}
function finishSessionBoot(){
  if(!sessionBooting)return;
  sessionBooting=false;clearTimeout(sessionTimer);sessionAudio.pause();
  session=pendingSession;pendingSession=null;
  adminApproved=false;closeAll();
  if(window.ZebraWallpaper)window.ZebraWallpaper.apply(session);else setWall(getStore("zebra.wall."+session)||session);desk();show("desktop-screen");
}
function beginSessionBoot(id){
  if(sessionBooting)return;
  pendingSession=id;sessionBooting=true;
  var name=users.filter(function(u){return u[0]===id})[0];
  $("zboot-session-label").textContent="WELCOME "+(name?name[1].toUpperCase():"USER");
  show("session-boot-screen");
  playBootTrack(sessionAudio);
  sessionTimer=setTimeout(finishSessionBoot,3600);
}
function stopBootSequences(){
  booting=false;sessionBooting=false;pendingSession=null;
  clearTimeout(bootTimer);clearTimeout(sessionTimer);
  bootAudio.pause();sessionAudio.pause();
}
function login(){var r=$("login-users");r.innerHTML="";users.forEach(function(u){var b=el("button","user-card");b.innerHTML='<span class="user-avatar"></span><span class="user-name"></span><span class="user-sub"></span>';b.children[0].textContent=u[3];b.children[1].textContent=u[1];b.children[2].textContent=u[2];b.onclick=function(){sfx("confirm");start(u[0])};r.appendChild(b)});show("login-screen")}
/* Studio operator login. A client-side password is for roleplay / casual access
   only, NOT real authentication. Never store confidential material in this site. */
var adminPasswordDigest="e5be98a98f2a095123d497892f346cc70153c9d348f276a639fcbbe946183f30";
function requestAdminPassword(){
  var existing=document.querySelector(".admin-login-mask");
  if(existing){existing.querySelector("input").focus();return;}
  var mask=el("div","admin-login-mask");
  var panel=el("form","admin-login-dialog");
  panel.setAttribute("autocomplete","off");
  panel.appendChild(el("div","admin-login-banner","ZebraOS Studio / Authentication"));
  panel.appendChild(el("div","admin-login-symbol","Z"));
  panel.appendChild(el("p","admin-login-text","ADMINISTRATOR ACCESS"));
  panel.appendChild(el("p","admin-login-intro","Enter your password to access the studio workspace."));
  var input=el("input","admin-login-input");
  input.type="password";
  input.autocomplete="off";
  input.spellcheck=false;
  input.placeholder="Password";
  input.setAttribute("aria-label","Mot de passe Admin");
  var error=el("div","admin-login-error","");
  error.setAttribute("role","status");
  var actions=el("div","admin-login-actions");
  var cancel=el("button","admin-login-cancel","CANCEL");
  cancel.type="button";
  cancel.onclick=function(){mask.remove();};
  var submit=el("button","admin-login-submit","LOGIN");
  submit.type="submit";
  actions.appendChild(cancel);actions.appendChild(submit);
  panel.appendChild(input);panel.appendChild(error);panel.appendChild(actions);
  panel.onsubmit=function(event){
    event.preventDefault();
    var pass=input.value;
    input.value="";
    submit.disabled=true;
    error.textContent="Checking credentials...";
    if(!window.crypto||!window.crypto.subtle||!window.TextEncoder){
      error.textContent="Secure browser APIs unavailable.";submit.disabled=false;return;
    }
    var bytes=new TextEncoder().encode("zebraos-studio-admin-2026:"+pass);
    crypto.subtle.digest("SHA-256",bytes).then(function(buffer){
      var value=Array.from(new Uint8Array(buffer)).map(function(b){return b.toString(16).padStart(2,"0");}).join("");
      if(value===adminPasswordDigest){
        adminLoginUnlocked=true;
        mask.remove();
        sfx("confirm");
        beginSessionBoot("admin");
      }else{
        sfx("error");
        error.textContent="ACCESS DENIED — Incorrect password";
        input.focus();
        submit.disabled=false;
      }
    }).catch(function(){
      error.textContent="Authentication check failed. Try again.";
      submit.disabled=false;
    });
  };
  mask.onkeydown=function(event){if(event.key==="Escape"){event.preventDefault();mask.remove();}};
  mask.appendChild(panel);
  $("login-screen").appendChild(mask);
  input.focus();
}
function start(id){
  if(id==="admin"&&!adminLoginUnlocked){requestAdminPassword();return;}
  beginSessionBoot(id);
}
function end(){sfx("switch");stopBootSequences();music.pause();adminApproved=false;adminLoginUnlocked=false;closeAll();session=null;show("power-screen")}
function signout(){sfx("switch");stopBootSequences();music.pause();adminLoginUnlocked=false;closeAll();session=null;login()}
function getStore(k){try{return localStorage.getItem(k)}catch(e){return null}}
function setStore(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function setWall(name,custom){var w=$("wallpaper");w.className="wallpaper wallpaper-"+name;w.style.backgroundImage=custom?'url("'+custom+'")':"";w.style.backgroundSize=custom?"cover":"";if(session&&!custom)setStore("zebra.wall."+session,name)}
function isTouchOpen(e){return (e && e.pointerType==="touch") || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || window.innerWidth<701;}
function desk(){var r=$("desktop-icons");r.innerHTML="";var items=[["My Computer","computer","explorer:root"],["ZebraAMP.exe","zebraamp","amp"],["ZEBRA TAPE 2","zebratape2","explorer:tape"],["Screenshots","jpg","explorer:screens"],["README.TXT","readme","txt:readme"],["Recycle Bin","recycle-bin","explorer:recycle"],["Control Panel","control-panel","settings"]];if(session==="admin")items.push(["STUDIO MANAGER","computer","studio-manager"]);if(session==="daniel")items.push(["DANIEL.TXT","txt","txt:daniel"]);items.forEach(function(it){var b=el("button","desk-icon");b.innerHTML='<span class="desk-symbol"></span><span></span>';b.children[0].appendChild(osIcon(it[1],40));b.children[1].textContent=it[0];b.onclick=function(e){document.querySelectorAll(".desk-icon").forEach(function(x){x.classList.remove("selected")});b.classList.add("selected");if(isTouchOpen(e)||e.detail===0)open(it[2])};b.ondblclick=function(e){if(!isTouchOpen(e))open(it[2])};r.appendChild(b)})}
function closeAll(){Object.keys(opened).forEach(function(k){opened[k].w.remove()});opened={};$("task-items").innerHTML="";$("start-menu").classList.add("hidden")}
function task(){var r=$("task-items");r.innerHTML="";Object.keys(opened).forEach(function(k){var p=opened[k],b=el("button","win-button",p.title);b.onclick=function(){if(p.w.classList.contains("minimized")){p.w.classList.remove("minimized");focus(k);sfx("restore")}else{p.w.classList.add("minimized");sfx("minimize")}};r.appendChild(b)})}
function focus(id){if(opened[id]){opened[id].w.style.zIndex=++z;Object.keys(opened).forEach(function(k){opened[k].w.classList.toggle("focused",k===id)})}}
/* Old-school wireframe animation: the outline travels first, the actual window snaps in after it. */
function animateWindowOpen(w,launcher){
  if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  var screen=$("desktop-screen").getBoundingClientRect();
  var target=w.getBoundingClientRect();
  var origin=launcher&&launcher.getBoundingClientRect?launcher.getBoundingClientRect():null;
  var valid=origin&&origin.width>0&&origin.height>0&&origin.left<window.innerWidth&&origin.top<window.innerHeight&&origin.right>0&&origin.bottom>0;
  var startWidth=valid?Math.max(26,Math.min(86,origin.width)):44;
  var startHeight=valid?Math.max(22,Math.min(50,origin.height)):32;
  var startLeft=valid?origin.left+(origin.width-startWidth)/2:target.left+target.width/2-startWidth/2;
  var startTop=valid?origin.top+(origin.height-startHeight)/2:target.top+target.height/2-startHeight/2;
  var ghost=el("div","window-ghost");
  ghost.setAttribute("aria-hidden","true");
  ghost.style.left=(startLeft-screen.left)+"px";
  ghost.style.top=(startTop-screen.top)+"px";
  ghost.style.width=startWidth+"px";
  ghost.style.height=startHeight+"px";
  ghost.style.zIndex=String(z+1);
  w.classList.add("window-pending");
  $("windows-area").appendChild(ghost);
  ghost.offsetWidth; /* Force the first wireframe position to render before moving it. */
  ghost.style.left=(target.left-screen.left)+"px";
  ghost.style.top=(target.top-screen.top)+"px";
  ghost.style.width=target.width+"px";
  ghost.style.height=target.height+"px";
  var finished=false,timer;
  function reveal(){
    if(finished)return;
    finished=true;
    clearTimeout(timer);
    ghost.remove();
    w.classList.remove("window-pending");
  }
  ghost.addEventListener("transitionend",function(e){if(e.propertyName==="width")reveal()});
  timer=setTimeout(reveal,700);
}
function windowBox(id,title,width,height){var launcher=document.activeElement;if(opened[id]){if(opened[id].w.classList.contains("minimized"))sfx("restore");opened[id].w.classList.remove("minimized");focus(id);return opened[id].w.querySelector(".window-body")}var w=el("div","window");w.style.width=width+"px";w.style.height=height+"px";var offset=seq++*23;w.style.left=Math.max(8,Math.min(115+offset,window.innerWidth-width-10))+"px";w.style.top=Math.max(8,Math.min(55+offset,window.innerHeight-height-50))+"px";w.innerHTML='<div class="titlebar"><span>▣</span><span class="windowtitle"></span><div class="titlebuttons"><button data-min>_</button><button data-close>×</button></div></div><div class="window-body"></div><div class="window-status">ZebraOS 2.0 / STUDIO COMPUTER</div>';w.querySelector(".windowtitle").textContent=title;var winSymbol=w.querySelector(".titlebar > span:first-child");winSymbol.textContent="";winSymbol.appendChild(osIcon(windowIcon(id),16));$("windows-area").appendChild(w);opened[id]={w:w,title:title};setTimeout(function(){if(document.body.contains(w))sfx("open")},125);w.querySelector("[data-min]").onclick=function(){sfx("minimize");w.classList.add("minimized")};w.querySelector("[data-close]").onclick=function(){sfx("close");w.remove();delete opened[id];task()};w.onpointerdown=function(){focus(id)};var bar=w.querySelector(".titlebar"),drag=null;bar.onpointerdown=function(e){if(e.target.tagName==="BUTTON"||window.innerWidth<701)return;drag={x:e.clientX,y:e.clientY,left:parseInt(w.style.left,10),top:parseInt(w.style.top,10)};bar.setPointerCapture(e.pointerId)};bar.onpointermove=function(e){if(!drag)return;w.style.left=Math.max(0,Math.min(innerWidth-70,drag.left+e.clientX-drag.x))+"px";w.style.top=Math.max(0,Math.min(innerHeight-70,drag.top+e.clientY-drag.y))+"px"};bar.onpointerup=bar.onpointercancel=function(){drag=null};task();focus(id);animateWindowOpen(w,launcher);return w.querySelector(".window-body")}
function button(txt,cb){var b=el("button","classic-button",txt);b.onclick=cb;return b}
function studioManager(){
  if(session!=="admin")return;
  var r=windowBox("manager","STUDIO MANAGER — PRIVATE WORKSPACE",550,440);
  r.innerHTML="";
  var intro=el("div","manager-intro");
  intro.appendChild(el("div","manager-title","ZEBRA RECORD // STUDIO MANAGER"));
  intro.appendChild(el("p","","Prepare your files privately on this device, then publish them separately on GitHub."));
  r.appendChild(intro);
  function section(title,description,cta,callback){
    var card=el("div","manager-card");
    card.appendChild(el("h3","",title));
    card.appendChild(el("p","",description));
    card.appendChild(button(cta,callback));
    r.appendChild(card);
  }
  section("C:\\STUDIO  ·  WORKSPACE","Create folders, import images, audio, maps and other files. Saved locally in this browser, not online.","OPEN LOCAL DRIVE",function(){explorer("local:root");});
  section("STUDIO (GITHUB)  ·  PUBLIC","Preview what your visitors can access. Only committed files appear here.","VIEW PUBLISHED FILES",function(){explorer("github:STUDIO");});
  section("PUBLISH ON GITHUB","When your drafts are ready, upload them to the public repository. GitHub login is required.","OPEN GITHUB UPLOAD",function(){window.open("https://github.com/UrosTrailovic/zebraos/tree/main/STUDIO","_blank","noopener,noreferrer");});
  r.appendChild(el("p","manager-disclaimer","ADMIN ACCESS IS COSMETIC. Do not store secrets in ZebraOS or its public repository."));
}
function explorer(id){
 id=id||"root";
 if(session!=="admin"){
   if(id==="tape")id="github:STUDIO/AUDIO";
   else if(id==="screens")id="github:STUDIO/ARTWORK";
   else if(id.indexOf("github:")!==0)id="github:STUDIO";
 }
 var body=windowBox("explorer","My Computer — C:\\ROOT",560,430);
 body.innerHTML="";
 if(id.indexOf("github:")===0){
  if(window.ZebraGitFiles)window.ZebraGitFiles.mount(body,id.slice(7),{explorer:explorer,osIcon:osIcon,windowBox:windowBox,canUpload:session==="admin"});
  else body.appendChild(el("p","github-drive-error","GitHub est indisponible."));
  return;
 }
 if(!window.ZebraLocalFiles){body.appendChild(el("p","local-disk-error","Disque local indisponible."));return;}
 var options={
  osIcon:osIcon,windowBox:windowBox,
  github:function(path){explorer("github:"+path);},
  playAudio:function(blob,name){
   var url=URL.createObjectURL(blob);
   if(localTracks[0])URL.revokeObjectURL(localTracks[0]);
   localTracks[0]=url;
   tracks[0]=name.replace(/\.[^.]+$/,"");
   player(0);
   var list=opened.amp&&opened.amp.w.querySelector("[data-list]");
   if(list){list.innerHTML="";tracks.forEach(function(n,i){var b=el("button","amp-song",(i+1)+". "+n);b.onclick=function(){pickTrack(i)};list.appendChild(b);});}
  }
 };
 if(id==="root")window.ZebraLocalFiles.home(body,options);
 else if(id==="tape"||id==="screens"||id==="maps")window.ZebraLocalFiles.openNamed(body,id,options);
 else if(id==="recycle")window.ZebraLocalFiles.mount(body,"trash",options);
 else window.ZebraLocalFiles.mount(body,id.indexOf("local:")===0?id.slice(6):"root",options);
}
function msg(title,message){if(/unavailable|denied/i.test(title))sfx("error");var r=windowBox("msg-"+(++seq),title,375,180);r.appendChild(el("p","app-message",message));r.appendChild(button("OK",function(){r.parentNode.remove();Object.keys(opened).forEach(function(k){if(!document.body.contains(opened[k].w))delete opened[k]});task()}))}
function notepad(id){var name=id==="notes"?"MY_NOTES.TXT":(id||"README").toUpperCase()+".TXT";var r=windowBox("note-"+id,name+" - Notepad",480,380);r.innerHTML="";var wrap=el("div","note-editor");var ta=el("textarea");ta.value=id==="notes"?(getStore("zebra.note."+session)||""):docs[id]||"";if(id!=="notes")ta.readOnly=true;wrap.appendChild(ta);if(id==="notes")wrap.appendChild(button("File > Save",function(){setStore("zebra.note."+session,ta.value);msg("Notepad","Enregistré dans ton navigateur.")}));else wrap.appendChild(el("div","desktop-note","Read-only file"));r.appendChild(wrap)}
function viewer(name){var r=windowBox("viewer","Image Viewer - "+name+".JPG",440,340);r.innerHTML="";var p=el("div","viewer-placeholder","[ "+name.toUpperCase()+".JPG ]\n\nArtwork / screenshots à venir");p.style.whiteSpace="pre-line";r.appendChild(p)}
function settings(){var r=windowBox("settings","Control Panel - Display & Sound",Math.min(660,Math.max(390,window.innerWidth-35)),Math.min(570,Math.max(380,window.innerHeight-85)));if(window.ZebraWallpaper)window.ZebraWallpaper.mount(r);else{r.innerHTML="<h3>Display Properties</h3>";r.appendChild(button("Import background...",function(){$("file-wallpaper").click()}));}
r.appendChild(el("h3","", "Sound Properties"));
var mute=button(getStore("zebra.sfx.muted")==="1"?"System sounds: OFF":"System sounds: ON",function(){
  var wasMuted=getStore("zebra.sfx.muted")==="1";
  setStore("zebra.sfx.muted",wasMuted?"0":"1");
  mute.textContent=wasMuted?"System sounds: ON":"System sounds: OFF";
  if(wasMuted)sfx("confirm");
});
r.appendChild(mute);
r.appendChild(button("Test sound",function(){sfx("confirm")}));
r.appendChild(button("Test mouse click",function(){playMechanicalClick("mouseDown");setTimeout(function(){playMechanicalClick("mouseUp")},65)}));
r.appendChild(el("p","desktop-note","Interface sounds: Kenney (CC0). Volume intentionally low."))}
function about(){var r=windowBox("about","System Properties",390,260);r.innerHTML='<div class="props"><b>ZebraOS Professional 2.0</b><br>Studio Edition, December 2026<br>Registered to: Zebra Record<br>Machine: STUDIO-PC-01<br>CPU: 800 MHz<br>RAM: 64 MB<br><br>www.zebratape2.net</div>'}
function format(sec){if(!isFinite(sec)||sec<0)return"00:00";var s=Math.floor(sec);return("0"+Math.floor(s/60)).slice(-2)+":"+("0"+s%60).slice(-2)}
function renderAmp(){var r=opened.amp&&opened.amp.w.querySelector(".window-body");if(!r)return;var tr=r.querySelector("[data-track]"),ti=r.querySelector("[data-time]"),pl=r.querySelector("[data-play]"),seek=r.querySelector("[data-seek]");if(tr)tr.textContent=selectedTrack<0?"NO TRACK LOADED":tracks[selectedTrack];if(ti)ti.textContent=format(music.currentTime)+" / "+format(music.duration);if(pl)pl.textContent=music.paused?"▶":"Ⅱ";if(seek)seek.value=isFinite(music.duration)&&music.duration?Math.floor(100*music.currentTime/music.duration):0;r.querySelectorAll(".amp-song").forEach(function(b,i){b.classList.toggle("active",i===selectedTrack)})}
function pickTrack(i){selectedTrack=i;music.pause();music.src=localTracks[i]||"assets/music/track-"+("0"+(i+1)).slice(-2)+".mp3";music.load();var p=music.play();if(p&&p.catch)p.catch(function(){var r=opened.amp&&opened.amp.w.querySelector("[data-help]");if(r)r.textContent="Aucun MP3 public pour l'instant. Importe les tiens avec le bouton ci-dessous."});renderAmp()}
function player(index){if(session==="admin"&&!opened.amp&&!opened.adminprompt&&!adminApproved){var r=windowBox("adminprompt","ZebraOS Security",390,205);r.innerHTML="<p>ZebraAMP.exe requests administrator privileges.</p><p>Publisher: Zebra Record (unverified)</p>";r.appendChild(button("YES",function(){opened.adminprompt.w.querySelector("[data-close]").click();adminApproved=true;player(index)}));r.appendChild(button("NO",function(){opened.adminprompt.w.querySelector("[data-close]").click();msg("Access denied","Daniel has been notified.")}));return}
var r=windowBox("amp","ZebraAMP.exe",480,470);r.innerHTML='<div class="amp"><div class="amp-header"><span>ZEBRAAMP 2.0</span><span>● STEREO</span></div><div class="amp-screen"><span class="amp-track" data-track>NO TRACK LOADED</span><span class="amp-time" data-time>00:00 / 00:00</span><input type="range" min="0" max="100" value="0" data-seek></div><div class="amp-transport"><button data-prev>Ⅰ◀</button><button data-play>▶</button><button data-stop>■</button><button data-next>▶Ⅰ</button></div><div class="basic-row">VOL <input type="range" min="0" max="100" value="70" data-volume></div><button class="amp-load" data-import>Load MP3(s) from device</button><div class="amp-playlist" data-list></div><div class="amp-help" data-help>Importez vos MP3 pour tester. La tape n’est pas encore publique.</div></div>';
var list=r.querySelector("[data-list]");tracks.forEach(function(n,i){var b=el("button","amp-song",(i+1)+". "+n);b.onclick=function(){pickTrack(i)};list.appendChild(b)});
r.querySelector("[data-play]").onclick=function(){if(selectedTrack<0)pickTrack(0);else if(music.paused){music.play().catch(function(){})}else music.pause();renderAmp()};r.querySelector("[data-stop]").onclick=function(){music.pause();music.currentTime=0;renderAmp()};r.querySelector("[data-prev]").onclick=function(){pickTrack((selectedTrack+8)%9)};r.querySelector("[data-next]").onclick=function(){pickTrack((selectedTrack+1)%9)};r.querySelector("[data-volume]").oninput=function(e){music.volume=e.target.value/100};r.querySelector("[data-seek]").oninput=function(e){if(music.duration)music.currentTime=e.target.value*music.duration/100};r.querySelector("[data-import]").onclick=function(){$("file-music").click()};music.volume=.7;if(index!==undefined)pickTrack(index);else renderAmp()}
function open(code){$("start-menu").classList.add("hidden");if(code==="amp")player();else if(code==="studio-manager")studioManager();else if(code==="settings")settings();else if(code==="about")about();else if(code==="notepad")notepad("notes");else if(code==="viewer")viewer("cover");else if(code.indexOf("explorer:")===0)explorer(code.split(":")[1]);else if(code==="explorer")explorer("root");else if(code.indexOf("txt:")===0)notepad(code.split(":")[1])}
decorateSystemMenus();
$("power-btn").onclick=powerOn;$("skip-boot").onclick=finishBoot;$("skip-session-boot").onclick=finishSessionBoot;$("shutdown-login").onclick=end;$("shutdown-desktop").onclick=end;$("logout").onclick=signout;
$("start-button").onclick=function(e){e.stopPropagation();$("start-menu").classList.toggle("hidden")};document.querySelectorAll("[data-start]").forEach(function(b){b.onclick=function(){open(b.dataset.start)}});document.addEventListener("pointerdown",function(e){if(!e.target.closest("#start-menu")&&!e.target.closest("#start-button"))$("start-menu").classList.add("hidden")});
/* A physical mouse click exists independently of what the computer does afterwards.
   Play the main click on touch pointerup (mobile user activation), and on mouse pointerdown.
   Desktop double-click still works normally. The click no longer relies on quiet OGG playback. */
function isPrimaryPointer(e){return e.isPrimary!==false&&(e.pointerType!=="mouse"||e.button===0)}
document.addEventListener("pointerdown",function(e){
  if(isPrimaryPointer(e)&&e.pointerType!=="touch"&&e.target.closest(".screen.active"))playMechanicalClick("mouseDown");
},{passive:true});
document.addEventListener("pointerup",function(e){
  if(isPrimaryPointer(e)&&e.target.closest(".screen.active")){if(e.pointerType==="touch")playMechanicalClick("mouseDown");else playMechanicalClick("mouseUp");}
},{passive:true});

$("file-wallpaper").onchange=function(e){var f=e.target.files&&e.target.files[0];e.target.value="";if(!f)return;if(window.ZebraWallpaper)window.ZebraWallpaper.importFile(f,session);else setWall(session||"visitor",URL.createObjectURL(f))};
$("file-music").onchange=function(e){localTracks.forEach(function(u){URL.revokeObjectURL(u)});localTracks=[];Array.from(e.target.files).slice(0,9).forEach(function(f,i){localTracks[i]=URL.createObjectURL(f);tracks[i]=f.name.replace(/\.[^.]+$/,"")});player();var p=opened.amp.w.querySelector("[data-list]");p.innerHTML="";tracks.forEach(function(n,i){var b=el("button","amp-song",(i+1)+". "+n);b.onclick=function(){pickTrack(i)};p.appendChild(b)});if(localTracks.length)pickTrack(0)};
["play","pause","timeupdate","loadedmetadata","ended"].forEach(function(event){music.addEventListener(event,function(){if(event==="ended"&&selectedTrack<8)pickTrack(selectedTrack+1);renderAmp()})});
function clock(){var d=new Date();$("clock").textContent=("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2)}clock();setInterval(clock,30000);
}());
