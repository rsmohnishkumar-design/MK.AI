// Paste your Firebase web app config here (Firebase console → Project settings
// → General → Your apps → Web app → "SDK setup and configuration" → Config).
// These values are safe to publish: they only identify your project. Access
// is controlled by the security rules in firestore.rules.
export const firebaseConfig = {
  apiKey: "AIzaSyAUJbM-8j7CclTFbsw6mTZIDL3NXoZ10Ec",
  authDomain: "mkai-c042b.firebaseapp.com",
  projectId: "mkai-c042b",
  storageBucket: "mkai-c042b.firebasestorage.app",
  messagingSenderId: "857947772189",
  appId: "1:857947772189:web:3c92efd564cb149d7b7df4",
};

// reCAPTCHA Enterprise site key for Firebase App Check (safe to publish).
// Firebase AI Logic won't answer without App Check.
export const RECAPTCHA_SITE_KEY = "6Ld6B8stAAAAAFa5Ps3LqoSXw3G9P2_1Fpw74xTu";

// Gemini models to try, in order. When Google says one is overloaded or it's
// too slow, MK.ai moves on to the next (each has separate capacity).
export const GEMINI_MODELS = [
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash-lite",
];
export const GEMINI_MODEL = GEMINI_MODELS[0];

// Must match TRIAL_HOURS in firestore.rules.
export const TRIAL_HOURS = 3;
