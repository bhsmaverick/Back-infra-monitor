self.addEventListener('push', function(event) {
  let message = 'Incident alert from InfraMonitor!';
  if (event.data) {
    message = event.data.text();
  }

  const options = {
    body: message,
    icon: '/icon.png',
    badge: '/icon.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '2'
    }
  };

  event.waitUntil(
    self.registration.showNotification('InfraMonitor Alert', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
