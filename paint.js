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
 const download=()=>{let a=document.createElement("a");a.download="zebra-paint-"+new Date().toISOString().slice(0,10)+".png";a.href=canvas.toDataURL("image/png");document.body.appendChild(a);a.click();a.remove();notice("Image exportée en PNG.");};
 toolbar.append(button("Nouveau",()=>{if(confirm("Effacer le dessin actuel ?")){record();clearCanvas();notice("Nouvelle image.");}}),button("Ouvrir une image",()=>input.click()),button("Enregistrer PNG",download));
 toolbar.appendChild(input);
 panel.appendChild(toolbar);
 const body=element("div","zp-body"),tools=element("div","zp-tools"),stage=element("div","zp-stage");
 const canvas=element("canvas","zp-canvas");canvas.width=WIDTH;canvas.height=HEIGHT;canvas.setAttribute("aria-label","Zone de dessin ZebraPaint");stage.appendChild(canvas);
 const work=element("div","zp-work");work.appendChild(stage);
 const paletteBar=element("div","zp-colors");
 let currentColor="#000000",brush=4,tool="pencil",fillTolerance=12;
 let status=element("div","zp-status","640 × 400 px · Crayon");
 let history=[],redoHistory=[],drawing=false,start=null,beforeShape=null,last=null,active=true;
 const ctx=canvas.getContext("2d",{willReadFrequently:true});
 ctx.lineCap="round";ctx.lineJoin="round";
 const toolsDef=[
  ["pencil","✎","Crayon"],["brush","🖌","Pinceau"],["eraser","▧","Gomme"],
  ["line","╱","Ligne"],["rect","▭","Rectangle"],["ellipse","◯","Ellipse"],
  ["fill","▣","Pot de peinture"],["picker","⌖","Pipette"]
 ];
 const toolButtons={};
 function notice(text){status.textContent=text;}
 function choose(t){
  tool=t;Object.keys(toolButtons).forEach(k=>toolButtons[k].classList.toggle("selected",k===t));
  canvas.style.cursor=t==="picker"?"copy":t==="fill"?"cell":"crosshair";
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
 function record(){
  history.push(ctx.getImageData(0,0,WIDTH,HEIGHT));if(history.length>MAX_UNDO)history.shift();
  redoHistory.length=0;updateHistory();
 }
 function updateHistory(){undoBtn.disabled=!history.length;redoBtn.disabled=!redoHistory.length;}
 function undo(){
  if(!history.length)return;
  redoHistory.push(ctx.getImageData(0,0,WIDTH,HEIGHT));
  ctx.putImageData(history.pop(),0,0);updateHistory();notice("Modification annulée.");
 }
 function redo(){
  if(!redoHistory.length)return;
  history.push(ctx.getImageData(0,0,WIDTH,HEIGHT));
  ctx.putImageData(redoHistory.pop(),0,0);updateHistory();notice("Modification rétablie.");
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
 function importImage(file){
  if(!file||!file.type.startsWith("image/")){notice("Fichier image non reconnu.");return;}
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{
    if(!active){URL.revokeObjectURL(url);return;}
    record();clearCanvas();
    const scale=Math.min(WIDTH/img.width,HEIGHT/img.height);
    ctx.drawImage(img,(WIDTH-img.width*scale)/2,(HEIGHT-img.height*scale)/2,img.width*scale,img.height*scale);
    URL.revokeObjectURL(url);notice("Image importée : "+file.name);
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
 function dispose(){active=false;document.removeEventListener("keydown",key);canvas.removeEventListener("pointerdown",onDown);canvas.removeEventListener("pointermove",onMove);canvas.removeEventListener("pointerup",onUp);canvas.removeEventListener("pointercancel",onUp);}
 root._zebraDispose=dispose;
 return dispose;
}
window.ZebraPaint={mount};
}());