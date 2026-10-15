/* ZebraOS — bureau libre v1 : positions par appareil, corbeille locale réversible.
   GitHub demeure la source des fichiers et des raccourcis. */
(function(){
"use strict";
var active=null,threshold=8;
function el(tag,cls,text){var x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;}
function button(text,fn,cls){var b=el("button",cls||"classic-button",text);b.type="button";b.onclick=fn;return b;}
function storageKey(session){return "zebra.desktop.v1."+session;}
function cleanState(session){
 var result={positions:{wide:{},narrow:{}},trash:[]};
 try{
  var raw=JSON.parse(localStorage.getItem(storageKey(session))||"null");
  if(!raw||typeof raw!=="object")return result;
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
 active={session:session,data:cleanState(session),root:root,screen:screen,trash:bin,repaint:repaint,openTrash:openTrash,menu:null};
 screen.addEventListener("contextmenu",backgroundMenu);
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
 active.screen.removeEventListener("contextmenu",backgroundMenu);
 document.removeEventListener("pointerdown",outsideMenu);
 window.removeEventListener("resize",positionAll);
 active=null;
}
function showTrash(body,session,openLocalTrash){
 body.innerHTML="";
 body.classList.add("zu-trash-body");
 var header=el("div","zu-trash-header");
 header.appendChild(el("strong","","CORBEILLE"));
 header.appendChild(el("span","","BUREAU PERSONNEL"));
 body.appendChild(header);
 body.appendChild(el("p","zu-trash-description","Les raccourcis sont masqués seulement sur cet appareil. Les fichiers GitHub ne sont jamais supprimés."));
 var tools=el("div","zu-trash-tools");
 tools.appendChild(button("TOUT RESTAURER",function(){restoreAll();showTrash(body,session,openLocalTrash);},"classic-button"));
 if(typeof openLocalTrash==="function")tools.appendChild(button("FICHIERS LOCAUX",openLocalTrash,"classic-button"));
 body.appendChild(tools);
 var list=el("div","zu-trash-list"),trashed=active&&active.session===session?active.data.trash.slice():cleanState(session).trash;
 if(!trashed.length)list.appendChild(el("p","zu-trash-empty","La Corbeille est vide."));
 trashed.forEach(function(path){
  var item=el("div","zu-trash-item"),name=path.split("/").pop().replace(/\.zebraos\.json$/,"");
  item.appendChild(el("span","",name));
  item.appendChild(button("RESTAURER",function(){restore(path);showTrash(body,session,openLocalTrash);},"classic-button"));
  list.appendChild(item);
 });
 body.appendChild(list);
}
window.ZebraDesktop={setup:setup,bind:bind,isTrashed:trashHas,showTrash:showTrash,dispose:dispose,restore:restore,reset:resetPositions};
}());