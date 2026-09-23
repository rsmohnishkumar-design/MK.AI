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

// Which Gemini model writes the answers.
export const GEMINI_MODEL = "gemini-flash-latest";

// Must match TRIAL_HOURS in firestore.rules.
export const TRIAL_HOURS = 3;
