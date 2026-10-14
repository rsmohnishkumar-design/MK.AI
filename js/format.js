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

const ERROR_REPORTER =
  "<script>(function(){var s=function(m){try{parent.postMessage({mkaiPreviewError:m},'*')}catch(e){}};" +
  "addEventListener('error',function(e){s((e.message||'Error')+(e.lineno?' (line '+e.lineno+')':''))});" +
  "addEventListener('unhandledrejection',function(e){s('Unhandled: '+(e.reason&&e.reason.message||e.reason))})})();<\/script>\n";
let fixHandler = null;
let codeActionHandler = null;
// app.js: the "✦ Alpaca" menu on code blocks
export function setCodeActionHandler(fn) {
  codeActionHandler = fn;
}
// app.js: what happens when someone taps "Fix with Alpaca"
export function setFixHandler(fn) {
  fixHandler = fn;
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
  // Errors inside the app are reported back, so Alpaca can offer to fix them
  const withReporter = ERROR_REPORTER + code;
  frame.srcdoc = withReporter;
  const errors = [];
  const fix = button("Fix with Alpaca", "code-copy code-fix", () => {
    close();
    fixHandler?.(code, errors.slice(0, 3).join("\n"));
  });
  fix.hidden = true;
  const onMessage = (e) => {
    if (e.source !== frame.contentWindow || !e.data?.mkaiPreviewError) return;
    errors.push(String(e.data.mkaiPreviewError).slice(0, 300));
    title.textContent = `${errors[0]}`;
    fix.hidden = !fixHandler;
  };
  window.addEventListener("message", onMessage);
  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("message", onMessage);
  };
  const onKey = (e) => e.key === "Escape" && close();
  bar.append(title, fix, button("Reload", "code-copy", () => ((errors.length = 0), (fix.hidden = true), (title.textContent = "▶ Running your app"), (frame.srcdoc = withReporter))), button("Close", "code-copy", close));
  overlay.append(bar, frame);
  document.body.append(overlay);
  document.addEventListener("keydown", onKey);
}

// Syntax colouring (highlight.js, hosted with MK.ai), loaded the first time code appears
let hljsReady = null;
function loadHighlighter() {
  if (window.hljs) return Promise.resolve(window.hljs);
  if (!hljsReady) {
    hljsReady = new Promise((resolve) => {
      const css = Object.assign(document.createElement("link"), { rel: "stylesheet", href: new URL("../lib/hljs/github-dark.min.css", import.meta.url).href });
      document.head.append(css);
      const s = Object.assign(document.createElement("script"), { src: new URL("../lib/hljs/highlight.min.js", import.meta.url).href });
      s.onload = () => resolve(window.hljs || null);
      s.onerror = () => resolve(null);
      document.head.append(s);
    });
  }
  return hljsReady;
}
const HL_ALIAS = { js: "javascript", py: "python", "c++": "cpp", sh: "bash", html: "xml", shell: "bash", ts: "typescript" };
function colourCode(el, lang) {
  if (el.textContent.length > 60000) return;
  loadHighlighter().then((hljs) => {
    if (!hljs || !el.isConnected) return;
    const name = HL_ALIAS[lang] || lang;
    try {
      const out = name && hljs.getLanguage(name) ? hljs.highlight(el.textContent, { language: name, ignoreIllegals: true }) : hljs.highlightAuto(el.textContent);
      el.innerHTML = out.value;
      el.classList.add("hljs");
    } catch {}
  });
}
let streaming = false; // no colouring while an answer is still arriving

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
    actions.append(button("▶ Run", "code-copy code-run", () => runPreview(code)));
  }
  // Python and JavaScript run right here, with their output under the code
  const runnable = /^(python|py|python3)$/.test(lang) ? "python" : /^(javascript|js)$/.test(lang) && !/\b(document|window)\.|<\w+[\s>]|\brequire\(|^\s*import\s/m.test(code) ? "javascript" : null;
  let out = null;
  if (runnable && !window.MKAI_NO_RUN) {
    const run = button("▶ Run", "code-copy code-run", async () => {
      if (!out) {
        out = document.createElement("div");
        out.className = "code-output";
        box.append(out);
      }
      out.replaceChildren(Object.assign(document.createElement("pre"), { className: "code-output-text", textContent: "" }));
      const text = out.firstChild;
      run.disabled = true;
      try {
        const { runPython, runJavaScript } = await import("./coderun.js");
        const show = (t) => (text.textContent = t);
        const { output, error } = runnable === "python" ? await runPython(code, show, (s) => (text.textContent = s)) : await runJavaScript(code, show);
        if (!output) text.textContent = "(The program ran and printed nothing.)";
        if (error && fixHandler) {
          out.append(button("Fix with Alpaca", "code-copy code-fix", () => fixHandler(code, error, runnable)));
        }
      } catch (err) {
        text.textContent = navigator.onLine === false ? "Running Python needs the internet the first time." : `Couldn't start ${runnable === "python" ? "Python" : "the program"}: ${err.message}`;
      } finally {
        run.disabled = false;
      }
    });
    actions.append(run);
  }
  // Coding tools: the full editor, and Alpaca's actions (explain, improve, convert…)
  if (code.split("\n").length > 1 && !/^(mkai-|alpaca-)/.test(lang)) {
    actions.append(
      button("Edit", "code-copy code-edit", async () => {
        const { openEditor } = await import("./editor.js");
        openEditor(code, lang);
      })
    );
    if (codeActionHandler) {
      const ai = button("✦ Alpaca", "code-copy code-ai", (e) => {
        e.stopPropagation();
        codeActionHandler(code, lang, ai);
      });
      actions.append(ai);
    }
  }
  if (EXT[lang] && code.split("\n").length > 3) actions.append(button("⬇ Download", "code-copy", () => download(lang, code)));
  const copy = button("Copy", "code-copy", async () => {
    try {
      await navigator.clipboard.writeText(code);
      copy.textContent = "Copied";
      setTimeout(() => (copy.textContent = "Copy"), 1500);
    } catch {}
  });
  actions.append(copy);
  head.append(label, actions);
  const pre = document.createElement("pre");
  const el = document.createElement("code");
  el.textContent = code;
  pre.append(el);
  box.append(head, pre);
  if (!streaming && lang !== "text" && lang !== "txt") colourCode(el, lang);
  // An SVG picture is shown as a picture under its code
  if (!streaming && (lang === "svg" || (lang === "xml" && /^\s*<svg\b/i.test(code))) && /<\/svg>\s*$/i.test(code)) {
    const img = document.createElement("img");
    img.className = "svg-preview";
    img.alt = "SVG preview";
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(code)}`; // as an image, scripts inside never run
    box.append(img);
  }
  return box;
}

// Diagrams: Alpaca writes flowcharts, mind maps, timelines and sequence
// diagrams in Mermaid, and they are drawn here (the library loads the first time).
let mermaidReady = null;
function loadMermaid() {
  if (window.mermaid) return Promise.resolve(window.mermaid);
  if (!mermaidReady) {
    mermaidReady = new Promise((resolve) => {
      const s = Object.assign(document.createElement("script"), { src: new URL("../lib/mermaid/mermaid.min.js", import.meta.url).href });
      s.onload = () => {
        const m = window.mermaid;
        m?.initialize({ startOnLoad: false, securityLevel: "strict", theme: "dark", themeVariables: { primaryColor: "#0b3440", primaryBorderColor: "#22d3ee", lineColor: "#22d3ee", fontFamily: "inherit" } });
        resolve(m || null);
      };
      s.onerror = () => {
        mermaidReady = null;
        resolve(null);
      };
      document.head.append(s);
    });
  }
  return mermaidReady;
}
let diagramCount = 0;
function diagramBlock(code) {
  const box = document.createElement("div");
  box.className = "code-block diagram-block";
  const head = document.createElement("div");
  head.className = "code-head";
  const label = Object.assign(document.createElement("span"), { textContent: "diagram" });
  const actions = Object.assign(document.createElement("span"), { className: "code-actions" });
  const view = Object.assign(document.createElement("div"), { className: "diagram-view", textContent: "Drawing the diagram…" });
  const pre = document.createElement("pre");
  pre.append(Object.assign(document.createElement("code"), { textContent: code }));
  pre.hidden = true;
  let svgText = "";
  const toggle = button("Code", "code-copy", () => {
    pre.hidden = !pre.hidden;
    toggle.textContent = pre.hidden ? "Code" : "Hide code";
  });
  const save = button("⬇ SVG", "code-copy", () => {
    if (!svgText) return;
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" })), download: "diagram.svg" });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
  save.disabled = true;
  const copy = button("Copy", "code-copy", async () => {
    try {
      await navigator.clipboard.writeText(code);
      copy.textContent = "Copied";
      setTimeout(() => (copy.textContent = "Copy"), 1500);
    } catch {}
  });
  actions.append(toggle, save, copy);
  head.append(label, actions);
  box.append(head, view, pre);
  loadMermaid().then(async (m) => {
    if (!m) {
      view.textContent = "The diagram couldn't be drawn (no internet?). Here is its code:";
      pre.hidden = false;
      return;
    }
    try {
      const { svg } = await m.render(`mkai-diagram-${++diagramCount}`, code);
      svgText = svg;
      view.innerHTML = svg; // made by Mermaid in strict mode (no scripts or HTML labels)
      save.disabled = false;
    } catch (err) {
      view.textContent = "This diagram has a mistake in it, so here is its code:";
      pre.hidden = false;
      document.querySelectorAll(`#dmkai-diagram-${diagramCount}, #mkai-diagram-${diagramCount}`).forEach((e) => e.remove());
    }
  });
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

// A professional look: emojis are left out of answers (media and check symbols stay).
const EMOJI_RUN = /[ \t]*(?:(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}]|\u20E3)*[ \t]*)+/gu;
const KEEP_SYMBOLS = /^[\s▶⏸⏹⬇✓✔✦★©®™↔→←↑↓↩]+$/u;
export function calm(text) {
  return text
    .replace(/✅|✔️/g, "✓")
    .replace(/❌|✖️/g, "✗")
    .replace(EMOJI_RUN, (run, at, all) => {
      if (KEEP_SYMBOLS.test(run)) return run;
      const before = all[at - 1] || "";
      const after = all[at + run.length] || "";
      if (!before || before === "\n" || !after || after === "\n") return "";
      // "I don't know yet 🤔 I've added it" → "I don't know yet. I've added it"
      if (/[\p{L}\p{N}]/u.test(before) && /\p{Lu}/u.test(after)) return ". ";
      return " ";
    })
    .replace(/^([ \t]*[-*][ \t]+)[ \t]+/gm, "$1");
}

export function renderAnswer(container, text) {
  text = calm(text);
  streaming = text.endsWith(" ▍");
  container.replaceChildren();
  let last = 0;
  const files = [];
  for (const m of text.matchAll(FENCE)) {
    // The box has its own spacing, so blank lines around it are dropped.
    const before = text.slice(last, m.index);
    if (m.index > last) inline(container, readableMath(before).replace(/\s+$/, ""));
    const lang = m[1].toLowerCase();
    const code = m[2].replace(/\n$/, "");
    if (BLOCKS.has(lang)) BLOCKS.get(lang)(container, code);
    else if (lang === "mermaid" && !streaming) container.append(diagramBlock(code));
    else {
      container.append(codeBlock(lang, code));
      // A file name just before the block ("**index.html**", "`src/app.py`:") or after the language
      const named = m[0].match(/^```[\w+#.-]*[ \t]+([\w.\-\/]+\.[A-Za-z0-9]{1,8})/)?.[1] || before.trim().split("\n").pop()?.match(/([\w\-\/]+\.[A-Za-z0-9]{1,8})[`*:\s)]*$/)?.[1];
      if (named) files.push({ name: named.replace(/^\/+/, ""), code });
    }
    last = m.index + m[0].length;
    while (text[last] === "\n") last++;
  }
  if (last < text.length) inline(container, readableMath(text.slice(last)));
  // Several named files: offer the whole project as one .zip
  if (!streaming && files.length >= 2 && new Set(files.map((f) => f.name)).size === files.length) {
    const bar = document.createElement("div");
    bar.className = "project-bar";
    const label = Object.assign(document.createElement("span"), { textContent: `Project: ${files.length} files (${files.map((f) => f.name).join(", ")})` });
    bar.append(label, button("⬇ Download project (.zip)", "code-copy project-zip", () => downloadZip(files)));
    container.append(bar);
  }
}

// A small .zip writer (files stored as they are, no compression)
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function makeZip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.code.endsWith("\n") ? f.code : f.code + "\n");
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(local, name, data);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, data.length, true);
    cen.setUint32(24, data.length, true);
    cen.setUint16(28, name.length, true);
    cen.setUint32(42, offset, true);
    central.push(cen, name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((n, p) => n + (p.byteLength ?? p.length), 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}
function downloadZip(files) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(makeZip(files));
  a.download = "mkai-project.zip";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
