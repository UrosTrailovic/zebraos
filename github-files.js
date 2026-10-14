/* ZebraOS — live GitHub drive
   Public, read-only mirror of this repository's /STUDIO directory.
   Adding files and folders via GitHub is reflected on the next Refresh.
   No GitHub token is ever placed on the client. */
(function(){
"use strict";
var repo="UrosTrailovic/zebraos",branch="main",drive="STUDIO",requestNumber=0;
var extensions={
  image:/\.(png|jpg|jpeg|gif|webp|bmp)$/i,
  audio:/\.(mp3|wav|ogg|m4a|flac)$/i,
  video:/\.(mp4|webm)$/i,
  text:/\.(txt|md|markdown|json|csv|log|ini|cfg|css|js|xml|yml|yaml)$/i
};
function element(tag,cls,content){
  var e=document.createElement(tag);
  if(cls)e.className=cls;
  if(content!==undefined)e.textContent=content;
  return e;
}
function segmentUrl(path){return path.split("/").map(encodeURIComponent).join("/");}
function safePath(path){
  if(typeof path!=="string" || path.length>1300)return drive;
  var segments=path.replace(/\\/g,"/").split("/").filter(Boolean);
  if(segments[0]!==drive||segments.some(function(x){return x===".."||x==="."}))return drive;
  return segments.join("/");
}
function rawUrl(path){return "https://raw.githubusercontent.com/"+repo+"/"+branch+"/"+segmentUrl(path);}
function directoryUrl(path){return "https://github.com/"+repo+"/tree/"+branch+"/"+segmentUrl(path);}
function uploadUrl(path){return "https://github.com/"+repo+"/upload/"+branch+"/"+segmentUrl(path);}
function githubUrl(path){return "https://github.com/"+repo+"/blob/"+branch+"/"+segmentUrl(path);}
function openExternal(url){
  var a=document.createElement("a");
  a.href=url;a.target="_blank";a.rel="noopener noreferrer";
  document.body.appendChild(a);a.click();a.remove();
}
function icon(item){
  if(item.type==="dir")return "folder";
  var ext=(item.name||"").toLowerCase();
  if(extensions.image.test(ext))return "jpg";
  if(extensions.audio.test(ext))return "mp3";
  if(extensions.text.test(ext))return "txt";
  return "zip";
}
function size(bytes){
  if(!Number.isFinite(bytes)||bytes<0)return "";
  if(bytes>=1048576)return (bytes/1048576).toFixed(1)+" Mo";
  if(bytes>=1024)return Math.round(bytes/1024)+" Ko";
  return bytes+" o";
}
function apiList(path){
  var url="https://api.github.com/repos/"+repo+"/contents/"+segmentUrl(path)+"?ref="+branch;
  return fetch(url,{cache:"no-store",headers:{"Accept":"application/vnd.github+json"}}).then(function(response){
    if(!response.ok){
      if(response.status===403||response.status===429)throw new Error("GitHub limite temporairement les lectures. Réessaie dans quelques minutes.");
      if(response.status===404)throw new Error("Dossier absent du dépôt. Il faut au moins un fichier pour que GitHub conserve un dossier.");
      throw new Error("Connexion GitHub impossible (HTTP "+response.status+").");
    }
    return response.json();
  }).then(function(entries){
    if(!Array.isArray(entries))throw new Error("Ce chemin n'est pas un dossier.");
    return entries.filter(function(item){
      return item&&(item.type==="dir"||item.type==="file")&&item.name!==".gitkeep"&&item.name!==".gitignore";
    }).sort(function(a,b){
      if(a.type!==b.type)return a.type==="dir"?-1:1;
      return a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:"base"});
    });
  });
}
function filePreview(item,options){
  var name=item.name,ext=name.toLowerCase(),raw=rawUrl(item.path);
  if(!(extensions.image.test(ext)||extensions.audio.test(ext)||extensions.video.test(ext)||extensions.text.test(ext))){
    openExternal(githubUrl(item.path));
    return;
  }
  if(extensions.text.test(ext) && item.size>512000){
    openExternal(githubUrl(item.path));
    return;
  }
  var id="git-preview-"+item.path;
  var body=options.windowBox(id,name+" — STUDIO",Math.min(670,window.innerWidth-30),Math.min(500,window.innerHeight-90));
  body.innerHTML="";
  var toolbar=element("div","github-preview-toolbar");
  var github=element("button","classic-button","GitHub ↗");
  github.onclick=function(){openExternal(githubUrl(item.path));};
  toolbar.appendChild(github);
  var download=element("a","classic-button github-download","Ouvrir le fichier ↗");
  download.href=raw;download.target="_blank";download.rel="noopener noreferrer";
  toolbar.appendChild(download);body.appendChild(toolbar);
  if(extensions.image.test(ext)){
    var image=element("img","github-image-preview");
    image.src=raw;image.alt=name;image.onerror=function(){image.replaceWith(element("p","github-drive-error","Cette image n'a pas pu être chargée."));};
    body.appendChild(image);
  }else if(extensions.audio.test(ext)){
    var player=element("audio","github-audio-preview");player.controls=true;player.preload="metadata";player.src=raw;
    body.appendChild(player);body.appendChild(element("p","github-drive-hint","Écoute depuis les fichiers du studio. Le morceau n’est pas ajouté à ZebraAMP."));
  }else if(extensions.video.test(ext)){
    var video=element("video","github-video-preview");video.controls=true;video.preload="metadata";video.src=raw;video.playsInline=true;
    body.appendChild(video);
  }else{
    var pre=element("pre","github-text-preview","Chargement…");body.appendChild(pre);
    fetch(raw,{cache:"no-store"}).then(function(r){if(!r.ok)throw Error("HTTP "+r.status);return r.text();})
      .then(function(content){if(pre.isConnected)pre.textContent=content.slice(0,512000);})
      .catch(function(){if(pre.isConnected)pre.textContent="Impossible de charger le texte. Ouvre le fichier sur GitHub.";});
  }
}
function mount(host,path,options){
  if(!host)return;
  path=safePath(path);
  var ticket=++requestNumber;
  var segments=path.split("/");
  var relative=segments.slice(1).join("\\");
  var win=host.closest(".window");
  if(win){var title=win.querySelector(".windowtitle");if(title)title.textContent="My Computer — C:\\STUDIO"+(relative?"\\"+relative:"");}
  host.innerHTML="";
  var toolbar=element("div","github-drive-toolbar");
  function tool(text,click){
    var b=element("button","classic-button",text);b.type="button";b.onclick=click;toolbar.appendChild(b);return b;
  }
  tool("⌂ C:",function(){options.explorer("root");});
  tool("↑",function(){mount(host,segments.length<=1?drive:segments.slice(0,-1).join("/"),options);});
  tool("↻ Refresh",function(){mount(host,path,options);});
  tool("+ Ajouter",function(){openExternal(uploadUrl(path));});
  host.appendChild(toolbar);
  host.appendChild(element("div","folder-path","C:\\STUDIO"+(relative?"\\"+relative:"")+"  [GitHub LIVE]"));
  host.appendChild(element("p","github-drive-hint","Fichiers publics du dépôt. Ajoute-les sur GitHub, puis clique Refresh pour les voir."));
  var state=element("div","github-drive-state","Connexion au dossier GitHub…");host.appendChild(state);
  apiList(path).then(function(entries){
    if(ticket!==requestNumber||!host.isConnected)return;
    state.remove();
    if(!entries.length){
      host.appendChild(element("div","github-drive-empty","Ce dossier est vide. Ajoute un fichier sur GitHub pour le remplir."));
      return;
    }
    var list=element("div","folder-list github-drive-list");
    entries.forEach(function(item){
      if(typeof item.path!=="string"||item.path!==path+"/"+item.name)return;
      var button=element("button","file-entry github-file-entry");
      button.type="button";
      var symbol=element("span","file-symbol");
      symbol.appendChild(options.osIcon(icon(item),32));
      button.appendChild(symbol);
      button.appendChild(element("span","github-file-name",item.name));
      button.appendChild(element("small","github-file-size",item.type==="dir"?"Dossier":size(item.size)));
      button.title=item.name;
      button.onclick=function(){
        if(item.type==="dir")mount(host,item.path,options);
        else filePreview(item,options);
      };
      list.appendChild(button);
    });
    host.appendChild(list);
    var count=element("p","github-drive-count",entries.length+" élément(s) — cliquez pour ouvrir");host.appendChild(count);
  }).catch(function(err){
    if(ticket!==requestNumber||!host.isConnected)return;
    state.textContent=err.message||"Erreur GitHub";
    state.className="github-drive-state github-drive-error";
    var btn=element("button","classic-button","Voir le dossier sur GitHub ↗");
    btn.onclick=function(){openExternal(directoryUrl(path));};host.appendChild(btn);
  });
}
window.ZebraGitFiles={mount:mount,root:drive};
}());