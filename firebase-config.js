// Paste your Firebase web app config here (Firebase console → Project settings
// → General → Your apps → Web app → "SDK setup and configuration" → Config).
// These values are safe to publish: they only identify your project. Access
// is controlled by the security rules in firestore.rules.
export const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000",
};

// Which Gemini model writes the answers.
export const GEMINI_MODEL = "gemini-flash-latest";

// Must match TRIAL_HOURS in firestore.rules.
export const TRIAL_HOURS = 3;
