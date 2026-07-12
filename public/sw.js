// Minimal service worker: no offline caching (sessies leven in Firestore en
// vereisen sowieso een verbinding), enkel aanwezig zodat Chrome/Android de
// app als installeerbaar herkent.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // pass-through, geen caching
});
