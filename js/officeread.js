// Opens Word (.docx), PowerPoint (.pptx) and Excel (.xlsx) files on the device,
// so Nova AI can read them and edit them. These files are zip packages of XML;
// the spreadsheet library Nova AI already ships (SheetJS) can unzip them.

const LIB = new URL("../lib/office/", import.meta.url);
let xlsxReady = null;
function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  xlsxReady ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = new URL("xlsx.full.min.js", LIB).href;
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => {
      xlsxReady = null;
      reject(new Error("Couldn't load the file reader"));
    };
    document.head.append(s);
  });
  return xlsxReady;
}

export const OFFICE_FILE = /\.(docx|pptx|xlsx)$/i;
export const OLD_OFFICE_FILE = /\.(doc|ppt|xls)$/i;

const xml = (bytes) => new DOMParser().parseFromString(new TextDecoder().decode(bytes), "application/xml");
const textOf = (node) => [...node.getElementsByTagName("*")].filter((n) => n.localName === "t").map((n) => n.textContent).join("");
const byLocal = (root, name) => [...root.getElementsByTagName("*")].filter((n) => n.localName === name);
const clean = (s) => s.replace(/\s+/g, " ").trim();
const baseName = (name) => name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();

function unzip(XLSX, buffer) {
  const zip = XLSX.CFB.read(new Uint8Array(buffer), { type: "array" });
  const files = new Map();
  zip.FullPaths.forEach((path, i) => {
    const entry = zip.FileIndex[i];
    if (entry?.content && entry.type === 2) files.set(path.replace(/^[^/]*\//, ""), entry.content);
  });
  return files;
}

// Word: title and sections of headings + paragraphs
function readDocx(files, name) {
  const doc = files.get("word/document.xml");
  if (!doc) throw new Error("This Word file looks damaged.");
  const blocks = [];
  let title = "";
  let current = null;
  for (const p of byLocal(xml(doc), "p")) {
    const text = clean(textOf(p));
    if (!text) continue;
    const style = byLocal(p, "pStyle")[0]?.getAttribute("w:val") || "";
    if (/^title$/i.test(style) && !title) {
      title = text;
      continue;
    }
    if (/heading|^h\d/i.test(style) || (/^subtitle$/i.test(style) && !blocks.length)) {
      current = { h: text, p: [] };
      blocks.push(current);
      continue;
    }
    if (!current) {
      current = { h: "", p: [] };
      blocks.push(current);
    }
    current.p.push(text);
  }
  title ||= blocks.find((b) => b.h)?.h || baseName(name);
  const text = [`# ${title}`, ...blocks.flatMap((b) => [b.h ? `## ${b.h}` : "", ...b.p]).filter(Boolean)].join("\n\n");
  return { format: "docx", title, blocks, text };
}

// PowerPoint: each slide's title and bullet lines, in order
function readPptx(files, name) {
  const slidePaths = [...files.keys()]
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1]));
  if (!slidePaths.length) throw new Error("This PowerPoint file has no slides I can read.");
  const slides = slidePaths.map((path) => {
    const root = xml(files.get(path));
    let title = "";
    const lines = [];
    for (const sp of byLocal(root, "sp")) {
      const ph = byLocal(sp, "ph")[0]?.getAttribute("type") || "";
      const paras = byLocal(sp, "p").map((p) => clean(textOf(p))).filter(Boolean);
      if (!paras.length) continue;
      if (!title && /title/i.test(ph)) title = paras.join(" ");
      else lines.push(...paras);
    }
    if (!title && lines.length) title = lines.shift();
    return { title: title || "Untitled slide", bullets: lines.slice(0, 12) };
  });
  const title = slides[0]?.title || baseName(name);
  const text = slides.map((s, i) => [`Slide ${i + 1}: ${s.title}`, ...s.bullets.map((b) => `- ${b}`)].join("\n")).join("\n\n");
  return { format: "pptx", title, slides, text };
}

// Excel: the first sheet's rows (formulas kept as "=…")
function readXlsx(XLSX, buffer, name) {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellFormula: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const rows = [];
  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 200); r++) {
    const row = [];
    for (let c = range.s.c; c <= Math.min(range.e.c, range.s.c + 24); c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      row.push(cell ? (cell.f ? `=${cell.f}` : cell.v ?? "") : "");
    }
    if (row.some((v) => v !== "")) rows.push(row);
  }
  if (!rows.length) throw new Error("This Excel sheet is empty.");
  const [headers, ...body] = rows;
  const title = sheetName && !/^sheet\s*1$/i.test(sheetName) ? sheetName : baseName(name);
  const text = [`Sheet: ${title}`, headers.join(" | "), ...body.slice(0, 120).map((r) => r.join(" | "))].join("\n");
  return { format: "xlsx", title, headers: headers.map(String), rows: body, text };
}

export async function readOfficeFile(file) {
  const XLSX = await loadXlsx();
  const buffer = await file.arrayBuffer();
  const name = file.name || "file";
  if (/\.xlsx$/i.test(name)) return readXlsx(XLSX, buffer, name);
  const files = unzip(XLSX, buffer);
  if (/\.docx$/i.test(name)) return readDocx(files, name);
  if (/\.pptx$/i.test(name)) return readPptx(files, name);
  throw new Error("Unsupported file");
}
