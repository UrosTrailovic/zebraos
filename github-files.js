/* ZebraOS - Bureau GitHub v2.0
   Une seule source publique : STUDIO/BUREAU, indexée dans assets/bureau-index.json.
   Sous-dossiers illimités (jusqu'à 25 niveaux), icônes personnalisées.
   Dossier : NOM/icone.png ; fichier : NOM.ext.icone.png
   Aucun jeton privé, aucun cache de session, aucune requête API GitHub.
*/
(function(){
"use strict";
var ROOT="STUDIO/BUREAU", REPO="UrosTrailovic/zebraos", BRANCH="main";
var INDEX="assets/bureau-index.json";
var APP_IDS={
 "explorer:root":true,"explorer:recycle":true,"studio-manager":true,
 amp:true,settings:true,tetris:true,snake:true,racer:true,paint:true,
 calc:true,sticky:true,planner:true,notepad:true
};
var known=null,stamp="",desktopOrder=[],loading=null,listeners=[];
var kinds={
  image:/\.(png|jpe?g|gif|webp|bmp)$/i,
  audio:/\.(mp3|wav|ogg|m4a|flac)$/i,
  video:/\.(mp4|webm)$/i,
  text:/\.(txt|md|markdown|json|csv|log|ini|cfg|css|js|xml|ya?ml)$/i
};
function node(tag,cls,label){
 var n=document.createElement(tag);
 if(cls)n.className=cls;
 if(label!==undefined)n.textContent=label;
 return n;
}
function encodePath(path){return path.split("/").map(encodeURIComponent).join("/");}
function raw(path){return "https://raw.githubusercontent.com/"+REPO+"/"+BRANCH+"/"+encodePath(path);}
function site(path){return "/"+encodePath(path);}
function upload(path){return "https://github.com/"+REPO+"/upload/"+BRANCH+"/"+encodePath(path);}
function fileLink(path){return "https://github.com/"+REPO+"/blob/"+BRANCH+"/"+encodePath(path);}
function safe(path){
 if(typeof path!=="string")return ROOT;
 var pieces=path.replace(/\\/g,"/").split("/").filter(Boolean);
 if(pieces.length<2||pieces.length>25||pieces[0]!=="STUDIO"||pieces[1]!=="BUREAU"||
 pieces.some(function(x){return x==="."||x==="..";}))return ROOT;
 return pieces.join("/");
}
function fileName(path){return path.slice(path.lastIndexOf("/")+1);}
function isIconFile(name){
 return name==="icone.png"||name==="icone.webp"||name==="icone.jpg"|| /\.icone\.(png|webp|jpg)$/i.test(name);
}
function valid(entries){
 if(!Array.isArray(entries))throw Error("Index invalide");
 var seen={};
 return entries.filter(function(it){
  if(!it||typeof it.path!=="string"||it.path.length>1200||(it.type!=="dir"&&it.type!=="file"&&it.type!=="app"))return false;
  if(it.type==="app"&&!APP_IDS[it.app])return false;
  var p=safe(it.path);
  if(p!==it.path||p===ROOT||/(^|\/)\.gitkeep$/.test(p)||p.split("/").some(function(x){return x.startsWith(".");}))return false;
  if(seen[p])return false;seen[p]=true;return true;
 }).map(function(it){
  return {path:it.path,name:it.type==="app"&&typeof it.name==="string"?it.name.slice(0,90):fileName(it.path),
   type:it.type,size:Number(it.size)||0,
   app:it.type==="app"?it.app:null,
   icon:it.type==="app"&&typeof it.icon==="string"?it.icon.slice(0,40):null,
   sessions:it.type==="app"&&Array.isArray(it.sessions)?it.sessions.filter(function(id){return ["admin","zebra","visitor","daniel"].includes(id);}):null};
 });
}
function visible(item){
 return !(item.type==="file"&&isIconFile(item.name));
}
function children(path){
 path=safe(path);
 // Le fichier STUDIO/BUREAU/.ordre-bureau.json définit uniquement
 // l'ordre initial du bureau, sans toucher aux positions locales.
 var rank={};
 if(path===ROOT)desktopOrder.forEach(function(name,index){rank[name.toLocaleLowerCase("fr")]=index;});
 return (known||[]).filter(function(item){
  return visible(item)&&item.path.slice(0,item.path.lastIndexOf("/"))===path;
 }).sort(function(a,b){
  if(path===ROOT){
   var aThanks=a.name.toLocaleLowerCase("fr")==="thanks.txt",bThanks=b.name.toLocaleLowerCase("fr")==="thanks.txt";
   if(aThanks!==bThanks)return aThanks?1:-1;
   var ai=rank[a.name.toLocaleLowerCase("fr")],bi=rank[b.name.toLocaleLowerCase("fr")];
   var as=ai===undefined?Infinity:ai,bs=bi===undefined?Infinity:bi;
   if(as!==bs)return as-bs;
  }
  if(a.type!==b.type)return a.type==="dir"?-1:1;
  return a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:"base"});
 });
}
function iconPath(item){
 if(!known)return null;
 var candidates=item.type==="dir"?
  [item.path+"/icone.png",item.path+"/icone.webp",item.path+"/icone.jpg"]:
  [item.path+".icone.png",item.path+".icone.webp",item.path+".icone.jpg"];
 for(var i=0;i<candidates.length;i++){
  if(known.some(function(x){return x.path===candidates[i]&&x.type==="file";}))return candidates[i];
 }
 return null;
}
function fallbackIcon(item){
 if(item.type==="app")return item.icon||"txt";
 if(item.type==="dir")return "folder";
 if(kinds.image.test(item.name))return "jpg";
 if(kinds.audio.test(item.name))return "mp3";
 if(kinds.text.test(item.name))return "txt";
 return "zip";
}
/* Les documents photo affichent leur vraie miniature dans un cadre d'icône
   Windows rétro. Le choix explicite .icone.png reste prioritaire. */
/* Vignettes simples : seules les vraies photos sont décodées.
   Une vidéo n'ouvre aucune connexion ni décodage avant un clic explicite. */
function videoIcon(item){
 var box=node("span","bureau-item-symbol bureau-media-thumb bureau-video-thumb bureau-video-static");
 box.title=item.name;
 var reel=node("span","bureau-video-reel","▣");
 reel.setAttribute("aria-hidden","true");
 var play=node("span","bureau-video-play","▶");
 play.setAttribute("aria-hidden","true");
 box.append(reel,play);
 return box;
}
function thumbnail(item,osIcon,size){
 var box=node("span","bureau-item-symbol bureau-media-thumb bureau-photo-thumb");
 box.title=item.name;
 var fallback=node("span","bureau-media-fallback");
 fallback.appendChild(osIcon("jpg",size));box.appendChild(fallback);
 var img=node("img","bureau-media-image");
 img.alt="";img.loading="lazy";img.decoding="async";img.draggable=false;
 img.onload=function(){if(img.naturalWidth)box.classList.add("bureau-thumb-loaded");};
 var tried=false;
 img.onerror=function(){
  if(!tried){tried=true;img.src=raw(item.path);}
  else box.classList.remove("bureau-thumb-loaded");
 };
 img.src=site(item.path);
 box.appendChild(img);
 return box;
}
function icon(item,osIcon,size){
 var box=node("span","bureau-item-symbol"),path=iconPath(item);
 if(path){
  var img=node("img","bureau-custom-icon");img.alt="";img.width=size;img.height=size;
  img.src=raw(path);
  img.onerror=function(){img.replaceWith(osIcon(fallbackIcon(item),size));};
  box.appendChild(img);
 }else if(item.type==="file"&&kinds.image.test(item.name)){
  return thumbnail(item,osIcon,size);
 }else if(item.type==="file"&&kinds.video.test(item.name)){
  return videoIcon(item);
 }else box.appendChild(osIcon(fallbackIcon(item),size));
 return box;
}
function read(url){
 return fetch(url,{cache:"no-cache"}).then(function(r){
  if(!r.ok)throw Error("Chargement impossible : HTTP "+r.status);
  return r.json();
 }).then(function(data){
  if(!data||!Array.isArray(data.entries))throw Error("Format d'index invalide");
  return {
   entries:valid(data.entries),stamp:data.generatedAt||"",
   desktopOrder:Array.isArray(data.desktopOrder)?data.desktopOrder.filter(function(name){
    return typeof name==="string"&&name.length>0&&name.length<=120;
   }).slice(0,150):[]
  };
 });
}
function notify(){listeners.slice().forEach(function(fn){try{fn();}catch(e){}});}
var LOCAL_INDEX="zebraos.bureau.index.v1";
function load(){
 if(loading)return loading;
 // Affichage immédiat depuis le dernier index local, puis actualisation HTTP.
 // Si GitHub Pages est indisponible, le bureau reste navigable hors connexion.
 if(!known){
  try{
   var cached=JSON.parse(localStorage.getItem(LOCAL_INDEX)||"null");
   if(cached&&Array.isArray(cached.entries)){
    known=valid(cached.entries);stamp=cached.generatedAt||"";
    desktopOrder=Array.isArray(cached.desktopOrder)?cached.desktopOrder:[];
    notify();
   }
  }catch(_){}
 }
 loading=read(site(INDEX))
  .catch(function(){return read(raw(INDEX));})
  .then(function(result){
   known=result.entries;stamp=result.stamp;desktopOrder=result.desktopOrder;
   notify();
   try{localStorage.setItem(LOCAL_INDEX,JSON.stringify({
    entries:known,generatedAt:stamp,desktopOrder:desktopOrder
   }));}catch(_){}
   return {ok:true,entries:known};
  })
  .catch(function(err){
   return {ok:!!known,error:err.message,entries:known||[],offline:!!known};
  }).finally(function(){loading=null;});
 return loading;
}
function subscribe(callback){
 if(typeof callback!=="function")return function(){};
 listeners.push(callback);
 return function(){var i=listeners.indexOf(callback);if(i!==-1)listeners.splice(i,1);};
}
function openExternal(url){
 var a=node("a");a.href=url;a.target="_blank";a.rel="noopener noreferrer";
 document.body.appendChild(a);a.click();a.remove();
}
function sizeText(bytes){
 if(!(bytes>=0))return "";
 if(bytes>=1048576)return (bytes/1048576).toFixed(1)+" Mo";
 if(bytes>=1024)return Math.round(bytes/1024)+" Ko";
 return bytes+" o";
}
function preview(item,opts){
 if(item.type==="app"){
  if(APP_IDS[item.app]&&opts&&typeof opts.openApp==="function")opts.openApp(item.app);
  return;
 }
 if(kinds.audio.test(item.name)&&opts&&typeof opts.openAudio==="function"){
  opts.openAudio(item);return;
 }
 if(!kinds.image.test(item.name)&&!kinds.audio.test(item.name)&&
    !kinds.video.test(item.name)&&!kinds.text.test(item.name)){
  openExternal(fileLink(item.path));return;
 }
 if(kinds.text.test(item.name)&&item.size>512000){openExternal(fileLink(item.path));return;}
 var isVideo=kinds.video.test(item.name),isImage=kinds.image.test(item.name);
 var isEditableText=/\.txt$/i.test(item.name)&&!!window.ZebraTextEditor;
 var body=opts.windowBox("public-file-"+item.path,item.name+" — ZebraOS",
   Math.min(isVideo?840:isImage?900:630,innerWidth-28),
   Math.min(isVideo?600:isImage?650:480,innerHeight-65));
 if(body._zebraDispose)body._zebraDispose();
 body.classList.remove("zvideo-window-body","zpic-window-body","image-viewer-body","ztext-window-body");
 body.innerHTML="";
 // Le TXT reste un fichier public GitHub en lecture seule côté serveur,
 // mais la copie de travail est modifiable dans le stockage LOCAL du navigateur.
 if(isEditableText){
  body.classList.add("ztext-window-body");
  window.ZebraTextEditor.mount(body,item,{
   session:opts&&opts.session||"visitor",
   source:function(file){return site(file.path);}
  });
  return;
 }
 // Galerie photo : uniquement les images voisines dans le même dossier.
 if(isImage){
  body.classList.add("zpic-window-body");
  if(window.ZebraPhotos){
   var parent=item.path.slice(0,item.path.lastIndexOf("/"));
   var account=opts&&opts.session||"visitor";
   var gallery=children(parent).filter(function(other){
    return other.type==="file"&&kinds.image.test(other.name)&&
      (!other.sessions||other.sessions.includes(account));
   });
   window.ZebraPhotos.mount(body,item,gallery,{
    sizeText:sizeText,source:function(file){return site(file.path);},
    fallback:function(file){return raw(file.path);}
   });
  }else{
   var simple=node("img","github-image-preview");simple.src=site(item.path);
   simple.alt=item.name;body.appendChild(simple);
  }
  return;
 }
 // Lecteur vidéo dédié, sans toucher aux audios et aux textes.
 if(isVideo){
  body.classList.add("zvideo-window-body");
  if(window.ZebraVideoPlayer){
   window.ZebraVideoPlayer.mount(body,item,{
    primary:site(item.path),backup:raw(item.path),sizeText:sizeText
   });
  }else{
   var fallback=node("video","github-video-preview");
   fallback.controls=true;fallback.preload="metadata";fallback.playsInline=true;
   fallback.src=site(item.path);body.appendChild(fallback);
  }
  return;
 }
 // Pas de bouton lien direct, ni de téléchargement dans les visionneuses.
 if(kinds.audio.test(item.name)){
  var audio=node("audio","github-audio-preview");audio.controls=true;audio.preload="metadata";audio.src=raw(item.path);
  body.appendChild(audio);
 }else{
  var pre=node("pre","github-text-preview","Chargement…");body.appendChild(pre);
  fetch(raw(item.path)).then(function(r){if(!r.ok)throw Error();return r.text();})
   .then(function(t){if(pre.isConnected)pre.textContent=t.slice(0,512000);})
   .catch(function(){if(pre.isConnected)pre.textContent="Ce document est temporairement indisponible.";});
 }
}
function mount(host,path,opts){
 if(!host)return;
 path=safe(path);
 var ticket=(host._zebraPublicTicket||0)+1;
 host._zebraPublicTicket=ticket;
 var admin=!!opts.canUpload;
 var account=typeof opts.session==="string"?opts.session:"visitor";
 var viewSizes={small:24,medium:32,large:64,list:20},view="medium";
 var viewKey="zebraos.folder-view.v1."+account;
 try{var savedView=localStorage.getItem(viewKey);if(Object.keys(viewSizes).includes(savedView))view=savedView;}catch(_){}
 var place=path===ROOT?"Bureau":path.slice(ROOT.length+1).replace(/\//g," \\ ");
 var w=host.closest(".window");
 if(w){var title=w.querySelector(".windowtitle");if(title)title.textContent="Poste de travail — "+place;}
 host.innerHTML="";
 var bar=node("div","github-drive-toolbar");
 function button(label,handler){
  var b=node("button","classic-button",label);b.type="button";b.onclick=handler;bar.appendChild(b);return b;
 }
 button("⌂",function(){mount(host,ROOT,opts);});
 button("↑",function(){mount(host,path===ROOT?ROOT:path.substring(0,path.lastIndexOf("/")),opts);});
 var refreshButton=button("↻ Actualiser",reload);
 if(admin)button("Ajouter sur GitHub ↗",function(){openExternal(upload(path));});
 var viewControl=node("label","folder-view-control");
 viewControl.appendChild(node("span","","Affichage"));
 var viewSelect=node("select","folder-view-select");viewSelect.setAttribute("aria-label","Affichage du dossier");
 [["small","Petites icônes"],["medium","Icônes moyennes"],["large","Grandes icônes"],["list","Liste"]].forEach(function(item){
  var option=node("option","",item[1]);option.value=item[0];viewSelect.appendChild(option);
 });
 viewSelect.value=view;
 viewSelect.onchange=function(){
  if(!isCurrent())return;
  view=Object.keys(viewSizes).includes(viewSelect.value)?viewSelect.value:"medium";
  try{localStorage.setItem(viewKey,view);}catch(_){}
  render();
 };
 viewControl.appendChild(viewSelect);bar.appendChild(viewControl);
 host.appendChild(bar);
 host.appendChild(node("div","folder-path","C:\\BUREAU"+(path===ROOT?"":"\\"+path.slice(ROOT.length+1).replace(/\//g,"\\"))));
 if(admin)host.appendChild(node("p","github-drive-hint","Dossiers et fichiers publics. Pour modifier, utilise GitHub."));
 var status=node("p","github-drive-count","");var msg=node("div","github-drive-state","Chargement du bureau…");
 host.appendChild(msg);
 var files=node("div","folder-list github-drive-list");host.appendChild(files);
 host.appendChild(status);
 function isCurrent(){return host.isConnected&&host._zebraPublicTicket===ticket;}
 function render(){
  if(!isCurrent())return;
  files.innerHTML="";
  files.dataset.view=view;files.style.setProperty("--folder-icon-size",viewSizes[view]+"px");
  var items=children(path).filter(function(item){return !item.sessions||item.sessions.includes(account);});
  msg.style.display=items.length?"none":"";
  msg.className="github-drive-empty";
  msg.textContent="Ce dossier est vide.";
  items.forEach(function(item){
   var b=node("button","file-entry github-file-entry");b.type="button";b.title=item.name;
   b.appendChild(icon(item,opts.osIcon,viewSizes[view]));
   b.appendChild(node("span","github-file-name",item.name));
   b.appendChild(node("small","github-file-size",item.type==="dir"?"Dossier":item.type==="app"?"Application":sizeText(item.size)));
   b.onclick=function(){if(item.type==="dir")mount(host,item.path,opts);else preview(item,opts);};
   files.appendChild(b);
  });
  var date="";
  if(stamp){var d=new Date(stamp);if(!isNaN(d.getTime()))date=" · Publié le "+d.toLocaleString("fr-CH",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});}
  status.textContent=items.length+" élément(s)"+date;
 }
 function reload(){
  if(!isCurrent())return;
  refreshButton.disabled=true;msg.style.display="";msg.className="github-drive-state";
  msg.textContent="Vérification des fichiers…";
  load().then(function(result){
   if(!isCurrent())return;
   refreshButton.disabled=false;
   if(result.ok){render();return;}
   if(known){render();status.textContent+=" · Actualisation impossible (ancienne liste)";}
   else{files.innerHTML="";msg.style.display="";msg.className="github-drive-state github-drive-error";msg.textContent="Impossible de charger les fichiers. Réessaie.";status.textContent=""; }
  });
 }
 if(known)render();
 reload();
}
window.ZebraGitFiles={
 root:ROOT,mount:mount,load:load,list:children,icon:icon,openFile:preview,allFiles:function(){return (known||[]).slice();},subscribe:subscribe,
 iconPath:iconPath,hasData:function(){return !!known;}
};
}());
