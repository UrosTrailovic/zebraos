"""Régression : Bienvenue doit rester celui d'origine ; les guides s'ouvrent dedans."""
from pathlib import Path
from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/"
OUT=Path("manual-test-screenshots")
OUT.mkdir(exist_ok=True)

def check(browser,w,h,mobile):
    ctx=browser.new_context(viewport={"width":w,"height":h},is_mobile=mobile,has_touch=mobile)
    page=ctx.new_page()
    errors=[]
    page.on("pageerror",lambda err:errors.append(str(err)))
    page.goto(URL,wait_until="domcontentloaded")
    page.wait_for_function("Boolean(window.ZebraControlPanel&&window.ZebraManualContent&&window.ZebraManual)")
    page.evaluate("""() => {
      window.__welcomeLaunches=[];
      const win=document.createElement('div');
      win.className='window focused';win.id='welcome-regression';
      win.style.cssText='width:670px;height:440px;left:20px;top:20px;z-index:999999;';
      const bar=document.createElement('div');bar.className='titlebar';bar.textContent='Bienvenue dans ZebraOS';
      const body=document.createElement('div');body.className='window-body';
      win.append(bar,body);document.body.append(win);
      window.__welcomeCtx={
        windowBox(){return body;},
        session(){return 'zebra';},
        openApp(id){window.__welcomeLaunches.push(id);},
        closeWindow(){win.remove();}
      };
      window.ZebraControlPanel.welcome(window.__welcomeCtx);
    }""")
    wrapper=page.locator("#welcome-regression")
    # Le panneau ne propose plus d'onglet Système, ni d'ancienne identité.
    branding=page.evaluate("""() => {
      const settings=document.createElement('div');
      window.ZebraControlPanel.mount(settings,window.__welcomeCtx);
      const titles=[...settings.querySelectorAll('.zcp-item-title')].map(x=>x.textContent);
      const status=settings.querySelector('.zcp-status')?.textContent || '';
      const about=document.createElement('div');
      window.ZebraControlPanel.about({windowBox(){return about;},session(){return 'zebra';}});
      return {titles,status,about:about.textContent,
        manuals:JSON.stringify(window.ZebraManualContent)};
    }""")
    assert "Système" not in branding["titles"],branding
    assert branding["titles"]==["Bienvenue","Fond d’écran","Sons","Date et heure",
                               "Performances","À propos de ZebraOS"],branding
    assert branding["status"].startswith("6 éléments"),branding
    for key in ("about","manuals"):
        visible=branding[key].lower()
        assert "zebra record" not in visible and "zebra report" not in visible
        assert "studio" not in visible,(key,visible[:200])
    assert "studio" not in page.locator(".zcp-welcome-head").inner_text().lower()

    assert wrapper.locator(".zcp-welcome-head h2").inner_text()=="Bienvenue dans ZebraOS"
    assert wrapper.locator(".zcp-welcome-art img").count()==1
    assert wrapper.locator(".zcp-welcome-actions .classic-button").count()==6
    old_buttons=["Découvrir ZebraAMP","Ouvrir les fichiers","Personnaliser le fond","Régler la date et l’heure"]
    labels=wrapper.locator(".zcp-welcome-actions .classic-button").all_inner_texts()
    assert labels[:4]==old_buttons,labels
    # Le bouton existant ne lance plus le lecteur.
    wrapper.get_by_role("button",name="Découvrir ZebraAMP").click()
    assert wrapper.locator(".zmm-title").inner_text()=="ZebraAMP"
    assert "Le lecteur" in wrapper.locator(".zmm-body").inner_text()
    assert wrapper.locator(".zmm-photo img").count()==6
    assert page.evaluate("window.__welcomeLaunches")==[]
    text=wrapper.locator(".zmm-page").inner_text().upper()
    for forbidden in ["ARCHIVES","NOTICE M-01","ZEBRA RECORD /"]:
        assert forbidden not in text,forbidden
    screenshot=OUT/("mobile-guide.png" if mobile else "desktop-guide.png")
    wrapper.screenshot(path=str(screenshot))
    wrapper.get_by_role("button",name="◀ Retour").first.click()
    assert wrapper.locator(".zcp-welcome-head").count()==1
    # Les manuels des jeux et outils restent dans Bienvenue, pas dans une seconde fenêtre.
    wrapper.get_by_role("button",name="Manuels des jeux et outils").click()
    assert wrapper.locator(".zmm-index-item").count()==6
    for name in ["ZebraTetris","Znake","ZebraPaint","ZebraSticky","ZebraPlanner"]:
        assert wrapper.get_by_role("button",name=name,exact=False).count()>=1,name
    wrapper.get_by_role("button",name="Znake",exact=False).click()
    assert wrapper.locator(".zmm-title").inner_text()=="Znake"
    assert "CONTRE ROBOT" in wrapper.locator(".zmm-body").inner_text()
    assert page.evaluate("window.__welcomeLaunches")==[]
    wrapper.get_by_role("button",name="◀ Retour").first.click()
    assert wrapper.locator(".zmm-index-item").count()==6
    wrapper.get_by_role("button",name="◀ Retour").first.click()
    assert wrapper.locator(".zcp-welcome-head").count()==1
    # Vérifier les anciens accès au dossier et aux réglages préservés.
    wrapper.get_by_role("button",name="Ouvrir les fichiers").click()
    assert page.evaluate("window.__welcomeLaunches")==["explorer"]
    # Contrôler les débordements.
    dims=page.evaluate("""() => {
      const w=document.querySelector('#welcome-regression');
      const b=w.querySelector('.window-body');
      return {w:w.getBoundingClientRect().width,h:w.getBoundingClientRect().height,
              overflow:Math.max(0,b.scrollWidth-b.clientWidth)};
    }""")
    assert dims["overflow"]<8,dims
    assert errors==[],errors
    print("WELCOME_RESTORE_PASS",{"device":"mobile" if mobile else "desktop","viewport":f"{w}x{h}","dimensions":dims,"screenshot":str(screenshot)},flush=True)
    ctx.close()

with sync_playwright() as p:
    browser=p.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
    check(browser,1366,900,False)
    check(browser,390,844,True)
    browser.close()
print("WELCOME_MANUAL_PASS")
