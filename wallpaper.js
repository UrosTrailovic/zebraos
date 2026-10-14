/* ZebraOS wallpaper manager v0.8 — vanilla JavaScript, no cloud service.
   The image gallery is shared on this browser. Each session keeps its own choice
   and display mode. Image files live in browser IndexedDB, not in GitHub. */
(function(){
"use strict";

var modes=[
  ["fill","Remplir"],["fit","Ajuster"],["stretch","Étirer"],
  ["tile","Vignette"],["center","Centrer"],["span","Étendre"]
];
var accounts=["visitor","zebra","admin","daniel"];
var dbPromise=null,currentSession=null,applyToken=0,refreshGallery=null,selectedItem=null;
var zebraDefault="/assets/wallpapers/zebra-default.avif?v=1";
function builtIn(account){return account==="zebra"?zebraDefault:null;}
var cache={};
var gradients={
  visitor:"linear-gradient(125deg,#475b52 0%,#7a897c 35%,#152d35 36%,#152a30 65%,#0c1b21 100%)",
  zebra:"linear-gradient(130deg,#162f35 0%,#273a42 50%,#091d26 51%,#30444b 100%)",
  admin:"linear-gradient(145deg,#122948,#4c6174 50%,#091b32 51%,#13264d 100%)",
  daniel:"linear-gradient(125deg,#482e40,#c3a2b2 48%,#3d2744 49%,#171e2d)"
};
function el(tag,cls,label){
  var n=document.createElement(tag);
  if(cls)n.className=cls;
  if(label!==undefined)n.textContent=label;
  return n;
}
function key(name){return "zebra.wallpaper.v2."+name;}
function read(name){
  var state={imageId:null,mode:"fill"};
  try{
    var saved=JSON.parse(localStorage.getItem(key(name))||"null");
    if(saved&&typeof saved==="object"){
      if(typeof saved.imageId==="string"&&saved.imageId.length<100)state.imageId=saved.imageId;
      if(modes.some(function(m){return m[0]===saved.mode}))state.mode=saved.mode;
    }
  }catch(e){}
  return state;
}
function save(name,state){
  try{localStorage.setItem(key(name),JSON.stringify(state));}
  catch(e){announce("Les préférences ne peuvent pas être enregistrées sur ce navigateur.",true);}
}
function storage(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise(function(resolve,reject){
    if(!window.indexedDB){reject(new Error("Stockage d'images non disponible"));return;}
    var req=indexedDB.open("zebraos-wallpapers",1);
    req.onupgradeneeded=function(){
      var db=req.result;
      if(!db.objectStoreNames.contains("images"))db.createObjectStore("images",{keyPath:"id"});
    };
    req.onsuccess=function(){resolve(req.result);};
    req.onerror=function(){reject(req.error||new Error("IndexedDB inaccessible"));};
    req.onblocked=function(){reject(new Error("La galerie est ouverte dans un autre onglet"));};
  }).catch(function(e){dbPromise=null;throw e;});
  return dbPromise;
}
function query(kind,id,record){
  return storage().then(function(db){
    return new Promise(function(resolve,reject){
      var tx=db.transaction("images",kind==="put"||kind==="delete"?"readwrite":"readonly");
      var store=tx.objectStore("images");
      var req=kind==="all"?store.getAll():kind==="get"?store.get(id):
              kind==="put"?store.put(record):store.delete(id);
      req.onsuccess=function(){resolve(req.result);};
      req.onerror=function(){reject(req.error||new Error("Accès galerie impossible"));};
      tx.onerror=function(){reject(tx.error||new Error("Erreur d'enregistrement"));};
    });
  });
}
function loadAll(){
  return query("all").then(function(items){
    items.sort(function(a,b){return (b.created||0)-(a.created||0);});
    items.forEach(function(item){cache[item.id]=item;});
    return items;
  });
}
function loadOne(id){
  if(cache[id])return Promise.resolve(cache[id]);
  return query("get",id).then(function(item){if(item)cache[id]=item;return item;});
}
function paint(target,account,data,mode){
  if(target.id==="wallpaper")target.className="wallpaper wallpaper-"+account;
  else target.className="wallpaper-preview wallpaper-"+account;
  target.style.backgroundImage="";
  target.style.backgroundSize="";
  target.style.backgroundPosition="";
  target.style.backgroundRepeat="";
  target.style.backgroundColor="";
  if(!data)return;
  target.style.backgroundImage="url("+JSON.stringify(data)+")";
  target.style.backgroundColor="#172029";
  var settings={
    fill:["cover","center","no-repeat"],
    fit:["contain","center","no-repeat"],
    stretch:["100% 100%","center","no-repeat"],
    tile:["240px auto","left top","repeat"],
    center:["auto","center","no-repeat"],
    span:["cover","center","no-repeat"]
  };
  var opts=settings[mode]||settings.fill;
  target.style.backgroundSize=opts[0];
  target.style.backgroundPosition=opts[1];
  target.style.backgroundRepeat=opts[2];
}
function apply(name){
  if(accounts.indexOf(name)<0)return;
  currentSession=name;
  var token=++applyToken;
  var cfg=read(name),wall=document.getElementById("wallpaper");
  if(!wall)return;
  paint(wall,name,builtIn(name),cfg.mode);
  if(!cfg.imageId)return;
  loadOne(cfg.imageId).then(function(item){
    if(token!==applyToken||currentSession!==name)return;
    if(item&&item.data)paint(wall,name,item.data,cfg.mode);
    else {cfg.imageId=null;save(name,cfg);paint(wall,name,builtIn(name),cfg.mode);}
  }).catch(function(){
    if(token===applyToken)announce("Impossible de retrouver le fond d'écran enregistré.",true);
  });
}
function announce(message,isError){
  var msg=document.getElementById("wallpaper-status");
  if(msg){msg.textContent=message;msg.classList.toggle("error",!!isError);}
}
function selectImage(id){
  if(!currentSession)return;
  var cfg=read(currentSession);
  cfg.imageId=id;
  save(currentSession,cfg);
  apply(currentSession);
  if(refreshGallery)refreshGallery();
}
function setMode(mode){
  if(!currentSession||!modes.some(function(m){return m[0]===mode}))return;
  var cfg=read(currentSession);
  cfg.mode=mode;
  save(currentSession,cfg);
  apply(currentSession);
  if(refreshGallery)refreshGallery();
}
function previewImage(data,mode){
  var preview=document.getElementById("wallpaper-preview");
  if(preview&&currentSession)paint(preview,currentSession,data,mode);
}
function showGallery(target){
  if(!target||!target.isConnected||!currentSession)return;
  var account=currentSession,cfg=read(account);
  loadAll().then(function(items){
    if(!target.isConnected||account!==currentSession)return;
    target.innerHTML="";
    var originals=el("button","wallpaper-thumb");
    originals.type="button";
    var builtinThumb=el("span","wallpaper-thumb-photo default-wallpaper-"+account);
    if(builtIn(account)){
      builtinThumb.style.backgroundImage="url("+JSON.stringify(builtIn(account))+")";
      builtinThumb.style.backgroundSize="cover";
      builtinThumb.style.backgroundPosition="center";
    }
    originals.appendChild(builtinThumb);
    originals.appendChild(el("span","wallpaper-thumb-caption",account==="zebra"?"Fond Zebra":"ZebraOS"));
    originals.title="Fond d'écran d'origine de cette session";
    originals.classList.toggle("active",!cfg.imageId);
    originals.onclick=function(){selectImage(null);};
    target.appendChild(originals);
    items.forEach(function(item){
      var b=el("button","wallpaper-thumb"),img=el("img","wallpaper-thumb-photo");
      b.type="button";
      img.src=item.data;
      img.alt="";
      img.loading="lazy";
      b.appendChild(img);
      b.appendChild(el("span","wallpaper-thumb-caption",item.name||"Image"));
      b.title=item.name||"Image importée";
      b.classList.toggle("active",cfg.imageId===item.id);
      b.onclick=function(){selectImage(item.id);};
      var remove=el("button","wallpaper-thumb-delete","×");
      remove.type="button";
      remove.setAttribute("aria-label","Supprimer "+(item.name||"cette image")+" de la galerie");
      remove.title="Supprimer définitivement cette image";
      remove.onclick=function(event){
        event.preventDefault();
        event.stopPropagation();
        removeImage(item.id);
      };
      // Kept separate from the selection button: nested buttons are invalid HTML.
      var wrapper=el("div","wallpaper-thumb-wrap");
      wrapper.appendChild(b);
      wrapper.appendChild(remove);
      target.appendChild(wrapper);
    });
    var selected=cfg.imageId?items.filter(function(x){return x.id===cfg.imageId})[0]:null;
    selectedItem=selected||null;
    previewImage(selected&&selected.data||builtIn(account),cfg.mode);
    var removal=document.getElementById("wallpaper-remove");
    if(removal)removal.disabled=!selected;
    announce(items.length?items.length+" image(s) dans cette galerie.":"Importe une image pour commencer.");
  }).catch(function(){
    target.innerHTML="";
    target.appendChild(el("p","wallpaper-hint","Galerie indisponible sur ce navigateur. Vérifie que le stockage local est autorisé."));
    previewImage(builtIn(account),cfg.mode);
    announce("Le stockage local des fonds d'écran est désactivé.",true);
  });
}
function importFile(file,account){
  if(!file)return;
  if(!account||accounts.indexOf(account)<0)return;
  if(!/^image\//.test(file.type)){announce("Choisis un fichier image (PNG, JPG, WEBP…).",true);return;}
  if(file.size>30*1024*1024){announce("Cette image dépasse la limite de 30 Mo.",true);return;}
  announce("Importation de "+file.name+"…");
  var url=URL.createObjectURL(file);
  var image=new Image();
  image.onload=function(){
    URL.revokeObjectURL(url);
    try{
      var maxEdge=1920,ratio=Math.min(1,maxEdge/Math.max(image.naturalWidth,image.naturalHeight));
      var width=Math.max(1,Math.round(image.naturalWidth*ratio));
      var height=Math.max(1,Math.round(image.naturalHeight*ratio));
      var canvas=document.createElement("canvas");
      canvas.width=width;canvas.height=height;
      var ctx=canvas.getContext("2d");
      if(!ctx)throw new Error("Canvas non disponible");
      ctx.fillStyle="#111820";ctx.fillRect(0,0,width,height);
      ctx.drawImage(image,0,0,width,height);
      var data=canvas.toDataURL("image/jpeg",0.84);
      var id="wall-"+Date.now()+"-"+Math.random().toString(36).slice(2,8);
      var record={id:id,name:file.name.slice(0,90),data:data,created:Date.now()};
      query("put",null,record).then(function(){
        cache[id]=record;
        var cfg=read(account);
        cfg.imageId=id;
        save(account,cfg);
        if(currentSession===account)apply(account);
        if(refreshGallery)refreshGallery();
        announce("Image enregistrée et appliquée à la session "+account+".");
      }).catch(function(e){announce("Impossible d'enregistrer cette image : "+e.message,true);});
    }catch(e){announce("Erreur de traitement de l'image : "+e.message,true);}
  };
  image.onerror=function(){URL.revokeObjectURL(url);announce("Impossible de lire cette image.",true);};
  image.src=url;
}
function removeImage(id){
  if(!id)return;
  if(!window.confirm("Supprimer définitivement ce fond d’écran de cet appareil ?"))return;
  query("delete",id).then(function(){
    delete cache[id];
    accounts.forEach(function(account){
      var cfg=read(account);
      if(cfg.imageId===id){cfg.imageId=null;save(account,cfg);}
    });
    selectedItem=null;
    if(currentSession)apply(currentSession);
    if(refreshGallery)refreshGallery();
    announce("Fond d’écran supprimé.");
  }).catch(function(e){announce("Suppression impossible : "+e.message,true);});
}
function removeSelected(){
  if(selectedItem)removeImage(selectedItem.id);
}
function mount(parent){
  if(!parent||!currentSession)return;
  parent.innerHTML="";
  var heading=el("div","wallpaper-heading");
  var icon=el("span","wallpaper-heading-icon","▧");
  var description=el("div","wallpaper-heading-text");
  description.appendChild(el("h3","", "Personnaliser votre arrière-plan"));
  description.appendChild(el("p","", "Ce fond appartient uniquement à la session "+currentSession+"."));
  heading.appendChild(icon);heading.appendChild(description);
  parent.appendChild(heading);

  var stage=el("div","wallpaper-stage");
  var preview=el("div","wallpaper-preview wallpaper-"+currentSession);
  preview.id="wallpaper-preview";
  preview.appendChild(el("span","wallpaper-preview-sticker","ZebraOS // "+currentSession.toUpperCase()));
  stage.appendChild(preview);
  var controls=el("div","wallpaper-controls");
  controls.appendChild(el("label","wallpaper-label-setting","Choisir un ajustement"));
  var select=el("select","wallpaper-mode");
  select.id="wallpaper-mode";
  var cfg=read(currentSession);
  modes.forEach(function(mode){
    var option=el("option","",mode[1]);option.value=mode[0];select.appendChild(option);
  });
  select.value=cfg.mode;
  select.onchange=function(){setMode(select.value);};
  controls.appendChild(select);
  controls.appendChild(el("p","wallpaper-hint","« Étendre » correspond à l'affichage sur plusieurs moniteurs. Sur ce bureau unique, il utilise Remplir."));
  stage.appendChild(controls);
  parent.appendChild(stage);

  var shelf=el("div","wallpaper-section-head");
  shelf.appendChild(el("h4","", "Images récentes"));
  var button=el("button","classic-button","Parcourir les photos");
  button.onclick=function(){document.getElementById("file-wallpaper").click();};
  shelf.appendChild(button);
  parent.appendChild(shelf);
  var gallery=el("div","wallpaper-gallery");
  gallery.id="wallpaper-gallery";
  parent.appendChild(gallery);
  var bar=el("div","wallpaper-footer");
  var status=el("span","wallpaper-status","Chargement de la galerie…");
  status.id="wallpaper-status";
  bar.appendChild(status);
  var remove=el("button","classic-button wallpaper-remove","Supprimer le fond utilisé");
  remove.id="wallpaper-remove";remove.disabled=true;
  remove.onclick=removeSelected;
  bar.appendChild(remove);
  parent.appendChild(bar);
  parent.appendChild(el("p","wallpaper-hint wallpaper-delete-hint","Pour supprimer une image, utilise la petite croix sur sa miniature. Cela ne supprime aucun fichier de ton appareil."));

  refreshGallery=function(){if(parent.isConnected)showGallery(gallery);};
  refreshGallery();
}
window.ZebraWallpaper={
  apply:apply,
  mount:mount,
  importFile:importFile,
  availableModes:modes
};
}());
