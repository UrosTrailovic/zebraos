/* ZebraOS — bibliothèque publique v1.5.
 * Source unique : STUDIO/manifest.json, reconstruit automatiquement par GitHub Actions.
 * AUCUN cache de session ni appel à l'API GitHub depuis le navigateur.
 * Ouverture et Actualiser vérifient l'index publié à chaque fois.
 */
(function(){
"use strict";
var ROOT="STUDIO",REPO="UrosTrailovic/zebraos",BRANCH="main",INDEX="STUDIO/manifest.json";
var known=null,updatedAt=null,lastCheck=null,activeRequest=null;
var types={
 image:/\.(png|jpe?g|gif|webp|bmp)$/i,
 audio:/\.(mp3|wav|ogg|m4a|flac)$/i,
 video:/\.(mp4|webm)$/i,
 text:/\.(txt|md|markdown|json|csv|log|ini|cfg|css|js|xml|ya?ml)$/i
};
function element(tag,cls,label){
 var el=document.createElement(tag);
 if(cls)el.className=cls;
 if(label!==undefined)el.textContent=label;
 return el;
}
function encode(path){return path.split("/").map(encodeURIComponent).join("/");}
function localUrl(path){return "/"+encode(path);}
function remoteUrl(path){return "https://raw.githubusercontent.com/"+REPO+"/"+BRANCH+"/"+encode(path);}
function repoFileUrl(path){return "https://github.com/"+REPO+"/blob/"+BRANCH+"/"+encode(path);}
function uploadUrl(path){return "https://github.com/"+REPO+"/upload/"+BRANCH+"/"+encode(path);}
function safe(path){
 if(typeof path!=="string")return ROOT;
 var segments=path.replace(/\\/g,"/").split("/").filter(Boolean);
 if(segments[0]!==ROOT||segments.length>25||segments.some(function(x){return x===".."||x==="."}))return ROOT;
 return segments.join("/");
}
function shortName(name){
 return {ARTWORK:"VISUELS",MAPS:"CARTES"}[name]||name;
}
function iconFor(item){
 if(item.type==="dir")return "folder";
 if(types.image.test(item.name))return "jpg";
 if(types.audio.test(item.name))return "mp3";
 if(types.text.test(item.name))return "txt";
 return "zip";
}
function readableSize(bytes){
 if(!Number.isFinite(bytes)||bytes<0)return "";
 if(bytes>=1048576)return (bytes/1048576).toFixed(1)+" Mo";
 if(bytes>=1024)return Math.round(bytes/1024)+" Ko";
 return bytes+" o";
}
function normalize(input){
 if(!Array.isArray(input))throw Error("Index de fichiers invalide");
 return input.filter(function(item){
   return item && typeof item.path==="string" && (item.type==="file"||item.type==="dir") &&
     item.path.startsWith(ROOT+"/") && item.path.length<1000 &&
     !/(^|\/)(\.gitkeep|\.gitignore|manifest\.json)$/.test(item.path) &&
     !item.path.split("/").some(function(part){return part==="."||part==="..";});
 }).map(function(item){
   return {path:item.path,type:item.type,name:item.path.split("/").pop(),size:Number(item.size)||0};
 });
}
function contents(path,isAdmin){
 return (known||[]).filter(function(item){
   if(item.path.substring(0,item.path.lastIndexOf("/"))!==path)return false;
   return isAdmin || item.type==="dir" || item.name!=="README.txt";
 }).sort(function(a,b){
   if(a.type!==b.type)return a.type==="dir"?-1:1;
   return a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:"base"});
 });
}
function loadIndex(url){
 return fetch(url,{cache:"no-store"})
 .then(function(response){if(!response.ok)throw Error("Erreur HTTP "+response.status);return response.json();})
 .then(function(json){
    if(!json||!Array.isArray(json.entries))throw Error("Réponse non valide");
    return {entries:normalize(json.entries),generatedAt:json.generatedAt||null};
 });
}
function update(){
 // Toujours demander l'index le plus récent : pas de liste conservée pendant une heure.
 if(activeRequest)return activeRequest;
 var t=Date.now();
 var url=remoteUrl(INDEX)+"?v="+t;
 activeRequest=loadIndex(url)
  .catch(function(){return loadIndex(localUrl(INDEX)+"?v="+t);})
  .then(function(result){
    known=result.entries;
    updatedAt=result.generatedAt;
    lastCheck=new Date();
    return {ok:true};
  })
  .catch(function(err){return {ok:false,error:err.message||"Connexion impossible"};})
  .finally(function(){activeRequest=null;});
 return activeRequest;
}
function openExternal(url){
 var link=element("a");link.href=url;link.target="_blank";link.rel="noopener noreferrer";
 document.body.appendChild(link);link.click();link.remove();
}
function displayFile(item,options){
 if(!types.image.test(item.name)&&!types.audio.test(item.name)&&!types.video.test(item.name)&&!types.text.test(item.name)){
   openExternal(repoFileUrl(item.path));return;
 }
 if(types.text.test(item.name)&&item.size>512000){openExternal(repoFileUrl(item.path));return;}
 var name=item.name,raw=remoteUrl(item.path),fallback=localUrl(item.path);
 var host=options.windowBox("public-file-"+item.path,name+" — ZebraOS",Math.min(630,innerWidth-28),Math.min(480,innerHeight-65));
 host.innerHTML="";
 var actions=element("div","github-preview-toolbar");
 var link=element("a","classic-button github-download","Ouvrir le fichier ↗");
 link.href=raw;link.target="_blank";link.rel="noopener noreferrer";actions.appendChild(link);
 host.appendChild(actions);
 if(types.image.test(name)){
   var image=element("img","github-image-preview");image.src=raw;image.alt=name;
   image.onerror=function(){
     image.onerror=function(){image.replaceWith(element("p","github-drive-error","Impossible de charger cette image."));};
     image.src=fallback;
   };
   host.appendChild(image);
 }else if(types.audio.test(name)){
   var audio=element("audio","github-audio-preview");
   audio.controls=true;audio.preload="metadata";audio.src=raw;
   var retried=false;audio.onerror=function(){if(retried)return;retried=true;audio.src=fallback;};
   host.appendChild(audio);
 }else if(types.video.test(name)){
   var video=element("video","github-video-preview");video.controls=true;video.preload="metadata";video.playsInline=true;video.src=raw;host.appendChild(video);
 }else{
   var pre=element("pre","github-text-preview","Chargement du document…");host.appendChild(pre);
   fetch(raw,{cache:"no-store"})
    .then(function(res){if(!res.ok)throw Error();return res.text();})
    .catch(function(){return fetch(fallback).then(function(res){if(!res.ok)throw Error();return res.text();});})
    .then(function(text){if(pre.isConnected)pre.textContent=text.slice(0,512000);})
    .catch(function(){if(pre.isConnected)pre.textContent="Document temporairement indisponible.";});
 }
}
function mount(host,path,options){
 if(!host)return;
 path=safe(path);
 var ticket=(host._zebraPublicTicket||0)+1;host._zebraPublicTicket=ticket;
 var isAdmin=!!options.canUpload;
 var folder=path===ROOT?"Fichiers de Zebra Tape 2":path.split("/").slice(1).map(shortName).join(" / ");
 var outer=host.closest(".window");
 if(outer){var title=outer.querySelector(".windowtitle");if(title)title.textContent="Poste de travail — "+folder;}
 host.innerHTML="";
 var tools=element("div","github-drive-toolbar");
 function command(label,action){
   var button=element("button","classic-button",label);button.type="button";button.onclick=action;
   tools.appendChild(button);return button;
 }
 command("⌂",function(){options.explorer("root");});
 command("↑",function(){mount(host,path===ROOT?ROOT:path.substring(0,path.lastIndexOf("/")),options);});
 var refreshButton=command("↻ Actualiser",function(){reload();});
 if(isAdmin)command("Ajouter sur GitHub ↗",function(){openExternal(uploadUrl(path));});
 host.appendChild(tools);
 host.appendChild(element("div","folder-path","C:\\STUDIO"+(path===ROOT?"":"\\"+path.substring(ROOT.length+1).split("/").map(shortName).join("\\"))));
 host.appendChild(element("p","github-drive-hint",isAdmin?
   "Fichiers publiés et visibles par tous. Les brouillons privés restent séparés.":
   "Bibliothèque Zebra Tape 2"));
 var message=element("div","github-drive-state","Recherche des fichiers publiés…");host.appendChild(message);
 var list=element("div","folder-list github-drive-list");host.appendChild(list);
 var status=element("p","github-drive-count","");host.appendChild(status);
 function valid(){return host.isConnected&&host._zebraPublicTicket===ticket;}
 function render(){
   if(!valid())return;
   list.innerHTML="";
   var entries=contents(path,isAdmin);
   message.style.display=entries.length?"none":"";
   if(!entries.length){
     message.className="github-drive-empty";
     message.textContent="Ce dossier est vide pour le moment.";
   }
   entries.forEach(function(item){
     var button=element("button","file-entry github-file-entry");button.type="button";
     var symbol=element("span","file-symbol");symbol.appendChild(options.osIcon(iconFor(item),32));
     button.appendChild(symbol);
     button.appendChild(element("span","github-file-name",item.type==="dir"?shortName(item.name):item.name));
     button.appendChild(element("small","github-file-size",item.type==="dir"?"Dossier":readableSize(item.size)));
     button.onclick=function(){if(item.type==="dir")mount(host,item.path,options);else displayFile(item,options);};
     list.appendChild(button);
   });
   var detail=updatedAt?(" · Index du "+new Date(updatedAt).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})):"";
   status.textContent=entries.length+" élément(s)"+detail;
 }
 function reload(){
   if(!valid())return;
   refreshButton.disabled=true;
   message.style.display="";
   message.className="github-drive-state";
   message.textContent="Vérification des fichiers publiés…";
   update().then(function(result){
     if(!valid())return;
     refreshButton.disabled=false;
     if(result.ok){render();return;}
     // Aucune erreur cachée : conserver les éléments connus en précisant leur ancienneté.
     if(known){
       render();
       status.textContent+=" · Actualisation impossible, dernière liste conservée";
     }else{
       list.innerHTML="";
       message.style.display="";
       message.className="github-drive-state github-drive-error";
       message.textContent="Impossible de charger les fichiers. Appuie sur Actualiser pour réessayer.";
       status.textContent="Connexion indisponible";
     }
   });
 }
 if(known)render();
 reload();
}
window.ZebraGitFiles={mount:mount,root:ROOT};
}());