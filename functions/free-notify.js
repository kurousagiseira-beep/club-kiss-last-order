'use strict';
// GitHub Actions scheduled polling: no paid Firebase Cloud Functions required.
// Configure FIREBASE_SERVICE_ACCOUNT_JSON as an encrypted GitHub Actions secret.
const {initializeApp,cert}=require('firebase-admin/app');
const {getFirestore,Timestamp}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {getMessaging}=require('firebase-admin/messaging');
const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if(!raw){console.error('Missing FIREBASE_SERVICE_ACCOUNT_JSON GitHub Actions secret.');process.exit(1)}
let credentials;try{credentials=JSON.parse(raw)}catch(e){console.error('Invalid service account JSON');process.exit(1)}
initializeApp({credential:cert(credentials)});
const db=getFirestore();
const link='https://kurousagiseira-beep.github.io/club-kiss-last-order/';
async function main(){
 const admin=await getAuth().getUserByEmail('kurousagiseira@gmail.com');
 const tokenDocs=(await db.collection('club_kiss_admin_push_tokens').get()).docs.filter(d=>d.data().uid===admin.uid&&typeof d.data().token==='string'&&d.data().token);
 if(!tokenDocs.length){console.log('No registered admin devices; will retry next schedule.');return}
 // Query only recent orders to bound free Firestore usage. Each order has a per-order notification marker.
 const since=Timestamp.fromMillis(Date.now()-7*24*60*60*1000);
 const orders=await db.collection('club_kiss_orders').where('createdAt','>=',since).orderBy('createdAt','asc').limit(200).get();
 let sent=0;
 for(const order of orders.docs){
   const data=order.data();if(!Array.isArray(data.items)||data.pushSentAt)continue;
   const claimRef=db.collection('club_kiss_push_delivery').doc(order.id);
   const claim=await db.runTransaction(async tx=>{const snap=await tx.get(claimRef);if(snap.exists)return false;tx.create(claimRef,{createdAt:Timestamp.now()});return true});
   if(!claim)continue;
   const title='CLUB KISS｜'+String(data.table||'不明')+'卓 新規注文';
   const body=data.items.map(String).join('、').slice(0,220)||'注文が届きました';
   try{
     const response=await getMessaging().sendEachForMulticast({tokens:tokenDocs.map(d=>d.data().token),data:{title,body,url:link},webpush:{headers:{Urgency:'high'},fcmOptions:{link}}});
     const invalid=[];
     response.responses.forEach((r,i)=>{if(!r.success&&['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(r.error?.code))invalid.push(tokenDocs[i].ref)});
     await Promise.all(invalid.map(ref=>ref.delete()));
     if(response.successCount===0){await claimRef.delete();console.warn('All notifications failed for order',order.id);continue}
     await order.ref.update({pushSentAt:Timestamp.now()});sent++;
   }catch(e){await claimRef.delete();console.error('Push failed',order.id,e.message)}
 }
 console.log('Sent admin notifications for',sent,'orders');
}
main().catch(e=>{console.error(e);process.exit(1)});
