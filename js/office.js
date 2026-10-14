// MK.ai Office: PowerPoint presentations, Word documents and Excel sheets,
// made from a prompt ("make a ppt on photosynthesis", "word document on
// pollution", "excel sheet for student marks"). MK.ai researches the topic
// itself (its knowledge base, then Wikipedia), shows a preview in the chat,
// and builds a real .pptx / .docx / .xlsx in the browser with open-source
// libraries hosted with MK.ai (PptxGenJS, docx, SheetJS). No outside AI.

import { knowledgeAnswer } from "./kb.js";

const LIB = new URL("../lib/office/", import.meta.url);

// ---------- Understanding the request ----------

const MAKE = /\b(make|create|build|prepare|generate|write|design|give me|i need|need|draft|do)\b/;
const PPT = /\b(ppt|pptx|powerpoint|power point|presentation|slides?|slide ?deck|slideshow)\b/;
const WORD = /\b(word (?:document|doc|file)|docx|ms word|document|report|assignment|project report|write ?up|article)\b/;
const EXCEL = /\b(excel|spreadsheet|xlsx|xls|work ?sheet|sheet|table)\b/;

export function officeKind(question) {
  const q = question.toLowerCase();
  if (!MAKE.test(q) && !/^(ppt|presentation|excel|word document|report)\b/.test(q)) return null;
  if (PPT.test(q)) return "ppt";
  if (/\b(excel|spreadsheet|xlsx|xls)\b/.test(q) || (EXCEL.test(q) && SHEETS.some((s) => s.test.test(q)))) return "excel";
  if (WORD.test(q)) return "word";
  return null;
}

// "make a ppt on the solar system for class 8" → "the solar system"
export function officeTopic(question) {
  const q = question.toLowerCase().replace(/[?.!]+$/, "");
  const m = q.match(/\b(?:on|about|regarding|for the topic|topic|titled|called|of)\s+(.+)$/);
  let topic = (m ? m[1] : q)
    .replace(/\b(for|in) (class|grade|std|standard) \d+.*$/, "")
    .replace(/\bwith \d+ slides?\b.*$/, "")
    .replace(/\b(please|pls|in (english|tamil)|for (school|college|students|my project|office|kids))\b.*$/, "")
    .replace(MAKE, " ")
    .replace(/\b(a|an|me|my|the|ppt|pptx|powerpoint|power point|presentation|slides?|slide deck|word|document|doc|docx|report|assignment|project|file|on|about)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return topic;
}

const slidesWanted = (q) => Math.min(12, Math.max(4, Number((q.match(/\b(\d{1,2}) slides?\b/i) || [])[1]) || 7));

// ---------- Research ----------

async function getJson(url, ms = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { signal: controller.signal });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const SKIP_SECTIONS = /^(see also|references|external links|notes|further reading|bibliography|gallery|citations|sources|footnotes|works cited|explanatory notes|in popular culture|filmography|discography)$/i;
const sentencesOf = (text) =>
  (text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+(?=\s|$)/g) || [])
    .map((s) => s.trim().replace(/\s*\([^)]{0,80}\)/g, "").replace(/\s+([,.])/g, "$1"))
    .filter((s) => s.length > 25 && s.length < 260);

// { title, intro: [sentences], sections: [{ heading, sentences }], source }
export async function researchTopic(topic) {
  const out = { title: topic.replace(/\b[a-z]/g, (c) => c.toUpperCase()), intro: [], sections: [], source: "" };
  const search = await getJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&srlimit=1&format=json&origin=*`);
  const title = search?.query?.search?.[0]?.title;
  if (title) {
    const page = await getJson(
      `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=wiki&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`
    );
    const text = Object.values(page?.query?.pages || {})[0]?.extract || "";
    if (text) {
      out.title = title;
      out.source = `Wikipedia: “${title}” (CC BY-SA)`;
      const parts = text.split(/\n={2,}\s*(.+?)\s*={2,}\n/);
      out.intro = sentencesOf(parts[0]);
      for (let i = 1; i < parts.length; i += 2) {
        const heading = parts[i].trim();
        const sentences = sentencesOf(parts[i + 1] || "");
        if (SKIP_SECTIONS.test(heading) || sentences.length < 2) continue;
        const same = out.sections.find((s) => s.heading === heading);
        if (!same) out.sections.push({ heading, sentences });
      }
    }
  }
  if (!out.intro.length) {
    const known = await knowledgeAnswer(`what is ${topic}`).catch(() => null);
    if (known?.answer) {
      out.intro = sentencesOf(known.answer.replace(/\*\*/g, ""));
      out.source = "MK.ai's knowledge base";
    }
  }
  return out;
}

// ---------- Building the plans ----------

const bulletOf = (s) => (s.length > 150 ? s.slice(0, s.lastIndexOf(" ", 147)) + "…" : s);

function pptPlan(topic, info, count) {
  const slides = [{ type: "title", title: info.title, subtitle: `A presentation · ${new Date().toLocaleDateString([], { month: "long", year: "numeric" })}` }];
  slides.push({ type: "bullets", title: "Introduction", bullets: info.intro.slice(0, 4).map(bulletOf) });
  for (const sec of info.sections.slice(0, Math.max(1, count - 3))) {
    slides.push({ type: "bullets", title: sec.heading, bullets: sec.sentences.slice(0, 4).map(bulletOf) });
  }
  if (slides.length < count - 1 && info.intro.length > 4) {
    slides.push({ type: "bullets", title: "More about " + info.title, bullets: info.intro.slice(4, 8).map(bulletOf) });
  }
  const takeaways = slides.slice(1).map((s) => s.bullets[0]).filter(Boolean).slice(0, 5);
  slides.push({ type: "bullets", title: "Key takeaways", bullets: takeaways });
  slides.push({ type: "end", title: "Thank you", subtitle: "Questions?" });
  return { kind: "ppt", title: info.title, slides, source: info.source };
}

function wordPlan(topic, info) {
  const blocks = [{ h: "Introduction", p: [info.intro.slice(0, 4).join(" "), info.intro.slice(4, 8).join(" ")].filter(Boolean) }];
  for (const sec of info.sections.slice(0, 8)) {
    const s = sec.sentences;
    blocks.push({ h: sec.heading, p: [s.slice(0, 4).join(" "), s.slice(4, 8).join(" ")].filter(Boolean) });
  }
  const conclusion = blocks
    .slice(1)
    .map((b) => b.p[0]?.match(/^[^.!?]+[.!?]/)?.[0])
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");
  blocks.push({ h: "Conclusion", p: [conclusion || `${info.title} is an important topic worth understanding in depth.`] });
  return { kind: "word", title: info.title, blocks, source: info.source };
}

// Excel templates: headers, sample rows, and formulas ({c} = this row's number)
const SHEETS = [
  {
    test: /\b(marks?|grades?|result|report card|scores?|students?)\b/,
    name: "Student marks",
    headers: ["Name", "Maths", "Science", "English", "Social", "Tamil", "Total", "Average", "Grade"],
    row: (n) => [n, ...[0, 0, 0, 0, 0].map(() => 50 + Math.floor(Math.random() * 50)), "=SUM(B{c}:F{c})", "=ROUND(G{c}/5,1)", '=IF(H{c}>=90,"A+",IF(H{c}>=75,"A",IF(H{c}>=60,"B",IF(H{c}>=45,"C","D"))))'],
    names: ["Aarav", "Diya", "Ishaan", "Kavya", "Mohan", "Priya", "Rahul", "Sneha", "Vikram", "Zara"],
  },
  {
    test: /\b(budget|expenses?|spending|money|finance|household)\b/,
    name: "Monthly budget",
    headers: ["Category", "Planned (₹)", "Actual (₹)", "Difference (₹)"],
    row: (n) => [n, 1000 + 500 * Math.floor(Math.random() * 10), 1000 + 500 * Math.floor(Math.random() * 10), "=B{c}-C{c}"],
    names: ["Rent", "Groceries", "Electricity", "Water", "Internet", "Transport", "Education", "Medical", "Entertainment", "Savings"],
    totals: ["Total", "=SUM(B2:B{last})", "=SUM(C2:C{last})", "=SUM(D2:D{last})"],
  },
  {
    test: /\b(attendance|present|absent|register)\b/,
    name: "Attendance",
    headers: ["Name", "Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Days present", "Attendance %"],
    row: (n) => [n, ...[0, 0, 0, 0, 0].map(() => (Math.random() < 0.85 ? "P" : "A")), '=COUNTIF(B{c}:F{c},"P")', "=ROUND(G{c}/5*100,0)"],
    names: ["Aarav", "Diya", "Ishaan", "Kavya", "Mohan", "Priya", "Rahul", "Sneha"],
  },
  {
    test: /\b(inventory|stock|products?|items?|shop|store)\b/,
    name: "Inventory",
    headers: ["Item", "Quantity", "Unit price (₹)", "Value (₹)", "Reorder?"],
    row: (n) => [n, Math.floor(Math.random() * 100), 10 * (1 + Math.floor(Math.random() * 50)), "=B{c}*C{c}", '=IF(B{c}<20,"Yes","No")'],
    names: ["Notebook", "Pen", "Pencil", "Eraser", "Ruler", "Stapler", "Glue", "Scissors", "Marker", "File folder"],
    totals: ["Total", "=SUM(B2:B{last})", "", "=SUM(D2:D{last})", ""],
  },
  {
    test: /\b(salary|payroll|employees?|staff)\b/,
    name: "Payroll",
    headers: ["Employee", "Basic (₹)", "HRA (₹)", "Allowances (₹)", "Gross (₹)", "PF 12% (₹)", "Net pay (₹)"],
    row: (n) => {
      const basic = 15000 + 1000 * Math.floor(Math.random() * 20);
      return [n, basic, Math.round(basic * 0.4), 2000, "=B{c}+C{c}+D{c}", "=ROUND(B{c}*12%,0)", "=E{c}-F{c}"];
    },
    names: ["Anand", "Bhavna", "Charan", "Deepa", "Elango", "Farah", "Gopal", "Harini"],
    totals: ["Total", "=SUM(B2:B{last})", "=SUM(C2:C{last})", "=SUM(D2:D{last})", "=SUM(E2:E{last})", "=SUM(F2:F{last})", "=SUM(G2:G{last})"],
  },
  {
    test: /\b(sales|revenue|invoice|bill|billing)\b/,
    name: "Sales",
    headers: ["Product", "Units sold", "Price (₹)", "Revenue (₹)", "GST 18% (₹)", "Total (₹)"],
    row: (n) => [n, 1 + Math.floor(Math.random() * 50), 50 * (1 + Math.floor(Math.random() * 40)), "=B{c}*C{c}", "=ROUND(D{c}*18%,2)", "=D{c}+E{c}"],
    names: ["Product A", "Product B", "Product C", "Product D", "Product E", "Product F"],
    totals: ["Total", "=SUM(B2:B{last})", "", "=SUM(D2:D{last})", "=SUM(E2:E{last})", "=SUM(F2:F{last})"],
  },
  {
    test: /\b(timetable|time table|schedule|routine)\b/,
    name: "Timetable",
    headers: ["Time", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    row: (n) => {
      const subjects = ["Maths", "Science", "English", "Tamil", "Social", "Computer", "PE", "Art"];
      return [n, ...[0, 0, 0, 0, 0].map(() => subjects[Math.floor(Math.random() * subjects.length)])];
    },
    names: ["9:00–9:45", "9:45–10:30", "10:45–11:30", "11:30–12:15", "1:00–1:45", "1:45–2:30", "2:45–3:30"],
  },
  {
    test: /\b(to ?do|tasks?|checklist|planner)\b/,
    name: "To-do list",
    headers: ["Task", "Priority", "Due date", "Status"],
    row: (n, i) => [n, ["High", "Medium", "Low"][i % 3], new Date(Date.now() + (i + 1) * 86400000).toLocaleDateString(), "Pending"],
    names: ["Finish homework", "Revise chapter 3", "Submit project", "Pay electricity bill", "Buy groceries", "Call the bank"],
  },
];

// Names given in the prompt: "for Ravi, Priya and Arun"
function namesIn(question) {
  const m = question.match(/\b(?:for|of|with|names?|students?|employees?|items?|products?)\s*:?\s+([A-Z][\w.]+(?:\s*(?:,|and|&)\s*[A-Z][\w.]+){1,30})/);
  return m ? m[1].split(/\s*(?:,|\band\b|&)\s*/).filter(Boolean) : null;
}

function excelPlan(question) {
  const q = question.toLowerCase();
  const t = SHEETS.find((s) => s.test.test(q)) || SHEETS[3];
  const count = Number((q.match(/\b(\d{1,2}) (students?|rows?|employees?|items?|products?|people)\b/) || [])[1]);
  let names = namesIn(question) || t.names;
  if (count) names = Array.from({ length: count }, (_, i) => names[i] || `${t.names[0].replace(/\d+$/, "")} ${i + 1}`);
  const rows = names.map((n, i) => t.row(n, i).map((v) => (typeof v === "string" ? v.replaceAll("{c}", String(i + 2)) : v)));
  const last = rows.length + 1;
  if (t.totals) rows.push(t.totals.map((v) => v.replaceAll("{last}", String(last))));
  return { kind: "excel", title: t.name, headers: t.headers, rows };
}

// ---------- The chat answer ----------

// ---------- Alpaca writes the content ----------

const OFFICE_NOTE = {
  ppt: (n) => `Plan a PowerPoint presentation for the user's request. Reply with ONLY a JSON object, no other text:
{"title": "...", "subtitle": "...", "slides": [{"title": "...", "bullets": ["...", "..."]}]}
Use ${n - 2} content slides (the title and thank-you slides are added for you), 3-5 bullets each, each bullet one clear sentence under 22 words, facts accurate, ending with a "Key takeaways" or "Conclusion" slide. Write in the user's language.`,
  word: `Write the document the user asks for. Reply with ONLY a JSON object, no other text:
{"title": "...", "sections": [{"heading": "...", "paragraphs": ["...", "..."]}]}
Use 5-9 sections with 1-3 well-written paragraphs each (an introduction first and a conclusion last, unless it's a letter, application or form, which should follow the proper format). Facts accurate. Write in the user's language.`,
  excel: `Design the spreadsheet the user asks for. Reply with ONLY a JSON object, no other text:
{"title": "...", "headers": ["...", "..."], "rows": [["...", 1, "=B2*C2"]]}
Row 1 is the headers, so data starts on row 2. Use 6-15 realistic sample rows (Indian names and ₹ where it fits), numbers as numbers, and real Excel formulas (starting with =, using real cell references like B2, SUM, AVERAGE, IF, ROUND, COUNTIF) for totals and calculated columns. Add a totals row at the end if it makes sense.`,
};

function jsonIn(text) {
  const raw = text || "";
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function alpacaPlan(question, kind) {
  if (typeof navigator === "undefined" || navigator.onLine === false) return null;
  let askAlpaca;
  try {
    ({ askAlpaca } = await import("./ai.js"));
  } catch {
    return null;
  }
  const note = kind === "ppt" ? OFFICE_NOTE.ppt(slidesWanted(question)) : OFFICE_NOTE[kind];
  const result = await askAlpaca(question, [], { good: [], bad: [], docs: [] }, () => {}, { system: note }).catch(() => null);
  const j = jsonIn(result?.answer);
  if (!j || !j.title) return null;
  const str = (v) => String(v ?? "").trim();
  if (kind === "ppt") {
    const slides = (j.slides || []).filter((x) => x?.title && Array.isArray(x.bullets) && x.bullets.length).slice(0, 14);
    if (slides.length < 2) return null;
    return {
      kind,
      title: str(j.title),
      source: "Alpaca",
      slides: [
        { type: "title", title: str(j.title), subtitle: str(j.subtitle) || `A presentation · ${new Date().toLocaleDateString([], { month: "long", year: "numeric" })}` },
        ...slides.map((x) => ({ type: "bullets", title: str(x.title), bullets: x.bullets.slice(0, 6).map(str) })),
        { type: "end", title: "Thank you", subtitle: "Questions?" },
      ],
    };
  }
  if (kind === "word") {
    const blocks = (j.sections || []).filter((x) => x?.heading && Array.isArray(x.paragraphs)).map((x) => ({ h: str(x.heading), p: x.paragraphs.map(str).filter(Boolean) }));
    return blocks.length >= 2 ? { kind, title: str(j.title), blocks, source: "Alpaca" } : null;
  }
  const headers = (j.headers || []).map(str);
  const rows = (j.rows || []).filter(Array.isArray).slice(0, 60).map((r) => headers.map((_, i) => (typeof r[i] === "number" ? r[i] : str(r[i]))));
  return headers.length >= 2 && rows.length ? { kind, title: str(j.title), headers, rows } : null;
}

export async function officeAnswer(question) {
  const kind = officeKind(question);
  if (!kind) return null;
  // A ready template fits ("marks sheet", "budget"): instant. Otherwise Alpaca writes it.
  const hasTemplate = kind === "excel" && SHEETS.some((t) => t.test.test(question.toLowerCase()));
  if (!hasTemplate) {
    const plan = await alpacaPlan(question, kind);
    if (plan) {
      const what = kind === "ppt" ? `a ${plan.slides.length}-slide PowerPoint presentation` : kind === "word" ? "a Word document" : `an Excel sheet with ${plan.rows.length} rows${plan.rows.some((r) => r.some((v) => typeof v === "string" && v.startsWith("="))) ? " and working formulas" : ""}`;
      return `**${plan.title}**: ${what}, written by Alpaca. Preview it below and download the file.\n\n\`\`\`mkai-office\n${JSON.stringify(plan)}\n\`\`\``;
    }
  }
  if (kind === "excel") {
    const plan = excelPlan(question);
    return `**${plan.title}**: an Excel sheet with ${plan.rows.length} rows and working formulas. Change the names and numbers after downloading: the totals and averages update by themselves.\n\n\`\`\`mkai-office\n${JSON.stringify(plan)}\n\`\`\``;
  }
  const topic = officeTopic(question);
  if (!topic || topic.length < 2) return "Tell me the topic, for example **make a ppt on the solar system** or **write a word document on pollution**.";
  const info = await researchTopic(topic);
  if (!info.intro.length && !info.sections.length) return `I couldn't find enough information about “${topic}” right now. Check the spelling or try a more common name for the topic.`;
  const plan = kind === "ppt" ? pptPlan(topic, info, slidesWanted(question)) : wordPlan(topic, info);
  const what = kind === "ppt" ? `a ${plan.slides.length}-slide PowerPoint presentation` : "a Word document";
  return `**${plan.title}**: ${what}, researched from ${info.source}. Preview it below and download the file.\n\n\`\`\`mkai-office\n${JSON.stringify(plan)}\n\`\`\``;
}

// ---------- Building the files (libraries load only when needed) ----------

function loadScript(file, global) {
  if (window[global]) return Promise.resolve(window[global]);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = new URL(file, LIB).href;
    s.onload = () => resolve(window[global]);
    s.onerror = () => reject(new Error(`Couldn't load ${file}`));
    document.head.append(s);
  });
}

const fileName = (title, ext) => `${title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "MK.ai"}.${ext}`;

async function buildPpt(plan) {
  const PptxGenJS = await loadScript("pptxgen.bundle.js", "PptxGenJS");
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";
  pres.title = plan.title;
  const INK = "14181C", GOLD = "C9A227", PAPER = "FFFFFF", TEXT = "1F2933";
  for (const s of plan.slides) {
    const slide = pres.addSlide();
    if (s.type === "title" || s.type === "end") {
      slide.background = { color: INK };
      slide.addShape(pres.ShapeType.rect, { x: 0, y: 3.2, w: 13.33, h: 0.08, fill: { color: GOLD } });
      slide.addText(s.title, { x: 0.8, y: 1.6, w: 11.7, h: 1.4, fontSize: 40, bold: true, color: PAPER, fontFace: "Calibri" });
      slide.addText(s.subtitle, { x: 0.8, y: 3.5, w: 11.7, h: 0.8, fontSize: 20, color: GOLD, fontFace: "Calibri" });
    } else {
      slide.background = { color: PAPER };
      slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.1, fill: { color: INK } });
      slide.addText(s.title, { x: 0.6, y: 0.18, w: 12, h: 0.75, fontSize: 28, bold: true, color: PAPER, fontFace: "Calibri" });
      slide.addText(
        s.bullets.map((b) => ({ text: b, options: { bullet: { code: "25A0" }, paraSpaceAfter: 10 } })),
        { x: 0.8, y: 1.5, w: 11.7, h: 5.3, fontSize: 20, color: TEXT, fontFace: "Calibri", valign: "top" }
      );
    }
    slide.addText("MK.ai", { x: 11.9, y: 7.0, w: 1.2, h: 0.35, fontSize: 10, color: "8A94A6", align: "right" });
  }
  if (plan.source) pres.slides[pres.slides.length - 1].addText(`Source: ${plan.source}`, { x: 0.8, y: 6.6, w: 11.7, h: 0.4, fontSize: 11, color: "8A94A6" });
  return { blob: await pres.write({ outputType: "blob" }), name: fileName(plan.title, "pptx") };
}

async function buildWord(plan) {
  const docx = await loadScript("docx.iife.js", "docx");
  const { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } = docx;
  const children = [
    new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun({ text: plan.title, bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: new Date().toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" }), italics: true, color: "666666" })] }),
  ];
  for (const b of plan.blocks) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 }, children: [new TextRun(b.h)] }));
    for (const p of b.p) children.push(new Paragraph({ spacing: { after: 160, line: 320 }, alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: p, size: 24 })] }));
  }
  if (plan.source) children.push(new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: `Source: ${plan.source}. Made with MK.ai.`, italics: true, size: 18, color: "888888" })] }));
  const doc = new Document({ creator: "MK.ai", title: plan.title, sections: [{ children }] });
  return { blob: await Packer.toBlob(doc), name: fileName(plan.title, "docx") };
}

async function buildExcel(plan) {
  const XLSX = await loadScript("xlsx.full.min.js", "XLSX");
  const aoa = [plan.headers, ...plan.rows.map((r) => r.map((v) => (typeof v === "string" && v.startsWith("=") ? null : v)))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  plan.rows.forEach((r, i) =>
    r.forEach((v, j) => {
      if (typeof v === "string" && v.startsWith("=")) ws[XLSX.utils.encode_cell({ r: i + 1, c: j })] = { t: "n", f: v.slice(1) };
    })
  );
  ws["!cols"] = plan.headers.map((h) => ({ wch: Math.max(12, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, plan.title.slice(0, 31));
  const data = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return { blob: new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), name: fileName(plan.title, "xlsx") };
}

function download({ blob, name }) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ---------- Preview in the chat ----------

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

// Works out formula values for the preview, like Excel does (the file keeps the
// real formulas). Handles the formulas MK.ai writes: cell references, + - * /,
// %, SUM, ROUND, IF and COUNTIF.
function sheetCalculator(rows) {
  const col = (letters) => letters.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const cache = new Map();
  const cell = (ref) => {
    const m = ref.match(/^([A-Z]+)(\d+)$/);
    const r = Number(m[2]) - 2;
    const c = col(m[1]);
    return value(r, c);
  };
  const range = (a, b) => {
    const [, ca, ra] = a.match(/^([A-Z]+)(\d+)$/);
    const [, cb, rb] = b.match(/^([A-Z]+)(\d+)$/);
    const out = [];
    for (let r = Number(ra); r <= Number(rb); r++) for (let c = col(ca); c <= col(cb); c++) out.push(value(r - 2, c));
    return out;
  };
  const fns = {
    SUM: (...xs) => xs.flat().reduce((t, x) => t + (Number(x) || 0), 0),
    ROUND: (x, n) => Math.round(x * 10 ** n) / 10 ** n,
    IF: (c, a, b) => (c ? a : b),
    COUNTIF: (xs, v) => xs.filter((x) => x === v).length,
  };
  function value(r, c) {
    const key = `${r},${c}`;
    if (cache.has(key)) return cache.get(key);
    cache.set(key, 0); // guards against loops
    const raw = rows[r]?.[c];
    let v = raw;
    if (typeof raw === "string" && raw.startsWith("=")) {
      // Turn the formula into a small safe expression
      const expr = raw
        .slice(1)
        .replace(/([A-Z]+\d+):([A-Z]+\d+)/g, (_, a, b) => `R("${a}","${b}")`)
        .replace(/(\d+(?:\.\d+)?)%/g, "($1/100)")
        .replace(/\b(SUM|ROUND|IF|COUNTIF)\(/g, "F.$1(")
        .replace(/(?<![A-Za-z."])([A-Z]{1,2}\d+)(?![\w"])/g, 'C("$1")')
        .replace(/([^<>!=])=(?!=)/g, "$1==");
      if (/^[\sA-Za-z0-9."+\-*/(),<>=!?:%]*$/.test(expr)) {
        try {
          v = Function("C", "R", "F", `return (${expr});`)(cell, range, fns);
          if (typeof v === "number") v = Math.round(v * 100) / 100;
        } catch {
          v = "";
        }
      } else v = "";
    }
    cache.set(key, v);
    return v;
  }
  return value;
}

export function mountOffice(container, text) {
  let plan;
  try {
    plan = JSON.parse(text);
  } catch {
    return;
  }
  const box = el("div", `office-box office-${plan.kind}`);
  const head = el("div", "office-head");
  const label = { ppt: "PowerPoint presentation", word: "Word document", excel: "Excel sheet" }[plan.kind];
  head.append(el("span", "office-type", label), el("span", "office-title", plan.title));
  box.append(head);

  const body = el("div", "office-body");
  if (plan.kind === "ppt") {
    plan.slides.forEach((s, i) => {
      const card = el("div", `office-slide ${s.type === "bullets" ? "" : "dark"}`);
      card.append(el("span", "office-num", String(i + 1)), el("p", "office-slide-title", s.title));
      if (s.subtitle) card.append(el("p", "office-slide-sub", s.subtitle));
      if (s.bullets) {
        const ul = el("ul");
        s.bullets.forEach((b) => ul.append(el("li", null, b)));
        card.append(ul);
      }
      body.append(card);
    });
  } else if (plan.kind === "word") {
    const page = el("div", "office-page");
    page.append(el("h3", null, plan.title));
    plan.blocks.forEach((b) => {
      page.append(el("h4", null, b.h));
      b.p.forEach((p) => page.append(el("p", null, p)));
    });
    body.append(page);
  } else {
    const table = el("table", "office-table");
    const tr = el("tr");
    plan.headers.forEach((h) => tr.append(el("th", null, h)));
    table.append(tr);
    const calc = sheetCalculator(plan.rows);
    plan.rows.forEach((r, i) => {
      const row = el("tr");
      r.forEach((v, j) => row.append(el("td", typeof v === "string" && v.startsWith("=") ? "formula" : null, String(calc(i, j)))));
      table.append(row);
    });
    body.append(table);
  }
  box.append(body);

  const bar = el("div", "office-bar");
  const ext = { ppt: "pptx", word: "docx", excel: "xlsx" }[plan.kind];
  const btn = el("button", "office-download", `⬇ Download .${ext}`);
  btn.type = "button";
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Making the file…";
    try {
      const file = plan.kind === "ppt" ? await buildPpt(plan) : plan.kind === "word" ? await buildWord(plan) : await buildExcel(plan);
      download(file);
      btn.textContent = `✓ Downloaded ${file.name}`;
    } catch (err) {
      console.warn("Office file:", err);
      btn.textContent = "Couldn't make the file. Try again.";
    }
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = `⬇ Download .${ext}`;
    }, 4000);
  });
  bar.append(btn);
  if (plan.source) bar.append(el("span", "office-source", `Source: ${plan.source}`));
  box.append(bar);
  container.append(box);
}

// For tests: build the file without downloading
export const buildOfficeFile = (plan) => (plan.kind === "ppt" ? buildPpt(plan) : plan.kind === "word" ? buildWord(plan) : buildExcel(plan));
