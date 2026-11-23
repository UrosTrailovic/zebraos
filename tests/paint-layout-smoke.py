#!/usr/bin/env python3
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE="http://127.0.0.1:8765/paint-harness.html"
OUT=Path("paint-layout-screenshots")
OUT.mkdir(exist_ok=True)

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path="/usr/bin/chromium",headless=True,
        args=["--no-sandbox","--disable-dev-shm-usage"])
    for name,viewport,mobile in (
        ("desktop",{"width":1200,"height":820},False),
        ("mobile",{"width":390,"height":844},True),
    ):
        ctx=browser.new_context(viewport=viewport,is_mobile=mobile,has_touch=mobile)
        page=ctx.new_page(); errors=[]
        page.on("pageerror",lambda err:errors.append(str(err)))
        page.goto(BASE,wait_until="networkidle")
        page.locator(".zp-layer-entry").first.wait_for()
        assert page.locator(".zp-tool-art img.zp-tool-texture").count()==9
        assert page.locator(".zp-tool-name").count()==0
        labels=page.locator(".zp-menu button").all_text_contents()
        assert not any("💾" in x or "📂" in x for x in labels),labels
        if not mobile:
            boxes=page.evaluate("""() => Object.fromEntries(['.zp-tools','.zp-work','.zp-sidebar'].map(s=>{
              const r=document.querySelector(s).getBoundingClientRect();return [s,{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right}]
            }))""")
            assert boxes[".zp-tools"]["x"] < boxes[".zp-work"]["x"] < boxes[".zp-sidebar"]["x"],boxes
            assert boxes[".zp-sidebar"]["w"]>=280,boxes
            assert page.locator(".zp-opacity-input").is_visible()
            assert page.locator(".zp-sidebar-resizer").is_visible()
        else:
            boxes=page.evaluate("""() => {const w=document.querySelector('.zp-work').getBoundingClientRect();
              const s=document.querySelector('.zp-sidebar').getBoundingClientRect();return {w,s}}""")
            assert boxes["s"]["y"]>=boxes["w"]["y"],boxes
        page.screenshot(path=str(OUT/(name+".png")),full_page=True)
        assert not errors,errors
        ctx.close()
    browser.close()
print("PAINT_LAYOUT_SMOKE_PASS")
