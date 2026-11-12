// Service worker for the planner inbox: shows new-order alerts, even when the page is closed.

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch { d = { title: 'New order', body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'New order', {
    body: d.body || '',
    tag: d.tag,
    icon: 'img/icon-512.png',
    badge: 'img/favicon-48.png',
    requireInteraction: true,
    data: { url: d.url || 'planner.html' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || 'planner.html';
  e.waitUntil((async () => {
    const wins = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = wins.find((w) => w.url.includes('planner.html'));
    if (open) { await open.focus(); return; }
    await clients.openWindow(url);
  })());
});
