// The folder workspace screen: files on the left, Alpaca on the right.
import { canWriteFolders, openFolderWithPicker, openFolderFromFiles, buildContext, WORKSPACE_NOTE, proposedFiles, downloadChanges, langOf, lineDiff } from "./workspace.js";
import { renderAnswer } from "./format.js";

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const btn = (label, cls, fn) => {
  const b = el("button", cls, label);
  b.type = "button";
  b.addEventListener("click", fn);
  return b;
};

// Opens the folder picker (must run from a click), then the workspace
export async function startWorkspace({ onError = (m) => alert(m) } = {}) {
  if (canWriteFolders()) {
    try {
      showWorkspace(await openFolderWithPicker());
    } catch (err) {
      if (err?.name !== "AbortError") onError(`That folder couldn't be opened: ${err.message || err}`);
    }
    return;
  }
  // Read-only fallback: the browser's own folder chooser
  const input = el("input");
  input.type = "file";
  input.webkitdirectory = true;
  input.multiple = true;
  input.hidden = true;
  input.className = "wsp-folder-input";
  input.addEventListener("change", () => {
    try {
      if (input.files.length) showWorkspace(openFolderFromFiles(input.files));
    } catch (err) {
      onError(err.message || "That folder couldn't be opened.");
    }
    input.remove();
  });
  document.body.append(input);
  input.click();
}

export function showWorkspace(ws) {
  document.querySelector(".wsp")?.remove();
  const focus = []; // files the person opened: always shown to Alpaca
  const turns = []; // earlier questions and answers (text)
  const box = el("div", "wsp");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", `Folder workspace: ${ws.name}`);

  // Header
  const head = el("div", "wsp-head");
  const title = el("span", "wsp-title", `Folder · ${ws.name}`);
  const mode = el("span", "wsp-mode", ws.writable ? "Changes save into your folder after you approve them" : "Read-only in this browser: approved changes download as a .zip");
  const zipBtn = btn("⬇ Download changes (.zip)", "studio-btn primary", () => downloadChanges(ws));
  zipBtn.hidden = true;
  const closeBtn = btn("Close", "studio-btn", () => box.remove());
  head.append(title, mode, zipBtn, closeBtn);

  // Files
  const side = el("div", "wsp-files");
  const search = el("input", "wsp-search");
  search.type = "search";
  search.placeholder = `Search ${ws.files.length} files`;
  search.setAttribute("aria-label", "Search files");
  const list = el("div", "wsp-list");
  side.append(search, list);
  const renderFiles = () => {
    const f = search.value.trim().toLowerCase();
    list.replaceChildren();
    const shown = ws.files.filter((x) => !f || x.path.toLowerCase().includes(f)).slice(0, 500);
    for (const file of shown) {
      const b = btn(file.path, `wsp-file${file.text ? "" : " binary"}${ws.changes.has(file.path) ? " changed" : ""}`, () => openFile(file.path));
      b.title = file.text ? `Open ${file.path}` : "Not a text file";
      b.disabled = !file.text;
      list.append(b);
    }
    if (!shown.length) list.append(el("p", "wsp-empty", "No files match."));
    zipBtn.hidden = ws.writable || !ws.changes.size;
  };
  search.addEventListener("input", renderFiles);

  async function openFile(path) {
    const text = await ws.read(path);
    if (text == null) return note(`${path} is too big or isn't a text file.`);
    if (!focus.includes(path)) focus.push(path);
    const { openEditor } = await import("./editor.js");
    openEditor(text, langOf(path), {
      fileName: path.split("/").pop(),
      onSave: async (next) => {
        const how = await ws.write(path, next);
        renderFiles();
        return how === "saved" ? `Saved ${path} in your folder.` : `Kept ${path} for the .zip download.`;
      },
    });
  }

  // Alpaca
  const main = el("div", "wsp-main");
  const log = el("div", "wsp-log");
  log.append(el("p", "wsp-hint", `Ask about this project or tell Alpaca what to build or fix. For example: "explain how this project works", "fix the bug in the login form", "add a dark mode". Alpaca proposes changes; you approve each one.${ws.writable ? "" : " This browser can't save into folders, so approved changes are collected into a .zip."}`));
  const form = el("form", "wsp-ask");
  const input = el("textarea", "wsp-input");
  input.rows = 2;
  input.placeholder = "Ask Alpaca about this folder…";
  input.setAttribute("aria-label", "Ask Alpaca about this folder");
  const askBtn = el("button", "studio-btn primary wsp-send", "Ask");
  askBtn.type = "submit";
  form.append(input, askBtn);
  main.append(log, form);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  const note = (text) => {
    log.append(el("p", "wsp-note", text));
    log.scrollTop = log.scrollHeight;
  };

  let busy = null;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return busy.abort();
    const question = input.value.trim();
    if (!question) return;
    input.value = "";
    log.append(el("p", "wsp-q", question));
    const out = el("div", "wsp-a ai-answer");
    out.textContent = "Reading your files…";
    log.append(out);
    log.scrollTop = log.scrollHeight;
    busy = new AbortController();
    askBtn.textContent = "Stop";
    try {
      const ctx = await buildContext(ws, question, focus);
      const { askAlpaca } = await import("./ai.js");
      const history = turns.slice(-4);
      const r = await askAlpaca(`${question}\n\n${ctx.text}`, history, { good: [], bad: [], docs: [] }, (t) => {
        renderAnswer(out, stripFiles(t));
        log.scrollTop = log.scrollHeight;
      }, { system: WORKSPACE_NOTE, signal: busy.signal });
      renderAnswer(out, stripFiles(r.answer) || "Here are the changes:");
      out.append(el("p", "wsp-read", `Read ${ctx.included.length} file${ctx.included.length === 1 ? "" : "s"}: ${ctx.included.slice(0, 8).join(", ")}${ctx.included.length > 8 ? "…" : ""}`));
      turns.push({ role: "user", content: question }, { role: "assistant", content: stripFiles(r.answer).slice(0, 2000) });
      const changes = proposedFiles(r.answer);
      if (changes.length) out.append(await changeCards(changes));
      if (r.partial) note("The answer was cut off; ask again to continue.");
    } catch (err) {
      out.textContent = err?.stopped || busy?.signal.aborted ? "Stopped." : `Alpaca couldn't answer right now (${String(err?.message || err).slice(0, 100)}). Try again in a minute.`;
    } finally {
      busy = null;
      askBtn.textContent = "Ask";
      log.scrollTop = log.scrollHeight;
    }
  });

  // One card per proposed file: what changes, then Apply or Skip
  async function changeCards(changes) {
    const wrap = el("div", "wsp-changes");
    const cards = [];
    for (const ch of changes) {
      const before = await ws.read(ch.path);
      const isNew = before == null && !ws.exists(ch.path);
      const rows = isNew ? [] : lineDiff(before ?? "", ch.text);
      const add = isNew ? ch.text.split("\n").length - 1 : rows.filter((r) => r.t === "+").length;
      const del = rows.filter((r) => r.t === "-").length;
      const card = el("div", "wsp-card");
      const top = el("div", "wsp-card-top");
      top.append(el("span", "wsp-path", ch.path), el("span", "wsp-stat", isNew ? `new file · ${add} line${add === 1 ? "" : "s"}` : add || del ? `+${add} −${del}` : "no change"));
      const diff = el("pre", "studio-diff wsp-diff");
      diff.hidden = true;
      for (const r of isNew ? ch.text.split("\n").slice(0, 400).map((line) => ({ t: "+", line })) : rows.filter((r, i) => r.t !== "=" || rows.slice(Math.max(0, i - 2), i + 3).some((x) => x.t !== "="))) {
        diff.append(el("span", r.t === "+" ? "diff-add" : r.t === "-" ? "diff-del" : "diff-same", `${r.t === "=" ? " " : r.t} ${r.line}\n`));
      }
      const actions = el("div", "wsp-card-actions");
      const state = el("span", "wsp-state");
      const view = btn("View changes", "photo-btn", () => {
        diff.hidden = !diff.hidden;
        view.textContent = diff.hidden ? "View changes" : "Hide changes";
      });
      const doApply = async () => {
        apply.disabled = skip.disabled = true;
        try {
          const how = await ws.write(ch.path, ch.text);
          state.textContent = how === "saved" ? "Saved to your folder" : "Kept for the .zip";
          card.classList.add("applied");
          renderFiles();
        } catch (err) {
          state.textContent = `Couldn't save: ${err.message || err}`;
          apply.disabled = skip.disabled = false;
        }
      };
      const apply = btn(ws.writable ? "Apply" : "Keep for .zip", "photo-btn primary", doApply);
      const skip = btn("Skip", "photo-btn", () => {
        apply.disabled = skip.disabled = true;
        state.textContent = "Skipped";
        card.classList.add("skipped");
      });
      actions.append(view, apply, skip, state);
      if (!isNew && !add && !del) {
        apply.disabled = skip.disabled = true;
        view.disabled = true;
        state.textContent = "Already up to date";
        card.classList.add("skipped");
      }
      card.append(top, actions, diff);
      cards.push({ apply, doApply });
      wrap.append(card);
    }
    if (changes.length > 1) {
      const all = btn(ws.writable ? "Apply all" : "Keep all for .zip", "photo-btn primary", async () => {
        all.disabled = true;
        for (const c of cards) if (!c.apply.disabled) await c.doApply();
      });
      wrap.prepend(all);
    }
    return wrap;
  }

  const body = el("div", "wsp-body");
  body.append(side, main);
  box.append(head, body);
  document.body.append(box);
  renderFiles();
  input.focus();
  const onKey = (e) => {
    if (e.key === "Escape" && !document.querySelector(".studio") && document.body.contains(box)) box.remove();
  };
  document.addEventListener("keydown", onKey);
  new MutationObserver((_, obs) => {
    if (!document.body.contains(box)) {
      document.removeEventListener("keydown", onKey);
      obs.disconnect();
    }
  }).observe(document.body, { childList: true });
  return box;
}

// The answer without its file blocks (those become change cards)
function stripFiles(text) {
  return text
    .replace(/```([\w.@+\-\/]*[./][\w.@+\-\/]*)\n[\s\S]*?(```|$)/g, (m, info) => (/^[\w.@+\-\/]+$/.test(info) ? "" : m))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
