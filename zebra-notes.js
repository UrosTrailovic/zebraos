/* ZebraOS — éditeur TXT minimal, avec sauvegarde locale automatique par session. */
(function(){
"use strict";
function el(tag,cls,text){
 var node=document.createElement(tag);
 if(cls)node.className=cls;
 if(text!==undefined)node.textContent=text;
 return node;
}
function mount(host,item,options){
 if(host._zebraDispose)host._zebraDispose();
 host.replaceChildren();
 var opts=options||{},account=opts.session||"visitor";
 var key="zebra.text.v1."+account+"."+item.path;
 var alive=true,saving=null,loaded=false;
 var controller=typeof AbortController!=="undefined"?new AbortController():null;
 var frame=el("section","ztext");
 var edit=el("textarea","ztext-area");
 edit.spellcheck=true;
 edit.setAttribute("aria-label","Modifier "+item.name);
 edit.disabled=true;
 var footer=el("div","ztext-footer");
 var counter=el("span","ztext-counter","0 caractère");
 footer.appendChild(counter);
 frame.append(edit,footer);host.appendChild(frame);
 function count(){
  counter.textContent=edit.value.length.toLocaleString("fr")+" caractère"+(edit.value.length>1?"s":"");
 }
 function persist(){
  if(!alive||!loaded)return;
  clearTimeout(saving);saving=null;
  try{localStorage.setItem(key,edit.value);}catch(_){}
  count();
 }
 function change(){
  count();clearTimeout(saving);saving=setTimeout(persist,360);
 }
 function keyboard(e){
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"){
   e.preventDefault();persist();
  }
 }
 function context(e){e.stopPropagation();}
 edit.addEventListener("input",change);
 edit.addEventListener("keydown",keyboard);
 edit.addEventListener("contextmenu",context);
 function finish(text){
  if(!alive)return;
  var cached=null;
  try{cached=localStorage.getItem(key);}catch(_){}
  edit.value=cached!==null?cached:text;
  edit.disabled=false;loaded=true;count();
 }
 var url=typeof opts.source==="function"?opts.source(item):"";
 if(url&&typeof fetch==="function"){
  var args=controller?{signal:controller.signal,cache:"no-store"}:{cache:"no-store"};
  fetch(url,args).then(function(r){if(!r.ok)throw Error("source indisponible");return r.text();})
   .then(function(t){finish(t.slice(0,250000));})
   .catch(function(){finish("");});
 }else finish("");
 function dispose(){
  if(!alive)return;
  if(loaded&&saving)persist();
  alive=false;clearTimeout(saving);
  if(controller)controller.abort();
  edit.removeEventListener("input",change);
  edit.removeEventListener("keydown",keyboard);
  edit.removeEventListener("contextmenu",context);
  if(host._zebraDispose===dispose)host._zebraDispose=null;
 }
 host._zebraDispose=dispose;
 return dispose;
}
window.ZebraTextEditor={mount:mount};
}());