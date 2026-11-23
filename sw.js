self.addEventListener('install',event=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let payload={};try{payload=event.data?.json()||{}}catch(e){payload={body:event.data?.text()||''}}
 const data=payload.data||payload;
 const title=data.title||payload.notification?.title||'CLUB KISS｜新規注文';
 const body=data.body||payload.notification?.body||'注文が届きました';
 event.waitUntil(self.registration.showNotification(title,{body,tag:'club-kiss-order-'+Date.now(),icon:'./club-kiss-icon-512.png',badge:'./club-kiss-icon-512.png',data:{url:data.url||'./'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const url=event.notification.data?.url||'./';
 event.waitUntil((async()=>{const windows=await clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows){if(client.url.startsWith(self.registration.scope)){await client.focus();return}}await clients.openWindow(url)})());
});
