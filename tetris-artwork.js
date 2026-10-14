/* Textures authentiques remises par l'artiste : atlas compact indexé en pixels.
   Le code ne recrée pas ces illustrations : il extrait les régions de son PNG. */
(function(){
"use strict";
const PATH="/assets/games/zebra-tetris-ui.png?v=1";
const rects={
 logo:[0,0,165,98], play:[168,0,108,32], pausebtn:[168,35,108,32],
 restart:[168,70,108,32], menu:[168,105,108,32],
 paused:[0,105,136,36], gameover:[0,146,136,36],
 tile:[0,188,64,64], border:[70,188,34,34]
};
let cache=null,pending=null;
function load(){
 if(pending)return pending;
 pending=new Promise((resolve,reject)=>{
  const img=new Image();
  img.onload=()=>{
   try{
    const crops={};
    for(const [name,[x,y,w,h]] of Object.entries(rects)){
     const canvas=document.createElement("canvas");
     canvas.width=w;canvas.height=h;
     const ctx=canvas.getContext("2d");
     ctx.imageSmoothingEnabled=false;
     ctx.drawImage(img,x,y,w,h,0,0,w,h);
     crops[name]=canvas.toDataURL("image/png");
    }
    cache=crops;resolve(crops);
   }catch(e){reject(e);}
  };
  img.onerror=()=>reject(new Error("Impossible de charger les textures Tetris"));
  img.src=PATH;
 });
 return pending;
}
function setState(overlay,start,state,playing){
 if(!cache)return;
 overlay.src=cache[state==="gameover"?"gameover":"paused"];
 start.style.backgroundImage='url("'+cache[playing?"pausebtn":"play"]+'")';
 start.dataset.label=playing?"PAUSE":"JOUER";
}
function apply({wrap,logo,overlay,start,restart,menu,onReady}){
 load().then(c=>{
  if(!wrap.isConnected)return;
  logo.src=c.logo;
  logo.alt="Zebra Tetris";
  wrap.classList.add("zt-art-loaded");
  wrap.style.setProperty("--zt-wall",'url("'+c.tile+'")');
  wrap.style.setProperty("--zt-border",'url("'+c.border+'")');
  restart.style.backgroundImage='url("'+c.restart+'")';
  menu.style.backgroundImage='url("'+c.menu+'")';
  setState(overlay,start,"pause",false);
  onReady&&onReady();
 }).catch(err=>{
  console.warn("Tetris : textures inaccessibles, affichage de secours conservé.",err);
  logo.alt="ZEBRA TETRIS";
 });
}
window.ZebraTetrisArtwork={apply,setState};
})();