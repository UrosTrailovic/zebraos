
/* ZebraOS 2.0 / Studio edition — prototype v0.1, plain JavaScript */
(function(){
"use strict";
var $=function(id){return document.getElementById(id)};
var users=[["visitor","Visiteur","Session publique","V"],["zebra","Zebra","Session du studio","Z"],["admin","Admin","Gestion du studio","A"],["daniel","Daniel","...","?"]];
var wallpaper={visitor:"visitor",zebra:"zebra",admin:"admin",daniel:"daniel"};
var session=null,opened={},z=20,seq=0,adminApproved=false,adminLoginUnlocked=false;
/* Local filesystem replaces the former demo-only filenames. */
var docs={
readme:"ZEBRA RECORD // ORDINATEUR DU STUDIO\n\nBienvenue sur ZebraOS.\n\nCette machine contient ZEBRA TAPE 2, une map Counter-Strike 1.6, des documents et des archives du studio.\n\nExplore les fichiers du studio. Ne formate pas C:.\n\nwww.zebratape2.net",
album:"ZEBRA TAPE 2\nDÉCEMBRE 2026\n\nLISTE DES TITRES À CONFIRMER\n9 MORCEAUX\n\nwww.zebratape2.net",
install:"SADATE — COUNTER-STRIKE 1.6\n\nLa map sera téléchargeable ici une fois terminée.\nFichier ZIP et textures à venir.",
daniel:"DANIEL\n\nCe fichier n'est pas à toi.\n\nPourquoi tu l'ouvres ?\n\n-- Daniel",
mix:"final_final_FINAL_v17\n\nCelle-là c'est la bonne (peut-être).",
recycle:"NE PAS SUPPRIMER CE FICHIER.\n\nTrop tard."
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
  if(name==="snake"){
    var znak=el("img","os-icon-graphic");
    znak.src="/STUDIO/BUREAU/Jeux/Znake.exe.zebraos.json.icone.png?v=1";
    znak.alt="";znak.width=size;znak.height=size;
    znak.style.width=size+"px";znak.style.height=size+"px";znak.style.objectFit="contain";
    znak.setAttribute("aria-hidden","true");return znak;
  }
  if(name==="tetris"||name==="snake"||name==="paint"||name==="racer"){
    var retro=el("span","zapp-icon zapp-"+name,name==="tetris"?"▦":name==="snake"?"▥":name==="racer"?"◇":"✎");
    retro.style.width=size+"px";retro.style.height=size+"px";
    retro.style.fontSize=Math.round(size*.63)+"px";
    retro.setAttribute("aria-hidden","true");return retro;
  }
  if(name==="calc"||name==="sticky"||name==="planner"){
   var mini=el("span","zu-app-icon "+name,name==="calc"?"＋":name==="sticky"?"✎":"31");
   mini.style.width=size+"px";mini.style.height=size+"px";mini.style.fontSize=Math.max(10,Math.round(size*.46))+"px";
   mini.setAttribute("aria-hidden","true");return mini;
 }
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
  if(id==="tetris"||id==="snake"||id==="paint"||id==="racer"||id==="calc"||id==="sticky"||id==="planner")return id;
  if(id==="explorer")return "computer";
  if(id==="settings")return "control-panel";
  if(id==="manager")return "computer";
  if(id==="viewer")return "jpg";
  if(id==="about")return "zebraos";
  if(id==="adminprompt")return "settings";
  return "txt";
}
function decorateSystemMenus(){
  var mappings={amp:"zebraamp",explorer:"computer",notepad:"txt",viewer:"jpg",settings:"control-panel",about:"zebraos",tetris:"tetris",snake:"snake",racer:"racer",paint:"paint","folder:games":"folder","folder:tools":"folder","folder:atelier":"folder",calc:"calc",sticky:"sticky",planner:"planner"};
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
/* Only the OS logo boot is shown on arrival. A minimal dark off-screen
 * remains available for the user-initiated "Éteindre" command. */
function show(id){
 ["power-screen","boot-screen","login-screen","session-boot-screen","desktop-screen"]
 .forEach(function(s){$(s).classList.toggle("active",s===id);});
}
/* Power / studio startup audio. The user clicks POWER so playback is permitted on phones. */
var studioBootAssets=window.ZebraBootAssets||{};
var bootAudio=new Audio(studioBootAssets.startup||"");
var sessionAudio=new Audio(studioBootAssets.sessionstartup||studioBootAssets.session||"");
document.querySelectorAll(".zboot-logo,.zboot-session-logo").forEach(function(img){
  if(studioBootAssets.logo)img.src=studioBootAssets.logo;
});
bootAudio.preload="auto";sessionAudio.preload="auto";
var bootTimer=0,powerTimer=0,sessionTimer=0,booting=false,sessionBooting=false,pendingSession=null;
function playBootTrack(track){
  try {track.pause();track.currentTime=0;var p=track.play();if(p&&p.catch)p.catch(function(){});}catch(e){}
}
function finishBoot(){
  if(!booting)return;
  booting=false;clearTimeout(bootTimer);
  bootAudio.pause();login();
}
function startLogoBoot(){
 stopBootSequences();
 booting=true;
 var logoFrame=document.querySelector("#boot-screen .zboot-logo-frame");
 if(logoFrame){
  logoFrame.style.animation="none";
  void logoFrame.offsetWidth;
  logoFrame.style.removeProperty("animation");
 }
 show("boot-screen");
 playBootTrack(bootAudio);
 bootTimer=setTimeout(finishBoot,5200);
}
function powerOn(){startLogoBoot();}
function finishSessionBoot(){
  if(!sessionBooting)return;
  sessionBooting=false;clearTimeout(sessionTimer);sessionAudio.pause();
  session=pendingSession;pendingSession=null;
  adminApproved=false;closeAll();
  if(window.ZebraWallpaper)window.ZebraWallpaper.apply(session);else setWall(getStore("zebra.wall."+session)||session);desk();show("desktop-screen");if(window.ZebraTools)window.ZebraTools.stickyDesktop(session);
}
function beginSessionBoot(id){
  if(sessionBooting)return;
  pendingSession=id;sessionBooting=true;
  var name=users.filter(function(u){return u[0]===id})[0];
  $("zboot-session-label").textContent="BIENVENUE "+(name?name[1].toUpperCase():"UTILISATEUR");
  show("session-boot-screen");
  playBootTrack(sessionAudio);
  sessionTimer=setTimeout(finishSessionBoot,3600);
}
function skipStartupKey(event){
  if(event.isComposing||!(event.key==="Escape"||event.key===" "||event.code==="Space"))return;
  var finish=null;
  if($("power-screen").classList.contains("active")&&(event.key===" "||event.code==="Space"))finish=function(){
    var shell=$("power-screen"),facade=shell.querySelector(".zp3-machine");
    if(facade&&!facade.classList.contains("zp3-revealed"))shell.click();
    else{var btn=$("power-btn");if(btn&&!btn.disabled)btn.click();}
  };
  else if(booting&&$("boot-screen").classList.contains("active"))finish=finishBoot;
  else if(sessionBooting&&$("session-boot-screen").classList.contains("active"))finish=finishSessionBoot;
  if(!finish)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!event.repeat)finish();
}
document.addEventListener("keydown",skipStartupKey,true);
function stopBootSequences(){
  booting=false;sessionBooting=false;pendingSession=null;
  clearTimeout(powerTimer);clearTimeout(bootTimer);clearTimeout(sessionTimer);
  $("power-screen").classList.remove("powering-on");
  bootAudio.pause();sessionAudio.pause();
}
function login(){
 var r=$("login-users");r.innerHTML="";
 users.forEach(function(u){
  var b=el("button","user-card user-"+u[0]);
  b.type="button";
  b.innerHTML='<span class="user-avatar" aria-hidden="true"></span><span class="user-name"></span><span class="user-sub"></span>';
  var avatar=b.children[0];
  // Avatars rétro provisoires : les vraies photos pourront remplacer le contenu du cadre.
  if(u[0]==="visitor"){
    avatar.appendChild(el("span","user-silhouette"));
  }else{
    var icons={zebra:"zebraos",admin:"control-panel",daniel:"help"};
    avatar.appendChild(osIcon(icons[u[0]]||"help",72));
  }
  b.children[1].textContent=u[1];
  b.children[2].textContent=u[2]==="..."?"":u[2];
  b.onclick=function(){sfx("confirm");start(u[0]);};
  r.appendChild(b);
 });
 show("login-screen");
}
/* Studio operator login. A client-side password is for roleplay / casual access
   only, NOT real authentication. Never store confidential material in this site. */
var adminPasswordDigest="e5be98a98f2a095123d497892f346cc70153c9d348f276a639fcbbe946183f30";
function requestAdminPassword(){
  var existing=document.querySelector(".admin-login-mask");
  if(existing){existing.querySelector("input").focus();return;}
  var mask=el("div","admin-login-mask");
  var panel=el("form","admin-login-dialog");
  panel.setAttribute("autocomplete","off");
  panel.appendChild(el("div","admin-login-banner","ZebraOS Studio / Connexion"));
  panel.appendChild(el("div","admin-login-symbol","Z"));
  panel.appendChild(el("p","admin-login-text","ACCÈS ADMINISTRATEUR"));
  panel.appendChild(el("p","admin-login-intro","Saisis ton mot de passe pour accéder à l’espace de gestion."));
  var input=el("input","admin-login-input");
  input.type="password";
  input.autocomplete="off";
  input.spellcheck=false;
  input.placeholder="Mot de passe";
  input.setAttribute("aria-label","Mot de passe Admin");
  var error=el("div","admin-login-error","");
  error.setAttribute("role","status");
  var actions=el("div","admin-login-actions");
  var cancel=el("button","admin-login-cancel","ANNULER");
  cancel.type="button";
  cancel.onclick=function(){mask.remove();};
  var submit=el("button","admin-login-submit","SE CONNECTER");
  submit.type="submit";
  actions.appendChild(cancel);actions.appendChild(submit);
  panel.appendChild(input);panel.appendChild(error);panel.appendChild(actions);
  panel.onsubmit=function(event){
    event.preventDefault();
    var pass=input.value;
    input.value="";
    submit.disabled=true;
    error.textContent="Vérification du mot de passe…";
    if(!window.crypto||!window.crypto.subtle||!window.TextEncoder){
      error.textContent="Vérification indisponible sur ce navigateur.";submit.disabled=false;return;
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
        error.textContent="ACCÈS REFUSÉ — Mot de passe incorrect";
        input.focus();
        submit.disabled=false;
      }
    }).catch(function(){
      error.textContent="Vérification impossible. Réessaie.";
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
var shutdownRunning=false,shutdownTimer=0;
function end(){
 if(shutdownRunning)return;
 shutdownRunning=true;
 sfx("switch");
 stopBootSequences();
 if(window.ZebraAMP)window.ZebraAMP.stop();
 var screen=document.querySelector(".screen.active");
 var effect=$("shutdown-effect");
 var reduceMotion=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 if(screen)screen.classList.add("zshutdown-collapse");
 document.body.classList.add("zshutdown-running");
 if(effect){
  effect.hidden=false;
  effect.classList.remove("running");
  void effect.offsetWidth;
  effect.classList.add("running");
 }
 clearTimeout(shutdownTimer);
 shutdownTimer=setTimeout(function(){
  adminApproved=false;adminLoginUnlocked=false;
  closeAll();session=null;
  // Return to the empty textured plastic cover. Clicking it reveals the machine.
  show("power-screen");
  if(screen)screen.classList.remove("zshutdown-collapse");
  document.body.classList.remove("zshutdown-running");
  if(effect){effect.classList.remove("running");effect.hidden=true;}
  shutdownRunning=false;
 },reduceMotion?100:1650);
}
function restartLogin(){
 sfx("switch");
 if(window.ZebraAMP)window.ZebraAMP.stop();
 adminApproved=false;adminLoginUnlocked=false;
 closeAll();session=null;
 startLogoBoot();
}
function signout(){sfx("switch");stopBootSequences();if(window.ZebraAMP)window.ZebraAMP.stop();adminLoginUnlocked=false;closeAll();session=null;login()}
function getStore(k){try{return localStorage.getItem(k)}catch(e){return null}}
function setStore(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function setWall(name,custom){var w=$("wallpaper");w.className="wallpaper wallpaper-"+name;w.style.backgroundImage=custom?'url("'+custom+'")':"";w.style.backgroundSize=custom?"cover":"";if(session&&!custom)setStore("zebra.wall."+session,name)}
function isTouchOpen(e){return (e && e.pointerType==="touch") || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || window.innerWidth<701;}
/* Le bureau entier vient de STUDIO/BUREAU : dossiers, fichiers et raccourcis .zebraos.json. */
var bureauRepaint=null,bureauListenerSet=false,bureauEpoch=0;
function desk(){
 var root=$("desktop-icons");
 root.innerHTML="";
 var epoch=++bureauEpoch,currentSession=session;
 if(window.ZebraDesktop)window.ZebraDesktop.setup(session,
   function(){if(bureauRepaint)bureauRepaint();},
   function(){openDesktopTrash();},osIcon);
 function shortcut(title,symbol,action,userFile,path){
  var b=el("button","desk-icon"+(userFile?" desk-user-file":""));
  b.type="button";b.title=title;
  if(path)b.dataset.path=path;
  b._zebraOpen=action;
  b.innerHTML='<span class="desk-symbol"></span><span class="desk-caption"></span>';
  b.children[0].appendChild(symbol);
  b.children[1].textContent=title;
  b.onclick=function(e){
   document.querySelectorAll(".desk-icon").forEach(function(x){x.classList.remove("selected")});
   b.classList.add("selected");
   if(Date.now()<(b._zebraDragUntil||0))return;
   if(isTouchOpen(e)||e.detail===0)action();
  };
  b.ondblclick=function(e){if(!isTouchOpen(e)&&Date.now()>=(b._zebraDragUntil||0))action();};
  root.appendChild(b);return b;
 }
 function renderUserFiles(){
  if(epoch!==bureauEpoch||currentSession!==session)return;
  Array.prototype.forEach.call(root.querySelectorAll(".desk-user-file"),function(b){b.remove();});
  var lib=window.ZebraGitFiles;
  if(!lib)return;
  lib.list(lib.root).filter(function(item){
   return (!item.sessions||item.sessions.includes(session))
     &&item.app!=="explorer:recycle"
     &&(!window.ZebraDesktop||!window.ZebraDesktop.isTrashed(session,item.path));
  }).forEach(function(item){
    shortcut(item.name,lib.icon(item,osIcon,40),function(){
      if(item.type==="dir")explorer("github:"+item.path);
      else lib.openFile(item,{windowBox:windowBox,session:session,openApp:open,openAudio:function(file){if(window.ZebraAMP){window.ZebraAMPConfig={windowBox:windowBox};window.ZebraAMP.openPublic(file);}}});
    },true,item.path);
  });
  if(window.ZebraDesktop)window.ZebraDesktop.bind();
 }
 bureauRepaint=renderUserFiles;
 if(window.ZebraGitFiles){
  if(!bureauListenerSet){
   bureauListenerSet=true;
   window.ZebraGitFiles.subscribe(function(){if(bureauRepaint)bureauRepaint();});
  }
  window.ZebraGitFiles.load().then(function(){renderUserFiles();});
 }
}
function closeAll(){if(window.ZebraDesktop)window.ZebraDesktop.dispose();Object.keys(opened).forEach(function(k){var body=opened[k].w.querySelector(".window-body");if(body&&body._zebraDispose)body._zebraDispose();opened[k].w.remove()});opened={};var layer=$("desktop-screen").querySelector(".zu-sticky-layer");if(layer)layer.remove();$("task-items").innerHTML="";$("start-menu").classList.add("hidden")}
function task(){var r=$("task-items");r.innerHTML="";Object.keys(opened).forEach(function(k){var p=opened[k],b=el("button","win-button",p.title);b.onclick=function(){if(p.w.classList.contains("minimized")){p.w.classList.remove("minimized");focus(k);sfx("restore")}else{p.w.classList.add("minimized");sfx("minimize")}};r.appendChild(b)})}
function focus(id){if(opened[id]){opened[id].w.style.zIndex=++z;Object.keys(opened).forEach(function(k){opened[k].w.classList.toggle("focused",k===id)})}}
/* Old-school wireframe animation: the outline travels first, the actual window snaps in after it. */
function animateWindowOpen(w,launcher){
  if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  // Cache le rendu COMPOSÉ de toute la fenêtre (même si un logo/image
  // interne force visibility:visible). L'animation ne montre que le contour.
  w.style.opacity="0";
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
    w.style.removeProperty("opacity");
  }
  ghost.addEventListener("transitionend",function(e){if(e.propertyName==="width")reveal()});
  timer=setTimeout(reveal,700);
}
/* Fenêtres ZebraOS : agrandissement, restauration, déplacement et 8 poignées de redimensionnement. */
function desktopWorkArea(){
 var desktop=$("desktop-screen");
 var rect=desktop&&desktop.getBoundingClientRect?desktop.getBoundingClientRect():null;
 var taskbar=desktop&&desktop.querySelector(".taskbar");
 var taskHeight=taskbar&&taskbar.getBoundingClientRect?taskbar.getBoundingClientRect().height:36;
 return {
  width:Math.max(280,(rect&&rect.width)||window.innerWidth),
  height:Math.max(170,((rect&&rect.height)||window.innerHeight)-(taskHeight||36))
 };
}
function windowMaxWidth(w,area){
 var requested=Number(w.dataset&&w.dataset.maxWidth);
 return Math.min(area.width,requested>0?Math.max(250,requested):area.width);
}
function clampWindow(w){
 if(!w||w.classList.contains("maximized"))return;
 var area=desktopWorkArea();
 var width=Math.min(Math.max(250,parseFloat(w.style.width)||500),windowMaxWidth(w,area));
 var height=Math.min(Math.max(180,parseFloat(w.style.height)||350),area.height);
 var left=Math.max(0,Math.min(parseFloat(w.style.left)||0,area.width-width));
 var top=Math.max(0,Math.min(parseFloat(w.style.top)||0,area.height-height));
 w.style.width=Math.round(width)+"px";
 w.style.height=Math.round(height)+"px";
 w.style.left=Math.round(left)+"px";
 w.style.top=Math.round(top)+"px";
}
function maximizeWindow(w,force){
 if(!w)return;
 var makeMax=typeof force==="boolean"?force:!w.classList.contains("maximized");
 var btn=w.querySelector("[data-max]");
 if(makeMax){
  if(w.classList.contains("maximized"))return;
  w._restoreGeometry={
   left:w.style.left,top:w.style.top,
   width:w.style.width,height:w.style.height
  };
  w.classList.add("maximized");
  if(btn){btn.textContent="❐";btn.title="Restaurer";btn.setAttribute("aria-label","Restaurer la fenêtre");}
 }else{
  if(!w.classList.contains("maximized"))return;
  w.classList.remove("maximized");
  var old=w._restoreGeometry;
  if(old){Object.keys(old).forEach(function(k){w.style[k]=old[k];});}
  clampWindow(w);
  if(btn){btn.textContent="□";btn.title="Agrandir";btn.setAttribute("aria-label","Agrandir la fenêtre");}
 }
}
function addResizeHandles(w){
 var edges=["n","s","e","w","ne","nw","se","sw"];
 edges.forEach(function(edge){
  var handle=el("div","window-resize-handle resize-"+edge);
  handle.setAttribute("role","separator");
  handle.setAttribute("aria-label","Redimensionner la fenêtre");
  handle.title="Redimensionner";
  handle.onpointerdown=function(e){
   if(window.innerWidth<=700||w.classList.contains("maximized")||e.button!==0)return;
   e.stopPropagation();e.preventDefault();focusWindow();
   var initial={
    x:e.clientX,y:e.clientY,
    left:parseFloat(w.style.left)||0,
    top:parseFloat(w.style.top)||0,
    width:w.offsetWidth,height:w.offsetHeight
   };
   var active=true,area=desktopWorkArea(),minWidth=250,minHeight=180,maxWidth=windowMaxWidth(w,area);
   function move(ev){
    if(!active)return;
    var dx=ev.clientX-initial.x,dy=ev.clientY-initial.y;
    var l=initial.left,t=initial.top,r=l+initial.width,b=t+initial.height;
    if(edge.includes("w"))l=Math.max(0,Math.min(l+dx,r-minWidth));
    if(edge.includes("e"))r=Math.max(l+minWidth,Math.min(r+dx,area.width,l+maxWidth));
    if(edge.includes("w"))l=Math.max(l,r-maxWidth);
    if(edge.includes("n"))t=Math.max(0,Math.min(t+dy,b-minHeight));
    if(edge.includes("s"))b=Math.max(t+minHeight,Math.min(b+dy,area.height));
    w.style.left=Math.round(l)+"px";
    w.style.top=Math.round(t)+"px";
    w.style.width=Math.round(r-l)+"px";
    w.style.height=Math.round(b-t)+"px";
   }
   function stop(){
    if(!active)return;
    active=false;
    window.removeEventListener("pointermove",move);
    window.removeEventListener("pointerup",stop);
    window.removeEventListener("pointercancel",stop);
    clampWindow(w);
   }
   window.addEventListener("pointermove",move);
   window.addEventListener("pointerup",stop);
   window.addEventListener("pointercancel",stop);
   function focusWindow(){
    var key=Object.keys(opened).find(function(id){return opened[id].w===w;});
    if(key)focus(key);
   }
  };
  w.appendChild(handle);
 });
}
function windowBox(id,title,width,height){
 var launcher=document.activeElement;
 if(opened[id]){
  if(opened[id].w.classList.contains("minimized"))sfx("restore");
  opened[id].w.classList.remove("minimized");
  focus(id);
  return opened[id].w.querySelector(".window-body");
 }
 var w=el("div","window");
 if(id==="amp"){w.classList.add("amp-window");w.dataset.maxWidth="960";}
 var area=desktopWorkArea();
 w.style.width=Math.min(width,windowMaxWidth(w,area))+"px";
 w.style.height=Math.min(height,area.height)+"px";
 var offset=seq++*23;
 w.style.left=Math.max(0,Math.min(115+offset,area.width-parseFloat(w.style.width)))+"px";
 w.style.top=Math.max(0,Math.min(55+offset,area.height-parseFloat(w.style.height)))+"px";
 w.innerHTML='<div class="titlebar"><span>▣</span><span class="windowtitle"></span><div class="titlebuttons"><button data-min title="Réduire" aria-label="Réduire la fenêtre">_</button><button data-max title="Agrandir" aria-label="Agrandir la fenêtre">□</button><button data-close title="Fermer" aria-label="Fermer la fenêtre">×</button></div></div><div class="window-body"></div>';
 w.querySelector(".windowtitle").textContent=title;
 var symbol=w.querySelector(".titlebar > span:first-child");
 symbol.textContent="";
 symbol.appendChild(osIcon(windowIcon(id),16));
 $("windows-area").appendChild(w);
 opened[id]={w:w,title:title};
 setTimeout(function(){if(document.body.contains(w))sfx("open");},125);
 w.querySelector("[data-min]").onclick=function(){sfx("minimize");w.classList.add("minimized");};
 w.querySelector("[data-max]").onclick=function(){sfx("restore");maximizeWindow(w);focus(id);};
 w.querySelector("[data-close]").onclick=function(){sfx("close");var body=w.querySelector(".window-body");if(body&&body._zebraDispose)body._zebraDispose();w.remove();delete opened[id];task();};
 w.onpointerdown=function(){focus(id);};
 var bar=w.querySelector(".titlebar"),drag=null;
 bar.ondblclick=function(e){
  if(e.target.closest(".titlebuttons"))return;
  maximizeWindow(w);focus(id);
 };
 bar.onpointerdown=function(e){
  if(e.target.closest(".titlebuttons")||window.innerWidth<=700||w.classList.contains("maximized")||e.button!==0)return;
  drag={x:e.clientX,y:e.clientY,left:parseFloat(w.style.left)||0,top:parseFloat(w.style.top)||0};
  bar.setPointerCapture(e.pointerId);
 };
 bar.onpointermove=function(e){
  if(!drag)return;
  var bounds=desktopWorkArea();
  w.style.left=Math.max(0,Math.min(bounds.width-80,drag.left+e.clientX-drag.x))+"px";
  w.style.top=Math.max(0,Math.min(bounds.height-30,drag.top+e.clientY-drag.y))+"px";
 };
 bar.onpointerup=bar.onpointercancel=function(){drag=null;};
 addResizeHandles(w);
 task();focus(id);animateWindowOpen(w,launcher);
 return w.querySelector(".window-body");
}
function button(txt,cb){var b=el("button","classic-button",txt);b.onclick=cb;return b}
function studioManager(){
 if(session!=="admin")return;
 var root=windowBox("manager","GESTIONNAIRE STUDIO — BUREAU",Math.min(620,innerWidth-20),Math.min(455,innerHeight-65));
 root.innerHTML="";
 var head=el("div","manager-intro");
 head.appendChild(el("div","manager-title","ZEBRA RECORD // GESTION DU BUREAU"));
 head.appendChild(el("p","","Tous les dossiers et fichiers affichés dans ZebraOS proviennent de STUDIO/BUREAU sur GitHub."));
 root.appendChild(head);
 root.appendChild(el("p","manager-warning","Pas de dossiers de démonstration. Ajoute uniquement ce que tu veux montrer sur le bureau."));
 function group(title,body,label,fn){
  var card=el("div","manager-card");
  card.appendChild(el("div","manager-step-number",title.charAt(0)));
  var details=el("div","manager-step-content");
  details.appendChild(el("h3","",title));
  details.appendChild(el("p","",body));
  card.appendChild(details);
  card.appendChild(button(label,fn));
  root.appendChild(card);
 }
 function external(url){window.open(url,"_blank","noopener,noreferrer");}
 group("1. CRÉER ET ORGANISER",
  "Sur GitHub, crée tes dossiers dans STUDIO/BUREAU et ajoute autant de sous-dossiers que tu veux. Un dossier vide doit contenir un fichier .gitkeep.",
  "OUVRIR LE BUREAU GITHUB",
  function(){external("https://github.com/UrosTrailovic/zebraos/tree/main/STUDIO/BUREAU");});
 group("2. IMPORTER DES FICHIERS",
  "Ajoute tes images, morceaux MP3, documents et archives avec le bouton d'envoi de GitHub. Après l'enregistrement, l'index est généré automatiquement.",
  "AJOUTER DES FICHIERS",
  function(){external("https://github.com/UrosTrailovic/zebraos/upload/main/STUDIO/BUREAU");});
 group("3. CHOISIR UNE ICÔNE",
  "Dans un dossier, ajoute une image nommée icone.png. Pour un fichier, place NOM.ext.icone.png juste à côté. ZebraOS masque ces images techniques et utilise leurs visuels comme icônes.",
  "VOIR LE BUREAU",
  function(){explorer("github:STUDIO/BUREAU");});
 root.appendChild(el("p","manager-disclaimer","Les fichiers GitHub sont publics. La session Admin n'est pas une authentification sécurisée."));
}
function explorer(id){
 id=id||"root";
 var body=windowBox("explorer","Poste de travail — BUREAU",560,430);
 body.innerHTML="";
 if(id==="recycle"&&session==="admin"&&window.ZebraLocalFiles){
  window.ZebraLocalFiles.mount(body,"trash",{
   osIcon:osIcon,windowBox:windowBox,
   github:function(){explorer("root");},
   playAudio:function(){}
  });
  return;
 }
 var path=id.indexOf("github:")===0?id.slice(7):"STUDIO/BUREAU";
 if(window.ZebraGitFiles){
  window.ZebraGitFiles.mount(body,path,{
   explorer:explorer,osIcon:osIcon,windowBox:windowBox,canUpload:session==="admin",session:session,openApp:open,
   openAudio:function(file){if(window.ZebraAMP){window.ZebraAMPConfig={windowBox:windowBox};window.ZebraAMP.openPublic(file);}}
  });
 }else body.appendChild(el("p","github-drive-error","Le bureau n'a pas pu être chargé."));
}
/* Corbeille du bureau : objets GitHub simplement masqués localement,
   avec accès à l'ancienne corbeille des fichiers personnels en Admin. */
function openDesktopTrash(){
 var body=windowBox("desktop-trash","Corbeille — ZebraOS",Math.min(490,innerWidth-16),Math.min(415,innerHeight-54));
 if(window.ZebraDesktop)window.ZebraDesktop.showTrash(body,session,session==="admin"?function(){explorer("recycle");}:null);
}
function msg(title,message){if(/unavailable|denied/i.test(title))sfx("error");var r=windowBox("msg-"+(++seq),title,375,180);r.appendChild(el("p","app-message",message));r.appendChild(button("OK",function(){r.parentNode.remove();Object.keys(opened).forEach(function(k){if(!document.body.contains(opened[k].w))delete opened[k]});task()}))}
function notepad(id){var name=id==="notes"?"MES_NOTES.TXT":id==="readme"?"LISEZMOI.TXT":(id||"LISEZMOI").toUpperCase()+".TXT";var r=windowBox("note-"+id,name+" — Bloc-notes",480,380);r.innerHTML="";var wrap=el("div","note-editor");var ta=el("textarea");ta.value=id==="notes"?(getStore("zebra.note."+session)||""):docs[id]||"";if(id!=="notes")ta.readOnly=true;wrap.appendChild(ta);if(id==="notes")wrap.appendChild(button("Fichier > Enregistrer",function(){setStore("zebra.note."+session,ta.value);msg("Bloc-notes","Enregistré dans ton navigateur.")}));else wrap.appendChild(el("div","desktop-note","Fichier en lecture seule"));r.appendChild(wrap)}
function viewer(name){var r=windowBox("viewer","Visionneuse d’images — "+name+".JPG",440,340);r.innerHTML="";var p=el("div","viewer-placeholder","[ "+name.toUpperCase()+".JPG ]\n\nImages et captures à venir");p.style.whiteSpace="pre-line";r.appendChild(p)}
/* Réglage de l’ordinateur ZebraOS — les fenêtres restent indépendantes. */
function panelContext(){
 return {
  windowBox:windowBox,session:function(){return session||"visiteur";},
  sfx:sfx,clickSound:function(){
   playMechanicalClick("mouseDown");
   setTimeout(function(){playMechanicalClick("mouseUp");},65);
  },
  openApp:open,updateClock:clock,
  closeWindow:function(id){
   if(opened[id]){opened[id].w.remove();delete opened[id];task();}
  }
 };
}
function settings(){
 var root=windowBox("settings","Réglage de l’ordinateur",Math.min(660,window.innerWidth-20),Math.min(475,window.innerHeight-60));
 if(window.ZebraControlPanel)window.ZebraControlPanel.mount(root,panelContext());
 else root.textContent="Impossible de charger le Réglage de l’ordinateur.";
}
function about(){if(window.ZebraControlPanel)window.ZebraControlPanel.about(panelContext());}
function dateTime(){if(window.ZebraControlPanel)window.ZebraControlPanel.dateTime(panelContext());}
function welcome(){if(window.ZebraControlPanel)window.ZebraControlPanel.welcome(panelContext());}
function format(sec){if(!isFinite(sec)||sec<0)return"00:00";var s=Math.floor(sec);return("0"+Math.floor(s/60)).slice(-2)+":"+("0"+s%60).slice(-2)}
/* ZebraAMP 3.0 est maintenant un composant autonome. */
function player(){
 if(!window.ZebraAMP)return;
 window.ZebraAMPConfig={windowBox:windowBox};
 window.ZebraAMP.open();
}
/* Dossiers réels : le même contenu depuis le Bureau et Poste de travail. */
function appFolder(type){
 explorer("github:STUDIO/BUREAU/"+(type==="games"?"Jeux":"Outils"));
}
function openUtility(name){
 var tools=window.ZebraTools;if(!tools)return;
 var config={calc:["ZebraCalc.exe",410,580,"calculator"],sticky:["ZebraSticky.exe",640,510,"stickyManager"],planner:["ZebraPlanner.exe",690,680,"planner"]}[name];
 if(!config)return;
 var body=windowBox(name,config[0],Math.min(config[1],innerWidth-12),Math.min(config[2],innerHeight-48));
 if(body._zebraApp===name)return;
 body._zebraApp=name;
 if(name==="sticky")tools.stickyManager(body,session,function(){tools.stickyDesktop(session);});
 else tools[config[3]](body,session);
}
/* ZebraOS lazy apps: rien n'est téléchargé avant le premier lancement.
   Le navigateur + Service Worker conservent les fichiers après ce chargement. */
var gameModules={
 tetris:{name:"Tetris.exe",width:735,height:770,global:"ZebraTetris",
  files:["tetris-artwork.js?v=1.8","tetris.js?v=3.1"]},
 snake:{name:"Znake.exe",width:650,height:700,global:"ZebraSnake",
  files:["snake.js?v=8.7"],css:"snake.css?v=8.9"},
 racer:{name:"Echo Racer.exe",width:750,height:790,global:"ZebraEchoRacer",
  files:["echo-racer.js?v=13.0"],css:"echo-racer.css?v=13.1"},
 paint:{name:"ZebraPaint.exe",width:850,height:640,global:"ZebraPaint",
  files:["paint.js?v=1.4"],css:"paint-responsive.css?v=1.4"}
};
var assetPromises={};
function loadAsset(url,css){
 if(assetPromises[url])return assetPromises[url];
 assetPromises[url]=new Promise(function(resolve,reject){
  var el=document.createElement(css?"link":"script");
  if(css){el.rel="stylesheet";el.href=url;}
  else{el.src=url;el.async=false;}
  el.onload=function(){resolve();};
  el.onerror=function(){
   delete assetPromises[url];el.remove();
   reject(Error("Chargement impossible : "+url));
  };
  document.head.appendChild(el);
 });
 return assetPromises[url];
}
function loadGameModule(name){
 var module=gameModules[name];if(!module)return Promise.reject(Error("Application inconnue"));
 if(window[module.global])return Promise.resolve(window[module.global]);
 if(module.pending)return module.pending;
 module.pending=(module.css?loadAsset(module.css,true):Promise.resolve())
  .then(function(){
    // Ordre garanti : illustration/ressources d'abord, moteur ensuite.
    return module.files.reduce(function(p,url){
      return p.then(function(){return loadAsset(url,false);});
    },Promise.resolve());
  }).then(function(){
    if(!window[module.global])throw Error("Module non initialisé : "+name);
    return window[module.global];
  }).finally(function(){module.pending=null;});
 return module.pending;
}
/* Chrome Android forbids audio first started after lazy-loading promises.
 * Prime Znake's menu theme while the desktop-click is still a user gesture,
 * then hand this exact Audio instance to snake.js after its window mounts. */
function stopZnakeMenuPrimer(root){
 var primer=window.ZnakeMenuPrimer;
 if(!primer||primer.root!==root)return;
 window.ZnakeMenuPrimer=null;
 if(primer.audio){
  try{primer.audio.pause();primer.audio.removeAttribute("src");primer.audio.load();}catch(_){}
 }
}
function primeZnakeMenu(root){
 if(window.ZnakeMenuPrimer)stopZnakeMenuPrimer(window.ZnakeMenuPrimer.root);
 try{
  if(localStorage.getItem("zebra.snake.music")==="off"||
     localStorage.getItem("zebra.sfx.muted")==="1"||
     document.hidden)return;
  var audio=new Audio("/assets/games/snake/Znake-menu-theme.mp3?v=1");
  audio.loop=true;
  audio.volume=.26;
  audio.preload="auto";
  window.ZnakeMenuPrimer={root:root,audio:audio};
  // Execute play() *synchronously* before the click callback returns.
  var started=audio.play();
  if(started&&started.catch)started.catch(function(){
   // A tap inside the menu can retry without allocating a second player.
  });
 }catch(_){stopZnakeMenuPrimer(root);}
}
function openGame(name){
 var entry=gameModules[name];if(!entry)return;
 var root=windowBox(name,entry.name,
   Math.min(entry.width,window.innerWidth-16),Math.min(entry.height,window.innerHeight-50));
 if(name==="tetris"||name==="snake"||name==="racer")root.classList.add("zebra-game-body");
 // Pas de reset d'une application déjà ouverte ou en cours de chargement.
 if(root._zebraApp===name||root._zebraLoading===name)return;
 if(name==="snake")primeZnakeMenu(root);
 root._zebraLoading=name;
 root.innerHTML="";
 var info=el("div","zebra-lazy-loading","Chargement de "+entry.name+"…");
 info.setAttribute("role","status");info.setAttribute("aria-live","polite");
 root.appendChild(info);
 loadGameModule(name).then(function(module){
  if(!root.isConnected||root._zebraLoading!==name){
   if(name==="snake")stopZnakeMenuPrimer(root);
   return;
  }
  root._zebraLoading=null;root.innerHTML="";
  root._zebraApp=name;
  try{module.mount(root);}catch(err){
   if(name==="snake")stopZnakeMenuPrimer(root);
   root._zebraApp=null;
   root.textContent="Impossible de démarrer "+entry.name+" : "+err.message;
  }
 }).catch(function(err){
  if(name==="snake")stopZnakeMenuPrimer(root);
  if(!root.isConnected||root._zebraLoading!==name)return;
  root._zebraLoading=null;root.replaceChildren();
  var warning=el("p","app-message","Le chargement a échoué. Vérifie ta connexion et réessaie.");
  var retry=el("button","win-button","↻ Réessayer");
  retry.onclick=function(){openGame(name);};
  root.append(warning,retry);
 });
}
window.ZebraLazyApps={load:loadGameModule};
function open(code){$("start-menu").classList.add("hidden");if(code==="tetris"||code==="snake"||code==="racer"||code==="paint")openGame(code);else if(code==="folder:games"||code==="folder:tools"||code==="folder:atelier")appFolder(code.split(":")[1]);else if(code==="calc"||code==="sticky"||code==="planner")openUtility(code);else if(code==="amp")player();else if(code==="studio-manager")studioManager();else if(code==="settings")settings();else if(code==="about")about();else if(code==="datetime")dateTime();else if(code==="welcome")welcome();else if(code==="notepad")notepad("notes");else if(code==="viewer")explorer("screens");else if(code.indexOf("explorer:")===0)explorer(code.slice("explorer:".length));else if(code==="explorer")explorer("root");else if(code.indexOf("txt:")===0)notepad(code.split(":")[1])}
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
$("file-music").onchange=function(e){
 var files=Array.from(e.target.files||[]);
 e.target.value="";
 if(!files.length)return;
 if(window.ZebraAMP){
  window.ZebraAMPConfig={windowBox:windowBox};
  window.ZebraAMP.open();
  window.ZebraAMP.importFiles(files);
 }
};
function clock(){
 var output=$("clock");
 if(!output)return;
 output.textContent=window.ZebraControlPanel&&session?
  window.ZebraControlPanel.clock(session):
  ("0"+new Date().getHours()).slice(-2)+":"+("0"+new Date().getMinutes()).slice(-2);
 output.title="Date et heure — double-cliquez pour ouvrir";
}
clock();
setInterval(clock,10000);
$("clock").ondblclick=function(){if(session)dateTime();};
$("clock").onclick=function(){if(session&&(window.matchMedia("(pointer:coarse)").matches||window.innerWidth<701))dateTime();};
/* Initial screen = black plastic only; first click reveals the machine.
 * A second, deliberate click on its POWER control starts ZebraOS. */
}());
