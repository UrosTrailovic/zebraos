/* ZebraOS v1.0 — STUDIO LOCAL editable file system
 * Static, browser-only filesystem: IndexedDB keeps real Blob files and folders
 * on THIS browser. GitHub STUDIO is a different public, read-only drive.
 * Never place GitHub tokens in frontend JavaScript. */
(function(){
"use strict";
var DB="zebraos-local-disk-v1", STORE="entries", ROOT="root";
var dbPromise=null,clipboard=null,requestId=0;
var initial=[
  {id:"system-tape",parent:ROOT,name:"ZEBRA TAPE 2",kind:"folder"},
  {id:"system-screens",parent:ROOT,name:"CAPTURES",kind:"folder"},
  {id:"system-maps",parent:ROOT,name:"CARTES",kind:"folder"}
];
function E(tag,cls,label){
  var n=document.createElement(tag);
  if(cls)n.className=cls;
  if(label!==undefined)n.textContent=label;
  return n;
}
function btn(label,cls,action){
  var b=E("button",cls||"classic-button",label);
  b.type="button";b.onclick=action;
  return b;
}
function db(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise(function(resolve,reject){
    if(!window.indexedDB){reject(new Error("Le stockage local n'est pas autorisé."));return;}
    var r=window.indexedDB.open(DB,1);
    r.onupgradeneeded=function(){
      var storage=r.result.createObjectStore(STORE,{keyPath:"id"});
      storage.createIndex("parent","parent",{unique:false});
      initial.forEach(function(f){storage.put(Object.assign({created:Date.now(),deleted:false},f));});
    };
    r.onsuccess=function(){resolve(r.result);};
    r.onerror=function(){reject(r.error||Error("Impossible d'ouvrir le disque."));};
    r.onblocked=function(){reject(Error("Ferme les autres onglets ZebraOS et réessaie."));};
  }).catch(function(e){dbPromise=null;throw e;});
  return dbPromise;
}
function operation(kind,id,value){
  return db().then(function(instance){
    return new Promise(function(resolve,reject){
      var tx=instance.transaction(STORE,(kind==="put"||kind==="delete")?"readwrite":"readonly");
      var store=tx.objectStore(STORE);
      var request=kind==="all"?store.getAll():kind==="get"?store.get(id):
        kind==="put"?store.put(value):store.delete(id);
      request.onsuccess=function(){resolve(request.result);};
      request.onerror=function(){reject(request.error||Error("Erreur disque."));};
      tx.onerror=function(){reject(tx.error||Error("Erreur d'écriture sur le disque."));};
    });
  });
}
function all(){return operation("all");}
function get(id){return operation("get",id);}
function put(item){return operation("put",null,item);}
function uniqueId(){return "entry-"+Date.now()+"-"+Math.random().toString(36).slice(2,10);}
function clean(name){return String(name||"").trim().replace(/[\\/:*?"<>|\x00-\x1f]/g,"_").slice(0,100);}
function duplicate(items,parent,name,except){
  return items.some(function(x){return x.parent===parent&&!x.deleted&&x.id!==except&&x.name.toLowerCase()===name.toLowerCase();});
}
function children(items,parent,trash){
  return items.filter(function(x){return trash?x.deleted===true:x.parent===parent&&!x.deleted;}).sort(function(a,b){
    if(a.kind!==b.kind)return a.kind==="folder"?-1:1;
    return a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:"base"});
  });
}
function iconName(item){
  if(item.kind==="folder")return "folder";
  var ext=(item.name.split(".").pop()||"").toLowerCase();
  if(/^(png|jpg|jpeg|webp|gif|bmp|svg)$/.test(ext))return "jpg";
  if(/^(mp3|wav|ogg|m4a|flac)$/.test(ext))return "mp3";
  if(/^(txt|md|json|log|csv|ini|cfg|html|js|css|xml)$/.test(ext))return "txt";
  return "zip";
}
function isText(item){return /\.(txt|md|log|json|ini|csv|cfg|html|css|js|xml)$/i.test(item.name);}
function isImage(item){return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(item.name);}
function isAudio(item){return /\.(mp3|wav|ogg|m4a|flac)$/i.test(item.name);}
function isVideo(item){return /\.(mp4|webm)$/i.test(item.name);}
function bytes(n){
  if(n>=1048576)return (n/1048576).toFixed(1)+" Mo";
  if(n>=1024)return Math.round(n/1024)+" Ko";
  return (n||0)+" o";
}
function alertError(host,text){
  var existing=host.querySelector(".local-disk-error");
  if(existing)existing.remove();
  var message=E("p","local-disk-error",text);
  host.prepend(message);
}
function uniqueLabel(items,parent,desired){
  var name=desired,base=desired.replace(/(\.[^.]+)?$/,""),ext=desired.substring(base.length),i=2;
  while(duplicate(items,parent,name)){name=base+" ("+i+")"+ext;i++;}
  return name;
}
function dialog(host,title,initialText,accept){
  var overlay=E("div","local-modal");
  var pane=E("div","local-modal-pane");
  pane.appendChild(E("h3","",title));
  var input=E("input","local-modal-input");input.type="text";input.maxLength=100;input.value=initialText||"";
  pane.appendChild(input);
  var commands=E("div","local-modal-actions");
  var cancel=btn("Annuler","classic-button",function(){overlay.remove();});
  var ok=btn("OK","classic-button",function(){
    var name=clean(input.value);
    if(!name){input.focus();return;}
    overlay.remove();accept(name);
  });
  commands.appendChild(cancel);commands.appendChild(ok);
  pane.appendChild(commands);overlay.appendChild(pane);host.appendChild(overlay);
  input.onkeydown=function(ev){if(ev.key==="Enter"){ev.preventDefault();ok.click();}if(ev.key==="Escape")cancel.click();};
  input.focus();input.select();
}
function fileDialog(host,multiple,action){
  var input=E("input");input.type="file";input.multiple=!!multiple;input.hidden=true;
  input.onchange=function(){var items=Array.from(input.files||[]);input.remove();if(items.length)action(items);};
  host.appendChild(input);input.click();
}
function launchDownload(item){
  if(!item.blob)return;
  var link=document.createElement("a"),url=URL.createObjectURL(item.blob);
  link.href=url;link.download=item.name;document.body.appendChild(link);link.click();link.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},30000);
}
function preview(host,item,opt){
  if(item.kind!=="file"||!item.blob)return;
  if(!(isAudio(item)||isImage(item)||isText(item)||isVideo(item))){launchDownload(item);return;}
  var body=opt.windowBox("local-preview-"+item.id,item.name+" — STUDIO",Math.min(620,innerWidth-25),Math.min(490,innerHeight-75));
  body.innerHTML="";
  var tools=E("div","local-preview-tools");
  tools.appendChild(btn("⬇ Télécharger","classic-button",function(){launchDownload(item);}));
  if(isAudio(item)&&opt.playAudio){
    tools.appendChild(btn("▶ ZebraAMP","classic-button",function(){opt.playAudio(item.blob,item.name);}));
  }
  body.appendChild(tools);
  var url=URL.createObjectURL(item.blob);
  if(isImage(item)){
    var img=E("img","github-image-preview");img.alt=item.name;img.src=url;body.appendChild(img);
  }else if(isAudio(item)){
    var audio=E("audio","github-audio-preview");audio.src=url;audio.controls=true;audio.preload="metadata";body.appendChild(audio);
  }else if(isVideo(item)){
    var video=E("video","github-video-preview");video.controls=true;video.preload="metadata";video.playsInline=true;video.src=url;body.appendChild(video);
  }else{
    URL.revokeObjectURL(url);
    var pre=E("pre","github-text-preview","Chargement...");
    body.appendChild(pre);
    item.blob.text().then(function(t){if(pre.isConnected)pre.textContent=t.slice(0,600000);});
  }
}
async function move(targetId,host,refresh){
  if(!clipboard)return;
  var item=await get(clipboard);
  if(!item||item.deleted){clipboard=null;return;}
  var entries=await all(),cursor=targetId;
  while(cursor!==ROOT){
    if(cursor===clipboard){alertError(host,"Un dossier ne peut pas être déplacé dans lui-même.");return;}
    var node=entries.find(function(e){return e.id===cursor;});
    if(!node)break;
    cursor=node.parent;
  }
  if(duplicate(entries,targetId,item.name,item.id)){alertError(host,"Un élément portant ce nom existe déjà.");return;}
  item.parent=targetId;
  await put(item);clipboard=null;refresh();
}
async function importFiles(target,files,host,refresh){
  try{
    var entries=await all();
    var accepted=0;
    for(var i=0;i<files.length;i++){
      var file=files[i],name=clean(file.name);
      if(!name)continue;
      name=uniqueLabel(entries,target,name);
      var entry={id:uniqueId(),parent:target,name:name,kind:"file",blob:file,bytes:file.size,created:Date.now(),deleted:false};
      await put(entry);entries.push(entry);accepted++;
    }
    refresh();
    if(!accepted)alertError(host,"Aucun fichier importé.");
  }catch(err){alertError(host,"L'importation a échoué : "+err.message);}
}
function openRoot(host,opt){
  if(!host)return;
  host.innerHTML="";
  var win=host.closest(".window");if(win){var t=win.querySelector(".windowtitle");if(t)t.textContent="Poste de travail — C:\\ROOT";}
  host.appendChild(E("div","folder-path","POSTE DE TRAVAIL — STUDIO ZEBRA RECORD"));
  host.appendChild(E("p","local-disk-hint","Tes brouillons restent sur cet appareil. Les fichiers publiés sont visibles par tous."));
  var list=E("div","folder-list local-drive-root");
  function drive(name,icon,desc,action){
    var button=E("button","file-entry local-drive-item");
    var symbol=E("span","file-symbol");symbol.appendChild(opt.osIcon(icon,36));
    button.appendChild(symbol);button.appendChild(E("span","",name));button.appendChild(E("small","github-file-size",desc));
    button.onclick=action;list.appendChild(button);
  }
  drive("MES BROUILLONS","computer","Privé · cet appareil",function(){mount(host,ROOT,opt);});
  drive("FICHIERS PUBLIÉS","network","Visibles aux visiteurs",function(){opt.github("STUDIO");});
  drive("CORBEILLE","recycle-bin","Fichiers supprimés",function(){mount(host,"trash",opt);});
  host.appendChild(list);
}
async function mount(host,parent,opt){
  if(!host)return;
  if(parent==="home"){openRoot(host,opt);return;}
  if(typeof parent!=="string")parent=ROOT;
  var ticket=++requestId,items;
  host.innerHTML="";
  var win=host.closest(".window");
  var isTrash=parent==="trash";
  var entries;
  try{entries=await all();}
  catch(e){alertError(host,"Impossible d'ouvrir le disque local : "+e.message);return;}
  if(ticket!==requestId||!host.isConnected)return;
  var target=entries.find(function(e){return e.id===parent&&e.kind==="folder"&&!e.deleted;});
  if(!isTrash&&parent!==ROOT&&!target){parent=ROOT;}
  var names=[],cursor=parent;
  while(cursor!==ROOT&&!isTrash){
    var node=entries.find(function(e){return e.id===cursor;});
    if(!node)break;
    names.unshift(node.name);cursor=node.parent;
  }
  var title="Poste de travail — C:\\STUDIO"+(isTrash?"\\CORBEILLE":names.length?"\\"+names.join("\\"):"");
  if(win){var span=win.querySelector(".windowtitle");if(span)span.textContent=title;}
  var tools=E("div","local-disk-toolbar");
  function add(label,fn){tools.appendChild(btn(label,"classic-button",fn));}
  function refresh(){mount(host,parent,opt);}
  add("⌂",function(){openRoot(host,opt);});
  add("↑",function(){
    if(isTrash||parent===ROOT)openRoot(host,opt);
    else{
      var entry=entries.find(function(e){return e.id===parent;});
      mount(host,entry?entry.parent:ROOT,opt);
    }
  });
  add("↻",refresh);
  if(!isTrash){
    add("+ Dossier",function(){
      dialog(host,"Créer un dossier","Nouveau dossier",async function(name){
        try{var now=await all();if(duplicate(now,parent,name))throw Error("Un élément porte déjà ce nom.");
        await put({id:uniqueId(),parent:parent,name:name,kind:"folder",created:Date.now(),deleted:false});refresh();
        }catch(e){alertError(host,e.message);}
      });
    });
    add("↑ Importer",function(){fileDialog(host,true,function(files){importFiles(parent,files,host,refresh);});});
    if(clipboard)add("▣ Coller",function(){move(parent,host,refresh).catch(function(e){alertError(host,e.message);});});
  }
  host.appendChild(tools);
  host.appendChild(E("div","folder-path",isTrash?"C:\\CORBEILLE":"C:\\STUDIO\\"+names.join("\\")));
  host.appendChild(E("p","local-disk-hint",isTrash?"Fichiers supprimés sur cet appareil. Restaure-les ou efface-les définitivement.":"Fichiers réels enregistrés dans ce navigateur. Pas de synchronisation GitHub automatique."));
  var list=E("div","folder-list local-file-list");
  host.appendChild(list);
  items=children(entries,parent,isTrash);
  if(!items.length){
    var empty=E("div","local-disk-empty",isTrash?"La corbeille est vide.":"Ce dossier est vide. Crée un dossier ou importe des fichiers.");
    host.appendChild(empty);
  }
  items.forEach(function(item){
    var wrapper=E("div","local-file-card");
    var b=E("button","file-entry local-file-open");
    b.title=item.name;b.type="button";
    var symbol=E("span","file-symbol");symbol.appendChild(opt.osIcon(iconName(item),32));
    b.appendChild(symbol);b.appendChild(E("span","local-file-name",item.name));
    b.appendChild(E("small","github-file-size",item.kind==="folder"?"Dossier":bytes(item.bytes||item.blob&&item.blob.size)));
    b.onclick=function(){
      if(isTrash)return;
      if(item.kind==="folder")mount(host,item.id,opt);
      else preview(host,item,opt);
    };
    wrapper.appendChild(b);
    var more=btn("⋯","local-file-more",function(){
      var existing=host.querySelector(".local-file-menu");if(existing)existing.remove();
      var menu=E("div","local-file-menu");
      function action(label,cb){menu.appendChild(btn(label,"classic-button",function(){menu.remove();cb();}));}
      if(isTrash){
        action("Restaurer",async function(){try{
          item.deleted=false;
          var parentEntry=entries.find(function(e){return e.id===item.parent;});
          if(item.parent!==ROOT&&(!parentEntry||parentEntry.deleted))item.parent=ROOT;
          item.name=uniqueLabel(entries,item.parent,item.name);
          await put(item);refresh();
        }catch(e){alertError(host,e.message);}});
        action("Effacer définitivement",async function(){
          if(!confirm("Supprimer définitivement "+item.name+" ?"))return;
          try{
            var allItems=await all(),ids=[item.id];
            for(var j=0;j<ids.length;j++)allItems.filter(function(x){return x.parent===ids[j];}).forEach(function(x){ids.push(x.id);});
            for(var k=0;k<ids.length;k++)await operation("delete",ids[k]);
            refresh();
          }catch(e){alertError(host,e.message);}
        });
      }else{
        if(item.kind==="file")action("Télécharger",function(){launchDownload(item);});
        action("Renommer",function(){
          dialog(host,"Renommer",item.name,async function(name){
            try{var allItems=await all();if(duplicate(allItems,item.parent,name,item.id))throw Error("Ce nom existe déjà.");
              item.name=name;await put(item);refresh();
            }catch(e){alertError(host,e.message);}
          });
        });
        action("Couper / Déplacer",function(){clipboard=item.id;refresh();});
        action("Supprimer",async function(){
          if(!confirm("Placer "+item.name+" dans la corbeille ?"))return;
          try{item.deleted=true;await put(item);refresh();}catch(e){alertError(host,e.message);}
        });
      }
      wrapper.appendChild(menu);
    });
    more.title="Actions sur "+item.name;more.setAttribute("aria-label","Options : "+item.name);
    wrapper.appendChild(more);list.appendChild(wrapper);
  });
  if(!isTrash){
    var drop=E("div","local-drop-zone","Dépose des fichiers ici pour les importer");
    drop.ondragover=function(ev){ev.preventDefault();drop.classList.add("drag-over");};
    drop.ondragleave=function(){drop.classList.remove("drag-over");};
    drop.ondrop=function(ev){ev.preventDefault();drop.classList.remove("drag-over");importFiles(parent,Array.from(ev.dataTransfer.files||[]),host,refresh);};
    host.appendChild(drop);
  }
  host.appendChild(E("div","local-disk-status",items.length+" élément(s) • C:\\STUDIO"+(isTrash?"\\CORBEILLE":"")));
}
window.ZebraLocalFiles={mount:mount,home:openRoot,root:ROOT,
  openNamed:function(host,name,opt){
    var names={tape:"system-tape",screens:"system-screens",maps:"system-maps"};
    mount(host,names[name]||ROOT,opt);
  }};
}());