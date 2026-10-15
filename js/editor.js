// Alpaca Code Studio: a full-screen editor for any code in the chat.
// Edit the code, run it (HTML apps in a preview, Python and JavaScript with
// their output), and ask Alpaca to change it in plain words ("add a dark mode",
// "fix the bug", "make it faster"). Every change can be undone.

const $el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

const LANGS = ["html", "python", "javascript", "css", "java", "c", "cpp", "sql", "json", "text"];
const normalise = (lang) => ({ py: "python", python3: "python", js: "javascript", "c++": "cpp", "": "text" })[lang] ?? (LANGS.includes(lang) ? lang : lang || "text");
const EXT = { html: "html", python: "py", javascript: "js", css: "css", java: "java", c: "c", cpp: "cpp", sql: "sql", json: "json", text: "txt" };

// The first fenced code block in an answer
function codeIn(text) {
  const m = (text || "").match(/```[\w+#.-]*[^\n]*\n([\s\S]*?)```/);
  return m ? m[1].replace(/\n$/, "") : null;
}

export function openEditor(code, lang = "text", { fileName = "", request = "", onSave = null } = {}) {
  lang = normalise(lang);
  let lastChange = null; // { before, after } of Alpaca's latest edit
  document.querySelector(".studio")?.remove();
  const history = [];
  const box = $el("div", "studio");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Alpaca Code Studio");

  // Top bar
  const bar = $el("div", "studio-bar");
  const title = $el("span", "studio-title", fileName ? `Alpaca Code Studio · ${fileName}` : "Alpaca Code Studio");
  const langSel = $el("select", "studio-lang");
  langSel.setAttribute("aria-label", "Language");
  for (const l of LANGS) langSel.add(new Option(l === "cpp" ? "C++" : l === "javascript" ? "JavaScript" : l === "html" ? "HTML" : l.charAt(0).toUpperCase() + l.slice(1), l));
  if (!LANGS.includes(lang)) langSel.add(new Option(lang, lang));
  langSel.value = lang;
  const runBtn = $el("button", "studio-btn primary", "▶ Run");
  const undoBtn = $el("button", "studio-btn", "Undo");
  const diffBtn = $el("button", "studio-btn", "Changes");
  diffBtn.title = "See what Alpaca changed";
  diffBtn.disabled = true;
  const copyBtn = $el("button", "studio-btn", "Copy");
  const saveBtn = $el("button", "studio-btn", "⬇ Download");
  const closeBtn = $el("button", "studio-btn", "Close");
  // Opened from a folder workspace: save straight back into the file
  const toFolderBtn = $el("button", "studio-btn primary", "Save to folder");
  toFolderBtn.hidden = !onSave;
  for (const b of [runBtn, undoBtn, diffBtn, copyBtn, toFolderBtn, saveBtn, closeBtn]) b.type = "button";
  undoBtn.disabled = true;
  bar.append(title, langSel, runBtn, undoBtn, diffBtn, copyBtn, toFolderBtn, saveBtn, closeBtn);

  // Editor with line numbers
  const main = $el("div", "studio-main");
  const edit = $el("div", "studio-edit");
  const gutter = $el("pre", "studio-gutter");
  const area = $el("textarea", "studio-code");
  area.spellcheck = false;
  area.value = code;
  area.setAttribute("aria-label", "Code");
  edit.append(gutter, area);
  const out = $el("div", "studio-out");
  const outHead = $el("div", "studio-out-head", "Output");
  const outBody = $el("div", "studio-out-body");
  outBody.append($el("p", "studio-hint", "Press ▶ Run to see it work."));
  out.append(outHead, outBody);
  main.append(edit, out);

  // Ask Alpaca
  const ask = $el("form", "studio-ask");
  const input = $el("input", "studio-ask-input");
  input.placeholder = "Ask Alpaca to change it: “add a dark mode”, “fix the error”, “explain line 12”…";
  const askBtn = $el("button", "studio-btn primary", "Ask Alpaca");
  askBtn.type = "submit";
  const status = $el("span", "studio-status");
  ask.append(input, askBtn, status);

  box.append(bar, main, ask);
  document.body.append(box);
  area.focus();

  const lines = () => (gutter.textContent = Array.from({ length: area.value.split("\n").length }, (_, i) => i + 1).join("\n"));
  lines();
  area.addEventListener("input", lines);
  area.addEventListener("scroll", () => (gutter.scrollTop = area.scrollTop));
  // Tab inserts spaces instead of leaving the box
  area.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: t } = area;
      area.setRangeText("  ", s, t, "end");
      lines();
    }
  });
  const setCode = (next) => {
    history.push(area.value);
    undoBtn.disabled = false;
    area.value = next;
    lines();
  };
  undoBtn.addEventListener("click", () => {
    if (!history.length) return;
    area.value = history.pop();
    undoBtn.disabled = !history.length;
    lines();
  });
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(area.value);
      copyBtn.textContent = "Copied";
      setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
    } catch {}
  });
  toFolderBtn.addEventListener("click", async () => {
    toFolderBtn.disabled = true;
    try {
      const note = await onSave(area.value);
      status.textContent = note || `Saved ${fileName}.`;
    } catch (err) {
      status.textContent = `Couldn't save: ${err.message || err}`;
    } finally {
      toFolderBtn.disabled = false;
    }
  });
  saveBtn.addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([area.value], { type: "text/plain" }));
    const t = langSel.value === "html" && area.value.match(/<title>([^<]{1,60})<\/title>/i);
    a.download = fileName || `${(t ? t[1] : "code").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "code"}.${EXT[langSel.value] || "txt"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
  const close = () => {
    box.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") runBtn.click();
  };
  document.addEventListener("keydown", onKey);
  closeBtn.addEventListener("click", close);

  // What Alpaca changed: removed lines in red, added lines in green
  function showDiff() {
    if (!lastChange) return;
    outBody.replaceChildren();
    const rows = lineDiff(lastChange.before, lastChange.after);
    const added = rows.filter((r) => r.t === "+").length;
    const removed = rows.filter((r) => r.t === "-").length;
    outBody.append($el("p", "studio-hint", rows.length ? `Alpaca's changes: ${added} line${added === 1 ? "" : "s"} added, ${removed} removed. Undo puts the old code back.` : "Too big to compare line by line."));
    const pre = $el("pre", "studio-diff");
    // Long unchanged stretches are folded
    let same = 0;
    rows.forEach((r, i) => {
      if (r.t === "=") {
        const near = rows.slice(Math.max(0, i - 2), i + 3).some((x) => x.t !== "=");
        if (!near) {
          if (!same++) pre.append($el("span", "diff-fold", "  ⋯\n"));
          return;
        }
      }
      same = 0;
      pre.append($el("span", r.t === "+" ? "diff-add" : r.t === "-" ? "diff-del" : "diff-same", `${r.t === "=" ? " " : r.t} ${r.line}\n`));
    });
    outBody.append(pre);
  }
  diffBtn.addEventListener("click", showDiff);

  // Run
  runBtn.addEventListener("click", async () => {
    const l = langSel.value;
    outBody.replaceChildren();
    if (l === "html" || l === "css") {
      const frame = $el("iframe", "studio-frame");
      frame.setAttribute("sandbox", "allow-scripts allow-modals allow-forms allow-popups");
      frame.srcdoc = l === "css" ? `<style>${area.value}</style><h1>Heading</h1><p>Some text with a <a href="#">link</a>.</p><button>Button</button>` : area.value;
      outBody.append(frame);
      return;
    }
    if (l !== "python" && l !== "javascript") {
      outBody.append($el("p", "studio-hint", "Running this language isn't possible in the browser. Copy or download it and run it on your computer."));
      return;
    }
    const pre = $el("pre", "studio-out-text", "Running…");
    outBody.append(pre);
    runBtn.disabled = true;
    try {
      const { runPython, runJavaScript } = await import("./coderun.js");
      const show = (t) => (pre.textContent = t);
      const { output, error } = l === "python" ? await runPython(area.value, show, show) : await runJavaScript(area.value, show);
      if (!output) pre.textContent = "(The program ran and printed nothing.)";
      if (error) {
        const fix = $el("button", "studio-btn primary", "Fix with Alpaca");
        fix.type = "button";
        fix.addEventListener("click", () => {
          input.value = `Fix this error: ${error}`;
          ask.requestSubmit();
        });
        outBody.append(fix);
      }
    } catch (err) {
      pre.textContent = `Couldn't run it: ${err.message}`;
    } finally {
      runBtn.disabled = false;
    }
  });

  // Ask Alpaca to change the code
  ask.addEventListener("submit", async (e) => {
    e.preventDefault();
    const request = input.value.trim();
    if (!request) return;
    askBtn.disabled = true;
    status.textContent = "Alpaca is working on it…";
    try {
      const { askAlpaca } = await import("./ai.js");
      const l = langSel.value;
      const explainOnly = /^(explain|what does|why|how does|what is)\b/i.test(request);
      const system = explainOnly
        ? "Explain the user's code clearly and briefly, answering their question. Refer to line numbers when useful."
        : "You are editing the user's code. Apply their request carefully. Reply with ONLY the complete updated file in one fenced code block (no explanation before it), then one short line saying what you changed.";
      const r = await askAlpaca(`${request}\n\n\`\`\`${l}\n${area.value}\n\`\`\``, [], { good: [], bad: [], docs: [] }, (t) => (status.textContent = explainOnly ? "Writing the explanation…" : `Writing the new code… ${t.length} characters`), { system });
      const next = !explainOnly && codeIn(r.answer);
      if (next && !r.partial) {
        lastChange = { before: area.value, after: next };
        setCode(next);
        diffBtn.disabled = false;
        showDiff();
        if (l === "html") runBtn.click(); // show the updated app straight away
        const note = r.answer.slice(r.answer.lastIndexOf("```") + 3).trim();
        status.textContent = note ? `Done: ${note.slice(0, 160)}` : "Done. Press ▶ Run to try it, or Undo.";
        input.value = "";
      } else {
        outBody.replaceChildren($el("div", "studio-explain", r.answer));
        status.textContent = explainOnly ? "" : "Alpaca answered without changing the code (see Output).";
      }
    } catch (err) {
      status.textContent = `Alpaca couldn't answer right now (${(err.message || "busy").slice(0, 80)}). Try again in a minute.`;
    } finally {
      askBtn.disabled = false;
    }
  });
  if (request) {
    input.value = request;
    ask.requestSubmit();
  }
  return { close, get code() { return area.value; } };
}

// Line-by-line differences (longest common subsequence); [] when too big
export function lineDiff(a, b) {
  const x = a.split("\n");
  const y = b.split("\n");
  if (x.length * y.length > 4_000_000) return [];
  const n = x.length;
  const m = y.length;
  const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      out.push({ t: "=", line: x[i] });
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) out.push({ t: "-", line: x[i++] });
    else out.push({ t: "+", line: y[j++] });
  }
  while (i < n) out.push({ t: "-", line: x[i++] });
  while (j < m) out.push({ t: "+", line: y[j++] });
  return out;
}
