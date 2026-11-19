"""Le site public doit afficher le Bienvenue historique et ses vraies captures."""
from pathlib import Path
from urllib.request import urlopen,Request
from playwright.sync_api import sync_playwright

BASE="https://www.zebratape2.net/"
FILES=["amp.webp","amp-controls.webp","amp-playlists.webp","amp-speed.webp","amp-reverb.webp",
       "zebravis.webp","tetris.webp","znake-menu.webp","znake-versus.webp",
       "paint.webp","sticky.webp","planner.webp"]
OUT=Path("manual-production-screenshots")
OUT.mkdir(exist_ok=True)

for name,mark in [
    ("",b"zebra-manual-content.js?v=2.0"),
    ("zebra-manual-content.js",b"window.ZebraManualContent="),
    ("zebra-manual.js",b"window.ZebraManual={open:open}"),
    ("control-panel.js",b'window.ZebraManual.open(root,"amp"'),
    ("zebra-manual.css",b".zmm-page")
]:
    url=BASE+name+"?manual-check=v2"
    with urlopen(Request(url,headers={"Cache-Control":"no-cache","User-Agent":"ZebraOS-Welcome-Control"}),timeout=30) as res:
        data=res.read()
        assert res.status==200 and mark in data,(url,res.status)
    print("WELCOME_LIVE_FILE",name or "index",len(data),flush=True)
for filename in FILES:
    url=BASE+"assets/manual/"+filename+"?manual-check=v2"
    with urlopen(Request(url,headers={"Cache-Control":"no-cache","User-Agent":"ZebraOS-Welcome-Control"}),timeout=30) as res:
        data=res.read()
        assert res.status==200 and data[:4]==b"RIFF" and data[8:12]==b"WEBP",(url,res.status)
    print("WELCOME_LIVE_SCREENSHOT",filename,len(data),flush=True)

with sync_playwright() as p:
    browser=p.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
    for w,h,mobile in [(1366,900,False),(390,844,True)]:
        ctx=browser.new_context(viewport={"width":w,"height":h},is_mobile=mobile,has_touch=mobile)
        page=ctx.new_page()
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(BASE+"?manual-check=v2",wait_until="domcontentloaded",timeout=40000)
        page.wait_for_function("Boolean(window.ZebraManual&&window.ZebraControlPanel)",timeout=35000)
        page.evaluate("""() => {
          window.__unexpectedLaunches=[];
          const w=document.createElement('div');w.className='window focused';w.id='live-welcome';
          w.style.cssText='width:670px;height:440px;left:20px;top:20px;z-index:999999';
          const body=document.createElement('div');body.className='window-body';w.appendChild(body);
          document.body.appendChild(w);
          window.ZebraControlPanel.welcome({windowBox(){return body;},session(){return 'zebra';},openApp(v){window.__unexpectedLaunches.push(v);}});
        }""")
        wrapper=page.locator("#live-welcome")
        assert wrapper.locator(".zcp-welcome-head h2").inner_text()=="Bienvenue dans ZebraOS"
        wrapper.screenshot(path=str(OUT/("mobile-bienvenue.png" if mobile else "desktop-bienvenue.png")))
        wrapper.get_by_role("button",name="Découvrir ZebraAMP").click()
        assert wrapper.locator(".zmm-title").inner_text()=="ZebraAMP"
        img=wrapper.locator(".zmm-photo img").first
        img.wait_for(state="visible")
        page.wait_for_function("""() => {
          const image=document.querySelector('#live-welcome .zmm-photo img');
          return image&&image.complete&&image.naturalWidth>0;
        }""",timeout=20000)
        assert page.evaluate("window.__unexpectedLaunches.length")==0
        wrapper.screenshot(path=str(OUT/("mobile-amp.png" if mobile else "desktop-amp.png")))
        wrapper.get_by_role("button",name="◀ Retour").first.click()
        assert wrapper.locator(".zcp-welcome-head h2").count()==1
        assert errors==[],errors
        print("WELCOME_LIVE_BROWSER_PASS",{"mobile":mobile,"width":w,"height":h},flush=True)
        ctx.close()
    browser.close()
print("WELCOME_LIVE_PASS",flush=True)
