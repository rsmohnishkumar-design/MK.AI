// Folder workspace: open a folder from your computer, browse its files, and ask
// Alpaca to explain or change the project, like a coding assistant working in
// your folder. Alpaca only proposes changes; you see each one and approve it
// before anything is written. Nothing is ever deleted.
//
// Chrome and Edge on a computer can save straight into the folder (File System
// Access API). Other browsers open the folder read-only and give the changed
// files back as a .zip.

import { makeZip } from "./format.js";
import { lineDiff } from "./editor.js";

const SKIP_DIRS = /^(node_modules|\.git|\.svn|\.hg|dist|build|out|\.next|\.nuxt|\.cache|coverage|__pycache__|\.venv|venv|env|\.idea|\.vscode|target|bin|obj|vendor)$/i;
const TEXT_FILE = /\.(txt|md|markdown|csv|json|jsonc|js|mjs|cjs|jsx|ts|tsx|py|java|kt|c|cc|cpp|h|hpp|cs|go|rs|rb|php|swift|dart|html|htm|css|scss|sass|less|vue|svelte|xml|svg|yml|yaml|toml|ini|cfg|conf|env\.example|sql|sh|bash|bat|ps1|gradle|properties|gitignore|dockerfile|makefile|r|lua|pl)$/i;
const TEXT_NAME = /^(readme|license|makefile|dockerfile|procfile|\.gitignore|\.editorconfig|\.prettierrc|\.eslintrc)$/i;
const MAX_FILES = 3000;
const MAX_FILE_BYTES = 400_000;
const CONTEXT_CHARS = 60_000;

const isText = (path) => TEXT_FILE.test(path) || TEXT_NAME.test(path.split("/").pop());
const langOf = (path) => {
  const ext = path.split(".").pop().toLowerCase();
  return { js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript", ts: "javascript", tsx: "javascript", py: "python", htm: "html", md: "text", markdown: "text" }[ext] || ext;
};

export const canWriteFolders = () => typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";

// ---------- Reading a folder ----------
async function scanHandle(dir, prefix = "", out = []) {
  for await (const entry of dir.values()) {
    if (out.length >= MAX_FILES) break;
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === "directory") {
      if (!SKIP_DIRS.test(entry.name) && !entry.name.startsWith(".")) await scanHandle(entry, path, out);
    } else out.push({ path, handle: entry, text: isText(path) });
  }
  return out;
}

export async function openFolderWithPicker() {
  const root = await window.showDirectoryPicker({ mode: "readwrite" });
  const files = await scanHandle(root);
  return createWorkspace(root.name, files, root);
}

// Files from <input webkitdirectory> (read-only)
export function openFolderFromFiles(fileList) {
  const list = [...fileList];
  if (!list.length) throw new Error("That folder is empty.");
  const name = (list[0].webkitRelativePath || list[0].name).split("/")[0] || "folder";
  const files = list
    .map((f) => ({ path: (f.webkitRelativePath || f.name).split("/").slice(1).join("/") || f.name, file: f }))
    .filter((f) => !f.path.split("/").slice(0, -1).some((d) => SKIP_DIRS.test(d) || d.startsWith(".")))
    .slice(0, MAX_FILES)
    .map((f) => ({ ...f, text: isText(f.path) }));
  return createWorkspace(name, files, null);
}

function createWorkspace(name, files, root) {
  files.sort((a, b) => a.path.localeCompare(b.path));
  const cache = new Map(); // path → text
  const ws = {
    name,
    files,
    writable: !!root,
    changes: new Map(), // path → new text (applied, or kept for the zip)
    async read(path) {
      if (ws.changes.has(path)) return ws.changes.get(path);
      if (cache.has(path)) return cache.get(path);
      const f = files.find((x) => x.path === path);
      if (!f) return null;
      const file = f.file || (await f.handle.getFile());
      if (file.size > MAX_FILE_BYTES) return null;
      const text = await file.text();
      if (text.includes("\u0000")) return null;
      cache.set(path, text);
      return text;
    },
    async write(path, text) {
      if (!root) {
        ws.changes.set(path, text);
        return "kept";
      }
      const parts = path.split("/").filter(Boolean);
      if (parts.some((p) => p === ".." || p === ".")) throw new Error("Unsafe path");
      let dir = root;
      for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
      const handle = await dir.getFileHandle(parts.at(-1), { create: true });
      const w = await handle.createWritable();
      await w.write(text);
      await w.close();
      cache.set(path, text);
      ws.changes.set(path, text);
      if (!files.some((x) => x.path === path)) {
        files.push({ path, handle, text: isText(path) });
        files.sort((a, b) => a.path.localeCompare(b.path));
      }
      return "saved";
    },
    exists: (path) => files.some((x) => x.path === path) || ws.changes.has(path),
  };
  return ws;
}

// ---------- What Alpaca sees ----------
const words = (s) => (s.toLowerCase().match(/[a-z0-9_]{3,}/g) || []).filter((w) => !/^(the|and|for|with|this|that|file|files|code|make|add|change|please|can|you|all|into|from|what|how|does|project|folder|app)$/.test(w));

export async function buildContext(ws, question, focus = []) {
  const tree = ws.files.map((f) => f.path);
  const listing = tree.length > 400 ? [...tree.slice(0, 400), `…and ${tree.length - 400} more files`] : tree;
  // Most relevant text files first: the ones in focus, then names that match the question, then the usual entry points
  const q = words(question);
  const score = (path) => {
    const p = path.toLowerCase();
    let s = 0;
    if (focus.includes(path)) s += 100;
    for (const w of q) if (p.includes(w)) s += 10;
    if (/(^|\/)(readme\.md|package\.json|index\.html|main\.\w+|app\.\w+|index\.\w+)$/i.test(path)) s += 3;
    if (p.split("/").length <= 2) s += 1;
    return s;
  };
  const candidates = ws.files.filter((f) => f.text).sort((a, b) => score(b.path) - score(a.path));
  const included = [];
  let used = 0;
  for (const f of candidates) {
    if (used > CONTEXT_CHARS) break;
    const text = await ws.read(f.path);
    if (text == null) continue;
    const room = CONTEXT_CHARS - used;
    if (text.length > room && included.length) continue;
    const body = text.length > room ? `${text.slice(0, room)}\n…(cut to fit)` : text;
    included.push({ path: f.path, body });
    used += body.length;
  }
  return {
    included: included.map((x) => x.path),
    text: `Project folder "${ws.name}" (${tree.length} files):\n${listing.join("\n")}\n\n` + included.map((x) => `----- ${x.path} -----\n${x.body}`).join("\n\n"),
  };
}

export const WORKSPACE_NOTE = `You are working inside the user's project folder, like a coding assistant on their computer. The file list and the contents of the most relevant files are below.
- To change a file or create a new one, reply with its COMPLETE new content in a fenced code block whose info string is exactly the file's path from the list (for a new file, the new path), for example:
\`\`\`src/app.js
...the whole file...
\`\`\`
- Change only what the request needs and keep everything else exactly as it was. Never delete files. Don't include files you aren't changing.
- If you need a file whose contents weren't shown, say which one and the user will open it.
- Start with a short plan in plain words, then the files, then one line on how to test the change.
- If the user only asks a question, just answer it (no file blocks).`;

// File blocks in Alpaca's answer: [{ path, text }]
export function proposedFiles(answer) {
  const out = [];
  for (const m of answer.matchAll(/```([^\n`]*)\n([\s\S]*?)```/g)) {
    const info = m[1].trim();
    // A path: has a dot or slash, no spaces
    if (!/^[\w.@+\-\/]+$/.test(info) || !/[./]/.test(info) || /^\.+$/.test(info)) continue;
    const path = info.replace(/^\.\/+/, "").replace(/^\/+/, "");
    if (path.split("/").some((p) => p === "..")) continue;
    out.push({ path, text: m[2].replace(/\n$/, "") + "\n" });
  }
  return out;
}

export function downloadChanges(ws) {
  const files = [...ws.changes].map(([name, code]) => ({ name, code }));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(makeZip(files));
  a.download = `${ws.name}-changes.zip`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export { langOf, lineDiff };
