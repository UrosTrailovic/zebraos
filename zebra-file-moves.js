/* ZebraOS — file movement layer. Original published file URLs stay immutable.
 * Directory moves are stored per session; personal files remain IndexedDB blobs.
 * Works across desktop, public folders, private folders and recycle bin. */
(function(){
"use strict";
const ROOT="STUDIO/BUREAU",PREFIX="zebra.file.moves.v1.",listeners=[];
const MAX_MOVES=1100;
function key(session){return PREFIX+(session||"zebra");}
function originalParent(path){return path.substring(0,path.lastIndexOf("/"));}
function state(session){
 try {
  const data=JSON.parse(localStorage.getItem(key(session))||"null");
  if(data&&typeof data==="object"&&data.moves&&typeof data.moves==="object")return data.moves;
 }catch(_){}
 return {};
}
function write(session,moves){
 try{localStorage.setItem(key(session),JSON.stringify({version:1,moves}));return true;}catch(_){return false;}
}
function alertChanged(session){
 window.dispatchEvent(new CustomEvent("zebra-files-changed",{detail:{session}}));
 listeners.slice().forEach(fn=>{try{fn(session);}catch(_){}});
}
function subscribe(fn){
 listeners.push(fn);return ()=>{const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1);};
}
function published(){return window.ZebraGitFiles?.allFiles?.()||[];}
function item(path){return published().find(it=>it.path===path)||null;}
function parent(path,session){
 const moves=state(session);
 return Object.prototype.hasOwnProperty.call(moves,path)?moves[path]:originalParent(path);
}
function localNode(value){
 if(typeof value!=="string")return null;
 const id=value.startsWith("local:")?value.slice(6):value;
 return window.ZebraLocalFiles?.cached?.().find(x=>x.id===id)||null;
}
function validTarget(target,session){
 if(target===ROOT||target==="local:root")return true;
 if(target.startsWith("local:")){
  const node=localNode(target);
  if(!node||node.kind!=="folder"||node.deleted)return false;
  let at=node.parent,count=0;
  while(at&&at!==ROOT&&at!=="root"&&count++<30){
   const local=localNode(at);
   if(local){if(local.deleted)return false;at=local.parent;}
   else if(at.startsWith("STUDIO/BUREAU")){
    if(window.ZebraDesktop?.isTrashed?.(session,at))return false;
    at=parent(at,session);
   }else return false;
  }
  return count<30;
 }
 return !!item(target)&&item(target).type==="dir"&&!isInTrash(target,session);
}
function isInTrash(path,session){
 const desktop=window.ZebraDesktop;
 if(desktop?.isTrashed?.(session,path))return true;
 let at=parent(path,session),n=0;
 while(at&&at!==ROOT&&at!=="root"&&n++<30){
  const local=localNode(at);
  if(local){if(local.deleted)return true;at=local.parent;continue;}
  if(at.startsWith("local:"))return true;
  if(desktop?.isTrashed?.(session,at))return true;
  at=parent(at,session);
 }
 return n>=30;
}
function isAncestor(candidate,folder,session){
 let at=folder,n=0;
 while(at&&at!==ROOT&&at!=="root"&&n++<30){
  if(at===candidate||at==="local:"+candidate||"local:"+at===candidate)return true;
  const local=localNode(at);
  if(local)at=local.parent;
  else at=parent(at,session);
 }
 return n>=30;
}
function children(folder,session,raw){
 const moves=state(session),entries=raw||published();
 return entries.filter(e=>(moves[e.path]||originalParent(e.path))===folder)
  .filter(e=>!isInTrash(e.path,session));
}
function childrenIncludingTrash(folder,session,raw){
 const moves=state(session),entries=raw||published();
 return entries.filter(e=>(moves[e.path]||originalParent(e.path))===folder);
}
function collision(name,target,session,except){
 const targetName=String(name).toLocaleLowerCase("fr");
 if(childrenIncludingTrash(target,session).some(e=>e.path!==except&&e.name.toLocaleLowerCase("fr")===targetName&&!isInTrash(e.path,session)))return true;
 const local=window.ZebraLocalFiles?.cached?.()||[];
 return local.some(e=>(e.parent===target||(target.startsWith("local:")&&e.parent===target.slice(6)))&&!e.deleted
   &&e.id!==(String(except).startsWith("local:")?except.slice(6):"")
   &&e.name.toLocaleLowerCase("fr")===targetName);
}
function checkPublic(paths,target,session,fromTrash){
 if(!validTarget(target,session))return "Ce dossier n'est pas disponible.";
 const picked=[...new Set(paths)];
 if(picked.some(x=>!item(x)))return "Fichier introuvable.";
 var names=new Set();
 for(const path of picked){
  var sameName=item(path).name.toLocaleLowerCase("fr");
  if(names.has(sameName))return "Deux éléments portant le même nom ne peuvent pas être déplacés ensemble.";
  names.add(sameName);
 }
 for(const path of picked){
  const x=item(path);
  if(x.sessions&&!x.sessions.includes(session))return "Fichier non disponible pour cette session.";
  if(x.type==="dir"&&isAncestor(path,target,session))return "Impossible de déplacer un dossier dans lui-même.";
  if(collision(x.name,target,session,path))return "Un élément portant le même nom existe déjà.";
  if(isInTrash(path,session)&&!fromTrash)return "Restaure le fichier avant de le déplacer.";
 }
 return null;
}
function movePublic(paths,target,session,fromTrash){
 const picked=[...new Set(paths)],error=checkPublic(picked,target,session,fromTrash);
 if(error)throw Error(error);
 const moves=state(session);
 for(const path of picked){
  if(target===originalParent(path))delete moves[path];
  else moves[path]=target;
 }
 if(Object.keys(moves).length>MAX_MOVES)throw Error("Trop de déplacements mémorisés.");
 if(!write(session,moves))throw Error("Enregistrement local indisponible.");
 alertChanged(session);
 return true;
}
function getSession(){return window.ZebraFileDrag?.session?.()||"zebra";}
function targetElement(x,y){
 const top=document.elementFromPoint(x,y);
 if(!top)return null;
 const folder=top.closest("[data-zdrop-target]");
 if(folder&&folder.offsetParent!==null)return {target:folder.dataset.zdropTarget,element:folder};
 const screen=document.getElementById("desktop-screen");
 if(screen?.contains(top)&&!top.closest(".window,.start-menu,.taskbar"))return {target:ROOT,element:screen};
 return null;
}
function describe(src){return src.kind==="public"?item(src.id):window.ZebraLocalFiles?.cached?.().find(x=>x.id===src.id);}
function sourceName(src){return describe(src)?.name||"Fichier";}
function sourceParent(src,session){
 return src.kind==="public"?parent(src.id,session):
  window.ZebraLocalFiles?.cached?.().find(x=>x.id===src.id)?.parent;
}
function isSourceTrashed(src,session){
 if(src.kind==="public")return !!window.ZebraDesktop?.isTrashed?.(session,src.id);
 return !!window.ZebraLocalFiles?.cached?.().find(x=>x.id===src.id)?.deleted;
}
function canDrop(sources,target,session){
 if(!target)return false;
 if(target==="trash")return sources.some(x=>!isSourceTrashed(x,session));
 if(!validTarget(target,session))return false;
 return sources.every(x=>{
  if(x.kind==="public")return !checkPublic([x.id],target,session,isSourceTrashed(x,session));
  const file=describe(x);
  if(!file)return false;
  if(file.kind==="folder"&&isAncestor("local:"+x.id,target,session))return false;
  return !collision(file.name,target,session,"local:"+x.id);
 });
}
async function execute(sources,target,session){
 if(!canDrop(sources,target,session))return false;
 const desktop=window.ZebraDesktop,disk=window.ZebraLocalFiles;
 if(target==="trash"){
  for(const source of sources){
   if(source.kind==="public")desktop?.trash?.(source.id);
   else await disk?.trashEntry?.(source.id);
  }
  alertChanged(session);return true;
 }
 // Validate all public items first; do not partly move a public group on conflict.
 const publicPaths=sources.filter(x=>x.kind==="public").map(x=>x.id);
 if(publicPaths.length){
  const err=checkPublic(publicPaths,target,session,true);
  if(err)throw Error(err);
 }
 // Restore before setting the new parent. No GitHub file is modified.
 for(const source of sources){
  if(source.kind==="public"){
   if(desktop?.isTrashed?.(session,source.id))desktop.restore(source.id);
  }else if(isSourceTrashed(source,session)){
   await disk?.restoreEntry?.(source.id);
  }
 }
 if(publicPaths.length)movePublic(publicPaths,target,session,true);
 for(const source of sources.filter(x=>x.kind==="local"))await disk.moveEntry(source.id,target,session);
 alertChanged(session);return true;
}
function createGhost(node,count){
 const ghost=document.createElement("div");ghost.className="zebra-drag-ghost";
 const mark=node.querySelector(".bureau-item-symbol,.file-symbol,.os-icon-graphic")?.cloneNode(true);
 if(mark)ghost.append(mark);
 const label=document.createElement("span");
 label.textContent=count===1?node.dataset.zdragName||"Fichier":count+" éléments";
 ghost.append(label);
 if(count>1)ghost.classList.add("zebra-drag-multi");
 document.body.append(ghost);return ghost;
}
let gesture=null;
function begin(node,source,e,opts){
 if(!node||!source||e.isPrimary===false||(e.pointerType==="mouse"&&e.button!==0))return;
 if(gesture)return;
 const session=opts?.session||getSession();
 const peer=opts?.peers?.()||[source],sources=peer.length?peer:[source];
 let downX=e.clientX,downY=e.clientY,started=false,ghost=null,highlight=null,
  pendingTarget=null,closed=false,hold=null,wasLongPress=false;
 const pointer=e.pointerId;
 if(e.pointerType==="touch"&&typeof opts?.onLongPress==="function")
  hold=setTimeout(()=>{if(!started&&!closed){wasLongPress=true;opts.onLongPress(downX,downY);cleanup();}},650);
 function clearHighlight(){if(highlight){highlight.classList.remove("zebra-drop-highlight","zebra-drop-reject");highlight=null;}}
 function cleanup(){
  if(closed)return;closed=true;clearTimeout(hold);
  window.removeEventListener("pointermove",onMove);
  window.removeEventListener("pointerup",onFinish);
  window.removeEventListener("pointercancel",onFinish);
  if(ghost)ghost.remove();clearHighlight();
  node.classList.remove("zebra-drag-source");gesture=null;
 }
 function chooseTarget(x,y){
  clearHighlight();
  const target=targetElement(x,y);
  pendingTarget=target;
  if(target){
   highlight=target.element;
   highlight.classList.add(canDrop(sources,target.target,session)?"zebra-drop-highlight":"zebra-drop-reject");
  }
 }
 function onMove(ev){
  if(ev.pointerId!==pointer||closed)return;
  if(!started&&Math.hypot(ev.clientX-downX,ev.clientY-downY)<8)return;
  if(!started){
   started=true;clearTimeout(hold);node.classList.add("zebra-drag-source");
   ghost=createGhost(node,sources.length);
   opts?.onStart?.();
  }
  if(ghost){ghost.style.left=(ev.clientX+15)+"px";ghost.style.top=(ev.clientY+15)+"px";}
  chooseTarget(ev.clientX,ev.clientY);
  opts?.onMove?.(ev);
  if(ev.cancelable)ev.preventDefault();
 }
 async function onFinish(ev){
  if(ev.pointerId!==pointer||closed)return;
  const didDrag=started,target=pendingTarget?.target||null,valid=didDrag&&canDrop(sources,target,session);
  cleanup();
  if(wasLongPress)return;
  if(!didDrag||ev.type==="pointercancel")return;
  node._zebraDragUntil=Date.now()+600;
  try{
   if(valid){
    // Moving an item around the same desktop should reposition the icon.
    if(target===ROOT&&sources.length===1&&sourceParent(source,session)===ROOT
        &&typeof opts?.onDesktopDrop==="function"){
     opts.onDesktopDrop(ev);return;
    }
    await execute(sources,target,session);
    opts?.onFinished?.(target);
   }else if(typeof opts?.onNoTarget==="function")opts.onNoTarget(ev,target);
  }catch(error){
   opts?.onError?.(error);
   if(!opts?.onError)window.alert(error?.message||"Déplacement impossible.");
  }
 }
 gesture={cleanup};
 window.addEventListener("pointermove",onMove,{passive:false});
 window.addEventListener("pointerup",onFinish);
 window.addEventListener("pointercancel",onFinish);
}
function bind(node,source,options){
 if(!node)return;
 node.dataset.zdragName=sourceName(source);
 node.addEventListener("pointerdown",e=>begin(node,source,e,options));
 node.draggable=false;
}
function markDrop(node,target){
 if(!node)return;node.dataset.zdropTarget=target;
}
window.ZebraFileMoves={
 root:ROOT,originalParent,parent,children,childrenIncludingTrash,isInTrash,isAncestor,
 validTarget,checkPublic,movePublic,canDrop,move:execute,subscribe,notify:alertChanged,
 markDrop,bind,begin,sourceParent,sourceName,sourceTrashed:isSourceTrashed,
 getSession,findTarget:targetElement
};
}());