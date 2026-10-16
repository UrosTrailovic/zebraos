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
var ctx=null,filters=[],analyser=null,graphTried=false;
var allSounds=[],dbPromise=null,dbAvailable=true,shuffle=false,repeat="tout",speed=1,volume=.7,eq=[0,0,0,0,0],preset="Neutre";
var presetValues={
 "Neutre":[0,0,0,0,0],
 "Basses":[7,4,0,-1,-2],
 "Clair":[-2,0,2,4,4],
 "Vintage":[4,2,-1,-3,-7],
 "Nuit":[3,1,0,-2,-3],
 "Voix":[-4,-2,3,5,2]
};
var eqFreq=[70,250,1000,3500,11000],eqNames=["GRAVES","BAS-MÉD.","MÉDIUMS","PRÉSENCE","AIGUS"];
var animation=null,loadingId=0,notifyText="",initDone=false,albumChecked=false;
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
   speed:speed,eq:eq,preset:preset
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
   tracks:p.tracks.filter(function(t){return t&&typeof t.id==="string"&&
    (t.kind==="blob"||t.kind==="public")&&typeof t.name==="string";}).slice(0,800)};});
  // À chaque nouvel accès au site, la playlist de démarrage est Zebra Tape 2.
  // Le changement de playlist reste possible ensuite pendant la session.
  if(!Number.isNaN(Number(d.volume)))volume=Math.max(0,Math.min(1,Number(d.volume)));
  shuffle=!!d.shuffle;repeat=["aucun","tout","un"].includes(d.repeat)?d.repeat:"tout";
  speed=[.75,1,1.25,1.5].includes(d.speed)?d.speed:1;
  if(Array.isArray(d.eq)&&d.eq.length===5)eq=d.eq.map(function(x){return Math.max(-12,Math.min(12,Number(x)||0));});
  if(typeof d.preset==="string")preset=d.preset;
 }catch(e){}
 audio.volume=volume;audio.playbackRate=speed;
 current=ALBUM;
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
 initDone=true;restore();
 if(window.ZebraGitFiles){
  window.ZebraGitFiles.subscribe(function(){syncAlbum(window.ZebraGitFiles.allFiles());});
  updatePublic();
 }
 audio.addEventListener("ended",nextAfterEnd);
 ["play","pause","timeupdate","loadedmetadata","durationchange","ratechange","volumechange","waiting","canplay"].forEach(function(k){
  audio.addEventListener(k,function(){renderProgress();if(k==="play"||k==="pause")render();});
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
  return true;
 }catch(err){
  status("L'égaliseur n'a pas pu démarrer. Recharge la page pour réessayer.");
  return false;
 }
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
function renameList(){
 var p=getList();if(p.readonly)return;
 var name=prompt("Nouveau nom de la playlist :",p.name);
 if(name===null)return;
 name=name.trim().slice(0,85);if(!name)return;
 p.name=name;store();render();
}
function deleteList(){
 var p=getList();if(p.readonly)return;
 if(!confirm("Supprimer cette playlist ? Les fichiers importés ne seront pas supprimés des autres playlists."))return;
 playlists=playlists.filter(function(q){return q.id!==p.id;});
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
 // La pochette du disque apparaît uniquement pour Zebra Tape 2, et ne
 // prétend pas être la cover d'un son importé depuis l'appareil.
 var cover=view.querySelector(".amp3-cover"),art=view.querySelector(".amp3-cover-image");
 if(cover){
  var isTape=!!(item&&item.kind==="public"&&item.path&&item.path.startsWith("STUDIO/BUREAU/Zebra Tape 2/"));
  cover.classList.toggle("amp3-cover-empty",!isTape||!!(art&&art.dataset.failed==="1"));
 }
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
 var rows=view.querySelector("[data-amp-rows]");rows.innerHTML="";
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
 view.querySelector("[data-amp-repeat]").textContent=repeat==="aucun"?"RÉPÉTER : NON":repeat==="un"?"RÉPÉTER : 1":"RÉPÉTER : TOUS";
 view.querySelector("[data-amp-speed]").textContent="VITESSE : "+speed+"×";
 view.querySelector("[data-amp-volume]").value=String(Math.round(volume*100));
 renderProgress();renderStatus();
}
function visualize(){
 if(!view||!view.isConnected)return;
 var canvas=view.querySelector("canvas"),c=canvas&&canvas.getContext("2d");
 if(!c)return;
 if(animation)cancelAnimationFrame(animation);
 var bins=analyser?new Uint8Array(analyser.frequencyBinCount):null;
 var last=0;
 function frame(now){
  if(!view||!view.isConnected)return;
  animation=requestAnimationFrame(frame);
  if(document.hidden||now-last<33)return;
  last=now;
  var width=canvas.clientWidth||400,height=canvas.clientHeight||70;
  var dpr=Math.min(window.devicePixelRatio||1,1.5),w=Math.round(width*dpr),h=Math.round(height*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  c.setTransform(dpr,0,0,dpr,0,0);
  c.fillStyle="#04140d";c.fillRect(0,0,width,height);
  var bars=46,gap=3,bw=(width-gap*bars)/bars;
  if(analyser&&bins)analyser.getByteFrequencyData(bins);
  for(var i=0;i<bars;i++){
   var idx=Math.min(bins?bins.length-1:0,Math.floor(Math.pow(i/bars,1.4)*320));
   var v=bins&&!audio.paused?bins[idx]/255:0;
   var hh=Math.max(2,v*(height-11));
   c.fillStyle=i<12?"#6cbb85":i<32?"#98d8a8":"#c8edb9";
   c.fillRect(i*(bw+gap),height-hh,bw,hh);
  }
  c.fillStyle="#71977a";c.font="10px monospace";c.fillText("ZEBRA SPECTRE // DIRECT",8,11);
 }
 animation=requestAnimationFrame(frame);
}
function open(){
 init();
 if(!window.ZebraAMPConfig||typeof window.ZebraAMPConfig.windowBox!=="function")return;
 var w=window.ZebraAMPConfig.windowBox("amp","ZebraAMP.exe — Lecteur du studio",660,635);
 view=w;
 w.innerHTML="";
 var root=el("div","amp3");
 var top=el("div","amp3-head");top.appendChild(el("strong","","ZEBRAAMP 3.1"));top.appendChild(el("span","","STUDIO DECK // STÉRÉO // 5 BANDES"));root.appendChild(top);
 var stripe=el("div","amp3-zebra-plate");
 stripe.setAttribute("aria-hidden","true");
 stripe.appendChild(el("span","amp3-zebra-rivet amp3-zebra-rivet-left"));
 stripe.appendChild(el("span","amp3-zebra-rivet amp3-zebra-rivet-right"));
 root.appendChild(stripe);
 var screen=el("div","amp3-screen");
 var displayRow=el("div","amp3-display-row");
 var cover=el("div","amp3-cover");
 var art=el("img","amp3-cover-image");
 art.alt="Pochette de l'album Zebra Tape 2";art.loading="lazy";
 art.src="/STUDIO/BUREAU/Zebra%20Tape%202/Cover/front%202.webp";
 cover.appendChild(art);
 cover.appendChild(el("span","amp3-cover-fallback","Z  /  R"));
 art.onerror=function(){art.dataset.failed="1";cover.classList.add("amp3-cover-empty");};
 art.onload=function(){art.dataset.failed="0";renderProgress();};
 var readout=el("div","amp3-readout");
 var meta=el("div","amp3-screen-label");
 meta.appendChild(el("span","","● AUDIO DECK"));
 var led=el("span","amp3-led","● VEILLE");led.setAttribute("data-amp-led","");
 meta.appendChild(led);
 readout.appendChild(meta);
 readout.appendChild(el("div","amp3-marquee","AUCUN MORCEAU CHARGÉ")).setAttribute("data-amp-now","");
 readout.appendChild(el("div","amp3-time","00:00 / 00:00")).setAttribute("data-amp-time","");
 displayRow.append(cover,readout);
 screen.appendChild(displayRow);
 var seek=el("input");seek.type="range";seek.min="0";seek.max="1000";seek.value="0";seek.setAttribute("data-amp-progress","");
 seek.oninput=function(){if(Number.isFinite(audio.duration)&&audio.duration)audio.currentTime=Number(seek.value)*audio.duration/1000;};
 screen.appendChild(seek);root.appendChild(screen);
 var canvas=el("canvas","amp3-spectrum");root.appendChild(canvas);
 var controls=el("div","amp3-controls");
 var prevBtn=b("Ⅰ◀",prev,"amp3-btn amp3-transport");prevBtn.title="Morceau précédent";controls.appendChild(prevBtn);
 var playBtn=b("▶",function(){
   if(audio.paused){var t=getTrack();if(t){if(audio.src)play();else pick(t.id,true);}else{var p=getList();if(p.tracks.length)pick(p.tracks[0].id,true);}}
   else audio.pause();
 },"amp3-btn amp3-play amp3-transport");
 playBtn.setAttribute("data-amp-play","");controls.appendChild(playBtn);
 var stopBtn=b("■",function(){audio.pause();audio.currentTime=0;renderProgress();},"amp3-btn amp3-transport");
 stopBtn.title="Arrêter";controls.appendChild(stopBtn);
 var nextBtn=b("▶Ⅰ",function(){next(true);},"amp3-btn amp3-transport");nextBtn.title="Morceau suivant";controls.appendChild(nextBtn);
 var shuffleBtn=b("ALÉATOIRE",function(){shuffle=!shuffle;store();render();},"amp3-btn");
 shuffleBtn.setAttribute("data-amp-shuffle","");controls.appendChild(shuffleBtn);
 var repeatBtn=b("RÉPÉTER : TOUS",function(){repeat=repeat==="tout"?"un":repeat==="un"?"aucun":"tout";store();render();},"amp3-btn");
 repeatBtn.setAttribute("data-amp-repeat","");controls.appendChild(repeatBtn);
 root.appendChild(controls);
 var extra=el("div","amp3-extras");
 var volumeGroup=el("label","","VOL.");
 var vol=el("input");vol.type="range";vol.min="0";vol.max="100";vol.setAttribute("data-amp-volume","");
 vol.oninput=function(){volume=Number(vol.value)/100;audio.volume=volume;store();};
 volumeGroup.appendChild(vol);extra.appendChild(volumeGroup);
 var speedBtn=b("VITESSE : 1×",function(){var arr=[.75,1,1.25,1.5];speed=arr[(arr.indexOf(speed)+1)%arr.length];audio.playbackRate=speed;store();render();},"amp3-btn");
 speedBtn.setAttribute("data-amp-speed","");extra.appendChild(speedBtn);
 extra.appendChild(b("VISUALISEUR",function(){
  resumeGraph();
  if(!window.ZebraVisualizer){status("Visualiseur indisponible.");return;}
  var config=window.ZebraAMPConfig;
  var box=config.windowBox("visualizer","ZebraVIS.exe — Visualiseur",650,500);
  window.ZebraVisualizer.mount(box,audio,{analyser:analyser});
 },"amp3-btn"));
 root.appendChild(extra);
 var eqBlock=el("details","amp3-eq-panel");
 var summary=el("summary","","ÉGALISEUR 5 BANDES · PRÉRÉGLAGES");eqBlock.appendChild(summary);
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
 var rename=b("✎",renameList,"amp3-btn");rename.title="Renommer";rename.setAttribute("data-amp-rename","");playlistTools.appendChild(rename);
 var del=b("×",deleteList,"amp3-btn amp3-danger");del.title="Supprimer la playlist";del.setAttribute("data-amp-delete-list","");playlistTools.appendChild(del);
 root.appendChild(playlistTools);
 var rows=el("div","amp3-list");rows.setAttribute("data-amp-rows","");root.appendChild(rows);
 var actions=el("div","amp3-bottom");
 actions.appendChild(b("＋ IMPORTER DES SONS",function(){var input=document.getElementById("file-music");if(input)input.click();},"amp3-btn amp3-import")).setAttribute("data-amp-import","");
 actions.appendChild(b("↻ ACTUALISER LA TAPE",function(){
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
function stop(){audio.pause();if(animation){cancelAnimationFrame(animation);animation=null;}view=null;}
window.ZebraAMP={
 open:open,init:init,stop:stop,importFiles:importFiles,openPublic:openPublic,openBlob:openBlob,
 pick:pick,play:play,updatePublic:updatePublic,media:audio,analyser:function(){return analyser;},
 debug:function(){return {playlist:current,playlists:playlists.map(function(p){return{name:p.name,count:p.tracks.length};}),album:album.tracks.length};}
};
}());