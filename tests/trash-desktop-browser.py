"""ZebraOS — régression de la Corbeille et du bureau Windows-like.
Tests sur vrais scripts et vrais styles de l'application, en Chromium.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE="http://127.0.0.1:8765/"
PATH="STUDIO/BUREAU/Jeux/Echo Racer 2 Beta.exe.zebraos.json"
OUT=Path("trash-desktop-screenshots")
OUT.mkdir(exist_ok=True)

def setup(page,session="zebra"):
    page.goto(BASE+"?trash-ui-test=1",wait_until="domcontentloaded")
    page.wait_for_function("Boolean(window.ZebraDesktop&&window.ZebraGitFiles&&window.ZebraTextEditor)",timeout=25000)
    page.evaluate("""(path)=>{
       document.querySelectorAll('.screen').forEach(el=>el.classList.remove('active'));
       const screen=document.querySelector('#desktop-screen');
       screen.classList.add('active');
       document.querySelector('#start-menu').classList.add('hidden');
       localStorage.setItem('zebra.desktop.v1.zebra',JSON.stringify({
         positions:{wide:{},narrow:{}},trash:[path],racerTrashSeeded:true
       }));
       const root=document.querySelector('#desktop-icons');
       root.replaceChildren();
       const fakeIcon=(name,size)=>{
         const s=document.createElement('span');
         s.className='os-icon-graphic';
         s.textContent=name==='racer'?'◈':'▣';
         s.style.cssText='display:inline-flex;align-items:center;justify-content:center;width:'+size+'px;height:'+size+'px;background:#e1e1cb;border:1px solid #888;color:#18246b;font-size:24px';
         return s;
       };
       window.__trashFakeIcon=fakeIcon;
       for(let i=0;i<3;i++){
         const icon=document.createElement('button');
         icon.className='desk-icon desk-user-file';
         icon.dataset.path='STUDIO/BUREAU/DEMO-'+i;
         icon.append(fakeIcon('txt',36),document.createElement('span'));
         icon.lastChild.textContent='Fichier '+i;
         root.append(icon);
       }
       window.ZebraDesktop.setup('zebra',()=>{},()=>{},fakeIcon);
       window.ZebraDesktop.bind();
       const w=document.createElement('div');
       w.className='window focused';w.id='trash-regression';
       w.style.cssText='width:560px;height:430px;position:absolute;left:550px;top:35px;z-index:101';
       const bar=document.createElement('div');bar.className='titlebar';
       bar.textContent='Corbeille — ZebraOS';
       const body=document.createElement('div');body.className='window-body';
       w.append(bar,body);document.querySelector('#windows-area').append(w);
       window.__trashBody=body;
       window.ZebraDesktop.showTrash(body,'zebra',null,()=>{});
    }""",PATH)
    page.wait_for_function("document.querySelectorAll('.zu-trash-entry').length===1",timeout=20000)
    return page.locator("#trash-regression")

def check_desktop(browser):
    context=browser.new_context(viewport={"width":1280,"height":800})
    page=context.new_page()
    setup(page)
    win=page.locator("#trash-regression")
    assert win.locator(".github-drive-toolbar").count()==1
    assert win.locator(".folder-path").inner_text()=="C:\\BUREAU\\Corbeille"
    assert win.locator(".folder-view-control").count()==1
    assert win.locator(".zu-trash-header,.zu-trash-description,.zu-trash-list,.zu-trash-item").count()==0
    assert win.locator(".zu-trash-entry .bureau-item-symbol").count()==1
    assert win.locator(".zu-trash-entry .github-file-name").inner_text()=="Echo Racer 2 Beta.exe"
    assert page.evaluate("(path)=>window.ZebraDesktop.isTrashed('zebra',path)",PATH)
    # Toutes les présentations standards doivent rester fonctionnelles.
    view=win.locator(".folder-view-select")
    view.select_option("list")
    assert win.locator(".zu-trash-grid").get_attribute("data-view")=="list"
    view.select_option("large")
    assert win.locator(".zu-trash-grid").get_attribute("data-view")=="large"
    win.screenshot(path=str(OUT/"desktop-trash.png"))
    # La première visite teste le glisser hors de la fenêtre.
    page.wait_for_timeout(950)  # la liste distante a terminé sa mise à jour
    item=win.locator(".zu-trash-entry")
    item.wait_for(state="visible")
    rect=item.bounding_box(timeout=12000)
    assert rect is not None, "Icône introuvable pour le glisser"
    cx=rect["x"]+rect["width"]/2
    cy=rect["y"]+rect["height"]/2
    page.mouse.move(cx,cy)
    page.mouse.down()
    page.mouse.move(cx+24,cy+12,steps=6)
    assert page.locator(".zu-trash-drag-preview").count()==1
    page.mouse.move(260,500,steps=9) # outside window, still over bureau
    page.mouse.up()
    assert item.count()==0
    assert not page.evaluate("(path)=>window.ZebraDesktop.isTrashed('zebra',path)",PATH)
    assert page.locator(".zu-trash-drag-preview").count()==0
    # La deuxième visite teste clic droit -> Restaurer avec le même stockage local.
    setup(page)
    win=page.locator("#trash-regression")
    # Clic droit -> Restaurer (aucun autre changement au mécanisme de corbeille).
    win.locator(".zu-trash-entry").click(button="right")
    assert page.get_by_role("button",name="Restaurer",exact=True).count()==1
    page.get_by_role("button",name="Restaurer",exact=True).click()
    assert win.locator(".zu-trash-entry").count()==0
    assert not page.evaluate("(path)=>window.ZebraDesktop.isTrashed('zebra',path)",PATH)
    stored=page.evaluate("JSON.parse(localStorage.getItem('zebra.desktop.v1.zebra')).trash")
    assert stored==[],stored
    # Le rectangle bleu Windows sélectionne les icônes, sans déplacer leur position.
    # Les icônes de démonstration sont créées en haut à gauche du vrai bureau.
    screen=page.locator("#desktop-screen")
    page.mouse.move(270,340)
    page.mouse.down()
    page.mouse.move(5,6,steps=8)
    assert page.locator(".zu-selection-rect").count()==1
    assert page.locator(".zu-selection-rect").evaluate("(n)=>getComputedStyle(n).backgroundColor")!="rgba(0, 0, 0, 0)"
    screenshot=OUT/"desktop-selection.png"
    page.screenshot(path=str(screenshot))
    page.mouse.up()
    assert page.locator(".zu-selection-rect").count()==0
    assert page.locator("#desktop-icons .desk-icon.selected").count()>=2
    # Cliquez dans une zone vide pour désélectionner.
    page.mouse.click(380,600)
    assert page.locator("#desktop-icons .desk-icon.selected").count()==0
    context.close()
    print("TRASH_DESKTOP_PASS",flush=True)

def check_mobile(browser):
    context=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    page=context.new_page()
    setup(page)
    win=page.locator("#trash-regression")
    assert win.locator(".zu-trash-entry").count()==1
    assert win.locator(".zu-trash-grid").count()==1
    win.screenshot(path=str(OUT/"mobile-trash.png"))
    icon=win.locator(".zu-trash-entry")
    center=icon.bounding_box()
    icon.dispatch_event("pointerdown",{
      "pointerId":53,"pointerType":"touch","isPrimary":True,"button":0,
      "clientX":center["x"]+20,"clientY":center["y"]+20
    })
    page.wait_for_timeout(740)
    assert page.get_by_role("button",name="Restaurer",exact=True).count()==1
    page.get_by_role("button",name="Restaurer",exact=True).click()
    assert not page.evaluate("(path)=>window.ZebraDesktop.isTrashed('zebra',path)",PATH)
    context.close()
    print("TRASH_MOBILE_PASS",flush=True)

def check_text(browser):
    context=browser.new_context(viewport={"width":1200,"height":850})
    page=context.new_page()
    page.goto(BASE+"?txt-ui-test=1",wait_until="domcontentloaded")
    page.wait_for_function("Boolean(window.ZebraTextEditor)",timeout=15000)
    page.evaluate("""() => {
      const body=document.createElement('div');body.className='window-body';body.id='text-regression';
      document.body.appendChild(body);
      window.ZebraTextEditor.mount(body,{
        path:'STUDIO/BUREAU/thanks.txt',name:'thanks.txt',type:'file'
      },{session:'zebra',source:(x)=>'/'+x.path});
    }""")
    page.wait_for_function("""() => {
      const area=document.querySelector('#text-regression .ztext-area');
      return area&&!area.disabled;
    }""",timeout=18000)
    pane=page.locator("#text-regression")
    labels=pane.inner_text().lower()
    assert "github" not in labels,labels
    assert pane.locator(".ztext-toolbar,.ztext-name,.ztext-saved,.ztext-hint,.ztext-button").count()==0
    assert pane.locator(".ztext-area").count()==1
    assert pane.locator(".ztext-counter").count()==1
    assert "navigateur" not in labels
    assert "zebra record" not in pane.locator(".ztext-area").input_value().lower()
    textarea=pane.locator(".ztext-area")
    textarea.fill("Essai sauvegarde locale")
    page.wait_for_timeout(490)
    saved=page.evaluate("localStorage.getItem('zebra.text.v1.zebra.STUDIO/BUREAU/thanks.txt')")
    assert saved=="Essai sauvegarde locale",saved
    assert "23 caractères" in pane.locator(".ztext-counter").inner_text()
    print("TXT_CLEAN_PASS",flush=True)
    context.close()

with sync_playwright() as p:
    browser=p.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
    check_desktop(browser)
    check_mobile(browser)
    check_text(browser)
    browser.close()
print("TRASH_DESKTOP_SUITE_PASS",flush=True)
