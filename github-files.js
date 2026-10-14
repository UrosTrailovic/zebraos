/* ZebraOS Public Library 1.2
 * Visitors browse a clean, read-only studio directory.
 * First load is a static manifest served by the site itself.
 * A single optional GitHub tree API request checks newly published commits.
 * If GitHub throttles, the manifest remains usable; no blocking error.
 */
(function(){
"use strict";
var REPO="UrosTrailovic/zebraos",BRANCH="main",ROOT="STUDIO";
var STATIC="STUDIO/manifest.json";
var snapshot=null,lastLiveCheck=0,updatePromise=null;
var CHECK_DELAY=30000;
var ext={
 image:/\.(png|jpg|jpeg|gif|webp|bmp)$/i,
 audio:/\.(mp3|wav|ogg|m4a|flac)$/i,
 video:/\.(mp4|webm)$/i,
 text:/\.(txt|md|markdown|json|csv|log|ini|cfg|css|js|xml|yml|yaml)$/i
};
function E(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function safe(path){
 if(typeof path!=="string")return ROOT;
 var s=path.replace(/\\/g,"/").split("/").filter(Boolean);
 return s[0]===ROOT&&s.length<=25&&!s.some(function(x){return x===".."||x===".";})?s.join("/"):ROOT;
}
function uri(path){return path.split("/").map(encodeURIComponent).join("/");}
function staticUrl(path){return "/"+uri(path);}
function rawUrl(path){return "https://raw.githubusercontent.com/"+REPO+"/"+BRANCH+"/"+uri(path);}
function repositoryUrl(path){return "https://github.com/"+REPO+"/tree/"+BRANCH+"/"+uri(path);}
function uploadUrl(path){return "https://github.com/"+REPO+"/upload/"+BRANCH+"/"+uri(path);}
function fileUrl(path){return "https://github.com/"+REPO+"/blob/"+BRANCH+"/"+uri(path);}
function openExternal(url){var a=E("a");a.href=url;a.target="_blank";a.rel="noopener noreferrer";document.body.appendChild(a);a.click();a.remove();}
function iconFor(item){
 if(item.type==="dir")return "folder";
 if(ext.image.test(item.name))return "jpg";
 if(ext.audio.test(item.name))return "mp3";
 if(ext.text.test(item.name))return "txt";
 return "zip";
}
function frenchFolder(name){
 var aliases={ARTWORK:"VISUELS",MAPS:"CARTES"};
 return aliases[name]||name;
}
function prettySize(bytes){
 if(!(bytes>=0))return "";
 return bytes>=1048576?(bytes/1048576).toFixed(1)+" Mo":bytes>=1024?Math.round(bytes/1024)+" Ko":bytes+" o";
}
function clean(items){
 if(!Array.isArray(items))throw Error("Index invalid");
 return items.filter(function(x){
   return x&&typeof x.path==="string"&&(x.type==="file"||x.type==="dir")&&
     x.path.startsWith(ROOT+"/")&&x.path.length<1000&&
     !/(^|\/)(\.gitkeep|\.gitignore|manifest\.json)$/.test(x.path) &&
     x.path.split("/").every(function(v){return v!==".."&&v!=="."});
 }).map(function(x){
   return {path:x.path,type:x.type,size:Number(x.size)||0,name:x.path.split("/").pop()};
 });
}
function direct(items,path,isAdmin){
 return items.filter(function(x){
   if(x.path.substring(0,x.path.lastIndexOf("/"))!==path)return false;
   if(isAdmin)return true;
   if(x.type==="file")return x.name!=="README.txt";
   // Un visiteur ne voit pas les dossiers sans contenu réel publié.
   return items.some(function(child){
     return child.type==="file" && child.name!=="README.txt" &&
       child.path.startsWith(x.path+"/");
   });
 })
 .sort(function(a,b){
   if(a.type!==b.type)return a.type==="dir"?-1:1;
   return a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:"base"});
 });
}
function current(){
 try{
   var obj=JSON.parse(sessionStorage.getItem("zebra.studio.public-index")||"null");
   if(obj&&Array.isArray(obj.entries)&&obj.expiry>Date.now())return clean(obj.entries);
 }catch(e){}
 return null;
}
function save(items){
 try{sessionStorage.setItem("zebra.studio.public-index",JSON.stringify({entries:items,expiry:Date.now()+3600000}));}catch(e){}
}
function initial(){
 if(snapshot)return Promise.resolve(snapshot);
 var cached=current();if(cached){snapshot=cached;return Promise.resolve(snapshot);}
 return fetch(staticUrl(STATIC),{cache:"no-store"})
  .then(function(r){if(!r.ok)throw Error("Index public absent");return r.json();})
  .then(function(d){snapshot=clean(d.entries||d);return snapshot;})
  .catch(function(){snapshot=[];return snapshot;});
}
function refresh(force){
 var now=Date.now();
 if(updatePromise)return updatePromise;
 if(!force&&now-lastLiveCheck<CHECK_DELAY)return Promise.resolve(snapshot);
 lastLiveCheck=now;
 // L'index public est créé automatiquement après une publication dans STUDIO.
 // Pas de requêtes répétées vers l'API GitHub : aucun blocage à 60 appels/heure.
 var url="https://raw.githubusercontent.com/"+REPO+"/"+BRANCH+"/"+STATIC+"?actualisation="+now;
 updatePromise=fetch(url,{cache:"no-store"})
   .then(function(r){if(!r.ok)throw Error("Index temporairement indisponible");return r.json();})
   .then(function(data){snapshot=clean(data.entries||data);save(snapshot);return snapshot;})
   .catch(function(){return snapshot;})
   .finally(function(){updatePromise=null;});
 return updatePromise;
}
function preview(item,options){
 var name=item.name,source=staticUrl(item.path),url=source;
 if(!(ext.image.test(name)||ext.audio.test(name)||ext.text.test(name)||ext.video.test(name))){
   openExternal(fileUrl(item.path));return;
 }
 if(ext.text.test(name)&&item.size>512000){openExternal(fileUrl(item.path));return;}
 var body=options.windowBox("public-file-"+item.path,name+" — ZebraOS",Math.min(630,innerWidth-28),Math.min(480,innerHeight-65));
 body.innerHTML="";
 var bar=E("div","github-preview-toolbar");
 var opener=E("a","classic-button github-download","Ouvrir ↗");
 opener.href=url;opener.target="_blank";opener.rel="noopener noreferrer";
 bar.appendChild(opener);body.appendChild(bar);
 if(ext.image.test(name)){
   var image=E("img","github-image-preview");image.src=url;image.alt=name;
   image.onerror=function(){image.src=rawUrl(item.path);image.onerror=function(){image.replaceWith(E("p","github-drive-error","Image indisponible."));};};
   body.appendChild(image);
 }else if(ext.audio.test(name)){
   var player=E("audio","github-audio-preview");player.controls=true;player.preload="metadata";player.src=url;body.appendChild(player);
 }else if(ext.video.test(name)){
   var video=E("video","github-video-preview");video.controls=true;video.preload="metadata";video.src=url;video.playsInline=true;body.appendChild(video);
 }else{
   var pre=E("pre","github-text-preview","Chargement…");body.appendChild(pre);
   fetch(url).then(function(r){if(!r.ok)throw Error();return r.text();}).then(function(t){if(pre.isConnected)pre.textContent=t.slice(0,512000);})
    .catch(function(){if(pre.isConnected)pre.textContent="Le document est indisponible. Réessaie plus tard.";});
 }
}
function mount(host,path,options){
 if(!host)return;
 path=safe(path);
 host._zebraPublicTicket=(host._zebraPublicTicket||0)+1;
 var ticket=host._zebraPublicTicket;
 var isAdmin=!!options.canUpload;
 var folder=path===ROOT?"Mes fichiers":path.split("/").slice(1).map(frenchFolder).join(" / ");
 var w=host.closest(".window");
 if(w){var title=w.querySelector(".windowtitle");if(title)title.textContent="Poste de travail — "+folder;}
 host.innerHTML="";
 var toolbar=E("div","github-drive-toolbar");
 function tool(text,fn){var b=E("button","classic-button",text);b.type="button";b.onclick=fn;toolbar.appendChild(b);}
 tool("⌂",function(){options.explorer("root");});
 tool("↑",function(){mount(host,path===ROOT?ROOT:path.substring(0,path.lastIndexOf("/")),options);});
 tool("↻ Actualiser",function(){refresh(true).then(render);});
 if(isAdmin)tool("Publier sur GitHub ↗",function(){openExternal(uploadUrl(path));});
 host.appendChild(toolbar);
 host.appendChild(E("div","folder-path","C:\\STUDIO"+(path===ROOT?"":"\\"+path.substring(ROOT.length+1).split("/").map(frenchFolder).join("\\"))));
 var hint=E("p","github-drive-hint",isAdmin?
   "CONTENU PUBLIÉ · Les fichiers de tes brouillons sont invisibles ici. Après publication sur GitHub, attends la mise à jour de l’index puis actualise.":
   "Bibliothèque Zebra Record");
 host.appendChild(hint);
 var state=E("div","github-drive-state","Ouverture du dossier…");
 host.appendChild(state);
 var list=E("div","folder-list github-drive-list");
 host.appendChild(list);
 var status=E("p","github-drive-count","");
 host.appendChild(status);
 function render(){
   if(!host.isConnected||host._zebraPublicTicket!==ticket)return;
   list.innerHTML="";
   var items=direct(snapshot||[],path,isAdmin);
   state.style.display="none";
   if(!items.length){
     state.style.display="";
     state.className="github-drive-empty";
     state.textContent=isAdmin?"Aucun fichier publié dans ce dossier. Les brouillons locaux sont séparés.":"Aucun fichier disponible pour le moment.";
   }
   items.forEach(function(item){
     var b=E("button","file-entry github-file-entry");b.type="button";
     var symbol=E("span","file-symbol");
     symbol.appendChild(options.osIcon(iconFor(item),32));
     b.appendChild(symbol);
     b.appendChild(E("span","github-file-name",item.type==="dir"?frenchFolder(item.name):item.name));
     b.appendChild(E("small","github-file-size",item.type==="dir"?"Dossier":prettySize(item.size)));
     b.onclick=function(){if(item.type==="dir")mount(host,item.path,options);else preview(item,options);};
     list.appendChild(b);
   });
   status.textContent=items.length+" élément(s)";
 }
 initial().then(function(){
   if(!host.isConnected||host._zebraPublicTicket!==ticket)return;
   render();
   refresh(false).then(function(){render();});
 });
}
window.ZebraGitFiles={mount:mount,root:ROOT};
}());