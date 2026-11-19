"""Vérification réelle du manuel déployé sur www.zebratape2.net."""
from pathlib import Path
from urllib.request import Request, urlopen
from playwright.sync_api import sync_playwright

BASE="https://www.zebratape2.net/"
OUT=Path("manual-production-screenshots")
OUT.mkdir(exist_ok=True)
checks={
    "":b"zebra-manual-content.js?v=1.0",
    "zebra-manual-content.js":b"window.ZebraManualContent=Object.freeze(pages)",
    "zebra-manual.js":b"window.ZebraManual={mount:mount}",
    "zebra-manual.css":b".zm-machine",
    "control-panel.js":b"window.ZebraManual.mount(root,ctx)"
}
for path,mark in checks.items():
    url=BASE+path+"?proof=20261119-m01"
    with urlopen(Request(url,headers={"Cache-Control":"no-cache","User-Agent":"ZebraOS-manual-check"}),timeout=35) as response:
        data=response.read()
        assert response.status==200,(url,response.status)
        assert mark in data,(url,"marqueur manuel absent")
        print("LIVE_RESOURCE_OK",url,len(data),flush=True)

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
    for width,height,mobile in [(1366,900,False),(390,844,True)]:
        ctx=browser.new_context(viewport={"width":width,"height":height},is_mobile=mobile,has_touch=mobile)
        page=ctx.new_page()
        errors=[]
        page.on("pageerror",lambda err:errors.append(str(err)))
        page.goto(BASE+"?live-manuel=20261119",wait_until="domcontentloaded",timeout=40000)
        page.wait_for_function("Boolean(window.ZebraManual&&window.ZebraManualContent&&window.ZebraControlPanel)",timeout=35000)
        page.evaluate("""() => {
          window.__liveAppLaunches=[];
          const w=document.createElement('div');
          w.id='manual-live-test';w.className='window focused';
          w.style.cssText='width:960px;height:710px;left:30px;top:30px;z-index:999999;';
          const bar=document.createElement('div');bar.className='titlebar';bar.textContent='ZebraOS — Manuel de la machine';
          const body=document.createElement('div');body.className='window-body';
          w.append(bar,body);document.body.appendChild(w);
          window.ZebraControlPanel.welcome({
           windowBox(){return body;},
           session(){return 'zebra';},
           openApp(name){window.__liveAppLaunches.push(name);}
          });
        }""")
        wrapper=page.locator("#manual-live-test")
        assert wrapper.locator(".zm-nav-item").count()==17
        assert wrapper.locator(".zm-sheet .zm-title").inner_text()=="L'ORDINATEUR DU STUDIO"
        filename="mobile.png" if mobile else "desktop.png"
        wrapper.screenshot(path=str(OUT/filename))
        if mobile:
            wrapper.locator(".zm-picker").select_option("paint-layers")
        else:
            wrapper.locator(".zm-nav-item[data-page=paint-layers]").click()
        assert "ZEBRAPAINT · CALQUES & IMAGES" in wrapper.locator(".zm-title").inner_text()
        assert page.evaluate("window.__liveAppLaunches.length")==0
        assert not errors,errors
        print("LIVE_MANUAL_BROWSER_OK",filename,flush=True)
        ctx.close()
    browser.close()
print("LIVE_MANUAL_PASS",flush=True)
