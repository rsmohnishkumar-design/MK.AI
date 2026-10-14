// Settings kept on this device: theme (dark, light or follow the device),
// text size, and whether Enter sends a message.

const KEY = "mkai-settings";
const DEFAULTS = { theme: "dark", textSize: "normal", enterSends: true };
let prefs = { ...DEFAULTS };
try {
  prefs = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY)) || {}) };
} catch {}

export const pref = (name) => prefs[name];

const media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: light)") : null;
export function applySettings() {
  const root = document.documentElement;
  const light = prefs.theme === "light" || (prefs.theme === "auto" && media?.matches);
  root.dataset.theme = light ? "light" : "dark";
  root.dataset.textsize = prefs.textSize;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", light ? "#f6f8fa" : "#000000");
}
media?.addEventListener?.("change", () => prefs.theme === "auto" && applySettings());

function save(name, value) {
  prefs = { ...prefs, [name]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {}
  applySettings();
  document.dispatchEvent(new CustomEvent("mkai-settings", { detail: prefs }));
}

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

// A row of choices ("Dark | Light | Auto")
function choices(title, name, options) {
  const row = el("div", "set-row");
  row.append(el("span", "set-label", title));
  const group = el("div", "set-choices");
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", title);
  for (const [value, label] of options) {
    const b = el("button", "set-choice", label);
    b.type = "button";
    b.setAttribute("role", "radio");
    const mark = () => group.querySelectorAll(".set-choice").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    b.setAttribute("aria-checked", String(prefs[name] === value));
    b.addEventListener("click", () => {
      save(name, value);
      mark();
    });
    group.append(b);
  }
  row.append(group);
  return row;
}

export function openSettings() {
  document.querySelector(".settings-dialog")?.remove();
  const d = el("dialog", "settings-dialog");
  d.setAttribute("aria-label", "Settings");
  d.append(el("p", "set-title", "Settings"));
  d.append(choices("Theme", "theme", [["dark", "Dark"], ["light", "Light"], ["auto", "Same as device"]]));
  d.append(choices("Text size", "textSize", [["small", "Small"], ["normal", "Normal"], ["large", "Large"]]));
  d.append(choices("Enter key", "enterSends", [[true, "Sends the message"], [false, "Adds a new line"]]));
  d.append(el("p", "set-note", "With “Adds a new line”, send with Ctrl + Enter or the send button. Settings are kept on this device."));
  const close = el("button", "set-close", "Done");
  close.type = "button";
  close.addEventListener("click", () => d.close());
  d.append(close);
  d.addEventListener("close", () => d.remove());
  document.body.append(d);
  d.showModal();
  return d;
}
