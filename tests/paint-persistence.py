#!/usr/bin/env python3
"""ZebraPaint : non-regression navigateur pour l'empilement et le brouillon."""
import io
import json
from PIL import Image
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8765/"
REPORT = {}

def pixel(page, x, y):
    shot = page.locator(".zp-canvas-frame").screenshot()
    image = Image.open(io.BytesIO(shot)).convert("RGB")
    return image.getpixel((x, y))

def mount(page):
    page.evaluate("""async () => {
      await window.ZebraLazyApps.load('paint');
      const host=document.createElement('div');
      host.id='paint-regression-host';
      host.dataset.zebraSession='zebra';
      host.className='zebra-game-body';
      host.style.cssText='position:fixed;top:5px;left:5px;width:960px;height:785px;z-index:999999;display:block;background:#c0c0c0;';
      document.body.appendChild(host);
      window.ZebraPaint.mount(host);
    }""")
    page.locator(".zp-layer-entry").first.wait_for()

def paint_line(page, color, y):
    page.evaluate("""([color,y])=>{
      const paint=document.querySelector('.zp');
      paint.querySelector('.zp-options input[type="color"]').value=color;
      paint.querySelector('.zp-options input[type="color"]').dispatchEvent(new Event('input',{bubbles:true}));
      const canvas=paint.querySelector('.zp-canvas');
      const box=paint.querySelector('.zp-canvas-frame').getBoundingClientRect();
      const fire=(type,x)=>{
       const ev=new PointerEvent(type,{bubbles:true,cancelable:true,isPrimary:true,pointerType:'mouse',pointerId:87,button:0,
        clientX:box.left+(x/640)*box.width,clientY:box.top+(y/400)*box.height});
       canvas.dispatchEvent(ev);
      };
      fire('pointerdown',280);fire('pointermove',360);fire('pointerup',360);
    }""", [color,y])

def open_photo(page):
    page.evaluate("""async ()=>{
      const pic=document.createElement('canvas');pic.width=180;pic.height=120;
      const p=pic.getContext('2d');p.fillStyle='#0066ff';p.fillRect(0,0,180,120);
      const blob=await new Promise(ok=>pic.toBlob(ok,'image/png'));
      const input=document.querySelector('.zp-menu input[accept="image/*"]');
      const transfer=new DataTransfer();
      transfer.items.add(new File([blob],'test-blue.png',{type:'image/png'}));
      input.files=transfer.files;
      input.dispatchEvent(new Event('change',{bubbles:true}));
    }""")
    page.wait_for_function("document.querySelectorAll('.zp-imported-image').length===1")

def select_layer(page, name):
    row = page.locator(".zp-layer-entry").filter(has_text=name)
    row.locator(".zp-layer-choice").click()
    return row

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel="chrome", headless=True,
        args=["--no-sandbox", "--disable-dev-shm-usage"])
    context = browser.new_context(viewport={"width":1100,"height":900})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL, wait_until="domcontentloaded")
    mount(page)

    select_layer(page, "Dessin 1")
    page.locator('.zp-tool[aria-label="Pinceau"]').click()
    paint_line(page, "#000000", 200)
    open_photo(page)
    REPORT["photoImported"] = page.locator(".zp-imported-image").count() == 1
    REPORT["initialLayerCount"] = page.locator(".zp-layer-entry").count() == 3

    image_row = select_layer(page, "test-blue")
    image_row.locator('[aria-label="Descendre le calque"]').click()
    REPORT["imageMovedBehindDrawing"] = page.evaluate("""()=>{
      const nodes=[...document.querySelectorAll('.zp-layer-stage > *')];
      return nodes.length===3 && nodes[0].classList.contains('zp-raster-layer')
      && nodes[1].classList.contains('zp-imported-image')
      && nodes[2].classList.contains('zp-raster-layer')
      && +nodes[0].style.zIndex < +nodes[1].style.zIndex
      && +nodes[1].style.zIndex < +nodes[2].style.zIndex;
    }""")
    blue = pixel(page, 320, 230)
    black = pixel(page, 320, 200)
    REPORT["photoStillVisibleAfterReorder"] = blue[2] > 190 and blue[0] < 60
    REPORT["drawingAbovePhoto"] = max(black) < 90
    REPORT["photoSample"] = blue
    REPORT["drawSample"] = black

    image_row = select_layer(page, "test-blue")
    image_row.locator('[aria-label="Masquer"]').click()
    REPORT["hiddenReallyHidden"] = page.evaluate("""()=>{
      const node=document.querySelector('.zp-imported-image');
      return node.hidden && getComputedStyle(node).display==='none';
    }""")
    hidden = pixel(page, 320, 230)
    REPORT["hiddenRevealsBackground"] = min(hidden) > 210
    page.locator(".zp-layer-entry").filter(has_text="test-blue").locator('[aria-label="Afficher"]').click()
    REPORT["showRestoresPhoto"] = pixel(page, 320, 230)[2] > 190

    select_layer(page, "test-blue")
    page.get_by_role("button", name="Calque dessin", exact=False).click()
    REPORT["addedLayer"] = page.locator(".zp-layer-entry").count() == 4
    page.locator('.zp-tool[aria-label="Pinceau"]').click()
    paint_line(page, "#08e000", 250)

    # Fermer directement, sans attendre les 950 ms de l'enregistrement différé.
    page.evaluate("""()=>{
      const host=document.getElementById('paint-regression-host');
      host._zebraDispose();host.remove();
    }""")
    mount(page)
    page.wait_for_function("""()=>{
      const host=document.getElementById('paint-regression-host');
      return host.querySelectorAll('.zp-layer-entry').length===4
       && host.querySelectorAll('.zp-imported-image').length===1;
    }""", timeout=20000)
    REPORT["immediateReopenRestoresLayers"] = True
    REPORT["reopenRestoresPhoto"] = pixel(page, 320, 230)[2] > 190
    REPORT["reopenRestoresDraw"] = max(pixel(page, 320, 200)) < 90
    green = pixel(page, 320, 250)
    REPORT["reopenRestoresNewStroke"] = green[1] > 110 and green[0] < 90

    # Fermer et recharger complètement la page, même session.
    page.evaluate("""()=>{
      const host=document.getElementById('paint-regression-host');
      host._zebraDispose();host.remove();
    }""")
    page.reload(wait_until="domcontentloaded")
    mount(page)
    page.wait_for_function("document.querySelectorAll('.zp-layer-entry').length===4", timeout=20000)
    REPORT["reloadRestoresLayers"] = page.locator(".zp-imported-image").count() == 1
    REPORT["reloadRestoresPhoto"] = pixel(page, 320, 230)[2] > 190
    REPORT["reloadRestoresDraw"] = max(pixel(page, 320, 200)) < 90
    REPORT["browserErrors"] = errors
    browser.close()

print("PAINT_PERSISTENCE_REPORT", json.dumps(REPORT, ensure_ascii=False), flush=True)
failed = [k for k,v in REPORT.items() if k not in ("photoSample","drawSample","browserErrors") and v is not True]
if errors or failed:
    raise SystemExit("FAILED: " + ", ".join(failed + errors))
print("PAINT_PERSISTENCE_PASS", flush=True)

