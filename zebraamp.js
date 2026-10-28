/* ZebraAMP 3.0 — lecteur du studio, sans framework.
 * Album public : index STUDIO/BUREAU/Zebra Tape 2.
 * Playlists personnelles : métadonnées localStorage, fichiers audio IndexedDB.
 * Un seul élément Audio ; EQ Web Audio non destructif ; import multiple et tri.
 * Le lecteur ne charge AUCUN morceau fictif et ne limite pas à neuf pistes.
 */
(function(){
"use strict";
var ALBUM="zebra-tape-2",OPENED="fichiers-ouverts",KEY="zebraamp-v3",DB="zebraamp-v3-audio";
var audio=new Audio();audio.preload="auto";audio.volume=.7;
var album={id:ALBUM,name:"Zebra Tape 2",readonly:true,tracks:[]};
var playlists=[],current=ALBUM,currentId=null,loadedUrl=null,loadedBlob=null,view=null;
var coverCache=new Map(),displayedCover=null;
var ctx=null,filters=[],analyser=null,graphTried=false,reverbGraph=null;
var nativeFallback=false;
var allSounds=[],dbPromise=null,dbAvailable=true,shuffle=false,repeat="tout",speed=1,preservePitch=false,reverb=0,volume=.7,eq=[0,0,0,0,0],preset="Neutre";
var presetValues={
 "Neutre":[0,0,0,0,0],
 "Basses":[7,4,0,-1,-2],
 "Clair":[-2,0,2,4,4],
 "Vintage":[4,2,-1,-3,-7],
 "Nuit":[3,1,0,-2,-3],
 "Voix":[-4,-2,3,5,2]
};
var eqFreq=[70,250,1000,3500,11000],eqNames=["GRAVES","BAS-MÉD.","MÉDIUMS","PRÉSENCE","AIGUS"];
var animation=null,spectrumRefresh=null,loadingId=0,notifyText="",initDone=false,albumChecked=false;
var visualizerPromise=null;
function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function b(label,action,cls){var x=el("button",cls||"amp3-btn",label);x.type="button";x.onclick=action;return x;}
function prepareNativeAudio(media){
 // Chrome/Samsung est plus fiable avec un vrai élément média attaché au DOM.
 // Forcer aussi les deux états de mute : currentTime peut avancer même lorsque
 // la sortie d'un HTMLMediaElement est silencieuse.
 try{media.muted=false;media.defaultMuted=false;}catch(e){}
 try{media.setAttribute("playsinline","");}catch(e){}
 try{media.playsInline=true;}catch(e){}
 try{
  if(document.body&&!media.isConnected){
   media.hidden=true;media.setAttribute("aria-hidden","true");
   media.setAttribute("data-zebraamp-native","");document.body.appendChild(media);
  }
 }catch(e){}
}
function stamp(){return "pl-"+Date.now()+"-"+Math.random().toString(36).slice(2,8);}
function label(name){return String(name||"Sans titre").replace(/\.[^.]+$/,"").slice(0,150);}
/* Crédits musicaux distincts de ZebraOS, qui n'est que l'interface.
 * Le nom du fichier fait foi : pas de changement des titres ni du son. */
function trackArtist(track){
 if(!track||track.kind!=="public")return "LOCAL";
 var path=String(track.path||"");
 if(path.indexOf("STUDIO/BUREAU/Zebra Tape 2/")===0){
  var name=path.split("/").pop().replace(/\.[^.]+$/,"").toLowerCase().replace(/[^a-z0-9]/g,"");
  if(name==="6stouse")return "Jony";
  if(name==="5iwannadance")return "Zebra & Ekko";
  if(name==="1domaintro"||name==="9backhome")return "Zebra & Cubic";
 }
 return "Zebra";
}
function getList(){return current===ALBUM?album:playlists.find(function(p){return p.id===current;})||album;}
function getTrack(){return getList().tracks.find(function(t){return t.id===currentId;})||null;}
function format(t){if(!Number.isFinite(t)||t<0)return "00:00";t=Math.floor(t);return String(Math.floor(t/60)).padStart(2,"0")+":"+String(t%60).padStart(2,"0");}
function status(text){notifyText=text||"";renderStatus();}
function store(){
 try{localStorage.setItem(KEY,JSON.stringify({
   playlists:playlists.filter(function(p){return p.id!==OPENED;}),volume:volume,shuffle:shuffle,repeat:repeat,
   speed:speed,pitchMode:preservePitch?"constant":"vinyl",reverb:reverb,eq:eq,preset:preset
 }));}catch(e){status("Stockage des préférences indisponible.");}
}
function restore(){
 try{
  var d=JSON.parse(localStorage.getItem(KEY)||"null");
  if(!d||typeof d!=="object")return;
  if(Array.isArray(d.playlists))playlists=d.playlists.slice(0,60).filter(function(p){
   return p&&typeof p.id==="string"&&typeof p.name==="string"&&
    p.id!==ALBUM&&p.id!==OPENED&&Array.isArray(p.tracks);
  }).map(function(p){return{id:p.id,name:p.name.slice(0,90),readonly:false,
   coverKey:p.coverKey==="cover:"+p.id?p.coverKey:null,
   tracks:p.tracks.filter(function(t){return t&&typeof t.id==="string"&&
    (t.kind==="blob"||t.kind==="public")&&typeof t.name==="string";}).slice(0,800)};});
  // À chaque nouvel accès au site, la playlist de démarrage est Zebra Tape 2.
  // Le changement de playlist reste possible ensuite pendant la session.
  if(!Number.isNaN(Number(d.volume)))volume=Math.max(0,Math.min(1,Number(d.volume)));
  shuffle=!!d.shuffle;repeat=["aucun","tout","un"].includes(d.repeat)?d.repeat:"tout";
  speed=Number.isFinite(Number(d.speed))?Math.max(.5,Math.min(1.5,Math.round(Number(d.speed)*20)/20)):1;
  // L’ancien mode « tonalité stable » est ignoré : vinyle en permanence.
  preservePitch=false;
  reverb=Number.isFinite(Number(d.reverb))?Math.max(0,Math.min(100,Math.round(Number(d.reverb)/5)*5)):0;
  if(Array.isArray(d.eq)&&d.eq.length===5)eq=d.eq.map(function(x){return Math.max(-12,Math.min(12,Number(x)||0));});
  if(typeof d.preset==="string")preset=d.preset;
 }catch(e){}
 audio.volume=volume;applyPitchMode();audio.playbackRate=speed;
 current=ALBUM;
}
function applyPitchMode(){
 // Le navigateur tente sinon un time-stretch pour conserver la hauteur
 // (défaut HTMLMediaElement), ce qui déforme souvent les transitoires.
 // Vinyle = resampling naturel : vitesse et tonalité baissent ensemble.
 try{audio.preservesPitch=preservePitch;}catch(e){}
 try{if("mozPreservesPitch" in audio)audio.mozPreservesPitch=preservePitch;}catch(e){}
 try{if("webkitPreservesPitch" in audio)audio.webkitPreservesPitch=preservePitch;}catch(e){}
}
function syncPlaybackSettings(){
 // Certains navigateurs remettent la vitesse effective à 1× lorsqu'une
 // nouvelle source est chargée, sans modifier notre valeur mémorisée.
 applyPitchMode();
 try{audio.defaultPlaybackRate=speed;}catch(e){}
 try{if(Math.abs(audio.playbackRate-speed)>.0001)audio.playbackRate=speed;}catch(e){}
 if(analyser&&reverb>0)applyReverb();
}
function db(){
 if(dbPromise)return dbPromise;
 dbPromise=new Promise(function(resolve,reject){
  if(!window.indexedDB){reject(Error("IndexedDB indisponible"));return;}
  var req=indexedDB.open(DB,1);
  req.onupgradeneeded=function(){
   var d=req.result;
   if(!d.objectStoreNames.contains("sons"))d.createObjectStore("sons",{keyPath:"id"});
  };
  req.onsuccess=function(){resolve(req.result);};
  req.onerror=function(){reject(req.error||Error("Disque inaccessible"));};
  req.onblocked=function(){reject(Error("Ferme les autres onglets ZebraOS."));};
 }).catch(function(err){dbAvailable=false;dbPromise=null;throw err;});
 return dbPromise;
}
function dbOp(type,id,value){
 return db().then(function(d){
  return new Promise(function(resolve,reject){
   var trans=d.transaction("sons",type==="put"||type==="delete"?"readwrite":"readonly");
   var st=trans.objectStore("sons");
   var q=type==="get"?st.get(id):type==="put"?st.put(value):st.delete(id);
   q.onsuccess=function(){resolve(q.result);};
   q.onerror=function(){reject(q.error||Error("Erreur disque"));};
   trans.onerror=function(){reject(trans.error||Error("Écriture impossible"));};
  });
 });
}
function urlFor(path){return "https://raw.githubusercontent.com/UrosTrailovic/zebraos/main/"+path.split("/").map(encodeURIComponent).join("/");}
function looksAudio(name){return /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(name||"");}
function syncAlbum(entries){
 if(!Array.isArray(entries))return;
 // Les MP3 peuvent être à la racine de Zebra Tape 2 OU dans Son, SONS,
 // voire un autre sous-dossier. La casse des noms ne doit pas bloquer.
 var root="STUDIO/BUREAU/";
 var folder=entries.find(function(x){
  return x.type==="dir" && x.path.split("/").slice(0,-1).join("/")===root.slice(0,-1)
    && (x.name||x.path.split("/").pop()).toLocaleLowerCase("fr")==="zebra tape 2";
 });
 var prefix=(folder?folder.path:root+"Zebra Tape 2")+"/";
 album.tracks=entries.filter(function(x){
  return x.type==="file"&&typeof x.path==="string"&&x.path.startsWith(prefix)
    &&looksAudio(x.name||x.path.split("/").pop());
 }).sort(function(a,b){
  var nameA=a.path.slice(prefix.length),nameB=b.path.slice(prefix.length);
  return nameA.localeCompare(nameB,"fr",{numeric:true,sensitivity:"base"});
 }).map(function(x){
  return {id:"public:"+x.path,name:label(x.name||x.path.split("/").pop()),kind:"public",path:x.path};
 });
 albumChecked=true;
 if(current===ALBUM){
  if(currentId&&!album.tracks.some(function(t){return t.id===currentId;})){
   audio.pause();currentId=null;audio.removeAttribute("src");releaseUrl();
  }
  render();
 }
}
function updatePublic(){
 var lib=window.ZebraGitFiles;
 if(!lib)return Promise.resolve({ok:false,error:"Bibliothèque ZebraOS non disponible."});
 return lib.load().then(function(result){
  if(!result||!result.ok||!Array.isArray(result.entries))
   return {ok:false,error:result&&result.error||"Index des fichiers inaccessible."};
  syncAlbum(result.entries);
  return {ok:true,count:album.tracks.length};
 }).catch(function(err){
  return {ok:false,error:err.message||"Connexion au dépôt impossible."};
 });
}
function bindAudioEvents(media){
 media.addEventListener("ended",nextAfterEnd);
 media.addEventListener("loadedmetadata",syncPlaybackSettings);
 ["play","pause","timeupdate","loadedmetadata","durationchange","ratechange","volumechange","waiting","canplay"].forEach(function(k){
  media.addEventListener(k,function(){renderProgress();if(k==="play"||k==="pause"){render();if(spectrumRefresh)spectrumRefresh();}});
 });
 media.addEventListener("error",function(){status("Impossible de lire ce fichier audio. Vérifie son format et son accès.");});
}
function init(){
 if(initDone)return;
 initDone=true;applyPitchMode();restore();
 prepareNativeAudio(audio);
 if(window.ZebraGitFiles){
  window.ZebraGitFiles.subscribe(function(){syncAlbum(window.ZebraGitFiles.allFiles());});
  updatePublic();
 }
 bindAudioEvents(audio);
}
function ensureContext(){
 if(ctx&&ctx.state!=="closed")return true;
 try{
  var AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx){status("Égaliseur indisponible sur ce navigateur.");return false;}
  // Un tampon orienté lecture est plus stable lorsque le navigateur passe
  // en arrière-plan. Repli sans option pour les anciens navigateurs.
  try{ctx=new AudioCtx({latencyHint:"playback"});}
  catch(contextError){ctx=new AudioCtx();}
  return true;
 }catch(err){ctx=null;return false;}
}
function buildGraph(){
 if(analyser)return true;
 // Ne jamais détourner le média natif vers Web Audio tant que son contexte
 // n'est pas réellement actif. Sinon Android fait avancer currentTime mais
 // peut envoyer un silence complet vers les haut-parleurs.
 if(!ctx||ctx.state!=="running"||graphTried)return false;
 graphTried=true;
 var src=null;
 try{
  src=ctx.createMediaElementSource(audio);
  var last=src;
  eqFreq.forEach(function(freq,i){
   var f=ctx.createBiquadFilter();
   f.type=i===0?"lowshelf":i===4?"highshelf":"peaking";
   f.frequency.value=freq;if(f.type==="peaking")f.Q.value=.9;
   f.gain.value=eq[i];last.connect(f);last=f;filters.push(f);
  });
  analyser=ctx.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=.78;
  last.connect(analyser);analyser.connect(ctx.destination);
  // L'effet coûteux est construit seulement si l'utilisateur l'active.
  if(reverb>0)applyReverb();
  return true;
 }catch(err){
  // La lecture HTML reste native et audible si l'analyseur est indisponible.
  try{if(ctx&&ctx.state!=="closed")ctx.close();}catch(e){}
  ctx=null;filters=[];analyser=null;graphTried=false;reverbGraph=null;
  // Si createMediaElementSource a déjà détourné le média avant l'erreur,
  // repartir sur un élément natif neuf évite un lecteur qui avance en silence.
  if(src)setTimeout(function(){if(!audio.paused)nativeAudioFallback(audio.currentTime);},0);
  return false;
 }
}
/* Réverbération studio : longue impulsion stéréo diffuse, couleur chaude,
   préréverbération et protection des crêtes. Générée seulement sur demande.
   Pas de MP3 externe, pas de DSP/AudioWorklet au démarrage de ZebraOS. */
function ensureReverb(){
 if(!ctx||!analyser)return false;
 if(reverbGraph)return true;
 try{
  // Avant : queue de seulement 1,4 s. Maintenant une vraie pièce de ~3,4 s.
  var seconds=3.4,length=Math.round(ctx.sampleRate*seconds);
  var impulse=ctx.createBuffer(2,length,ctx.sampleRate);
  for(var ch=0;ch<2;ch++){
   var data=impulse.getChannelData(ch),smooth=0;
   for(var i=0;i<length;i++){
    // Diffusion corrélée à court terme, mais décors stéréo indépendants.
    smooth=smooth*.58+(Math.random()*2-1)*.42;
    var t=i/length;
    // Entrée progressive + chute exponentielle plus lente que l'ancien effet.
    var bloom=.20+.80*Math.min(1,t/.035);
    data[i]=smooth*bloom*Math.exp(-4.7*t);
   }
  }
  var convolver=ctx.createConvolver();
  convolver.normalize=true;convolver.buffer=impulse;
  var preDelay=ctx.createDelay(.15);preDelay.delayTime.value=.052;
  // Filtrage réservé à la réverbération, jamais à la musique sèche.
  // La fréquence de coupure évolue avec le dosage via applyReverb().
  var highpass=ctx.createBiquadFilter();highpass.type="highpass";highpass.frequency.value=165;
  var tone=ctx.createBiquadFilter();tone.type="lowpass";tone.frequency.value=5200;
  var dry=ctx.createGain(),wet=ctx.createGain();
  dry.gain.value=1;wet.gain.value=0;
  var limiter=ctx.createDynamicsCompressor();
  limiter.threshold.value=-5;limiter.knee.value=18;
  limiter.ratio.value=5;limiter.attack.value=.003;limiter.release.value=.22;
  preDelay.connect(convolver);
  convolver.connect(highpass);highpass.connect(tone);tone.connect(wet);
  dry.connect(limiter);wet.connect(limiter);limiter.connect(ctx.destination);
  // Brancher les deux chemins en une fois. Les gains sont nuls au départ.
  analyser.disconnect();
  analyser.connect(dry);analyser.connect(preDelay);
  reverbGraph={dry:dry,wet:wet,preDelay:preDelay,convolver:convolver,
               highpass:highpass,tone:tone,limiter:limiter,connected:true,seconds:seconds};
  return true;
 }catch(err){
  status("Réverbération indisponible sur ce navigateur.");
  return false;
 }
}
function applyReverb(){
 if(!ctx||!analyser)return;
 if(reverb===0&&!reverbGraph)return;
 if(!ensureReverb())return;
 var state=reverbGraph,t=reverb/100;
 if(t>0&&!state.connected){analyser.connect(state.preDelay);state.connected=true;}
 var now=ctx.currentTime||0;
 // Plus l'effet est fort, plus le bas du retour de réverbération est nettoyé.
 // 0%: 165 Hz | 50%: ~480 Hz | 100%: ~1000 Hz (courbe progressive).
 // Les aigus sont aussi ouverts progressivement, sans égaliser la piste sèche.
 // Transition douce pour éviter les clics pendant le déplacement du curseur.
 var wetHighpass=165+835*Math.pow(t,1.45);
 var wetLowpass=5200+2500*Math.pow(t,.85);
 state.highpass.frequency.setTargetAtTime(wetHighpass,now,.055);
 state.tone.frequency.setTargetAtTime(wetLowpass,now,.055);
 // Le dosage et les gains sec/réverb restent identiques à la version approuvée.
 state.dry.gain.setTargetAtTime(1-.40*t,now,.035);
 state.wet.gain.setTargetAtTime(1.30*Math.pow(t,.82),now,.035);
 if(t===0&&state.connected){
  analyser.disconnect(state.preDelay);state.connected=false;
 }
}
function setReverb(value){
 reverb=Math.max(0,Math.min(100,Math.round((Number(value)||0)/5)*5));
 if(reverb>0&&!audio.paused&&!nativeFallback)resumeGraph();
 applyReverb();store();renderReverb();
}
function renderReverb(){
 if(!view||!view.isConnected)return;
 var button=view.querySelector("[data-amp-reverb]");
 if(button)button.textContent="RÉVERB "+reverb+" %";
 var input=view.querySelector("[data-amp-reverb-input]");
 if(input)input.value=String(reverb);
 var value=view.querySelector("[data-amp-reverb-value]");
 if(value)value.textContent=reverb+" %";
}

function resumeGraph(){
 if(nativeFallback)return Promise.resolve(false);
 if(analyser&&ctx&&ctx.state==="running")return Promise.resolve(true);
 if(!ensureContext())return Promise.resolve(false);
 if(ctx.state==="running")return Promise.resolve(buildGraph());
 try{
  var r=ctx.resume();
  return Promise.resolve(r).then(function(){
   return !!(ctx&&ctx.state==="running"&&buildGraph());
  }).catch(function(){return false;});
 }catch(e){return Promise.resolve(false);}
}
function setEq(values,name){
 eq=values.map(function(x){return Math.max(-12,Math.min(12,Number(x)||0));});
 preset=name||"Personnalisé";
 if(eq.some(function(x){return Math.abs(x)>.001;})&&!audio.paused&&!nativeFallback)resumeGraph();
 filters.forEach(function(f,i){f.gain.value=eq[i];});
 store();renderEq();
}
/* "Fichiers ouverts" is only a temporary queue for files launched in Explorer.
 * It is never saved, and switching away disposes it immediately. */
function discardOpenedPlaylist(){
 var opened=playlists.find(function(p){return p.id===OPENED;});
 if(!opened)return;
 playlists=playlists.filter(function(p){return p.id!==OPENED;});
 opened.tracks.forEach(function(track){
  if(track.kind==="blob"&&track.blobKey){
   dbOp("delete",track.blobKey).catch(function(){});
  }
 });
}
function setPlaylist(id){
 if(id!==ALBUM&&!playlists.some(function(p){return p.id===id;}))return;
 if(current!==id){
  ++loadingId; // Cancel any asynchronous track load from the old playlist.
  audio.pause();currentId=null;audio.removeAttribute("src");releaseUrl();
  if(current===OPENED)discardOpenedPlaylist();
 }
 current=id;store();render();
}
function createPlaylist(name,shouldSwitch){
 name=String(name||"Nouvelle playlist").trim().slice(0,85);
 if(!name)name="Nouvelle playlist";
 var p={id:stamp(),name:name,readonly:false,tracks:[]};
 playlists.push(p);if(shouldSwitch!==false)setPlaylist(p.id);
 store();render();return p;
}
/* Mini-covers JPEG locales : pas de chargement réseau ni d'attente IndexedDB.
 * 256 x 256 px et compression forte ; même stockage que les préférences.
 * Zebra Tape 2 reste publique et non modifiable. */
function coverStorageKey(id){return "zebraamp-cover-v1-"+id;}
function releaseCover(id){
 var url=coverCache.get(id);
 if(url&&url.startsWith("blob:"))URL.revokeObjectURL(url);
 coverCache.delete(id);
}
function coverDataURL(file){
 return new Promise(function(resolve,reject){
  if(!file||!/^(image\/jpeg|image\/png|image\/webp)$/.test(file.type)){
   reject(Error("Utilise un JPG, PNG ou WebP."));return;
  }
  if(file.size>10*1024*1024){reject(Error("Image trop grande (maximum 10 Mo)."));return;}
  var url=URL.createObjectURL(file),img=new Image(),done=false;
  function finish(err,data){
   if(done)return;done=true;URL.revokeObjectURL(url);
   if(err)reject(err);else resolve(data);
  }
  img.onerror=function(){finish(Error("Impossible de lire cette image."));};
  img.onload=function(){
   try{
    var c=document.createElement("canvas");c.width=256;c.height=256;
    var g=c.getContext("2d");
    g.fillStyle="#061b13";g.fillRect(0,0,256,256);
    var scale=Math.max(256/img.naturalWidth,256/img.naturalHeight);
    var w=img.naturalWidth*scale,h=img.naturalHeight*scale;
    g.drawImage(img,(256-w)/2,(256-h)/2,w,h);
    var data=c.toDataURL("image/jpeg",.76);
    if(data.length>140000)data=c.toDataURL("image/jpeg",.53);
    if(data.length>180000)throw Error("Pochette trop complexe à compresser.");
    finish(null,data);
   }catch(e){finish(Error(e.message||"Impossible de préparer cette image."));}
  };
  img.src=url;
 });
}
function applyCoverImage(art,cover,src,fallback){
 cover.classList.add("amp3-cover-empty");
 var triedFallback=false;
 art.onload=function(){
  cover.classList.remove("amp3-cover-empty");
  art.style.display="block";
 };
 art.onerror=function(){
  if(fallback&&!triedFallback){
   triedFallback=true;art.src=fallback;return;
  }
  cover.classList.add("amp3-cover-empty");
 };
 art.alt="Pochette de la playlist "+getList().name;
 art.decoding="async";
 art.loading="eager";
 art.src=src;
}
function renderCover(){
 if(!view||!view.isConnected)return;
 var cover=view.querySelector(".amp3-cover"),art=view.querySelector(".amp3-cover-image");
 if(!cover||!art)return;
 var p=getList(),id=p.id;
 var key=p.readonly?"album":p.coverKey?("custom:"+id+":"+p.coverKey):"empty:"+id;
 if(displayedCover===key)return;
 displayedCover=key;
 if(p.readonly){
  var embeddedCover=window.ZebraTape2CoverData;
  if(embeddedCover){
   cover.classList.remove("amp3-cover-empty");
   art.style.display="block";
   art.alt="Pochette de Zebra Tape 2";
   art.onload=function(){cover.classList.remove("amp3-cover-empty");};
   art.onerror=function(){
    cover.classList.add("amp3-cover-empty");
    art.removeAttribute("src");
   };
   art.src=embeddedCover;
  }else{
   applyCoverImage(art,cover,"/STUDIO/BUREAU/Zebra%20Tape%202/Cover/front%202.webp?cover=2");
  }
  return;
 }
 cover.classList.add("amp3-cover-empty");
 art.removeAttribute("src");
 if(!p.coverKey)return;
 if(!coverCache.has(id)){
  try{
   var data=localStorage.getItem(coverStorageKey(id));
   if(data&&data.startsWith("data:image/jpeg;base64,"))coverCache.set(id,data);
  }catch(e){}
 }
 if(coverCache.has(id))applyCoverImage(art,cover,coverCache.get(id));
}
function closeCoverViewer(){
 if(!view)return;
 var viewer=view.querySelector(".amp3-cover-viewer");
 if(viewer)viewer.remove();
}
function openCoverViewer(){
 if(!view||!view.isConnected)return;
 var cover=view.querySelector(".amp3-cover"),art=cover&&cover.querySelector(".amp3-cover-image");
 if(!cover||cover.classList.contains("amp3-cover-empty")||!art||!art.currentSrc&&!art.src)return;
 closeCoverViewer();
 var overlay=el("div","amp3-cover-viewer"),dialog=el("div","amp3-cover-viewer-dialog");
 overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");
 overlay.setAttribute("aria-label","Pochette agrandie de "+getList().name);
 var image=el("img","amp3-cover-viewer-image");
 image.src=art.currentSrc||art.src;image.alt="Pochette de la playlist "+getList().name;
 var closeBtn=b("×",closeCoverViewer,"amp3-cover-viewer-close");
 closeBtn.title="Fermer la pochette";closeBtn.setAttribute("aria-label",closeBtn.title);
 dialog.append(image,closeBtn);overlay.appendChild(dialog);
 overlay.addEventListener("pointerdown",function(e){if(e.target===overlay||e.target===image)closeCoverViewer();});
 overlay.addEventListener("keydown",function(e){if(e.key==="Escape")closeCoverViewer();});
 view.querySelector(".amp3").appendChild(overlay);closeBtn.focus();
}
function editPlaylist(){
 var p=getList();if(p.readonly||p.id===OPENED||!view)return;
 var root=view.querySelector(".amp3");
 if(!root)return;
 root.querySelector(".amp3-edit-overlay")?.remove();
 var overlay=el("div","amp3-edit-overlay"),editor=el("div","amp3-edit-dialog");
 editor.setAttribute("role","dialog");editor.setAttribute("aria-modal","true");
 editor.setAttribute("aria-label","Modifier la playlist");
 var title=el("strong","amp3-edit-title","MODIFIER LA PLAYLIST");
 var nameLabel=el("label","amp3-edit-name","NOM DE LA PLAYLIST");
 var nameInput=el("input","amp3-edit-input");nameInput.type="text";
 nameInput.value=p.name;nameInput.maxLength=85;
 nameLabel.appendChild(nameInput);
 var preview=el("div","amp3-edit-cover-preview");
 var previewImage=el("img","amp3-edit-cover-image");
 previewImage.alt="Aperçu de la pochette";
 preview.appendChild(previewImage);
 var empty=el("span","amp3-edit-empty","♪");
 preview.appendChild(empty);
 var input=el("input");input.type="file";input.accept="image/png,image/jpeg,image/webp";input.hidden=true;
 var selectedFile=null,remove=false,previewURL=null;
 function updatePreview(){
  var src=previewURL||(remove?null:coverCache.get(p.id));
  preview.classList.toggle("amp3-edit-preview-empty",!src);
  if(src)previewImage.src=src;else previewImage.removeAttribute("src");
 }
 var pick=b("＋ CHOISIR UNE IMAGE",function(){input.click();},"amp3-btn");
 var removeBtn=b("× ENLEVER LA COVER",function(){
  selectedFile=null;remove=true;
  if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}
  updatePreview();
 },"amp3-btn amp3-edit-remove");
 function close(){
  if(previewURL)URL.revokeObjectURL(previewURL);
  overlay.remove();
 }
 input.onchange=function(){
  var file=input.files&&input.files[0];input.value="";
  if(!file)return;
  if(!/^(image\/jpeg|image\/png|image\/webp)$/.test(file.type)||file.size>10*1024*1024){
   status("Pochette : JPG, PNG ou WebP, maximum 10 Mo.");return;
  }
  if(previewURL)URL.revokeObjectURL(previewURL);
  selectedFile=file;remove=false;previewURL=URL.createObjectURL(file);
  updatePreview();
 };
 var actions=el("div","amp3-edit-actions");
 var cancel=b("ANNULER",close,"amp3-btn");
 var save=b("✓ ENREGISTRER",async function(){
  var name=nameInput.value.trim().slice(0,85);
  if(!name){status("Donne un nom à la playlist.");nameInput.focus();return;}
  save.disabled=true;cancel.disabled=true;pick.disabled=true;removeBtn.disabled=true;
  try{
   if(selectedFile){
    status("Préparation de la pochette…");
    var compressed=await coverDataURL(selectedFile);
    status("Sauvegarde locale de la pochette…");
    localStorage.setItem(coverStorageKey(p.id),compressed);
    releaseCover(p.id);
    coverCache.set(p.id,compressed);
    p.coverKey="cover:"+p.id;
    // Mise à jour immédiate : ne pas attendre un second passage dans
    // l'éditeur ni le prochain événement timeupdate du lecteur.
    var mainCover=view&&view.querySelector(".amp3-cover");
    var mainArt=mainCover&&mainCover.querySelector(".amp3-cover-image");
    if(mainCover&&mainArt)applyCoverImage(mainArt,mainCover,compressed);
   }else if(remove){
    localStorage.removeItem(coverStorageKey(p.id));
    releaseCover(p.id);
    p.coverKey=null;
   }
   p.name=name;store();displayedCover=null;close();render();
   status(selectedFile?"Pochette enregistrée avec ta playlist.":"Playlist enregistrée.");
  }catch(e){
   save.disabled=false;cancel.disabled=false;pick.disabled=false;removeBtn.disabled=false;
   status("Impossible d'enregistrer la pochette : "+(e.message||"stockage indisponible"));
  }
 },"amp3-btn amp3-edit-save");
 actions.append(cancel,save);
 var controls=el("div","amp3-edit-cover-actions");
 controls.append(pick,removeBtn);
 var note=el("div","amp3-edit-note","JPG / PNG / WebP · compressée à 256 × 256 px · conservée sur cet appareil.");
 editor.append(title,nameLabel,preview,controls,note,actions,input);
 overlay.appendChild(editor);root.appendChild(overlay);
 overlay.addEventListener("pointerdown",function(e){if(e.target===overlay)close();});
 updatePreview();
 if(p.coverKey&&!coverCache.has(p.id)){
  try{
   var previous=localStorage.getItem(coverStorageKey(p.id));
   if(previous&&previous.startsWith("data:image/jpeg;base64,")){
    coverCache.set(p.id,previous);updatePreview();
   }
  }catch(e){}
 }
 nameInput.focus();nameInput.select();
}
function deleteList(){
 var p=getList();if(p.readonly||p.id===OPENED)return;
 if(!confirm("Supprimer cette playlist ? Les fichiers importés ne seront pas supprimés des autres playlists."))return;
 playlists=playlists.filter(function(q){return q.id!==p.id;});
 releaseCover(p.id);
 try{localStorage.removeItem(coverStorageKey(p.id));}catch(e){}
 setPlaylist(ALBUM);store();render();
}
function makeOpenedPlaylist(){
 var p=playlists.find(function(p){return p.id===OPENED;});
 if(!p){p={id:OPENED,name:"Fichiers ouverts",readonly:false,tracks:[]};playlists.unshift(p);}
 return p;
}
function releaseUrl(){if(loadedBlob){URL.revokeObjectURL(loadedBlob);loadedBlob=null;}}
function setSource(src,isBlob){
 // Détacher l'ancienne source avant de révoquer son URL. Sur certains Chrome
 // Android, révoquer un blob encore attaché laisse le média en attente.
 audio.pause();
 if(audio.src){audio.removeAttribute("src");audio.load();}
 releaseUrl();
 if(isBlob)loadedBlob=src;
 // Les blobs IndexedDB sont locaux et ne doivent pas passer par CORS.
 // Les morceaux GitHub gardent anonymous pour rester compatibles Web Audio.
 if(isBlob)audio.removeAttribute("crossorigin");else audio.crossOrigin="anonymous";
 prepareNativeAudio(audio);audio.muted=false;audio.defaultMuted=false;audio.volume=volume;
 audio.src=src;syncPlaybackSettings();audio.load();syncPlaybackSettings();renderProgress();
}
function togglePlayback(){
 if(audio.paused){
  var t=getTrack();
  if(t){if(audio.src)play();else pick(t.id,true);}
  else{var p=getList();if(p.tracks.length)pick(p.tracks[0].id,true);}
 }else audio.pause();
}
function nativeAudioFallback(position){
 if(nativeFallback)return;
 var previous=audio,src=previous.currentSrc||previous.src;if(!src)return;
 nativeFallback=true;previous.pause();
 try{if(ctx&&ctx.state!=="closed")ctx.close();}catch(e){}
 ctx=null;filters=[];analyser=null;graphTried=false;reverbGraph=null;
 audio=new Audio();audio.preload="auto";audio.volume=volume;
 if(loadedBlob)audio.removeAttribute("crossorigin");else audio.crossOrigin="anonymous";
 prepareNativeAudio(audio);bindAudioEvents(audio);audio.src=src;syncPlaybackSettings();audio.load();
 var start=function(){
  audio.muted=false;audio.defaultMuted=false;audio.volume=volume;
  try{audio.currentTime=Math.max(0,position||0);}catch(e){}
  var p=audio.play();if(p&&p.then)p.then(function(){
   // Ne retirer l'ancien média qu'une fois la nouvelle sortie réellement lancée.
   try{previous.removeAttribute("src");previous.load();previous.remove();}catch(e){}
   status("");
  }).catch(function(){status("Lecture bloquée : appuie sur ▶ pour démarrer le son.");});
 };
 if(audio.readyState>=1)start();else audio.addEventListener("loadedmetadata",start,{once:true});
 status("Mode audio mobile direct · effets temps réel désactivés pour cette session.");
}
function play(){
 syncPlaybackSettings();
 prepareNativeAudio(audio);audio.muted=false;audio.defaultMuted=false;audio.volume=volume;
 // Lecture HTML native tant que le son est neutre : meilleure continuité
 // sur mobile verrouillé. Web Audio ne démarre que pour un véritable effet.
 // Le mini-spectre utilise lui aussi le signal réel. L'activation du contexte
 // est tentée à chaque geste Play, mais le média n'y est branché qu'après
 // confirmation de l'état running.
 var graphReady=!nativeFallback?resumeGraph():null;
 var before=audio.currentTime||0,res=audio.play();
 if(res&&res.then)res.then(function(){
  // Réappliquer après play() : certains moteurs mobiles restaurent l'état du
  // média au moment de l'activation de la session audio.
  audio.muted=false;audio.defaultMuted=false;audio.volume=volume;status("");
 }).catch(function(){
  status("Lecture bloquée : appuie sur ▶ pour démarrer le son.");
 });
 // Samsung/Chrome peut conserver indéfiniment une promesse play() en attente
 // après le remplacement d'une URL blob. Un seul rechargement local suffit,
 // sans toucher aux morceaux réseau qui peuvent simplement charger lentement.
 if(loadedBlob)setTimeout(function(){
  if(!loadedBlob||audio.error||audio.currentTime>before+.01||audio.readyState>=3)return;
  audio.pause();audio.load();syncPlaybackSettings();
  var retry=audio.play();if(retry&&retry.catch)retry.catch(function(){status("Lecture bloquée : appuie sur ▶ pour démarrer le son.");});
 },1400);
 if(graphReady){
  graphReady.then(function(ok){if(!ok&&analyser&&!audio.paused)nativeAudioFallback(audio.currentTime);});
  setTimeout(function(){if(analyser&&ctx&&ctx.state!=="running"&&!audio.paused)nativeAudioFallback(audio.currentTime);},500);
 }
}
async function pick(id,autoplay){
 init();
 var pl=getList(),item=pl.tracks.find(function(t){return t.id===id;});
 if(!item)return;
 if(currentId===id&&audio.src){if(autoplay)play();else render();return;}
 var token=++loadingId;
 currentId=id;audio.pause();status("Chargement…");render();
 try{
  if(item.kind==="public")setSource(urlFor(item.path),false);
  else{
   var record=await dbOp("get",item.blobKey||item.id);
   if(token!==loadingId)return;
   if(!record||!record.blob){status("Fichier local introuvable. Réimporte ce son.");return;}
   setSource(URL.createObjectURL(record.blob),true);
  }
  status("");
  if(autoplay)play();
 }catch(e){status("Impossible d'ouvrir ce fichier : "+e.message);}
 render();
}
function moveTrack(id,direction){
 var p=getList();if(p.readonly)return;
 var i=p.tracks.findIndex(function(x){return x.id===id;}),j=i+direction;
 if(i<0||j<0||j>=p.tracks.length)return;
 var item=p.tracks.splice(i,1)[0];p.tracks.splice(j,0,item);store();render();
}
function dropTrack(id,other){
 var p=getList();if(p.readonly||id===other)return;
 var i=p.tracks.findIndex(function(t){return t.id===id;}),j=p.tracks.findIndex(function(t){return t.id===other;});
 if(i<0||j<0)return;
 var entry=p.tracks.splice(i,1)[0];p.tracks.splice(j,0,entry);store();render();
}
function removeTrack(id){
 var p=getList();if(p.readonly)return;
 p.tracks=p.tracks.filter(function(t){return t.id!==id;});
 if(currentId===id){audio.pause();currentId=null;audio.removeAttribute("src");releaseUrl();}
 store();render();
}
async function importFiles(files){
 init();
 files=Array.from(files||[]).filter(function(f){return f&&typeof f.name==="string"&&(f.type.startsWith("audio/")||looksAudio(f.name));});
 if(!files.length){status("Sélectionne des fichiers audio MP3, WAV, OGG, M4A ou FLAC.");return;}
 var p=getList();
 if(p.readonly)p=createPlaylist("Ma playlist 1",true);
 var count=0,failed=0;
 status("Importation des fichiers…");
 for(var i=0;i<files.length;i++){
  var file=files[i],id=stamp();
  try{
   await dbOp("put",null,{id:id,blob:file,name:file.name});
   var item={id:id,blobKey:id,kind:"blob",name:label(file.name)};
   p.tracks.push(item);count++;
  }catch(e){failed++;}
 }
 // Importer = ajouter à la playlist, sans changer le morceau en cours et
 // surtout sans lancer la lecture. ▶ reste une action volontaire.
 if(count)store();
 status(count+" fichier(s) ajouté(s)."+(failed?" "+failed+" échec(s) : vérifie l'espace de stockage.":"")+(count?" Appuie sur ▶ pour écouter.":""));
 render();
}
function openPublic(item){
 if(!item||!item.path||!looksAudio(item.name))return;
 init();
 var p=makeOpenedPlaylist(),id="public:"+item.path;
 if(!p.tracks.some(function(t){return t.id===id;}))p.tracks.push({id:id,name:label(item.name),path:item.path,kind:"public"});
 setPlaylist(p.id);store();open();pick(id,true);
}
async function openBlob(blob,name){
 init();if(!blob)return;
 var p=makeOpenedPlaylist(),id=stamp();
 try{
  await dbOp("put",null,{id:id,blob:blob,name:name});
  p.tracks.push({id:id,name:label(name),kind:"blob",blobKey:id});
  setPlaylist(p.id);store();open();pick(id,true);
 }catch(e){status("Import impossible : stockage du navigateur indisponible.");}
}
function prev(){
 var tracks=getList().tracks;
 if(!tracks.length)return;
 var index=tracks.findIndex(function(t){return t.id===currentId;});
 if(audio.currentTime>3&&index>=0){audio.currentTime=0;return;}
 pick(tracks[(index-1+tracks.length)%tracks.length].id,true);
}
function next(manual){
 var tracks=getList().tracks;if(!tracks.length)return;
 if(repeat==="un"&&!manual){audio.currentTime=0;play();return;}
 var i=tracks.findIndex(function(t){return t.id===currentId;});
 if(shuffle&&tracks.length>1){
  var n=Math.floor(Math.random()*(tracks.length-1));
  if(n>=i&&i>=0)n++;
  pick(tracks[n].id,true);return;
 }
 if(i+1>=tracks.length){
  if(!manual&&repeat==="aucun"){audio.pause();return;}
  pick(tracks[0].id,true);return;
 }
 pick(tracks[i+1].id,true);
}
function nextAfterEnd(){next(false);}
function clearTrack(){
 audio.pause();currentId=null;audio.removeAttribute("src");releaseUrl();render();
}
function renderStatus(){
 if(view&&view.isConnected){
  var n=view.querySelector("[data-amp-status]");
  if(n)n.textContent=notifyText;
 }
}
function renderProgress(){
 if(!view||!view.isConnected)return;
 var item=getTrack(),progress=view.querySelector("[data-amp-progress]");
 view.querySelector("[data-amp-now]").textContent=item?item.name:"AUCUN MORCEAU CHARGÉ";
 // Pochette de la PLAYLIST, et non du morceau ; asynchrone et mise en cache.
 renderCover();
 view.querySelector("[data-amp-time]").textContent=format(audio.currentTime)+" / "+format(audio.duration);
 var playControl=view.querySelector("[data-amp-play]");
 playControl.textContent=audio.paused?"▶":"Ⅱ";
 playControl.classList.toggle("amp3-playing",!audio.paused&&!audio.ended);
 var led=view.querySelector("[data-amp-led]");
 if(led){led.textContent=audio.paused?"● VEILLE":"● LECTURE";led.classList.toggle("amp3-led-active",!audio.paused);}
 if(progress)progress.value=audio.duration&&Number.isFinite(audio.duration)?Math.round(1000*audio.currentTime/audio.duration):0;
}
function renderEq(){
 if(!view||!view.isConnected)return;
 var box=view.querySelector("[data-amp-eq]");if(!box)return;
 box.innerHTML="";
 var cols=el("div","amp3-eq-bands");
 eq.forEach(function(gain,i){
  var group=el("label","amp3-eq-band");
  group.appendChild(el("span","amp3-eq-gain",(gain>0?"+":"")+gain+" dB"));
  var input=el("input");input.type="range";input.min="-12";input.max="12";input.step="1";input.value=String(gain);
  input.setAttribute("aria-label",eqNames[i]);
  input.oninput=function(){
   eq[i]=Number(input.value);
   group.firstChild.textContent=(eq[i]>0?"+":"")+eq[i]+" dB";
   if(filters[i])filters[i].gain.value=eq[i];
   preset="Personnalisé";
   var selected=view&&view.querySelector("[data-amp-preset]");
   if(selected)selected.value="Personnalisé";
   store();
  };
  group.appendChild(input);
  group.appendChild(el("span","amp3-eq-name",eqNames[i]));
  cols.appendChild(group);
 });
 box.appendChild(cols);
 var sel=view.querySelector("[data-amp-preset]");
 if(sel)sel.value=presetValues[preset]?preset:"Personnalisé";
}
function render(){
 if(!view||!view.isConnected)return;
 var list=getList(),sel=view.querySelector("[data-amp-select]");
 var last=sel.value;sel.innerHTML="";
 [album].concat(playlists).forEach(function(p){
  var opt=el("option","",p.name);
  opt.value=p.id;sel.appendChild(opt);
 });
 sel.value=current;
 var rows=view.querySelector("[data-amp-rows]");
 var oldListScroll=rows.dataset.playlist===current?rows.scrollTop:0;
 rows.innerHTML="";rows.dataset.playlist=current;
 var editable=!list.readonly;
 view.querySelector("[data-amp-rename]").disabled=!editable||list.id===OPENED;
 view.querySelector("[data-amp-delete-list]").disabled=!editable||list.id===OPENED;
 view.querySelector("[data-amp-import]").textContent=editable?"＋ Importer des sons":"＋ Créer avec mes sons";
 if(!list.tracks.length){
  rows.appendChild(el("div","amp3-empty",list.readonly?
   albumChecked?
    "Aucun morceau trouvé sur GitHub. Vérifie STUDIO/BUREAU/Zebra Tape 2/Son : les fichiers audio doivent être enregistrés avec « Commit changes ».":
    "Chargement de Zebra Tape 2 depuis GitHub…":
   "Playlist vide. Importe un ou plusieurs morceaux, même en une seule fois."));
 }else{
  list.tracks.forEach(function(t,i){
   var row=el("div","amp3-track"+(currentId===t.id?" active":""));
   row.draggable=editable;
   row.ondragstart=function(ev){if(!editable)return;ev.dataTransfer.setData("text/plain",t.id);ev.dataTransfer.effectAllowed="move";};
   row.ondragover=function(ev){if(editable)ev.preventDefault();};
   row.ondrop=function(ev){if(!editable)return;ev.preventDefault();dropTrack(ev.dataTransfer.getData("text/plain"),t.id);};
   var playBtn=b("▶",function(){pick(t.id,true);},"amp3-item-play");

   row.appendChild(playBtn);
   var info=el("div","amp3-track-info");
   info.appendChild(el("span","amp3-track-title",(i+1)+". "+t.name));
   info.appendChild(el("small","amp3-track-source",trackArtist(t)));
   row.appendChild(info);
   if(editable){
    row.appendChild(b("↑",function(){moveTrack(t.id,-1);},"amp3-small"));
    row.appendChild(b("↓",function(){moveTrack(t.id,1);},"amp3-small"));
    row.appendChild(b("×",function(){removeTrack(t.id);},"amp3-small amp3-danger"));
   }
   rows.appendChild(row);
  });
 }
 view.querySelector("[data-amp-shuffle]").classList.toggle("enabled",shuffle);
 var repeatBtn=view.querySelector("[data-amp-repeat]");
 repeatBtn.textContent=repeat==="aucun"?"↻ ×":repeat==="un"?"↻ 1":"↻ ∞";
 repeatBtn.title=repeat==="aucun"?"Répétition désactivée":repeat==="un"?"Répéter ce morceau":"Répéter toute la playlist";
 repeatBtn.setAttribute("aria-label",repeatBtn.title);
 repeatBtn.setAttribute("aria-pressed",String(repeat!=="aucun"));
 var shuffleBtn=view.querySelector("[data-amp-shuffle]");
 shuffleBtn.title=shuffle?"Mode aléatoire activé":"Mode aléatoire désactivé";
 shuffleBtn.setAttribute("aria-label",shuffleBtn.title);
 shuffleBtn.setAttribute("aria-pressed",String(shuffle));
 view.querySelector("[data-amp-speed]").textContent="VITESSE "+Math.round(speed*100)+" %";
 renderReverb();
 var speedInput=view.querySelector("[data-amp-speed-input]");
 if(speedInput)speedInput.value=String(Math.round(speed*100));
 var speedValue=view.querySelector("[data-amp-speed-value]");
 if(speedValue)speedValue.textContent=Math.round(speed*100)+" %";
 view.querySelector("[data-amp-volume]").value=String(Math.round(volume*100));
 rows.scrollTop=oldListScroll;
 renderProgress();renderStatus();
}
function visualize(){
 if(!view||!view.isConnected)return;
 var canvas=view.querySelector("canvas.amp3-spectrum"),c=canvas&&canvas.getContext("2d");
 if(!c)return;
 if(animation)cancelAnimationFrame(animation);
 // L'analyseur audio est créé au premier clic ▶, APRES l'ouverture de
 // ZebraAMP. Ne surtout pas figer bins=null à l'ouverture de la fenêtre.
 var bins=null,miniBands=new Float32Array(32),miniLevels=new Float32Array(32);
 var last=0,pausedFramePainted=false;
 function frame(now,force){
  if(!view||!view.isConnected)return;
  // Un appel direct par l'événement play/pause n'ajoute pas une 2e
  // boucle requestAnimationFrame (économie batterie mobile).
  if(!force)animation=requestAnimationFrame(frame);
  if(document.hidden||(!force&&now-last<33))return;
  var elapsed=Math.max(.001,Math.min(.1,(now-last)/1000));
  last=now;
  // Ne pas redessiner indéfiniment le spectre noir en pause (batterie mobile).
  if(analyser&&(!bins||bins.length!==analyser.frequencyBinCount)){
   bins=new Uint8Array(analyser.frequencyBinCount);pausedFramePainted=false;
  }
  if(!audio.paused&&ctx&&ctx.state!=="running")resumeGraph();
  if(audio.paused){if(pausedFramePainted)return;pausedFramePainted=true;}
  else pausedFramePainted=false;
  var width=canvas.clientWidth||125,height=canvas.clientHeight||58;
  var dpr=Math.min(window.devicePixelRatio||1,1.5),w=Math.round(width*dpr),h=Math.round(height*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  c.setTransform(dpr,0,0,dpr,0,0);
  c.fillStyle="#03140e";c.fillRect(0,0,width,height);
  // Grille légère pour que le CRT ait un véritable affichage à l'arrêt.
  c.strokeStyle="rgba(86,165,117,.13)";c.lineWidth=1;
  c.beginPath();
  for(var gx=0;gx<width;gx+=18){c.moveTo(gx,0);c.lineTo(gx,height);}
  for(var gy=0;gy<height;gy+=14){c.moveTo(0,gy);c.lineTo(width,gy);}
  c.stroke();
  var bars=32,gap=Math.max(1,width*.006),margin=width*.055;
  var bw=Math.max(1,(width-2*margin-gap*(bars-1))/bars),floor=height*.82;
  if(analyser&&bins&&!audio.paused){
   try{analyser.getByteFrequencyData(bins);}catch(e){}
  }
  if(analyser&&bins&&window.ZebraVisualizer&&window.ZebraVisualizer.sampleBands){
   window.ZebraVisualizer.sampleBands(bins,analyser,bars,miniBands);
  }else miniBands.fill(0);
  for(var i=0;i<bars;i++){
   var target=bins&&!audio.paused?miniBands[i]:0;
   miniLevels[i]=audio.paused?0:miniLevels[i]+(target-miniLevels[i])*(1-Math.exp(-elapsed/(target>miniLevels[i]?.025:.15)));
   var v=miniLevels[i];
   var hh=Math.max(2,v*(height*.68));
   var x=margin+i*(bw+gap);
   // Match ZebraVIS phosphor: broad green emission and a hot fine core.
   // The dim baseline stays unlit when audio is paused or silent.
   if(v>.025){
    c.save();c.globalCompositeOperation="lighter";
    c.shadowColor="#20ff84";c.shadowBlur=Math.min(16,height*.15);
    c.fillStyle="rgba(37,255,132,.42)";c.fillRect(x,floor-hh,bw,hh);
    c.shadowColor="#7affb0";c.shadowBlur=Math.min(6,height*.06);
    c.fillStyle="rgba(170,255,205,.83)";c.fillRect(x,floor-hh,bw,hh);
    c.restore();c.shadowBlur=0;
    c.fillStyle="#ddffe9";c.fillRect(x+bw*.2,floor-hh,bw*.6,hh);
    c.shadowColor="#8affbc";c.shadowBlur=6;
    c.fillStyle="#edfff2";c.fillRect(x,floor-hh-2,bw,1.4);
    c.shadowBlur=0;
   }else{c.fillStyle="#356c4c";c.fillRect(x,floor-hh,bw,hh);}
  }
  c.shadowColor="#66ff9e";c.shadowBlur=5;
  c.fillStyle="#a4eec0";c.font="9px monospace";
  // Pendant un silence musical, les barres descendent mais le morceau
  // est toujours en lecture. L'état affiché dépend du lecteur, jamais
  // de l'énergie mesurée par l'analyseur.
  var playing=!audio.paused&&!audio.ended;
  c.fillText(playing?"CH 01 • AUDIO":"CH 01 • VEILLE",8,12);
  c.shadowBlur=0;
  var signal=view&&view.querySelector("[data-amp-spectrum-status]");
  if(signal)signal.textContent=playing?"SIGNAL":"VEILLE";
 }
 spectrumRefresh=function(){
  pausedFramePainted=false;
  frame(performance.now(),true);
 };
 animation=requestAnimationFrame(frame);
}
function loadVisualizer(){
 if(window.ZebraVisualizer)return Promise.resolve(window.ZebraVisualizer);
 if(visualizerPromise)return visualizerPromise;
 function inject(url){
  return new Promise(function(resolve,reject){
   var script=document.createElement("script");
   script.src=url;script.async=true;
   script.onload=resolve;
   script.onerror=function(){reject(Error("Impossible de charger "+url));};
   document.head.appendChild(script);
  });
 }
 // Keep the approved spectrum and scope available even if the optional
 // reactive graphics module cannot be downloaded.
 visualizerPromise=inject("/visualizer-reactive.js?v=1.1").catch(function(){return null;})
  .then(function(){return inject("/visualizer.js?v=4.14");})
  .then(function(){
   if(!window.ZebraVisualizer)throw Error("Module ZebraVIS introuvable.");
   return window.ZebraVisualizer;
  })
  .catch(function(err){visualizerPromise=null;throw err;});
 return visualizerPromise;
}
function openVisualizer(){
 resumeGraph();
 loadVisualizer().then(function(module){
  if(!view||!view.isConnected)return;
  var config=window.ZebraAMPConfig;
  if(!config||typeof config.windowBox!=="function")return;
  var box=config.windowBox("visualizer","ZebraVIS.exe — Visualiseur",650,500);
  module.mount(box,audio,{analyser:analyser,getAnalyser:function(){return analyser;},previous:prev,next:function(){next(true);},toggle:togglePlayback});
 }).catch(function(err){status(err.message||"Visualiseur indisponible.");});
}
function startAmpBootGreeting(node){
 if(!node)return;
 node.innerHTML="";node.classList.remove("amp3-boot-dim");
 var prefix="// ",hello="Hello :)",timers=[];
 function later(fn,ms){var id=setTimeout(function(){if(node.isConnected)fn();},ms);timers.push(id);}
 function begin(){
  if(!node.isConnected)return;
  var prefixNode=el("span","amp3-boot-prefix","");
  var helloNode=el("span","amp3-boot-word","");
  node.append(prefixNode,helloNode);
  var full=prefix+hello;
  var index=0;
  function typeNext(){
   if(!node.isConnected)return;
   if(index>=full.length){later(startBlink,900);return;}
   var ch=full.charAt(index++);
   if(index<=prefix.length)prefixNode.textContent+=ch;
   else helloNode.textContent+=ch;
   later(typeNext,95+((index%3)*20));
  }
  function startBlink(){
   var flashes=0;
   function hideWord(){
    if(!node.isConnected)return;
    helloNode.classList.add("amp3-boot-dim");
    later(showWord,950);
   }
   function showWord(){
    if(!node.isConnected)return;
    helloNode.classList.remove("amp3-boot-dim");
    flashes++;
    if(flashes<2)later(hideWord,1250);
    else later(function(){eraseHello(hello.length);},1200);
   }
   hideWord();
  }
  function eraseHello(left){
   if(!node.isConnected)return;
   if(left<=0){later(function(){erasePrefix(prefixNode.textContent.length);},180);return;}
   helloNode.textContent=helloNode.textContent.slice(0,-1);
   later(function(){eraseHello(left-1);},88);
  }
  function erasePrefix(left){
   if(!node.isConnected)return;
   if(left<=0){node.innerHTML="";return;}
   prefixNode.textContent=prefixNode.textContent.slice(0,-1);
   later(function(){erasePrefix(left-1);},105);
  }
  typeNext();
 }
 later(begin,1000);
}
function open(){
 init();
 if(!window.ZebraAMPConfig||typeof window.ZebraAMPConfig.windowBox!=="function")return;
 var w=window.ZebraAMPConfig.windowBox("amp","ZebraAMP.exe — Lecteur du studio",660,686);
 view=w;
 w.innerHTML="";displayedCover=null;
 var root=el("div","amp3");
 var top=el("div","amp3-head");
 var bootTitle=el("strong","amp3-boot-title","ZEBRAAMP 3.7");
 var bootHello=el("span","amp3-boot-hello","");
 top.append(bootTitle,bootHello);top.appendChild(el("span","amp3-studio-label","STUDIO PLAYER"));root.appendChild(top);
 var stripe=el("div","amp3-zebra-plate");
 stripe.setAttribute("aria-hidden","true");
 stripe.appendChild(el("span","amp3-zebra-rivet amp3-zebra-rivet-left"));
 stripe.appendChild(el("span","amp3-zebra-rivet amp3-zebra-rivet-right"));
 root.appendChild(stripe);
 var screen=el("div","amp3-screen");
 var displayRow=el("div","amp3-display-row");
 var cover=el("div","amp3-cover");
 var art=el("img","amp3-cover-image");
 art.alt="Pochette de la playlist";art.loading="lazy";
 cover.classList.add("amp3-cover-empty");
 cover.tabIndex=0;cover.setAttribute("role","button");
 cover.setAttribute("aria-label","Agrandir la pochette de la playlist");
 cover.title="Agrandir la pochette";
 cover.onclick=openCoverViewer;
 cover.onkeydown=function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();openCoverViewer();}};
 cover.appendChild(art);
 cover.appendChild(el("span","amp3-cover-fallback"));
 var readout=el("div","amp3-readout");
 var meta=el("div","amp3-screen-label");
 // La piste et le statut suffisent : on retire les étiquettes décoratives.
 var led=el("span","amp3-led","● VEILLE");led.setAttribute("data-amp-led","");
 meta.appendChild(led);
 readout.appendChild(meta);
 readout.appendChild(el("div","amp3-marquee","AUCUN MORCEAU CHARGÉ")).setAttribute("data-amp-now","");
 readout.appendChild(el("div","amp3-time","00:00 / 00:00")).setAttribute("data-amp-time","");
 var spectrumBox=el("div","amp3-mini-visual");
 var canvas=el("canvas","amp3-spectrum");
 canvas.setAttribute("aria-label","Spectre audio");
 spectrumBox.appendChild(canvas);
 var spectrumLabel=el("span","amp3-viz-label","SPECTRE / CH 01");
 var spectrumState=el("span","amp3-viz-state","VEILLE");
 spectrumState.setAttribute("data-amp-spectrum-status","");
 spectrumBox.prepend(spectrumLabel);spectrumBox.appendChild(spectrumState);
 var infoScreen=el("div","amp3-info-screen");
 infoScreen.append(cover,readout);
 displayRow.append(spectrumBox,infoScreen);
 screen.appendChild(displayRow);
 var seek=el("input");seek.type="range";seek.min="0";seek.max="1000";seek.value="0";seek.setAttribute("data-amp-progress","");
 seek.oninput=function(){if(Number.isFinite(audio.duration)&&audio.duration)audio.currentTime=Number(seek.value)*audio.duration/1000;};
 screen.appendChild(seek);root.appendChild(screen);
 var controls=el("div","amp3-controls");
 var transports=el("div","amp3-transports");
 var prevBtn=b("Ⅰ◀",prev,"amp3-btn amp3-transport");prevBtn.title="Morceau précédent";transports.appendChild(prevBtn);
 var playBtn=b("▶",function(){
   togglePlayback();
 },"amp3-btn amp3-play amp3-transport");
 playBtn.setAttribute("data-amp-play","");playBtn.title="Lecture / Pause";transports.appendChild(playBtn);
 var stopBtn=b("■",function(){audio.pause();audio.currentTime=0;renderProgress();},"amp3-btn amp3-transport");
 stopBtn.title="Arrêter";transports.appendChild(stopBtn);
 var nextBtn=b("▶Ⅰ",function(){next(true);},"amp3-btn amp3-transport");nextBtn.title="Morceau suivant";transports.appendChild(nextBtn);
 controls.appendChild(transports);
 var modes=el("div","amp3-modes");
 var shuffleBtn=b("⇄",function(){shuffle=!shuffle;store();render();},"amp3-btn amp3-mode-shuffle");
 shuffleBtn.setAttribute("data-amp-shuffle","");modes.appendChild(shuffleBtn);
 var repeatBtn=b("↻ ∞",function(){repeat=repeat==="tout"?"un":repeat==="un"?"aucun":"tout";store();render();},"amp3-btn amp3-mode-repeat");
 repeatBtn.setAttribute("data-amp-repeat","");modes.appendChild(repeatBtn);
 var visualButton=b("VIS",openVisualizer,"amp3-btn amp3-visual-btn");
 visualButton.title="Ouvrir ZebraVIS en grand";visualButton.setAttribute("aria-label",visualButton.title);
 modes.appendChild(visualButton);
 controls.appendChild(modes);
 root.appendChild(controls);
 var extra=el("div","amp3-extras");
 var volumeGroup=el("label","","VOL.");
 var vol=el("input");vol.type="range";vol.min="0";vol.max="100";vol.setAttribute("data-amp-volume","");
 vol.oninput=function(){volume=Number(vol.value)/100;audio.volume=volume;store();};
 volumeGroup.appendChild(vol);extra.appendChild(volumeGroup);
 var speedGroup=el("div","amp3-speed-group");
 var speedBtn=b("VITESSE 100 %",function(){
  var wasOpen=!speedPanel.hidden;
  speedPanel.hidden=wasOpen;
  speedBtn.setAttribute("aria-expanded",String(!wasOpen));
  if(!wasOpen&&reverbPanel&&!reverbPanel.hidden){
   reverbPanel.hidden=true;reverbBtn.setAttribute("aria-expanded","false");
  }
 },"amp3-btn amp3-speed-btn");
 speedBtn.setAttribute("data-amp-speed","");
 speedBtn.setAttribute("aria-expanded","false");
 var speedPanel=el("div","amp3-speed-panel");
 speedPanel.hidden=true;
 var speedHeader=el("div","amp3-speed-header");
 speedHeader.appendChild(el("span","","VITESSE DE LECTURE"));
 var currentSpeed=el("strong","","100 %");
 currentSpeed.setAttribute("data-amp-speed-value","");
 speedHeader.appendChild(currentSpeed);
 speedPanel.appendChild(speedHeader);
 var rate=el("input","amp3-speed-range");
 rate.type="range";rate.min="50";rate.max="150";rate.step="5";rate.value="100";
 rate.setAttribute("aria-label","Vitesse de lecture de 50 à 150 pour cent");
 rate.setAttribute("data-amp-speed-input","");
 rate.oninput=function(){
  var pct=Number(rate.value);
  speed=pct/100;
  syncPlaybackSettings();
  speedBtn.textContent="VITESSE "+pct+" %";
  currentSpeed.textContent=pct+" %";
  store();
 };
 speedPanel.appendChild(rate);
 var ticks=el("div","amp3-speed-ticks");
 ticks.append(el("span","","50 %"),el("span","","100 %"),el("span","","150 %"));
 speedPanel.appendChild(ticks);
 // Un seul curseur, aucun preset ou choix de tonalité.
 // La vitesse ralentit naturellement la hauteur (vinyle).
 var speedReset=b("↺ 1×",function(){
  rate.value="100";rate.oninput();
 },"amp3-btn amp3-speed-reset");
 speedReset.title="Rétablir la vitesse normale (100 %)";
 speedPanel.appendChild(speedReset);
 speedGroup.append(speedBtn,speedPanel);
 extra.appendChild(speedGroup);
 // Réverb indépendante de la vitesse, panneau aussi compact que VITESSE.
 var reverbGroup=el("div","amp3-reverb-group");
 var reverbBtn=b("RÉVERB 0 %",function(){
  var wasOpen=!reverbPanel.hidden;
  reverbPanel.hidden=wasOpen;
  reverbBtn.setAttribute("aria-expanded",String(!wasOpen));
  if(!wasOpen&&speedPanel&&!speedPanel.hidden){
   speedPanel.hidden=true;speedBtn.setAttribute("aria-expanded","false");
  }
 },"amp3-btn amp3-reverb-btn");
 reverbBtn.setAttribute("data-amp-reverb","");
 reverbBtn.setAttribute("aria-expanded","false");
 reverbBtn.title="Réverbération en temps réel";
 var reverbPanel=el("div","amp3-reverb-panel");
 reverbPanel.hidden=true;
 var reverbHead=el("div","amp3-reverb-header");
 reverbHead.appendChild(el("span","","RÉVERBÉRATION"));
 var reverbValue=el("strong","","0 %");
 reverbValue.setAttribute("data-amp-reverb-value","");
 reverbHead.appendChild(reverbValue);
 reverbPanel.appendChild(reverbHead);
 var reverbRange=el("input","amp3-reverb-range");
 reverbRange.type="range";reverbRange.min="0";reverbRange.max="100";
 reverbRange.step="5";reverbRange.value=String(reverb);
 reverbRange.setAttribute("data-amp-reverb-input","");
 reverbRange.setAttribute("aria-label","Réverbération de zéro à cent pour cent");
 reverbRange.oninput=function(){setReverb(reverbRange.value);};
 reverbPanel.appendChild(reverbRange);
 var reverbTicks=el("div","amp3-reverb-ticks");
 reverbTicks.append(el("span","","SEC"),el("span","","BRUME"),el("span","","IMMENSE"));
 reverbPanel.appendChild(reverbTicks);
 var reverbPresets=el("div","amp3-reverb-presets");
 [["SEC",0],["DOUX",30],["RÊVE",65],["IMMENSE",100]].forEach(function(p){
  reverbPresets.appendChild(b(p[0],function(){setReverb(p[1]);},"amp3-btn amp3-reverb-preset"));
 });
 reverbPanel.appendChild(reverbPresets);
 reverbPanel.appendChild(el("div","amp3-reverb-description","RÉVERBÉRATION · DURÉE : 3,4 S"));
 reverbGroup.append(reverbBtn,reverbPanel);
 extra.appendChild(reverbGroup);
 root.appendChild(extra);
 var eqBlock=el("details","amp3-eq-panel");
 var summary=el("summary","","▸ ÉGALISEUR · 5 BANDES");eqBlock.appendChild(summary);
 var presets=el("div","amp3-preset-row");presets.appendChild(el("span","","SON"));
 var presetSelect=el("select");presetSelect.setAttribute("data-amp-preset","");
 Object.keys(presetValues).concat(["Personnalisé"]).forEach(function(name){
  var option=el("option","",name);option.value=name;presetSelect.appendChild(option);
 });
 presetSelect.onchange=function(){setEq(presetValues[presetSelect.value]||eq,presetSelect.value);};
 presets.appendChild(presetSelect);
 presets.appendChild(b("REMETTRE À ZÉRO",function(){setEq(presetValues.Neutre,"Neutre");},"amp3-btn"));
 eqBlock.appendChild(presets);
 var bands=el("div","");bands.setAttribute("data-amp-eq","");eqBlock.appendChild(bands);
 root.appendChild(eqBlock);
 var playlistTools=el("div","amp3-playlist-tools");
 playlistTools.appendChild(el("span","","PLAYLIST"));
 var select=el("select","amp3-select");select.setAttribute("data-amp-select","");
 select.onchange=function(){setPlaylist(select.value);};
 playlistTools.appendChild(select);
 playlistTools.appendChild(b("＋ NOUVELLE",function(){var name=prompt("Nom de la nouvelle playlist :","Ma playlist");if(name!==null)createPlaylist(name,true);},"amp3-btn"));
 var rename=b("✎",editPlaylist,"amp3-btn");rename.title="Modifier la playlist et sa cover";rename.setAttribute("aria-label",rename.title);rename.setAttribute("data-amp-rename","");playlistTools.appendChild(rename);
 var del=b("×",deleteList,"amp3-btn amp3-danger");del.title="Supprimer la playlist";del.setAttribute("data-amp-delete-list","");playlistTools.appendChild(del);
 root.appendChild(playlistTools);
 var rows=el("div","amp3-list");rows.setAttribute("data-amp-rows","");root.appendChild(rows);
 var actions=el("div","amp3-bottom");
 actions.appendChild(b("＋ IMPORTER DES SONS",function(){var input=document.getElementById("file-music");if(input)input.click();},"amp3-btn amp3-import")).setAttribute("data-amp-import","");
 actions.appendChild(b("↻ ACTUALISER",function(){
  status("Recherche des morceaux dans Zebra Tape 2…");
  updatePublic().then(function(result){
   if(result.ok)status(result.count+" morceau(x) trouvé(s) dans Zebra Tape 2.");
   else status("Actualisation impossible : "+result.error);
  });
 },"amp3-btn"));
 root.appendChild(actions);
 root.appendChild(el("div","amp3-status","")).setAttribute("data-amp-status","");
 w.appendChild(root);
 requestAnimationFrame(function(){requestAnimationFrame(function(){if(bootHello.isConnected)startAmpBootGreeting(bootHello);});});
 render();renderEq();visualize();
 // Actualise aussi après une réouverture de ZebraAMP, sans attendre un clic.
 updatePublic().then(function(result){
   if(result.ok){
     if(current===ALBUM)status(result.count+" morceau(x) dans Zebra Tape 2.");
   }else if(current===ALBUM)status("Mise à jour indisponible : "+result.error);
 });
}
function stop(){
 audio.pause();
 if(animation){cancelAnimationFrame(animation);animation=null;}
 spectrumRefresh=null;view=null;
}
var api={
 open:open,init:init,stop:stop,importFiles:importFiles,openPublic:openPublic,openBlob:openBlob,
 pick:pick,play:play,updatePublic:updatePublic,analyser:function(){return analyser;},
 debug:function(){return {playlist:current,playlists:playlists.map(function(p){return{name:p.name,count:p.tracks.length};}),album:album.tracks.length,speed:speed,preservePitch:preservePitch,pitchMode:preservePitch?"constant":"vinyl",reverb:reverb,reverbActive:!!reverbGraph,reverbConnected:!!(reverbGraph&&reverbGraph.connected),reverbSeconds:reverbGraph?reverbGraph.seconds:null,nativeFallback:nativeFallback,paused:audio.paused,muted:audio.muted,volume:audio.volume,readyState:audio.readyState};}
};
Object.defineProperty(api,"media",{enumerable:true,get:function(){return audio;}});
window.ZebraAMP=api;
}());
