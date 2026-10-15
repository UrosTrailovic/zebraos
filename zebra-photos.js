/* ZebraPhotos — visionneuse sobre pour ZebraOS (aucune dépendance). */
(function(){
"use strict";
function el(tag,cls,content){
 var e=document.createElement(tag);
 if(cls)e.className=cls;
 if(content!==undefined)e.textContent=content;
 return e;
}
function button(symbol,cls,title,fn){
 var b=el("button",cls,symbol);b.type="button";b.title=title;
 b.setAttribute("aria-label",title);b.addEventListener("click",fn);return b;
}
function mount(root,initial,collection,options){
 if(root._zebraDispose)root._zebraDispose();
 root.replaceChildren();
 var opts=options||{};
 var files=(Array.isArray(collection)?collection:[]).filter(function(f){return f&&f.type==="file"&&f.path&&f.name;});
 if(!files.some(function(f){return f.path===initial.path;}))files.unshift(initial);
 var index=Math.max(0,files.findIndex(function(f){return f.path===initial.path;}));
 var active=true,disposed=false,loaded=false,fit=true,zoom=100,offsetX=0,offsetY=0,pointer=null,requestId=0;
 var naturalWidth=0,naturalHeight=0;
 var frame=el("section","zpic");
 frame.setAttribute("aria-label","Visionneuse de photos ZebraOS");
 var stage=el("div","zpic-stage");
 var image=el("img","zpic-image");image.alt="";image.draggable=false;
 var wait=el("div","zpic-wait");
 wait.setAttribute("role","status");wait.append(el("span","zpic-wait-wheel"),el("span","zpic-wait-label","CHARGEMENT DE L'IMAGE…"));
 var prev=button("❮","zpic-stage-arrow zpic-prev","Image précédente",function(){navigate(-1);});
 var next=button("❯","zpic-stage-arrow zpic-next","Image suivante",function(){navigate(1);});
 stage.append(image,wait,prev,next);
 var toolbar=el("div","zpic-toolbar");
 var details=el("div","zpic-details");
 var filename=el("strong","zpic-filename");
 var metadata=el("span","zpic-metadata");
 details.append(filename,metadata);
 var nav=el("div","zpic-nav");
 var back=button("❮","zpic-tool","Photo précédente",function(){navigate(-1);});
 var count=el("span","zpic-counter","1 / 1");
 var forward=button("❯","zpic-tool","Photo suivante",function(){navigate(1);});
 nav.append(back,count,forward);
 var adjustments=el("div","zpic-adjustments");
 var fitBtn=button("AJUSTER","zpic-tool zpic-fit","Ajuster l'image à la fenêtre",fitImage);
 var minus=button("−","zpic-tool zpic-zoom-button","Dézoomer",function(){changeZoom(-25);});
 var slider=el("input","zpic-slider");slider.type="range";slider.min="10";slider.max="400";slider.step="5";slider.value="100";
 slider.setAttribute("aria-label","Zoom de la photo");
 var plus=button("+","zpic-tool zpic-zoom-button","Zoomer",function(){changeZoom(25);});
 var amount=el("span","zpic-amount","AJUSTÉ");
 var full=button("⛶","zpic-tool zpic-full","Plein écran",toggleFullscreen);
 adjustments.append(fitBtn,minus,slider,plus,amount,full);
 toolbar.append(details,nav,adjustments);frame.append(stage,toolbar);root.append(frame);
 var cleanups=[];
 function listen(target,type,fn,config){
  target.addEventListener(type,fn,config);cleanups.push(function(){target.removeEventListener(type,fn,config);});
 }
 function currentFile(){return files[index];}
 function currentScale(){
  if(!loaded||!naturalWidth||!naturalHeight)return 1;
  if(!fit)return zoom/100;
  var availableW=Math.max(1,stage.clientWidth-20),availableH=Math.max(1,stage.clientHeight-20);
  return Math.min(availableW/naturalWidth,availableH/naturalHeight,1);
 }
 function layout(){
  if(!active||!loaded)return;
  var scale=currentScale();
  image.style.width=naturalWidth+"px";
  image.style.height=naturalHeight+"px";
  image.style.transform="translate(-50%,-50%) translate("+offsetX+"px,"+offsetY+"px) scale("+scale+")";
  slider.value=String(Math.max(10,Math.min(400,Math.round(scale*100/5)*5)));
  amount.textContent=fit?"AJUSTÉ":Math.round(zoom)+" %";
  fitBtn.classList.toggle("selected",fit);
 }
 function setZoom(value){
  if(!loaded)return;
  fit=false;zoom=Math.max(10,Math.min(400,Math.round(value/5)*5));
  offsetX=0;offsetY=0;layout();
 }
 function changeZoom(diff){setZoom(fit?currentScale()*100+diff:zoom+diff);}
 function fitImage(){fit=true;offsetX=0;offsetY=0;layout();}
 function setStatus(text){wait.querySelector(".zpic-wait-label").textContent=text;wait.hidden=false;}
 function updateTitle(file){
  var title=root.closest(".window")?.querySelector(".windowtitle");
  if(title)title.textContent=file.name+" — ZebraOS";
 }
 function updateNavigation(){
  var single=files.length<2;
  [prev,next,back,forward].forEach(function(b){b.disabled=single;b.hidden=single;});
  count.textContent=(index+1)+" / "+files.length;
 }
 function show(){
  if(!active)return;
  var file=currentFile(),thisRequest=++requestId;
  loaded=false;naturalWidth=naturalHeight=0;
  fit=true;zoom=100;offsetX=offsetY=0;
  frame.dataset.loading="true";
  image.style.visibility="hidden";
  filename.textContent=file.name;
  filename.title=file.name;
  metadata.textContent=(file.name.split(".").pop()||"IMAGE").toUpperCase()+"  ·  "+(opts.sizeText?opts.sizeText(file.size):"");
  updateTitle(file);updateNavigation();
  setStatus("CHARGEMENT DE L'IMAGE…");
  var imageUrl=opts.source?opts.source(file):"/"+file.path.split("/").map(encodeURIComponent).join("/");
  var fallbackUrl=opts.fallback?opts.fallback(file):null;
  var tried=false;
  image.onload=function(){
   if(!active||thisRequest!==requestId)return;
   loaded=true;naturalWidth=image.naturalWidth;naturalHeight=image.naturalHeight;
   metadata.textContent=(file.name.split(".").pop()||"IMAGE").toUpperCase()+"  |  "+naturalWidth+" × "+naturalHeight+"  |  "+(opts.sizeText?opts.sizeText(file.size):"");
   image.alt=file.name;image.style.visibility="visible";
   frame.dataset.loading="false";wait.hidden=true;layout();
  };
  image.onerror=function(){
   if(!active||thisRequest!==requestId)return;
   if(!tried&&fallbackUrl&&fallbackUrl!==image.src){
    tried=true;image.src=fallbackUrl;return;
   }
   frame.dataset.loading="error";
   setStatus("IMAGE INDISPONIBLE");
   metadata.textContent="Impossible d'afficher cette image.";
  };
  image.src=imageUrl;
 }
 function navigate(direction){
  if(files.length<2)return;
  index=(index+direction+files.length)%files.length;
  show();
 }
 function toggleFullscreen(){
  if(document.fullscreenElement){var p=document.exitFullscreen?.();if(p?.catch)p.catch(function(){});return;}
  if(frame.requestFullscreen){var request=frame.requestFullscreen();if(request?.catch)request.catch(function(){});}
 }
 function keyboard(event){
  if(!active)return;
  if(["INPUT","TEXTAREA","SELECT"].includes(event.target?.tagName)||event.altKey||event.ctrlKey||event.metaKey)return;
  if(!frame.contains(document.activeElement)&&!root.closest(".window")?.classList.contains("focused"))return;
  var k=event.key;
  if(k==="ArrowRight"){event.preventDefault();navigate(1);}
  else if(k==="ArrowLeft"){event.preventDefault();navigate(-1);}
  else if(k==="+"||k==="="){event.preventDefault();changeZoom(25);}
  else if(k==="-"){event.preventDefault();changeZoom(-25);}
  else if(k==="0"){event.preventDefault();fitImage();}
  else if(k==="f"||k==="F"){event.preventDefault();toggleFullscreen();}
 }
 function down(event){
  if(!loaded||fit||(event.pointerType==="mouse"&&event.button!==0))return;
  if(event.target.closest("button"))return;
  event.preventDefault();
  pointer={id:event.pointerId,startX:event.clientX,startY:event.clientY,x:offsetX,y:offsetY};
  stage.setPointerCapture?.(event.pointerId);
  stage.classList.add("zpic-panning");
 }
 function move(event){
  if(!pointer||pointer.id!==event.pointerId)return;
  event.preventDefault();
  offsetX=pointer.x+event.clientX-pointer.startX;
  offsetY=pointer.y+event.clientY-pointer.startY;layout();
 }
 function up(event){
  if(!pointer||pointer.id!==event.pointerId)return;
  pointer=null;stage.classList.remove("zpic-panning");
 }
 listen(back,"dblclick",function(e){e.stopPropagation();});
 listen(stage,"pointerdown",down);listen(stage,"pointermove",move);
 listen(stage,"pointerup",up);listen(stage,"pointercancel",up);
 listen(slider,"input",function(){setZoom(Number(slider.value));});
 listen(stage,"wheel",function(e){if(!loaded)return;e.preventDefault();changeZoom(e.deltaY<0?25:-25);},{passive:false});
 listen(stage,"dblclick",function(e){if(e.target.closest("button"))return;fit?setZoom(100):fitImage();});
 listen(frame,"contextmenu",function(e){e.preventDefault();});
 listen(frame,"dragstart",function(e){e.preventDefault();});
 listen(document,"keydown",keyboard);
 listen(window,"resize",layout);
 listen(document,"fullscreenchange",layout);
 show();
 function dispose(){
  if(disposed)return;disposed=true;active=false;requestId++;
  cleanups.forEach(function(fn){fn();});
  image.onload=null;image.onerror=null;image.removeAttribute("src");
  if(root._zebraDispose===dispose)root._zebraDispose=null;
 }
 root._zebraDispose=dispose;
 return dispose;
}
window.ZebraPhotos={mount:mount};
}());