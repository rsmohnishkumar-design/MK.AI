// Saved answers: bookmark any answer and find it again later (kept on this device).
import { renderAnswer } from "./format.js";

const KEY = "mkai-saved";
const MAX = 200;
const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
};
const write = (list) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {}
};
const keyOf = (question, answer) => `${String(question || "").slice(0, 200)}\n${answer.slice(0, 200)}`;

export const savedAnswers = read;
export const isSaved = (question, answer) => read().some((s) => s.key === keyOf(question, answer));

// Saves (or unsaves) an answer; returns true when it is now saved
export function toggleSaved(question, answer) {
  const list = read();
  const key = keyOf(question, answer);
  const at = list.findIndex((s) => s.key === key);
  if (at >= 0) {
    list.splice(at, 1);
    write(list);
    return false;
  }
  list.unshift({ key, q: String(question || "").slice(0, 300), a: answer.slice(0, 20000), at: Date.now() });
  write(list);
  return true;
}

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const btn = (label, fn, cls = "saved-btn") => {
  const b = el("button", cls, label);
  b.type = "button";
  b.addEventListener("click", fn);
  return b;
};

export function openSaved({ onAsk } = {}) {
  document.querySelector(".saved-dialog")?.remove();
  const d = el("dialog", "saved-dialog");
  d.setAttribute("aria-label", "Saved answers");
  const head = el("div", "saved-head");
  const search = el("input", "saved-search");
  search.type = "search";
  search.placeholder = "Search saved answers";
  search.setAttribute("aria-label", "Search saved answers");
  head.append(el("p", "set-title", "Saved answers"), btn("Close", () => d.close(), "saved-btn saved-close"));
  const list = el("div", "saved-list");
  const render = () => {
    const f = search.value.trim().toLowerCase();
    const items = read().filter((s) => !f || s.q.toLowerCase().includes(f) || s.a.toLowerCase().includes(f));
    list.replaceChildren();
    if (!items.length) {
      list.append(el("p", "saved-empty", f ? "Nothing matches." : "No saved answers yet. Tap Save under any answer to keep it here."));
      return;
    }
    for (const s of items) {
      const card = el("div", "saved-item");
      const title = el("p", "saved-q", s.q || "Answer");
      const when = el("span", "saved-when", new Date(s.at).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }));
      const body = el("div", "saved-a ai-answer");
      renderAnswer(body, s.a);
      body.classList.add("clamped");
      const acts = el("div", "saved-acts");
      const more = btn("Show all", () => {
        body.classList.toggle("clamped");
        more.textContent = body.classList.contains("clamped") ? "Show all" : "Show less";
      });
      const copy = btn("Copy", async () => {
        try {
          await navigator.clipboard.writeText(s.a);
          copy.textContent = "Copied";
          setTimeout(() => (copy.textContent = "Copy"), 1500);
        } catch {}
      });
      acts.append(more, copy);
      if (onAsk && s.q) acts.append(btn("Ask again", () => (d.close(), onAsk(s.q))));
      acts.append(btn("Remove", () => (toggleSaved(s.q, s.a), render()), "saved-btn danger"));
      card.append(title, when, body, acts);
      list.append(card);
    }
  };
  search.addEventListener("input", render);
  d.append(head, search, list);
  d.addEventListener("close", () => d.remove());
  document.body.append(d);
  render();
  d.showModal();
  return d;
}
