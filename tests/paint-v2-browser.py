#!/usr/bin/env python3
"""ZebraPaint 2: outils, objets modifiables, dimensions, nommage, projet v1/v2."""
from pathlib import Path
import json
from PIL import Image
from playwright.sync_api import sync_playwright

BASE="http://127.0.0.1:8765/"
OUT=Path("paint-v2-screenshots")
OUT.mkdir(exist_ok=True)
REPORT={}

def mount(page,mobile=False):
    page.goto(BASE+"?paint-version=2.0",wait_until="domcontentloaded")
    page.wait_for_function("Boolean(window.ZebraLazyApps&&window.ZebraLazyApps.load)",timeout=25000)
    page.evaluate("""async (mobile) => {
      await window.ZebraLazyApps.load('paint');
      const host=document.createElement('div');
      host.id='paint-v2-test';
      host.dataset.zebraSession='zebra';
      host.className='zebra-game-body';
      host.style.cssText='position:fixed;top:5px;left:0;width:'+(mobile?'390px':'1050px')+
        ';height:'+(mobile?'775px':'855px')+';z-index:999999;display:block;background:#c0c0c0;';
      const fakeWindow=document.createElement('div');
      fakeWindow.className='window focused';
      fakeWindow.style.cssText='position:absolute;inset:0';
      fakeWindow.append(host);document.body.append(fakeWindow);
      window.ZebraPaint.mount(host);
    }""",mobile)
    page.locator("#paint-v2-test .zp-layer-entry").first.wait_for(timeout=20000)
    page.wait_for_function("""() => {
      const status=document.querySelector('#paint-v2-test .zp-autosave-status');
      return status&& !status.textContent.includes('chargement');
    }""",timeout=12000)

def at(page,x,y):
    rect=page.locator(".zp-canvas-frame").bounding_box()
    assert rect, "toile introuvable"
    d=page.locator(".zp-canvas").evaluate("(n)=>({w:n.width,h:n.height})")
    return rect["x"]+(x/d["w"])*rect["width"], rect["y"]+(y/d["h"])*rect["height"]

def choose(page,name):
    page.get_by_role("button",name=name,exact=True).click()

def drag(page,x0,y0,x1,y1):
    ax,ay=at(page,x0,y0)
    bx,by=at(page,x1,y1)
    page.mouse.move(ax,ay);page.mouse.down()
    page.mouse.move(bx,by,steps=9);page.mouse.up()

def check_desktop(browser):
    ctx=browser.new_context(viewport={"width":1200,"height":940},accept_downloads=True)
    page=ctx.new_page()
    errors=[];page.on("pageerror",lambda err:errors.append(str(err)))
    mount(page)
    assert page.locator('.zp-tool[aria-label="Crayon"]').count()==0
    assert page.locator('.zp-tool[aria-label="Pinceau"]').count()==1
    assert page.locator('.zp-tool').count()==9
    assert page.locator('.zp-tool-art img.zp-tool-texture').count()==9
    page.wait_for_function("""() => [...document.querySelectorAll('.zp-tool-texture')]
      .every(img=>img.complete&&img.naturalWidth===32&&img.naturalHeight===32)""")
    labels=page.locator(".zp-menu button").all_text_contents()
    assert not any("💾" in text or "📂" in text for text in labels),labels
    layout=page.evaluate("""() => {
      const work=document.querySelector('.zp-work').getBoundingClientRect();
      const side=document.querySelector('.zp-sidebar').getBoundingClientRect();
      const layers=document.querySelector('.zp-layer-panel').getBoundingClientRect();
      const opacity=document.querySelector('.zp-opacity-input').getBoundingClientRect();
      return {workRight:work.right,sideLeft:side.left,layersTop:layers.top,opacityTop:opacity.top,
              sideWidth:side.width};
    }""")
    assert layout["sideLeft"]>=layout["workRight"]-2,layout
    assert layout["opacityTop"]>layout["layersTop"],layout
    assert 275<=layout["sideWidth"]<=325,layout
    resizer=page.locator(".zp-layer-resizer")
    before=page.locator(".zp-layer-list").bounding_box()
    grip=resizer.bounding_box()
    assert before and grip
    page.mouse.move(grip["x"]+grip["width"]/2,grip["y"]+grip["height"]/2)
    page.mouse.down();page.mouse.move(grip["x"]+grip["width"]/2,grip["y"]+90,steps=8);page.mouse.up()
    after=page.locator(".zp-layer-list").bounding_box()
    assert after and after["height"]>before["height"]+60,(before,after)
    assert page.locator(".window.paint-window").count()==1
    REPORT["desktopRightSidebar"]=True
    REPORT["resizableLayerList"]=True
    REPORT["paintWindowResizableClass"]=True
    REPORT["pixelToolIcons"]=True
    REPORT["plainFileButtons"]=True
    REPORT["pencilRemoved"]=True
    for name in ("Texte","Rectangle","Ellipse","Ligne"):
        choose(page,name)
        cursor=page.locator(".zp-canvas").evaluate("(n)=>getComputedStyle(n).cursor")
        work_cursor=page.locator(".zp-work").evaluate("(n)=>getComputedStyle(n).cursor")
        assert cursor=="crosshair" and work_cursor=="crosshair",(name,cursor,work_cursor)
        assert not page.locator(".zp-brush-cursor").is_visible()
    REPORT["shapeTextCursorVisible"]=True
    choose(page,"Pinceau")
    x,y=at(page,60,80)
    page.mouse.move(x,y)
    ring=page.locator(".zp-brush-cursor")
    assert ring.is_visible()
    size=ring.bounding_box()
    assert size and 5<size["width"]<9,size
    choose(page,"Gomme")
    x,y=at(page,60,80)
    page.mouse.move(x,y)
    size2=ring.bounding_box()
    assert size2 and size2["width"]>size["width"]*1.8,size2
    REPORT["cursorRealSize"]=True

    choose(page,"Pinceau")
    # Départ dans les 12px de marge autour de la toile ; la ligne entre ensuite dedans.
    drag(page,-7,100,65,100)
    color=page.evaluate("""() => {
      const layer=[...document.querySelectorAll('.zp-raster-layer')].at(-1);
      return [...layer.getContext('2d').getImageData(20,100,1,1).data];
    }""")
    assert color[3]>200 and color[0]<40,color
    REPORT["strokeStartedOutside"]=True

    choose(page,"Rectangle")
    drag(page,100,100,250,220)
    assert page.locator(".zp-vector-object").count()==1
    assert page.locator(".zp-vector-details").is_visible()
    page.locator(".zp-vector-fill-enabled").check()
    page.locator(".zp-vector-fill-color").evaluate("""x=>{
       x.value='#00bb22';x.dispatchEvent(new Event('change',{bubbles:true}));
    }""")
    page.locator(".zp-object-width").fill("180")
    page.locator(".zp-object-width").dispatch_event("change")
    shape=page.evaluate("""() => {
      const n=document.querySelector('.zp-vector-object');
      const c=n.querySelector('canvas');
      return {width:c.width,fill:c.getContext('2d').getImageData(90,50,1,1).data[1],
              nodeWidth:n.style.width};
    }""")
    assert shape["width"]==180 and shape["fill"]>=150,shape
    REPORT["editableShape"]=True

    choose(page,"Texte")
    x,y=at(page,290,150)
    page.mouse.click(x,y)
    assert page.locator(".zp-vector-object").count()==2
    textEditor=page.locator(".zp-vector-text")
    textEditor.fill("ZEBRAOS")
    textEditor.press("Tab")
    fontSelect=page.locator(".zp-vector-font-family")
    assert fontSelect.is_visible()
    assert fontSelect.locator("option").count()>=8
    fontSelect.select_option("Georgia")
    assert fontSelect.input_value()=="Georgia"
    fontSelect.select_option("Courier New")
    assert fontSelect.input_value()=="Courier New"
    fontUsed=page.evaluate("""() => {
      const text=[...document.querySelectorAll('.zp-vector-object')].at(-1);
      return text.querySelector('canvas').getContext('2d').font;
    }""")
    assert "Courier New" in fontUsed,fontUsed
    REPORT["editableFontFamily"]=True
    assert page.evaluate("""() => {
      const n=[...document.querySelectorAll('.zp-vector-object')].at(-1);
      const c=n.querySelector('canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      for(let i=3;i<d.length;i+=4)if(d[i]>0)return true;
      return false;
    }""")
    REPORT["editableText"]=True

    page.get_by_role("button",name="Format de la toile").click()
    modal=page.locator(".zp-dialog")
    assert modal.get_attribute("role")=="dialog"
    inputs=modal.locator("input")
    assert inputs.count()==2
    inputs.nth(0).fill("800")
    inputs.nth(1).fill("500")
    modal.get_by_role("button",name="Valider").click()
    dims=page.evaluate("""() => {
      const frame=document.querySelector('.zp-canvas-frame');
      const layer=[...document.querySelectorAll('.zp-raster-layer')].at(-1);
      return {width:frame.style.width,height:frame.style.height,
        pixels:[...layer.getContext('2d').getImageData(20,100,1,1).data]};
    }""")
    assert dims["width"]=="800px" and dims["height"]=="500px",dims
    assert dims["pixels"][3]>200 and dims["pixels"][0]<40,dims
    REPORT["resizePreservesPixels"]=True

    page.locator("#paint-v2-test").screenshot(path=str(OUT/"desktop-editor.png"))
    page.get_by_role("button",name="Projet .zpaint",exact=False).click()
    popup=page.locator(".zp-dialog")
    assert popup.count()==1
    popup.locator("input").fill("Ma creation.zpaint")
    with page.expect_download() as info:
        popup.get_by_role("button",name="Valider").click()
    item=info.value
    assert item.suggested_filename=="Ma creation.zpaint",item.suggested_filename
    dest=OUT/"test_project.zpaint";item.save_as(str(dest))
    parsed=json.loads(dest.read_text())
    assert parsed["version"]==2 and parsed["width"]==800 and parsed["height"]==500
    objs=[x for x in parsed["layers"] if x["type"]=="vector"]
    assert {x["kind"] for x in objs}=={"rect","text"},objs
    assert any(x["text"]=="ZEBRAOS" for x in objs),objs
    assert any(x["kind"]=="text" and x["fontFamily"]=="Courier New" for x in objs),objs
    assert any(x["kind"]=="rect" and x["fill"]=="#00bb22" for x in objs),objs
    REPORT["zpaintExportNameAndObjects"]=True

    page.get_by_role("button",name="Enregistrer PNG",exact=False).click()
    popup=page.locator(".zp-dialog")
    popup.locator("input").fill("Affiche.png")
    with page.expect_download() as info:
        popup.get_by_role("button",name="Valider").click()
    item=info.value
    assert item.suggested_filename=="Affiche.png"
    png=OUT/"test_output.png";item.save_as(str(png))
    with Image.open(png) as img:
        assert img.size==(800,500),img.size
        px=img.convert("RGBA").getpixel((20,100))
        assert px[0]<50 and px[3]>200,px
    REPORT["pngExportNameAndResolution"]=True

    # Réouvrir le fichier .zpaint réellement téléchargé, sans perdre ses objets.
    page.locator('.zp-menu input[accept=".zpaint,application/json"]').set_input_files(str(dest))
    page.wait_for_function("""() => {
      return document.querySelectorAll('.zp-vector-object').length===2 &&
      document.querySelector('.zp-canvas-frame').style.width==='800px';
    }""",timeout=14000)
    REPORT["projectReopenObjects"]=True
    reloaded_font=page.evaluate("""() => {
      const texts=[...document.querySelectorAll('.zp-vector-object')]
        .map(n=>n.querySelector('canvas').getContext('2d').font);
      return texts;
    }""")
    assert any("Courier New" in f for f in reloaded_font),reloaded_font
    REPORT["projectReopenFont"]=True

    # Full HD est aussi possible avec le nouveau format; Annuler restaure la taille.
    page.get_by_role("button",name="Format de la toile").click()
    dlg=page.locator(".zp-dialog")
    dlg.locator("input").nth(0).fill("1920")
    dlg.locator("input").nth(1).fill("1080")
    dlg.get_by_role("button",name="Valider").click()
    assert page.locator(".zp-canvas").evaluate("(n)=>[n.width,n.height]")==[1920,1080]
    page.locator(".zp-edits button").first.click()
    assert page.locator(".zp-canvas").evaluate("(n)=>[n.width,n.height]")==[800,500]
    REPORT["fullHDAndUndo"]=True

    # Le trait finit APRES que la première autosauvegarde a pu se déclencher.
    row=page.locator(".zp-layer-entry").filter(has_text="Dessin 1")
    row.locator(".zp-layer-choice").click()
    choose(page,"Pinceau")
    ax,ay=at(page,20,350)
    bx,by=at(page,280,350)
    page.mouse.move(ax,ay);page.mouse.down()
    page.wait_for_timeout(1150)
    page.mouse.move(bx,by,steps=10);page.mouse.up()
    def stroke_present():
        return page.evaluate("""() => {
          const surface=[...document.querySelectorAll('.zp-raster-layer')].at(-1);
          const a=surface.getContext('2d').getImageData(270,350,1,1).data;
          return a[3]>200 && a[0]<50;
        }""")
    assert stroke_present()
    page.evaluate("""() => {
      const host=document.getElementById('paint-v2-test');
      host._zebraDispose();
      window.ZebraPaint.mount(host);
    }""")
    try:
        page.wait_for_function("""() => {
          const layers=[...document.querySelectorAll('.zp-raster-layer')];
          if(layers.length<2)return false;
          const a=layers.at(-1).getContext('2d').getImageData(270,350,1,1).data;
          return a[3]>200 && a[0]<50;
        }""",timeout=9000)
    except Exception:
        debug=page.evaluate("""async () => {
          const layers=[...document.querySelectorAll('.zp-raster-layer')];
          const pixel=l=>l ? [...l.getContext('2d').getImageData(270,350,1,1).data] : [];
          const current={status:document.querySelector('.zp-autosave-status')?.textContent,
            layers:[...document.querySelectorAll('.zp-layer-entry')].map(x=>x.textContent.slice(0,45)),
            canvas:[document.querySelector('.zp-canvas')?.width,document.querySelector('.zp-canvas')?.height],
            pixels:layers.map(pixel)};
          const db=await new Promise((ok,no)=>{
            const req=indexedDB.open('ZebraPaintDrafts');
            req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error);
          });
          const record=await new Promise((ok,no)=>{
            const req=db.transaction('projects','readonly').objectStore('projects').get('session:zebra');
            req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error);
          });
          const data=record?.project;
          current.saved={updatedAt:record?.updatedAt,version:data?.version,
           dim:[data?.width,data?.height],layers:data?.layers.map(x=>({type:x.type,
            name:x.name,imageBytes:x.image?.length}))};
          const images=(data?.layers||[]).filter(l=>l.type==='raster');
          current.savedPixels=[];
          for(const l of images){
            const image=await new Promise((ok,no)=>{
              const v=new Image();v.onload=()=>ok(v);v.onerror=()=>no(Error('PNG load'));
              v.src=l.image;
            });
            const canvas=document.createElement('canvas');
            canvas.width=image.width;canvas.height=image.height;
            const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
            current.savedPixels.push([...ctx.getImageData(270,350,1,1).data]);
          }
          return current;
        }""")
        print("LONG_STROKE_DEBUG",json.dumps(debug,ensure_ascii=False),flush=True)
        raise
    REPORT["longStrokeDraftRestored"]=True
    draft_fonts=page.evaluate("""() => [...document.querySelectorAll('.zp-vector-object')]
      .map(x=>x.querySelector('canvas').getContext('2d').font)""")
    assert any("Courier New" in f for f in draft_fonts),draft_fonts
    REPORT["fontRestoredFromDraft"]=True
    assert not errors,errors
    print("PAINT_V2_DESKTOP_PASS",REPORT,flush=True)
    ctx.close()

def check_mobile(browser):
    ctx=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True,accept_downloads=True)
    page=ctx.new_page()
    errors=[];page.on("pageerror",lambda err:errors.append(str(err)))
    mount(page,True)
    assert page.locator('.zp-tool[aria-label="Crayon"]').count()==0
    page.get_by_role("button",name="Texte",exact=True).click()
    cursor=page.locator(".zp-canvas").evaluate("(n)=>getComputedStyle(n).cursor")
    assert cursor=="crosshair",cursor
    page.get_by_role("button",name="Sélection",exact=True).click()
    rect=page.locator(".zp-canvas-frame").bounding_box()
    assert rect and rect["width"]<=390,rect
    assert 1.56<rect["width"]/rect["height"]<1.64,rect
    page.get_by_role("button",name="Format de la toile").click()
    modal=page.locator(".zp-dialog")
    modal.locator("input").nth(0).fill("500")
    modal.locator("input").nth(1).fill("500")
    modal.get_by_role("button",name="Valider").click()
    rect=page.locator(".zp-canvas-frame").bounding_box()
    assert rect and 0.96<rect["width"]/rect["height"]<1.04,rect
    assert rect["width"]<=390,rect
    page.get_by_role("button",name="Texte",exact=True).click()
    page.locator(".zp-canvas").dispatch_event("pointerdown",{
      "pointerId":3,"pointerType":"touch","isPrimary":True,"button":0,
      "clientX":rect["x"]+rect["width"]*.35,
      "clientY":rect["y"]+rect["height"]*.35
    })
    font=page.locator(".zp-vector-font-family")
    assert font.is_visible()
    font.select_option("Verdana")
    assert font.input_value()=="Verdana"
    assert page.evaluate("""() => [...document.querySelectorAll('.zp-vector-object')]
      .some(x=>x.querySelector('canvas').getContext('2d').font.includes('Verdana'))""")
    page.locator("#paint-v2-test").screenshot(path=str(OUT/"mobile-editor.png"))
    assert not errors,errors
    print("PAINT_V2_MOBILE_PASS",flush=True)
    ctx.close()

with sync_playwright() as pw:
    browser=pw.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
    check_desktop(browser)
    check_mobile(browser)
    browser.close()
print("PAINT_V2_ALL_PASS",flush=True)

