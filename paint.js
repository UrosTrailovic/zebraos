/* ZebraPaint 1.3 — miniature éditeur graphique à calques, local et sans serveur. */
(function(){
"use strict";
const W=640,H=400,UNDO_LIMIT=12,MAX_LAYERS=25;
const palette=["#000000","#ffffff","#808080","#c0c0c0","#800000","#ff0000","#808000","#ffff00","#008000","#00ff00","#008080","#00ffff","#000080","#0000ff","#800080","#ff00ff","#d68545","#f6c289","#eac6c6","#9faad9","#304d46","#5e9f72","#403765","#f7d65c"];
function el(tag,cls,text){const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;}
function btn(label,fn,cls="zp-button"){const x=el("button",cls,label);x.type="button";x.onclick=fn;return x;}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const svgPaths={
 select:'<path d="m4 2 7 19 2-8 8-2z"/>',
 pencil:'<path d="m4 20 4-1 12-12-3-3L5 16zM15 6l3 3"/>',
 brush:'<path d="m14 6 4-4 4 4-5 5-4-4zM14 9 8 17"/><path d="M8 17c-1 4-6 5-6 5s0-5 4-6z"/>',
 eraser:'<path d="m3 15 10-11 8 8-9 9H7zM9 21h12M9 9l8 8"/>',
 line:'<path d="M3 21 21 3"/><circle cx="3" cy="21" r="1.4"/><circle cx="21" cy="3" r="1.4"/>',
 rect:'<rect x="3" y="5" width="18" height="14" rx="1"/>',
 ellipse:'<ellipse cx="12" cy="12" rx="9" ry="7"/>',
 fill:'<path d="m4 13 8-9 9 9-9 9zM3 21h18"/><path d="M18 16c-2 4 4 4 2 0l-1-3z"/>',
 picker:'<path d="m13 5 6-3 3 3-3 6-2-2-9 9-5 1 1-5 9-9zM15 7l3 3"/>'
};
const toolDefs=[
 ["select","Sélection","Bouger / taille"],
 ["pencil","Crayon","Trait fin"],
 ["brush","Pinceau","Trait large"],
 ["eraser","Gomme","Effacer un calque"],
 ["fill","Remplir","Fond de couleur"],
 ["picker","Pipette","Prendre une couleur"],
 ["line","Ligne","Tracer une ligne"],
 ["rect","Rectangle","Tracer un cadre"],
 ["ellipse","Ellipse","Tracer un ovale"]
];
function mount(root){
 if(root._zebraDispose)root._zebraDispose();
 root.replaceChildren();
 let active=true,tool="select",color="#000000",size=6,selected=null,nextId=1;
 let layers=[],history=[],redo=[],drawing=false,drawingId=null,last=null,start=null,beforeShape=null,currentErase=null,draggingCleanup=null;
 const registry=new Map(),urls=new Set();
 const panel=el("div","zp");
 const bar=el("div","zp-menu");
 const upload=el("input");upload.type="file";upload.accept="image/*";upload.hidden=true;
 const message=el("div","zp-status","640 × 400 · ZebraPaint");
 const canvasFrame=el("div","zp-canvas-frame");
 const layerStage=el("div","zp-layer-stage");
 const canvas=el("canvas","zp-canvas");
 canvas.width=W;canvas.height=H;canvas.setAttribute("aria-label","Zone de dessin ZebraPaint");
 canvasFrame.append(layerStage,canvas);
 const stage=el("div","zp-stage");stage.append(canvasFrame);
 const work=el("div","zp-work");work.append(stage);
 const tools=el("div","zp-tools zp-tools-clear");
 const body=el("div","zp-body");body.append(tools,work);
 const panelLayers=el("section","zp-layer-panel");
 const panelHeader=el("div","zp-layer-header");
 const panelTitle=el("strong","","CALQUES");
 const hint=el("span","","Haut = premier plan");
 panelHeader.append(panelTitle,hint);
 const layerList=el("div","zp-layer-list");
 const scaleRow=el("div","zp-scale-row");
 const scaleLabel=el("label","","TAILLE IMAGE");
 const scale=el("input","zp-scale-input");scale.type="range";scale.min="10";scale.max="500";scale.step="5";scale.value="100";
 const scaleValue=el("output","","100 %");
 const resetScale=btn("100 %",()=>changeScale(100),"zp-button");
 scaleRow.append(scaleLabel,scale,scaleValue,resetScale);
 panelLayers.append(panelHeader,layerList,scaleRow);
 const options=el("div","zp-options");
 const currentColor=btn("","", "zp-active-color");currentColor.type="button";currentColor.title="Couleur actuelle";currentColor.style.background=color;
 const pick=el("input");pick.type="color";pick.value=color;pick.setAttribute("aria-label","Choisir la couleur");
 currentColor.onclick=()=>pick.click();
 pick.oninput=()=>setColor(pick.value);
 options.append(currentColor,pick);
 const swatches=el("div","zp-palette");palette.forEach(c=>{const x=btn("",()=>setColor(c),"zp-swatch");x.style.background=c;x.title=c;swatches.append(x);});
 options.append(swatches);
 const brushWrap=el("label","zp-size","TAILLE");
 const brushSlider=el("input");brushSlider.type="range";brushSlider.min="1";brushSlider.max="70";brushSlider.value=String(size);
 const brushNumber=el("span","",String(size));
 brushSlider.oninput=()=>{size=Number(brushSlider.value);brushNumber.textContent=String(size);};
 brushWrap.append(brushSlider,brushNumber);options.append(brushWrap);
 const undoBtn=btn("↶ Annuler",undo),redoBtn=btn("↷ Rétablir",redoAction);
 const actions=el("div","zp-edits");actions.append(undoBtn,redoBtn);options.append(actions);
 const saveBtn=btn("💾 Enregistrer PNG",download);
 bar.append(btn("Nouveau",newDocument),btn("＋ Importer photo",()=>upload.click()),btn("＋ Calque dessin",()=>addRaster(true)),saveBtn,upload);
 const changeControls=el("div","zp-import-controls");
 changeControls.append(btn("✓ Terminer",()=>{select(null);choose("select");notice("Placement terminé : les calques restent modifiables.");},"zp-button zp-apply-image"),
   btn("× Supprimer",()=>removeLayer(selected),"zp-button"));
 bar.append(changeControls);
 panel.append(bar,body,panelLayers,options,message);root.append(panel);

 const toolButtons={};
 toolDefs.forEach(([id,label,tooltip])=>{
  const b=btn("",()=>choose(id),"zp-tool");
  b.title=label+" — "+tooltip;b.setAttribute("aria-label",label);
  const svg=el("span","zp-tool-art");
  svg.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">'+svgPaths[id]+'</svg>';
  b.append(svg,el("span","zp-tool-name",label));
  toolButtons[id]=b;tools.append(b);
 });
 function notice(t){message.textContent=t;}
 function setColor(v){color=v;currentColor.style.background=v;pick.value=v;}
 function choose(t){
  tool=t;
  Object.keys(toolButtons).forEach(id=>toolButtons[id].classList.toggle("selected",id===t));
  canvasFrame.classList.toggle("zp-select-mode",t==="select");
  canvas.style.cursor=t==="picker"?"copy":t==="fill"?"cell":t==="select"?"default":"crosshair";
  render();notice(toolDefs.find(d=>d[0]===t)[1]+" · "+toolDefs.find(d=>d[0]===t)[2]);
 }
 function paintSurface(colorValue){
  const c=document.createElement("canvas");c.width=W;c.height=H;
  const x=c.getContext("2d",{willReadFrequently:true});
  if(colorValue){x.fillStyle=colorValue;x.fillRect(0,0,W,H);}
  return c;
 }
 function createRaster(name,fill){
  const surface=paintSurface(fill);
  const node=surface;node.className="zp-raster-layer";node.style.touchAction="none";
  const layer={id:nextId++,type:"raster",name,surface,node,visible:true};
  registry.set(layer.id,layer);return layer;
 }
 function bootLayers(){
  const background=createRaster("Fond","#ffffff"),drawingLayer=createRaster("Dessin 1");
  layers=[background,drawingLayer];selected=drawingLayer.id;
 }
 function newDocument(){
  if(!confirm("Créer un nouveau dessin et effacer les calques actuels ?"))return;
  record();bootLayers();render();choose("select");notice("Nouveau dessin 640 × 400.");
 }
 function addRaster(userTriggered,above){
  if(layers.length>=MAX_LAYERS){notice("Maximum de "+MAX_LAYERS+" calques.");return null;}
  if(userTriggered)record();
  const layer=createRaster("Dessin "+nextId);
  const index=above==null?layers.findIndex(l=>l.id===selected):above;
  layers.splice(index<0?layers.length:index+1,0,layer);
  selected=layer.id;
  render();
  if(userTriggered)notice("Nouveau calque de dessin : "+layer.name);
  return layer;
 }
 function cloneStrokes(strokes){return strokes.map(s=>({diameter:s.diameter,pts:s.pts.map(p=>p.slice())}));}
 function snapshot(){
  return {sel:selected,
   list:layers.map(l=>({id:l.id,type:l.type,name:l.name,visible:l.visible,
     x:l.x,y:l.y,w:l.w,h:l.h,erase:l.type==="image"?cloneStrokes(l.erase):null,
     pixels:l.type==="raster"?l.surface.getContext("2d").getImageData(0,0,W,H):null}))};
 }
 function record(){
  history.push(snapshot());if(history.length>UNDO_LIMIT)history.shift();
  redo=[];updateHistory();
 }
 function updateHistory(){undoBtn.disabled=!history.length;redoBtn.disabled=!redo.length;}
 function restore(state){
  layers=state.list.map(d=>{
   const l=registry.get(d.id);
   l.visible=d.visible;l.name=d.name;
   if(l.type==="raster")l.surface.getContext("2d").putImageData(d.pixels,0,0);
   else{l.x=d.x;l.y=d.y;l.w=d.w;l.h=d.h;l.erase=cloneStrokes(d.erase);redrawImage(l);}
   return l;
  });
  selected=layers.some(l=>l.id===state.sel)?state.sel:null;
  render();updateHistory();
 }
 function undo(){if(!history.length)return;redo.push(snapshot());restore(history.pop());notice("Annulé.");}
 function redoAction(){if(!redo.length)return;history.push(snapshot());restore(redo.pop());notice("Rétabli.");}
 function getSelected(){return layers.find(l=>l.id===selected)||null;}
 function select(id){
  selected=layers.some(l=>l.id===id)?id:null;
  render();
  const layer=getSelected();
  if(layer)notice(layer.type==="image"?"Photo sélectionnée · glisser ou redimensionner / gomme":"Calque dessin sélectionné · peinture / remplissage");
 }
 function removeLayer(id){
  if(layers.length<=1){notice("Il faut conserver au moins un calque.");return;}
  const i=layers.findIndex(l=>l.id===id);if(i<0)return;
  record();layers.splice(i,1);selected=layers[Math.max(0,i-1)].id;render();
  notice("Calque supprimé. Annuler pour restaurer.");
 }
 function moveLayer(id,dir){
  const i=layers.findIndex(l=>l.id===id),j=i+dir;if(i<0||j<0||j>=layers.length)return;
  record();const [layer]=layers.splice(i,1);layers.splice(j,0,layer);selected=id;render();
  notice("Ordre des calques modifié.");
 }
 function visibility(id){
  const l=layers.find(l=>l.id===id);if(!l)return;
  record();l.visible=!l.visible;
  if(!l.visible&&selected===l.id)selected=null;render();
  notice(l.visible?"Calque visible.":"Calque masqué.");
 }
 function previewThumb(layer){
  const thumb=el("canvas","zp-layer-thumb");thumb.width=36;thumb.height=30;
  const c=thumb.getContext("2d");c.fillStyle="#fff";c.fillRect(0,0,36,30);
  if(layer.type==="raster")c.drawImage(layer.surface,0,0,W,H,0,0,36,30);
  else c.drawImage(layer.surface,0,0,layer.surface.width,layer.surface.height,0,0,36,30);
  return thumb;
 }
 function render(){
  layerStage.replaceChildren(...layers.map(l=>l.node));
  layers.forEach(l=>{
   l.node.hidden=!l.visible;
   if(l.type==="image")positionImage(l);
  });
  panelTitle.textContent="CALQUES · "+layers.length;
  changeControls.hidden=!getSelected();
  const image=getSelected()?.type==="image"?getSelected():null;
  scaleRow.hidden=!image;
  if(image){const pct=Math.round(image.w/image.baseW*100);
   scale.value=String(clamp(pct,10,500));scaleValue.textContent=pct+" %";}
  layerList.replaceChildren();
  layers.slice().reverse().forEach(l=>{
   const row=el("div","zp-layer-entry"+(l.id===selected?" active":"")+(l.visible?"":" hidden-layer"));
   const b=btn("",()=>{select(l.id);if(l.type==="image")choose("select");},"zp-layer-choice");
   b.append(previewThumb(l),el("span","zp-layer-name",(l.type==="image"?"▣ ":"✎ ")+l.name));
   const actions=el("div","zp-layer-buttons");
   const eye=btn(l.visible?"◉":"○",()=>visibility(l.id),"zp-layer-action");eye.title=l.visible?"Masquer":"Afficher";eye.setAttribute("aria-label",eye.title);
   const up=btn("↑",()=>moveLayer(l.id,1),"zp-layer-action");up.disabled=layers[layers.length-1]===l;up.title="Devant";up.setAttribute("aria-label","Monter le calque");
   const down=btn("↓",()=>moveLayer(l.id,-1),"zp-layer-action");down.disabled=layers[0]===l;down.title="Derrière";down.setAttribute("aria-label","Descendre le calque");
   const del=btn("×",()=>removeLayer(l.id),"zp-layer-action zp-layer-remove");del.title="Supprimer";del.setAttribute("aria-label","Supprimer le calque");
   actions.append(eye,up,down,del);row.append(b,actions);layerList.append(row);
  });
 }
 function positionImage(l){
  l.node.style.left=l.x/W*100+"%";l.node.style.top=l.y/H*100+"%";
  l.node.style.width=l.w/W*100+"%";l.node.style.height=l.h/H*100+"%";
  l.node.classList.toggle("zp-image-selected",l.id===selected);
 }
 function changeScale(v){
  const l=getSelected();if(!l||l.type!=="image")return;
  v=clamp(Number(v),10,500);
  const w=l.baseW*v/100,h=w/l.aspect;
  record();
  const centerX=l.x+l.w/2,centerY=l.y+l.h/2;
  l.w=w;l.h=h;l.x=centerX-w/2;l.y=centerY-h/2;
  positionImage(l);render();
  notice("Taille image : "+Math.round(v)+" % · parties extérieures recadrées à l'export.");
 }
 scale.onchange=()=>changeScale(scale.value);
 scale.oninput=()=>{scaleValue.textContent=scale.value+" %";};
 function photoSurface(img){
  const factor=Math.min(1,1200/Math.max(img.width,img.height));
  const surface=document.createElement("canvas");
  surface.width=Math.max(1,Math.round(img.width*factor));
  surface.height=Math.max(1,Math.round(img.height*factor));
  surface.getContext("2d").drawImage(img,0,0,surface.width,surface.height);
  return surface;
 }
 function redrawImage(l){
  const c=l.surface.getContext("2d");
  c.globalCompositeOperation="source-over";c.clearRect(0,0,l.surface.width,l.surface.height);
  c.drawImage(l.img,0,0,l.surface.width,l.surface.height);
  c.globalCompositeOperation="destination-out";c.lineCap="round";c.lineJoin="round";
  l.erase.forEach(s=>{
   const pts=s.pts;
   if(!pts.length)return;
   c.beginPath();c.lineWidth=Math.max(1,s.diameter*l.surface.width);
   c.moveTo(pts[0][0]*l.surface.width,pts[0][1]*l.surface.height);
   if(pts.length===1)c.lineTo(pts[0][0]*l.surface.width+.01,pts[0][1]*l.surface.height+.01);
   else pts.slice(1).forEach(p=>c.lineTo(p[0]*l.surface.width,p[1]*l.surface.height));
   c.stroke();
  });
  c.globalCompositeOperation="source-over";
 }
 function importFile(file){
  if(!file||(!file.type.startsWith("image/"))){notice("Choisis un fichier image.");return;}
  if(layers.length>=MAX_LAYERS){notice("Maximum de "+MAX_LAYERS+" calques.");return;}
  const url=URL.createObjectURL(file);urls.add(url);
  const img=new Image();
  img.onload=()=>{
   if(!active){URL.revokeObjectURL(url);return;}
   record();
   const fit=Math.min(W*.82/img.width,H*.8/img.height,1),w=img.width*fit,h=img.height*fit;
   const container=el("div","zp-imported-image");
   const surface=photoSurface(img);
   surface.className="zp-image-visual";
   const handle=btn("⤡",()=>{},"zp-image-resize");handle.title="Redimensionner";handle.setAttribute("aria-label","Redimensionner l’image");
   container.append(surface,handle);
   const l={id:nextId++,type:"image",name:file.name.slice(0,65),img,url,
    surface,node:container,x:(W-w)/2,y:(H-h)/2,w,h,baseW:w,aspect:w/h,erase:[],visible:true};
   registry.set(l.id,l);
   const currentIndex=layers.findIndex(a=>a.id===selected);
   layers.splice(currentIndex<0?layers.length:currentIndex+1,0,l);
   selected=l.id;
   container.addEventListener("pointerdown",imagePointerDown);
   choose("select");notice("Image importée · glisser, ⤡ redimensionner ou échelle jusqu'à 500 %.");
  };
  img.onerror=()=>{urls.delete(url);URL.revokeObjectURL(url);notice("Impossible de charger l'image.");};
  img.src=url;
 }
 upload.onchange=()=>{const file=upload.files?.[0];upload.value="";if(file)importFile(file);};
 function point(e){
  const r=canvasFrame.getBoundingClientRect();
  return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};
 }
 function captureDrawingLayer(){
  let l=getSelected();
  if(l&&l.type==="raster"){if(!l.visible){l.visible=true;render();}return l;}
  // Si une photo est sélectionnée, tout nouveau trait est sur un calque au-dessus.
  return addRaster(false);
 }
 function rasterLine(ctx,a,b,erase){
  ctx.save();ctx.globalCompositeOperation=erase?"destination-out":"source-over";
  ctx.strokeStyle=erase?"#000":color;ctx.lineWidth=erase?size*2:size;
  ctx.lineCap="round";ctx.lineJoin="round";
  ctx.beginPath();ctx.moveTo(a.x,a.y);
  ctx.lineTo(b.x===a.x?b.x+.005:b.x,b.y===a.y?b.y+.005:b.y);
  ctx.stroke();ctx.restore();
 }
 function flood(ctx,x,y){
  x=Math.round(clamp(x,0,W-1));y=Math.round(clamp(y,0,H-1));
  const image=ctx.getImageData(0,0,W,H),d=image.data,i=(y*W+x)*4;
  const rgba=[d[i],d[i+1],d[i+2],d[i+3]],hex=color.replace("#","");
  const next=[parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16),255];
  if(rgba.every((v,k)=>v===next[k]))return;
  const seen=new Uint8Array(W*H),stack=[y*W+x];seen[y*W+x]=1;
  while(stack.length){
   const q=stack.pop(),a=q*4;
   if(Math.abs(d[a]-rgba[0])+Math.abs(d[a+1]-rgba[1])+Math.abs(d[a+2]-rgba[2])+Math.abs(d[a+3]-rgba[3])>32)continue;
   d[a]=next[0];d[a+1]=next[1];d[a+2]=next[2];d[a+3]=255;
   const xx=q%W,yy=Math.floor(q/W);
   for(const n of [xx>0?q-1:-1,xx<W-1?q+1:-1,yy>0?q-W:-1,yy<H-1?q+W:-1])
    if(n>=0&&!seen[n]){seen[n]=1;stack.push(n);}
  }
  ctx.putImageData(image,0,0);
 }
 function erasePoint(l,p){
  return [(p.x-l.x)/l.w,(p.y-l.y)/l.h];
 }
 function onDown(e){
  if(!active||(e.pointerType==="mouse"&&e.button!==0))return;
  if(tool==="select"){select(null);return;}
  e.preventDefault();
  const p=point(e);
  if(tool==="picker"){
   const px=merged().getContext("2d").getImageData(Math.round(clamp(p.x,0,W-1)),Math.round(clamp(p.y,0,H-1)),1,1).data;
   setColor("#"+[px[0],px[1],px[2]].map(n=>n.toString(16).padStart(2,"0")).join(""));
   notice("Couleur récupérée.");return;
  }
  record();
  const selectedBefore=getSelected();
  if(tool==="eraser"&&selectedBefore?.type==="image"){
   const l=selectedBefore;
   currentErase={diameter:size*2/l.w,pts:[erasePoint(l,p)]};
   l.erase.push(currentErase);redrawImage(l);drawing=true;drawingId=l.id;last=p;
  }else{
   // L'outil Remplir peut colorier Fond s'il est sélectionné.
   const l=captureDrawingLayer();
   drawingId=l.id;
   const ctx=l.surface.getContext("2d",{willReadFrequently:true});
   if(tool==="fill"){flood(ctx,p.x,p.y);drawing=false;render();return;}
   drawing=true;last=p;start=p;
   if(["line","rect","ellipse"].includes(tool))beforeShape=ctx.getImageData(0,0,W,H);
   else rasterLine(ctx,p,p,tool==="eraser");
  }
  try{canvas.setPointerCapture(e.pointerId);}catch(_){}
 }
 function onMove(e){
  if(!drawing)return;e.preventDefault();
  const l=layers.find(x=>x.id===drawingId);if(!l)return;
  const p=point(e);
  if(l.type==="image"){
   currentErase.pts.push(erasePoint(l,p));redrawImage(l);
  }else{
   const ctx=l.surface.getContext("2d",{willReadFrequently:true});
   if(["line","rect","ellipse"].includes(tool)){
    ctx.putImageData(beforeShape,0,0);ctx.save();
    ctx.strokeStyle=color;ctx.lineWidth=size;ctx.lineJoin="round";
    ctx.beginPath();
    if(tool==="line"){ctx.moveTo(start.x,start.y);ctx.lineTo(p.x,p.y);}
    else if(tool==="rect")ctx.rect(start.x,start.y,p.x-start.x,p.y-start.y);
    else ctx.ellipse((start.x+p.x)/2,(start.y+p.y)/2,Math.max(.5,Math.abs(p.x-start.x)/2),Math.max(.5,Math.abs(p.y-start.y)/2),0,0,Math.PI*2);
    ctx.stroke();ctx.restore();
   }else rasterLine(ctx,last,p,tool==="eraser");
  }
  last=p;
 }
 function onUp(e){
  if(!drawing)return;onMove(e);
  drawing=false;currentErase=null;beforeShape=null;drawingId=null;
  render();notice("Modification enregistrée · Annuler disponible.");
 }
 function imagePointerDown(e){
  const l=layers.find(item=>item.node===e.currentTarget);
  if(!l||tool!=="select"||!l.visible||(e.pointerType==="mouse"&&e.button!==0))return;
  e.preventDefault();e.stopPropagation();
  if(selected!==l.id)select(l.id);
  const resized=!!e.target.closest(".zp-image-resize");
  const startPos={x:e.clientX,y:e.clientY},initial={x:l.x,y:l.y,w:l.w,h:l.h};
  const r=canvasFrame.getBoundingClientRect(),sx=W/r.width,sy=H/r.height;
  const pid=e.pointerId;
  let changed=false;
  l.node.classList.add("zp-image-moving");
  try{l.node.setPointerCapture(pid);}catch(_){}
  function move(ev){
   if(ev.pointerId!==pid||!active)return;
   ev.preventDefault();
   const dx=(ev.clientX-startPos.x)*sx,dy=(ev.clientY-startPos.y)*sy;
   if(Math.abs(dx)+Math.abs(dy)<.5)return;
   if(!changed){record();changed=true;}
   if(resized){
    const d=Math.abs(dx)>=Math.abs(dy*l.aspect)?dx:dy*l.aspect;
    l.w=clamp(initial.w+d,l.baseW*.1,l.baseW*5);l.h=l.w/l.aspect;
   }else{
    l.x=clamp(initial.x+dx,-l.w+18,W-18);
    l.y=clamp(initial.y+dy,-l.h+18,H-18);
   }
   positionImage(l);
   if(l.id===selected&&l.type==="image")scaleValue.textContent=Math.round(l.w/l.baseW*100)+" %";
  }
  function finish(ev){
   if(ev.pointerId!==pid)return;
   l.node.classList.remove("zp-image-moving");
   window.removeEventListener("pointermove",move);
   window.removeEventListener("pointerup",finish);
   window.removeEventListener("pointercancel",finish);
   draggingCleanup=null;
   if(changed)render();
  }
  draggingCleanup=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",finish);window.removeEventListener("pointercancel",finish);};
  window.addEventListener("pointermove",move,{passive:false});
  window.addEventListener("pointerup",finish);
  window.addEventListener("pointercancel",finish);
 }
 function merged(){
  const output=document.createElement("canvas");output.width=W;output.height=H;
  const ctx=output.getContext("2d");
  layers.forEach(l=>{
   if(!l.visible)return;
   if(l.type==="raster")ctx.drawImage(l.surface,0,0);
   else ctx.drawImage(l.surface,l.x,l.y,l.w,l.h);
  });
  return output;
 }
 function download(){
  const a=document.createElement("a");
  a.href=merged().toDataURL("image/png");
  a.download="zebra-paint-"+new Date().toISOString().slice(0,10)+".png";
  document.body.append(a);a.click();a.remove();notice("PNG exporté · calques fusionnés pour le fichier.");
 }
 canvas.addEventListener("pointerdown",onDown);
 canvas.addEventListener("pointermove",onMove);
 canvas.addEventListener("pointerup",onUp);
 canvas.addEventListener("pointercancel",onUp);
 canvasFrame.addEventListener("pointerdown",e=>{if(tool==="select"&&(e.target===layerStage||e.target===canvasFrame))select(null);});
 function key(e){
  if(!active||!root.isConnected||!root.closest(".window")?.classList.contains("focused"))return;
  if(["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?redoAction():undo();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){e.preventDefault();redoAction();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"){e.preventDefault();download();}
 }
 document.addEventListener("keydown",key);
 bootLayers();choose("select");updateHistory();
 function dispose(){
  active=false;if(draggingCleanup)draggingCleanup();
  urls.forEach(url=>URL.revokeObjectURL(url));urls.clear();
  document.removeEventListener("keydown",key);
  canvas.removeEventListener("pointerdown",onDown);canvas.removeEventListener("pointermove",onMove);
  canvas.removeEventListener("pointerup",onUp);canvas.removeEventListener("pointercancel",onUp);
 }
 root._zebraDispose=dispose;return dispose;
}
window.ZebraPaint={mount};
}());