// Технолог 3D — работа как приложение и без интернета (для уже открытых заказов). Сборка: df7c744dc3
const BUILD="df7c744dc3", SHELL_C="cehqr-shell", DATA="cehqr-data", LIBC="cehqr-libs";   // имена постоянные: при обновлении сайта сохранённое не стирается
const SHELL=["./","index.html","manifest.webmanifest","icon-192.png","icon-512.png","apple-touch-icon.png"];
const LIBS=/cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/;
// установка: страницы берём прямо с сервера (cache:"reload"), а не из кэша браузера — иначе можно сохранить старую
self.addEventListener("install",e=>{ e.waitUntil(caches.open(SHELL_C).then(c=>Promise.all(SHELL.map(u=>c.add(new Request(u,{cache:"reload"})).catch(()=>{})))
  .then(()=>c.match("vertaks/").then(m=>m&&c.add(new Request("vertaks/",{cache:"reload"})).catch(()=>{}))))
  .then(()=>self.skipWaiting())); });
self.addEventListener("activate",e=>{
  // старые сайты (до номера сборки) хранили страницу в кэше "cehqr-<дата>" и сами не проверяют обновления —
  // такие открытые окна один раз перезагружаем, дальше страница следит за версией сама
  const done=caches.keys().then(ks=>{ const legacy=ks.some(k=>/^cehqr-\d{12}$/.test(k));
    return Promise.all(ks.filter(k=>k!==SHELL_C&&k!==DATA&&k!==LIBC).map(k=>caches.delete(k))).then(()=>self.clients.claim()).then(()=>legacy); });
  e.waitUntil(done);
  // перезагрузка — уже после включения (внутри waitUntil она бы ждала сама себя)
  done.then(legacy=>setTimeout(()=>self.clients.matchAll({type:"window"}).then(cl=>cl.forEach(c=>{
    if(legacy&&c.navigate) c.navigate(c.url).catch(()=>{}); else try{ c.postMessage({type:"cehqr-sw",build:BUILD}); }catch(_){}
  })),0));
});
const isPage=(r,u)=>r.mode==="navigate"||/\/$|\.html$/.test(u.pathname);
self.addEventListener("fetch",e=>{
  const r=e.request; if(r.method!=="GET") return;
  const u=new URL(r.url);
  // библиотеки (3D, QR, шрифты) — из кэша, они не меняются
  if(LIBS.test(u.host)){ e.respondWith(caches.open(LIBC).then(c=>c.match(r).then(m=>m||fetch(r).then(res=>{ if(res.ok||res.type==="opaque") c.put(r,res.clone()); return res; })))); return; }
  if(u.origin!==location.origin) return;
  // номер сборки — только с сервера, мимо всех кэшей; без интернета — ошибка (страница просто проверит позже)
  if(/\/version\.json$/.test(u.pathname)){ e.respondWith(fetch(r.url,{cache:"no-store"})); return; }
  // страницы сайта — всегда с сервера (с проверкой свежести, мимо 10-минутного кэша браузера), без интернета — сохранённые
  if(isPage(r,u)){
    const key=u.origin+u.pathname;   // без ?v=… и #… — одна запись на страницу
    e.respondWith(fetch(r.url,{cache:"no-cache",credentials:"same-origin",redirect:r.mode==="navigate"?"manual":"follow"}).then(res=>{ if(res.ok&&res.type==="basic"){ const cp=res.clone(); caches.open(SHELL_C).then(c=>c.put(key,cp)); } return res; })
      .catch(()=>caches.open(SHELL_C).then(c=>c.match(key).then(m=>m||c.match(key,{ignoreSearch:true}))).then(m=>m||(r.mode!=="navigate"?Response.error():
        /\/vertaks\//.test(u.pathname)?caches.match("vertaks/").then(v=>v||caches.match("index.html")):caches.match("./").then(v=>v||caches.match("index.html"))))));
    return;
  }
  // картинки (значки, заставки, образцы декоров и текстур) — сразу из сохранённых, свежие докачиваем в фоне (повторное открытие без ожидания сети)
  if(/\.(png|jpe?g|webp|gif|svg|ico)$/i.test(u.pathname)){ const st=/\/(orders|textures)\//.test(u.pathname)?DATA:SHELL_C, key=r.url.split("#")[0];
    e.respondWith(caches.open(st).then(c=>c.match(key).then(m=>{ const net=fetch(r).then(res=>{ if(res.ok) c.put(key,res.clone()).catch(()=>{}); return res; });
      if(m){ e.waitUntil(net.catch(()=>{})); return m; } return net.catch(()=>caches.match(key,{ignoreSearch:true}).then(x=>x||Response.error())); })));
    return; }
  // заказы, данные и остальное — сначала свежие из интернета, без интернета — последние сохранённые
  const store=/\/(orders|textures)\//.test(u.pathname)?DATA:SHELL_C;
  e.respondWith(fetch(r).then(res=>{ if(res.ok){ const cp=res.clone(); caches.open(store).then(c=>c.put(r.url.split("#")[0],cp)); } return res; })
    .catch(()=>caches.match(r.url.split("#")[0],{ignoreSearch:true}).then(m=>m||Response.error())));
});
