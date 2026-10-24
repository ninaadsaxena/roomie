// Service Worker for Roomie Background Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Listen for background push notifications
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = {
      notification: {
        title: 'Roomie Alert',
        body: event.data ? event.data.text() : 'You have a new update in your flat.'
      }
    }
  }

  const title = data.notification?.title || data.title || 'Roomie Alert 🏠'
  const options = {
    body: data.notification?.body || data.body || 'New flat update',
    icon: '/roomie-icon.svg',
    badge: '/roomie-icon.svg',
    vibrate: [200, 100, 200],
    data: {
      url: data.data?.url || '/'
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

// Open app when user taps the notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
