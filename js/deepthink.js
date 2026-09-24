// Deep think: MK.ai's slower, more careful mode. It works out what kind of
// question it is, splits questions with several parts, double-checks maths,
// adds related facts, and tries harder before saying "I don't know". Every
// step is written down so the person can open "Thought for …" and see how
// the answer was reached. Everything runs on MK.ai's own brain.

import { parse, evaluate, vars, simplify } from "./symbolic.js";
import { cleanMaths } from "./mathsolve.js";
import { keywords } from "./words.js";

// --- What kind of question is it? -----------------------------------------------------------

export function describe(question) {
  const q = question.toLowerCase();
  if (/\b(make|create|build|code|write|develop)\b.*\b(app|game|website|program|page)\b/.test(q)) return "a request to build an app";
  if (/\b(python|javascript|java|html|css|sql|c\+\+|code|coding|program|function|loop|variable|array|algorithm|git)\b/.test(q)) return "a coding question";
  if (/\b(derivative|differentiate|integra|limit|matrix|vector|equation|solve|factori[sz]e|simplify|expand)\b|\d\s*[-+*/^×÷=]\s*\d|\b\d+\s*[a-z]\b.*=|[a-z]\^?\d*\s*[+-]/.test(q)) return "a maths problem";
  if (/\b(force|velocity|acceleration|energy|power|current|voltage|resistance|molar|moles?|balance|wavelength|frequency|pressure|density)\b/.test(q) && /\d/.test(q)) return "a science problem";
  if (/^(hi|hello|hey|thanks|thank you|bye|good (morning|night|evening))\b/.test(q)) return "a greeting";
  if (/^(who|what|when|where|which|why|how|define|explain|tell me)\b/.test(q)) return "a question about facts or ideas";
  return "a general message";
}

// --- Questions with several parts -----------------------------------------------------------

const ASK = "what|who|when|where|why|how|which|is|are|can|does|do|define|explain|tell me";
// "what is the capital of france and who invented the telephone" → two questions.
// "salt and pepper" stays whole: a new part must start with a question word.
export function splitParts(question) {
  const parts = question
    .split(new RegExp(String.raw`\?\s+|\s*;\s*|\s+(?:and also|and then|also)\s+|,?\s+and\s+(?=(?:${ASK})\b)`, "i"))
    .map((p) => p.trim().replace(/\?+$/, ""))
    .filter((p) => p.split(/\s+/).length >= 2);
  return parts.length > 1 && parts.length <= 4 ? parts : [question];
}

// --- Double-checking maths -----------------------------------------------------------------

const toNumber = (text) => {
  const t = text.replace(/−/g, "-").replace(/,/g, "").replace(/≈.*/, "").trim();
  const tree = parse(t);
  if (!tree || vars(tree).size) return NaN;
  return evaluate(tree);
};
const close = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
const show = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1e6) / 1e6)).replace("-", "−");

// Returns a line like "✓ Check: x = 2 → both sides are 7", "⚠ …", or null.
export function verifyMaths(question, answer) {
  const q = cleanMaths(question).replace(/^(solve|find|calculate|evaluate|what is|what's)\s*:?\s*/, "");
  // 1. Equations in one letter: put each answer back in.
  const eq = q.match(/^([^=]+)=([^=]+)$/);
  if (eq) {
    const L = parse(eq[1]);
    const R = parse(eq[2]);
    if (L && R) {
      const letters = new Set([...vars(L), ...vars(R)]);
      if (letters.size === 1) {
        const [v] = letters;
        const deg = /\b(sin|cos|tan)\b/.test(q);
        // "So x = 2", "x = 2 or x = 3" (not "2x = 4" or "sin x = 1/2"); trig answers are in degrees
        const found = deg
          ? [...answer.split(":").pop().matchAll(/(−?\d+(?:\.\d+)?)°/g)].map((m) => m[1])
          : [...answer.matchAll(new RegExp(`(?:^|So |or |and |: |• )${v} = (−?[\\d.,/√π]+)(?=\\s*(?:$|[.;]|,\\s|or\\b|and\\b|≈|\\())`, "gm"))].map((m) => m[1]);
        const values = [...new Set(found)].map(toNumber).filter(Number.isFinite);
        if (!values.length) return null;
        const checks = values.map((x) => {
          const l = evaluate(L, { [v]: x }, deg);
          const r = evaluate(R, { [v]: x }, deg);
          return { x, l, r, ok: close(l, r) };
        });
        const unit = deg ? "°" : "";
        if (checks.every((c) => c.ok)) return `✓ Check: ${checks.map((c) => `${v} = ${show(c.x)}${unit} gives ${show(c.l)} on both sides`).join("; ")}.`;
        const bad = checks.find((c) => !c.ok);
        return `⚠ Check: with ${v} = ${show(bad.x)} the sides are ${show(bad.l)} and ${show(bad.r)}, so please double-check this answer.`;
      }
    }
  }
  // 2. Derivatives: compare with the slope measured numerically.
  const d = question.toLowerCase().match(/(?:derivative of|differentiate|d\/dx)\s*\(?(.+?)\)?\s*$/);
  const got = answer.match(/^= (.+)$/m);
  if (d && got) {
    const f = parse(d[1]);
    const df = parse(got[1].replace(/−/g, "-").replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (s) => "^" + [...s].map((c) => "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(c)).join("")));
    if (f && df && vars(f).size === 1) {
      const [v] = vars(f);
      const pts = [0.7, 1.3, 2.1];
      const ok = pts.every((t) => {
        const h = 1e-5;
        const slope = (evaluate(f, { [v]: t + h }) - evaluate(f, { [v]: t - h })) / (2 * h);
        const claimed = evaluate(simplify(df), { [v]: t });
        return !Number.isFinite(slope) || Math.abs(slope - claimed) < 1e-3 * Math.max(1, Math.abs(slope));
      });
      return ok ? `✓ Check: the formula matches the measured slope at ${v} = ${pts.join(", ")}.` : null;
    }
  }
  // 3. Plain arithmetic: work it out a second way.
  const expr = q.replace(/[=?]\s*$/, "");
  if (/\d/.test(expr) && /[-+*/^]/.test(expr) && !/[a-z]/.test(expr.replace(/\b(sqrt|sin|cos|tan|log|ln|pi)\b/g, ""))) {
    const value = toNumber(expr);
    const stated = answer.match(/= (−?[\d,]+(?:\.\d+)?)(?!.*=)/);
    if (Number.isFinite(value) && stated) {
      const s = Number(stated[1].replace(/−/g, "-").replace(/,/g, ""));
      if (close(s, value) || Math.abs(s - value) < 1e-4 * Math.max(1, Math.abs(value))) return `✓ Check: worked out again independently, it's ${show(value)}.`;
    }
  }
  return null;
}

// --- Trying harder --------------------------------------------------------------------------

// The core words of a question ("could you please tell me who made the
// telephone" → "made telephone"), for a second search.
export function coreQuery(question) {
  return keywords(question).join(" ");
}

export function firstSentence(text) {
  const plain = text.replace(/```[\s\S]*?```/g, "").replace(/\n+/g, " ").trim();
  const m = plain.match(/^(.{20,260}?[.!?])(\s|$)/);
  return m ? m[1] : plain.slice(0, 200);
}
