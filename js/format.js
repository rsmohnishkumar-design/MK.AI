// Shows an answer with code blocks, `inline code` and **bold**, the way chat
// apps do. Everything is built as DOM nodes from text, so nothing in an
// answer can ever run as HTML.

const FENCE = /```([\w+#.-]*)[^\n]*\n?([\s\S]*?)(?:```|$)/g;

function inline(parent, text) {
  // `code` and **bold**; anything else stays plain text.
  const re = /`([^`\n]+)`|\*\*([^*\n]+)\*\*/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) parent.append(text.slice(last, m.index));
    const el = document.createElement(m[1] !== undefined ? "code" : "strong");
    el.textContent = m[1] ?? m[2];
    if (m[1] !== undefined) el.className = "inline-code";
    parent.append(el);
    last = m.index + m[0].length;
  }
  if (last < text.length) parent.append(text.slice(last));
}

function codeBlock(lang, code) {
  const box = document.createElement("div");
  box.className = "code-block";
  const head = document.createElement("div");
  head.className = "code-head";
  const label = document.createElement("span");
  label.textContent = lang || "code";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "code-copy";
  copy.textContent = "copy";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code);
      copy.textContent = "copied";
      setTimeout(() => (copy.textContent = "copy"), 1500);
    } catch {}
  });
  head.append(label, copy);
  const pre = document.createElement("pre");
  const el = document.createElement("code");
  el.textContent = code;
  pre.append(el);
  box.append(head, pre);
  return box;
}

export function renderAnswer(container, text) {
  container.replaceChildren();
  let last = 0;
  for (const m of text.matchAll(FENCE)) {
    // The box has its own spacing, so blank lines around it are dropped.
    if (m.index > last) inline(container, text.slice(last, m.index).replace(/\s+$/, ""));
    container.append(codeBlock(m[1].toLowerCase(), m[2].replace(/\n$/, "")));
    last = m.index + m[0].length;
    while (text[last] === "\n") last++;
  }
  if (last < text.length) inline(container, text.slice(last));
}
