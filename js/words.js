// Word matching, shared by memory, the knowledge base and Nova AI's reading.
// Questions are reduced to their meaning-carrying words (no "what/is/the"),
// with simple plurals folded ("planets" → "planet") and small typos forgiven.
const STOPWORDS = new Set(
  (
    "a an the is are was were be been am do does did of to in on at for by with from and or but " +
    "what whats who whom which when where why how can could would should will shall may might " +
    "i me my you your it its this that these those tell please about there their they them " +
    "give explain know want need some any much many s t ll re ve d m"
  ).split(" ")
);

export function normalize(str) {
  return str.trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function stem(word) {
  if (word.length > 5 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 4 && word.endsWith("es") && /(sh|ch|x|ss)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export function keywords(str) {
  const words = normalize(str)
    .split(" ")
    .filter((w) => w && !STOPWORDS.has(w))
    .map(stem);
  return [...new Set(words)];
}

function editDistanceAtMostOne(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export function sameWord(a, b) {
  return a === b || (a.length >= 5 && b.length >= 5 && editDistanceAtMostOne(a, b));
}

export function overlap(questionA, questionB) {
  const a = keywords(questionA);
  const b = keywords(questionB);
  if (!a.length || !b.length) return null;
  const shared = a.filter((w) => b.some((x) => sameWord(w, x))).length;
  return { jaccard: shared / (a.length + b.length - shared), containment: shared / Math.min(a.length, b.length) };
}

// 0..1: blends "share most of their words" with "one contains the other".
export function similarity(questionA, questionB) {
  const o = overlap(questionA, questionB);
  if (!o) return normalize(questionA) === normalize(questionB) ? 1 : 0;
  return 0.5 * o.jaccard + 0.5 * o.containment;
}
