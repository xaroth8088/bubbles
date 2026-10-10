const CACHE = 'bubble-grove-v11';
const ASSETS = ['./','./index.html','./styles.css','./src/app.js','./src/engine.js','./src/data.js','./src/physics.js','./src/art.js','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('bubble-grove-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  const scope=new URL(self.registration.scope);
  const allowed=new Set(ASSETS.map(asset=>new URL(asset,scope).pathname));
  const url=new URL(event.request.url);
  if(!allowed.has(url.pathname))return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).catch(async()=>{
      const cached=await caches.match(new URL('./index.html',scope));
      if(!cached)throw new Error('The offline page is not cached.');
      // Static hosts may redirect index.html to /. Navigation requests can reject
      // a cached redirected response, so return its decoded document as a new one.
      const headers=new Headers(cached.headers);headers.delete('content-encoding');headers.delete('content-length');
      return new Response(cached.body,{status:cached.status,statusText:cached.statusText,headers});
    }));
  }else{
    event.respondWith(caches.match(event.request,{ignoreSearch:true}).then(cached=>cached||fetch(event.request)));
  }
});
