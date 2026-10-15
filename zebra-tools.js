/* ZebraOS — trois utilitaires personnels, sans service distant.
   Données locales séparées par session. Ne pas y stocker de secrets. */
(function(){
"use strict";
function E(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function B(text,fn,cls){var n=E("button",cls||"zu-btn",text);n.type="button";n.onclick=fn;return n;}
function key(app,session){return "zebra.tools.v1."+app+"."+(session||"visitor");}
function read(app,session,fallback){
 try{var d=JSON.parse(localStorage.getItem(key(app,session))||"null");return d===null?fallback:d;}
 catch(_){return fallback;}
}
function save(app,session,data){
 try{localStorage.setItem(key(app,session),JSON.stringify(data));return true;}
 catch(_){return false;}
}
function dateId(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function shortDate(d){return d.toLocaleDateString("fr-CH",{day:"numeric",month:"long",year:"numeric"});}
function sane(text,max){return String(text||"").slice(0,max);}
var colors={yellow:"#fff2a0",pink:"#ffd2e8",blue:"#bfeaff",green:"#d1f4c6"};

/* ZEBRACALC : moteur arithmétique explicite, aucun eval. */
function calculator(root,session){
 root.innerHTML="";root.classList.add("zu-root");
 var shell=E("div","zu-calc"),head=E("div","zu-head");
 head.appendChild(E("strong","","ZEBRACALC"));head.appendChild(E("small","","CALCULATRICE · STANDARD"));shell.appendChild(head);
 var equation=E("div","zu-calc-equation","0");
 var display=E("output","zu-calc-display","0");display.setAttribute("aria-live","polite");
 shell.appendChild(equation);shell.appendChild(display);
 var grid=E("div","zu-calc-keys");
 var history=read("calc",session,[]);
 if(!Array.isArray(history))history=[];
 var current="0",previous=null,operator=null,fresh=false;
 function pretty(n){
  if(!isFinite(n))return "Erreur";
  return String(Number(n.toPrecision(11)));
 }
 function show(){
  display.textContent=current.replace(".",",");
  equation.textContent=previous!==null?pretty(previous).replace(".",",")+" "+operator:"0";
 }
 function operate(a,b,op){
  if(op==="+")return a+b;
  if(op==="−")return a-b;
  if(op==="×")return a*b;
  if(op==="÷")return b===0?NaN:a/b;
  return b;
 }
 var historyList=E("div","zu-calc-history");
 function redrawHistory(){
  historyList.replaceChildren();
  if(!history.length){historyList.appendChild(E("p","zu-hint","Tes derniers calculs apparaîtront ici."));return;}
  history.slice().reverse().forEach(function(h){historyList.appendChild(E("div","zu-history-row",h));});
 }
 function input(k){
  if(/[0-9]/.test(k)&&k.length===1){
   if(current==="Erreur"||fresh){current=k;fresh=false;}
   else if(current.replace(/[-.]/g,"").length<12)current=current==="0"?k:current+k;
  }else if(k==="."||k===","){
   if(fresh||current==="Erreur"){current="0";fresh=false;}
   if(!current.includes("."))current+=".";
  }else if(["+","−","×","÷"].includes(k)){
   if(current==="Erreur")return;
   if(previous!==null&&!fresh){
    var result=operate(previous,Number(current),operator);current=pretty(result);
    if(current==="Erreur"){previous=null;operator=null;show();return;}
   }
   previous=Number(current);operator=k;fresh=true;
  }else if(k==="="){
   if(previous===null||!operator||current==="Erreur")return;
   var a=previous,b=Number(current),op=operator,result=pretty(operate(a,b,op));
   history.push(pretty(a)+" "+op+" "+pretty(b)+" = "+result);
   history=history.slice(-12);save("calc",session,history);redrawHistory();
   current=result;previous=null;operator=null;fresh=true;
  }else if(k==="AC"){current="0";previous=null;operator=null;fresh=false;}
  else if(k==="⌫"){current=current.length>1?current.slice(0,-1):"0";if(current==="-")current="0";fresh=false;}
  else if(k==="±"){if(current!=="Erreur"&&current!=="0")current=current[0]==="-"?current.slice(1):"-"+current;}
  else if(k==="%"){if(current!=="Erreur")current=pretty(Number(current)/100);}
  show();
 }
 [["AC","⌫","%","÷"],["7","8","9","×"],["4","5","6","−"],["1","2","3","+"],["±","0",",","="]].forEach(function(row){
  row.forEach(function(k){
   var b=B(k,function(){input(k);}, "zu-calc-key"+(["+","−","×","÷","="].includes(k)?" zu-calc-operator":"")+(k==="="?" zu-calc-equals":""));
   b.setAttribute("aria-label",k);grid.appendChild(b);
  });
 });
 shell.appendChild(grid);
 var lower=E("section","zu-calc-lower");
 var bar=E("div","zu-mini-title");bar.appendChild(E("strong","","HISTORIQUE"));
 bar.appendChild(B("EFFACER",function(){history=[];save("calc",session,history);redrawHistory();},"zu-link"));
 lower.appendChild(bar);lower.appendChild(historyList);shell.appendChild(lower);root.appendChild(shell);
 root.tabIndex=0;
 root.onkeydown=function(e){
  if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")return;
  var k=e.key;
  if(k==="Backspace")k="⌫";else if(k==="Escape"||k==="Delete")k="AC";
  else if(k==="Enter")k="=";else if(k==="/")k="÷";else if(k==="*")k="×";else if(k==="-")k="−";
  if("0123456789".includes(k)&&k.length===1||[".","+","−","×","÷","=","⌫","AC","%"].includes(k)){e.preventDefault();input(k);}
 };
 redrawHistory();show();
}

/* ZEBRASTICKY — vraies notes épinglées au bureau, déplaçables. */
function getNotes(session){
 var items=read("sticky",session,[]);
 return Array.isArray(items)?items.filter(function(n){return n&&typeof n.id==="string";}).slice(0,40):[];
}
function putNotes(session,items){return save("sticky",session,items);}
function makeNote(session,notes){
 if(notes.length>=40)return null;
 var i=notes.length,desk=document.getElementById("desktop-screen");
 var width=desk?desk.clientWidth:window.innerWidth;
 var id="sticky-"+Date.now()+"-"+Math.random().toString(36).slice(2,7);
 var note={id:id,title:"NOTE "+String(i+1).padStart(2,"0"),text:"",color:"yellow",
  x:Math.max(95,width-218-(i%3)*23),y:75+(i%5)*26};
 notes.push(note);putNotes(session,notes);return note;
}
function stickyDesktop(session){
 var desktop=document.getElementById("desktop-screen");if(!desktop)return;
 var old=desktop.querySelector(".zu-sticky-layer");if(old)old.remove();
 var layer=E("div","zu-sticky-layer");desktop.appendChild(layer);
 var notes=getNotes(session);
 var maxW=function(){return desktop.clientWidth;},maxH=function(){return desktop.clientHeight-36;};
 function persist(){putNotes(session,notes);}
 function draw(){
  layer.replaceChildren();
  notes.forEach(function(note){
   var panel=E("article","zu-sticky-note");
   panel.style.background=colors[note.color]||colors.yellow;
   function reposition(){
    var nw=panel.offsetWidth||180,nh=panel.offsetHeight||168;
    note.x=Math.max(0,Math.min(maxW()-nw-1,Number(note.x)||0));
    note.y=Math.max(0,Math.min(maxH()-nh-1,Number(note.y)||0));
    panel.style.left=note.x+"px";panel.style.top=note.y+"px";
   }
   var bar=E("div","zu-sticky-bar");
   var grip=E("span","zu-sticky-grip","⋮⋮ "+sane(note.title,32));
   bar.appendChild(grip);
   var close=B("×",function(){
    if(!confirm("Supprimer ce post-it ?"))return;
    notes=notes.filter(function(n){return n.id!==note.id;});persist();draw();
   },"zu-sticky-close");
   close.setAttribute("aria-label","Supprimer le post-it");bar.appendChild(close);
   panel.appendChild(bar);
   var text=E("textarea","zu-sticky-text");
   text.value=sane(note.text,2500);text.maxLength=2500;
   text.placeholder="Une idée, un rappel, des paroles…";
   text.setAttribute("aria-label","Contenu du post-it "+note.title);
   text.oninput=function(){note.text=text.value;persist();};
   panel.appendChild(text);
   var foot=E("div","zu-sticky-foot");
   ["yellow","pink","blue","green"].forEach(function(color){
    var dot=B("",function(){note.color=color;panel.style.background=colors[color];persist();},"zu-sticky-dot"+(note.color===color?" selected":""));
    dot.style.background=colors[color];dot.setAttribute("aria-label","Couleur "+color);
    dot.title=color;foot.appendChild(dot);
   });
   panel.appendChild(foot);layer.appendChild(panel);reposition();
   grip.onpointerdown=function(ev){
    if(ev.button!==0&&ev.pointerType==="mouse")return;
    ev.preventDefault();
    var x=ev.clientX,y=ev.clientY,l=note.x,t=note.y;
    try{grip.setPointerCapture(ev.pointerId);}catch(_){}
    var move=function(e){note.x=l+e.clientX-x;note.y=t+e.clientY-y;reposition();};
    var end=function(){grip.removeEventListener("pointermove",move);grip.removeEventListener("pointerup",end);grip.removeEventListener("pointercancel",end);persist();};
    grip.addEventListener("pointermove",move);grip.addEventListener("pointerup",end);grip.addEventListener("pointercancel",end);
   };
  });
 }
 draw();
 return {draw:draw};
}
function stickyManager(root,session,desktopRefresh){
 root.innerHTML="";root.classList.add("zu-root");
 var header=E("div","zu-app-header");
 var heading=E("div");heading.appendChild(E("h2","","ZEBRASTICKY"));heading.appendChild(E("p","","Tes notes restent sur le bureau après fermeture."));
 header.appendChild(heading);
 header.appendChild(B("+ NOUVEAU POST-IT",function(){
  var notes=getNotes(session),added=makeNote(session,notes);
  if(!added){alert("Maximum de 40 post-it.");return;}
  desktopRefresh();render();
 },"zu-btn zu-primary"));root.appendChild(header);
 var palette=E("div","zu-sticky-palette","JAUNE · ROSE · BLEU · VERT — déplace les notes par leur bande supérieure");
 root.appendChild(palette);
 var list=E("div","zu-sticky-manager-list");root.appendChild(list);
 function render(){
  list.replaceChildren();var notes=getNotes(session);
  if(!notes.length){list.appendChild(E("p","zu-empty","Aucun post-it. Crée ta première note pour l'afficher sur le bureau."));return;}
  notes.forEach(function(n){
   var card=E("div","zu-sticky-manager-card");card.style.borderLeft="7px solid "+(colors[n.color]||colors.yellow);
   var title=E("strong","",n.title);card.appendChild(title);
   var preview=E("textarea");preview.maxLength=2500;preview.placeholder="Écris quelque chose…";
   preview.value=sane(n.text,2500);
   preview.oninput=function(){n.text=preview.value;putNotes(session,notes);desktopRefresh();};
   card.appendChild(preview);
   var bottom=E("div","zu-manager-tools");
   ["yellow","pink","blue","green"].forEach(function(c){
    var dot=B("",function(){n.color=c;putNotes(session,notes);card.style.borderLeft="7px solid "+colors[c];desktopRefresh();},"zu-sticky-dot");
    dot.style.background=colors[c];dot.setAttribute("aria-label","Couleur "+c);bottom.appendChild(dot);
   });
   bottom.appendChild(B("SUPPRIMER",function(){
    if(!confirm("Supprimer ce post-it ?"))return;
    putNotes(session,notes.filter(function(x){return x.id!==n.id;}));desktopRefresh();render();
   },"zu-link zu-danger"));
   card.appendChild(bottom);list.appendChild(card);
  });
 }
 render();
}

/* ZEBRAPLANNER — agenda mensuel + tâches datées, vérification locale. */
function planner(root,session){
 root.innerHTML="";root.classList.add("zu-root","zu-planner");
 var data=read("planner",session,[]);if(!Array.isArray(data))data=[];
 data=data.filter(function(t){return t&&typeof t.id==="string"&&/^\d{4}-\d\d-\d\d$/.test(t.date);}).slice(0,600);
 var today=new Date(),view=new Date(today.getFullYear(),today.getMonth(),1),selected=dateId(today);
 var header=E("div","zu-app-header");
 var heading=E("div");heading.appendChild(E("h2","","ZEBRAPLANNER"));heading.appendChild(E("p","","Ton agenda personnel, enregistré sur cet appareil."));
 header.appendChild(heading);root.appendChild(header);
 var nav=E("div","zu-planner-nav"),month=E("strong","zu-planner-month");
 nav.appendChild(B("‹",function(){view.setMonth(view.getMonth()-1);draw();},"zu-btn zu-month-arrow"));
 nav.appendChild(month);
 nav.appendChild(B("›",function(){view.setMonth(view.getMonth()+1);draw();},"zu-btn zu-month-arrow"));
 nav.appendChild(B("AUJOURD’HUI",function(){var d=new Date();view=new Date(d.getFullYear(),d.getMonth(),1);selected=dateId(d);draw();},"zu-btn zu-today"));
 root.appendChild(nav);
 var week=E("div","zu-planner-week");
 ["LUN","MAR","MER","JEU","VEN","SAM","DIM"].forEach(function(day){week.appendChild(E("span","",day));});root.appendChild(week);
 var grid=E("div","zu-planner-grid");root.appendChild(grid);
 var details=E("section","zu-planner-details"),dayTitle=E("h3");
 details.appendChild(dayTitle);
 var form=E("form","zu-planner-form");
 var input=E("input");input.type="text";input.placeholder="Nouvelle tâche ou événement…";input.maxLength=150;input.required=true;input.setAttribute("aria-label","Nouvelle tâche");
 var when=E("input");when.type="time";when.setAttribute("aria-label","Heure facultative");
 var add=B("AJOUTER",function(){},"zu-btn zu-primary");add.type="submit";
 form.appendChild(input);form.appendChild(when);form.appendChild(add);
 form.onsubmit=function(ev){
  ev.preventDefault();var text=input.value.trim();
  if(!text||data.length>=600)return;
  data.push({id:"task-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),date:selected,text:text.slice(0,150),time:when.value,done:false});
  save("planner",session,data);input.value="";when.value="";draw();
 };
 details.appendChild(form);var entries=E("div","zu-planner-entries");details.appendChild(entries);root.appendChild(details);
 function draw(){
  month.textContent=view.toLocaleDateString("fr-CH",{month:"long",year:"numeric"}).toUpperCase();
  grid.replaceChildren();
  var first=new Date(view.getFullYear(),view.getMonth(),1),offset=(first.getDay()+6)%7;
  var count=new Date(view.getFullYear(),view.getMonth()+1,0).getDate();
  var cellCount=Math.ceil((count+offset)/7)*7;
  for(var i=0;i<cellCount;i++){
   var d=new Date(view.getFullYear(),view.getMonth(),i-offset+1);
   var id=dateId(d),records=data.filter(function(t){return t.date===id;});
   var c=B("",function(day){return function(){selected=day;draw();};}(id),
     "zu-day"+(d.getMonth()!==view.getMonth()?" outside":"")+(id===selected?" chosen":"")+(id===dateId(new Date())?" today":""));
   c.appendChild(E("span","zu-day-num",String(d.getDate())));
   if(records.length)c.appendChild(E("span","zu-day-count",String(records.length)));
   c.setAttribute("aria-label",shortDate(d)+" : "+records.length+" tâche(s)");grid.appendChild(c);
  }
  var parts=selected.split("-").map(Number),date=new Date(parts[0],parts[1]-1,parts[2]);
  dayTitle.textContent=shortDate(date);
  entries.replaceChildren();
  var tasks=data.filter(function(t){return t.date===selected;}).sort(function(a,b){return(a.time||"99:99").localeCompare(b.time||"99:99");});
  if(!tasks.length){entries.appendChild(E("p","zu-hint","Rien de prévu. Profite de ta journée."));return;}
  tasks.forEach(function(t){
   var item=E("div","zu-task"+(t.done?" done":""));
   var label=E("label","zu-task-label"),check=E("input");check.type="checkbox";check.checked=!!t.done;
   check.onchange=function(){t.done=check.checked;save("planner",session,data);draw();};
   label.appendChild(check);
   var content=E("span","",t.time?t.time+" · "+t.text:t.text);label.appendChild(content);item.appendChild(label);
   item.appendChild(B("×",function(){data=data.filter(function(x){return x.id!==t.id;});save("planner",session,data);draw();},"zu-link zu-danger"));
   entries.appendChild(item);
  });
 }
 draw();
}
window.ZebraTools={calculator:calculator,stickyManager:stickyManager,stickyDesktop:stickyDesktop,planner:planner};
}());