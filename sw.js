// MK.ai service worker: makes the app installable and lets it open offline.
// Bump CACHE when shipping changes that must reach installed apps right away.
// Paths are relative to this file, so it works under /MK.AI/ on GitHub Pages.
const CACHE = "mkai-v71";
const SHELL = [
  "./",
  "style.css?v=37",
  "js/app.js?v=37",
  "js/ai.js",
  "js/brain.js",
  "js/firebase.js",
  "js/providers.js",
  "js/local.js",
  "js/wiki.js",
  "js/creator.js",
  "js/format.js",
  "js/knowledge.js",
  "js/meaning.js",
  "js/voice.js",
  "js/attach.js",
  "js/training.js",
  "js/reader.js",
  "js/algebra.js",
  "js/words.js",
  "js/kb.js",
  "js/mathsolve.js",
  "js/mathword.js",
  "js/mathplus.js",
  "js/mathextra.js",
  "js/symbolic.js",
  "js/mathadvanced.js",
  "js/science.js",
  "js/apps.js",
  "js/deepthink.js",
  "js/thirukkural.js",
  "js/vision.js",
  "js/learning.js",
  "js/personal.js",
  "js/quiz.js",
  "js/converse.js",
  "js/limits.js",
  "data/kb/index.json",
  "data/apps.json",
  "learn.html",
  "firebase-config.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
];
const ROOT = new URL("./", self.location).href;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only our own files and the Firebase library itself; database, login and AI
  // requests (and the admin vault) always go straight to the network.
  const firebaseLibrary = url.origin === "https://www.gstatic.com" && url.pathname.startsWith("/firebasejs/");
  if (request.method !== "GET" || (url.origin !== self.location.origin && !firebaseLibrary)) return;
  if (url.pathname.includes("vault")) return;

  // Network first so updates (including firebase-config.js) show up right away;
  // the cached copy is only used when offline. Our own files are revalidated
  // with the server every time, so a stale browser copy is never mixed in.
  event.respondWith(
    fetch(firebaseLibrary ? request : new Request(request.url, { cache: "no-cache" }))
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          const key = request.mode === "navigate" ? ROOT : request;
          caches.open(CACHE).then((cache) => cache.put(key, copy));
        }
        return res;
      })
      .catch(() => caches.match(request.mode === "navigate" ? ROOT : request))
  );
});
