/* ZebraOS v3 power screen: the same 520ms stepped wireframe as animateWindowOpen(). */
(function(){
 "use strict";
 var root=document.getElementById("power-screen"),oldBtn=document.getElementById("power-btn");
 if(!root||!oldBtn)return;
 var base="assets/powerv3/";
 var names=["pcinterface.webp","pcoff.webp","pcon.webp","btnpcoff.webp","btnpcon.webp","zebraossticker.webp","intel sticker.webp"];
 function url(s){return base+encodeURIComponent(s).replace(/%2F/g,"/");}
 function load(s){return new Promise(function(resolve,reject){var im=new Image();im.onload=resolve;im.onerror=reject;im.src=url(s);});}
 Promise.all(names.map(load)).then(function(){
  if(!root.contains(oldBtn))return;
  var originalPower=oldBtn.onclick;
  var host=document.createElement("div");host.className="zp3-machine";
  host.setAttribute("role","group");host.setAttribute("aria-label","Façade de l’ordinateur ZebraOS");
  function graphic(name,cls){var im=document.createElement("img");im.src=url(name);im.className=cls;im.alt="";host.appendChild(im);return im;}
  graphic("pcinterface.webp","zp3-face");
  var powerLed=graphic("pcoff.webp","zp3-led zp3-led-power");
  var netLed=graphic("pcoff.webp","zp3-led zp3-led-net");
  graphic("zebraossticker.webp","zp3-sticker-z");
  graphic("intel sticker.webp","zp3-sticker-i");
  var powerImage=document.createElement("img");powerImage.src=url("btnpcoff.webp");powerImage.alt="";
  var button=document.createElement("button");button.type="button";button.id="power-btn";button.className="zp3-btn";button.setAttribute("aria-label","Allumer ZebraOS");
  button.appendChild(powerImage);host.appendChild(button);
  oldBtn.removeAttribute("id");
  root.replaceChildren(host);root.classList.add("zp3-ready");
  var blinking=false,timer=0,trigger=0,opening=false;
  function reset(){blinking=false;clearTimeout(timer);clearTimeout(trigger);powerLed.src=url("pcoff.webp");netLed.src=url("pcoff.webp");powerImage.src=url("btnpcoff.webp");button.disabled=false;}
  function tick(){if(!blinking||!root.classList.contains("active"))return;var lit=Math.random()>.43;netLed.src=url(lit?"pcon.webp":"pcoff.webp");var gap=lit?60+Math.random()*160:100+Math.random()*570;if(Math.random()<.18)gap+=800+Math.random()*600;timer=setTimeout(tick,gap);}
  function startBlink(){if(blinking)return;blinking=true;tick();}
  button.onclick=function(){
    if(button.disabled)return;
    button.disabled=true;powerImage.src=url("btnpcon.webp");powerLed.src=url("pcon.webp");
    startBlink();
    trigger=setTimeout(function(){if(root.classList.contains("active")&&typeof originalPower==="function")originalPower.call(button);},1050);
  };
  var obs=new MutationObserver(function(){
    if(root.classList.contains("active"))startBlink();
    else reset();
  });
  obs.observe(root,{attributes:true,attributeFilter:["class"]});
  // INTERNET clignote dès que la machine est visible, même avant POWER.
  if(root.classList.contains("active"))startBlink();
  function playOpenSound(){
    try{
      if(localStorage.getItem("zebra.sfx.muted")==="1")return;
      var data=window.ZebraSFXData;if(!data||!data.open)return;
      var snd=new Audio(data.open);snd.volume=.14;var p=snd.play();if(p&&p.catch)p.catch(function(){});
    }catch(e){}
  }
  function reveal(){
    if(opening)return;opening=true;
    if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches){host.classList.add("zp3-revealed");return;}
    var rect=host.getBoundingClientRect(),ghost=document.createElement("div");ghost.className="zp3-ghost";ghost.setAttribute("aria-hidden","true");
    ghost.style.left=(rect.left+rect.width/2-22)+"px";ghost.style.top=(rect.top+rect.height/2-16)+"px";ghost.style.width="44px";ghost.style.height="32px";
    root.appendChild(ghost);ghost.getBoundingClientRect();
    requestAnimationFrame(function(){ghost.style.left=rect.left+"px";ghost.style.top=rect.top+"px";ghost.style.width=rect.width+"px";ghost.style.height=rect.height+"px";});
    setTimeout(playOpenSound,125);
    var done=false;function finish(){if(done)return;done=true;ghost.remove();host.classList.add("zp3-revealed");}
    ghost.addEventListener("transitionend",function(e){if(e.propertyName==="width")finish();});
    setTimeout(finish,700);
  }
  reveal();
 }).catch(function(){ /* Missing assets: leave the existing power screen intact. */ });
})();
