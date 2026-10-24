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
 var blinking=false,timer=0,bootTimer=0,opening=false;
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
  blinking=false;clearTimeout(timer);clearTimeout(bootTimer);
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
  if(root.classList.contains("active"))startBlink();
  else reset();
 }).observe(root,{attributes:true,attributeFilter:["class"]});
 // Internet indicator stays active even before the visitor powers on.
 if(root.classList.contains("active"))startBlink();
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
  if(opening)return;opening=true;
  if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches){
   host.classList.add("zp3-revealed");return;
  }
  var rect=host.getBoundingClientRect();
  var ghost=document.createElement("div");ghost.className="zp3-ghost";ghost.setAttribute("aria-hidden","true");
  ghost.style.left=(rect.left+rect.width/2-22)+"px";
  ghost.style.top=(rect.top+rect.height/2-16)+"px";
  ghost.style.width="44px";ghost.style.height="32px";
  root.appendChild(ghost);ghost.getBoundingClientRect();
  requestAnimationFrame(function(){
   ghost.style.left=rect.left+"px";ghost.style.top=rect.top+"px";
   ghost.style.width=rect.width+"px";ghost.style.height=rect.height+"px";
  });
  setTimeout(playOpenSound,125);
  var done=false;
  function finish(){
   if(done)return;done=true;ghost.remove();host.classList.add("zp3-revealed");
  }
  ghost.addEventListener("transitionend",function(event){if(event.propertyName==="width")finish();});
  setTimeout(finish,700);
 }
 reveal();
})();
