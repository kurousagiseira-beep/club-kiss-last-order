'use strict';
const {onDocumentCreated}=require('firebase-functions/v2/firestore');
const {initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {getMessaging}=require('firebase-admin/messaging');
initializeApp();

// A new order sends a push ONLY to administrator-owned registered devices.
// Do not accept notification recipients from the order document.
exports.notifyAdminOnOrder=onDocumentCreated({document:'club_kiss_orders/{orderId}',region:'asia-northeast1',retry:false},async event=>{
  const order=event.data?.data();
  if(!order||!Array.isArray(order.items))return;
  const db=getFirestore();
  const recipients=await db.collection('club_kiss_admin_push_tokens').get();
  if(recipients.empty)return;
  const adminEmail='kurousagiseira@gmail.com';
  const {getAuth}=require('firebase-admin/auth');
  const admin=await getAuth().getUserByEmail(adminEmail);
  const valid=recipients.docs.filter(d=>d.data().uid===admin.uid&&typeof d.data().token==='string'&&d.data().token);
  if(!valid.length)return;
  const title='CLUB KISS｜'+String(order.table||'不明')+'卓 新規注文';
  const body=(order.items||[]).map(String).join('、').slice(0,220)||'新しい注文が届きました';
  const message={tokens:valid.map(d=>d.data().token),data:{title,body,url:'https://kurousagiseira-beep.github.io/club-kiss-last-order/'},webpush:{headers:{Urgency:'high'},fcmOptions:{link:'https://kurousagiseira-beep.github.io/club-kiss-last-order/'}}};
  const results=await getMessaging().sendEachForMulticast(message);
  const stale=[];
  results.responses.forEach((r,i)=>{if(!r.success&&['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(r.error?.code))stale.push(valid[i].ref)});
  await Promise.all(stale.map(ref=>ref.delete()));
});
