"""Captures réelles des programmes pour les guides du Bienvenue ZebraOS.
La capture est faite sur le moteur actuel des applications, dans Chromium.
Ne recrée aucun dessin d'interface artificiel.
"""
from pathlib import Path
import json
import time
from PIL import Image
from playwright.sync_api import sync_playwright

BASE="http://127.0.0.1:8765/"
OUT=Path("assets/manual")
OUT.mkdir(parents=True,exist_ok=True)

def snapshot(page,name,selector,delay=0.6):
    loc=page.locator(selector)
    loc.wait_for(state="visible",timeout=15000)
    page.wait_for_timeout(int(delay*1000))
    png=OUT/("_temp_"+name+".png")
    loc.screenshot(path=str(png),animations="disabled",timeout=15000)
    picture=Image.open(png).convert("RGB")
    if picture.width>1000:
        picture.thumbnail((1000,850),Image.Resampling.LANCZOS)
    target=OUT/(name+".webp")
    picture.save(target,format="WEBP",quality=76,method=6)
    png.unlink()
    print("MANUAL_SCREEN",name,picture.size,target.stat().st_size,flush=True)

with sync_playwright() as p:
    browser=p.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage","--autoplay-policy=no-user-gesture-required"])
    context=browser.new_context(viewport={"width":1460,"height":1100},device_scale_factor=1)
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda err:errors.append(str(err)))
    page.goto(BASE,wait_until="domcontentloaded")
    page.wait_for_function("Boolean(window.ZebraAMP&&window.ZebraTools&&window.ZebraLazyApps)")
    page.evaluate("""() => {
      window.__captureWindows={};
      window.__capWindow=function(id,width,height){
        const old=window.__captureWindows[id];
        if(old&&old.isConnected)return old.querySelector('.window-body');
        const win=document.createElement('div');
        win.className='window focused';
        win.id='cap-'+id;
        win.style.cssText='position:fixed;left:10px;top:10px;z-index:999999;width:'+width+'px;height:'+height+'px;max-width:none;';
        const title=document.createElement('div');
        title.className='titlebar';
        title.innerText=id+'.exe — ZebraOS';
        const body=document.createElement('div');
        body.className='window-body';
        body.dataset.zebraSession='zebra';
        win.append(title,body);
        document.body.append(win);
        window.__captureWindows[id]=win;
        return body;
      };
      window.__destroyCap=function(id) {
        const win=window.__captureWindows[id];
        if(win){
          const body=win.querySelector('.window-body');
          if(body?._zebraDispose)body._zebraDispose();
          win.remove();delete window.__captureWindows[id];
        }
      };
    }""")

    # ZebraAMP : six captures du même vrai lecteur.
    page.evaluate("""() => {
      window.ZebraAMPConfig={windowBox(id,title,width,height){return window.__capWindow(id,width||690,height||740);}};
      window.ZebraAMP.open();
    }""")
    snapshot(page,"amp","#cap-amp",0.8)
    snapshot(page,"amp-controls","#cap-amp .amp3-controls")
    snapshot(page,"amp-playlists","#cap-amp .amp3-playlist-tools")
    page.locator("#cap-amp .amp3-speed-btn").click()
    snapshot(page,"amp-speed","#cap-amp .amp3-speed-panel",0.25)
    page.locator("#cap-amp .amp3-speed-btn").click()
    page.locator("#cap-amp .amp3-reverb-btn").click()
    snapshot(page,"amp-reverb","#cap-amp .amp3-reverb-panel",0.25)
    page.locator("#cap-amp .amp3-visual-btn").click()
    page.locator("#cap-visualizer .zviz").wait_for(state="visible",timeout=25000)
    snapshot(page,"zebravis","#cap-visualizer",0.8)
    page.evaluate("window.__destroyCap('visualizer');window.__destroyCap('amp');")

    # Tetris, avec ses vraies commandes.
    page.evaluate("window.ZebraLazyApps.load('tetris')")
    page.evaluate("""() => window.ZebraTetris.mount(window.__capWindow('tetris',760,820))""")
    snapshot(page,"tetris","#cap-tetris",0.7)
    page.evaluate("window.__destroyCap('tetris')")

    # Znake : menu et partie contre ZnakeBot.
    page.evaluate("window.ZebraLazyApps.load('snake')")
    page.evaluate("""() => window.ZebraSnake.mount(window.__capWindow('znake',685,765))""")
    snapshot(page,"znake-menu","#cap-znake",0.7)
    page.locator("#cap-znake [data-mode=robot]").click()
    page.locator("#cap-znake [data-level='1']").click()
    snapshot(page,"znake-versus","#cap-znake",1.0)
    page.evaluate("window.__destroyCap('znake')")

    # ZebraPaint : atelier vierge et outils réels.
    page.evaluate("window.ZebraLazyApps.load('paint')")
    page.evaluate("""() => window.ZebraPaint.mount(window.__capWindow('paint',930,740))""")
    snapshot(page,"paint","#cap-paint",0.7)
    page.evaluate("window.__destroyCap('paint')")

    # ZebraSticky : remplir le gestionnaire avec des notes de démonstration.
    page.evaluate("""() => {
      localStorage.setItem('zebra.tools.v1.sticky.zebra',JSON.stringify([
        {id:'n1',title:'NOTE 01',text:'Idée pour le studio',color:'yellow',x:55,y:75},
        {id:'n2',title:'NOTE 02',text:'Préparer la prochaine session',color:'pink',x:265,y:85}
      ]));
      window.ZebraTools.stickyManager(window.__capWindow('sticky',710,510),'zebra',()=>{});
    }""")
    snapshot(page,"sticky","#cap-sticky",0.6)
    page.evaluate("window.__destroyCap('sticky')")

    # ZebraPlanner : vrai agenda avec exemple non personnel.
    page.evaluate("""() => {
      const now=new Date();
      const date=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
      localStorage.setItem('zebra.tools.v1.planner.zebra',JSON.stringify([
        {id:'a',date,text:'Session studio',time:'18:00',done:false}
      ]));
      window.ZebraTools.planner(window.__capWindow('planner',920,690),'zebra');
    }""")
    snapshot(page,"planner","#cap-planner",0.6)
    page.evaluate("window.__destroyCap('planner')")

    assert len(list(OUT.glob("*.webp")))==12,list(OUT.glob("*.webp"))
    print("MANUAL_CAPTURE_PASS",len(list(OUT.glob("*.webp"))),flush=True)
    if errors:
        print("BROWSER_ERRORS",json.dumps(errors[:5],ensure_ascii=False),flush=True)
    context.close()
    browser.close()
