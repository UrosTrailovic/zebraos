/* Zebra Tetris — textures du créateur, chargement robuste et versionné.
   Les images restent issues du fichier fourni dans le studio, jamais d'une génération. */
(function(){
"use strict";
const MAIN="/assets/games/zebra-tetris-ui.png?v=57";
const BACKUP="https://raw.githubusercontent.com/UrosTrailovic/zebraos/main/assets/games/zebra-tetris-ui.png?v=57";
const AW=280,AH=252;
const rects={
 logo:[0,0,165,98],play:[168,0,108,32],pausebtn:[168,35,108,32],
 restart:[168,70,108,32],menu:[168,105,108,32],
 paused:[0,105,136,36],gameover:[0,146,136,36],
 tile:[0,188,64,64],border:[70,188,34,34]
};
const PIXEL="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
let cache=null,pending=null;
function load(){
 if(pending)return pending;
 pending=new Promise(function(resolve,reject){
  const urls=[MAIN,BACKUP];
  function attempt(index){
   if(index>=urls.length){reject(new Error("Textures Tetris indisponibles"));return;}
   const img=new Image();
   if(index>0)img.crossOrigin="anonymous";
   img.onload=function(){
    if(img.naturalWidth<276||img.naturalHeight<222){attempt(index+1);return;}
    const result={source:urls[index],regions:{},sprites:false};
    try{
     for(const [name,[x,y,w,h]] of Object.entries(rects)){
      const c=document.createElement("canvas");
      c.width=w;c.height=h;
      const context=c.getContext("2d");
      if(!context)throw new Error("Canvas indisponible");
      context.imageSmoothingEnabled=false;
      context.drawImage(img,x,y,w,h,0,0,w,h);
      result.regions[name]=c.toDataURL("image/png");
     }
    }catch(err){
     // Protection sur les navigateurs interdisant l'extraction du canvas.
     result.sprites=true;
    }
    cache=result;resolve(cache);
   };
   img.onerror=function(){attempt(index+1);};
   img.src=urls[index];
  }
  attempt(0);
 });
 return pending;
}
function setSprite(node,rect,source){
 const [x,y,w,h]=rect;
 node.style.backgroundImage='url("'+source+'")';
 node.style.backgroundRepeat="no-repeat";
 node.style.backgroundSize=(100*AW/w)+"% "+(100*AH/h)+"%";
 node.style.backgroundPosition=(100*x/(AW-w))+"% "+(100*y/(AH-h))+"%";
 node.style.imageRendering="pixelated";
}
function applyImage(node,key,mode){
 if(!cache)return;
 if(!cache.sprites){
  if(mode==="image"){node.src=cache.regions[key];}
  else{node.style.backgroundImage='url("'+cache.regions[key]+'")';node.style.backgroundSize="100% 100%";node.style.backgroundPosition="center";}
 }else{
  if(mode==="image")node.src=PIXEL;
  setSprite(node,rects[key],cache.source);
 }
}
function setState(overlay,start,state,playing){
 if(!cache)return;
 applyImage(overlay,state==="gameover"?"gameover":state==="intro"?"logo":"paused","image");
 applyImage(start,playing?"pausebtn":"play","background");
 start.dataset.label=playing?"PAUSE":"JOUER";
}
function apply({wrap,logo,overlay,start,restart,menu,onReady,onError}){
 logo.style.visibility="hidden";
 overlay.style.visibility="hidden";
 load().then(function(){
  if(!wrap.isConnected)return;
  applyImage(logo,"logo","image");
  applyImage(restart,"restart","background");
  applyImage(menu,"menu","background");
  if(!cache.sprites){
   wrap.style.setProperty("--zt-wall",'url("'+cache.regions.tile+'")');
   wrap.style.setProperty("--zt-border",'url("'+cache.regions.border+'")');
   wrap.style.setProperty("--zt-wallsize","64px 64px");
  }else{
   // La source reste l'atlas authentique : les contrôles et le logo sont des sprites CSS.
   wrap.style.setProperty("--zt-wall", "repeating-conic-gradient(from 45deg,#00c2d7 0 25%,#ea08d6 0 50%,#232be1 0 75%,#f62b53 0)");
  }
  wrap.classList.add("zt-art-loaded");
  logo.style.visibility="visible";
  overlay.style.visibility="visible";
  setState(overlay,start,"intro",false);
  if(onReady)onReady();
 }).catch(function(err){
  // On ne laisse pas un <img> cassé ni une interface sans titre.
  console.warn("Zebra Tetris : échec du chargement de la planche",err);
  logo.style.visibility="visible";
  logo.style.display="none";
  const fallback=document.createElement("span");
  fallback.className="zt-logo-fallback";
  fallback.textContent="ZEBRA TETRIS";
  logo.parentNode.appendChild(fallback);
  overlay.style.visibility="hidden";
  if(onError)onError(err);
 });
}
window.ZebraTetrisArtwork={apply,setState};
}());
