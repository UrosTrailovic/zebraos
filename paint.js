/* ZebraPaint — petit atelier d'images du studio. Aucun service externe. */
(function(){
"use strict";
const WIDTH=640,HEIGHT=400,MAX_UNDO=16;
const colors=["#000000","#ffffff","#808080","#c0c0c0","#800000","#ff0000","#808000","#ffff00","#008000","#00ff00","#008080","#00ffff","#000080","#0000ff","#800080","#ff00ff","#d68545","#f6c289","#eac6c6","#9faad9","#304d46","#5e9f72","#403765","#f7d65c"];
function element(tag,cls,text){let n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function button(label,fn,cls){let n=element("button",cls||"zp-button",label);n.type="button";n.onclick=fn;return n;}
function mount(root){
 if(root._zebraDispose)root._zebraDispose();
 root.innerHTML="";
 const panel=element("div","zp");
 const toolbar=element("div","zp-menu");
 const input=element("input");input.type="file";input.accept="image/*";input.hidden=true;
 const mergedCanvas=()=>{
  const out=document.createElement("canvas");out.width=WIDTH;out.height=HEIGHT;
  const c=out.getContext("2d");c.drawImage(canvas,0,0);
  layers.forEach(layer=>{if(layer.visible)c.drawImage(layer.img,layer.x,layer.y,layer.w,layer.h);});
  return out;
 };
 const download=()=>{
  let a=document.createElement("a");
  a.download="zebra-paint-"+new Date().toISOString().slice(0,10)+".png";
  a.href=mergedCanvas().toDataURL("image/png");
  document.body.appendChild(a);a.click();a.remove();
  notice("Image exportée en PNG · "+layers.length+" calque(s).");
 };
 toolbar.append(button("Nouveau",()=>{if(confirm("Effacer le dessin actuel et tous les calques ?")){record();clearCanvas();layers=[];selectedLayerId=null;renderLayers();notice("Nouveau dessin.");}}),button("Ouvrir une image",()=>input.click()),button("Enregistrer PNG",download));
 toolbar.appendChild(input);
 panel.appendChild(toolbar);
 const body=element("div","zp-body"),tools=element("div","zp-tools"),stage=element("div","zp-stage");
 const canvas=element("canvas","zp-canvas");canvas.width=WIDTH;canvas.height=HEIGHT;
 canvas.setAttribute("aria-label","Zone de dessin ZebraPaint");
 const canvasFrame=element("div","zp-canvas-frame");
 canvasFrame.appendChild(canvas);
 const layerHost=element("div","zp-layer-stage");
 canvasFrame.appendChild(layerHost);
 stage.appendChild(canvasFrame);
 const work=element("div","zp-work");work.appendChild(stage);
 const paletteBar=element("div","zp-colors");
 let currentColor="#000000",brush=4,tool="pencil",fillTolerance=12;
 let status=element("div","zp-status","640 × 400 px · Crayon");
 let history=[],redoHistory=[],drawing=false,start=null,beforeShape=null,last=null,active=true;
 let layers=[],selectedLayerId=null,nextLayerId=1;
 const layerRegistry=new Map(),imageUrls=new Set();
 const layerPanel=element("section","zp-layer-panel");
 layerPanel.setAttribute("aria-label","Calques de ZebraPaint");
 const layerHeader=element("div","zp-layer-header");
 const layerTitle=element("strong","","CALQUES · 0");
 const layerHint=element("span","","Touchez un calque pour le modifier");
 layerHeader.append(layerTitle,layerHint);
 const layerList=element("div","zp-layer-list");
 layerPanel.append(layerHeader,layerList);
 panel.appendChild(layerPanel);
 const importControls=element("div","zp-import-controls");
 const applyImageButton=button("✓ Terminer placement",()=>finishPlacement(),"zp-button zp-apply-image");
 const cancelImageButton=button("× Supprimer calque",()=>deleteSelected(),"zp-button");
 importControls.append(applyImageButton,cancelImageButton);
 importControls.hidden=true;
 toolbar.appendChild(importControls);
 const ctx=canvas.getContext("2d",{willReadFrequently:true});
 ctx.lineCap="round";ctx.lineJoin="round";
 const toolsDef=[
  ["pencil","✎","Crayon"],["brush","🖌","Pinceau"],["eraser","▧","Gomme"],
  ["line","╱","Ligne"],["rect","▭","Rectangle"],["ellipse","◯","Ellipse"],
  ["fill","▣","Pot de peinture"],["picker","⌖","Pipette"],["select","↖","Sélectionner les images"]
 ];
 const toolButtons={};
 function notice(text){status.textContent=text;}
 function choose(t){
  tool=t;Object.keys(toolButtons).forEach(k=>toolButtons[k].classList.toggle("selected",k===t));
  canvas.style.cursor=t==="picker"?"copy":t==="fill"?"cell":t==="select"?"default":"crosshair";
  canvasFrame.classList.toggle("zp-select-mode",t==="select");
  renderLayers();
  notice(WIDTH+" × "+HEIGHT+" px · "+toolsDef.find(i=>i[0]===t)[2]);
 }
 toolsDef.forEach(([id,symbol,label])=>{
  const b=button(symbol,()=>choose(id),"zp-tool");b.title=label;b.setAttribute("aria-label",label);
  toolButtons[id]=b;tools.appendChild(b);
 });
 body.append(tools,work);panel.appendChild(body);
 let options=element("div","zp-options");
 let front=element("button","zp-active-color");front.type="button";front.title="Couleur actuelle";
 front.style.background=currentColor;
 const pickerInput=element("input");pickerInput.type="color";pickerInput.value=currentColor;
 pickerInput.oninput=()=>setColor(pickerInput.value);
 front.onclick=()=>pickerInput.click();
 options.append(front,pickerInput);
 const colorsArea=element("div","zp-palette");
 colors.forEach(color=>{
  let b=button("",()=>setColor(color),"zp-swatch");b.style.background=color;b.title=color;colorsArea.appendChild(b);
 });
 options.appendChild(colorsArea);
 let sizeWrap=element("label","zp-size","Taille");
 const size=element("input");size.type="range";size.min="1";size.max="45";size.value=String(brush);
 let sizeInfo=element("span","",String(brush));size.oninput=()=>{brush=Number(size.value);sizeInfo.textContent=String(brush);};
 sizeWrap.append(size,sizeInfo);options.appendChild(sizeWrap);
 const actions=element("div","zp-edits");
 const undoBtn=button("↶ Annuler",undo),redoBtn=button("↷ Rétablir",redo);
 actions.append(undoBtn,redoBtn);options.appendChild(actions);
 panel.append(options,status);
 root.appendChild(panel);
 function setColor(c){currentColor=c;front.style.background=c;pickerInput.value=c;}
 function clearCanvas(){
  ctx.fillStyle="#ffffff";ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.lineCap="round";ctx.lineJoin="round";
 }
 function snapshot(){
  return {
   pixels:ctx.getImageData(0,0,WIDTH,HEIGHT),selection:selectedLayerId,
   images:layers.map(l=>({id:l.id,x:l.x,y:l.y,w:l.w,h:l.h,visible:l.visible}))
  };
 }
 function restore(state){
  ctx.putImageData(state.pixels,0,0);
  layers=state.images.map(d=>{
   const layer=layerRegistry.get(d.id);
   Object.assign(layer,d);return layer;
  });
  selectedLayerId=layers.some(l=>l.id===state.selection)?state.selection:null;
  renderLayers();
 }
 function record(){
  history.push(snapshot());if(history.length>MAX_UNDO)history.shift();
  redoHistory.length=0;updateHistory();
 }
 function updateHistory(){undoBtn.disabled=!history.length;redoBtn.disabled=!redoHistory.length;}
 function undo(){
  if(!history.length)return;
  redoHistory.push(snapshot());restore(history.pop());
  updateHistory();notice("Modification annulée.");
 }
 function redo(){
  if(!redoHistory.length)return;
  history.push(snapshot());restore(redoHistory.pop());
  updateHistory();notice("Modification rétablie.");
 }
 function point(ev){
  const rect=canvas.getBoundingClientRect();
  return {x:Math.max(0,Math.min(WIDTH-1,(ev.clientX-rect.left)*WIDTH/rect.width)),
          y:Math.max(0,Math.min(HEIGHT-1,(ev.clientY-rect.top)*HEIGHT/rect.height))};
 }
 function paintLine(a,b,erase){
  ctx.save();
  ctx.strokeStyle=erase?"#ffffff":currentColor;
  ctx.lineWidth=erase?Math.max(10,brush*3):brush;
  ctx.lineCap="round";ctx.lineJoin="round";
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  ctx.restore();
 }
 function hexToRgb(color){return [parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)];}
 function flood(x,y){
  x=Math.round(x);y=Math.round(y);
  let image=ctx.getImageData(0,0,WIDTH,HEIGHT),a=image.data;
  const target=(y*WIDTH+x)*4,old=[a[target],a[target+1],a[target+2],a[target+3]],fresh=hexToRgb(currentColor);
  if(old[3]===255&&old.slice(0,3).every((v,i)=>Math.abs(v-fresh[i])<=fillTolerance))return;
  let queued=new Uint8Array(WIDTH*HEIGHT);
  let stack=[y*WIDTH+x];queued[y*WIDTH+x]=1;
  const difference=p=>Math.abs(a[p]-old[0])+Math.abs(a[p+1]-old[1])+Math.abs(a[p+2]-old[2])+Math.abs(a[p+3]-old[3]);
  const maxDiff=fillTolerance*4;
  while(stack.length){
   let cell=stack.pop(),offset=cell*4;
   if(difference(offset)>maxDiff)continue;
   a[offset]=fresh[0];a[offset+1]=fresh[1];a[offset+2]=fresh[2];a[offset+3]=255;
   let col=cell%WIDTH,row=Math.floor(cell/WIDTH);
   const neighbors=[];
   if(col>0)neighbors.push(cell-1);if(col<WIDTH-1)neighbors.push(cell+1);
   if(row>0)neighbors.push(cell-WIDTH);if(row<HEIGHT-1)neighbors.push(cell+WIDTH);
   neighbors.forEach(n=>{if(!queued[n]){queued[n]=1;stack.push(n);}});
  }
  ctx.putImageData(image,0,0);
 }
 function drawShape(p){
  if(beforeShape)ctx.putImageData(beforeShape,0,0);
  if(!start)return;
  ctx.save();ctx.strokeStyle=currentColor;ctx.lineWidth=brush;ctx.lineJoin="round";
  ctx.beginPath();
  if(tool==="line"){ctx.moveTo(start.x,start.y);ctx.lineTo(p.x,p.y);}
  else if(tool==="rect"){ctx.rect(start.x,start.y,p.x-start.x,p.y-start.y);}
  else if(tool==="ellipse"){
   const cx=(start.x+p.x)/2,cy=(start.y+p.y)/2;
   ctx.ellipse(cx,cy,Math.max(.5,Math.abs(p.x-start.x)/2),Math.max(.5,Math.abs(p.y-start.y)/2),0,0,Math.PI*2);
  }
  ctx.stroke();ctx.restore();
 }
 function onDown(ev){
  if(!active||ev.button!==0)return;
  ev.preventDefault();
  if(tool==="select"){selectLayer(null);return;}
  const p=point(ev);
  if(tool==="picker"){
    let rgb=ctx.getImageData(Math.floor(p.x),Math.floor(p.y),1,1).data;
    setColor("#"+Array.from(rgb.slice(0,3)).map(v=>v.toString(16).padStart(2,"0")).join(""));
    choose("pencil");return;
  }
  record();drawing=true;start=p;last=p;
  try{canvas.setPointerCapture(ev.pointerId)}catch(_){}
  if(tool==="fill"){flood(p.x,p.y);drawing=false;return;}
  if(["line","rect","ellipse"].includes(tool)){beforeShape=ctx.getImageData(0,0,WIDTH,HEIGHT);}
  else paintLine(p,p,tool==="eraser");
 }
 function onMove(ev){
  if(!drawing)return;ev.preventDefault();
  const p=point(ev);
  if(["line","rect","ellipse"].includes(tool))drawShape(p);
  else paintLine(last,p,tool==="eraser");
  last=p;
 }
 function onUp(ev){
  if(!drawing)return;
  if(["line","rect","ellipse"].includes(tool))drawShape(point(ev));
  drawing=false;beforeShape=null;last=null;
  notice("Image modifiée · "+WIDTH+" × "+HEIGHT+" px");
 }
 /* Image importée = calque temporaire redimensionnable, en coordonnées
    640×400. Sur mobile, le canvas ET le calque sont réduits ensemble. */
 function discardImport(){
  if(!placedImage)return;
  const old=placedImage;placedImage=null;
  if(old.url)URL.revokeObjectURL(old.url);
  old.node.remove();
  importControls.hidden=true;
 }
 function applyImport(silent){
  if(!placedImage)return;
  const layer=placedImage;
  record();clearCanvas();
  ctx.drawImage(layer.img,layer.x,layer.y,layer.w,layer.h);
  discardImport();
  if(!silent)notice("Image placée sur le dessin · 640 × 400 px");
 }
 function updatePlacedImage(){
  if(!placedImage)return;
  const o=placedImage;
  o.node.style.left=o.x/WIDTH*100+"%";
  o.node.style.top=o.y/HEIGHT*100+"%";
  o.node.style.width=o.w/WIDTH*100+"%";
  o.node.style.height=o.h/HEIGHT*100+"%";
 }
 function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
 function imagePointerDown(ev){
  if(!placedImage||(ev.pointerType==="mouse"&&ev.button!==0))return;
  ev.preventDefault();ev.stopPropagation();
  const layer=placedImage,resize=!!ev.target.closest(".zp-image-resize");
  const frameRect=canvasFrame.getBoundingClientRect();
  const xFactor=WIDTH/frameRect.width,yFactor=HEIGHT/frameRect.height;
  const startX=ev.clientX,startY=ev.clientY;
  const initial={x:layer.x,y:layer.y,w:layer.w,h:layer.h},aspect=layer.w/layer.h;
  const pid=ev.pointerId;
  layer.node.classList.add("zp-image-moving");
  try{layer.node.setPointerCapture(pid);}catch(_){}
  function moving(e){
   if(e.pointerId!==pid||!placedImage||placedImage!==layer)return;
   e.preventDefault();
   const dx=(e.clientX-startX)*xFactor,dy=(e.clientY-startY)*yFactor;
   if(resize){
    const change=Math.abs(dx)>=Math.abs(dy*aspect)?dx:dy*aspect;
    const maxWidth=Math.max(1,Math.min(WIDTH-initial.x,(HEIGHT-initial.y)*aspect));
    layer.w=clamp(initial.w+change,Math.min(24,maxWidth),maxWidth);
    layer.h=layer.w/aspect;
   }else{
    layer.x=clamp(initial.x+dx,0,WIDTH-layer.w);
    layer.y=clamp(initial.y+dy,0,HEIGHT-layer.h);
   }
   updatePlacedImage();
  }
  function finish(e){
   if(e.pointerId!==pid)return;
   layer.node.classList.remove("zp-image-moving");
   window.removeEventListener("pointermove",moving);
   window.removeEventListener("pointerup",finish);
   window.removeEventListener("pointercancel",finish);
  }
  window.addEventListener("pointermove",moving,{passive:false});
  window.addEventListener("pointerup",finish);
  window.addEventListener("pointercancel",finish);
 }
 function importImage(file){
  if(!file||!file.type.startsWith("image/")){notice("Fichier image non reconnu.");return;}
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{
   if(!active){URL.revokeObjectURL(url);return;}
   discardImport();
   const scale=Math.min(WIDTH*.82/img.width,HEIGHT*.8/img.height,1);
   // Un fichier énorme ou vertical tient entièrement sur le plan de travail.
   const w=Math.max(1,img.width*scale),h=Math.max(1,img.height*scale);
   const layer=element("div","zp-imported-image");
   layer.setAttribute("aria-label","Image déplaçable — glisser pour déplacer");
   const visual=element("img","zp-image-visual");
   visual.src=url;visual.alt="Image importée : "+file.name;visual.draggable=false;
   const handle=element("button","zp-image-resize","⤡");
   handle.type="button";handle.title="Redimensionner l’image";
   handle.setAttribute("aria-label","Redimensionner l’image");
   layer.append(visual,handle);
   canvasFrame.appendChild(layer);
   placedImage={img,url,node:layer,x:(WIDTH-w)/2,y:(HEIGHT-h)/2,w,h};
   layer.addEventListener("pointerdown",imagePointerDown);
   updatePlacedImage();importControls.hidden=false;
   notice("Glisse l’image pour la déplacer · ⤡ pour changer la taille · Appliquer pour dessiner");
  };
  img.onerror=()=>{URL.revokeObjectURL(url);notice("Impossible d’ouvrir cette image.");};
  img.src=url;
 }
 input.onchange=()=>{let f=input.files?.[0];input.value="";if(f)importImage(f);};
 canvas.addEventListener("pointerdown",onDown);
 canvas.addEventListener("pointermove",onMove);
 canvas.addEventListener("pointerup",onUp);
 canvas.addEventListener("pointercancel",onUp);
 function key(e){
  if(!active||!root.isConnected||!root.closest(".window")?.classList.contains("focused"))return;
  if(["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?redo():undo();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){e.preventDefault();redo();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"){e.preventDefault();download();}
 }
 document.addEventListener("keydown",key);
 clearCanvas();choose("pencil");updateHistory();
 function dispose(){active=false;discardImport();document.removeEventListener("keydown",key);canvas.removeEventListener("pointerdown",onDown);canvas.removeEventListener("pointermove",onMove);canvas.removeEventListener("pointerup",onUp);canvas.removeEventListener("pointercancel",onUp);}
 root._zebraDispose=dispose;
 return dispose;
}
window.ZebraPaint={mount};
}());