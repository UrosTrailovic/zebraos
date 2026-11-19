"""Tests de la notice M-01 dans un vrai navigateur (desktop et mobile)."""
from pathlib import Path
from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/"
SCREENSHOTS=Path("manual-test-screenshots")
SCREENSHOTS.mkdir(exist_ok=True)

def run(browser,width,height,mobile):
    ctx=browser.new_context(viewport={"width":width,"height":height},is_mobile=mobile,has_touch=mobile)
    page=ctx.new_page()
    errors=[]
    page.on("pageerror",lambda err:errors.append(str(err)))
    page.goto(URL,wait_until="domcontentloaded")
    page.evaluate("""() => {
      window.__manualLaunches=[];
      const win=document.createElement('div');
      win.id='manual-test-window';
      win.className='window focused';
      win.style.width='960px';win.style.height='710px';win.style.left='20px';win.style.top='20px';
      const bar=document.createElement('div');bar.className='titlebar';bar.textContent='ZebraOS — Manuel de la machine';
      const body=document.createElement('div');body.className='window-body';
      win.append(bar,body);document.body.append(win);
      window.__manualTestRoot=body;
      const ctx={
       windowBox(id,title,w,h){return body;},
       session(){return 'zebra';},
       openApp(name){window.__manualLaunches.push(name);}
      };
      window.ZebraControlPanel.welcome(ctx);
    }""")
    root=page.locator("#manual-test-window")
    assert root.locator(".zm-machine").count()==1,"Le manuel n'a pas été monté"
    assert root.locator(".zm-nav-item").count()==17,"Nombre de feuilles erroné"
    assert root.locator(".zm-figure").count()==1,"Schéma de couverture absent"
    assert "L'ORDINATEUR DU STUDIO" in root.locator(".zm-title").inner_text()
    assert not root.locator("a[href]").count(),"Un manuel ne doit pas agir comme un lanceur web"
    if mobile:
        assert root.locator(".zm-picker").is_visible(),"Sommaire mobile absent"
        assert not root.locator(".zm-nav").is_visible(),"Index PC encore visible en mobile"
        root.locator(".zm-picker").select_option("amp")
    else:
        assert root.locator(".zm-nav").is_visible(),"Sommaire desktop absent"
        root.locator(".zm-nav-item[data-page=amp]").click()
    assert "ZEBRAAMP" in root.locator(".zm-title").inner_text(),"Page AMP inaccessible"
    assert root.locator(".zm-amp-plate").count()==1,"Schéma AMP absent"
    assert "Morceau précédent" in root.locator(".zm-sheet").inner_text()
    assert page.evaluate("window.__manualLaunches.length")==0,"Le manuel a lancé une application"
    # Navigation de feuilles
    root.locator(".zm-footer .zm-turn").last.click()
    assert "BIBLIOTHÈQUE" in root.locator(".zm-title").inner_text()
    root.locator(".zm-footer .zm-turn").first.click()
    assert "ZEBRAAMP" in root.locator(".zm-title").inner_text()
    # Vérifier chaque feuille, toutes accessibles via le sélecteur
    page.evaluate("""() => {
      for(const item of window.ZebraManualContent){
       document.querySelector('.zm-picker').value=item.id;
       document.querySelector('.zm-picker').dispatchEvent(new Event('change',{bubbles:true}));
       if(!document.querySelector('.zm-title')?.textContent)throw Error('Page vide : '+item.id);
       if(document.querySelectorAll('.zm-sheet .zm-section').length===0)throw Error('Aucun contenu : '+item.id);
      }
    }""")
    def visit(chapter):
        if mobile:
            root.locator(".zm-picker").select_option(chapter)
        else:
            root.locator('.zm-nav-item[data-page="'+chapter+'"]').click()
    visit("znake-modes")
    assert "CONTRE ROBOT" in root.locator(".zm-sheet").inner_text()
    visit("znake-controls")
    assert "VS LOCAL" in root.locator(".zm-sheet").inner_text()
    visit("paint-layers")
    assert "Fond blanc" in root.locator(".zm-sheet").inner_text()
    visit("paint-save")
    assert ".ZPAINT" in root.locator(".zm-sheet").inner_text()
    visit("planner")
    assert "ZEBRAPLANNER" in root.locator(".zm-title").inner_text()
    dimensions=page.evaluate("""() => {
      const root=document.querySelector('.zm-machine');
      const paper=root.querySelector('.zm-paper');
      const footer=root.querySelector('.zm-footer');
      const rect=root.getBoundingClientRect();
      return {
        manualW:rect.width,manualH:rect.height,
        overflowX:Math.max(0,root.scrollWidth-root.clientWidth),
        paperOverflowX:Math.max(0,paper.scrollWidth-paper.clientWidth),
        paperScrollable:paper.scrollHeight>=paper.clientHeight,
        footerVisible:footer.getBoundingClientRect().bottom<=window.innerHeight+2,
        pageTitle:paper.querySelector('.zm-title').textContent
      };
    }""")
    assert dimensions["manualW"]>290 and dimensions["manualH"]>250,dimensions
    assert dimensions["overflowX"]<3,dimensions
    assert dimensions["paperOverflowX"]<5,dimensions
    assert dimensions["footerVisible"],dimensions
    assert page.evaluate("window.__manualLaunches.length")==0
    assert errors==[],errors
    if not mobile:
        visit("accueil")
    path=SCREENSHOTS/("mobile.png" if mobile else "desktop.png")
    root.screenshot(path=str(path))
    print("MANUEL_CHECK",{"device":"mobile" if mobile else "desktop","pages":17,"noLaunch":True,"viewport":f"{width}x{height}","dimensions":dimensions,"screenshot":str(path)},flush=True)
    # Fermer la fenêtre doit retirer le gestionnaire de touches et rester sans exception.
    page.evaluate("""() => {
      const body=window.__manualTestRoot;
      if(body._zebraDispose)body._zebraDispose();
      body.closest('.window').remove();
    }""")
    assert errors==[],errors
    ctx.close()

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
    run(browser,1366,900,False)
    run(browser,390,844,True)
    browser.close()
print("MANUEL_PASS")
