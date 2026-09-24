// MK.ai's own maths solver, part 3: higher maths. Polynomial equations up to
// degree 4, inequalities, differentiation and integration of polynomials,
// matrices (determinant, inverse), probability with coins, dice and cards,
// and writing numbers in words (Indian and international). No outside service.

import { fmt, exact, gcd } from "./mathsolve.js";

const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "-": "⁻" };
const sup = (n) => String(n).split("").map((c) => SUP[c] || c).join("");

// --- Polynomials ----------------------------------------------------------------------------

// "3x^2 - 2x + 5" → coefficients [c0, c1, c2, …] (one letter, whole-number powers)
function parsePolynomial(text, v = null) {
  const src = text.replace(/\s+/g, "").replace(/\*/g, "");
  if (!src || /[^0-9a-z.+\-^/]/.test(src)) return null;
  const letters = new Set(src.match(/[a-z]/g) || []);
  if (letters.size > 1) return null;
  const x = v || [...letters][0] || "x";
  const terms = src.match(/[+-]?[^+-]+/g);
  if (!terms) return null;
  const coeffs = [];
  for (const t of terms) {
    const m = t.match(new RegExp(`^([+-]?)(\\d*\\.?\\d*(?:/\\d+)?)(${x}(?:\\^(\\d+))?)?$`));
    if (!m || (m[2] === "" && !m[3])) return null;
    let c = m[2] === "" ? 1 : m[2].includes("/") ? Number(m[2].split("/")[0]) / Number(m[2].split("/")[1]) : Number(m[2]);
    if (Number.isNaN(c)) return null;
    if (m[1] === "-") c = -c;
    const power = m[3] ? (m[4] ? Number(m[4]) : 1) : 0;
    if (power > 12) return null;
    coeffs[power] = (coeffs[power] || 0) + c;
  }
  for (let i = 0; i < coeffs.length; i++) coeffs[i] ||= 0;
  return { coeffs, v: x };
}

function polyText(coeffs, v = "x") {
  const parts = [];
  for (let p = coeffs.length - 1; p >= 0; p--) {
    const c = coeffs[p];
    if (!c || close(c, 0)) continue;
    const abs = Math.abs(c);
    const num = abs === 1 && p > 0 ? "" : exactShort(abs);
    const power = `${v}${p > 1 ? sup(p) : ""}`;
    // A fraction coefficient is written after the letter: x³/3, 2x²/5
    const fraction = num.match(/^(\d+)\/(\d+)$/);
    const body = p === 0 ? num : fraction ? `${fraction[1] === "1" ? "" : fraction[1]}${power}/${fraction[2]}` : `${num}${power}`;
    parts.push({ sign: c < 0 ? "−" : "+", body });
  }
  if (!parts.length) return "0";
  return parts.map((t, i) => (i === 0 ? (t.sign === "−" ? "−" : "") + t.body : ` ${t.sign} ${t.body}`)).join("");
}
// 0.5 → "1/2", 2 → "2"
function exactShort(x) {
  if (Number.isInteger(Math.round(x * 1e9) / 1e9)) return fmt(Math.round(x));
  for (let d = 2; d <= 60; d++) if (close(Math.round(x * d) / d, x)) return `${Math.round(x * d)}/${d}`;
  return fmt(x);
}
const evalPoly = (c, x) => c.reduce((s, a, p) => s + a * x ** p, 0);

// Real roots of a polynomial (degree ≤ 4): exact rational roots first, then numeric.
function realRoots(coeffs) {
  const c = [...coeffs];
  while (c.length > 1 && close(c[c.length - 1], 0)) c.pop();
  const roots = [];
  // Rational root test when coefficients are whole numbers.
  let work = [...c];
  const deflate = (poly, r) => {
    const out = [];
    let carry = 0;
    for (let i = poly.length - 1; i > 0; i--) {
      carry = poly[i] + carry * r;
      out.unshift(carry);
    }
    return out;
  };
  if (work.every((a) => Number.isInteger(a))) {
    let found = true;
    while (found && work.length > 3) {
      found = false;
      const a0 = work[0];
      const an = work[work.length - 1];
      if (a0 === 0) {
        roots.push(0);
        work = work.slice(1);
        found = true;
        continue;
      }
      const divs = (n) => Array.from({ length: Math.abs(n) }, (_, i) => i + 1).filter((d) => n % d === 0);
      for (const p of divs(a0)) {
        for (const q of divs(an)) {
          for (const r of [p / q, -p / q]) {
            if (!found && close(evalPoly(work, r), 0)) {
              roots.push(r);
              work = deflate(work, r);
              found = true;
            }
          }
        }
      }
    }
  }
  // Up to quadratic left: formula. Otherwise: scan for sign changes and bisect.
  if (work.length === 2) roots.push(-work[0] / work[1]);
  else if (work.length === 3) {
    const [cc, b, a] = work;
    const disc = b * b - 4 * a * cc;
    if (disc >= -1e-12) {
      const s = Math.sqrt(Math.max(0, disc));
      roots.push((-b + s) / (2 * a));
      if (s > 1e-12) roots.push((-b - s) / (2 * a));
    }
  } else if (work.length > 3) {
    const bound = 1 + Math.max(...work.slice(0, -1).map((a) => Math.abs(a / work[work.length - 1])));
    const steps = 4000;
    let prevX = -bound;
    let prevY = evalPoly(work, prevX);
    for (let i = 1; i <= steps; i++) {
      const x = -bound + (2 * bound * i) / steps;
      const y = evalPoly(work, x);
      if (close(y, 0)) roots.push(x);
      else if (prevY * y < 0) {
        let lo = prevX;
        let hi = x;
        for (let k = 0; k < 80; k++) {
          const mid = (lo + hi) / 2;
          if (evalPoly(work, lo) * evalPoly(work, mid) <= 0) hi = mid;
          else lo = mid;
        }
        roots.push((lo + hi) / 2);
      }
      prevX = x;
      prevY = y;
    }
  }
  const unique = [];
  for (const r of roots.sort((a, b) => a - b)) if (!unique.some((u) => Math.abs(u - r) < 1e-7)) unique.push(r);
  return unique;
}

function polynomialEquation(q) {
  const m = q.match(/^(?:solve|find the roots of|roots of|find the zeros of|zeros of)?\s*:?\s*([0-9a-z+\-^*/.\s]+?)\s*(?:=\s*([0-9a-z+\-^*/.\s]+))?$/);
  if (!m || !/\^[34]/.test(q) || !q.includes("=") && !/roots|zeros|solve/.test(q)) return null;
  const left = parsePolynomial(m[1]);
  const right = m[2] ? parsePolynomial(m[2], left?.v) : { coeffs: [0] };
  if (!left || !right) return null;
  const n = Math.max(left.coeffs.length, right.coeffs.length);
  const c = Array.from({ length: n }, (_, i) => (left.coeffs[i] || 0) - (right.coeffs[i] || 0));
  while (c.length > 1 && close(c[c.length - 1], 0)) c.pop();
  if (c.length < 4 || c.length > 5) return null;
  const v = left.v;
  const roots = realRoots(c);
  const lines = [`${polyText(c, v)} = 0`];
  if (c.every((a) => Number.isInteger(a))) lines.push("Trying whole-number and fraction factors of the constant term (rational root test), then solving what's left.");
  if (!roots.length) return [...lines, "", "This equation has no real solutions."].join("\n");
  lines.push("", `Real solutions: ${roots.map((r) => `${v} = ${exact(r)}`).join(", ")}`);
  const check = roots.every((r) => Math.abs(evalPoly(c, r)) < 1e-6 * Math.max(1, ...c.map(Math.abs)));
  if (check) lines.push("Check: each value makes the left side 0 ✓");
  return lines.join("\n");
}

// --- Inequalities (linear, one unknown) -------------------------------------------------------

function inequality(q) {
  const m = q.match(/^(?:solve\s*:?\s*)?(.+?)\s*(<=|>=|≤|≥|<|>)\s*(.+)$/);
  if (!m) return null;
  const L = parsePolynomial(m[1]);
  const R = parsePolynomial(m[3], L?.v);
  if (!L || !R) return null;
  const a = (L.coeffs[1] || 0) - (R.coeffs[1] || 0);
  const b = (L.coeffs[0] || 0) - (R.coeffs[0] || 0);
  if ((L.coeffs.length > 2 && L.coeffs.slice(2).some((c) => c)) || (R.coeffs.length > 2 && R.coeffs.slice(2).some((c) => c))) return null;
  if (close(a, 0)) return null;
  const sign = { "<=": "≤", ">=": "≥" }[m[2]] || m[2];
  const flip = { "<": ">", ">": "<", "≤": "≥", "≥": "≤" };
  const v = L.v;
  const bound = -b / a;
  const final = a < 0 ? flip[sign] : sign;
  return [
    `${polyText(L.coeffs, v)} ${sign} ${polyText(R.coeffs, v)}`,
    `Collect terms: ${polyText([0, a], v)} ${sign} ${exactShort(-b)}`.replace(/ -/, " −"),
    a < 0 ? `Divide by ${fmt(a)} (a negative number), so the sign flips.` : `Divide by ${fmt(a)}.`,
    "",
    `So ${v} ${final} ${exact(bound)}.`,
  ].join("\n");
}

// --- Calculus (polynomials) ------------------------------------------------------------------------

function calculus(q) {
  let m = q.match(/^(?:find the )?(?:derivative of|differentiate|d\/dx(?: of)?|diff(?:erentiation)? of)\s*\(?(.+?)\)?(?:\s*(?:with respect to|w\.?r\.?t\.?)\s*[a-z])?$/);
  if (m) {
    const p = parsePolynomial(m[1]);
    if (!p || p.coeffs.length < 2 && !p.coeffs.length) return null;
    const d = p.coeffs.slice(1).map((c, i) => c * (i + 1));
    return `d/d${p.v} [${polyText(p.coeffs, p.v)}] = ${polyText(d.length ? d : [0], p.v)}\n(Power rule: d/d${p.v} of ${p.v}ⁿ is n${p.v}ⁿ⁻¹, and a constant becomes 0.)`;
  }
  m = q.match(/^(?:find the )?(?:integral of|integrate|antiderivative of|∫)\s*\(?(.+?)\)?\s*(?:d[a-z])?(?:\s+from\s+(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?))?$/);
  if (m) {
    const p = parsePolynomial(m[1].replace(/\s*d[a-z]$/, ""));
    if (!p) return null;
    const I = [0, ...p.coeffs.map((c, i) => c / (i + 1))];
    const v = p.v;
    if (m[2] !== undefined) {
      const [a, b] = [Number(m[2]), Number(m[3])];
      const value = evalPoly(I, b) - evalPoly(I, a);
      return `∫ from ${fmt(a)} to ${fmt(b)} of (${polyText(p.coeffs, v)}) d${v}\nAntiderivative F(${v}) = ${polyText(I, v)}\nF(${fmt(b)}) − F(${fmt(a)}) = ${fmt(evalPoly(I, b))} − ${fmt(evalPoly(I, a))} = ${exact(value)}`;
    }
    return `∫ (${polyText(p.coeffs, v)}) d${v} = ${polyText(I, v)} + C\n(Power rule: ∫ ${v}ⁿ d${v} = ${v}ⁿ⁺¹/(n + 1) + C)`;
  }
  return null;
}

// --- Matrices -------------------------------------------------------------------------------------------

function parseMatrix(text) {
  const rows = text.match(/\[([^\[\]]+)\]/g);
  if (!rows) return null;
  const M = rows.map((r) => r.replace(/[\[\]]/g, "").split(/[\s,;]+/).filter(Boolean).map(Number));
  if (!M.length || M.some((r) => r.length !== M.length || r.some(Number.isNaN))) return null;
  return M;
}
function det(M) {
  if (M.length === 1) return M[0][0];
  if (M.length === 2) return M[0][0] * M[1][1] - M[0][1] * M[1][0];
  return M[0].reduce((s, a, j) => s + (j % 2 ? -1 : 1) * a * det(M.slice(1).map((r) => r.filter((_, k) => k !== j))), 0);
}
function matrices(q) {
  const m = q.match(/(determinant|det|inverse)\s*(?:of)?\s*(?:the matrix)?\s*(\[.*\])/);
  if (!m) return null;
  const M = parseMatrix(m[2]);
  if (!M || M.length > 4) return null;
  const D = det(M);
  const show = (A) => A.map((r) => `[ ${r.map((x) => exact(x).split(" ≈")[0]).join("  ")} ]`).join("\n");
  if (m[1] !== "inverse") {
    const how = M.length === 2 ? `(${fmt(M[0][0])})(${fmt(M[1][1])}) − (${fmt(M[0][1])})(${fmt(M[1][0])})` : "expanding along the first row";
    return `${show(M)}\n\nDeterminant = ${how} = ${exact(D)}`;
  }
  if (close(D, 0)) return `${show(M)}\n\nThe determinant is 0, so this matrix has no inverse.`;
  const n = M.length;
  const cof = M.map((row, i) => row.map((_, j) => ((i + j) % 2 ? -1 : 1) * (n === 1 ? 1 : det(M.filter((_, r) => r !== i).map((r) => r.filter((_, k) => k !== j))))));
  const inv = M.map((_, i) => M.map((__, j) => cof[j][i] / D));
  return `${show(M)}\n\nDeterminant = ${exact(D)}\nInverse = (1/det) × adjugate =\n${show(inv)}`;
}

// --- Probability -------------------------------------------------------------------------------------------

function probability(q) {
  if (!/probability|chance|odds/.test(q)) return null;
  const frac = (a, b) => {
    const g = gcd(a, b) || 1;
    return `${a / g}/${b / g} (≈ ${fmt(a / b, 4)}, ${fmt((a / b) * 100, 2)}%)`;
  };
  let m = q.match(/(\d+|two|three) (?:coins?|fair coins?)/);
  const coinsN = m ? ({ two: 2, three: 3 }[m[1]] || Number(m[1])) : /\ba coin|one coin|tossing a coin|toss a coin/.test(q) ? 1 : null;
  if (coinsN && /head|tail/.test(q) && coinsN <= 20) {
    const total = 2 ** coinsN;
    const k = q.match(/(?:exactly |getting |get )?(\d+|one|two|three|no) (?:heads?|tails?)/);
    const words = { no: 0, one: 1, two: 2, three: 3 };
    const choose = (n, r) => { let x = 1; for (let i = 1; i <= r; i++) x = (x * (n - r + i)) / i; return x; };
    if (/at least one head|at least one tail/.test(q)) return `P(at least one) = 1 − P(none) = 1 − 1/${total} = ${frac(total - 1, total)}`;
    if (/all heads|all tails|both heads|both tails/.test(q)) return `There are ${total} equally likely outcomes and only one is all the same: P = ${frac(1, total)}`;
    if (k) {
      const r = words[k[1]] ?? Number(k[1]);
      if (r > coinsN) return `You can't get ${r} from ${coinsN} coin${coinsN > 1 ? "s" : ""}: the probability is 0.`;
      const ways = choose(coinsN, r);
      return `Outcomes with ${coinsN} coin${coinsN > 1 ? "s" : ""}: 2${sup(coinsN)} = ${total}\nWays to get exactly ${r}: ${coinsN}C${r} = ${ways}\nP = ${ways}/${total} = ${frac(ways, total)}`;
    }
    if (coinsN === 1) return `A fair coin has 2 equally likely outcomes, so P(${/tail/.test(q) ? "tail" : "head"}) = ${frac(1, 2)}`;
  }
  if (/dice|die\b/.test(q)) {
    const two = /two dice|2 dice|pair of dice/.test(q);
    m = q.match(/sum (?:of )?(?:is |equal to |=\s*)?(\d+)/);
    if (two && m) {
      const s = Number(m[1]);
      let ways = 0;
      for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b === s) ways++;
      return `Two dice give 6 × 6 = 36 equally likely outcomes.\nWays to make a sum of ${s}: ${ways}\nP = ${ways}/36${ways ? ` = ${frac(ways, 36)}` : " = 0"}`;
    }
    if (two && /doubles?|same number/.test(q)) return `Doubles: (1,1) … (6,6) = 6 of 36 outcomes, P = ${frac(6, 36)}`;
    if (!two) {
      m = q.match(/(?:getting |rolling |roll |a |an )?(\d)\b/);
      if (/even/.test(q)) return `Even numbers on a die: 2, 4, 6 → P = ${frac(3, 6)}`;
      if (/odd/.test(q)) return `Odd numbers on a die: 1, 3, 5 → P = ${frac(3, 6)}`;
      if (/prime/.test(q)) return `Prime numbers on a die: 2, 3, 5 → P = ${frac(3, 6)}`;
      const g = q.match(/(?:greater|more) than (\d)/);
      if (g) {
        const k = 6 - Math.min(6, Number(g[1]));
        return `Numbers greater than ${g[1]} on a die: ${k} of 6 → P = ${k ? frac(k, 6) : "0"}`;
      }
      if (m && Number(m[1]) >= 1 && Number(m[1]) <= 6) return `A die has 6 equally likely faces, so P(${m[1]}) = ${frac(1, 6)}`;
    }
  }
  if (/card|deck|draw|\b(ace|king|queen|jack|hearts?|spades?|diamonds?|clubs?)\b/.test(q)) {
    const table = [
      [/\bace\b/, 4, "aces"], [/\bking\b/, 4, "kings"], [/\bqueen\b/, 4, "queens"], [/\bjack\b/, 4, "jacks"],
      [/face card/, 12, "face cards (J, Q, K)"], [/red (?:card|king|queen|ace)?/, 26, "red cards"], [/black/, 26, "black cards"],
      [/heart/, 13, "hearts"], [/spade/, 13, "spades"], [/diamond/, 13, "diamonds"], [/club/, 13, "clubs"],
    ];
    if (/red (king|queen|jack|ace)/.test(q)) return `There are 2 red ${q.match(/red (king|queen|jack|ace)/)[1]}s in 52 cards, P = ${frac(2, 52)}`;
    if (/(king|queen|jack|ace) of (hearts|spades|diamonds|clubs)/.test(q)) return `There is exactly 1 such card in 52, P = ${frac(1, 52)}`;
    for (const [re, k, name] of table) if (re.test(q)) return `A standard deck has 52 cards, with ${k} ${name}.\nP = ${k}/52 = ${frac(k, 52)}`;
  }
  return null;
}

// --- Numbers in words ----------------------------------------------------------------------------------------

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function below1000(n) {
  const out = [];
  if (n >= 100) {
    out.push(`${ONES[Math.floor(n / 100)]} hundred`);
    n %= 100;
  }
  if (n >= 20) out.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ""));
  else if (n > 0 || !out.length) out.push(ONES[n]);
  return out.join(" ");
}
function indianWords(n) {
  if (n === 0) return "zero";
  const parts = [];
  for (const [value, name] of [[1e7, "crore"], [1e5, "lakh"], [1e3, "thousand"]]) {
    if (n >= value) {
      const k = Math.floor(n / value);
      parts.push(`${value === 1e7 ? indianWords(k) : below1000(k)} ${name}`);
      n %= value;
    }
  }
  if (n) parts.push(below1000(n));
  return parts.join(" ");
}
function internationalWords(n) {
  if (n === 0) return "zero";
  const parts = [];
  for (const [value, name] of [[1e12, "trillion"], [1e9, "billion"], [1e6, "million"], [1e3, "thousand"]]) {
    if (n >= value) {
      parts.push(`${below1000(Math.floor(n / value))} ${name}`);
      n %= value;
    }
  }
  if (n) parts.push(below1000(n));
  return parts.join(" ");
}
function numberWords(q) {
  const m = q.match(/^(?:write |spell |how (?:do you )?(?:write|say|spell) )?(\d{1,15})(?: in words| in english)$|^(?:write |spell )(\d{1,15})$|^number (\d{1,15}) in words$/);
  if (!m) return null;
  const n = Number(m[1] || m[2] || m[3]);
  if (!Number.isSafeInteger(n)) return null;
  const indian = indianWords(n);
  const intl = internationalWords(n);
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  return indian === intl ? `${fmt(n)}: ${cap(indian)}.` : `${fmt(n)}\n- Indian system: ${cap(indian)}.\n- International system: ${cap(intl)}.`;
}

// --- Expanding brackets (one letter) and standard identities -----------------------------

const polyMul = (A, B) => {
  const out = Array(A.length + B.length - 1).fill(0);
  A.forEach((a, i) => B.forEach((b, j) => (out[i + j] += a * b)));
  return out;
};
const polyAdd = (A, B, sign = 1) => Array.from({ length: Math.max(A.length, B.length) }, (_, i) => (A[i] || 0) + sign * (B[i] || 0));

// Parses "(x+2)(x-3)", "(2x+1)^3", "3(x-1)^2 + 4x" into coefficients.
function parsePolyExpression(src, v) {
  const tokens = src.replace(/\s+/g, "").match(/\d+(?:\.\d+)?|[a-z]|[-+*^()]/g);
  if (!tokens || tokens.join("") !== src.replace(/\s+/g, "")) return null;
  const withTimes = [];
  for (const t of tokens) {
    const prev = withTimes[withTimes.length - 1];
    if (prev !== undefined && /^([\d.]+|[a-z]|\))$/.test(prev) && /^([a-z]|\()$/.test(t)) withTimes.push("*");
    withTimes.push(t);
  }
  let i = 0;
  const peek = () => withTimes[i];
  const next = () => withTimes[i++];
  function primary() {
    const t = next();
    if (t === "(") {
      const e = sum();
      if (next() !== ")") throw new Error("bracket");
      return e;
    }
    if (t === "-") return polyMul([-1], power());
    if (/^[\d.]+$/.test(t)) return [Number(t)];
    if (t === v) return [0, 1];
    throw new Error("token");
  }
  function power() {
    let b = primary();
    if (peek() === "^") {
      next();
      const e = next();
      if (!/^\d+$/.test(e) || Number(e) > 12) throw new Error("power");
      let out = [1];
      for (let k = 0; k < Number(e); k++) out = polyMul(out, b);
      b = out;
    }
    return b;
  }
  function product() {
    let p = power();
    while (peek() === "*") {
      next();
      p = polyMul(p, power());
    }
    return p;
  }
  function sum() {
    let p = product();
    while (peek() === "+" || peek() === "-") {
      const sign = next() === "+" ? 1 : -1;
      p = polyAdd(p, product(), sign);
    }
    return p;
  }
  try {
    const out = sum();
    return i === withTimes.length ? out : null;
  } catch {
    return null;
  }
}

const IDENTITIES = [
  [/^\(a\s*\+\s*b\)\s*\^\s*2$|a plus b (?:whole )?squared?|a plus b whole square/, "(a + b)² = a² + 2ab + b²"],
  [/^\(a\s*-\s*b\)\s*\^\s*2$|a minus b (?:whole )?squared?|a minus b whole square/, "(a − b)² = a² − 2ab + b²"],
  [/^a\s*\^\s*2\s*-\s*b\s*\^\s*2$|a square minus b square|a squared minus b squared/, "a² − b² = (a + b)(a − b)"],
  [/^a\s*\^\s*2\s*\+\s*b\s*\^\s*2$|a square plus b square|a squared plus b squared/, "a² + b² = (a + b)² − 2ab = (a − b)² + 2ab"],
  [/^\(a\s*\+\s*b\)\s*\^\s*3$|a plus b (?:whole )?cubed?|a plus b whole cube/, "(a + b)³ = a³ + 3a²b + 3ab² + b³ = a³ + b³ + 3ab(a + b)"],
  [/^\(a\s*-\s*b\)\s*\^\s*3$|a minus b (?:whole )?cubed?|a minus b whole cube/, "(a − b)³ = a³ − 3a²b + 3ab² − b³ = a³ − b³ − 3ab(a − b)"],
  [/^a\s*\^\s*3\s*\+\s*b\s*\^\s*3$|a cube plus b cube|a cubed plus b cubed/, "a³ + b³ = (a + b)(a² − ab + b²)"],
  [/^a\s*\^\s*3\s*-\s*b\s*\^\s*3$|a cube minus b cube|a cubed minus b cubed/, "a³ − b³ = (a − b)(a² + ab + b²)"],
  [/^\(a\s*\+\s*b\s*\+\s*c\)\s*\^\s*2$|a plus b plus c (?:whole )?squared?|a plus b plus c whole square/, "(a + b + c)² = a² + b² + c² + 2ab + 2bc + 2ca"],
  [/^\(x\s*\+\s*a\)\s*\(x\s*\+\s*b\)$/, "(x + a)(x + b) = x² + (a + b)x + ab"],
];
function identities(q) {
  const body = q.replace(/^(what is |what's |expand |formula (?:of|for) |identity (?:of|for) )/, "").replace(/\s*(formula|identity|expansion|expand)$/, "").trim();
  for (const [re, text] of IDENTITIES) if (re.test(body)) return text;
  return null;
}

function expand(q) {
  const m = q.match(/^(?:expand|simplify|multiply(?: out)?|multiply|open the brackets(?: in)?)\s*:?\s*(.+)$/) || (/\)\s*(\^|\()/.test(q) && q.match(/^()(.+)$/));
  if (!m) return null;
  const expr = (m[2] || m[1]).trim();
  if (!/[()]/.test(expr) || /=/.test(expr)) return null;
  const letters = new Set(expr.match(/[a-z]/g) || []);
  if (letters.size !== 1) return null;
  const [v] = letters;
  const coeffs = parsePolyExpression(expr, v);
  if (!coeffs) return null;
  return `${expr.replace(/\*/g, "").replace(/\^2/g, "²").replace(/\^3/g, "³")} = ${polyText(coeffs, v)}`;
}

export function solveHigherMaths(q) {
  const special = identities(q) || expand(q);
  if (special) return special;
  return polynomialEquation(q) || calculus(q) || matrices(q) || probability(q) || numberWords(q) || inequality(q);
}
