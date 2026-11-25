const admin = require('firebase-admin');

async function main() {
  const secret = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!secret) throw new Error('GitHub secret FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
  let credentials;
  try { credentials = JSON.parse(secret); }
  catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must contain the complete Firebase service account JSON'); }
  admin.initializeApp({ credential: admin.credential.cert(credentials) });
  const db = admin.firestore();
  // Assistance requests use a separate delivery marker so they do not affect orders.
  const help = await db.collection('club_kiss_help_requests').where('active','==',true).get();
  if (!help.empty) {
    const devices = (await db.collection('club_kiss_admin_push_tokens').get()).docs.filter(d=>typeof d.data().token==='string'&&d.data().token);
    for (const request of help.docs) {
      const x=request.data();
      const stamp=x.createdAt?.toMillis?.();
      if (!stamp || x.pushDeliveredMs===stamp || !devices.length) continue;
      const result=await admin.messaging().sendEachForMulticast({
        tokens:devices.map(d=>d.data().token),
        data:{title:'CLUB KISS｜🔥 盛り上げ応援要請',body:String(x.table||'不明')+'｜担当：'+String(x.staff||'不明')+'　応援をお願いします。',url:'https://kurousagiseira-beep.github.io/club-kiss-last-order/'},
        webpush:{headers:{Urgency:'high'}}
      });
      console.log('Assistance push:',result.successCount,'success,',result.failureCount,'failed');
      if(result.successCount) await db.runTransaction(async tx=>{
        const latest=await tx.get(request.ref);
        if(latest.data()?.createdAt?.toMillis?.()===stamp) tx.update(request.ref,{pushDeliveredMs:stamp});
      });
    }
  }
  const stateRef = db.doc('club_kiss_push_system/order_cursor');
  const state = await stateRef.get();
  // First run starts from 10 minutes ago so recent test orders can be delivered.
  let cursor = state.exists && state.data().lastCreatedAt
    ? state.data().lastCreatedAt
    : admin.firestore.Timestamp.fromMillis(Date.now() - 10 * 60 * 1000);
  let query = db.collection('club_kiss_orders').orderBy('createdAt').startAfter(cursor).limit(100);
  const orders = await query.get();
  if (orders.empty) {
    if (!state.exists) await stateRef.set({lastCreatedAt:cursor, initializedAt:admin.firestore.FieldValue.serverTimestamp()});
    console.log('No new orders');
    return;
  }
  const tokensSnapshot = await db.collection('club_kiss_admin_push_tokens').get();
  const tokenDocs = tokensSnapshot.docs.filter(d => typeof d.data().token === 'string' && d.data().token);
  console.log('New orders:', orders.size, 'registered admin devices:', tokenDocs.length);
  for (const orderDoc of orders.docs) {
    const order = orderDoc.data();
    if (!order.createdAt || typeof order.createdAt.toMillis !== 'function') continue;
    const title = 'CLUB KISS｜' + String(order.table || '不明').slice(0,30) + '卓 新規注文';
    const body = (Array.isArray(order.items) ? order.items.join('、') : '注文が届きました').slice(0,180);
    if (tokenDocs.length) {
      const message = {
        tokens: tokenDocs.map(d => d.data().token),
        data: { title, body, url: 'https://kurousagiseira-beep.github.io/club-kiss-last-order/' },
        webpush: { headers: { Urgency: 'high' } }
      };
      const result = await admin.messaging().sendEachForMulticast(message);
      console.log('Order push result:', result.successCount, 'success,', result.failureCount, 'failed');
      for (let i=0; i<result.responses.length; i++) {
        const response=result.responses[i];
        if (!response.success) {
          const code=response.error?.code || 'unknown';
          console.warn('Push error:',code);
          if (['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(code)) {
            await tokenDocs[i].ref.delete();
          }
        }
      }
    }
    cursor = order.createdAt;
    await stateRef.set({lastCreatedAt:cursor, updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
