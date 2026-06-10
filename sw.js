// Rituel — service worker (notifications push)
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('push', function(e){
  var d = {};
  try{ d = e.data ? e.data.json() : {}; }catch(err){}
  e.waitUntil(self.registration.showNotification(d.title || 'Rituel', {
    body: d.body || 'Petit rappel tout doux 🌸',
    data: { url: d.url || '/' },
    tag: d.tag || 'rituel'
  }));
});
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(function(list){
    for (var i=0;i<list.length;i++){ if ('focus' in list[i]) return list[i].focus(); }
    return self.clients.openWindow(e.notification.data && e.notification.data.url || '/');
  }));
});
