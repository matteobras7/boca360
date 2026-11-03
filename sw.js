const VERSION='boca360-v3';
const CORE=['./','./index.html','./assets/app.css','./assets/app.js','./assets/seed.js','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;
 const url=new URL(req.url);if(url.origin!==self.location.origin)return;
 if(url.pathname.endsWith('/data/boca.json')||req.mode==='navigate'){
  event.respondWith(fetch(req).then(response=>{if(response.ok){const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(req,copy))}return response}).catch(()=>caches.match(req).then(x=>x||caches.match('./index.html'))));
 }else{
  event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{if(res.ok)caches.open(VERSION).then(c=>c.put(req,res.clone()));return res})));
 }
});
