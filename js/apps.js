// MK.ai's app builder: "make a calculator app", "create a snake game",
// "tic tac toe in python" → a complete, tested program from data/apps.json,
// ready to run (▶ run), download or copy. No outside service is used.

import { knowledgeAnswer } from "./kb.js";

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
  const web = apps.filter((a) => a.lang === "html").map((a) => a.title);
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
export async function appAnswer(question) {
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
  const explicit = THING.test(q.replace(/\bcode\b/, "")) || /\b(in|using|with) (python|html|javascript|js)\b/.test(q);
  const app = findApp(q, lang, !explicit);
  if (!app) return null;
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
