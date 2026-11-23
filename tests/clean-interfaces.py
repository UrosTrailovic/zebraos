#!/usr/bin/env python3
"""UI regressions: no folder-creation commands and no decorative wallpaper heading."""
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE="http://127.0.0.1:8765/"
OUT=Path("clean-interfaces-screenshots")
OUT.mkdir(exist_ok=True)

def run(browser, width, height, mobile):
    context=browser.new_context(
        viewport={"width":width,"height":height},
        is_mobile=mobile,has_touch=mobile
    )
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    page.goto(BASE+"?clean-interfaces=1",wait_until="domcontentloaded")
    page.wait_for_function("""() => Boolean(
      window.ZebraWallpaper&&window.ZebraDesktop&&window.ZebraGitFiles&&window.ZebraLocalFiles
    )""",timeout=22000)
    page.evaluate("""async () => {
      document.querySelectorAll(".screen").forEach(e=>e.classList.remove("active"));
      document.getElementById("desktop-screen").classList.add("active");
      window.ZebraWallpaper.apply("zebra");
      let work=document.getElementById("clean-ui-test");
      if(!work){
        work=document.createElement("div");work.id="clean-ui-test";
        work.style.cssText="position:fixed;top:10px;left:10px;z-index:999999;"+
          "width:360px;max-width:calc(100vw - 20px);height:90vh;overflow:auto;"+
          "background:#c5c5c5;padding:6px";
        document.body.append(work);
      }
      const make=label=>{
        const pane=document.createElement("div");pane.className="window";
        const title=document.createElement("span");title.className="windowtitle";
        const host=document.createElement("div");host.className="window-body";
        pane.append(title,host);
        work.append(pane);return host;
      };
      const wp=make("Wallpaper");wp.id="clean-wallpaper";
      ZebraWallpaper.mount(wp);
      const publicHost=make("Public");publicHost.id="clean-public";
      ZebraGitFiles.mount(publicHost,"STUDIO/BUREAU",{
        session:"zebra",canUpload:false,
        osIcon:(name,n)=>{const x=document.createElement("span");x.textContent=name;return x;},
        windowBox:()=>document.createElement("div")
      });
      const privateHost=make("Private");privateHost.id="clean-private";
      await ZebraLocalFiles.mount(privateHost,ZebraLocalFiles.root,{
        session:"zebra",
        osIcon:(name,n)=>{const x=document.createElement("span");x.textContent=name;return x;},
        windowBox:()=>document.createElement("div")
      });
      ZebraDesktop.setup("zebra",()=>{},()=>{},(name)=>{
        const x=document.createElement("span");x.textContent=name;return x;
      });
      const screen=document.getElementById("desktop-screen");
      screen.dispatchEvent(new MouseEvent("contextmenu",{
        bubbles:true,cancelable:true,clientX:5,clientY:5
      }));
    }""")
    page.locator("#clean-wallpaper .wallpaper-preview").wait_for(timeout=12000)
    page.locator("#clean-public .github-drive-toolbar").wait_for(timeout=12000)
    page.locator("#clean-private .local-disk-toolbar").wait_for(timeout=12000)
    result=page.evaluate("""() => {
      const w=document.getElementById("clean-wallpaper");
      const p=document.getElementById("clean-public");
      const l=document.getElementById("clean-private");
      return {
        headerCount:w.querySelectorAll(".wallpaper-heading").length,
        hasOldTitle:w.textContent.includes("Personnaliser votre arrière-plan"),
        hasOldSubtitle:w.textContent.includes("Ce fond appartient uniquement à la session"),
        hasWallpaperPreview:!!w.querySelector(".wallpaper-preview"),
        hasModeSelect:!!w.querySelector("#wallpaper-mode"),
        hasGallery:!!w.querySelector("#wallpaper-gallery"),
        publicCreate:[...p.querySelectorAll("button")].some(x=>x.textContent.includes("+ Dossier")),
        privateCreate:[...l.querySelectorAll("button")].some(x=>x.textContent.includes("+ Dossier")),
        desktopCreate:[...document.querySelectorAll(".zu-desktop-menu button")]
          .some(x=>x.textContent.includes("Nouveau dossier")),
        publicNavigation:p.querySelectorAll(".github-nav-button").length,
        privateNavigation:l.querySelectorAll(".local-nav-button").length,
        hasDropSystem:!!window.ZebraFileMoves?.move
      };
    }""")
    assert result["headerCount"]==0,result
    assert not result["hasOldTitle"] and not result["hasOldSubtitle"],result
    assert result["hasWallpaperPreview"] and result["hasModeSelect"] and result["hasGallery"],result
    assert not result["publicCreate"] and not result["privateCreate"] and not result["desktopCreate"],result
    assert result["publicNavigation"]==3 and result["privateNavigation"]==3,result
    assert result["hasDropSystem"],result
    assert not errors,errors
    page.locator("#clean-wallpaper").screenshot(path=str(OUT/("mobile-wallpaper.png" if mobile else "desktop-wallpaper.png")))
    print("CLEAN_UI_PASS",{"mobile":mobile,**result},flush=True)
    context.close()

with sync_playwright() as p:
    browser=p.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
    run(browser,1280,800,False)
    run(browser,390,844,True)
    browser.close()
print("CLEAN_UI_SUITE_PASS",flush=True)
