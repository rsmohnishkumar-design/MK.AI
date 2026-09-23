import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAI, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js";
import { firebaseConfig, RECAPTCHA_SITE_KEY } from "../firebase-config.js";

// False until firebase-config.js has been filled in.
export const configured = !String(firebaseConfig.apiKey || "").startsWith("PASTE");

export const app = configured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

// App Check proves requests come from this website. Firebase AI Logic refuses
// to answer without it. Set up before the AI so every AI request carries it.
if (app && RECAPTCHA_SITE_KEY && !window.MKAI_EMULATORS) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

// Gemini through Firebase AI Logic, on the free Gemini Developer API.
export const ai = app ? getAI(app, { backend: new GoogleAIBackend() }) : null;

// Local testing against the Firebase emulators.
if (app && window.MKAI_EMULATORS) {
  connectAuthEmulator(auth, `http://${window.MKAI_EMULATORS.auth}`, { disableWarnings: true });
  const [host, port] = window.MKAI_EMULATORS.firestore.split(":");
  connectFirestoreEmulator(db, host, Number(port));
}

// Firebase error codes → messages people can act on.
export function friendlyError(err) {
  const code = err?.code || "";
  const messages = {
    "auth/invalid-credential": "Wrong email or password.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/user-not-found": "Wrong email or password.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/email-already-in-use": "An account with that email already exists — log in instead.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/too-many-requests": "Too many attempts — wait a minute and try again.",
    "auth/network-request-failed": "No connection — check your internet and try again.",
    "auth/operation-not-allowed": "Email sign-in isn't enabled in Firebase yet (see the README).",
    "auth/unauthorized-domain": "This website isn't on Firebase's authorized domains list yet (see the README).",
    "permission-denied": "You don't have permission to do that.",
    unavailable: "Can't reach the database — check your internet and try again.",
  };
  return messages[code] || err?.message || "Something went wrong.";
}
