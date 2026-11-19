/* ZebraOS — lecteur du livret technique dans la fenêtre Bienvenue.
 * Le manuel est une application d'aide locale à la machine, pas un lanceur.
 */
(function(){
"use strict";
function e(tag,cls,text){
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(text!==undefined)n.textContent=text;
 return n;
}
function button(label,fn,cls){
 const n=e("button",cls||"zm-button",label);n.type="button";n.onclick=fn;return n;
}
function figure(name){
 const wrap=e("figure","zm-figure zm-figure-"+name);
 const diagram=e("div","zm-figure-drawing");
 if(name==="machine"){
  diagram.innerHTML='<div class="zm-crt"><div class="zm-crt-rim"><div class="zm-crt-screen"><div class="zm-crt-led">ZEBRAOS / 2.0</div><div class="zm-crt-terminal">STUDIO COMPUTER<br>SESSION READY<span class="zm-cursor">_</span></div></div></div><div class="zm-crt-controls"><span class="zm-crt-power"><i></i> POWER</span><span class="zm-crt-net">● LINK</span><span class="zm-crt-vline">ZEBRA RECORD</span></div></div>';
 }else if(name==="desktop"){
  diagram.innerHTML='<div class="zm-desk-pict"><div class="zm-desk-icons"><span>▣<small>ZebraAMP</small></span><span>▤<small>Jeux</small></span><span>▦<small>Outils</small></span></div><span class="zm-desk-bin">♲<small>Corbeille</small></span><div class="zm-desk-bar"><b>Z</b> Démarrer <i>▣ Fenêtres</i><time>◷ 12:00</time></div></div>';
 }else if(name==="amp"){
  diagram.innerHTML='<div class="zm-amp-plate"><div class="zm-amp-label">ZEBRAAMP 3.8 <small>STUDIO PLAYER</small></div><div class="zm-amp-readouts"><div class="zm-amp-wave">▁▂▁▅▃▆▄▇▂▄▆▅▃▁</div><div class="zm-amp-track">● LECTURE<br><b>01 — DOMA INTRO</b><br><small>00:47 / 03:12</small></div></div><div class="zm-amp-trackbar"><i></i></div><div class="zm-amp-keys"><span>Ⅰ◀</span><span>▶</span><span>■</span><span>▶Ⅰ</span><span>⇄</span><span>↻</span><span>VIS</span></div></div>';
 }else if(name==="playlist"){
  diagram.innerHTML='<div class="zm-playlist-pict"><div class="zm-pl-head">PLAYLIST <strong>Zebra Tape 2</strong><span>＋ NOUVELLE</span></div><div class="zm-pl-list"><p>▶ &nbsp; 01 · Doma Intro</p><p>▶ &nbsp; 02 · Draw Me a Zebra</p><p>▶ &nbsp; 03 · In My Car</p><p>▶ &nbsp; 04 · Ratchet</p></div><div class="zm-pl-foot">＋ IMPORTER DES SONS &nbsp; / &nbsp; ACTUALISER</div></div>';
 }else if(name==="equalizer"){
  const block=e("div","zm-eq-pict");
  block.appendChild(e("div","zm-eq-caption","ÉGALISEUR / 5 BANDES"));
  const bars=e("div","zm-eq-bars");
  [["GRAVES",50],["BAS-MÉD.",72],["MÉDIUMS",38],["PRÉSENCE",60],["AIGUS",44]].forEach(([key,v])=>{
   const col=e("div","zm-eq-band");const rail=e("div","zm-eq-rail");
   const knob=e("span","zm-eq-knob");knob.style.bottom=v+"%";rail.appendChild(knob);
   col.append(rail,e("small","",key));bars.appendChild(col);
  });
  block.appendChild(bars);diagram.appendChild(block);
 }else if(name==="vis"){
  const viz=e("div","zm-vis-pict");
  viz.appendChild(e("div","zm-vis-header","ZEBRAVIS 2.0   /   SPECTRE 2000"));
  const bars=e("div","zm-vis-bars");
  const heights=[14,20,35,47,56,68,74,66,58,46,42,50,37,25,38,48,39,22,18,30,15,7,9,16,13,7];
  heights.forEach(h=>{const bar=e("i");bar.style.height=h+"%";bars.appendChild(bar);});
  viz.appendChild(bars);viz.appendChild(e("div","zm-vis-footer","75 Hz ────────────────────── 14 kHz"));
  diagram.appendChild(viz);
 }else if(name==="tetris"){
  const pict=e("div","zm-game-pict zm-game-tetris");
  pict.appendChild(e("div","zm-game-side","SCORE\n00180\n\nLIGNES\n00003"));
  const board=e("div","zm-block-board");
  const cells=[
    "..........","..........","..........","..........","..........",
    "..........","..........","..........","..........","..........",
    "....RR....","...RR.....","..........","..........","..........",
    "..........",".....Y..B.","..G.GG.BB.","G.GBBB.BY.","YYYYGGYBB."
  ];
  const colors={R:"#ff5a7d",G:"#61d972",Y:"#ffca43",B:"#5ea7ff"};
  cells.join("").split("").forEach(c=>{const cell=e("i");if(colors[c])cell.style.background=colors[c];board.appendChild(cell);});
  pict.appendChild(board);pict.appendChild(e("div","zm-game-side","SUIVANT\n ▦\n\nRÉSERVE\n ▧"));
  diagram.appendChild(pict);
 }else if(name==="snake"||name==="snake-duel"){
  const pict=e("div","zm-snake-pict");
  pict.appendChild(e("div","zm-snake-head",name==="snake"?"ZNAKE / CHOIX DU MODE":"J1  0010              J2  0010"));
  const field=e("div","zm-snake-field");
  const snake1=[[4,4],[5,4],[6,4],[6,3],[6,2],[6,1]],snake2=[[11,10],[11,11],[11,12],[10,12],[9,12]];
  snake1.forEach(([x,y])=>{const n=e("i","zm-snake-cell zm-snake-one");n.style.left=x/16*100+"%";n.style.top=y/16*100+"%";field.appendChild(n);});
  if(name==="snake-duel")snake2.forEach(([x,y])=>{const n=e("i","zm-snake-cell zm-snake-two");n.style.left=x/16*100+"%";n.style.top=y/16*100+"%";field.appendChild(n);});
  const food=e("i","zm-snake-cell zm-snake-food");food.style.left="62.5%";food.style.top="43.75%";field.appendChild(food);
  pict.appendChild(field);
  pict.appendChild(e("div","zm-snake-foot",name==="snake"?"SOLO   ·   CONTRE ROBOT   ·   VS LOCAL":"← ↓ ↑ →    /    J1 · J2"));
  diagram.appendChild(pict);
 }else if(name==="racer"){
  const pict=e("div","zm-racer-pict");
  ["one","two","three","four"].forEach(x=>pict.appendChild(e("div","zm-racer-ring zm-ring-"+x)));
  pict.appendChild(e("span","zm-racer-ship","◆"));
  pict.appendChild(e("span","zm-racer-label","ECHO RACER / TUNNEL 02"));
  diagram.appendChild(pict);
 }else if(name==="paint"){
  diagram.innerHTML='<div class="zm-paint-pict"><div class="zm-paint-top">Nouveau　＋ Photo　＋ Calque dessin　💾 PNG　💾 .zpaint</div><div class="zm-paint-main"><div class="zm-paint-tools">✥<br>✎<br>▧<br>◯<br>▭<br>◉</div><div class="zm-paint-canvas"><span>ZEBRA</span><strong>PAINT</strong></div></div><div class="zm-paint-layers">CALQUES　▣ Dessin 1　▧ Photo　▰ Fond</div></div>';
 }else if(name==="layers"){
  diagram.innerHTML='<div class="zm-layers-pict"><div class="zm-layers-sheet top">01　✎ Dessin · transparence</div><div class="zm-layers-sheet middle">02　▣ Photo · pixels</div><div class="zm-layers-sheet bottom">03　▰ Fond blanc</div><p>DEVANT ↑　　　　　　　　　　DERRIÈRE ↓</p></div>';
 }else if(name==="archive"){
  diagram.innerHTML='<div class="zm-archive-pict"><div class="zm-archive-file"><span>▣</span><strong>BROUILLON</strong><small>local / automatique</small></div><div class="zm-archive-file"><span>▤</span><strong>PROJET.ZPAINT</strong><small>tous les calques</small></div><div class="zm-archive-file"><span>▧</span><strong>IMAGE.PNG</strong><small>export final aplati</small></div></div>';
 }else if(name==="sticky"){
  diagram.innerHTML='<div class="zm-sticky-pict"><div class="zm-sticky-paper a"><b>⋮⋮ NOTE 01</b><p>Une idée pour le studio...</p><small>● ● ● ●</small></div><div class="zm-sticky-paper b"><b>⋮⋮ NOTE 02</b><p>Penser à terminer la tape.</p><small>● ● ● ●</small></div><div class="zm-sticky-paper c"><b>⋮⋮ NOTE 03</b><p>Mixage / tests</p><small>● ● ● ●</small></div></div>';
 }else if(name==="planner"){
  const pict=e("div","zm-planner-pict");
  pict.appendChild(e("div","zm-calendar-title","NOVEMBRE 2026  ‹　›"));
  const grid=e("div","zm-cal-grid");
  ["L","M","M","J","V","S","D"].forEach(x=>grid.appendChild(e("b","",x)));
  for(let i=0;i<35;i++){const n=e("span","",String(i+1<=30?i+1:""));if([6,15,19,23].includes(i))n.classList.add("zm-cal-mark");grid.appendChild(n);}
  pict.appendChild(grid);pict.appendChild(e("div","zm-calendar-footer","20 NOV　 □ Préparer le mix　＋ AJOUTER"));
  diagram.appendChild(pict);
 }
 wrap.appendChild(diagram);
 wrap.appendChild(e("figcaption","","SCHÉMA DE REPÉRAGE · ILLUSTRATION SIMPLIFIÉE"));
 return wrap;
}
function buildSection(section){
 const type=section.kind;
 const box=e(type==="note"?"aside":"section","zm-section zm-"+type);
 if(type==="note"){
  const badge=e("strong","zm-note-heading",section.title||"NOTE");
  box.append(badge,e("p","",section.text||""));
  return box;
 }
 const h=e("h3","",section.title||"");
 box.appendChild(h);
 if(type==="prose"){
  (section.text||[]).forEach(v=>box.appendChild(e("p","",v)));
 }else if(type==="steps"||type==="index"){
  const list=e(type==="steps"?"ol":"ul",type==="steps"?"zm-steps":"zm-index-list");
  (section.items||[]).forEach(v=>list.appendChild(e("li","",v)));
  box.appendChild(list);
 }else if(type==="fields"||type==="commands"){
  const list=e("dl",type==="fields"?"zm-fields":"zm-commands");
  (section.items||[]).forEach(([key,desc])=>{
   const row=e("div","zm-definition");
   const dt=e("dt");dt.appendChild(e(type==="commands"?"kbd":"strong","",key));
   row.append(dt,e("dd","",desc));list.appendChild(row);
  });
  box.appendChild(list);
 }
 return box;
}
function mount(root,ctx){
 if(root._zebraDispose)root._zebraDispose();
 root.replaceChildren();
 const pages=window.ZebraManualContent;
 if(!Array.isArray(pages)||!pages.length){root.appendChild(e("p","zm-error","Manuel indisponible."));return;}
 const shell=e("div","zm-machine");
 const head=e("header","zm-top");
 const stamp=e("div","zm-stamp","Z");
 const headText=e("div","zm-top-text");
 headText.append(e("strong","","ZEBRAOS · MANUEL DE LA MACHINE"),e("small","","ZEBRA RECORD / ÉDITION STUDIO / NOTICE TECHNIQUE"));
 const topRight=e("div","zm-top-plate","M-01  /  2026");
 head.append(stamp,headText,topRight);
 const middle=e("div","zm-middle");
 const nav=e("nav","zm-nav");
 nav.setAttribute("aria-label","Sommaire du manuel");
 nav.appendChild(e("div","zm-nav-heading","SOMMAIRE / CHAPITRES"));
 const navItems=[],groups=new Map();
 const picker=e("select","zm-picker");picker.setAttribute("aria-label","Choisir une page du manuel");
 pages.forEach((page,i)=>{
  const option=e("option","",(i===0?"COUVERTURE":String(i).padStart(2,"0"))+" / "+page.label);
  option.value=page.id;picker.appendChild(option);
  if(!groups.has(page.group)){
   const heading=e("div","zm-nav-group",page.group);
   nav.appendChild(heading);groups.set(page.group,heading);
  }
  const b=button("",()=>open(i),"zm-nav-item");
  b.dataset.page=page.id;
  b.append(e("span","zm-nav-number",String(i).padStart(2,"0")),e("span","zm-nav-label",page.label));
  navItems.push(b);nav.appendChild(b);
 });
 nav.appendChild(e("div","zm-nav-seal","INVENTAIRE / 17 FEUILLES"));
 const reading=e("div","zm-reading");
 const mobilePicker=e("div","zm-mobile-selector");
 mobilePicker.append(e("span","","FEUILLE"),picker);reading.appendChild(mobilePicker);
 const paper=e("div","zm-paper");
 paper.setAttribute("tabindex","0");
 paper.setAttribute("aria-label","Page du manuel");
 reading.appendChild(paper);
 middle.append(nav,reading);
 const footer=e("footer","zm-footer");
 const back=button("◀ PRÉCÉDENTE",()=>open(current-1),"zm-turn");
 const next=button("SUIVANTE ▶",()=>open(current+1),"zm-turn");
 const folio=e("span","zm-folio","");
 const index=button("SOMMAIRE",()=>open(0),"zm-index-button");
 footer.append(back,index,folio,next);
 shell.append(head,middle,footer);root.appendChild(shell);
 let current=0;
 function open(n){
  if(n<0||n>=pages.length)return;
  current=n;
  const page=pages[n];
  picker.value=page.id;
  navItems.forEach((item,i)=>{
   item.classList.toggle("selected",i===n);
   if(i===n)item.setAttribute("aria-current","page");
   else item.removeAttribute("aria-current");
  });
  paper.replaceChildren();
  const sheet=e("article","zm-sheet"+(n===0?" zm-cover":""));
  const print=e("div","zm-printmark");
  print.append(e("span","",n===0?"ZEBRA RECORD / ARCHIVES":"MODE D'EMPLOI / "+page.group),
               e("span","",n===0?"NOTICE M-01":("FEUILLE "+String(n).padStart(2,"0"))));
  sheet.appendChild(print);
  if(n===0){
   const seal=e("div","zm-cover-seal");seal.appendChild(e("span","","Z"));
   sheet.appendChild(seal);
  }
  sheet.appendChild(e("h1","zm-title",page.title));
  sheet.appendChild(e("p","zm-subtitle",page.subtitle));
  sheet.appendChild(e("p","zm-lead",page.lead));
  if(page.illustration)sheet.appendChild(figure(page.illustration));
  (page.sections||[]).forEach(s=>sheet.appendChild(buildSection(s)));
  sheet.appendChild(e("div","zm-page-end","ZEBRAOS / FIN DE FEUILLE "+String(n).padStart(2,"0")));
  paper.appendChild(sheet);
  paper.scrollTop=0;
  back.disabled=n===0;next.disabled=n===pages.length-1;
  folio.textContent=String(n+1).padStart(2,"0")+" / "+String(pages.length).padStart(2,"0");
 }
 picker.onchange=()=>{const index=pages.findIndex(p=>p.id===picker.value);if(index>=0)open(index);};
 function keys(ev){
  if(!root.isConnected)return;
  const win=root.closest(".window");
  if(win&&(!win.classList.contains("focused")||win.classList.contains("minimized")))return;
  if(ev.altKey||ev.ctrlKey||ev.metaKey||/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName))return;
  if(ev.key==="PageDown"){ev.preventDefault();open(current+1);}
  if(ev.key==="PageUp"){ev.preventDefault();open(current-1);}
 }
 document.addEventListener("keydown",keys);
 root._zebraDispose=function(){
  document.removeEventListener("keydown",keys);
  root._zebraDispose=null;
 };
 open(0);
}
window.ZebraManual={mount:mount};
}());