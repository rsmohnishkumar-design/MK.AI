// Tokenization: text → tokens, the small pieces language models read.
// Like the tokenizers of large models, it splits text into words, numbers and
// symbols, then breaks long words into sub-word pieces ("unbelievable" →
// "un" "believ" "able"). It works for any language: English and other Latin
// scripts by sub-words, Tamil, Hindi and other Indian scripts by syllables,
// Chinese and Japanese by character. Nova AI uses it to count usage, to decide
// how much of the conversation Alpaca can see, and in its language analysis.

// Short, very common words are one token each in every big model's vocabulary.
const COMMON = new Set(
  (
    "the be to of and a in that have i it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were has had been did does said made more very much many such here where why answer question"
  ).split(" ")
);
const PREFIXES = ["under", "inter", "trans", "super", "over", "anti", "auto", "post", "pre", "dis", "mis", "non", "sub", "un", "re", "in", "de"];
const SUFFIXES = ["ization", "isation", "ational", "fulness", "ousness", "iveness", "ations", "ation", "ments", "ment", "ness", "ings", "ing", "able", "ible", "less", "ful", "tion", "sion", "ally", "ical", "ity", "ies", "ers", "est", "ism", "ist", "ous", "ive", "ize", "ise", "ed", "ly", "es", "al", "s"];

// Pieces of text: words (with apostrophes), numbers, emoji and single symbols.
const PIECES = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*|\p{N}+|\p{Extended_Pictographic}(?:️|[\u{1F3FB}-\u{1F3FF}]|‍\p{Extended_Pictographic})*|[^\s\p{L}\p{M}\p{N}]/gu;
const LATIN = /^[\p{Script=Latin}'’]+$/u;
const HAN_KANA = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

const graphemes = (word) => {
  if (typeof Intl !== "undefined" && Intl.Segmenter) return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(word)].map((s) => s.segment);
  return word.match(/\P{M}\p{M}*/gu) || [word];
};

// A Latin-script word → sub-word pieces
function latinPieces(word) {
  const lower = word.toLowerCase();
  if (word.length <= 4 || COMMON.has(lower)) return [word];
  const out = [];
  let rest = word;
  const pre = PREFIXES.find((p) => lower.startsWith(p) && lower.length - p.length >= 4);
  if (pre) {
    out.push(rest.slice(0, pre.length));
    rest = rest.slice(pre.length);
  }
  const low = rest.toLowerCase();
  // "process", "analysis", "status" keep their final s
  const suf = SUFFIXES.find((s) => low.endsWith(s) && rest.length - s.length >= 3 && !(s === "s" && /(ss|is|us|ys)$/.test(low)));
  const tail = suf ? rest.slice(rest.length - suf.length) : "";
  if (suf) rest = rest.slice(0, rest.length - suf.length);
  // The stem: kept whole up to 6 letters, else in pieces of about 5
  for (let i = 0; i < rest.length; i += rest.length <= 6 ? rest.length : 5) out.push(rest.slice(i, i + (rest.length <= 6 ? rest.length : 5)));
  if (tail) out.push(tail);
  return out;
}

// Any word → pieces
function wordPieces(word) {
  if (LATIN.test(word)) return latinPieces(word);
  if (HAN_KANA.test(word)) return [...word];
  // Indian and other scripts: about two letters (with their vowel signs) per token
  const g = graphemes(word);
  const out = [];
  for (let i = 0; i < g.length; i += 2) out.push(g.slice(i, i + 2).join(""));
  return out;
}

// text → tokens (each with a space marker "▁" when it starts a new word)
export function tokenize(text = "") {
  const tokens = [];
  for (const m of String(text).matchAll(PIECES)) {
    const piece = m[0];
    const spaced = m.index > 0 && /\s/.test(text[m.index - 1]);
    let parts;
    if (/^\p{N}+$/u.test(piece)) parts = piece.match(/.{1,3}/gu); // numbers: up to 3 digits per token
    else if (/^[\p{L}\p{M}]/u.test(piece)) parts = wordPieces(piece);
    else parts = [piece];
    parts.forEach((p, i) => tokens.push(i === 0 && spaced ? `▁${p}` : p));
  }
  return tokens;
}

export const countTokens = (text = "") => tokenize(text).length;

// The most recent messages that fit in a token budget (at least the last one),
// oldest first: how much of the conversation Alpaca is shown.
export function recentWithin(history = [], maxMessages = 8, maxTokens = 3000) {
  const out = [];
  let used = 0;
  for (let i = history.length - 1; i >= 0 && out.length < maxMessages; i--) {
    const t = countTokens(history[i].content || history[i].text || "");
    if (out.length && used + t > maxTokens) break;
    used += t;
    out.unshift(history[i]);
  }
  return out;
}
