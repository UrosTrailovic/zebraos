/* ZebraOS : cache léger des seuls scripts/styles ; jamais de vidéo, MP3,
   photo personnelle, HTML ou index GitHub (toujours actualisé).
   Les paramètres ?v= des fichiers assurent les mises à jour propres. */
const CODE_CACHE="zebraos-code-v13";
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
 event.respondWith((async()=>{
  const cache=await caches.open(CODE_CACHE);
  const saved=await cache.match(req);
  if(saved)return saved;
  const response=await fetch(req);
  if(response.ok&&response.type==="basic"){
   // Ne pas mémoriser une erreur, une réponse cross-origin ou un média.
   event.waitUntil(cache.put(req,response.clone()).catch(()=>{}));
  }
  return response;
 })());
});
