/* ZebraOS — fichiers texte éditables, sauvegarde locale par session.
   Pas d'API serveur ni de token GitHub. La source publiée reste inchangée. */
(function(){
"use strict";
function el(tag,cls,text){
 var x=document.createElement(tag);
 if(cls)x.className=cls;
 if(text!==undefined)x.textContent=text;
 return x;
}
function button(text,click){
 var x=el("button","ztext-button",text);x.type="button";x.onclick=click;return x;
}
function mount(host,item,options){
 if(host._zebraDispose)host._zebraDispose();
 host.replaceChildren();
 var opts=options||{},account=opts.session||"visitor";
 var key="zebra.text.v1."+account+"."+item.path;
 var alive=true,saving=null,controller=typeof AbortController!=="undefined"?new AbortController():null;
 var original="",loaded=false,local=false;
 var frame=el("section","ztext");
 var head=el("div","ztext-toolbar");
 var badge=el("span","ztext-icon","▤");
 var label=el("strong","ztext-name",item.name);
 label.title=item.name;
 var savedLabel=el("span","ztext-saved","OUVERTURE…");
 var edit=el("textarea","ztext-area");
 edit.spellcheck=true;edit.setAttribute("aria-label","Modifier "+item.name);
 edit.placeholder="Écris tes notes et remerciements ici…";
 edit.disabled=true;
 var bottom=el("div","ztext-footer");
 var hint=el("span","ztext-hint","Sauvegarde dans ce navigateur uniquement · pas sur GitHub");
 var counter=el("span","ztext-counter","0 caractère");
 var restore=button("↶ ORIGINAL GITHUB",restoreOriginal);
 restore.title="Revenir au contenu publié sur GitHub";
 var exportBtn=button("↧ EXPORTER .TXT",exportText);
 exportBtn.title="Télécharger une copie texte pour la sauvegarder ailleurs";
 head.append(badge,label,savedLabel);
 bottom.append(hint,counter,restore,exportBtn);
 frame.append(head,edit,bottom);host.append(frame);
 function status(text){savedLabel.textContent=text;}
 function count(){
  counter.textContent=edit.value.length.toLocaleString("fr")+" caractère"+(edit.value.length>1?"s":"");
 }
 function persist(){
  if(!alive||!loaded)return;
  clearTimeout(saving);saving=null;
  try{
   localStorage.setItem(key,edit.value);
   status("● ENREGISTRÉ EN LOCAL");
   count();
  }catch(e){status("⚠ STOCKAGE INDISPONIBLE");}
 }
 function change(){
  status("● MODIFIÉ");
  count();clearTimeout(saving);saving=setTimeout(persist,360);
 }
 function restoreOriginal(){
  if(!loaded)return;
  if(!confirm("Remplacer tes notes locales par le contenu publié sur GitHub ?"))return;
  edit.value=original;
  change();persist();
 }
 function exportText(){
  persist();
  var blob=new Blob([edit.value],{type:"text/plain;charset=utf-8"});
  var url=URL.createObjectURL(blob);
  var a=el("a");a.href=url;a.download=item.name;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},1200);
 }
 function keyboard(e){
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"){
   e.preventDefault();persist();
  }
 }
 function context(e){
  // Les éditeurs de texte gardent le menu copier/coller habituel.
  e.stopPropagation();
 }
 edit.addEventListener("input",change);
 edit.addEventListener("keydown",keyboard);
 edit.addEventListener("contextmenu",context);
 function finish(text){
  if(!alive)return;
  original=text;
  var cached=null;
  try{cached=localStorage.getItem(key);}catch(e){}
  local=cached!==null;
  edit.value=local?cached:text;
  edit.disabled=false;loaded=true;count();
  status(local?"● BROUILLON LOCAL":"● PRÊT À ÉCRIRE");
 }
 var url=typeof opts.source==="function"?opts.source(item):"";
 if(url&&typeof fetch==="function"){
  var args=controller?{signal:controller.signal,cache:"no-store"}:{cache:"no-store"};
  fetch(url,args).then(function(r){if(!r.ok)throw Error("source indisponible");return r.text();})
   .then(function(t){finish(t.slice(0,250000));})
   .catch(function(){finish("");if(alive&&!local)status("● NOUVEAU FICHIER LOCAL");});
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