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
var known=null,stamp="",loading=null,listeners=[];
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
  if(!it||typeof it.path!=="string"||it.path.length>1200||(it.type!=="dir"&&it.type!=="file"))return false;
  var p=safe(it.path);
  if(p!==it.path||p===ROOT||/(^|\/)\.gitkeep$/.test(p)||p.split("/").some(function(x){return x.startsWith(".");}))return false;
  if(seen[p])return false;seen[p]=true;return true;
 }).map(function(it){
  return {path:it.path,name:fileName(it.path),type:it.type,size:Number(it.size)||0};
 });
}
function visible(item){
 return !(item.type==="file"&&isIconFile(item.name));
}
function children(path){
 path=safe(path);
 return (known||[]).filter(function(item){
  return visible(item)&&item.path.slice(0,item.path.lastIndexOf("/"))===path;
 }).sort(function(a,b){
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
 if(item.type==="dir")return "folder";
 if(kinds.image.test(item.name))return "jpg";
 if(kinds.audio.test(item.name))return "mp3";
 if(kinds.text.test(item.name))return "txt";
 return "zip";
}
function icon(item,osIcon,size){
 var box=node("span","bureau-item-symbol"),path=iconPath(item);
 if(path){
  var img=node("img","bureau-custom-icon");img.alt="";img.width=size;img.height=size;
  img.src=raw(path);
  img.onerror=function(){img.replaceWith(osIcon(fallbackIcon(item),size));};
  box.appendChild(img);
 }else box.appendChild(osIcon(fallbackIcon(item),size));
 return box;
}
function read(url){
 return fetch(url,{cache:"no-store"}).then(function(r){
  if(!r.ok)throw Error("Chargement impossible : HTTP "+r.status);
  return r.json();
 }).then(function(data){
  if(!data||!Array.isArray(data.entries))throw Error("Format d'index invalide");
  return {entries:valid(data.entries),stamp:data.generatedAt||""};
 });
}
function notify(){listeners.slice().forEach(function(fn){try{fn();}catch(e){}});}
function load(){
 if(loading)return loading;
 var q=Date.now();
 loading=read(raw(INDEX)+"?v="+q)
  .catch(function(){return read(site(INDEX)+"?v="+q);})
  .then(function(result){
    known=result.entries;stamp=result.stamp;notify();
    return {ok:true,entries:known};
  })
  .catch(function(err){
    return {ok:false,error:err.message,entries:known||[]};
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
 if(!kinds.image.test(item.name)&&!kinds.audio.test(item.name)&&
    !kinds.video.test(item.name)&&!kinds.text.test(item.name)){
  openExternal(fileLink(item.path));return;
 }
 if(kinds.text.test(item.name)&&item.size>512000){openExternal(fileLink(item.path));return;}
 var body=opts.windowBox("public-file-"+item.path,item.name+" — ZebraOS",
   Math.min(630,innerWidth-28),Math.min(480,innerHeight-65));
 body.innerHTML="";
 var bar=node("div","github-preview-toolbar");
 var a=node("a","classic-button github-download","Ouvrir le fichier ↗");
 a.href=raw(item.path);a.target="_blank";a.rel="noopener noreferrer";bar.appendChild(a);
 body.appendChild(bar);
 if(kinds.image.test(item.name)){
  var image=node("img","github-image-preview");image.src=raw(item.path);image.alt=item.name;
  image.onerror=function(){image.onerror=function(){image.replaceWith(node("p","github-drive-error","Impossible de charger cette image."));};image.src=site(item.path);};
  body.appendChild(image);
 }else if(kinds.audio.test(item.name)){
  var audio=node("audio","github-audio-preview");audio.controls=true;audio.preload="metadata";audio.src=raw(item.path);
  body.appendChild(audio);
 }else if(kinds.video.test(item.name)){
  var video=node("video","github-video-preview");video.controls=true;video.preload="metadata";video.playsInline=true;video.src=raw(item.path);
  body.appendChild(video);
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
  var items=children(path);
  msg.style.display=items.length?"none":"";
  msg.className="github-drive-empty";
  msg.textContent="Ce dossier est vide.";
  items.forEach(function(item){
   var b=node("button","file-entry github-file-entry");b.type="button";b.title=item.name;
   b.appendChild(icon(item,opts.osIcon,32));
   b.appendChild(node("span","github-file-name",item.name));
   b.appendChild(node("small","github-file-size",item.type==="dir"?"Dossier":sizeText(item.size)));
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
 root:ROOT,mount:mount,load:load,list:children,icon:icon,openFile:preview,subscribe:subscribe,
 iconPath:iconPath,hasData:function(){return !!known;}
};
}());