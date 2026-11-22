# CLUB KISS LAST ORDER — prototype

Standalone GitHub Pages-ready prototype. Table selection, vertical staff picker, product quantity selection, confirmation, and device-local order history.

**Not yet a shared ordering or push-notification service.** Orders are only saved to localStorage in the sending browser. `sw.js` contains a notification display handler, but no subscription or backend sender is configured. Do not use for live service until a shared database, authenticated roles, and Web Push subscription + server-side delivery are implemented and tested.

## Deploy
Create a new GitHub repository (e.g. `club-kiss-last-order`), upload these files to the repository root, then enable GitHub Pages from the default branch root in Settings → Pages. On iPhone, open the HTTPS Pages URL in Safari and choose Share → Add to Home Screen.

## Next phase
Use Firebase Auth and Firestore for real-time orders and server-side Web Push (e.g. Firebase Cloud Functions with VAPID/Web Push). Restrict access to authorized staff. Store each manager's push subscription securely; send notification on order creation; notification click should deep-link to the exact order ID and mark it read only after manager acknowledgement. Test on installed iOS home-screen web app.
