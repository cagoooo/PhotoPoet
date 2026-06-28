const BUILD_VERSION = "0.1.0-460a16a3-202606280632";

self.addEventListener('install', () => {
  console.info('[SW] installed', BUILD_VERSION);
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.claim().then(() =>
      self.clients.matchAll({includeUncontrolled: true}).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({type: 'SW_ACTIVATED', version: BUILD_VERSION});
        });
      })
    )
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
