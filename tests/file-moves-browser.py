"""ZebraOS filesystem Windows-like: public/private moves, drag, trash, persistence."""
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE="http://127.0.0.1:8765/"
ROOT="STUDIO/BUREAU"
GAMES=ROOT+"/Jeux"
TOOLS=ROOT+"/Outils"
THANKS=ROOT+"/thanks.txt"
AMP=ROOT+"/ZebraAMP.exe.zebraos.json"
OUT=Path("file-moves-screenshots")
OUT.mkdir(exist_ok=True)

def boot(page):
    page.goto(BASE+"?file-moves-browser=1",wait_until="domcontentloaded")
    page.wait_for_function("Boolean(window.ZebraFileMoves&&window.ZebraDesktop&&window.ZebraGitFiles&&window.ZebraLocalFiles)",timeout=20000)
    page.evaluate("""() => {
      localStorage.removeItem('zebra.file.moves.v1.zebra');
      localStorage.setItem('zebra.desktop.v1.zebra',JSON.stringify({
        positions:{wide:{},narrow:{}},trash:[],racerTrashSeeded:true
      }));
    }""")
    page.evaluate("""async () => {
      await Promise.all([ZebraGitFiles.load(),ZebraLocalFiles.ready()]);
    }""")
    assert page.evaluate("(path)=>!!window.ZebraGitFiles.allFiles().find(x=>x.path===path)",THANKS)

def setup_desktop(page):
    page.evaluate("""() => {
      document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
      const screen=document.querySelector('#desktop-screen');screen.classList.add('active');
      document.querySelector('#start-menu').classList.add('hidden');
      window.__icon=(name,n)=>{
       const x=document.createElement('span');x.className='os-icon-graphic';
       x.textContent=name==='folder'?'📁':'▣';
       x.style.cssText='display:inline-flex;justify-content:center;align-items:center;width:'+n+'px;height:'+n+'px;font-size:23px;';
       return x;
      };
      window.__paintDesktop=function(){
       const root=document.querySelector('#desktop-icons');root.replaceChildren();
       window.ZebraGitFiles.list(window.ZebraGitFiles.root,'zebra').forEach(item=>{
        const btn=document.createElement('button');btn.type='button';btn.className='desk-icon desk-user-file';
        btn.dataset.path=item.path;
        const symbol=document.createElement('span');symbol.className='desk-symbol';
        symbol.append(window.ZebraGitFiles.icon(item,window.__icon,40));
        const name=document.createElement('span');name.className='desk-caption';name.textContent=item.name;
        btn.append(symbol,name);root.append(btn);
        if(item.type==='dir')window.ZebraFileMoves.markDrop(btn,item.path);
       });
       window.ZebraDesktop.bind();
      };
      window.ZebraDesktop.setup('zebra',window.__paintDesktop,()=>{},window.__icon);
      window.__paintDesktop();
      window.__window=function(id,left,top,folder){
       const w=document.createElement('div');
       w.id=id;w.className='window focused';
       w.style.cssText='position:fixed;z-index:999;left:'+left+'px;top:'+top+
        'px;width:460px;height:430px;display:flex;flex-direction:column;';
       const bar=document.createElement('div');bar.className='titlebar';
       bar.innerHTML='<span class="windowtitle"></span><div class="titlebuttons"><button data-close>×</button></div>';
       const body=document.createElement('div');body.className='window-body';body.style.flex='1';
       w.append(bar,body);document.body.append(w);
       ZebraGitFiles.mount(body,folder,{session:'zebra',osIcon:window.__icon,
        windowBox(){return document.createElement('div')},openApp(){}});
       return w;
      };
    }""")

def mouse_drag(page,start,end):
    start.scroll_into_view_if_needed()
    end.scroll_into_view_if_needed()
    s=start.bounding_box();d=end.bounding_box()
    assert s and d,(s,d)
    hit=start.evaluate("""n=>{
      const r=n.getBoundingClientRect();
      return n.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));
    }""")
    assert hit,("L'icône de départ doit être visible avant glisser",s)
    x0=s["x"]+s["width"]/2;y0=s["y"]+s["height"]/2
    x1=d["x"]+d["width"]/2;y1=d["y"]+d["height"]/2
    page.mouse.move(x0,y0);page.mouse.down()
    page.mouse.move(x0+20,y0+14,steps=4)
    page.mouse.move(x1,y1,steps=14)
    page.mouse.up()

def desktop_and_public(browser):
    context=browser.new_context(viewport={"width":1500,"height":945})
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda x:errors.append(str(x)))
    boot(page)
    setup_desktop(page)
    root=page.locator("#desktop-icons")
    assert root.locator('.desk-icon[data-path="'+AMP+'"]').count()==1

    # Moving a desktop icon into the open folder is a genuine pointer gesture.
    page.evaluate("(x)=>window.__window('games-window',410,25,x)",GAMES)
    games=page.locator("#games-window")
    games.locator(".folder-path").wait_for()
    mouse_drag(page,root.locator('.desk-icon[data-path="'+AMP+'"]'),games.locator(".folder-path"))
    assert page.evaluate("([x,s])=>ZebraFileMoves.parent(x,s)",[AMP,"zebra"])==GAMES
    assert root.locator('.desk-icon[data-path="'+AMP+'"]').count()==0

    # Move any published file between two Explorer windows.
    page.evaluate("(args)=>window.ZebraFileMoves.movePublic([args[0]],args[1],'zebra')",[THANKS,GAMES])
    page.evaluate("(x)=>window.__window('tools-window',920,25,x)",TOOLS)
    tools=page.locator("#tools-window")
    src=games.locator('.github-file-entry[data-path="'+THANKS+'"]')
    src.wait_for()
    page.evaluate("""() => {
      window.__dragTrace=[];
      const src=document.querySelector('#games-window .github-file-entry[data-path="STUDIO/BUREAU/thanks.txt"]');
      src.addEventListener('pointerdown',e=>window.__dragTrace.push(['down',e.pointerId,e.clientX,e.clientY,e.target.tagName]),true);
      window.addEventListener('pointermove',e=>{
       if(window.__dragTrace.length<35)window.__dragTrace.push(['move',e.pointerId,
        document.querySelectorAll('.zebra-drag-ghost').length,
        ZebraFileMoves.findTarget(e.clientX,e.clientY)?.target]);
      },true);
      window.addEventListener('pointerup',e=>window.__dragTrace.push(['up',e.pointerId,
       document.querySelectorAll('.zebra-drag-ghost').length,
       ZebraFileMoves.findTarget(e.clientX,e.clientY)?.target]),true);
    }""")
    mouse_drag(page,src,tools.locator(".folder-path"))
    print("DRAG_TRACE",page.evaluate("window.__dragTrace"),flush=True)
    current=page.evaluate("x=>ZebraFileMoves.parent(x,'zebra')",THANKS)
    if current!=TOOLS:
        debug=page.evaluate("""({source,destination})=>{
          const a=document.querySelector('#games-window .github-file-entry[data-path="'+source+'"]');
          const b=document.querySelector('#tools-window .folder-path');
          const box=b?.getBoundingClientRect();
          const x=box?.x+box?.width/2,y=box?.y+box?.height/2;
          const top=document.elementFromPoint(x,y);
          return {source:!!a,target:!!b,mouse:[x,y],
            hit:top?.className,hitTag:top?.tagName,
            nearest:top?.closest('[data-zdrop-target]')?.dataset.zdropTarget,
            target:ZebraFileMoves.findTarget(x,y)?.target,
            canDrop:ZebraFileMoves.canDrop([{kind:'public',id:source}],destination,'zebra'),
            collision:ZebraFileMoves.checkPublic([source],destination,'zebra',false),
            ghosts:document.querySelectorAll('.zebra-drag-ghost').length};
        }""",{"source":THANKS,"destination":TOOLS})
        print("DRAG_BETWEEN_WINDOWS_DEBUG",debug,flush=True)
        page.screenshot(path=str(OUT/"drag-between-windows-debug.png"))
    assert current==TOOLS,current
    assert tools.locator('.github-file-entry[data-path="'+THANKS+'"]').count()==1
    tools.screenshot(path=str(OUT/"desktop-folder-moves.png"))

    # Moving a folder carries its contents, but the source URLs stay identical.
    page.evaluate("(args)=>ZebraFileMoves.movePublic([args[0]],args[1],'zebra')",[GAMES,TOOLS])
    assert page.evaluate("(x)=>ZebraFileMoves.parent(x,'zebra')",GAMES)==TOOLS
    assert page.evaluate("(x)=>ZebraGitFiles.list(x,'zebra').some(a=>a.path.includes('ZebraAMP'))",GAMES)
    assert page.evaluate("(x)=>ZebraGitFiles.allFiles().some(a=>a.path===x)",AMP)
    rejected=page.evaluate("""(x)=>{
      try{ZebraFileMoves.movePublic([x],x,'zebra');return false}
      catch(e){return /lui-même/.test(e.message)}
    }""",GAMES)
    assert rejected

    # Trash + restore from public folder keeps its virtual parent unchanged.
    page.evaluate("(x)=>ZebraFileMoves.move([{kind:'public',id:x}],'trash','zebra')",THANKS)
    page.wait_for_function("(x)=>ZebraDesktop.isTrashed('zebra',x)",arg=THANKS)
    trash=page.evaluate("(x)=>ZebraFileMoves.move([{kind:'public',id:x}],ZebraFileMoves.root,'zebra')",THANKS)
    page.wait_for_function("(x)=>!ZebraDesktop.isTrashed('zebra',x)",arg=THANKS)
    assert page.evaluate("(x)=>ZebraFileMoves.parent(x,'zebra')",THANKS)==ROOT

    # A folder icon on the desktop is a drop target without opening it.
    settings=ROOT+"/Réglage de l’ordinateur.zebraos.json"
    page.wait_for_function("(x)=>!!document.querySelector('.desk-icon[data-path='+JSON.stringify(x)+']')",arg=settings)
    mouse_drag(page,root.locator('.desk-icon[data-path="'+settings+'"]'),
               root.locator('.desk-icon[data-path="'+TOOLS+'"]'))
    assert page.evaluate("x=>ZebraFileMoves.parent(x,'zebra')",settings)==TOOLS
    page.evaluate("(x)=>ZebraFileMoves.movePublic([x],ZebraFileMoves.root,'zebra')",settings)

    # A personal Blob can appear inside public desktop folders and move again.
    entry=page.evaluate("""async (root)=>{
      const [entry]=await ZebraLocalFiles.importAt(root,[new File(['bonjour zebra'],'local-essai.txt',{type:'text/plain'})],'zebra');
      return {id:entry.id,name:entry.name};
    }""",ROOT)
    private="local:"+entry["id"]
    assert page.evaluate("(x)=>ZebraGitFiles.list(ZebraGitFiles.root,'zebra').some(e=>e.path===x)",private)
    page.evaluate("([id,to])=>ZebraFileMoves.move([{kind:'local',id}],to,'zebra')",[entry["id"],GAMES])
    assert page.evaluate("([id,to])=>ZebraLocalFiles.cached().some(e=>e.id===id&&e.parent===to)",[entry["id"],GAMES])
    page.evaluate("([id,to])=>ZebraFileMoves.move([{kind:'local',id}],to,'zebra')",[entry["id"],"local:system-screens"])
    assert page.evaluate("id=>ZebraLocalFiles.cached().some(e=>e.id===id&&e.parent==='system-screens')",entry["id"])
    page.evaluate("(x)=>ZebraFileMoves.move([{kind:'local',id:x}],'trash','zebra')",entry["id"])
    assert page.evaluate("id=>ZebraLocalFiles.cached().some(e=>e.id===id&&e.deleted)",entry["id"])
    page.evaluate("(x)=>ZebraFileMoves.move([{kind:'local',id:x}],ZebraFileMoves.root,'zebra')",entry["id"])
    assert page.evaluate("id=>ZebraLocalFiles.cached().some(e=>e.id===id&&!e.deleted&&e.parent==='STUDIO/BUREAU')",entry["id"])

    # New on-desktop folder is a real IndexedDB folder; public content can be moved inside it.
    created=page.evaluate("""async () => {
      const f=await ZebraLocalFiles.createFolderAt(ZebraFileMoves.root,'DOSSIER DEMO','zebra');
      return f.id;
    }""")
    assert page.evaluate("id=>ZebraGitFiles.list(ZebraGitFiles.root,'zebra').some(f=>f.path==='local:'+id)",created)
    page.evaluate("([path,dest])=>ZebraFileMoves.movePublic([path],'local:'+dest,'zebra')",[THANKS,created])
    assert page.evaluate("([path,id])=>ZebraGitFiles.list('local:'+id,'zebra').some(f=>f.path===path)",[THANKS,created])
    # Moving a public folder into a personal folder inside itself is forbidden.
    page.evaluate("([id,target])=>ZebraLocalFiles.moveEntry(id,target,'zebra')",[created,GAMES])
    rejected=page.evaluate("""([source,id])=>{
      try{ZebraFileMoves.movePublic([source],'local:'+id,'zebra');return false}
      catch(e){return /lui-même/.test(e.message)}
    }""",[GAMES,created])
    assert rejected
    page.evaluate("id=>ZebraLocalFiles.moveEntry(id,ZebraFileMoves.root,'zebra')",created)
    assert page.evaluate("p=>ZebraFileMoves.parent(p,'admin')===ZebraFileMoves.root",THANKS)

    # Reload: all placements and Blob bytes survive.
    page.reload(wait_until="domcontentloaded")
    page.evaluate("""async()=>{await Promise.all([ZebraGitFiles.load(),ZebraLocalFiles.ready()]);}""")
    assert page.evaluate("([x,id])=>ZebraGitFiles.list('local:'+id,'zebra').some(f=>f.path===x)",[THANKS,created])
    assert page.evaluate("id=>!!ZebraLocalFiles.cached().find(e=>e.id===id&&e.blob)",entry["id"])
    assert not errors,errors
    print("FILE_MOVES_DESKTOP_PASS",{"privateFile":entry["id"],"folder":created},flush=True)
    context.close()

def mobile(browser):
    context=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    page=context.new_page()
    boot(page)
    setup_desktop(page)
    page.evaluate("(x)=>window.__window('mobile-folder',4,20,x)",GAMES)
    folder=page.locator("#mobile-folder")
    page.wait_for_timeout(200)
    assert folder.locator(".github-file-entry").count()>=1
    # Touch pointer gesture: move desktop shortcut to the open folder.
    data=page.locator('.desk-icon[data-path="'+AMP+'"]').bounding_box()
    dest=folder.locator(".folder-path").bounding_box()
    assert data and dest
    page.evaluate("""({a,b})=>{
      const node=document.querySelector('.desk-icon[data-path="STUDIO/BUREAU/ZebraAMP.exe.zebraos.json"]');
      const x=a.x+a.width/2,y=a.y+a.height/2,tx=b.x+b.width/2,ty=b.y+b.height/2;
      const event=(type,px,py,receiver)=>{
        receiver.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,
          pointerId:101,isPrimary:true,pointerType:'touch',clientX:px,clientY:py,button:0}));
      };
      event('pointerdown',x,y,node);
      event('pointermove',x+15,y+15,window);
      event('pointermove',tx,ty,window);
      event('pointerup',tx,ty,window);
    }""",{"a":data,"b":dest})
    page.wait_for_function("x=>ZebraFileMoves.parent(x,'zebra')==='STUDIO/BUREAU/Jeux'",arg=AMP,timeout=12000)
    folder.screenshot(path=str(OUT/"mobile-folder.png"))
    print("FILE_MOVES_MOBILE_PASS",flush=True)
    context.close()

with sync_playwright() as p:
    browser=p.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
    desktop_and_public(browser)
    mobile(browser)
    browser.close()
print("FILE_MOVES_SUITE_PASS",flush=True)
