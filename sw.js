// Технолог 3D — работа как приложение и без интернета (для уже открытых заказов)
const V="cehqr-"+"202610080306", SHELL=["./","index.html","manifest.webmanifest","icon-192.png","icon-512.png","apple-touch-icon.png"];
const LIBS=/cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/;
self.addEventListener("install",e=>{ e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())); });
self.addEventListener("activate",e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener("fetch",e=>{
  const r=e.request; if(r.method!=="GET") return;
  const u=new URL(r.url);
  // библиотеки (3D, QR, шрифты) — из кэша, они не меняются
  if(LIBS.test(u.host)){ e.respondWith(caches.open(V).then(c=>c.match(r).then(m=>m||fetch(r).then(res=>{ if(res.ok||res.type==="opaque") c.put(r,res.clone()); return res; })))); return; }
  if(u.origin!==location.origin) return;
  // сайт и заказы — сначала свежие из интернета, без интернета — последние сохранённые
  e.respondWith(fetch(r).then(res=>{ if(res.ok){ const cp=res.clone(); caches.open(V).then(c=>c.put(r.url.split("#")[0],cp)); } return res; })
    .catch(()=>caches.match(r.url.split("#")[0],{ignoreSearch:true}).then(m=>m||(r.mode==="navigate"?caches.match("index.html"):Response.error()))));
});
