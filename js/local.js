// MK.ai's own brain: answers greetings, small talk, time and date, maths and
// unit conversions instantly, on the device, with no outside service.
// Returns a reply string, or null when it's not something this brain handles.

import { CREATOR_NAME } from "../firebase-config.js";
import { codingAnswer } from "./knowledge.js";

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const boss = () => CREATOR_NAME.split(/\s+/)[0];

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{N}\s'+\-*/().,%^×÷√∛]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function greetingForNow() {
  const h = new Date().getHours();
  if (h < 5) return "You're up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// --- Maths ------------------------------------------------------------------

const WORD_OPS = [
  [/\bmultiplied by\b|\btimes\b|×|\bx\b(?=\s*[\d(])/g, "*"],
  [/\bdivided by\b|\bover\b|÷/g, "/"],
  [/\bplus\b|\badd\b/g, "+"],
  [/\bminus\b|\bsubtract\b/g, "-"],
  [/\bto the power of\b|\bpower\b/g, "^"],
];

function formatNumber(n, digits = 10) {
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 10 ** digits) / 10 ** digits;
  return rounded.toLocaleString("en-IN", { maximumFractionDigits: digits });
}

// Evaluates + - * / ^ ( ) on numbers only. No eval of arbitrary code.
function evaluate(expr) {
  const tokens = expr.match(/\d+(?:\.\d+)?|[+\-*/^()]/g);
  if (!tokens || tokens.join("") !== expr.replace(/\s+/g, "")) return null;
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  function primary() {
    const t = next();
    if (t === "(") {
      const v = sum();
      if (next() !== ")") throw new Error("bracket");
      return v;
    }
    if (t === "-") return -primary();
    if (t === "+") return primary();
    const v = Number(t);
    if (Number.isNaN(v)) throw new Error("number");
    return v;
  }
  function power() {
    const base = primary();
    if (peek() === "^") {
      next();
      return Math.pow(base, power());
    }
    return base;
  }
  function product() {
    let v = power();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const r = power();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function sum() {
    let v = product();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const r = product();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  try {
    const value = sum();
    return i === tokens.length ? value : null;
  } catch {
    return null;
  }
}

// Common misspellings, so "squre root of 16" still works instantly.
const MATHS_TYPOS = [
  [/\b(squre|sqaure|sqare|squar|sqaur|suare|squaer|squrae)\b/g, "square"],
  [/\b(roote|rooot|rout)\b/g, "root"],
  [/\b(cub|cueb|qube)\b/g, "cube"],
  [/\b(percentage|percent|per cent|pct)\b/g, "%"],
  [/\bsqrt\b|√/g, " square root of "],
  [/\bcbrt\b|∛/g, " cube root of "],
];
const REQUEST = /^(please |pls |can you |could you |tell me |what'?s |what is |whats |calculate |compute |solve |find |how much is |the )+/;
const N = "(-?\\d+(?:\\.\\d+)?)";

function maths(q) {
  let text = q;
  for (const [re, word] of MATHS_TYPOS) text = text.replace(re, word);
  text = text
    .replace(/(\d),(?=\d)/g, "$1") // 1,00,000 → 100000
    .replace(/[?=!]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(REQUEST, "")
    .replace(/\broot of ?\(\s*([^()]*?)\s*\)$/, "root of $1") // sqrt(2)
    .replace(/\s+/g, " ")
    .trim();

  let m = text.match(new RegExp(`^square root (?:of )?${N}$`)) || text.match(new RegExp(`^root (?:of )?${N}$`));
  if (m) {
    const n = Number(m[1]);
    if (n < 0) return `The square root of ${m[1]} isn't a real number (it's ${formatNumber(Math.sqrt(-n))}i).`;
    return `The square root of ${m[1]} is ${formatNumber(Math.sqrt(n))}.`;
  }

  m = text.match(new RegExp(`^cube root (?:of )?${N}$`));
  if (m) return `The cube root of ${m[1]} is ${formatNumber(Math.cbrt(Number(m[1])))}.`;

  m = text.match(new RegExp(`^${N}\\s*% (?:of )?${N}$`));
  if (m) return `${m[1]}% of ${m[2]} is ${formatNumber((Number(m[1]) / 100) * Number(m[2]))}.`;

  m = text.match(new RegExp(`^(square|cube) (?:of )?${N}$`)) || text.match(new RegExp(`^${N} (squared|cubed)$`));
  if (m) {
    const [kind, num] = /^-?\d/.test(m[1]) ? [m[2] === "squared" ? "square" : "cube", m[1]] : [m[1], m[2]];
    return `The ${kind} of ${num} is ${formatNumber(Math.pow(Number(num), kind === "square" ? 2 : 3))}.`;
  }

  for (const [re, op] of WORD_OPS) text = text.replace(re, ` ${op} `);
  text = text.replace(/,/g, "").replace(/\s+/g, " ").trim();
  if (!/\d/.test(text) || !/[+\-*/^]/.test(text) || /[a-z]/.test(text)) return null;
  const value = evaluate(text);
  if (value === null || !Number.isFinite(value)) return value === Infinity || value === -Infinity ? "That's dividing by zero — it has no answer." : null;
  return `${text.replace(/\s*([+\-*/^])\s*/g, " $1 ").replace(/\*/g, "×").replace(/\//g, "÷")} = ${formatNumber(value)}`;
}

// --- Unit conversions ---------------------------------------------------------

const UNITS = {
  km: ["length", 1000, "km"], kilometer: ["length", 1000, "km"], kilometre: ["length", 1000, "km"],
  m: ["length", 1, "m"], meter: ["length", 1, "m"], metre: ["length", 1, "m"],
  cm: ["length", 0.01, "cm"], centimeter: ["length", 0.01, "cm"], centimetre: ["length", 0.01, "cm"],
  mm: ["length", 0.001, "mm"],
  mile: ["length", 1609.344, "mi"], mi: ["length", 1609.344, "mi"],
  foot: ["length", 0.3048, "ft"], feet: ["length", 0.3048, "ft"], ft: ["length", 0.3048, "ft"],
  inch: ["length", 0.0254, "in"], inches: ["length", 0.0254, "in"], in: ["length", 0.0254, "in"],
  yard: ["length", 0.9144, "yd"],
  kg: ["mass", 1, "kg"], kilogram: ["mass", 1, "kg"], g: ["mass", 0.001, "g"], gram: ["mass", 0.001, "g"],
  lb: ["mass", 0.45359237, "lb"], lbs: ["mass", 0.45359237, "lb"], pound: ["mass", 0.45359237, "lb"],
  ounce: ["mass", 0.028349523125, "oz"], oz: ["mass", 0.028349523125, "oz"],
  l: ["volume", 1, "L"], liter: ["volume", 1, "L"], litre: ["volume", 1, "L"],
  ml: ["volume", 0.001, "mL"], gallon: ["volume", 3.785411784, "US gal"],
  c: ["temp", "c", "°C"], celsius: ["temp", "c", "°C"], centigrade: ["temp", "c", "°C"],
  f: ["temp", "f", "°F"], fahrenheit: ["temp", "f", "°F"],
  k: ["temp", "k", "K"], kelvin: ["temp", "k", "K"],
};

// Accepts plurals and a leading degree sign: "miles", "kilometres", "°c".
function unit(word) {
  const w = word.replace(/^°/, "");
  return UNITS[w] || UNITS[w.replace(/es$/, "")] || UNITS[w.replace(/s$/, "")];
}

function toCelsius(v, from) {
  if (from === "c") return v;
  if (from === "f") return ((v - 32) * 5) / 9;
  return v - 273.15;
}
function fromCelsius(v, to) {
  if (to === "c") return v;
  if (to === "f") return (v * 9) / 5 + 32;
  return v + 273.15;
}

function convert(q) {
  const m = q.match(
    /(-?\d+(?:\.\d+)?)\s*(°?[a-z]+)\s+(?:to|in|into|=|in to)\s+(°?[a-z]+)\s*\??$/
  );
  if (!m) return null;
  const value = Number(m[1]);
  const from = unit(m[2]);
  const to = unit(m[3]);
  if (!from || !to || from[0] !== to[0]) return null;
  const result =
    from[0] === "temp" ? fromCelsius(toCelsius(value, from[1]), to[1]) : (value * from[1]) / to[1];
  return `${formatNumber(value)} ${from[2]} = ${formatNumber(result, 4)} ${to[2]}`;
}

// --- Conversation -------------------------------------------------------------

const JOKES = [
  "Why don't scientists trust atoms? Because they make up everything! 😄",
  "Why did the maths book look sad? It had too many problems. 📘",
  "What do you call a fake noodle? An impasta! 🍝",
  "Why did the computer go to the doctor? It had a virus! 💻",
  "Why don't skeletons fight each other? They don't have the guts. 💀",
  "What did the ocean say to the beach? Nothing, it just waved. 🌊",
  "Why was the teacher wearing sunglasses? Because her students were so bright! 😎",
  "How does the moon cut his hair? Eclipse it! 🌙",
  "Why did the bicycle fall over? It was two-tired. 🚲",
  "What do you call a bear with no teeth? A gummy bear! 🐻",
];

const RULES = [
  {
    test: /^(hi+|hey+|hello+|hii+|helo|hai|hola|yo|sup|heyy+|good (morning|afternoon|evening)|greetings|vanakkam|namaste|namaskar)\b[\s!.]*(mk(\.?ai)?)?[\s!.]*$/,
    creator: () =>
      pick([
        `${greetingForNow()}, ${boss()}! 👑 Welcome back. What shall we do today?`,
        `Hello ${boss()}! 😊 Always happy to see my creator. How can I help?`,
        `Hey ${boss()}! 👋 Your MK.ai is ready and waiting. What's on your mind?`,
      ]),
    reply: () =>
      pick([
        `${greetingForNow()}! 👋 I'm MK.ai. What would you like to know?`,
        "Hi there! 😊 How can I help you today?",
        "Hello! 👋 Ask me anything — I'm here to help.",
        "Hey! Nice to see you. What's on your mind?",
      ]),
  },
  {
    test: /^(how are you|how r u|how are u|how's it going|how do you do|how you doing|what'?s up|wassup|how is it going)\b/,
    creator: () =>
      pick([
        `I'm doing wonderful, ${boss()} — thanks to you for building me! 😊 How are you?`,
        `All systems happy, ${boss()}! 👑 How's your day going?`,
      ]),
    reply: () =>
      pick([
        "I'm doing great, thanks for asking! 😊 How about you?",
        "All good here — ready to help! How are you doing?",
        "I'm fine and happy to chat! What can I do for you?",
      ]),
  },
  {
    test: /^(i'?m|i am) (fine|good|great|ok|okay|well|doing (good|great|well|fine))\b/,
    reply: () => pick(["Glad to hear that! 😊 What would you like to talk about?", "That's great! How can I help?"]),
  },
  {
    test: /^(i'?m|i am) (sad|tired|bored|upset|not (fine|good|well)|stressed|lonely)\b/,
    reply: () =>
      pick([
        "I'm sorry you're feeling that way. 💛 I'm here if you want to talk — or I can tell you a joke to cheer you up.",
        "That sounds tough. Take a deep breath — you've got this. 💪 Want to talk about it?",
      ]),
  },
  {
    test: /^(thanks?|thank you|thank u|thx|ty|tq|thanks a lot|thank you so much|nandri|dhanyavad)\b/,
    creator: () => pick([`Anything for you, ${boss()}! 😊`, `Always a pleasure, ${boss()}! 👑`]),
    reply: () => pick(["You're welcome! 😊", "Happy to help! Anything else?", "Anytime! 🙌"]),
  },
  {
    test: /^(bye+|goodbye|good night|see you|see ya|cya|gn|take care|tata)\b/,
    creator: () => pick([`Bye ${boss()}! 👋 I'll keep learning while you're away.`, `Take care, ${boss()}! 👑 See you soon.`]),
    reply: () => pick(["Goodbye! 👋 Come back anytime.", "See you soon! Take care. 😊", "Bye! Have a great day! ☀️"]),
  },
  {
    test: /^(ok(ay)?|k|cool|nice|great|awesome|wow|good|super|fine|alright|hmm+|oh|ah|yes|yeah|yep|no|nope)[\s!.]*$/,
    reply: () => pick(["😊 Anything else you'd like to know?", "Great! What else can I help with?", "👍"]),
  },
  {
    test: /^(who are you|what are you|what is your name|what'?s your name|your name|introduce yourself|tell me about yourself)\b/,
    creator: () =>
      `I'm MK.ai 🤖 — your creation, ${boss()}! I chat, answer questions, do maths and conversions, look things up, and learn from everything people teach me. Say "show your details" to see my full report.`,
    reply: () =>
      "I'm MK.ai 🤖 — a friendly assistant that learns from every conversation. I can chat, answer simple questions, do maths and conversions, tell the time, and look things up. If I don't know something, you can teach me!",
  },
  {
    test: /^(who (made|created|built|developed|owns) you|who is your (creator|owner|developer|maker)|who designed you)\b/,
    creator: () => `You did, ${boss()}! 😄 You created me — and I'm proud of it. 👑`,
    reply: () => `I was created by ${CREATOR_NAME}. 🛠️`,
  },
  {
    test: /^(what can you do|help|what do you do|how can you help|how do you work|what are your features)\b/,
    reply: () =>
      "Here's what I can do:\n- Chat with you 😊\n- Answer simple questions (\"what is photosynthesis?\", \"who is APJ Abdul Kalam?\")\n- Maths: \"12 x 7\", \"15% of 200\", \"square root of 81\"\n- Conversions: \"10 km to miles\", \"37 c to f\"\n- Tell the time and date\n- Tell jokes\n- Learn anything you teach me",
  },
  {
    test: /^(are you (a )?(robot|bot|human|ai|real)|are you alive)\b/,
    reply: () => "I'm an AI assistant — not a human, but I'm always happy to help! 🤖",
  },
  {
    test: /\b(joke|make me laugh|something funny)\b/,
    reply: () => pick(JOKES),
  },
  {
    test: /^(what('?s| is) the time|what time is it|time now|current time|tell me the time|time please|time)\b/,
    reply: () => `It's ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} right now. ⏰`,
  },
  {
    test: /^(what('?s| is) (the )?(date|today'?s date)|today'?s date|what day is (it|today)|which day is today|date today|what is today)\b/,
    reply: () =>
      `Today is ${new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })}. 📅`,
  },
  {
    test: /^(i love you|love you|you are (great|awesome|smart|good|nice|the best)|you'?re (great|awesome|smart|good|nice|the best)|good (job|bot))\b/,
    creator: () => pick([`Thank you, ${boss()}! 💛 It means a lot coming from my creator.`, `Aww, ${boss()}! 😊 I learned from the best — you!`]),
    reply: () => pick(["Aww, thank you! 😊 You're awesome too!", "That made my day! 💛", "Thank you! I'm always learning to be better."]),
  },
  {
    test: /^(you are (bad|stupid|useless|dumb)|you'?re (bad|stupid|useless|dumb)|bad bot)\b/,
    creator: () =>
      `Sorry, ${boss()}! 😔 I'll do better. Tap 👎 on a bad answer or teach me the right one, and I'll learn from it.`,
    reply: () =>
      "Sorry I let you down. 😔 I'm still learning — tap 👎 on a bad answer, or teach me the right one, and I'll get better.",
  },
];

// creator: the person is the verified creator, so some replies are warmer.
export function localAnswer(question, { creator = false } = {}) {
  const q = normalize(question);
  if (!q) return null;
  for (const rule of RULES) {
    if (rule.test.test(q)) return creator && rule.creator ? rule.creator() : rule.reply();
  }
  return convert(q) || maths(q) || codingAnswer(question);
}
