/**
 * PhotoPoet Service Worker — 簡單但安全的 cache 策略。
 *
 * 避坑要點：
 * - /api/* 一律 network-only（每次要新詩，不可 cache）
 * - HTML 用 network-first + 1 day fallback（避免更新後卡舊版）
 * - 靜態資源 (_next/static, *.woff2, og.png, icon.png) 用 cache-first
 * - 加版本號 → 換版時 activate 自動清掉舊 cache
 *
 * 改動 SW 內容後務必把下面的 CACHE_VERSION bump 一下，使用者下次造訪
 * 才會清掉舊 cache。
 */

const CACHE_VERSION = 'v1-2026-05-08';
const STATIC_CACHE = `photopoet-static-${CACHE_VERSION}`;
const HTML_CACHE = `photopoet-html-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  // 立即啟用新版本，避免使用者卡舊版
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.endsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isStaticAsset(url) {
  const path = url.pathname;
  return (
    path.includes('/_next/static/') ||
    /\.(woff2?|ttf|otf|png|jpg|jpeg|gif|svg|ico|webp|avif)$/.test(path)
  );
}

function isApiCall(url) {
  return url.pathname.startsWith('/api/');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1. /api/* — never cache. Let network handle it (incl. cross-origin to web.app)
  if (isApiCall(url)) return;

  // 2. cross-origin (Cloud Functions 直連、Cloudflare Turnstile, Google fonts API,
  //    Firebase Auth handler 等) — 全部直接交給 network，不 cache
  if (url.origin !== self.location.origin) return;

  // 3. Static assets — cache-first
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // 4. HTML / navigation — network-first，失敗時用 cached 版本作 fallback
  if (
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html')
  ) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          if (fresh.ok) {
            const clone = fresh.clone();
            caches.open(HTML_CACHE).then((c) => c.put(req, clone));
          }
          return fresh;
        } catch {
          const cached = await caches.match(req);
          if (cached) return cached;
          return new Response(
            '<h1>無法連上網路</h1><p>請檢查網路後重整頁面。</p>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        }
      })()
    );
    return;
  }
});
