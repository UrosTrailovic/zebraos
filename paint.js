/* ZebraPaint 1.5 — sauvegarde automatique et calques fiables. */
(function(){
"use strict";
const UNDO_LIMIT=12,MAX_LAYERS=25,MAX_PIXELS=2300000;
const palette=["#000000","#ffffff","#808080","#c0c0c0","#800000","#ff0000","#808000","#ffff00","#008000","#00ff00","#008080","#00ffff","#000080","#0000ff","#800080","#ff00ff","#d68545","#f6c289","#eac6c6","#9faad9","#304d46","#5e9f72","#403765","#f7d65c"];
function el(tag,cls,text){const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;}
function btn(label,fn,cls="zp-button"){const x=el("button",cls,label);x.type="button";x.onclick=fn;return x;}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Les brouillons restent dans le navigateur, jamais dans le dépôt public.
const DRAFT_DB="ZebraPaintDrafts",DRAFT_STORE="projects";
let draftDBPromise=null;
const pendingDraftWrites=new Map();
function draftDB(){
 if(typeof indexedDB==="undefined")return Promise.reject(new Error("IndexedDB indisponible"));
 if(!draftDBPromise)draftDBPromise=new Promise((resolve,reject)=>{
  const req=indexedDB.open(DRAFT_DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(DRAFT_STORE))req.result.createObjectStore(DRAFT_STORE);};
  req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>{db.close();draftDBPromise=null;};resolve(db);};
  req.onerror=()=>reject(req.error||new Error("IndexedDB inaccessible"));
 }).catch(error=>{draftDBPromise=null;throw error;});
 return draftDBPromise;
}
function readDraft(key){
 // Ne pas rouvrir un brouillon avant la fin de la sauvegarde de la fenêtre précédente.
 const prior=pendingDraftWrites.get(key)||Promise.resolve();
 return prior.catch(()=>{}).then(()=>draftDB()).then(db=>new Promise((resolve,reject)=>{
  const req=db.transaction(DRAFT_STORE,"readonly").objectStore(DRAFT_STORE).get(key);
  req.onsuccess=()=>resolve(req.result||null);
  req.onerror=()=>reject(req.error||new Error("Lecture du brouillon impossible"));
 }));
}
function writeDraft(key,project){
 const prior=pendingDraftWrites.get(key)||Promise.resolve();
 const current=prior.catch(()=>{}).then(()=>draftDB()).then(db=>new Promise((resolve,reject)=>{
  const tx=db.transaction(DRAFT_STORE,"readwrite");
  tx.objectStore(DRAFT_STORE).put({project,updatedAt:Date.now()},key);
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||new Error("Écriture du brouillon impossible"));
  tx.onabort=()=>reject(tx.error||new Error("Enregistrement interrompu"));
 }));
 pendingDraftWrites.set(key,current);
 current.finally(()=>{if(pendingDraftWrites.get(key)===current)pendingDraftWrites.delete(key);}).catch(()=>{});
 return current;
}
const svgPaths={
 select:'<path d="m4 2 7 19 2-8 8-2z"/>',
 pencil:'<path d="m4 20 4-1 12-12-3-3L5 16zM15 6l3 3"/>',
 brush:'<path d="m14 6 4-4 4 4-5 5-4-4zM14 9 8 17"/><path d="M8 17c-1 4-6 5-6 5s0-5 4-6z"/>',
 eraser:'<path d="m3 15 10-11 8 8-9 9H7zM9 21h12M9 9l8 8"/>',
 line:'<path d="M3 21 21 3"/><circle cx="3" cy="21" r="1.4"/><circle cx="21" cy="3" r="1.4"/>',
 rect:'<rect x="3" y="5" width="18" height="14" rx="1"/>',
 ellipse:'<ellipse cx="12" cy="12" rx="9" ry="7"/>',
 text:'<path d="M3 5h18M12 5v15M8 20h8M3 5v4M21 5v4"/>',
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
 ["ellipse","Ellipse","Tracer un ovale"],
 ["text","Texte","Ajouter du texte éditable"]
];
function mount(root){
 if(root._zebraDispose)root._zebraDispose();
 root.replaceChildren();
 let W=640,H=400;
 let active=true,tool="select",color="#000000",size=6,selected=null,paintTarget=null,nextId=1;
 let layers=[],history=[],redo=[],drawing=false,drawingId=null,last=null,start=null,currentErase=null,draggingCleanup=null;
 let activePointer=null,dialog=null,vectorDraft=null;
 const draftKey="session:"+String(root.dataset.zebraSession||"zebra");
 let editVersion=0,lastSavedVersion=0,saveTimer=null,lastWrite=Promise.resolve();
 const registry=new Map(),urls=new Set();
 const panel=el("div","zp");
 const bar=el("div","zp-menu");
 const upload=el("input");upload.type="file";upload.accept="image/*";upload.hidden=true;
 const projectInput=el("input");projectInput.type="file";projectInput.accept=".zpaint,application/json";projectInput.hidden=true;
 const message=el("div","zp-status","640 × 400 · ZebraPaint");
 const saveIndicator=el("div","zp-autosave-status","Brouillon local : chargement…");
 saveIndicator.setAttribute("role","status");
 const canvasFrame=el("div","zp-canvas-frame");
 const layerStage=el("div","zp-layer-stage");
 const canvas=el("canvas","zp-canvas");
 canvas.width=W;canvas.height=H;canvas.setAttribute("aria-label","Zone de dessin ZebraPaint");
 const cursorRing=el("div","zp-brush-cursor");
 cursorRing.setAttribute("aria-hidden","true");
 canvasFrame.append(layerStage,canvas,cursorRing);
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
 const transformPanel=el("div","zp-transform-panel");
 function transformSlider(name,cls,min,max,step,initial){
  const row=el("label","zp-transform-row");
  const label=el("span","",name);
  const input=el("input",cls);input.type="range";input.min=String(min);input.max=String(max);input.step=String(step);input.value=String(initial);
  const output=el("output","",String(initial));
  row.append(label,input,output);transformPanel.append(row);
  return {input,output};
 }
 const rotateControl=transformSlider("ROTATION","zp-angle-input",-180,180,5,0);
 const skewControl=transformSlider("DÉFORMER","zp-skew-input",-45,45,5,0);
 const opacityControl=transformSlider("OPACITÉ","zp-opacity-input",0,100,5,100);
 const transformButtons=el("div","zp-transform-buttons");
 transformButtons.append(
   btn("↔ Miroir H",()=>flipSelected("flipX"),"zp-button"),
   btn("↕ Miroir V",()=>flipSelected("flipY"),"zp-button"),
   btn("⊕ Centrer",centerSelected,"zp-button"),
   btn("⟳ Réinit.",resetTransform,"zp-button"));
 transformPanel.append(transformButtons);
 const transformDetails=el("details","zp-transform-details");
 const transformSummary=el("summary","","↻ TRANSFORMER · ANGLE / INCLINAISON / OPACITÉ");
 transformDetails.append(transformSummary,transformPanel);
 panelLayers.append(panelHeader,layerList,scaleRow,transformDetails);
 const vectorDetails=el("details","zp-vector-details");
 vectorDetails.open=true;
 const vectorHeading=el("summary","","OBJET · FORME / TEXTE");
 const vectorBody=el("div","zp-vector-options");
 function vectorField(title,input){
  const row=el("label","zp-vector-field");row.append(el("span","",title),input);vectorBody.append(row);return input;
 }
 const vectorStroke=el("input","zp-vector-stroke");vectorStroke.type="color";vectorStroke.value="#000000";
 vectorField("Contour",vectorStroke);
 const vectorFill=el("input","zp-vector-fill-enabled");vectorFill.type="checkbox";
 vectorField("Remplissage",vectorFill);
 const vectorFillColor=el("input","zp-vector-fill-color");vectorFillColor.type="color";vectorFillColor.value="#ffffff";
 vectorField("Couleur du fond",vectorFillColor);
 const vectorWidth=el("input","zp-vector-width");vectorWidth.type="number";vectorWidth.min="1";vectorWidth.max="70";vectorWidth.value="4";
 vectorField("Contour (px)",vectorWidth);
 const vectorSize=el("input","zp-vector-font");vectorSize.type="number";vectorSize.min="8";vectorSize.max="200";vectorSize.value="32";
 vectorField("Texte (px)",vectorSize);
 const vectorText=el("textarea","zp-vector-text");vectorText.rows=2;vectorText.maxLength=600;
 vectorField("Texte",vectorText);
 const vectorSizeRow=el("div","zp-vector-dimensions");
 const objectWidth=el("input","zp-object-width");objectWidth.type="number";objectWidth.min="1";objectWidth.max="3200";
 const objectHeight=el("input","zp-object-height");objectHeight.type="number";objectHeight.min="1";objectHeight.max="3200";
 vectorSizeRow.append(el("span","","L × H"),objectWidth,objectHeight);vectorBody.append(vectorSizeRow);
 vectorDetails.append(vectorHeading,vectorBody);panelLayers.append(vectorDetails);
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
 brushSlider.oninput=()=>{size=Number(brushSlider.value);brushNumber.textContent=String(size);updateCursorFromLast();};
 brushWrap.append(brushSlider,brushNumber);options.append(brushWrap);
 const undoBtn=btn("↶ Annuler",undo),redoBtn=btn("↷ Rétablir",redoAction);
 const actions=el("div","zp-edits");actions.append(undoBtn,redoBtn);options.append(actions);
 const saveBtn=btn("💾 Enregistrer PNG",download);
 bar.append(btn("Nouveau",newDocument),btn("Format de la toile",openCanvasDialog),btn("＋ Importer photo",()=>upload.click()),
   btn("＋ Calque dessin",()=>addRaster(true)),saveBtn,btn("💾 Projet .zpaint",saveProject),
   btn("📂 Ouvrir projet",()=>projectInput.click()),upload,projectInput);
 const changeControls=el("div","zp-import-controls");
 changeControls.append(btn("✓ Terminer",()=>{select(null);choose("select");notice("Placement terminé : les calques restent modifiables.");},"zp-button zp-apply-image"),
   btn("× Supprimer",()=>removeLayer(selected),"zp-button"));
 bar.append(changeControls);
 panel.append(bar,body,panelLayers,options,message,saveIndicator);root.append(panel);

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
 function updateDimensions(){
  canvas.width=W;canvas.height=H;
  canvasFrame.style.width=W+"px";canvasFrame.style.height=H+"px";
  canvasFrame.style.setProperty("--zp-ratio",W+" / "+H);
  message.textContent=W+" × "+H+" · ZebraPaint";
 }
 function makeDialog(title,description,fields,done){
  if(dialog)dialog.remove();
  const shade=el("div","zp-dialog-shade");
  shade.setAttribute("role","presentation");
  dialog=el("div","zp-dialog");dialog.setAttribute("role","dialog");
  dialog.setAttribute("aria-modal","true");dialog.setAttribute("aria-label",title);
  dialog.append(el("strong","zp-dialog-title",title));
  if(description)dialog.append(el("p","zp-dialog-desc",description));
  const form=el("form","zp-dialog-form");
  const inputs=[];
  fields.forEach(f=>{
   const label=el("label","zp-dialog-field");
   label.append(el("span","",f.label));
   const input=el("input","zp-dialog-input");
   input.type=f.type||"text";input.value=String(f.value??"");
   if(f.min!=null)input.min=String(f.min);
   if(f.max!=null)input.max=String(f.max);
   if(f.maxLength)input.maxLength=f.maxLength;
   input.required=true;label.append(input);form.append(label);inputs.push(input);
  });
  const actions=el("div","zp-dialog-buttons");
  function close(){shade.remove();if(dialog===popup)dialog=null;}
  const popup=dialog;
  actions.append(btn("Annuler",close,"zp-button"));
  const accept=el("button","zp-button zp-dialog-confirm","Valider");
  accept.type="submit";actions.append(accept);form.append(actions);
  form.onsubmit=e=>{e.preventDefault();const values=inputs.map(x=>x.value);
   if(done(values)===false)return;
   close();
  };
  dialog.append(form);shade.append(dialog);panel.append(shade);
  shade.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();close();}});
  requestAnimationFrame(()=>inputs[0]?.focus());
 }
 function openCanvasDialog(){
  makeDialog("Format du plan de travail","Dimensions en pixels. Le dessin existant est conservé.",
   [{label:"Largeur",value:W,type:"number",min:64,max:2400},
    {label:"Hauteur",value:H,type:"number",min:64,max:2400}],values=>{
     const w=Number(values[0]),h=Number(values[1]);
     if(!Number.isInteger(w)||!Number.isInteger(h)||w<64||h<64||w>2400||h>2400||w*h>MAX_PIXELS){
      notice("Format invalide : dimensions de 64 à 2400 px et maximum 2,3 mégapixels.");return false;
     }
     if(w===W&&h===H)return true;
     record();
     resizeDocument(w,h);
     render();notice("Nouveau format : "+W+" × "+H+" pixels.");
     return true;
   });
 }
 function resizeDocument(w,h,clear=false){
  if(!clear)layers.forEach(l=>{
   if(l.type!=="raster")return;
   const copy=document.createElement("canvas");
   copy.width=l.surface.width;copy.height=l.surface.height;
   copy.getContext("2d").drawImage(l.surface,0,0);
   l.surface.width=w;l.surface.height=h;
   const ctx=l.surface.getContext("2d",{willReadFrequently:true});
   if(l.background){ctx.fillStyle="#ffffff";ctx.fillRect(0,0,w,h);}
   ctx.drawImage(copy,0,0);
  });
  W=w;H=h;updateDimensions();
 }
 function cursorVisible(){return ["pencil","brush","eraser"].includes(tool);}
 let cursorPoint=null;
 function updateCursorFromLast(){
  if(!cursorPoint||!cursorVisible())return;
  const r=canvasFrame.getBoundingClientRect();
  const diameter=(tool==="eraser"?2:1)*size*r.width/W;
  cursorRing.style.width=Math.max(1,diameter)+"px";
  cursorRing.style.height=Math.max(1,diameter)+"px";
  cursorRing.style.left=(cursorPoint.x/W*100)+"%";
  cursorRing.style.top=(cursorPoint.y/H*100)+"%";
  cursorRing.hidden=false;
 }
 function hoverCursor(e){
  if(!active||!cursorVisible()||e.pointerType==="touch"){cursorRing.hidden=true;return;}
  const p=point(e);cursorPoint=p;
  cursorRing.hidden=p.x<0||p.y<0||p.x>W||p.y>H;
  if(!cursorRing.hidden)updateCursorFromLast();
 }
 function exportName(ext,save){
  makeDialog("Enregistrer "+ext.toUpperCase(),"Nom du fichier",
   [{label:"Nom",value:"zebra-paint-"+new Date().toISOString().slice(0,10),maxLength:100}],values=>{
    let name=values[0].trim().replace(/[\\/:*?"<>|]/g,"_").replace(/[. ]+$/g,"");
    name=name.replace(/\.(?:png|zpaint)$/i,"");
    if(!name){notice("Saisis un nom de fichier.");return false;}
    save(name+"."+ext);return true;
   });
 }
 updateDimensions();
 function scheduleDraft(){
  editVersion++;
  saveIndicator.textContent="Brouillon modifié · sauvegarde automatique…";
  if(saveTimer!==null)clearTimeout(saveTimer);
  saveTimer=setTimeout(flushDraft,950);
 }
 function flushDraft(){
  if(saveTimer!==null){clearTimeout(saveTimer);saveTimer=null;}
  if(editVersion===lastSavedVersion)return lastWrite;
  let project;
  try{project=serializeProject();}
  catch(error){if(active)saveIndicator.textContent="Sauvegarde impossible : "+error.message;return lastWrite;}
  const revision=editVersion;
  if(active)saveIndicator.textContent="Enregistrement du brouillon…";
  // Les écritures restent dans l'ordre si la fenêtre se ferme puis se rouvre.
  lastWrite=lastWrite.catch(()=>{}).then(()=>writeDraft(draftKey,project));
  lastWrite.then(()=>{
   lastSavedVersion=Math.max(lastSavedVersion,revision);
   if(active&&editVersion===revision)saveIndicator.textContent="Brouillon enregistré sur cet appareil";
  }).catch(error=>{
   if(active)saveIndicator.textContent="Brouillon non enregistré : "+error.message+" · exporte en .zpaint";
  });
  return lastWrite;
 }
 function setColor(v){color=v;currentColor.style.background=v;pick.value=v;}
 function choose(t){
  tool=t;
  Object.keys(toolButtons).forEach(id=>toolButtons[id].classList.toggle("selected",id===t));
  canvasFrame.classList.toggle("zp-select-mode",t==="select");
  canvas.style.cursor=t==="picker"?"copy":t==="fill"?"cell":t==="select"?"default":"none";
  cursorRing.hidden=true;
  if(cursorVisible())updateCursorFromLast();
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
  const layer={id:nextId++,type:"raster",name,surface,node,visible:true,opacity:1,locked:false};
  registry.set(layer.id,layer);return layer;
 }
 function createVector(kind,x,y,w=1,h=1){
  const node=el("div","zp-imported-image zp-vector-object");
  const surface=document.createElement("canvas");surface.className="zp-image-visual";
  const handle=btn("⤡",()=>{},"zp-image-resize");
  handle.title="Redimensionner la forme";handle.setAttribute("aria-label","Redimensionner la forme");
  const turn=btn("↻",()=>{},"zp-image-rotate");
  turn.title="Tourner la forme";turn.setAttribute("aria-label","Tourner la forme");
  node.append(surface,handle,turn);
  const label=kind==="rect"?"Rectangle":kind==="ellipse"?"Ellipse":kind==="line"?"Ligne":"Texte";
  const l={id:nextId++,type:"vector",kind,name:label,x,y,w:Math.max(1,w),h:Math.max(1,h),
   surface,node,visible:true,locked:false,opacity:1,background:false,
   stroke:color,fill:null,strokeWidth:Math.max(1,size),text:kind==="text"?"Texte":"",
   fontSize:Math.max(12,size*4),fontFamily:"Arial",
   reverse:false,angle:0,skew:0,flipX:1,flipY:1};
  registry.set(l.id,l);node.addEventListener("pointerdown",imagePointerDown);
  redrawVector(l);return l;
 }
 function redrawVector(l){
  if(l.type!=="vector")return;
  const pw=clamp(Math.ceil(Math.abs(l.w)),1,3200),ph=clamp(Math.ceil(Math.abs(l.h)),1,3200);
  if(l.surface.width!==pw)l.surface.width=pw;
  if(l.surface.height!==ph)l.surface.height=ph;
  const ctx=l.surface.getContext("2d");ctx.clearRect(0,0,pw,ph);
  const thickness=clamp(Number(l.strokeWidth)||1,1,70),inset=thickness/2;
  ctx.strokeStyle=l.stroke||"#000000";ctx.fillStyle=l.fill||"transparent";
  ctx.lineWidth=thickness;ctx.lineJoin="round";
  if(l.kind==="rect"){
   const x=Math.min(inset,pw/2),y=Math.min(inset,ph/2);
   if(l.fill)ctx.fillRect(0,0,pw,ph);
   ctx.strokeRect(x,y,Math.max(0,pw-2*x),Math.max(0,ph-2*y));
  }else if(l.kind==="ellipse"){
   ctx.beginPath();ctx.ellipse(pw/2,ph/2,Math.max(.1,pw/2-inset),Math.max(.1,ph/2-inset),0,0,Math.PI*2);
   if(l.fill)ctx.fill();ctx.stroke();
  }else if(l.kind==="line"){
   ctx.beginPath();
   if(l.reverse){ctx.moveTo(pw-inset,inset);ctx.lineTo(inset,ph-inset);}
   else{ctx.moveTo(inset,inset);ctx.lineTo(pw-inset,ph-inset);}
   ctx.lineCap="round";ctx.stroke();
  }else if(l.kind==="text"){
   const font=clamp(Math.round(l.fontSize||32),8,200);
   ctx.fillStyle=l.stroke||"#000000";ctx.font=font+"px Arial, sans-serif";ctx.textBaseline="top";
   (l.text||"").split("\n").slice(0,12).forEach((line,i)=>{
    ctx.fillText(line,0,i*font*1.25,Math.max(1,pw));
   });
  }
 }
 function vectorChange(field,value){
  const l=getSelected();if(!l||l.type!=="vector"||l.locked||l[field]===value)return;
  record();l[field]=value;
  if(field==="w"||field==="h")l[field]=clamp(Number(value),1,3200);
  redrawVector(l);render();notice("Objet modifié : "+l.name);
 }
 for(const [input,field,parse] of [
  [vectorStroke,"stroke",x=>x],
  [vectorFill,"fill",x=>x?vectorFillColor.value:null],
  [vectorFillColor,"fill",x=>vectorFill.checked?x:null],
  [vectorWidth,"strokeWidth",x=>clamp(Number(x)||1,1,70)],
  [vectorSize,"fontSize",x=>clamp(Number(x)||32,8,200)],
  [objectWidth,"w",x=>clamp(Number(x)||1,1,3200)],
  [objectHeight,"h",x=>clamp(Number(x)||1,1,3200)]
 ])input.addEventListener("change",()=>vectorChange(field,parse(input.type==="checkbox"?input.checked:input.value)));
 let textEditRecorded=false;
 vectorText.addEventListener("focus",()=>{textEditRecorded=false;});
 vectorText.addEventListener("input",()=>{
  const l=getSelected();if(!l||l.type!=="vector"||l.kind!=="text"||l.locked)return;
  if(!textEditRecorded){record();textEditRecorded=true;}
  l.text=vectorText.value;redrawVector(l);scheduleDraft();
 });
 vectorText.addEventListener("blur",()=>{textEditRecorded=false;if(active)render();});
 function bootLayers(){
  const background=createRaster("Fond","#ffffff"),drawingLayer=createRaster("Dessin 1");
  background.background=true;
  layers=[background,drawingLayer];selected=drawingLayer.id;paintTarget=drawingLayer.id;
 }
 function newDocument(){
  if(!confirm("Créer un nouveau dessin et effacer les calques actuels ?"))return;
  record();bootLayers();render();choose("select");notice("Nouveau dessin "+W+" × "+H+".");
 }
 function addRaster(userTriggered,above){
  if(layers.length>=MAX_LAYERS){notice("Maximum de "+MAX_LAYERS+" calques.");return null;}
  if(userTriggered)record();
  const layer=createRaster("Dessin "+nextId);
  const index=above==null?layers.findIndex(l=>l.id===selected):above;
  layers.splice(index<0?layers.length:index+1,0,layer);
  selected=layer.id;paintTarget=layer.id;
  render();
  if(userTriggered)notice("Nouveau calque de dessin : "+layer.name);
  return layer;
 }
 function cloneStrokes(strokes){return strokes.map(s=>({diameter:s.diameter,pts:s.pts.map(p=>p.slice())}));}
 function snapshot(){
  return {width:W,height:H,sel:selected,paint:paintTarget,
   list:layers.map(l=>({id:l.id,type:l.type,name:l.name,background:!!l.background,visible:l.visible,locked:!!l.locked,opacity:l.opacity??1,
     x:l.x,y:l.y,w:l.w,h:l.h,angle:l.angle||0,skew:l.skew||0,flipX:l.flipX||1,flipY:l.flipY||1,
     erase:l.type==="image"?cloneStrokes(l.erase):null,
     kind:l.kind,stroke:l.stroke,fill:l.fill,strokeWidth:l.strokeWidth,text:l.text,
     fontSize:l.fontSize,fontFamily:l.fontFamily,reverse:!!l.reverse,
     pixels:l.type==="raster"?l.surface.getContext("2d").getImageData(0,0,W,H):null}))};
 }
 function record(){
  history.push(snapshot());if(history.length>UNDO_LIMIT)history.shift();
  redo=[];updateHistory();scheduleDraft();
 }
 function updateHistory(){undoBtn.disabled=!history.length;redoBtn.disabled=!redo.length;}
 function restore(state){
  if(state.width!==W||state.height!==H)resizeDocument(state.width,state.height,true);
  layers=state.list.map(d=>{
   const l=registry.get(d.id);
   l.visible=d.visible;l.name=d.name;l.background=!!d.background;l.locked=!!d.locked;l.opacity=d.opacity??1;
   if(l.type==="raster"){
    if(l.surface.width!==W)l.surface.width=W;
    if(l.surface.height!==H)l.surface.height=H;
    l.surface.getContext("2d").putImageData(d.pixels,0,0);
   }else{
    l.x=d.x;l.y=d.y;l.w=d.w;l.h=d.h;l.angle=d.angle||0;l.skew=d.skew||0;
    l.flipX=d.flipX||1;l.flipY=d.flipY||1;
    if(l.type==="image"){l.erase=cloneStrokes(d.erase||[]);redrawImage(l);}
    else{
     l.kind=d.kind;l.stroke=d.stroke;l.fill=d.fill;l.strokeWidth=d.strokeWidth;
     l.text=d.text;l.fontSize=d.fontSize;l.fontFamily=d.fontFamily;l.reverse=!!d.reverse;
     redrawVector(l);
    }
   }
   return l;
  });
  selected=layers.some(l=>l.id===state.sel)?state.sel:null;
  paintTarget=layers.some(l=>l.id===state.paint&&l.type==="raster")?state.paint:null;
  render();updateHistory();
 }
 function undo(){if(!history.length)return;redo.push(snapshot());restore(history.pop());scheduleDraft();notice("Annulé.");}
 function redoAction(){if(!redo.length)return;history.push(snapshot());restore(redo.pop());scheduleDraft();notice("Rétabli.");}
 function getSelected(){return layers.find(l=>l.id===selected)||null;}
 function select(id){
  selected=layers.some(l=>l.id===id)?id:null;
  if(getSelected()?.type==="raster")paintTarget=selected;
  render();
  const layer=getSelected();
  if(layer)notice(layer.type==="image"?"Photo sélectionnée · glisser ou redimensionner / gomme":
   layer.type==="vector"?"Objet sélectionné · déplacer, redimensionner ou modifier ses propriétés":"Calque dessin sélectionné · peinture / remplissage");
 }
 function removeLayer(id){
  if(layers.length<=1){notice("Il faut conserver au moins un calque.");return;}
  const i=layers.findIndex(l=>l.id===id);if(i<0)return;
  record();layers.splice(i,1);selected=layers[Math.max(0,i-1)].id;
  if(paintTarget===id)paintTarget=null;render();
  notice("Calque supprimé. Annuler pour restaurer.");
 }
 function moveLayer(id,dir){
  const i=layers.findIndex(l=>l.id===id),j=i+dir;if(i<0||j<0||j>=layers.length)return;
  // Le Fond opaque reste derrière tous les calques : une photo ne peut
  // plus disparaître sous le blanc en descendant dans la pile.
  if(layers[0]?.background&&(i===0||j===0)){
   notice("Le Fond reste derrière les images et les dessins.");return;
  }
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
  else if(layer.type==="vector")c.drawImage(layer.surface,0,0,layer.surface.width,layer.surface.height,2,2,32,26);
  else c.drawImage(layer.surface,0,0,layer.surface.width,layer.surface.height,0,0,36,30);
  return thumb;
 }
 function render(){
  layerStage.replaceChildren(...layers.map(l=>l.node));
  layers.forEach((l,index)=>{
   l.node.style.zIndex=String(index+1);
   l.node.hidden=!l.visible;
   l.node.style.opacity=String(l.opacity??1);
   if(l.type!=="raster")positionImage(l);
  });
  panelTitle.textContent="CALQUES · "+layers.length;
  changeControls.hidden=!getSelected();
  const chosen=getSelected();
  const image=chosen?.type==="image"?chosen:null;
  const vector=chosen?.type==="vector"?chosen:null;
  const movable=image||vector;
  scaleRow.hidden=!image;
  transformDetails.hidden=!chosen;
  vectorDetails.hidden=!vector;
  transformSummary.textContent=movable?"↻ TRANSFORMER · ANGLE / DÉFORMER / OPACITÉ":"◌ OPACITÉ DU CALQUE";
  rotateControl.input.parentNode.hidden=!movable;
  skewControl.input.parentNode.hidden=!movable;
  if(vector){
   vectorHeading.textContent=vector.kind==="text"?"OBJET · TEXTE":"OBJET · FORME";
   vectorStroke.value=vector.stroke||"#000000";
   vectorFill.checked=!!vector.fill;
   vectorFillColor.value=vector.fill||"#ffffff";
   vectorFillColor.disabled=!vector.fill;
   vectorWidth.value=String(vector.strokeWidth||1);
   vectorSize.value=String(vector.fontSize||32);
   vectorText.value=vector.text||"";
   vectorText.parentNode.hidden=vector.kind!=="text";
   vectorSize.parentNode.hidden=vector.kind!=="text";
   vectorFill.parentNode.hidden=["text","line"].includes(vector.kind);
   vectorFillColor.parentNode.hidden=["text","line"].includes(vector.kind);
   vectorWidth.parentNode.hidden=vector.kind==="text";
   objectWidth.value=String(Math.round(vector.w));
   objectHeight.value=String(Math.round(vector.h));
   [vectorStroke,vectorFill,vectorFillColor,vectorWidth,vectorSize,vectorText,objectWidth,objectHeight]
    .forEach(input=>{input.disabled=!!vector.locked;});
   vectorFillColor.disabled=!!vector.locked||!vector.fill;
  }
  if(movable){
   rotateControl.input.value=String(movable.angle||0);
   rotateControl.output.textContent=(movable.angle||0)+"°";
   skewControl.input.value=String(movable.skew||0);
   skewControl.output.textContent=(movable.skew||0)+"°";
  }
  if(image){
   const pct=Math.round(image.w/image.baseW*100);
   scale.value=String(clamp(pct,10,500));scaleValue.textContent=pct+" %";
   rotateControl.input.value=String(image.angle||0);rotateControl.output.textContent=(image.angle||0)+"°";
   skewControl.input.value=String(image.skew||0);skewControl.output.textContent=(image.skew||0)+"°";
  }
  if(getSelected()){
   opacityControl.input.value=String(Math.round((getSelected().opacity??1)*100));
   opacityControl.output.textContent=opacityControl.input.value+" %";
  }
  transformButtons.hidden=!movable;
  layerList.replaceChildren();
  layers.slice().reverse().forEach(l=>{
   const row=el("div","zp-layer-entry"+(l.id===selected?" active":"")+(l.visible?"":" hidden-layer")+(l.id===paintTarget?" zp-paint-target":""));
   row.dataset.layerId=String(l.id);
   const b=btn("",()=>{select(l.id);if(l.type!=="raster")choose("select");},"zp-layer-choice");
   b.append(previewThumb(l),el("span","zp-layer-name",(l.type==="image"?"▣ ":l.type==="vector"?"◇ ":"✎ ")+l.name+(l.id===paintTarget?" ●":"")));
   b.title="Sélectionner "+l.name+(l.id===paintTarget?" (calque de dessin actif)":"");
   const actions=el("div","zp-layer-buttons");
   const eye=btn(l.visible?"◉":"○",()=>visibility(l.id),"zp-layer-action");eye.title=l.visible?"Masquer":"Afficher";eye.setAttribute("aria-label",eye.title);
   const up=btn("↑",()=>moveLayer(l.id,1),"zp-layer-action");
   up.disabled=layers[layers.length-1]===l||!!l.background;
   up.title="Devant";up.setAttribute("aria-label","Monter le calque");
   const down=btn("↓",()=>moveLayer(l.id,-1),"zp-layer-action");
   down.disabled=layers[0]===l||!!(layers[0]?.background&&layers[1]===l);
   down.title="Derrière";down.setAttribute("aria-label","Descendre le calque");
   const lock=btn(l.locked?"🔒":"♢",()=>toggleLock(l.id),"zp-layer-action");
   lock.title=l.locked?"Déverrouiller":"Verrouiller";lock.setAttribute("aria-label",lock.title);
   const copy=btn("⧉",()=>duplicateLayer(l.id),"zp-layer-action");
   copy.title="Dupliquer";copy.setAttribute("aria-label","Dupliquer le calque");
   const rename=btn("✎",()=>renameLayer(l.id),"zp-layer-action");
   rename.title="Renommer";rename.setAttribute("aria-label","Renommer le calque");
   const del=btn("×",()=>removeLayer(l.id),"zp-layer-action zp-layer-remove");del.title="Supprimer";del.setAttribute("aria-label","Supprimer le calque");
   actions.append(eye,up,down,lock,copy,rename,del);row.append(b,actions);layerList.append(row);
  });
 }
 function positionImage(l){
  l.node.style.left=l.x/W*100+"%";l.node.style.top=l.y/H*100+"%";
  l.node.style.width=l.w/W*100+"%";l.node.style.height=l.h/H*100+"%";
  l.node.style.transform="rotate("+(l.angle||0)+"deg) skewX("+(l.skew||0)+"deg) scale("+(l.flipX||1)+","+(l.flipY||1)+")";
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
 function editTransform(field,value){
  const l=getSelected();if(!l||l.locked)return;
  if(field!=="opacity"&&l.type!=="image"&&l.type!=="vector")return;
  if(Math.abs((l[field]??(field==="opacity"?1:0))-value)<.0001)return;
  record();l[field]=value;render();
  notice("Transformation : "+l.name);
 }
 rotateControl.input.oninput=()=>{rotateControl.output.textContent=rotateControl.input.value+"°";};
 rotateControl.input.onchange=()=>editTransform("angle",Number(rotateControl.input.value));
 skewControl.input.oninput=()=>{skewControl.output.textContent=skewControl.input.value+"°";};
 skewControl.input.onchange=()=>editTransform("skew",Number(skewControl.input.value));
 opacityControl.input.oninput=()=>{opacityControl.output.textContent=opacityControl.input.value+" %";};
 opacityControl.input.onchange=()=>editTransform("opacity",Number(opacityControl.input.value)/100);
 function flipSelected(prop){
  const l=getSelected();if(!l||(l.type!=="image"&&l.type!=="vector")||l.locked)return;
  record();l[prop]=(l[prop]||1)*-1;render();
  notice("Image retournée.");
 }
 function centerSelected(){
  const l=getSelected();if(!l||(l.type!=="image"&&l.type!=="vector")||l.locked)return;
  record();l.x=(W-l.w)/2;l.y=(H-l.h)/2;render();notice("Image centrée.");
 }
 function resetTransform(){
  const l=getSelected();if(!l||(l.type!=="image"&&l.type!=="vector")||l.locked)return;
  record();l.angle=0;l.skew=0;l.flipX=1;l.flipY=1;l.opacity=1;render();
  notice("Transformations réinitialisées.");
 }
 function toggleLock(id){
  const l=layers.find(x=>x.id===id);if(!l)return;
  record();l.locked=!l.locked;render();notice(l.locked?"Calque verrouillé.":"Calque déverrouillé.");
 }
 function renameLayer(id){
  const l=layers.find(x=>x.id===id);if(!l)return;
  const name=prompt("Nom du calque :",l.name);
  if(name===null||!name.trim()||name.trim()===l.name)return;
  record();l.name=name.trim().slice(0,70);render();
 }
 function duplicateLayer(id){
  const l=layers.find(x=>x.id===id);if(!l||layers.length>=MAX_LAYERS)return;
  record();
  let copy;
  if(l.type==="raster"){
   copy=createRaster(l.name+" copie");
   copy.surface.getContext("2d").drawImage(l.surface,0,0);
  }else{
   const node=el("div","zp-imported-image");
   const surface=document.createElement("canvas");
   surface.width=l.surface.width;surface.height=l.surface.height;
   surface.getContext("2d").drawImage(l.surface,0,0);
   surface.className="zp-image-visual";
   const handle=btn("⤡",()=>{},"zp-image-resize");
   handle.title="Redimensionner";handle.setAttribute("aria-label","Redimensionner l’image");
   const turn=btn("↻",()=>{},"zp-image-rotate");turn.title="Tourner librement";turn.setAttribute("aria-label","Tourner l’image");
   node.append(surface,handle,turn);
   if(l.type==="vector"){
    copy=createVector(l.kind,l.x+15,l.y+15,l.w,l.h);
    copy.name=l.name+" copie";copy.stroke=l.stroke;copy.fill=l.fill;
    copy.strokeWidth=l.strokeWidth;copy.text=l.text;copy.fontSize=l.fontSize;
    copy.fontFamily=l.fontFamily;copy.reverse=l.reverse;redrawVector(copy);
   }else{
    copy={id:nextId++,type:"image",name:l.name+" copie",img:l.img,url:l.url,
     surface,node,x:l.x+15,y:l.y+15,w:l.w,h:l.h,
     baseW:l.baseW,aspect:l.aspect,erase:cloneStrokes(l.erase),visible:true};
    node.addEventListener("pointerdown",imagePointerDown);registry.set(copy.id,copy);
   }
  }
  copy.opacity=l.opacity??1;copy.locked=false;copy.background=false;
  if(copy.type!=="raster"){copy.angle=l.angle||0;copy.skew=l.skew||0;copy.flipX=l.flipX||1;copy.flipY=l.flipY||1;}
  const index=layers.findIndex(x=>x.id===id);
  layers.splice(index+1,0,copy);
  selected=copy.id;if(copy.type==="raster")paintTarget=copy.id;
  render();notice("Calque dupliqué.");
 }

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
   const turn=btn("↻",()=>{},"zp-image-rotate");turn.title="Tourner librement";turn.setAttribute("aria-label","Tourner l’image");
   container.append(surface,handle,turn);
   const l={id:nextId++,type:"image",name:file.name.slice(0,65),img,url,
    surface,node:container,x:(W-w)/2,y:(H-h)/2,w,h,baseW:w,aspect:w/h,erase:[],
    visible:true,locked:false,opacity:1,angle:0,skew:0,flipX:1,flipY:1};
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
  const current=getSelected();
  if(current&&current.type==="raster"&&!current.locked){
   if(!current.visible){current.visible=true;render();}
   paintTarget=current.id;return current;
  }
  // Photo active : prendre un calque DESSIN au-dessus, sinon en créer un.
  const lower=layers.findIndex(l=>l.id===selected);
  const above=layers.slice(lower+1).find(l=>l.type==="raster"&&l.visible&&!l.locked);
  if(above){paintTarget=above.id;return above;}
  if(!current){
   const previous=layers.find(l=>l.id===paintTarget&&l.type==="raster"&&l.visible&&!l.locked);
   if(previous)return previous;
  }
  return addRaster(false,Math.max(0,lower));
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
  // Coordonnées inversées de rotate + skewX + flip : la gomme suit
  // les pixels de l'image, même lorsqu'elle est transformée.
  const dx=p.x-l.x-l.w/2,dy=p.y-l.y-l.h/2;
  const radians=(l.angle||0)*Math.PI/180,c=Math.cos(radians),sn=Math.sin(radians);
  const y=-sn*dx+c*dy,x=c*dx+sn*dy-Math.tan((l.skew||0)*Math.PI/180)*y;
  return [(x/(l.flipX||1)+l.w/2)/l.w,(y/(l.flipY||1)+l.h/2)/l.h];
 }
 function onDown(e){
  if(!active||drawing||(e.pointerType==="mouse"&&e.button!==0))return;
  if(e.target.closest(".zp-dialog-shade"))return;
  if(tool==="select"){if(e.target===canvas||e.target===layerStage||e.target===canvasFrame)select(null);return;}
  e.preventDefault();
  const p=point(e);
  if(tool==="picker"){
   if(p.x<0||p.y<0||p.x>=W||p.y>=H)return;
   const px=merged().getContext("2d").getImageData(Math.floor(p.x),Math.floor(p.y),1,1).data;
   setColor("#"+[px[0],px[1],px[2]].map(n=>n.toString(16).padStart(2,"0")).join(""));
   notice("Couleur récupérée.");return;
  }
  const before=getSelected();
  if(before?.locked){notice("Calque verrouillé · déverrouille-le avant de modifier.");return;}
  if(["line","rect","ellipse","text"].includes(tool)){
   if(layers.length>=MAX_LAYERS){notice("Maximum de "+MAX_LAYERS+" calques.");return;}
   record();
   const kind=tool;
   const l=createVector(kind,p.x,p.y,kind==="text"?160:1,kind==="text"?55:1);
   const index=layers.findIndex(x=>x.id===selected);
   layers.splice(index<0?layers.length:index+1,0,l);
   selected=l.id;drawingId=l.id;start=p;
   render();
   if(kind==="text"){
    choose("select");
    vectorDetails.open=true;
    requestAnimationFrame(()=>{vectorText.focus();vectorText.select();});
    notice("Texte ajouté. Modifie le contenu dans OBJET · TEXTE.");return;
   }
   drawing=true;
  }else if(tool==="eraser"&&before?.type==="image"){
   const l=before;record();
   currentErase={diameter:size*2/l.w,pts:[erasePoint(l,p)]};
   l.erase.push(currentErase);redrawImage(l);
   drawing=true;drawingId=l.id;last=p;
  }else{
   record();
   const l=captureDrawingLayer();
   if(!l)return;
   drawingId=l.id;
   const ctx=l.surface.getContext("2d",{willReadFrequently:true});
   if(tool==="fill"){
    if(p.x>=0&&p.x<W&&p.y>=0&&p.y<H)flood(ctx,p.x,p.y);
    drawing=false;render();return;
   }
   drawing=true;last=p;start=p;
   rasterLine(ctx,p,p,tool==="eraser");
  }
  activePointer=e.pointerId;
  window.addEventListener("pointermove",onMove,{passive:false});
  window.addEventListener("pointerup",onUp);
  window.addEventListener("pointercancel",onUp);
 }
 function onMove(e){
  if(!drawing||activePointer!==e.pointerId)return;
  if(e.cancelable)e.preventDefault();
  const l=layers.find(x=>x.id===drawingId);if(!l)return;
  const p=point(e);
  if(l.type==="vector"){
   l.x=Math.min(start.x,p.x);l.y=Math.min(start.y,p.y);
   l.w=Math.max(1,Math.abs(p.x-start.x));
   l.h=Math.max(1,Math.abs(p.y-start.y));
   l.reverse=(p.x-start.x)*(p.y-start.y)<0;
   redrawVector(l);positionImage(l);
  }else if(l.type==="image"){
   currentErase.pts.push(erasePoint(l,p));redrawImage(l);
  }else{
   rasterLine(l.surface.getContext("2d",{willReadFrequently:true}),last,p,tool==="eraser");
  }
  last=p;hoverCursor(e);
 }
 function onUp(e){
  if(!drawing||activePointer!==e.pointerId)return;
  if(e.type!=="pointercancel")onMove(e);
  window.removeEventListener("pointermove",onMove);
  window.removeEventListener("pointerup",onUp);
  window.removeEventListener("pointercancel",onUp);
  const wasVector=layers.find(x=>x.id===drawingId)?.type==="vector";
  drawing=false;activePointer=null;currentErase=null;drawingId=null;
  render();
  scheduleDraft();
  if(wasVector){choose("select");vectorDetails.open=true;}
  notice(wasVector?"Forme créée · sélectionne-la pour modifier les dimensions et le style.":"Modification enregistrée · Annuler disponible.");
 }
 function imagePointerDown(e){
  const l=layers.find(item=>item.node===e.currentTarget);
  if(!l||tool!=="select"||!l.visible||l.locked||(e.pointerType==="mouse"&&e.button!==0))return;
  e.preventDefault();e.stopPropagation();
  if(selected!==l.id)select(l.id);
  const resized=!!e.target.closest(".zp-image-resize");
  const rotating=!!e.target.closest(".zp-image-rotate");
  const startPos={x:e.clientX,y:e.clientY},initial={x:l.x,y:l.y,w:l.w,h:l.h,angle:l.angle||0};
  const r=canvasFrame.getBoundingClientRect(),sx=W/r.width,sy=H/r.height;
  const cx=r.left+(l.x+l.w/2)/W*r.width,cy=r.top+(l.y+l.h/2)/H*r.height;
  const startAngle=Math.atan2(e.clientY-cy,e.clientX-cx);
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
   if(rotating){
    const angle=(Math.atan2(ev.clientY-cy,ev.clientX-cx)-startAngle)*180/Math.PI;
    const raw=initial.angle+angle;
    l.angle=((raw+540)%360)-180;
    if(ev.shiftKey)l.angle=Math.round(l.angle/15)*15;
   }else if(resized){
    if(l.type==="vector"){
     l.w=clamp(initial.w+dx,1,3200);
     l.h=clamp(initial.h+dy,1,3200);
     redrawVector(l);
    }else{
     const d=Math.abs(dx)>=Math.abs(dy*l.aspect)?dx:dy*l.aspect;
     l.w=clamp(initial.w+d,l.baseW*.1,l.baseW*5);l.h=l.w/l.aspect;
    }
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
   if(changed){render();scheduleDraft();}
  }
  draggingCleanup=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",finish);window.removeEventListener("pointercancel",finish);};
  window.addEventListener("pointermove",move,{passive:false});
  window.addEventListener("pointerup",finish);
  window.addEventListener("pointercancel",finish);
 }
 function merged(){
  // EXPORT = même pile que le plan de travail, dans le même ordre.
  // Images importées incluses, même après les transformations.
  const output=document.createElement("canvas");output.width=W;output.height=H;
  const ctx=output.getContext("2d");
  layers.forEach(l=>{
   if(!l.visible)return;
   ctx.save();ctx.globalAlpha=l.opacity??1;
   if(l.type==="raster")ctx.drawImage(l.surface,0,0);
   else{
    ctx.translate(l.x+l.w/2,l.y+l.h/2);
    ctx.rotate((l.angle||0)*Math.PI/180);
    ctx.transform(1,0,Math.tan((l.skew||0)*Math.PI/180),1,0,0);
    ctx.scale(l.flipX||1,l.flipY||1);
    ctx.drawImage(l.surface,-l.w/2,-l.h/2,l.w,l.h);
   }
   ctx.restore();
  });
  return output;
 }
 /* Format ZebraPaint : image raster par calque + métadonnées.
    Sauvegarde uniquement sur l'appareil de l'utilisateur. */
 function serializeProject(){
  return {format:"zebrapaint",version:2,width:W,height:H,
   layers:layers.map(l=>({
    type:l.type,name:l.name,background:!!l.background,visible:l.visible,
    locked:!!l.locked,opacity:l.opacity??1,
    x:l.x,y:l.y,w:l.w,h:l.h,baseW:l.baseW,aspect:l.aspect,
    angle:l.angle||0,skew:l.skew||0,flipX:l.flipX||1,flipY:l.flipY||1,
    kind:l.kind,stroke:l.stroke,fill:l.fill,strokeWidth:l.strokeWidth,
    text:l.text,fontSize:l.fontSize,fontFamily:l.fontFamily,reverse:!!l.reverse,
    image:l.type==="vector"?null:l.surface.toDataURL("image/png")
   }))};
 }
 function saveProject(){
  exportName("zpaint",name=>{
   try{
    const encoded=JSON.stringify(serializeProject());
    const url=URL.createObjectURL(new Blob([encoded],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download=name;
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
    notice("Projet "+name+" enregistré · "+layers.length+" calques rééditables.");
   }catch(err){notice("Impossible d'enregistrer le projet : "+err.message);}
  });
 }
 async function loadProject(file,fromDraft=false){
  if(!file)return false;
  const revisionAtStart=editVersion;
  if(!fromDraft&&file.size>35*1024*1024){notice("Projet trop volumineux (>35 Mo).");return false;}
  try{
   const data=JSON.parse(await file.text());
   if(data.format!=="zebrapaint"||![1,2].includes(data.version)
      ||!Number.isInteger(data.width)||!Number.isInteger(data.height)
      ||data.width<64||data.width>2400||data.height<64||data.height>2400
      ||data.width*data.height>MAX_PIXELS
      ||!Array.isArray(data.layers)||data.layers.length<1||data.layers.length>MAX_LAYERS)
      throw new Error("Format de projet invalide ou incompatible");
   const prepared=[];
   for(const item of data.layers){
    if(item.type==="vector"){
     if(data.version<2||!["rect","ellipse","line","text"].includes(item.kind)
        ||!Number.isFinite(Number(item.w))||!Number.isFinite(Number(item.h)))
       throw new Error("Objet vectoriel incorrect");
     prepared.push({item,image:null});continue;
    }
    if(!["raster","image"].includes(item.type)||typeof item.image!=="string"
       ||!item.image.startsWith("data:image/png;base64,")
       ||item.image.length>23e6)throw new Error("Calque image incorrect");
    const image=new Image();
    await new Promise((resolve,reject)=>{
     image.onload=resolve;image.onerror=()=>reject(new Error("Image interne incorrecte"));
     image.src=item.image;
    });
    if(image.width>4096||image.height>4096)throw new Error("Image trop grande");
    prepared.push({item,image});
   }
   if(!active||(fromDraft&&editVersion!==revisionAtStart))return false;
   if(!fromDraft)record();
   if(data.width!==W||data.height!==H)resizeDocument(data.width,data.height,true);
   const rebuilt=[];
   prepared.forEach(({item,image},index)=>{
    let layer;
    if(item.type==="raster"){
     layer=createRaster(String(item.name||"Dessin").slice(0,70));
     layer.surface.getContext("2d").drawImage(image,0,0,W,H);
    }else if(item.type==="vector"){
     layer=createVector(item.kind,clamp(Number(item.x)||0,-3200,3200),clamp(Number(item.y)||0,-3200,3200),
       clamp(Number(item.w)||1,1,3200),clamp(Number(item.h)||1,1,3200));
     layer.name=String(item.name||"Forme").slice(0,70);
     layer.stroke=/^#[0-9a-f]{6}$/i.test(item.stroke)?item.stroke:"#000000";
     layer.fill=/^#[0-9a-f]{6}$/i.test(item.fill)?item.fill:null;
     layer.strokeWidth=clamp(Number(item.strokeWidth)||1,1,70);
     layer.text=String(item.text||"").slice(0,600);
     layer.fontSize=clamp(Number(item.fontSize)||32,8,200);
     layer.fontFamily="Arial";layer.reverse=!!item.reverse;
     redrawVector(layer);
    }else{
     const node=el("div","zp-imported-image");
     const surface=document.createElement("canvas");
     surface.width=image.width;surface.height=image.height;
     surface.getContext("2d").drawImage(image,0,0);
     surface.className="zp-image-visual";
     const handle=btn("⤡",()=>{},"zp-image-resize");
     handle.title="Redimensionner";handle.setAttribute("aria-label","Redimensionner l’image");
     const turn=btn("↻",()=>{},"zp-image-rotate");
     turn.title="Tourner librement";turn.setAttribute("aria-label","Tourner l'image");
     node.append(surface,handle,turn);
     layer={id:nextId++,type:"image",name:String(item.name||"Image").slice(0,70),
      img:image,url:item.image,surface,node,erase:[],
      x:Number(item.x)||0,y:Number(item.y)||0,w:Number(item.w)||100,h:Number(item.h)||100,
      baseW:Number(item.baseW)||100,aspect:Number(item.aspect)||1,visible:true};
     node.addEventListener("pointerdown",imagePointerDown);
     registry.set(layer.id,layer);
    }
    layer.background=item.type==="raster"&&(item.background===true||
       index===0&&item.name==="Fond"&&item.background!==false);
    layer.visible=item.visible!==false;layer.locked=!!item.locked;
    layer.opacity=clamp(Number(item.opacity??1),0,1);
    if(layer.type!=="raster"){
     layer.angle=clamp(Number(item.angle)||0,-180,180);
     layer.skew=clamp(Number(item.skew)||0,-45,45);
     layer.flipX=item.flipX===-1?-1:1;layer.flipY=item.flipY===-1?-1:1;
     layer.w=clamp(layer.w,1,3200);layer.h=clamp(layer.h,1,3200);
     layer.x=clamp(layer.x,-3200,3200);layer.y=clamp(layer.y,-3200,3200);
    }
    rebuilt.push(layer);
   });
   const backgroundIndex=rebuilt.findIndex(l=>l.background);
   if(backgroundIndex>0)rebuilt.unshift(rebuilt.splice(backgroundIndex,1)[0]);
   layers=rebuilt;
   const frontRaster=layers.slice().reverse().find(l=>l.type==="raster"&&!l.background);
   selected=frontRaster?.id||layers[layers.length-1].id;
   paintTarget=frontRaster?.id||layers.find(l=>l.type==="raster")?.id||null;
   render();choose("select");
   if(!fromDraft)notice("Projet ouvert : "+layers.length+" calques modifiables.");
   return true;
  }catch(err){
   if(fromDraft)saveIndicator.textContent="Brouillon illisible · export .zpaint recommandé";
   else notice("Impossible d'ouvrir le projet : "+err.message);
   return false;
  }
 }
 function restoreDraft(){
  readDraft(draftKey).then(async saved=>{
   if(!active||editVersion!==0)return;
   if(!saved?.project){
    saveIndicator.textContent="Sauvegarde automatique locale activée";return;
   }
   const blob=new Blob([JSON.stringify(saved.project)],{type:"application/json"});
   const restored=await loadProject(blob,true);
   if(restored&&active&&editVersion===0)
    saveIndicator.textContent="Brouillon retrouvé · sauvegarde automatique activée";
  }).catch(error=>{
   if(active)saveIndicator.textContent="Sauvegarde locale indisponible : "+error.message;
  });
 }
 projectInput.onchange=()=>{
  const file=projectInput.files?.[0];projectInput.value="";
  if(file)loadProject(file);
 };

 function download(){
  exportName("png",name=>{
   try{
    const a=document.createElement("a");
    a.href=merged().toDataURL("image/png");a.download=name;
    document.body.append(a);a.click();a.remove();
    notice("Image "+name+" exportée · "+W+" × "+H+" pixels.");
   }catch(err){notice("Export PNG impossible : "+err.message);}
  });
 }
 work.addEventListener("pointerdown",onDown);
 work.addEventListener("pointermove",hoverCursor,{passive:true});
 work.addEventListener("pointerleave",()=>{if(!drawing)cursorRing.hidden=true;});
 function key(e){
  if(!active||!root.isConnected||!root.closest(".window")?.classList.contains("focused"))return;
  if(["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?redoAction():undo();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){e.preventDefault();redoAction();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"){e.preventDefault();download();}
 }
 document.addEventListener("keydown",key);
 bootLayers();choose("select");updateHistory();restoreDraft();
 function dispose(){
  if(editVersion!==lastSavedVersion)flushDraft();
  active=false;if(draggingCleanup)draggingCleanup();
  urls.forEach(url=>URL.revokeObjectURL(url));urls.clear();
  document.removeEventListener("keydown",key);
  work.removeEventListener("pointerdown",onDown);
  work.removeEventListener("pointermove",hoverCursor);
  window.removeEventListener("pointermove",onMove);
  window.removeEventListener("pointerup",onUp);
  window.removeEventListener("pointercancel",onUp);
  if(dialog)dialog.parentElement?.remove();
 }
 root._zebraDispose=dispose;return dispose;
}
window.ZebraPaint={mount};
}());