self.addEventListener('push', (event) => {
  event.waitUntil(
    self.registration.showNotification('Haukkari', {
      body: 'Päivän treenitarkistus odottaa.',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'haukkari-daily-check',
      data: { url: '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const current = clients.find((client) => 'focus' in client)
        return current ? current.focus() : self.clients.openWindow('/')
      }),
  )
})
