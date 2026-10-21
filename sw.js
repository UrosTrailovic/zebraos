/* ZebraOS : cache de secours pour JS/CSS.
   En développement, on privilégie toujours le réseau pour récupérer
   immédiatement la dernière version ; le cache ne sert qu'hors ligne. */
const CODE_CACHE="zebraos-code-v18";
self.addEventListener("install",event=>{self.skipWaiting();});
self.addEventListener("activate",event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith("zebraos-code-")&&key!==CODE_CACHE)
   .map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});
self.addEventListener("fetch",event=>{
 const req=event.request;
 if(req.method!=="GET"||req.mode==="navigate")return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin||!/\.(?:js|css)$/.test(url.pathname))return;

 // DEV-FRIENDLY : toujours demander la dernière version au réseau.
 // Le cache local ne sert que de secours si le réseau échoue.
 event.respondWith((async()=>{
  const cache=await caches.open(CODE_CACHE);
  try{
   const response=await fetch(req,{cache:"no-store"});
   if(response.ok&&response.type==="basic"){
    event.waitUntil(cache.put(req,response.clone()).catch(()=>{}));
   }
   return response;
  }catch(err){
   const saved=await cache.match(req);
   if(saved)return saved;
   throw err;
  }
 })());
});
