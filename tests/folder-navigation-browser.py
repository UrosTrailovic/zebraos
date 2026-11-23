"""Vérifie les 3 vraies icônes de navigation dans les trois types de dossier."""
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE="http://127.0.0.1:8765/"
OUT=Path("folder-navigation-screenshots")
OUT.mkdir(exist_ok=True)
EXPECTED=["nav-ordinateur.png","nav-retour.png","nav-actualiser.png"]

def check_icons(page,selector):
    buttons=page.locator(selector)
    assert buttons.count()==3,(selector,buttons.count())
    imgs=buttons.locator("img.github-nav-icon")
    assert imgs.count()==3,(selector,imgs.count())
    try:
        page.wait_for_function("""(selector)=>{
          const imgs=[...document.querySelectorAll(selector+' img.github-nav-icon')];
          return imgs.length===3 && imgs.every(x=>x.complete && x.naturalWidth===64 && x.naturalHeight===64);
        }""",arg=selector,timeout=14000)
    except Exception:
        detail=page.evaluate("""async (selector)=>{
          const imgs=[...document.querySelectorAll(selector+' img.github-nav-icon')];
          const result=[];
          for(const x of imgs){
            let status='unknown',size=0;
            try{const r=await fetch(x.src);status=r.status;size=(await r.arrayBuffer()).byteLength;}catch(e){status=e.message;}
            result.push({src:x.src,natural:[x.naturalWidth,x.naturalHeight],
              complete:x.complete,status,size});
          }
          return result;
        }""",selector)
        print("NAV_BITMAP_DEBUG",selector,detail,flush=True)
        raise
    parts=buttons.evaluate_all("""els=>els.map(e=>{
      const b=e.getBoundingClientRect();
      return {width:b.width,height:b.height,alt:e.getAttribute('aria-label'),
              src:e.querySelector('img').getAttribute('src')};
    })""")
    assert all(x["width"]==parts[0]["width"] and x["height"]==parts[0]["height"] for x in parts),parts
    assert [x["src"].split("?")[0].split("/")[-1] for x in parts]==EXPECTED,parts
    assert parts[0]["width"]>=36 and parts[0]["height"]>=36,parts
    assert all(x["alt"] for x in parts),parts
    return parts

def check(browser,w,h,mobile):
    ctx=browser.new_context(viewport={"width":w,"height":h},
                            is_mobile=mobile,has_touch=mobile)
    page=ctx.new_page()
    page.goto(BASE+"?nav-check=v1",wait_until="domcontentloaded")
    page.wait_for_function("Boolean(window.ZebraGitFiles&&window.ZebraLocalFiles&&window.ZebraDesktop)",timeout=20000)
    page.evaluate("""() => {
      const icon=(name,n)=>{
        const s=document.createElement('span');s.textContent=name;s.style.width=n+'px';return s;
      };
      window.__testIcon=icon;
      function mountWindow(id){
        const w=document.createElement('div');w.id='nav-'+id;w.className='window focused';
        w.style.cssText='position:fixed;top:30px;left:14px;width:570px;height:445px;z-index:9999';
        const title=document.createElement('div');title.className='titlebar';
        const text=document.createElement('span');text.className='windowtitle';title.appendChild(text);
        const close=document.createElement('button');close.setAttribute('data-close','');title.append(close);
        const body=document.createElement('div');body.className='window-body';
        w.append(title,body);document.body.append(w);return body;
      }
      window.__testFolderWindow=mountWindow;
      const host=mountWindow('public');
      window.ZebraGitFiles.mount(host,window.ZebraGitFiles.root,{
        session:'zebra',canUpload:false,osIcon:icon,
        windowBox(){return document.createElement('div')}
      });
    }""")
    public=page.locator("#nav-public")
    check_icons(page,"#nav-public .github-drive-toolbar>.github-nav-button")
    public.screenshot(path=str(OUT/("mobile-public.png" if mobile else "desktop-public.png")))
    # Aller à la racine est toujours actif après substitution de l'icône.
    public.get_by_role("button",name="Poste de travail").click()
    check_icons(page,"#nav-public .github-drive-toolbar>.github-nav-button")

    # Disque local : son moteur IndexedDB reste le même.
    page.evaluate("""() => {
      const host=window.__testFolderWindow('local');
      window.ZebraLocalFiles.mount(host,window.ZebraLocalFiles.root,{
        osIcon:window.__testIcon,github(){},windowBox(){}
      });
    }""")
    page.wait_for_selector("#nav-local .local-nav-button",timeout=16000)
    check_icons(page,"#nav-local .local-disk-toolbar>.local-nav-button")
    page.locator("#nav-local").screenshot(path=str(OUT/("mobile-local.png" if mobile else "desktop-local.png")))

    # La Corbeille reprend la même barre et ne perd pas la restauration.
    page.evaluate("""() => {
      const session='zebra';
      localStorage.setItem('zebra.desktop.v1.zebra',JSON.stringify({
         positions:{wide:{},narrow:{}},trash:[],racerTrashSeeded:true
      }));
      window.ZebraDesktop.setup(session,()=>{},()=>{},window.__testIcon);
      const host=window.__testFolderWindow('trash');
      window.ZebraDesktop.showTrash(host,session,null,()=>{});
    }""")
    check_icons(page,"#nav-trash .github-drive-toolbar>.github-nav-button")
    assert page.locator("#nav-trash .folder-view-control").count()==1
    page.locator("#nav-trash").screenshot(path=str(OUT/("mobile-trash.png" if mobile else "desktop-trash.png")))
    print("FOLDER_NAV_PASS",{"mobile":mobile,"size":f"{w}x{h}"},flush=True)
    ctx.close()

with sync_playwright() as p:
    browser=p.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
    check(browser,1280,800,False)
    check(browser,390,844,True)
    browser.close()
print("FOLDER_NAV_ALL_PASS",flush=True)
