// Creator mode: when someone says they created MK.ai, it asks for the secret
// code. The code lives only in the Firestore security rules (never in this
// public code): the rules accept the "creator" mark on a profile only with the
// right code. Once verified, MK.ai greets its creator warmly on every device
// and shows its full details when asked.

import {
  doc,
  updateDoc,
  getDoc,
  collection,
  query,
  where,
  getCountFromServer,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { PROVIDERS, keyField } from "./providers.js";
import { CREATOR_NAME, TRIAL_HOURS } from "../firebase-config.js";
import { meaningReady } from "./meaning.js";

const QUESTION_START = /^(who|whom|whose|did|do|does|what|can|could|how|why|when|where|which|is|are|was|were)\b/;

function normalize(text) {
  return text.toLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ").trim();
}

// "I created you", "I'm your creator", "it's me, Mohnishkumar"…
export function claimsCreator(text) {
  const q = normalize(text);
  if (!q || QUESTION_START.test(q)) return false;
  const name = CREATOR_NAME.toLowerCase().split(/\s+/)[0];
  return (
    /\b(i|i'm|i am|me|it's me|its me)\b.*\b(created|create|made|make|built|build|developed|coded|programmed|designed|invented|trained)\b.*\byou\b/.test(q) ||
    /\b(i'm|im|i am|it's me|its me|this is|me)\b.*\byour (creator|maker|developer|owner|founder|father|dad|boss|master|programmer|inventor)\b/.test(q) ||
    new RegExp(`^(hi |hey |hello )?(i'm|im|i am|it's me|its me|this is|me) ${name}\\b`).test(q)
  );
}

// "show your details", "your stats", "status report"…
export function asksForDetails(text) {
  const q = normalize(text);
  return /^(show|give|tell|list|display|send)?\s*(me )?(all )?(of )?(your|ur|its|the|my|mk ai'?s?|mkai'?s?)?\s*(full |complete |all )?(details|detail|stats|statistics|status|report|info|information|everything about you)( about you)?( please| pls)?$/.test(q);
}

// A reply to "what's the secret code?" is a single short word or number.
export function looksLikeCode(text) {
  return /^\S{1,40}$/.test(text.trim());
}

export function isCancel(text) {
  return /^(cancel|never ?mind|nevermind|forget it|stop|no|leave it)\b/.test(normalize(text));
}

// --- Wrong-code lockout, per device -----------------------------------------------
const LOCK_KEY = "mkai-creator-lock";
const MAX_TRIES = 3;
const LOCK_MINUTES = 15;

function readLock() {
  try {
    return JSON.parse(localStorage.getItem(LOCK_KEY)) || { tries: 0, until: 0 };
  } catch {
    return { tries: 0, until: 0 };
  }
}
function writeLock(lock) {
  try {
    localStorage.setItem(LOCK_KEY, JSON.stringify(lock));
  } catch {}
}
export function lockedMinutes() {
  const { until } = readLock();
  return until > Date.now() ? Math.ceil((until - Date.now()) / 60000) : 0;
}

// Resolves "ok", "wrong" or "error". The security rules decide.
export async function verifyCode(uid, code) {
  try {
    await updateDoc(doc(db, "users", uid), { creator: true, creatorCode: code.trim() });
    writeLock({ tries: 0, until: 0 });
    return "ok";
  } catch (err) {
    if (err?.code !== "permission-denied") {
      console.warn("Couldn't check the creator code:", err);
      return "error";
    }
    const lock = readLock();
    lock.tries = (lock.until > Date.now() ? 0 : lock.tries) + 1;
    if (lock.tries >= MAX_TRIES) {
      lock.tries = 0;
      lock.until = Date.now() + LOCK_MINUTES * 60000;
    }
    writeLock(lock);
    return "wrong";
  }
}

export const firstName = () => CREATOR_NAME.split(/\s+/)[0];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export const replies = {
  askCode: () =>
    pick([
      "Oh, really? 👀 My creator knows a secret code. Please tell me the code to prove it.",
      "Hmm, anyone could say that! 😄 If you're really my creator, tell me the secret code.",
    ]),
  already: () => `I know, ${firstName()}! 👑 You're already verified as my creator. How can I help you today?`,
  welcome: () =>
    `✅ Code accepted! Welcome, ${firstName()} 👑 — my creator! It's an honour to meet you.\n\n` +
    `I'll remember you on every device from now on. Ask me "show your details" anytime to see everything about me.`,
  wrong: () => {
    const minutes = lockedMinutes();
    return minutes
      ? `❌ That's not the right code. Too many wrong tries — creator check is locked for ${minutes} minutes.`
      : "❌ That's not the right code, so I can't treat you as my creator. You can try again by saying \"I created you\".";
  },
  locked: () => `🔒 Too many wrong codes. Please try again in ${lockedMinutes()} minutes.`,
  error: () => "I couldn't check the code right now — please check your internet and try again by saying \"I created you\".",
  cancelled: () => "Okay, no problem! 😊 What would you like to know?",
  detailsLocked: () => "🔒 Those details are only for my creator.",
};

// --- The details report -------------------------------------------------------------
const count = (q) => getCountFromServer(q).then((s) => s.data().count).catch(() => null);
const show = (n) => (n === null ? "?" : n.toLocaleString("en-IN"));

export async function detailsReport({ user, profile, chats }) {
  const learned = collection(db, "learned");
  const [total, wiki, taught, curated, settings] = await Promise.all([
    count(learned),
    count(query(learned, where("source", "==", "wikipedia"))),
    count(query(learned, where("source", "==", "taught"))),
    count(collection(db, "vault")),
    getDoc(doc(db, "settings", "ai")).then((s) => s.data() || {}).catch(() => null),
  ]);
  const fromAi = total === null || wiki === null || taught === null ? null : total - wiki - taught;

  const services =
    settings === null
      ? "couldn't check"
      : PROVIDERS.filter((p) => settings[keyField(p)]).map((p) => p.name).join(", ") || "none saved yet";

  const since = profile.createdAt?.toDate ? profile.createdAt.toDate().toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" }) : "?";
  const installed = window.matchMedia("(display-mode: standalone)").matches ? "installed app" : "browser";

  return [
    `Here's everything about me, ${firstName()} 👑`,
    "",
    "🤖 About me",
    `- Name: MK.ai`,
    `- Creator: ${CREATOR_NAME}`,
    `- Answer order: curated answers → my own brain → memory → your documents → Wikipedia → "teach me" (unknown questions go on my learning list)`,
    `- Outside AI: never used in chat, only as a helper in the Training room`,
    "",
    "🧠 My brain",
    `- Things I've learned: ${show(total)}`,
    `  - from AI answers: ${show(fromAi)}`,
    `  - from Wikipedia: ${show(wiki)}`,
    `  - taught by people: ${show(taught)}`,
    `- Curated answers in the vault: ${show(curated)}`,
    "",
    "⚡ Training helpers",
    `- Training-room helpers: ${services === "none saved yet" ? "Gemini" : `${services}, Gemini`}`,
    `- Neural memory (meaning matching): ${meaningReady() ? "on" : "starting / word matching for now"}`,
    "",
    "👤 Your account",
    `- Email: ${user.email}`,
    `- Access: ${profile.tier === "unlimited" ? "unlimited" : `${TRIAL_HOURS}-hour trial`}`,
    `- Member since: ${since}`,
    `- Your chats: ${chats}`,
    `- Using: ${installed}, ${navigator.onLine ? "online" : "offline"}`,
  ].join("\n");
}
