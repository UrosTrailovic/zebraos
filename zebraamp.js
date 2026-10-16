/* ZebraAMP 3.0 — lecteur du studio, sans framework.
 * Album public : index STUDIO/BUREAU/Zebra Tape 2.
 * Playlists personnelles : métadonnées localStorage, fichiers audio IndexedDB.
 * Un seul élément Audio ; EQ Web Audio non destructif ; import multiple et tri.
 * Le lecteur ne charge AUCUN morceau fictif et ne limite pas à neuf pistes.
 */
(function(){
"use strict";
var ALBUM="zebra-tape-2",OPENED="fichiers-ouverts",KEY="zebraamp-v3",DB="zebraamp-v3-audio";
var audio=new Audio();audio.preload="metadata";audio.crossOrigin="anonymous";audio.volume=.7;
var album={id:ALBUM,name:"Zebra Tape 2",readonly:true,tracks:[]};
var playlists=[],current=ALBUM,currentId=null,loadedUrl=null,loadedBlob=null,view=null;
var coverCache=new Map(),displayedCover=null;
var ctx=null,filters=[],analyser=null,graphTried=false,reverbGraph=null;
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
function stamp(){return "pl-"+Date.now()+"-"+Math.random().toString(36).slice(2,8);}
function label(name){return String(name||"Sans titre").replace(/\.[^.]+$/,"").slice(0,150);}
function getList(){return current===ALBUM?album:playlists.find(function(p){return p.id===current;})||album;}
function getTrack(){return getList().tracks.find(function(t){return t.id===currentId;})||null;}
function format(t){if(!Number.isFinite(t)||t<0)return "00:00";t=Math.floor(t);return String(Math.floor(t/60)).padStart(2,"0")+":"+String(t%60).padStart(2,"0");}
function status(text){notifyText=text||"";renderStatus();}
function store(){
 try{localStorage.setItem(KEY,JSON.stringify({
   playlists:playlists,volume:volume,shuffle:shuffle,repeat:repeat,
   speed:speed,pitchMode:preservePitch?"constant":"vinyl",reverb:reverb,eq:eq,preset:preset
 }));}catch(e){status("Stockage des préférences indisponible.");}
}
function restore(){
 try{
  var d=JSON.parse(localStorage.getItem(KEY)||"null");
  if(!d||typeof d!=="object")return;
  if(Array.isArray(d.playlists))playlists=d.playlists.slice(0,60).filter(function(p){
   return p&&typeof p.id==="string"&&typeof p.name==="string"&&
    p.id!==ALBUM&&Array.isArray(p.tracks);
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
function init(){
 if(initDone)return;
 initDone=true;applyPitchMode();restore();
 if(window.ZebraGitFiles){
  window.ZebraGitFiles.subscribe(function(){syncAlbum(window.ZebraGitFiles.allFiles());});
  updatePublic();
 }
 audio.addEventListener("ended",nextAfterEnd);
 ["play","pause","timeupdate","loadedmetadata","durationchange","ratechange","volumechange","waiting","canplay"].forEach(function(k){
  audio.addEventListener(k,function(){renderProgress();if(k==="play"||k==="pause"){render();if(spectrumRefresh)spectrumRefresh();}});
 });
 audio.addEventListener("error",function(){status("Impossible de lire ce fichier audio. Vérifie son format et son accès.");});
}
function ensureGraph(){
 if(graphTried)return !!analyser;
 graphTried=true;
 try{
  var AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx){status("Égaliseur indisponible sur ce navigateur.");return false;}
  ctx=new AudioCtx();
  var src=ctx.createMediaElementSource(audio);
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
  status("L'égaliseur n'a pas pu démarrer. Recharge la page pour réessayer.");
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
  reverbGraph={dry:dry,wet:wet,preDelay:preDelay,convolver:convolver,limiter:limiter,connected:true,seconds:seconds};
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
 // L'effet augmente vraiment : moins de son sec, davantage de résonance
 // spatiale. Le compresseur adoucit les crêtes lorsque les deux s'additionnent.
 state.dry.gain.setTargetAtTime(1-.40*t,now,.035);
 state.wet.gain.setTargetAtTime(1.30*Math.pow(t,.82),now,.035);
 if(t===0&&state.connected){
  analyser.disconnect(state.preDelay);state.connected=false;
 }
}
function setReverb(value){
 reverb=Math.max(0,Math.min(100,Math.round((Number(value)||0)/5)*5));
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
 if(!ensureGraph())return;
 if(ctx&&ctx.state==="suspended"){var r=ctx.resume();if(r&&r.catch)r.catch(function(){});}
}
function setEq(values,name){
 eq=values.map(function(x){return Math.max(-12,Math.min(12,Number(x)||0));});
 preset=name||"Personnalisé";
 filters.forEach(function(f,i){f.gain.value=eq[i];});
 store();renderEq();
}
function setPlaylist(id){
 if(id!==ALBUM&&!playlists.some(function(p){return p.id===id;}))return;
 if(current!==id){audio.pause();currentId=null;audio.removeAttribute("src");releaseUrl();}
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
function applyCoverImage(art,cover,src){
 cover.classList.add("amp3-cover-empty");
 art.onload=function(){if(art.getAttribute("src")===src)cover.classList.remove("amp3-cover-empty");};
 art.onerror=function(){if(art.getAttribute("src")===src)cover.classList.add("amp3-cover-empty");};
 art.alt="Pochette de la playlist "+getList().name;
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
  applyCoverImage(art,cover,"/STUDIO/BUREAU/Zebra%20Tape%202/Cover/front%202.webp");
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
function editPlaylist(){
 var p=getList();if(p.readonly||!view)return;
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
 var p=getList();if(p.readonly)return;
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
 releaseUrl();
 if(isBlob)loadedBlob=src;
 audio.pause();audio.src=src;audio.load();renderProgress();
}
function togglePlayback(){
 if(audio.paused){
  var t=getTrack();
  if(t){if(audio.src)play();else pick(t.id,true);}
  else{var p=getList();if(p.tracks.length)pick(p.tracks[0].id,true);}
 }else audio.pause();
}
function play(){
 resumeGraph();
 var res=audio.play();if(res&&res.catch)res.catch(function(err){
  status("Lecture bloquée : appuie sur ▶ pour démarrer le son.");
 });
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
 view.querySelector("[data-amp-play]").textContent=audio.paused?"▶":"Ⅱ";
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
 view.querySelector("[data-amp-rename]").disabled=!editable;
 view.querySelector("[data-amp-delete-list]").disabled=!editable;
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
   info.appendChild(el("small","amp3-track-source",t.kind==="public"?"ZEBRAOS":"LOCAL"));
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
  if(!audio.paused&&ctx&&ctx.state==="suspended")resumeGraph();
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
  var bassEnergy=0;
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
   bassEnergy+=v;
   var hh=Math.max(2,v*(height*.68));
   var x=margin+i*(bw+gap);
   c.fillStyle=v>.13?"#8df2b9":"#3d8e64";
   c.fillRect(x,floor-hh,bw,hh);
   if(v>.08){c.fillStyle="#c6ffda";c.fillRect(x,floor-hh-2,bw,2);}
  }
  c.fillStyle="#5eae85";c.font="9px monospace";
  c.fillText(!audio.paused?(analyser&&bassEnergy>.02?"CH 01 • AUDIO":"CH 01 • EN ATTENTE"):"CH 01 • VEILLE",8,12);
  var signal=view&&view.querySelector("[data-amp-spectrum-status]");
  if(signal)signal.textContent=audio.paused?"VEILLE":analyser&&bassEnergy>.02?"SIGNAL":"ANALYSE…";
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
 visualizerPromise=new Promise(function(resolve,reject){
  var script=document.createElement("script");
  script.src="/visualizer.js?v=4.0";script.async=true;
  script.onload=function(){
   if(window.ZebraVisualizer)resolve(window.ZebraVisualizer);
   else reject(Error("Module ZebraVIS introuvable."));
  };
  script.onerror=function(){reject(Error("Impossible de charger ZebraVIS."));};
  document.head.appendChild(script);
 }).catch(function(err){visualizerPromise=null;throw err;});
 return visualizerPromise;
}
function openVisualizer(){
 resumeGraph();
 loadVisualizer().then(function(module){
  if(!view||!view.isConnected)return;
  var config=window.ZebraAMPConfig;
  if(!config||typeof config.windowBox!=="function")return;
  var box=config.windowBox("visualizer","ZebraVIS.exe — Visualiseur",650,500);
  module.mount(box,audio,{analyser:analyser,previous:prev,next:function(){next(true);},toggle:togglePlayback});
 }).catch(function(err){status(err.message||"Visualiseur indisponible.");});
}
function open(){
 init();
 if(!window.ZebraAMPConfig||typeof window.ZebraAMPConfig.windowBox!=="function")return;
 var w=window.ZebraAMPConfig.windowBox("amp","ZebraAMP.exe — Lecteur du studio",660,635);
 view=w;
 w.innerHTML="";displayedCover=null;
 var root=el("div","amp3");
 var top=el("div","amp3-head");top.appendChild(el("strong","","ZEBRAAMP 3.7"));top.appendChild(el("span","","STUDIO PLAYER"));root.appendChild(top);
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
  audio.playbackRate=speed;
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
 reverbPanel.appendChild(el("div","amp3-reverb-description","Résonance longue · 3,4 secondes · stéréo chaude. Essaie 70–85 %."));
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
window.ZebraAMP={
 open:open,init:init,stop:stop,importFiles:importFiles,openPublic:openPublic,openBlob:openBlob,
 pick:pick,play:play,updatePublic:updatePublic,media:audio,analyser:function(){return analyser;},
 debug:function(){return {playlist:current,playlists:playlists.map(function(p){return{name:p.name,count:p.tracks.length};}),album:album.tracks.length,speed:speed,preservePitch:preservePitch,pitchMode:preservePitch?"constant":"vinyl",reverb:reverb,reverbActive:!!reverbGraph,reverbConnected:!!(reverbGraph&&reverbGraph.connected),reverbSeconds:reverbGraph?reverbGraph.seconds:null};}
};
}());