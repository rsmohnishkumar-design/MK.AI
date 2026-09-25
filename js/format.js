// Shows an answer with code blocks, `inline code`, **bold** and [links](url), the way chat
// apps do. Everything is built as DOM nodes from text, so nothing in an
// answer can ever run as HTML.

const FENCE = /```([\w+#.-]*)[^\n]*\n?([\s\S]*?)(?:```|$)/g;

// Only links to MK.ai's own lessons or to https sites become clickable.
const SAFE_LINK = /^((learn|about)\.html(#[\w-]+)?|https:\/\/[^\s]+)$/;

function inline(parent, text) {
  // `code`, **bold** and [text](url); anything else stays plain text.
  const re = /`([^`\n]+)`|\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) parent.append(text.slice(last, m.index));
    let el;
    if (m[1] !== undefined) {
      el = document.createElement("code");
      el.className = "inline-code";
      el.textContent = m[1];
    } else if (m[2] !== undefined) {
      el = document.createElement("strong");
      el.textContent = m[2];
    } else if (SAFE_LINK.test(m[4])) {
      el = document.createElement("a");
      el.className = "answer-link";
      el.href = m[4];
      el.textContent = m[3];
      if (m[4].startsWith("https:")) {
        el.target = "_blank";
        el.rel = "noopener noreferrer";
      }
    } else {
      el = document.createTextNode(m[3]);
    }
    parent.append(el);
    last = m.index + m[0].length;
  }
  if (last < text.length) parent.append(text.slice(last));
}

const EXT = { html: "html", python: "py", py: "py", javascript: "js", js: "js", css: "css", java: "java", c: "c", cpp: "cpp", "c++": "cpp", sql: "sql", json: "json", bash: "sh", sh: "sh" };

function button(label, cls, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

// "my-to-do-list.html" from the <title>, else "code.py" and so on
function fileName(lang, code) {
  const title = lang === "html" && code.match(/<title>([^<]{1,60})<\/title>/i);
  const base = (title ? title[1] : "code").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "code";
  return `${base}.${EXT[lang] || "txt"}`;
}

function download(lang, code) {
  const url = URL.createObjectURL(new Blob([code], { type: lang === "html" ? "text/html" : "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName(lang, code);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Runs an HTML app in a sealed-off frame: its own blank origin, so it can't
// touch MK.ai's login, storage or pages.
export function runPreview(code) {
  const overlay = document.createElement("div");
  overlay.className = "preview-overlay";
  const bar = document.createElement("div");
  bar.className = "preview-bar";
  const title = document.createElement("span");
  title.textContent = "▶ Running your app";
  const frame = document.createElement("iframe");
  frame.className = "preview-frame";
  frame.setAttribute("sandbox", "allow-scripts allow-modals allow-forms allow-popups allow-pointer-lock");
  frame.setAttribute("title", "App preview");
  frame.srcdoc = code;
  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => e.key === "Escape" && close();
  bar.append(title, button("reload", "code-copy", () => (frame.srcdoc = code)), button("✕ close", "code-copy", close));
  overlay.append(bar, frame);
  document.body.append(overlay);
  document.addEventListener("keydown", onKey);
}

function codeBlock(lang, code) {
  const box = document.createElement("div");
  box.className = "code-block";
  const head = document.createElement("div");
  head.className = "code-head";
  const label = document.createElement("span");
  label.textContent = lang || "code";
  const actions = document.createElement("span");
  actions.className = "code-actions";
  if (lang === "html" && /<(html|body|script|div|button)\b/i.test(code)) {
    actions.append(button("▶ run", "code-copy code-run", () => runPreview(code)));
  }
  if (EXT[lang] && code.split("\n").length > 3) actions.append(button("⬇ download", "code-copy", () => download(lang, code)));
  const copy = button("copy", "code-copy", async () => {
    try {
      await navigator.clipboard.writeText(code);
      copy.textContent = "copied";
      setTimeout(() => (copy.textContent = "copy"), 1500);
    } catch {}
  });
  actions.append(copy);
  head.append(label, actions);
  const pre = document.createElement("pre");
  const el = document.createElement("code");
  el.textContent = code;
  pre.append(el);
  box.append(head, pre);
  return box;
}

// Some saved answers write maths in LaTeX ($\\frac{-5 \\pm \\sqrt{17}}{2}$).
// Turn it into readable text: (−5 ± √17)/2. Plain "$5" prices are left alone.
const SYMBOLS = {
  pm: "±", mp: "∓", times: "×", cdot: "·", div: "÷", approx: "≈", neq: "≠", ne: "≠", leq: "≤", le: "≤",
  geq: "≥", ge: "≥", infty: "∞", pi: "π", theta: "θ", alpha: "α", beta: "β", degree: "°", circ: "°",
  rightarrow: "→", Rightarrow: "⇒", to: "→", quad: " ", qquad: " ", ldots: "…", dots: "…",
};
const SUPERS = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", n: "ⁿ", "-": "⁻", "+": "⁺" };
const simple = (t) => /^[\w.√²³]+$/.test(t);
export function mathToText(tex) {
  let t = tex;
  for (let i = 0; i < 6; i++) {
    const before = t;
    t = t
      .replace(/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, a, b) => `${simple(a) ? a : `(${a})`}/${simple(b) ? b : `(${b})`}`)
      .replace(/\\sqrt\{([^{}]*)\}/g, (_, a) => (simple(a) ? `√${a}` : `√(${a})`))
      .replace(/\\(?:text|mathrm|mathbf|operatorname)\{([^{}]*)\}/g, "$1")
      .replace(/\^\{([^{}]*)\}/g, (_, e) => ([...e].every((c) => SUPERS[c]) ? [...e].map((c) => SUPERS[c]).join("") : `^(${e})`));
    if (t === before) break;
  }
  return t
    .replace(/\^([0-9n])/g, (_, c) => SUPERS[c])
    .replace(/\\left|\\right/g, "")
    .replace(/\\([A-Za-z]+)/g, (_, name) => SYMBOLS[name] ?? name)
    .replace(/\\[,;!: ]/g, " ")
    .replace(/[{}]/g, "")
    .replace(/-/g, "−")
    .replace(/\s+/g, " ")
    .trim();
}
export function readableMath(text) {
  return text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => mathToText(m))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => mathToText(m))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => mathToText(m))
    .replace(/\$([^$\n]+?)\$/g, (whole, m) => (/\\[a-zA-Z]|[\^_=]|^[a-z]$/.test(m) ? mathToText(m) : whole));
}

// Special blocks drawn by other parts of MK.ai (e.g. "alpaca-vision" pictures).
const BLOCKS = new Map();
export function registerBlock(lang, render) {
  BLOCKS.set(lang, render);
}

export function renderAnswer(container, text) {
  container.replaceChildren();
  let last = 0;
  for (const m of text.matchAll(FENCE)) {
    // The box has its own spacing, so blank lines around it are dropped.
    if (m.index > last) inline(container, readableMath(text.slice(last, m.index)).replace(/\s+$/, ""));
    const lang = m[1].toLowerCase();
    if (BLOCKS.has(lang)) BLOCKS.get(lang)(container, m[2].replace(/\n$/, ""));
    else container.append(codeBlock(lang, m[2].replace(/\n$/, "")));
    last = m.index + m[0].length;
    while (text[last] === "\n") last++;
  }
  if (last < text.length) inline(container, readableMath(text.slice(last)));
}
