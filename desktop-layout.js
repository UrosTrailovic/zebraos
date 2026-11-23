/* ZebraOS — bureau libre v1 : positions par appareil, corbeille locale réversible.
   GitHub demeure la source des fichiers et des raccourcis. */
(function(){
"use strict";
var active=null,threshold=8;
var RACER_PATH="STUDIO/BUREAU/Jeux/Echo Racer 2 Beta.exe.zebraos.json";
function el(tag,cls,text){var x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;}
function button(text,fn,cls){var b=el("button",cls||"classic-button",text);b.type="button";b.onclick=fn;return b;}
function storageKey(session){return "zebra.desktop.v1."+session;}
function cleanState(session){
 var result={positions:{wide:{},narrow:{}},trash:[],racerTrashSeeded:session==="zebra"};
 try{
  var raw=JSON.parse(localStorage.getItem(storageKey(session))||"null");
  if(!raw||typeof raw!=="object"){
   if(session==="zebra")result.trash.push(RACER_PATH);
   return result;
  }
  if(raw.positions&&typeof raw.positions==="object"){
   ["wide","narrow"].forEach(function(mode){
    if(!raw.positions[mode]||typeof raw.positions[mode]!=="object")return;
    Object.keys(raw.positions[mode]).slice(0,300).forEach(function(path){
     var pair=raw.positions[mode][path];
     if(path.length<1200&&Array.isArray(pair)&&pair.length===2&&pair.every(function(n){return typeof n==="number"&&isFinite(n);}))
      result.positions[mode][path]=[Math.min(1,Math.max(0,pair[0])),Math.min(1,Math.max(0,pair[1]))];
    });
   });
  }
  if(Array.isArray(raw.trash))result.trash=raw.trash.filter(function(path){return typeof path==="string"&&path.length<1200;}).slice(0,300);
  // Une fois par bureau Zebra : la restauration reste persistante.
  if(session==="zebra"&&raw.racerTrashSeeded!==true&&!result.trash.includes(RACER_PATH))
   result.trash.push(RACER_PATH);
 }catch(_){}
 return result;
}
function write(){
 if(!active)return;
 try{localStorage.setItem(storageKey(active.session),JSON.stringify(active.data));}catch(_){}
}
function mode(){return window.innerWidth<=700?"narrow":"wide";}
function trashHas(session,path){
 var data=active&&active.session===session?active.data:cleanState(session);
 return data.trash.includes(path);
}
function isInsideTrash(x,y){
 if(!active||!active.trash)return false;
 var r=active.trash.getBoundingClientRect();
 return x>=r.left-11&&x<=r.right+11&&y>=r.top-13&&y<=r.bottom+12;
}
function place(node,x,y){
 var root=active.root;
 var maxX=Math.max(0,root.clientWidth-node.offsetWidth-3);
 var maxY=Math.max(0,root.clientHeight-node.offsetHeight-3);
 x=Math.max(0,Math.min(maxX,x));y=Math.max(0,Math.min(maxY,y));
 node.style.left=Math.round(x)+"px";
 node.style.top=Math.round(y)+"px";
 return [maxX?x/maxX:0,maxY?y/maxY:0];
}
function positionAll(){
 if(!active||!active.root.isConnected)return;
 var nodes=Array.from(active.root.querySelectorAll(".desk-icon[data-path]"));
 var width=active.root.clientWidth, height=active.root.clientHeight;
 var stepX=window.innerWidth<=700?90:105,stepY=window.innerWidth<=700?89:98;
 var rows=Math.max(1,Math.floor((height-18)/stepY));
 nodes.forEach(function(node,i){
  var saved=active.data.positions[mode()][node.dataset.path],x,y;
  if(saved){
   x=saved[0]*Math.max(0,width-node.offsetWidth-3);
   y=saved[1]*Math.max(0,height-node.offsetHeight-3);
  }else{
   var col=Math.floor(i/rows),row=i%rows;
   x=12+col*stepX;y=10+row*stepY;
   /* L'angle inférieur droit est réservé à la Corbeille. */
   if(x>width-120&&y>height-120)y=Math.max(8,height-215);
  }
  place(node,x,y);
 });
}
function trashItem(path){
 if(!active||active.data.trash.includes(path))return;
 active.data.trash.push(path);
 delete active.data.positions.wide[path];
 delete active.data.positions.narrow[path];
 write();
 active.repaint();
}
function restore(path){
 if(!active)return;
 active.data.trash=active.data.trash.filter(function(k){return k!==path;});
 write();active.repaint();
}
function restoreAll(){
 if(!active)return;
 active.data.trash=[];write();active.repaint();
}
function resetPositions(){
 if(!active)return;
 active.data.positions[mode()]={};write();positionAll();
}
function attachIcon(node){
 var path=node.dataset.path;
 if(!path)return;
 node.addEventListener("pointerdown",function(e){
  if(!active||active.root!==node.parentNode||e.isPrimary===false||(e.pointerType==="mouse"&&e.button!==0))return;
  var startX=e.clientX,startY=e.clientY;
  var left=parseFloat(node.style.left)||0,top=parseFloat(node.style.top)||0,dragging=false;
  var id=e.pointerId,finished=false,hold=null;
  if(e.pointerType==="touch"){
   hold=setTimeout(function(){
    if(!dragging&&!finished)showMenu(path,startX,startY,node);
   },650);
  }
  function move(ev){
   if(ev.pointerId!==id||finished)return;
   var dx=ev.clientX-startX,dy=ev.clientY-startY;
   if(!dragging&&Math.hypot(dx,dy)<threshold)return;
   if(!dragging){dragging=true;node.classList.add("zu-icon-dragging");closeMenu();clearTimeout(hold);}
   place(node,left+dx,top+dy);
   if(active&&active.trash)active.trash.classList.toggle("zu-drop-target",isInsideTrash(ev.clientX,ev.clientY));
   if(ev.cancelable)ev.preventDefault();
  }
  function stop(ev){
   if(finished||ev.pointerId!==id)return;
   finished=true;clearTimeout(hold);
   window.removeEventListener("pointermove",move);
   window.removeEventListener("pointerup",stop);
   window.removeEventListener("pointercancel",stop);
   if(!active)return;
   active.trash.classList.remove("zu-drop-target");
   node.classList.remove("zu-icon-dragging");
   if(dragging){
    node._zebraDragUntil=Date.now()+550;
    if(ev.type==="pointerup"&&isInsideTrash(ev.clientX,ev.clientY)){trashItem(path);return;}
    var coords=place(node,parseFloat(node.style.left)||0,parseFloat(node.style.top)||0);
    active.data.positions[mode()][path]=coords;
    write();
   }
  }
  window.addEventListener("pointermove",move,{passive:false});
  window.addEventListener("pointerup",stop);
  window.addEventListener("pointercancel",stop);
 });
 node.addEventListener("contextmenu",function(e){e.preventDefault();showMenu(path,e.clientX,e.clientY,node);});
}
function closeMenu(){
 if(!active||!active.menu)return;
 active.menu.remove();active.menu=null;
}
function showMenu(path,x,y,node){
 if(!active)return;
 closeMenu();
 var menu=el("div","zu-desktop-menu");
 var screen=active.screen,rect=screen.getBoundingClientRect();
 var localX=x-rect.left,localY=y-rect.top;
 function item(label,fn){menu.appendChild(button(label,function(){closeMenu();fn();},"zu-desktop-menu-item"));}
 if(path){
  item("Ouvrir",function(){if(node)node._zebraOpen();});
  item("Mettre à la Corbeille",function(){trashItem(path);});
 }else{
  item("Ranger les icônes",resetPositions);
  item("Ouvrir la Corbeille",active.openTrash);
 }
 screen.appendChild(menu);
 menu.style.left=Math.max(4,Math.min(localX,screen.clientWidth-menu.offsetWidth-6))+"px";
 menu.style.top=Math.max(4,Math.min(localY,screen.clientHeight-menu.offsetHeight-44))+"px";
 active.menu=menu;
}
function outsideMenu(e){
 if(active&&active.menu&&!e.target.closest(".zu-desktop-menu"))closeMenu();
}
/* Sélection rectangulaire Windows : la zone vide du bureau, pas les icônes,
   crée le cadre bleu. Les icônes et le glisser-vers-corbeille conservent leur
   gestionnaire de pointeur existant. */
function selectPointerDown(e){
 if(!active||e.button!==0||e.isPrimary===false||e.pointerType==="touch")return;
 if(e.target.closest(".desk-icon,.window,.start-menu,.taskbar,.zu-sticky-note,.zu-desktop-menu,.zu-selection-rect"))return;
 var state=active,screen=state.screen,root=state.root;
 if(!root.isConnected||!screen.contains(e.target))return;
 if(state.selectionCleanup)state.selectionCleanup();
 closeMenu();
 var ctrl=e.ctrlKey||e.metaKey;
 var icons=Array.from(root.querySelectorAll(".desk-icon[data-path]"));
 var previous=new Set(ctrl?icons.filter(function(n){return n.classList.contains("selected");}):[]);
 if(!ctrl)icons.forEach(function(n){n.classList.remove("selected");});
 var bounds=root.getBoundingClientRect();
 function clamp(n,max){return Math.max(0,Math.min(max,n));}
 var x0=clamp(e.clientX-bounds.left,root.clientWidth),y0=clamp(e.clientY-bounds.top,root.clientHeight);
 var started=false,frame=null,ended=false,id=e.pointerId;
 function drag(ev){
  if(ended||ev.pointerId!==id||active!==state)return;
  var x1=clamp(ev.clientX-bounds.left,root.clientWidth),y1=clamp(ev.clientY-bounds.top,root.clientHeight);
  if(!started&&Math.hypot(x1-x0,y1-y0)<5)return;
  if(!started){
   started=true;
   frame=el("div","zu-selection-rect");
   frame.setAttribute("aria-hidden","true");
   root.appendChild(frame);
  }
  var left=Math.min(x0,x1),top=Math.min(y0,y1),right=Math.max(x0,x1),bottom=Math.max(y0,y1);
  frame.style.left=left+"px";frame.style.top=top+"px";
  frame.style.width=(right-left)+"px";frame.style.height=(bottom-top)+"px";
  icons.forEach(function(node){
   var box=node.getBoundingClientRect();
   var x=box.left-bounds.left,y=box.top-bounds.top;
   var hit=x<right&&x+box.width>left&&y<bottom&&y+box.height>top;
   node.classList.toggle("selected",hit||previous.has(node));
  });
  if(ev.cancelable)ev.preventDefault();
 }
 function stop(ev){
  if(ev.pointerId!==id)return;
  if(ev.type==="pointercancel"){
   icons.forEach(function(node){node.classList.toggle("selected",previous.has(node));});
  }
  cleanup();
 }
 function cleanup(){
  if(ended)return;
  ended=true;
  window.removeEventListener("pointermove",drag);
  window.removeEventListener("pointerup",stop);
  window.removeEventListener("pointercancel",stop);
  if(frame)frame.remove();
  if(state.selectionCleanup===cleanup)state.selectionCleanup=null;
 }
 state.selectionCleanup=cleanup;
 window.addEventListener("pointermove",drag,{passive:false});
 window.addEventListener("pointerup",stop);
 window.addEventListener("pointercancel",stop);
}
function setup(session,repaint,openTrash,osIcon){
 dispose();
 var screen=document.getElementById("desktop-screen");
 var root=document.getElementById("desktop-icons");
 if(!screen||!root)return;
 var bin=el("button","desk-icon zu-trash-icon");
 bin.type="button";bin.title="Corbeille — raccourcis retirés localement";
 bin.setAttribute("aria-label","Ouvrir la Corbeille");
 var icon=el("span","desk-symbol");icon.appendChild(osIcon("recycle-bin",40));
 bin.appendChild(icon);bin.appendChild(el("span","desk-caption","Corbeille"));
 bin.onclick=function(e){if(Date.now()<bin._zebraDragUntil)return;openTrash();};
 screen.appendChild(bin);
 active={session:session,data:cleanState(session),root:root,screen:screen,trash:bin,repaint:repaint,openTrash:openTrash,osIcon:osIcon,menu:null,selectionCleanup:null};
 if(session==="zebra")write();
 screen.addEventListener("contextmenu",backgroundMenu);
 screen.addEventListener("pointerdown",selectPointerDown);
 document.addEventListener("pointerdown",outsideMenu);
 window.addEventListener("resize",positionAll);
}
function backgroundMenu(e){
 if(!active||e.target.closest(".desk-icon,.window,.start-menu,.taskbar,.zu-sticky-note"))return;
 e.preventDefault();showMenu(null,e.clientX,e.clientY,null);
}
function bind(){
 if(!active)return;
 Array.from(active.root.querySelectorAll(".desk-icon[data-path]")).forEach(attachIcon);
 positionAll();
}
function dispose(){
 if(!active)return;
 closeMenu();
 if(active.trash)active.trash.remove();
 if(active.selectionCleanup)active.selectionCleanup();
 active.screen.removeEventListener("pointerdown",selectPointerDown);
 active.screen.removeEventListener("contextmenu",backgroundMenu);
 document.removeEventListener("pointerdown",outsideMenu);
 window.removeEventListener("resize",positionAll);
 active=null;
}
/* Corbeille = une vue de dossier. Les chemins GitHub restent intacts :
   le mécanisme existant ne supprime que l'affichage local de ces raccourcis. */
function showTrash(body,session,openLocalTrash,openComputer){
 if(!body)return;
 if(body._zebraDispose)body._zebraDispose();
 body.replaceChildren();
 body.classList.add("zu-trash-body");
 var lib=window.ZebraGitFiles,viewSizes={small:24,medium:32,large:64,list:20};
 var view="large",viewKey="zebraos.folder-view.v1."+session;
 try{var saved=localStorage.getItem(viewKey);if(viewSizes[saved])view=saved;}catch(_){}
 var windowNode=body.closest(".window"),osIcon=active&&active.osIcon;
 var alive=true,menu=null,unsub=null,dragCleanup=null;
 function closeMenu(){
  if(menu){menu.remove();menu=null;}
 }
 function closeMenuOutside(e){if(menu&&!menu.contains(e.target))closeMenu();}
 document.addEventListener("pointerdown",closeMenuOutside);
 document.addEventListener("keydown",onKey);
 function onKey(e){if(e.key==="Escape")closeMenu();}
 function closeWindow(){
  var btn=windowNode&&windowNode.querySelector(".titlebuttons [data-close]");
  if(btn)btn.click();
 }
 var bar=el("div","github-drive-toolbar");
 function action(label,fn,extra){
  var b=button(label,fn,"classic-button");
  if(extra)b.classList.add(extra);
  bar.appendChild(b);return b;
 }
 function nav(label,fn,kind){
  var b=action(label,fn,"github-nav-button");
  b.classList.add("github-nav-"+kind);
  b.title=kind==="back"?"Retour":"Poste de travail";
  b.setAttribute("aria-label",b.title);
  return b;
 }
 nav("⌂",function(){if(typeof openComputer==="function")openComputer();else closeWindow();},"home");
 var back=nav("",closeWindow,"back");
 var svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
 svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("aria-hidden","true");
 var arrow=document.createElementNS("http://www.w3.org/2000/svg","path");
 arrow.setAttribute("d","M10 5 5 10l5 5M5 10h11v10");
 svg.appendChild(arrow);back.appendChild(svg);
 action("↻ Actualiser",function(){
  if(lib&&lib.load)lib.load().then(function(){if(alive)render();});
  render();
 });
 var restoreAllButton=action("Tout restaurer",function(){
  restoreAll();render();
 });
 if(typeof openLocalTrash==="function")action("Fichiers locaux",openLocalTrash);
 var control=el("label","folder-view-control");
 control.appendChild(el("span","","Affichage"));
 var select=el("select","folder-view-select");
 select.setAttribute("aria-label","Affichage du dossier");
 [["small","Petites icônes"],["medium","Icônes moyennes"],["large","Grandes icônes"],["list","Liste"]].forEach(function(pair){
  var option=el("option","",pair[1]);option.value=pair[0];select.appendChild(option);
 });
 select.value=view;
 select.onchange=function(){
  view=viewSizes[select.value]?select.value:"large";
  try{localStorage.setItem(viewKey,view);}catch(_){}
  render();
 };
 control.appendChild(select);bar.appendChild(control);
 body.appendChild(bar);
 body.appendChild(el("div","folder-path","C:\\BUREAU\\Corbeille"));
 var empty=el("div","github-drive-empty","");
 var list=el("div","folder-list github-drive-list zu-trash-grid");
 var count=el("p","github-drive-count","");
 body.append(empty,list,count);
 function trashed(){
  return active&&active.session===session?active.data.trash.slice():cleanState(session).trash;
 }
 function fileData(path){
  var entries=lib&&typeof lib.allFiles==="function"?lib.allFiles():[];
  var item=entries.find(function(x){return x.path===path;});
  if(item)return item;
  var name=path.split("/").pop().replace(/\.zebraos\.json$/,"");
  return {path:path,name:name,type:/\.zebraos\.json$/.test(path)?"app":"file",
          app:null,icon:/Echo Racer/i.test(name)?"racer":"txt",size:0};
 }
 function titleFor(item){
  return item.type==="dir"?"Dossier":item.type==="app"?"Application":"Fichier";
 }
 function redrawIcons(){
  if(!alive)return;
  var paths=trashed();
  closeMenu();
  list.replaceChildren();
  list.dataset.view=view;
  list.style.setProperty("--folder-icon-size",viewSizes[view]+"px");
  restoreAllButton.disabled=!paths.length;
  empty.style.display=paths.length?"none":"";
  empty.textContent="Ce dossier est vide.";
  paths.forEach(function(path){
   var item=fileData(path);
   var b=el("button","file-entry github-file-entry zu-trash-entry");
   b.type="button";b.title=item.name+" — clic droit pour restaurer";
   b.dataset.path=path;
   if(lib&&typeof lib.icon==="function"&&osIcon)b.appendChild(lib.icon(item,osIcon,viewSizes[view]));
   else if(osIcon)b.appendChild(osIcon(item.type==="dir"?"folder":item.icon||"txt",viewSizes[view]));
   b.appendChild(el("span","github-file-name",item.name));
   b.appendChild(el("small","github-file-size",titleFor(item)));
   b.onclick=function(ev){
    if(Date.now()<(b._zebraDragUntil||0))return;
    if(!ev.ctrlKey&&!ev.metaKey)list.querySelectorAll(".file-entry.selected").forEach(function(x){x.classList.remove("selected");});
    b.classList.add("selected");
   };
   b.oncontextmenu=function(ev){
    ev.preventDefault();ev.stopPropagation();
    showRestoreMenu(path,b,ev.clientX,ev.clientY);
   };
   b.addEventListener("pointerdown",function(ev){beginDrag(ev,b,path);});
   list.appendChild(b);
  });
  count.textContent=paths.length+" élément(s)";
 }
 function render(){redrawIcons();}
 function restoreEntry(path){
  if(!trashed().includes(path))return;
  restore(path);
  render();
 }
 function showRestoreMenu(path,node,x,y){
  closeMenu();
  list.querySelectorAll(".file-entry.selected").forEach(function(n){n.classList.remove("selected");});
  node.classList.add("selected");
  menu=el("div","zu-trash-menu");
  var restoreButton=button("Restaurer",function(){closeMenu();restoreEntry(path);},"zu-trash-menu-item");
  menu.appendChild(restoreButton);
  document.body.appendChild(menu);
  menu.style.left=Math.max(4,Math.min(x,window.innerWidth-menu.offsetWidth-6))+"px";
  menu.style.top=Math.max(4,Math.min(y,window.innerHeight-menu.offsetHeight-6))+"px";
  restoreButton.focus();
 }
 function beginDrag(ev,node,path){
  if(ev.isPrimary===false||(ev.pointerType==="mouse"&&ev.button!==0))return;
  var startX=ev.clientX,startY=ev.clientY,id=ev.pointerId;
  var moving=false,ghost=null,finished=false,hold=null;
  if(ev.pointerType==="touch"){
   hold=setTimeout(function(){
    if(!moving&&!finished)showRestoreMenu(path,node,startX,startY);
   },600);
  }
  function move(p){
   if(finished||p.pointerId!==id)return;
   if(!moving&&Math.hypot(p.clientX-startX,p.clientY-startY)<9)return;
   if(!moving){
    moving=true;clearTimeout(hold);closeMenu();
    ghost=el("div","zu-trash-drag-preview");
    var graphic=node.querySelector(".bureau-item-symbol,.os-icon-graphic");
    if(graphic)ghost.appendChild(graphic.cloneNode(true));
    ghost.appendChild(el("span","",node.querySelector(".github-file-name")?.textContent||""));
    document.body.appendChild(ghost);
    node.classList.add("zu-trash-item-dragging");
   }
   ghost.style.left=(p.clientX+12)+"px";
   ghost.style.top=(p.clientY+12)+"px";
   if(p.cancelable)p.preventDefault();
  }
  function stop(p){
   if(finished||p.pointerId!==id)return;
   finished=true;cleanup();
   if(!alive||!moving)return;
   node._zebraDragUntil=Date.now()+550;
   if(p.type==="pointercancel")return;
   // Sortir de la fenêtre restaure l'élément dans son dossier d'origine.
   var rect=windowNode&&windowNode.getBoundingClientRect();
   var outside=rect&&(p.clientX<rect.left||p.clientX>rect.right||p.clientY<rect.top||p.clientY>rect.bottom);
   var screen=document.getElementById("desktop-screen");
   var area=screen&&screen.getBoundingClientRect();
   var onDesktop=area&&p.clientX>=area.left&&p.clientX<=area.right&&p.clientY>=area.top&&p.clientY<=area.bottom;
   if(outside&&onDesktop)restoreEntry(path);
  }
  function cleanup(){
   clearTimeout(hold);
   window.removeEventListener("pointermove",move);
   window.removeEventListener("pointerup",stop);
   window.removeEventListener("pointercancel",stop);
   if(ghost)ghost.remove();
   node.classList.remove("zu-trash-item-dragging");
   if(dragCleanup===cleanup)dragCleanup=null;
  }
  if(dragCleanup)dragCleanup();
  dragCleanup=cleanup;
  window.addEventListener("pointermove",move,{passive:false});
  window.addEventListener("pointerup",stop);
  window.addEventListener("pointercancel",stop);
 }
 body._zebraDispose=function(){
  alive=false;
  if(dragCleanup)dragCleanup();
  closeMenu();
  document.removeEventListener("pointerdown",closeMenuOutside);
  document.removeEventListener("keydown",onKey);
  if(unsub)unsub();
  body._zebraDispose=null;
 };
 if(lib&&typeof lib.subscribe==="function")unsub=lib.subscribe(function(){if(alive)render();});
 render();
 if(lib&&typeof lib.load==="function")lib.load().then(function(){if(alive)render();});
}
window.ZebraDesktop={setup:setup,bind:bind,isTrashed:trashHas,showTrash:showTrash,dispose:dispose,restore:restore,reset:resetPositions};
}());