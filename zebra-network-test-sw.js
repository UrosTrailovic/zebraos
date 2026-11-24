/* Admin audio network laboratory: no application caching. */
"use strict";
const profiles={slow:[500,300],bad:[150,650],unstable:[500,400]};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
self.addEventListener("install",e=>e.waitUntil(self.skipWaiting()));
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{
 const u=new URL(e.request.url);
 if(u.origin===self.location.origin&&u.pathname==="/__zebra_audio_test__")e.respondWith(proxy(e.request,u));
});
async function proxy(request,u){
 const p=u.searchParams.get("profile"),path=u.searchParams.get("path")||"";
 if(!Object.hasOwn(profiles,p)||!path.startsWith("STUDIO/BUREAU/")||path.split("/").some(x=>!x||x===".."||x===".")||!/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(path))return new Response("Invalid audio test",{status:400});
 if(request.method!=="GET"&&request.method!=="HEAD")return new Response(null,{status:405});
 const headers=new Headers(),range=request.headers.get("Range");if(range)headers.set("Range",range);
 await sleep(profiles[p][1]);
 let r;try{r=await fetch("https://raw.githubusercontent.com/UrosTrailovic/zebraos/main/"+path.split("/").map(encodeURIComponent).join("/"),{method:request.method,headers,cache:"no-store",signal:request.signal});}catch(e){return new Response("Audio source unavailable",{status:502});}
 const h=new Headers({"Cache-Control":"no-store","Content-Type":r.headers.get("Content-Type")||"audio/mpeg"});
 for(const key of ["Content-Length","Content-Range","Accept-Ranges"]){const v=r.headers.get(key);if(v)h.set(key,v);}
 if(!r.ok||!r.body||request.method==="HEAD")return new Response(null,{status:r.status,headers:h});
 const reader=r.body.getReader(),started=Date.now();let data=null,offset=0,cancelled=false;
 function rate(){if(p!=="unstable")return profiles[p][0];const phase=(Date.now()-started)%20000;return phase<7000?2000:phase<12000?100:phase<16000?0:500;}
 const body=new ReadableStream({
  async pull(c){try{
   if(cancelled)return;
   if(!data||offset>=data.byteLength){const next=await reader.read();if(cancelled)return;if(next.done){c.close();return;}data=next.value;offset=0;}
   let kbps=rate();while(!kbps&&!cancelled){await sleep(250);kbps=rate();}
   if(cancelled)return;
   const size=Math.min(data.byteLength-offset,Math.max(512,Math.floor(kbps*15)));
   await sleep(size*8/kbps);if(cancelled)return;c.enqueue(data.subarray(offset,offset+size));offset+=size;
  }catch(err){if(!cancelled)c.error(err);}},
  cancel(reason){cancelled=true;return reader.cancel(reason).catch(()=>{});}
 });
 return new Response(body,{status:r.status,statusText:r.statusText,headers:h});
}
