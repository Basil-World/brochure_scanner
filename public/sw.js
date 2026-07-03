/**
 * Service Worker for Expo OCR Scanner
 *
 * Caching strategy:
 * - App shell (HTML, CSS, JS): Cache-first with network fallback
 * - OpenCV.js WASM: Cache-first (large file, rarely changes)
 * - API calls (Google Apps Script): Network-only (never cache)
 *
 * No image data is ever cached — the app never stores images.
 */

const CACHE_NAME = 'expo-ocr-scanner-v1'
const OPENCV_CACHE = 'expo-ocr-opencv-v1'

// App shell assets to precache
const PRECACHE_URLS = [
  '/',
  '/scanner',
  '/manifest.json',
]

// OpenCV CDN URL to cache separately (large file)
const OPENCV_URL = 'https://docs.opencv.org/4.x/opencv.js'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      await cache.addAll(PRECACHE_URLS).catch(() => {
        // Non-fatal — shell may not be fully built yet during dev
      })
      self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== OPENCV_CACHE)
          .map(key => caches.delete(key))
      )
      self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never intercept Google Apps Script calls
  if (url.hostname.includes('script.google.com') || url.hostname.includes('google.com')) {
    return
  }

  // Cache OpenCV.js with cache-first strategy
  if (request.url === OPENCV_URL) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(OPENCV_CACHE)
        const cached = await cache.match(request)
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok) {
          cache.put(request, response.clone())
        }
        return response
      })()
    )
    return
  }

  // App shell: cache-first, network fallback
  if (request.method === 'GET' && (url.origin === self.location.origin || url.hostname.includes('fonts.googleapis.com'))) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME)
        const cached = await cache.match(request)
        if (cached) return cached
        try {
          const response = await fetch(request)
          if (response.ok && response.status < 400) {
            cache.put(request, response.clone())
          }
          return response
        } catch {
          // Offline fallback
          const fallback = await cache.match('/')
          return fallback ?? new Response('Offline — please reconnect', { status: 503 })
        }
      })()
    )
  }
})
