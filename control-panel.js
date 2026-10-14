/* ZebraOS — utilitaires classiques : Panneau de configuration, Date/Heure,
   Informations système et Bienvenue. Simule le temps du bureau, sans modifier
   l'horloge réelle du téléphone/de l'ordinateur. */
(function(){
"use strict";
var PANEL_VERSION="2.0",ZONES=[
 ["Europe/Zurich","Suisse — Zurich"],
 ["Europe/Paris","France — Paris"],
 ["Europe/Belgrade","Serbie — Belgrade"],
 ["UTC","Temps universel (UTC)"],
 ["America/New_York","États-Unis — New York"],
 ["Asia/Tokyo","Japon — Tokyo"]
];
var monthNames=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
var panelInterval=null,dialogInterval=null;
function e(tag,cls,txt){var x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x;}
function btn(txt,fn,cls){var x=e("button",cls||"classic-button",txt);x.type="button";x.onclick=fn;return x;}
function get(key,fallback){try{var value=localStorage.getItem(key);return value===null?fallback:value;}catch(_){return fallback;}}
function put(key,value){try{localStorage.setItem(key,String(value));}catch(_){}}
function config(session){
 var root="zebraos.clock."+session+".";
 var zone=get(root+"zone","Europe/Zurich");
 if(!ZONES.some(function(z){return z[0]===zone;}))zone="Europe/Zurich";
 var offset=Number(get(root+"offset","0"));
 if(!Number.isFinite(offset)||Math.abs(offset)>365*86400000)offset=0;
 return {zone:zone,offset:offset};
}
function parts(date,zone){
 var formatter=new Intl.DateTimeFormat("en-GB",{
  timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",
  hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"
 });
 var obj={};
 formatter.formatToParts(date).forEach(function(x){if(x.type!=="literal")obj[x.type]=Number(x.value);});
 return {y:obj.year,m:obj.month,d:obj.day,h:obj.hour,min:obj.minute,s:obj.second};
}
function zoneToEpoch(y,m,d,h,min,sec,zone){
 var desired=Date.UTC(y,m-1,d,h,min,sec);
 var guess=desired;
 for(var i=0;i<3;i++){
  var p=parts(new Date(guess),zone);
  var actual=Date.UTC(p.y,p.m-1,p.d,p.h,p.min,p.s);
  guess+=desired-actual;
 }
 return guess;
}
function two(v){return String(v).padStart(2,"0");}
function displayTime(session){
 var opt=config(session),now=new Date(Date.now()+opt.offset),p=parts(now,opt.zone);
 return two(p.h)+":"+two(p.min);
}
function readableFull(p){
 return two(p.d)+"."+two(p.m)+"."+p.y+" — "+two(p.h)+":"+two(p.min)+":"+two(p.s);
}
function close(ctx,id){if(ctx&&ctx.closeWindow)ctx.closeWindow(id);}
function windowBody(ctx,id,title,w,h){
 return ctx.windowBox(id,title,Math.min(w,window.innerWidth-18),Math.min(h,window.innerHeight-65));
}
function mountPanel(root,ctx){
 if(panelInterval){clearInterval(panelInterval);panelInterval=null;}
 root.innerHTML="";
 var main=e("div","zcp");
 main.appendChild(e("div","zcp-description","Double-cliquez sur une icône pour modifier les paramètres de ZebraOS."));
 var grid=e("div","zcp-grid");
 var options=[
  ["Affichage","▣","Fonds d’écran et apparence",function(){showDisplay(ctx);}],
  ["Sons","♫","Sons de l’interface",function(){showSounds(ctx);}],
  ["Date et heure","◷","Calendrier et horloge",function(){showDateTime(ctx);}],
  ["Système","▤","Détails de l’ordinateur",function(){showSystem(ctx);}],
  ["À propos de ZebraOS","ⓘ","Informations sur ZebraOS",function(){showAbout(ctx);}],
  ["Bienvenue","?","Guide des programmes",function(){showWelcome(ctx);}]
 ];
 options.forEach(function(item){
  var tile=btn("",function(){
   if(window.matchMedia("(pointer:coarse)").matches||window.innerWidth<701)run();
   else{
    grid.querySelectorAll(".zcp-item").forEach(function(b){b.classList.remove("selected");});
    tile.classList.add("selected");
   }
  },"zcp-item");
  function run(){item[3]();}
  tile.ondblclick=function(){run();};
  tile.appendChild(e("span","zcp-symbol",item[1]));
  tile.appendChild(e("span","zcp-item-title",item[0]));
  tile.title=item[2];tile.setAttribute("aria-label",item[0]+" — "+item[2]);
  grid.appendChild(tile);
 });
 main.appendChild(grid);
 main.appendChild(e("div","zcp-status","6 éléments · Ordinateur du studio"));
 root.appendChild(main);
}
function footer(root,buttons){
 var f=e("div","zcp-dialog-buttons");
 buttons.forEach(function(b){f.appendChild(btn(b[0],b[1]));});
 root.appendChild(f);return f;
}
function showDisplay(ctx){
 var root=windowBody(ctx,"display","Propriétés de l’affichage",680,540);
 if(window.ZebraWallpaper)window.ZebraWallpaper.mount(root);
 else{root.innerHTML="";root.appendChild(btn("Importer un fond d’écran…",function(){document.getElementById("file-wallpaper").click();}));}
}
function showSounds(ctx){
 var root=windowBody(ctx,"sounds","Propriétés de Sons",480,360);
 root.innerHTML="";
 var wrap=e("div","zcp-dialog");
 wrap.appendChild(e("div","zcp-tab active","Sons"));
 var frame=e("fieldset","zcp-field");frame.appendChild(e("legend","","Événements système"));
 var checkbox=e("input");checkbox.type="checkbox";checkbox.checked=get("zebra.sfx.muted","0")!=="1";
 var label=e("label","zcp-check");label.appendChild(checkbox);label.appendChild(e("span","","Activer les sons de l’interface"));
 frame.appendChild(label);wrap.appendChild(frame);
 wrap.appendChild(e("p","zcp-help","Vous pouvez tester les sons de ZebraOS sans modifier le volume de l’appareil."));
 var actions=e("div","zcp-sound-actions");
 actions.appendChild(btn("Tester le son",function(){ctx.sfx("confirm");}));
 actions.appendChild(btn("Tester le clic",function(){ctx.clickSound();}));
 wrap.appendChild(actions);
 footer(wrap,[
  ["OK",function(){put("zebra.sfx.muted",checkbox.checked?"0":"1");close(ctx,"sounds");}],
  ["Annuler",function(){close(ctx,"sounds");}],
  ["Appliquer",function(){put("zebra.sfx.muted",checkbox.checked?"0":"1");}]
 ]);
 root.appendChild(wrap);
}
function showAbout(ctx){
 var root=windowBody(ctx,"about","À propos de ZebraOS",460,375);
 root.innerHTML="";
 var wrap=e("div","zcp-about");
 var head=e("div","zcp-about-head");
 var logo=e("img");logo.src="/assets/boot/logo.png";logo.alt="ZebraOS";
 head.appendChild(logo);
 var description=e("div");
 description.appendChild(e("strong","","ZebraOS"));
 description.appendChild(e("div","","Édition Studio · Version "+PANEL_VERSION));
 description.appendChild(e("div","","© 2026 Zebra Record"));
 head.appendChild(description);wrap.appendChild(head);
 var info=e("div","zcp-about-details");
 info.appendChild(e("p","","Ce système est un environnement rétro interactif accessible dans un navigateur."));
 info.appendChild(e("p","","Édition créée pour Zebra Tape 2."));
 info.appendChild(e("hr"));
 info.appendChild(e("p","","Session en cours : "+ctx.session()));
 info.appendChild(e("p","","Ordinateur simulé : Zebra Studio"));
 info.appendChild(e("p","","Les caractéristiques matérielles ne sont pas émulées."));
 wrap.appendChild(info);
 footer(wrap,[["OK",function(){close(ctx,"about");}]]);
 root.appendChild(wrap);
}
function showSystem(ctx){
 var root=windowBody(ctx,"system","Propriétés du système",490,400);
 root.innerHTML="";
 var wrap=e("div","zcp-dialog");
 var tabs=e("div","zcp-tabs");tabs.appendChild(e("div","zcp-tab active","Général"));wrap.appendChild(tabs);
 var row=e("div","zcp-system-hero");
 var icon=e("img");icon.src="/assets/boot/logo.png";icon.alt="";row.appendChild(icon);
 var detail=e("div");detail.appendChild(e("strong","","ZebraOS 2.0"));
 detail.appendChild(e("p","","Édition Studio — Zebra Record"));
 detail.appendChild(e("p","","Interface de bureau simulée"));
 row.appendChild(detail);wrap.appendChild(row);
 var group=e("fieldset","zcp-field");
 group.appendChild(e("legend","","Informations"));
 group.appendChild(e("p","","Session : "+ctx.session()));
 group.appendChild(e("p","","Support : navigateur Web"));
 group.appendChild(e("p","","Langue : français"));
 group.appendChild(e("p","","Système invité : ZebraOS (simulation)"));
 wrap.appendChild(group);
 footer(wrap,[["À propos…",function(){showAbout(ctx);}],["OK",function(){close(ctx,"system");}]]);
 root.appendChild(wrap);
}
function showWelcome(ctx){
 var root=windowBody(ctx,"welcome","Bienvenue dans ZebraOS",670,440);
 root.innerHTML="";
 var wrap=e("div","zcp-welcome");
 var heading=e("div","zcp-welcome-head");
 var text=e("div");
 text.appendChild(e("h2","","Bienvenue dans ZebraOS"));
 text.appendChild(e("strong","","Le studio se trouve sur votre bureau."));
 text.appendChild(e("p","","Pour ouvrir un programme, double-cliquez sur son icône. Sur mobile, une seule pression suffit."));
 heading.appendChild(text);wrap.appendChild(heading);
 var middle=e("div","zcp-welcome-middle");
 var art=e("div","zcp-welcome-art");
 var icon=e("img");icon.src="/assets/boot/logo.png";icon.alt="ZebraOS";art.appendChild(icon);
 middle.appendChild(art);
 var actions=e("div","zcp-welcome-actions");
 [
  ["Découvrir ZebraAMP",function(){ctx.openApp("amp");}],
  ["Ouvrir les fichiers",function(){ctx.openApp("explorer");}],
  ["Personnaliser le fond",function(){showDisplay(ctx);}],
  ["Régler la date et l’heure",function(){showDateTime(ctx);}]
 ].forEach(function(a){actions.appendChild(btn(a[0],a[1]));});
 actions.appendChild(btn("Fermer",function(){close(ctx,"welcome");}));
 middle.appendChild(actions);wrap.appendChild(middle);
 root.appendChild(wrap);
}
function showDateTime(ctx){
 if(dialogInterval){clearInterval(dialogInterval);dialogInterval=null;}
 var id="datetime",root=windowBody(ctx,id,"Propriétés de Date et heure",520,425);
 root.innerHTML="";
 var session=ctx.session(),saved=config(session),zone=saved.zone,offset=saved.offset,tab="date",modified=false;
 var instant=new Date(Date.now()+offset),p=parts(instant,zone);
 var year=p.y,month=p.m-1,day=p.d;
 var wrap=e("div","zcp-dialog zcp-date");
 var tabs=e("div","zcp-tabs");
 var dateTab=btn("Date et heure",function(){tab="date";paint();},"zcp-tab");
 var zoneTab=btn("Fuseau horaire",function(){tab="zone";paint();},"zcp-tab");
 tabs.appendChild(dateTab);tabs.appendChild(zoneTab);wrap.appendChild(tabs);
 var content=e("div","zcp-datetime-content");wrap.appendChild(content);
 var footerInfo=e("div","zcp-timezone-footer","");
 wrap.appendChild(footerInfo);
 var foot=e("div","zcp-dialog-buttons"),applyBtn=btn("Appliquer",apply);
 foot.appendChild(btn("OK",function(){apply();close(ctx,id);}));
 foot.appendChild(btn("Annuler",function(){close(ctx,id);}));
 foot.appendChild(applyBtn);
 wrap.appendChild(foot);root.appendChild(wrap);
 function current(){return parts(new Date(Date.now()+offset),zone);}
 function apply(){
  if(!modified)return;
  var oldZone=zone,rootKey="zebraos.clock."+session+".";
  put(rootKey+"zone",zone);put(rootKey+"offset",String(Math.round(offset)));
  modified=false;applyBtn.disabled=true;
  if(ctx.updateClock)ctx.updateClock();
  paint();
 }
 function tick(){
  if(!root.isConnected){if(dialogInterval){clearInterval(dialogInterval);dialogInterval=null;}return;}
  var curr=current();
  var second=content.querySelector(".zcp-clock-second"),
      minute=content.querySelector(".zcp-clock-minute"),
      hour=content.querySelector(".zcp-clock-hour"),
      digital=content.querySelector(".zcp-clock-digital");
  if(second)second.style.transform="rotate("+(curr.s*6)+"deg)";
  if(minute)minute.style.transform="rotate("+((curr.min+curr.s/60)*6)+"deg)";
  if(hour)hour.style.transform="rotate("+((curr.h%12+curr.min/60)*30)+"deg)";
  if(digital)digital.textContent=two(curr.h)+":"+two(curr.min)+":"+two(curr.s);
 }
 function calendar(){
  var left=e("fieldset","zcp-field zcp-calendar-field");
  left.appendChild(e("legend","","Date"));
  var controls=e("div","zcp-month-controls");
  var prev=btn("◀",function(){month--;if(month<0){year--;month=11;}paint();});
  var next=btn("▶",function(){month++;if(month>11){year++;month=0;}paint();});
  controls.appendChild(prev);
  var caption=e("span","zcp-month-title",monthNames[month]+" "+year);
  controls.appendChild(caption);controls.appendChild(next);left.appendChild(controls);
  var table=e("div","zcp-calendar");
  ["L","M","M","J","V","S","D"].forEach(function(ch){table.appendChild(e("span","zcp-day-head",ch));});
  var first=(new Date(Date.UTC(year,month,1)).getUTCDay()+6)%7;
  var max=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  for(var k=0;k<first;k++)table.appendChild(e("span","zcp-blank",""));
  for(var d=1;d<=max;d++){
    (function(value){
      var button=btn(String(value),function(){
        day=value;modified=true;applyBtn.disabled=false;
        var c=current(),candidate=zoneToEpoch(year,month+1,day,c.h,c.min,c.s,zone);
        offset=candidate-Date.now();paint();
      },"zcp-day"+(value===day?" selected":""));
      table.appendChild(button);
    })(d);
  }
  left.appendChild(table);
  return left;
 }
 function clockGroup(){
  var field=e("fieldset","zcp-field zcp-clock-field");
  field.appendChild(e("legend","","Heure"));
  var face=e("div","zcp-clock-face");
  for(var i=1;i<=12;i++){
    var num=e("span","zcp-clock-number",String(i));
    var angle=(i*Math.PI/6)-Math.PI/2,radius=40;
    num.style.left=(50+radius*Math.cos(angle))+"%";
    num.style.top=(50+radius*Math.sin(angle))+"%";
    face.appendChild(num);
  }
  ["hour","minute","second"].forEach(function(kind){face.appendChild(e("div","zcp-clock-hand zcp-clock-"+kind));});
  face.appendChild(e("span","zcp-clock-center",""));
  field.appendChild(face);
  var clockLabel=e("div","zcp-clock-digital","");
  field.appendChild(clockLabel);
  var inputs=e("div","zcp-time-inputs");
  var currentP=current();
  var hours=e("input");hours.type="number";hours.min="0";hours.max="23";hours.value=String(currentP.h);hours.title="Heures";
  var minutes=e("input");minutes.type="number";minutes.min="0";minutes.max="59";minutes.value=String(currentP.min);minutes.title="Minutes";
  inputs.appendChild(hours);inputs.appendChild(e("span","",":"));inputs.appendChild(minutes);
  var set=btn("Définir",function(){
    var h=Number(hours.value),m=Number(minutes.value);
    if(!Number.isInteger(h)||h<0||h>23||!Number.isInteger(m)||m<0||m>59)return;
    var curr=current();var ts=zoneToEpoch(year,month+1,day,h,m,0,zone);
    offset=ts-Date.now();modified=true;applyBtn.disabled=false;paint();
  });inputs.appendChild(set);field.appendChild(inputs);
  return field;
 }
 function paint(){
  dateTab.classList.toggle("active",tab==="date");
  zoneTab.classList.toggle("active",tab==="zone");
  content.innerHTML="";
  applyBtn.disabled=!modified;
  if(tab==="date"){
    var grid=e("div","zcp-clock-layout");grid.appendChild(calendar());grid.appendChild(clockGroup());content.appendChild(grid);
  }else{
    var field=e("fieldset","zcp-field");
    field.appendChild(e("legend","","Fuseau horaire du bureau"));
    var select=e("select","zcp-zone-select");
    ZONES.forEach(function(z){var o=e("option","",z[1]);o.value=z[0];select.appendChild(o);});
    select.value=zone;select.onchange=function(){
      zone=select.value;
      var c=current();year=c.y;month=c.m-1;day=c.d;
      modified=true;applyBtn.disabled=false;paint();
    };
    field.appendChild(select);
    field.appendChild(e("p","zcp-help","Ce réglage modifie l’affichage de l’heure dans ZebraOS uniquement."));
    content.appendChild(field);
  }
  footerInfo.textContent="Fuseau horaire : "+ZONES.find(function(z){return z[0]===zone;})[1]+" · Horloge simulée (n’affecte pas votre appareil)";
  tick();
 }
 paint();
 dialogInterval=setInterval(tick,1000);
}
window.ZebraControlPanel={
 mount:mountPanel,display:showDisplay,sounds:showSounds,dateTime:showDateTime,
 system:showSystem,about:showAbout,welcome:showWelcome,clock:displayTime
};
}());