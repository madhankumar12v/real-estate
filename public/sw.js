const CACHE='mrsa-properties-v4';
const CORE=['/','/manifest.webmanifest','/mrsa-logo.png'];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(CORE))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;

  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;

  // Always check the live site for page navigation so newly deployed routes work.
  if(request.mode==='navigate'){
    event.respondWith(
      fetch(request).catch(()=>caches.match('/'))
    );
    return;
  }

  // Do not cache Supabase/API responses or authentication requests.
  if(url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/')) return;

  // Static same-origin assets may use the cache, with network fallback.
  event.respondWith(
    caches.match(request).then(cached=>{
      if(cached) return cached;
      return fetch(request).then(response=>{
        if(response.ok){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(request,copy));
        }
        return response;
      });
    })
  );
});
