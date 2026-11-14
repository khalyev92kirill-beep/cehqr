// Технолог 3D — работа как приложение и без интернета (для уже открытых заказов). Сборка: 92440b63a6
const BUILD="92440b63a6", SHELL_C="cehqr-shell", DATA="cehqr-data", LIBC="cehqr-libs";   // имена постоянные: при обновлении сайта сохранённое не стирается
const SHELL=["./","3d/","manifest.webmanifest","icon-192.png","icon-512.png","apple-touch-icon.png"];   // 3d/ («Технолог 3D») — сразу: QR на детали должен открыться и без интернета
const LIBS=/cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/;
// установка: страницы берём прямо с сервера (cache:"reload"), а не из кэша браузера — иначе можно сохранить старую
self.addEventListener("install",e=>{ e.waitUntil(caches.open(SHELL_C).then(c=>Promise.all(SHELL.map(u=>c.add(new Request(u,{cache:"reload"})).catch(()=>{})))
  .then(()=>c.match("./").then(m=>m&&c.put("index.html",m)).catch(()=>{}))   // index.html — та же страница, что "./": не качаем второй раз
  .then(()=>Promise.all(["vertaks/","smeta/"].map(p=>c.match(p).then(m=>m&&c.add(new Request(p,{cache:"reload"})).catch(()=>{}))))))
  .then(()=>self.skipWaiting())); });
self.addEventListener("activate",e=>{
  // старые сайты (до номера сборки) хранили страницу в кэше "cehqr-<дата>" и сами не проверяют обновления —
  // такие открытые окна один раз перезагружаем, дальше страница следит за версией сама
  const done=caches.keys().then(ks=>{ const legacy=ks.some(k=>/^cehqr-\d{12}$/.test(k));
    return Promise.all(ks.filter(k=>k!==SHELL_C&&k!==DATA&&k!==LIBC).map(k=>caches.delete(k))).then(()=>self.clients.claim()).then(()=>legacy); });
  // первый заход: открытая сейчас страница ещё не сохранена — сохраняем (обычно берётся из кэша браузера, без новой закачки), чтобы следующее открытие было мгновенным
  // (cache:"no-cache" — браузер спросит сервер «не изменилась?»; не изменилась — короткий ответ, без новой закачки; старую из кэша браузера не сохраним)
  const keep=w=>{ const u=new URL(w.url); if(u.origin!==location.origin||!isApp(u)) return null; const key=u.origin+u.pathname;
    return caches.open(SHELL_C).then(c=>c.match(key).then(m=>m||fetch(key,{credentials:"same-origin",cache:"no-cache"}).then(res=>{ if(res.ok&&res.type==="basic"&&!res.redirected) return c.put(key,res); }))).catch(()=>{}); };
  e.waitUntil(done);
  done.then(()=>self.clients.matchAll({type:"window"})).then(cl=>Promise.all(cl.map(keep))).catch(()=>{});   // не внутри waitUntil: пока sw включается, заходы на страницы ждут
  // перезагрузка — уже после включения (внутри waitUntil она бы ждала сама себя)
  done.then(legacy=>setTimeout(()=>self.clients.matchAll({type:"window"}).then(cl=>cl.forEach(c=>{
    if(legacy&&c.navigate) c.navigate(c.url).catch(()=>{}); else try{ c.postMessage({type:"cehqr-sw",build:BUILD}); }catch(_){}
  })),0));
});
const isPage=(r,u)=>r.mode==="navigate"||/\/$|\.html$/.test(u.pathname);
// страницы самого приложения: Work24link (/), Технолог 3D (3d/), Смета (smeta/) — они сами проверяют version.json; vertaks/ — короткий переходник в корень.
// Остальные (страница клиента k/, sketchup/, dizain…) так не умеют — им «сразу из сохранённых» нельзя, берём с сервера.
const ROOT=new URL(self.registration.scope).pathname;
const isApp=u=>u.pathname.startsWith(ROOT)&&/^(?:(?:3d|vertaks|smeta)\/)?(?:index\.html)?$/.test(u.pathname.slice(ROOT.length));
self.addEventListener("fetch",e=>{
  const r=e.request; if(r.method!=="GET") return;
  const u=new URL(r.url);
  // библиотеки (3D, QR, шрифты) — из кэша, они не меняются
  if(LIBS.test(u.host)){ e.respondWith(caches.open(LIBC).then(c=>c.match(r).then(m=>m||fetch(r).then(res=>{ if(res.ok||res.type==="opaque") c.put(r,res.clone()); return res; })))); return; }
  if(u.origin!==location.origin) return;
  // номер сборки — только с сервера, мимо всех кэшей; без интернета — ошибка (страница просто проверит позже)
  if(/\/version\.json$/.test(u.pathname)){ e.respondWith(fetch(r.url,{cache:"no-store"})); return; }
  // страницы сайта (Кирилл 11.11: «открывается мгновенно») — сразу из сохранённых, свежую докачиваем в фоне и кладём в кэш.
  // О новой версии страница узнаёт сама (version.json) и перезагружается с ?v=… — такой заход идёт с сервера.
  // Сохранённой ещё нет (первый заход) — с сервера; без интернета — сохранённые.
  if(isPage(r,u)){
    const key=u.origin+u.pathname;   // без ?v=… и #… — одна запись на страницу
    const nav=r.mode==="navigate";
    const net=()=>fetch(r.url,{cache:"no-cache",credentials:"same-origin",redirect:nav?"manual":"follow"}).then(res=>{ if(res.ok&&res.type==="basic"){ const cp=res.clone(); return caches.open(SHELL_C).then(c=>c.put(key,cp)).catch(()=>{}).then(()=>res); } return res; });
    const saved=()=>caches.open(SHELL_C).then(c=>c.match(key).then(m=>m||c.match(key,{ignoreSearch:true})));
    // ответ из кэша с пометкой «переадресован» браузер для перехода не примет — отдаём копию без пометки
    const clean=m=>m&&m.redirected&&nav?m.blob().then(b=>new Response(b,{status:m.status,statusText:m.statusText,headers:m.headers})):m;
    const fallback=()=>saved().then(m=>m||(!nav?Response.error():
        /\/3d\//.test(u.pathname)?caches.match("3d/").then(v=>v||Response.error()):/\/smeta\//.test(u.pathname)?caches.match("smeta/").then(v=>v||Response.error()):/\/vertaks\//.test(u.pathname)?caches.match("vertaks/").then(v=>v||Response.redirect(ROOT+u.search)):caches.match("./").then(v=>v||caches.match("index.html")))).then(clean);
    // перезагрузка ради новой версии (?v=…) и страницы не из приложения — с сервера (без интернета — сохранённые)
    if(u.searchParams.has("v")||!isApp(u)){ e.respondWith(net().catch(fallback)); return; }
    const got=saved().catch(()=>null);
    e.respondWith(got.then(m=>m?clean(m):net().catch(fallback)));
    e.waitUntil(got.then(m=>m&&net().catch(()=>{})));   // фоновая подкачка свежей страницы
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
