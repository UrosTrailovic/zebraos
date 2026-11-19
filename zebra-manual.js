/* ZebraOS — pages d'aide ouvertes depuis le Bienvenue d'origine.
 * Pas de façade supplémentaire, pas de lanceur, pas de nouvelle fenêtre.
 */
(function(){
"use strict";
function element(tag,cls,text){
 var n=document.createElement(tag);
 if(cls)n.className=cls;
 if(text!==undefined)n.textContent=text;
 return n;
}
function button(text,fn,cls){
 var n=element("button",cls||"classic-button",text);
 n.type="button";n.onclick=fn;return n;
}
function open(root,choice,back){
 if(!root)return;
 if(root._zebraDispose)root._zebraDispose();
 var pages=window.ZebraManualContent||[];
 function render(id){
  root.replaceChildren();
  var panel=element("div","zmm-page");
  var toolbar=element("div","zmm-toolbar");
  var goBack=button("◀ Retour",function(){if(id==="index"||id==="amp")back();else render("index");});
  toolbar.appendChild(goBack);
  toolbar.appendChild(element("span","zmm-toolbar-label","Bienvenue dans ZebraOS"));
  if(id!=="index"){
   toolbar.appendChild(button("Autres programmes",function(){render("index");},"classic-button zmm-tools-link"));
  }
  panel.appendChild(toolbar);
  var body=element("div","zmm-body");
  panel.appendChild(body);
  root.appendChild(panel);
  if(id==="index"){
   body.appendChild(element("h2","zmm-title","Découvrir les programmes"));
   body.appendChild(element("p","zmm-intro","Choisis un programme pour consulter ses commandes et son fonctionnement."));
   var list=element("div","zmm-index-list");
   pages.forEach(function(page){
    var row=button("",function(){render(page.id);},"classic-button zmm-index-item");
    row.appendChild(element("strong","",page.name));
    row.appendChild(element("small","",page.intro));
    list.appendChild(row);
   });
   body.appendChild(list);
   return;
  }
  var page=pages.find(function(p){return p.id===id;});
  if(!page){body.appendChild(element("p","","Ce manuel n'est pas disponible."));return;}
  body.appendChild(element("h2","zmm-title",page.name));
  body.appendChild(element("p","zmm-intro",page.intro));
  (page.sections||[]).forEach(function(section,i){
   var area=element("section","zmm-section");
   area.appendChild(element("h3","",section.title));
   if(section.image){
    var figure=element("figure","zmm-photo");
    var img=element("img");
    img.loading=i===0?"eager":"lazy";
    img.decoding="async";
    img.alt="Capture de "+page.name+" : "+section.title;
    img.src="assets/manual/"+section.image;
    img.onerror=function(){
     figure.replaceChildren(element("p","zmm-image-missing","Capture momentanément indisponible."));
    };
    figure.appendChild(img);
    area.appendChild(figure);
   }
   if(section.description)area.appendChild(element("p","zmm-description",section.description));
   if(section.items&&section.items.length){
    var dl=element("dl","zmm-keys");
    section.items.forEach(function(item){
     var line=element("div","zmm-key-row");
     line.appendChild(element("dt","",item[0]));
     line.appendChild(element("dd","",item[1]));
     dl.appendChild(line);
    });
    area.appendChild(dl);
   }
   body.appendChild(area);
  });
  var foot=element("div","zmm-bottom");
  foot.appendChild(button("◀ Retour",function(){if(id==="amp")back();else render("index");}));
  body.appendChild(foot);
  body.scrollTop=0;
 }
 render(choice);
}
window.ZebraManual={open:open};
}());