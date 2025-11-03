const CACHE_NAME = 'navalivay-v1';
const CACHE_URLS = [
  '/',
  '/manifest.json',
  'https://telegram.org/js/telegram-web-app.js'
]

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /^\/api\/categories$/,
  /^\/api\/banners$/,
  /^\/api\/products/,
  /^\/api\/product\/[^/]+$/
]

// Image cache patterns
const IMAGE_CACHE_PATTERNS = [
  /^\/uploads\//,
  /\.(?:png|gif|jpg|jpeg|webp|svg)$/
]

// Install event - cache essential resources
self.addEventListener('install', event => {
  console.log('[SW] Installing...')
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching essential resources')
        return cache.addAll(CACHE_URLS)
      })
      .then(() => {
        console.log('[SW] Installation complete')
        return self.skipWaiting()
      })
      .catch(err => {
        console.error('[SW] Installation failed:', err)
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating...')
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => {
              console.log('[SW] Deleting old cache:', name)
              return caches.delete(name)
            })
        )
      })
      .then(() => {
        console.log('[SW] Activation complete')
        return self.clients.claim()
      })
  )
})

// Fetch event - handle caching strategy
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }
  
  // Skip Chrome extension requests
  if (url.protocol === 'chrome-extension:') {
    return
  }
  
  // Handle different types of requests
  if (shouldCacheAPI(request)) {
    event.respondWith(handleAPIRequest(request))
  } else if (shouldCacheImage(request)) {
    event.respondWith(handleImageRequest(request))
  } else {
    event.respondWith(handleStaticRequest(request))
  }
})

// Check if request should be cached (API)
function shouldCacheAPI(request) {
  const url = new URL(request.url)
  return API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))
}

// Check if request should be cached (Images)
function shouldCacheImage(request) {
  const url = new URL(request.url)
  return IMAGE_CACHE_PATTERNS.some(pattern => 
    pattern.test(url.pathname) || pattern.test(url.href)
  )
}

// Handle API requests - Network first with cache fallback
async function handleAPIRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      // Cache successful responses
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('[SW] Network failed for API, trying cache:', request.url)
    
    // Fall back to cache
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Return offline response for API
    return new Response(
      JSON.stringify({ 
        error: 'Offline', 
        message: 'Нет подключения к интернету' 
      }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// Handle image requests - Cache first with network fallback
async function handleImageRequest(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Fetch from network
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      // Cache the image
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('[SW] Failed to load image:', request.url)
    
    // Return placeholder image
    return new Response(
      '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#9ca3af">No Image</text></svg>',
      { 
        headers: { 
          'Content-Type': 'image/svg+xml'
        }
      }
    )
  }
}

// Handle static requests - Cache first with network fallback
async function handleStaticRequest(request) {
  try {
    // Try cache first for static assets
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Fetch from network
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      // Cache static assets
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('[SW] Failed to load resource:', request.url)
    
    // For HTML requests, return cached index.html (SPA fallback)
    if (request.headers.get('accept')?.includes('text/html')) {
      const cachedIndex = await caches.match('/')
      if (cachedIndex) {
        return cachedIndex
      }
    }
    
    throw error
  }
}

// Background sync for offline actions
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag)
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync())
  }
})

async function doBackgroundSync() {
  try {
    // Perform any background sync operations
    console.log('[SW] Performing background sync')
    
    // Example: sync offline actions, update cache, etc.
    // This could include sending queued analytics events,
    // updating product data, etc.
    
  } catch (error) {
    console.error('[SW] Background sync failed:', error)
  }
}

// Push notifications (if needed)
self.addEventListener('push', event => {
  if (!event.data) return
  
  try {
    const data = event.data.json()
    const options = {
      body: data.body || 'Новое уведомление от НАВАЛИВАЙ',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: data.url || '/',
      tag: 'navalivay-notification'
    }
    
    event.waitUntil(
      self.registration.showNotification(
        data.title || 'НАВАЛИВАЙ',
        options
      )
    )
  } catch (error) {
    console.error('[SW] Push notification error:', error)
  }
})

// Notification click
self.addEventListener('notificationclick', event => {
  event.notification.close()
  
  const urlToOpen = event.notification.data || '/'
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus()
          }
        }
        
        // Open new window/tab
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen)
        }
      })
  )
})

// Handle updates
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME })
  }
})

console.log('[SW] Service Worker loaded')