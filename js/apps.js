// MK.ai's app builder: "make a calculator app", "create a snake game",
// "tic tac toe in python" → a complete, tested program from data/apps.json,
// ready to run (▶ run), download or copy. No outside service is used.

import { isManagementRequest, fieldsIn, managementAnswer } from "./builder.js";
import { knowledgeAnswer } from "./kb.js";
import { wikiAnswer, wikiFind } from "./wiki.js";

const URL_APPS = new URL("../data/apps.json", import.meta.url);
let apps = null;
let loading = null;

export function loadApps() {
  if (apps) return Promise.resolve(apps);
  loading ||= fetch(URL_APPS)
    .then((r) => r.json())
    .then((d) => (apps = d.apps))
    .catch((err) => {
      loading = null;
      throw err;
    });
  return loading;
}
// For tests
export function setApps(list) {
  apps = list;
}

const clean = (q) =>
  q
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9+#\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const BUILD = /\b(make|create|build|write|code|develop|design|generate|program|(?:need|want) (?:a|an|my own|to (?:make|build|create))|how (?:to|do i|can i) (?:make|create|build|code|write))\b/;
// Words that mean something else too ("make notes on photosynthesis",
// "make a quiz on history"): these need "app", "game", "in python"…
const AMBIGUOUS = new Set(["notes", "diary", "journal", "quiz", "mcq", "trivia", "marks", "bank", "contacts", "drawing", "paint", "painting", "sketch", "timer", "counter", "dice", "clock", "login", "log in", "sign in", "converter", "calc", "website", "web page", "webpage", "expense", "budget", "weather", "password", "flashcards", "tables"]);
const THING = /\b(app|apps|application|game|games|program|programme|project|script|website|web ?site|web ?page|page|site|code|source code|tool|software)\b/;
const OTHER_LANGS = [
  [/\bjava\b(?!script)/, "Java"],
  [/\bc\+\+|\bcpp\b/, "C++"],
  [/\bc#|\bc sharp\b/, "C#"],
  [/\bkotlin\b/, "Kotlin"],
  [/\bswift\b/, "Swift"],
  [/\bflutter\b|\bdart\b/, "Flutter"],
  [/\breact\b/, "React"],
  [/\bphp\b/, "PHP"],
  [/\bc language\b|\bin c\b/, "C"],
];

function languageOf(q) {
  if (/\bpython\b|\bpy\b|\btkinter\b|\bpygame\b/.test(q)) return "python";
  return "html";
}

function findApp(q, lang, strict) {
  let best = null;
  for (const app of apps) {
    for (const name of app.names) {
      if (strict && AMBIGUOUS.has(name)) continue;
      const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      if (!re.test(q)) continue;
      const score = name.length + (app.lang === lang ? 100 : 0);
      if (!best || score > best.score) best = { app, score };
    }
  }
  return best && best.app;
}

function listApps() {
  const web = apps.filter((a) => a.lang === "html" && a.names.length).map((a) => a.title);
  const py = apps.filter((a) => a.lang === "python").map((a) => a.title.replace(/^Python /, ""));
  return [
    "🛠️ I can build these for you — complete and tested, ready to run:",
    "",
    `**Web apps** (HTML, CSS & JavaScript — run them right here with ▶ run): ${web.join(", ")}.`,
    "",
    `**Python programs**: ${py.join(", ")}.`,
    "",
    'Just say, for example, "make a to-do app", "create a snake game" or "rock paper scissors in python".',
  ].join("\n");
}

function present(app, note = "") {
  const lines = [`🛠️ **${app.title}** — ${app.lang === "html" ? "HTML, CSS & JavaScript in one file" : "Python 3"}`, "", app.about];
  if (note) lines.push("", note);
  lines.push("", "```" + app.lang + "\n" + app.code + "```", "");
  if (app.lang === "html") {
    lines.push(
      "**How to use it:**",
      "- Tap **▶ run** on the code to try it right here.",
      `- Tap **⬇ download** to save it as a .html file, then open it in any browser (Chrome on your tablet works). To put it online for free, upload it to a GitHub repository and turn on GitHub Pages.`,
      "- Want changes? Edit the text, colours (the codes like #6366f1) or the lists at the top of the <script>."
    );
  } else {
    lines.push(
      "**How to run it:**",
      `- On a computer: save it as \`${app.file}\` (tap **⬇ download**), then run \`python ${app.file}\` in a terminal.`,
      "- On an Android tablet: use the free **Pydroid 3** app, or an online Python site like programiz.com.",
      "- Python 3 is needed (python.org)." + (/tkinter/.test(app.code) ? " Tkinter opens a window, so run it on a computer." : "")
    );
  }
  return lines.join("\n");
}

// The answer for a build request, or null.
export async function appAnswer(question, onText = () => {}) {
  // Code pasted in ("fix this app ```…```") is for Alpaca Pro, not a template
  if (/```/.test(question)) return null;
  const q = clean(question);
  if (!q) return null;
  const listing = /\b(what|which|list|show)\b.*\b(apps?|games?|programs?|projects?|websites?)\b.*\b(can you|you can|do you)\b.*\b(make|build|create|code|write)\b|^(what can you build|what apps can you make)/.test(q);
  const building = BUILD.test(q) || THING.test(q) || /\b(in|using) (python|html|javascript|js)\b/.test(q);
  if (!listing && !building) return null;
  try {
    await loadApps();
  } catch (err) {
    console.warn("Couldn't load the app templates:", err);
    return null;
  }
  if (listing) return listApps();
  const lang = languageOf(q);
  // "library management system with book name, author and year": a record-keeping
  // app with those fields (a tested template wins when one fits, like "expense tracker")
  if (isManagementRequest(question)) {
    const tpl = findApp(q, "html", false);
    if (!tpl || tpl.lang !== "html" || fieldsIn(question).length) return managementAnswer(question);
  }
  const explicit = THING.test(q.replace(/\bcode\b/, "")) || /\b(in|using|with) (python|html|javascript|js)\b/.test(q);
  const app = findApp(q, lang, !explicit);
  const isQuestion = /^(what|who|why|when|where|which|is|are|does|explain|define)\b/.test(q);
  if (!app) {
    if (!BUILD.test(q) || isQuestion) return null;
    // Anything else someone asks to build: Alpaca writes it, then the starter as a backup
    if (explicit || OTHER_LANGS.some(([re]) => re.test(q))) return (await alpacaBuild(question, lang, onText)) || (explicit ? buildFromResearch(q) : null);
    return null;
  }
  // A template, but with details of their own ("a portfolio website for a photographer
  // with a gallery and dark theme"): Alpaca writes it to order
  const extra = subjectOf(q).split(" ").filter((w) => w.length > 2 && !app.names.some((n) => n.includes(w)) && !app.title.toLowerCase().includes(w));
  if (extra.length >= 3 && BUILD.test(q)) {
    const custom = await alpacaBuild(question, lang, onText);
    if (custom) return custom;
  }
  // "calculator" alone is a thing to build only with a build word or "app/game/…"
  if (!BUILD.test(q) && !explicit) return null;
  // Questions *about* something ("what is a calculator") aren't build requests
  if (/^(what|who|why|when|where|which|is|are|does|do|explain|define|tell me about)\b/.test(q) && !BUILD.test(q)) return null;
  const other = OTHER_LANGS.find(([re]) => re.test(q));
  // "calculator in java": the knowledge base has real Java code for some of these
  if (other && (await knowledgeAnswer(question).catch(() => null))) return null;
  let note = "";
  if (other) note = `I build apps in HTML/JavaScript and Python for now, so here's the ${app.lang === "html" ? "web" : "Python"} version — the logic is the same in ${other[1]}.`;
  else if (lang === "python" && app.lang !== "python") note = "I don't have a Python version of this one yet, so here it is as a web app.";
  else if (/\bandroid\b|\bmobile app\b|\bphone app\b|\biphone\b|\bios\b/.test(q)) note = "This web app works on Android and iPhone: open it in Chrome and choose “Add to Home screen” to use it like an installed app.";
  return present(app, note);
}

// --- Alpaca writes it: any app, game, simulator or program -----------------------------

const BUILD_NOTE = `The user wants you to build something. Write ONE complete, working program for it.
- For apps, games, websites, simulators and tools (unless another language is asked for): a single HTML file with inline CSS and JavaScript, no build step, no external libraries except from cdnjs.cloudflare.com if truly needed. It must look modern and polished, work on phones (responsive, touch-friendly) and on computers, and save the user's data in localStorage when that makes sense. Wrap any localStorage use in try/catch.
- For other languages (Python, Java, C, C++…): one complete runnable file.
- Never leave placeholders or "TODO": every button and feature must work.
Reply in exactly this shape: one short sentence saying what you built, then the code in one fenced block with its language (\`\`\`html, \`\`\`python…), then a "How to use it:" list with 2-4 short points.`;

async function alpacaBuild(question, lang, onText) {
  if (typeof navigator === "undefined" || navigator.onLine === false) return null;
  let askAlpaca;
  try {
    ({ askAlpaca } = await import("./ai.js"));
  } catch {
    return null;
  }
  const result = await askAlpaca(question, [], { good: [], bad: [], docs: [] }, onText, { system: BUILD_NOTE }).catch(() => null);
  const text = result?.answer || "";
  const block = text.match(/```(\w+)?\n([\s\S]*?)```/);
  if (!block || block[2].split("\n").length < 8 || result.partial) return null;
  return `🛠️ ${text.trim()}`;
}

// --- No template? Research the subject and make a starter ------------------------------

const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const titleCase = (t) => t.replace(/\b[a-z]/g, (c) => c.toUpperCase());

// "create a app - oracle golden gate simulator" → "oracle golden gate simulator"
export function subjectOf(q) {
  return q
    .replace(BUILD, " ")
    .replace(/\b(a|an|the|me|my|own|for|please|pls|simple|small|basic|new|some|one|called|named|that|which|with|using|in|to|of|and)\b/g, " ")
    .replace(/\b(html|css|javascript|js|python|web|mobile|android)\b/g, " ")
    .replace(THING, " ")
    .replace(/[^a-z0-9+#\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function buildFromResearch(q) {
  // "write a program to find factorial" is a coding exercise, not an app
  if (/\b(program|programme|code|function|script)s? (to|for|that|which)\b/.test(q)) return null;
  if (await knowledgeAnswer(q).catch(() => null)) return null;
  const subject = subjectOf(q);
  if (!subject || subject.split(" ").length > 8) return null;
  // What is it? The knowledge base first, then Wikipedia (without "simulator", "tracker"…)
  const topic = subject.replace(/\b(simulator|simulation|tracker|manager|generator|viewer|maker|system|dashboard|tool|clone)\b/g, "").trim() || subject;
  let about = null;
  let source = null;
  const known = await knowledgeAnswer(`what is ${topic}`).catch(() => null);
  if (known) [about, source] = [known.answer, "my knowledge base"];
  if (!about && typeof navigator !== "undefined" && navigator.onLine !== false) {
    const wiki = (await wikiAnswer(`what is ${topic}`).catch(() => null)) || (await wikiFind(topic).catch(() => null));
    if (wiki) [about, source] = [wiki.answer, "Wikipedia"];
  }
  const starter = apps.find((a) => a.id === "starter");
  if (!starter) return null;
  const title = titleCase(subject.replace(/[^a-z0-9 +#-]/g, "")).slice(0, 60);
  const summary = about ? about.replace(/\s+/g, " ").match(/^(.{20,300}?[.!?])(\s|$)/)?.[1] || about.slice(0, 300) : `Your ${title} app.`;
  const code = starter.code.replaceAll("{{TITLE}}", esc(title)).replaceAll("{{ABOUT}}", esc(summary));
  const lines = [`🛠️ **${title}** — a starter app, made for you`, ""];
  if (about) lines.push(`🔎 I looked it up (${source}):`, "", about.trim(), "");
  else lines.push(`I couldn't find information about “${subject}” right now, so here's a starter you can shape.`, "");
  lines.push(
    "I don't have a ready-made template for this one yet, so here's a starter with a dashboard, an item list and an activity log, titled for your project:",
    "",
    "```html\n" + code + "```",
    "",
    "**Next steps:**",
    "- Tap **▶ run** to try it, or **⬇ download** to save it.",
    `- Tell me what it should do (for example “${title}: add a start/stop button”), and change the sections and the script to match.`,
    '- Say "what apps can you make" to see the complete apps I can build straight away.'
  );
  return lines.join("\n");
}
