/* ZebraOS textured boot facade — exclusively the approved WebP interface.
   No CSS-built legacy computer, no DOM replacement or startup flicker. */
(function(){
 "use strict";
 var root=document.getElementById("power-screen");
 if(!root)return;
 var host=root.querySelector(".zp3-machine");
 var button=root.querySelector("#power-btn.zp3-btn");
 var powerLed=root.querySelector(".zp3-led-power");
 var netLed=root.querySelector(".zp3-led-net");
 var powerImage=button&&button.querySelector("img");
 if(!host||!button||!powerLed||!netLed||!powerImage)return;
 var base="assets/powerv3/";
 function url(name){return base+encodeURIComponent(name);}
 var originalPower=button.onclick;
 var blinking=false,timer=0,bootTimer=0,openTimer=0,ghost=null,opening=false;
 // The plastic shell is the entire first screen; reveal the physical
 // machine only after a real click/tap anywhere on it.
 root.classList.add("zp3-awaiting");
 // Preload lit states to avoid an image swap flicker on first click.
 ["pcon.webp","btnpcon.webp"].forEach(function(name){var image=new Image();image.src=url(name);});
 function tick(){
  if(!blinking||!root.classList.contains("active"))return;
  var lit=Math.random()>.43;
  netLed.src=url(lit?"pcon.webp":"pcoff.webp");
  var gap=lit?60+Math.random()*160:100+Math.random()*570;
  if(Math.random()<.18)gap+=800+Math.random()*600;
  timer=setTimeout(tick,gap);
 }
 function startBlink(){if(blinking)return;blinking=true;tick();}
 function reset(){
  blinking=false;
  clearTimeout(timer);clearTimeout(bootTimer);clearTimeout(openTimer);
  if(ghost){ghost.remove();ghost=null;}
  opening=false;
  host.classList.remove("zp3-revealed");
  root.classList.add("zp3-awaiting");
  powerLed.src=url("pcoff.webp");netLed.src=url("pcoff.webp");
  powerImage.src=url("btnpcoff.webp");
  button.disabled=false;
 }
 button.onclick=function(){
  if(button.disabled)return;
  button.disabled=true;
  powerImage.src=url("btnpcon.webp");powerLed.src=url("pcon.webp");
  startBlink();
  bootTimer=setTimeout(function(){
   if(root.classList.contains("active")&&typeof originalPower==="function")originalPower.call(button);
  },1050);
 };
 new MutationObserver(function(){
  if(!root.classList.contains("active")){
   if(!root.classList.contains("zp3-awaiting"))reset();
  }else if(host.classList.contains("zp3-revealed"))startBlink();
 }).observe(root,{attributes:true,attributeFilter:["class"]});
 // The network indicator begins only once the physical facade is visible.
 function playOpenSound(){
  try{
   if(localStorage.getItem("zebra.sfx.muted")==="1")return;
   var data=window.ZebraSFXData;
   if(!data||!data.open)return;
   var sound=new Audio(data.open);sound.volume=.14;
   var play=sound.play();if(play&&play.catch)play.catch(function(){});
  }catch(e){}
 }
 function reveal(){
  if(opening||host.classList.contains("zp3-revealed")||
     !root.classList.contains("active"))return;
  opening=true;
  root.classList.remove("zp3-awaiting");
  // First gesture unlocks sound on Android/iOS; do not autoplay on load.
  playOpenSound();
  if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches){
   host.classList.add("zp3-revealed");
   startBlink();
   return;
  }
  var rect=host.getBoundingClientRect();
  ghost=document.createElement("div");ghost.className="zp3-ghost";
  ghost.setAttribute("aria-hidden","true");
  ghost.style.left=(rect.left+rect.width/2-22)+"px";
  ghost.style.top=(rect.top+rect.height/2-16)+"px";
  ghost.style.width="44px";ghost.style.height="32px";
  root.appendChild(ghost);
  // Layout read makes the next frame's transition consistently start from
  // the centered outline even on mobile hardware.
  ghost.getBoundingClientRect();
  var outline=ghost;
  requestAnimationFrame(function(){
   if(outline!==ghost||!root.classList.contains("active"))return;
   outline.style.left=rect.left+"px";
   outline.style.top=rect.top+"px";
   outline.style.width=rect.width+"px";
   outline.style.height=rect.height+"px";
  });
  var done=false;
  function finish(){
   if(done||outline!==ghost||!root.classList.contains("active"))return;
   done=true;outline.remove();ghost=null;
   host.classList.add("zp3-revealed");
   startBlink();
  }
  outline.addEventListener("transitionend",function(event){
   if(event.propertyName==="width")finish();
  });
  openTimer=setTimeout(finish,700);
 }
 root.addEventListener("click",function(){
  // One tap reveals the machine; only its actual POWER button boots it.
  reveal();
 });
 root.addEventListener("keydown",function(event){
  if(event.key!=="Enter"||host.classList.contains("zp3-revealed"))return;
  event.preventDefault();
  reveal();
 });
})();
