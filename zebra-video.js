/* ZebraVideo 1.0 : lecteur ZebraOS autonome, sans dépendances. */
(function(){
"use strict";
function node(tag,cls,txt){
 var x=document.createElement(tag);
 if(cls)x.className=cls;
 if(txt!==undefined)x.textContent=txt;
 return x;
}
function button(txt,cls,label,fn){
 var x=node("button",cls,txt);x.type="button";
 x.setAttribute("aria-label",label||txt);x.title=label||txt;
 x.addEventListener("click",fn);return x;
}
function clock(sec){
 if(!Number.isFinite(sec)||sec<0)return "0:00";
 sec=Math.floor(sec);
 var h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;
 return h?h+":"+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0"):m+":"+String(s).padStart(2,"0");
}
function mount(root,item,opts){
 if(root._zebraDispose)root._zebraDispose();
 root.replaceChildren();
 opts=opts||{};
 var active=true,triedFallback=false,dragging=false,disposed=false;
 var frame=node("section","zvideo");frame.setAttribute("aria-label","Lecteur ZebraVideo");
 var header=node("header","zvideo-header");
 var brand=node("div","zvideo-brand");
 brand.append(node("strong","","ZEBRA VIDEO"),node("small","","MEDIA CENTER  •  ZEBRAOS"));
 var led=node("span","zvideo-led","● CHARGEMENT");
 led.setAttribute("role","status");
 header.append(node("span","zvideo-brand-symbol","▶"),brand,led);
 var screen=node("div","zvideo-screen");
 var video=node("video","zvideo-media");
 video.preload="metadata";video.playsInline=true;video.controls=false;
 video.setAttribute("aria-label",item.name);
 var loading=node("div","zvideo-loading");
 loading.setAttribute("role","status");loading.setAttribute("aria-live","polite");
 var ring=node("span","zvideo-loading-ring");
 var loadingTitle=node("strong","zvideo-loading-title","CHARGEMENT VIDÉO…");
 var loadingDetail=node("span","zvideo-loading-detail","Initialisation du lecteur");
 var track=node("div","zvideo-loading-track");
 track.append(node("span","zvideo-loading-pulse"));
 var retry=button("↻ RÉESSAYER","zvideo-retry","Réessayer de charger la vidéo",retryLoad);
 retry.hidden=true;
 loading.append(ring,loadingTitle,loadingDetail,track,retry);
 var centerPlay=button("▶","zvideo-center-play","Lire la vidéo",toggle);
 centerPlay.hidden=true;
 screen.append(video,loading,centerPlay);
 var panel=node("div","zvideo-console");
 var info=node("div","zvideo-info");
 var filename=node("strong","zvideo-filename",item.name);filename.title=item.name;
 var meta=node("small","zvideo-meta","VIDÉO • "+(opts.sizeText?opts.sizeText(item.size):"MP4"));
 info.append(filename,meta);
 var timeline=node("div","zvideo-timeline");
 var seek=node("input","zvideo-seek");seek.type="range";seek.min="0";seek.max="1000";seek.step="1";seek.value="0";
 seek.setAttribute("aria-label","Position dans la vidéo");
 var timeRow=node("div","zvideo-time");
 var current=node("span","zvideo-current","0:00"),duration=node("span","zvideo-duration","0:00");
 timeRow.append(current,duration);timeline.append(seek,timeRow);
 var controls=node("div","zvideo-buttons");
 var play=button("▶","zvideo-button zvideo-primary","Lire",toggle);
 var backward=button("« 10","zvideo-button","Reculer de 10 secondes",function(){skip(-10);});
 var forward=button("10 »","zvideo-button","Avancer de 10 secondes",function(){skip(10);});
 var mute=button("◖))","zvideo-button zvideo-mute","Couper le son",toggleMute);
 var volume=node("input","zvideo-volume");
 volume.type="range";volume.min="0";volume.max="1";volume.step=".05";volume.value="1";
 volume.setAttribute("aria-label","Volume");
 var rate=node("select","zvideo-rate");rate.setAttribute("aria-label","Vitesse de lecture");
 [0.5,0.75,1,1.25,1.5,2].forEach(function(n){var op=node("option","",n+"×");op.value=String(n);rate.append(op);});
 rate.value="1";
 var pip=button("▣","zvideo-button zvideo-pip","Image dans l'image",requestPip);
 var full=button("⛶","zvideo-button zvideo-full","Plein écran",requestFull);
 controls.append(play,backward,forward,mute,volume,rate,pip,full);
 var footer=node("div","zvideo-footer");
 var open=node("a","zvideo-open","OUVRIR LE FICHIER ↗");
 open.href=opts.primary||opts.backup||"#";open.target="_blank";open.rel="noopener noreferrer";
 footer.append(node("span","","ZEBRAOS  •  PLAYER 1.0"),open);
 panel.append(info,timeline,controls,footer);
 frame.append(header,screen,panel);root.append(frame);
 var events=[];
 function listen(target,type,fn){target.addEventListener(type,fn);events.push(function(){target.removeEventListener(type,fn);});}
 function state(message,kind){
  if(!active)return;
  frame.dataset.status=kind;
  led.textContent=kind==="error"?"● ERREUR":kind==="playing"?"● LECTURE":kind==="ready"?"● PRÊT":"● CHARGEMENT";
  loadingTitle.textContent=message;
  loading.classList.toggle("zvideo-is-hidden",kind==="ready"||kind==="playing");
  retry.hidden=kind!=="error";
  centerPlay.hidden=kind==="error"||kind==="loading"||!video.paused;
 }
 function waiting(message){
  state(message||"CHARGEMENT VIDÉO…","loading");
  loadingDetail.textContent=triedFallback?"Serveur de secours…":"Connexion et mise en mémoire…";
 }
 function updateTime(){
  var t=Number.isFinite(video.currentTime)?video.currentTime:0;
  var d=Number.isFinite(video.duration)?video.duration:0;
  current.textContent=clock(t);duration.textContent=clock(d);
  if(!dragging)seek.value=String(d>0?Math.round(t/d*1000):0);
  seek.disabled=!(d>0);
  seek.style.setProperty("--played",(d>0?t/d*100:0)+"%");
  var buff=0;
  try{if(d>0&&video.buffered.length)buff=Math.min(100,100*video.buffered.end(video.buffered.length-1)/d);}catch(_){}
  seek.style.setProperty("--buffered",buff+"%");
 }
 function updatePlay(){
  var playing=!video.paused&&!video.ended;
  play.textContent=playing?"❚❚":"▶";
  play.title=playing?"Mettre en pause":"Lire";play.setAttribute("aria-label",play.title);
  centerPlay.hidden=playing||frame.dataset.status==="loading"||frame.dataset.status==="error";
  if(playing)state("LECTURE","playing");
  else if(frame.dataset.status==="playing")state("PRÊT À LIRE","ready");
 }
 function fail(){
  if(!active)return;
  if(!triedFallback&&opts.backup){
   triedFallback=true;waiting("NOUVELLE TENTATIVE…");
   video.src=opts.backup;video.load();
  }else{
   state("VIDÉO INDISPONIBLE","error");
   loadingDetail.textContent="Impossible de lire ce format. Ouvre le fichier directement.";
  }
 }
 function retryLoad(){
  triedFallback=false;waiting("NOUVELLE TENTATIVE…");
  video.src=opts.primary||opts.backup||"";video.load();
 }
 function toggle(){
  if(!active)return;
  if(video.paused||video.ended){
   try{var result=video.play();if(result&&result.catch)result.catch(function(){
    if(active&&frame.dataset.status!=="error"){state("PRÊT À LIRE","ready");loadingDetail.textContent="Appuie sur ▶ pour démarrer.";}
   });}catch(_){state("PRÊT À LIRE","ready");}
  }else video.pause();
 }
 function skip(by){if(Number.isFinite(video.duration))video.currentTime=Math.max(0,Math.min(video.duration,video.currentTime+by));}
 function volumeLabel(){
  var quiet=video.muted||video.volume===0;
  mute.textContent=quiet?"◖×":"◖))";mute.title=quiet?"Réactiver le son":"Couper le son";
  mute.setAttribute("aria-label",mute.title);
 }
 function toggleMute(){video.muted=!video.muted;volumeLabel();}
 function requestFull(){
  if(document.fullscreenElement){var p=document.exitFullscreen?.();if(p?.catch)p.catch(function(){});return;}
  if(screen.requestFullscreen){var result=screen.requestFullscreen();if(result?.catch)result.catch(function(){});}
  else if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();
 }
 function requestPip(){
  if(!document.pictureInPictureEnabled||!video.requestPictureInPicture)return;
  var p=document.pictureInPictureElement?document.exitPictureInPicture():video.requestPictureInPicture();
  if(p?.catch)p.catch(function(){});
 }
 function keyboard(event){
  if(!active||["INPUT","SELECT","TEXTAREA"].includes(event.target?.tagName))return;
  if(!frame.contains(document.activeElement)&&!root.closest(".window")?.classList.contains("focused"))return;
  if(event.ctrlKey||event.altKey||event.metaKey)return;
  var k=event.key.toLowerCase();
  if(k===" "||k==="k"){event.preventDefault();toggle();}
  else if(k==="arrowleft"){event.preventDefault();skip(-5);}
  else if(k==="arrowright"){event.preventDefault();skip(5);}
  else if(k==="m"){event.preventDefault();toggleMute();}
  else if(k==="f"){event.preventDefault();requestFull();}
 }
 listen(video,"loadstart",function(){waiting("CHARGEMENT VIDÉO…");});
 listen(video,"loadedmetadata",function(){
  var w=video.videoWidth,h=video.videoHeight;
  meta.textContent=[w&&h?w+" × "+h:"VIDÉO",opts.sizeText?opts.sizeText(item.size):"MP4"].join(" • ");
  loadingDetail.textContent="Préparation de l'image…";updateTime();
  // Les appareils en économie de données peuvent ne pas charger la première
  // image sans interaction. La lecture reste toujours accessible.
  centerPlay.hidden=false;
 });
 listen(video,"loadeddata",function(){state("PRÊT À LIRE","ready");updateTime();});
 listen(video,"canplay",function(){state(video.paused?"PRÊT À LIRE":"LECTURE",video.paused?"ready":"playing");});
 listen(video,"waiting",function(){waiting("MISE EN MÉMOIRE…");});
 listen(video,"stalled",function(){if(video.readyState<3)waiting("RÉSEAU LENT…");});
 listen(video,"seeking",function(){if(video.readyState<3)waiting("RECHERCHE EN COURS…");});
 listen(video,"seeked",function(){if(video.readyState>=2)state("PRÊT À LIRE","ready");updateTime();});
 listen(video,"playing",function(){state("LECTURE","playing");updatePlay();});
 listen(video,"play",updatePlay);
 listen(video,"pause",updatePlay);
 listen(video,"ended",function(){updatePlay();state("VIDÉO TERMINÉE","ready");});
 listen(video,"timeupdate",updateTime);
 listen(video,"durationchange",updateTime);
 listen(video,"progress",updateTime);
 listen(video,"volumechange",volumeLabel);
 listen(video,"error",fail);
 listen(video,"click",toggle);
 listen(screen,"dblclick",requestFull);
 listen(seek,"input",function(){
  dragging=true;var d=Number.isFinite(video.duration)?video.duration:0;
  current.textContent=clock(d*Number(seek.value)/1000);
  seek.style.setProperty("--played",Number(seek.value)/10+"%");
 });
 listen(seek,"change",function(){
  var d=Number.isFinite(video.duration)?video.duration:0;
  if(d>0)video.currentTime=d*Number(seek.value)/1000;
  dragging=false;updateTime();
 });
 listen(volume,"input",function(){video.volume=Number(volume.value);video.muted=video.volume===0;volumeLabel();});
 listen(rate,"change",function(){video.playbackRate=Number(rate.value)||1;});
 listen(document,"keydown",keyboard);
 if(!document.pictureInPictureEnabled||!video.requestPictureInPicture)pip.hidden=true;
 video.src=opts.primary||opts.backup||"";video.load();waiting("CHARGEMENT VIDÉO…");
 updateTime();volumeLabel();
 function dispose(){
  if(disposed)return;disposed=true;active=false;
  events.forEach(function(fn){fn();});
  video.pause();video.removeAttribute("src");video.load();
  if(root._zebraDispose===dispose)root._zebraDispose=null;
 }
 root._zebraDispose=dispose;return dispose;
}
window.ZebraVideoPlayer={mount:mount};
}());