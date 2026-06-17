// Lexify service worker — basic offline shell, never caches API responses.
const CACHE = 'lexify-v1'
const API_RE = /^\/(auth|words|stats|telegram|quiz|api|streak|review-log|achievements|email|review)(\/|$|\?)/

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Always hit the network for API calls — never serve stale data
  if (API_RE.test(url.pathname)) return

  // SPA navigations: network first, fall back to cached shell when offline
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    )
    return
  }

  // Static assets: cache-first, refresh in background
  e.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(resp => {
        if (resp && resp.ok) {
          const copy = resp.clone()
          caches.open(CACHE).then(c => c.put(request, copy))
        }
        return resp
      }).catch(() => cached)
      return cached || network
    })
  )
})
