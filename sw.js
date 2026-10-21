/* ZebraOS DEV MODE — Service Worker volontairement désactivé.
   Le développement actif utilise le réseau/navigateur directement. */
self.addEventListener("install",function(){self.skipWaiting();});
self.addEventListener("activate",function(event){
 event.waitUntil((async function(){
  const keys=await caches.keys();
  await Promise.all(keys.filter(function(k){return k.indexOf("zebraos-code-")===0;})
   .map(function(k){return caches.delete(k);}));
  await self.registration.unregister().catch(function(){});
  await self.clients.claim();
 })());
});
