const CACHE="mafundi-shell-v3";
const SHELL=["/","/offline","/map","/artisans","/post-job","/client/login","/register","/icon.svg","/manifest.webmanifest"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  const request=event.request;const url=new URL(request.url);
  if(request.method!=="GET"||url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;
  if(request.mode==="navigate"){
    event.respondWith(fetch(request).catch(()=>caches.match(request).then(match=>match||caches.match("/offline"))));
    return;
  }
  if(!["style","script","font","image"].includes(request.destination))return;
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy))}return response})));
});
self.addEventListener("push",event=>{const data=event.data?.json()||{};event.waitUntil(self.registration.showNotification(data.title||"Mafundi Mtaani",{body:data.body||"You have a marketplace update.",icon:"/icon.svg",badge:"/icon.svg",data:{url:data.url||"/dashboard"}}))});
self.addEventListener("notificationclick",event=>{event.notification.close();event.waitUntil(clients.openWindow(event.notification.data?.url||"/dashboard"))});
