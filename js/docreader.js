// Reads documents without any outside AI: PDF text comes out with PDF.js
// (Mozilla's reader, hosted with Nova AI), and questions and answers are made
// from the document's own definition sentences.

let pdfjs = null;
async function loadPdfJs() {
  if (!pdfjs) {
    pdfjs = await import("../lib/pdfjs/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("../lib/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
  }
  return pdfjs;
}

// All the text in a PDF file (a File or Blob). Scanned pages (pictures of
// text) have no text inside, so they come back empty.
export async function pdfText(file, onPage = () => {}) {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    onPage(n, pdf.numPages);
    const content = await (await pdf.getPage(n)).getTextContent();
    let line = "";
    for (const item of content.items) {
      line += item.str + (item.hasEOL ? "\n" : " ");
    }
    pages.push(line.replace(/[ \t]+/g, " ").trim());
  }
  return pages.join("\n\n").trim();
}

const sentencesOf = (text) =>
  text
    .replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]+/g)
    ?.map((s) => s.trim()) || [];

// "Photosynthesis is the process…" → Q: What is photosynthesis? A: the sentence
// (plus the next one when it carries on about the same thing).
export function makeQA(text, max = 20) {
  const all = sentencesOf(text);
  const pairs = [];
  const seen = new Set();
  const DEF = /^(?:(?:The|An|A) (?=[a-z]))?([A-Za-z][A-Za-z0-9'()\- ]{1,50}?) (is|are|was|were|means|refers to|is called|are called) (.{15,})$/;
  for (const [i, s] of all.entries()) {
    if (pairs.length >= max) break;
    const m = s.match(DEF);
    if (!m) continue;
    // "Photosynthesis" → "photosynthesis" when the text also writes it in small letters
    let thing = m[1].trim();
    if (new RegExp(`\\b${thing.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text)) thing = thing.toLowerCase();
    if (thing.split(" ").length > 6 || /^(It|This|That|These|Those|They|He|She|There|Here|We|You|I)$/i.test(thing)) continue;
    const key = thing.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const past = /^(was|were)$/.test(m[2]);
    const person = past && /\b(born|king|queen|scientist|leader|poet|writer|emperor|president|minister)\b/i.test(m[3]);
    const q = `${person ? "Who" : "What"} ${m[2] === "are" || m[2] === "were" ? (past ? "were" : "are") : past ? "was" : "is"} ${thing}?`;
    const next = all[i + 1];
    const answer = !person && next && next.length < 160 && /^(It|They)\b/.test(next) ? `${s} ${next}` : s;
    pairs.push({ question: q, answer });
  }
  return pairs;
}
