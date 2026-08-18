// 小家 — Sprint 0 占位 service worker
// 不要在这里做复杂缓存策略；Sprint 5 优化时再换 Serwist

const CACHE_NAME = 'him-v0'
const CORE_ASSETS = ['/', '/manifest.webmanifest', '/icons/icon-192.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  // 只对同源静态资源做 cache-first
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (req.headers.get('accept')?.includes('text/html')) return // HTML 让 RSC 网络优先

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req).then((res) => {
        // 只缓存 ok 的 basic 响应
        if (res.ok && res.type === 'basic') {
          const copy = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy))
        }
        return res
      })
    })
  )
})
