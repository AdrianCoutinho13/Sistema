/* Service worker mínimo: permite instalar o sistema como aplicativo.
   NÃO guarda nada em cache de propósito: assim você sempre recebe a versão mais nova do sistema. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() => new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem conexão</title>' +
      '<body style="font-family:sans-serif;background:#0b1120;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">' +
      '<div style="text-align:center;padding:24px"><h2>Sem conexão com a internet</h2><p>O sistema precisa de internet. Conecte-se e tente novamente.</p></div></body>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    ))
  );
});
