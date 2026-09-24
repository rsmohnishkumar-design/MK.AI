// MK.ai's own maths solver: school and competitive-exam problems, solved step
// by step with exact answers where possible. Every solver takes the cleaned
// question and returns a written answer, or null when it isn't its kind of
// problem. No outside service is used.

// --- Numbers and formatting ---------------------------------------------------------

const NUM = String.raw`-?\d+(?:\.\d+)?`;

// 1234.5 → "1,234.5", -3 → "−3" (up to `digits` decimals, Indian grouping)
export function fmt(n, digits = 4) {
  if (!Number.isFinite(n)) return String(n);
  const r = Math.round(n * 10 ** digits) / 10 ** digits;
  const s = Math.abs(r).toLocaleString("en-IN", { maximumFractionDigits: digits });
  return (r < 0 ? "−" : "") + s;
}
const paren = (n) => (n < 0 ? `(${fmt(n)})` : fmt(n));
// "x", "−x", "3x": a coefficient of 1 isn't written
const lead = (c, v) => (c === 1 ? v : c === -1 ? `−${v}` : `${fmt(c)}${v}`);
// " + 2y", " − y"
const then = (c, v) => ` ${c < 0 ? "−" : "+"} ${Math.abs(c) === 1 ? v : `${fmt(Math.abs(c))}${v}`}`;
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const isInt = (n) => Number.isInteger(n);

export function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
const lcm2 = (a, b) => (a && b ? Math.abs(a * b) / gcd(a, b) : 0);

export function primeFactors(n) {
  const out = [];
  for (let p = 2; p * p <= n; p++) {
    while (n % p === 0) {
      out.push(p);
      n /= p;
    }
  }
  if (n > 1) out.push(n);
  return out;
}
const powerForm = (factors) => {
  const counts = new Map();
  factors.forEach((p) => counts.set(p, (counts.get(p) || 0) + 1));
  return [...counts].map(([p, k]) => (k > 1 ? `${p}${sup(k)}` : `${p}`)).join(" × ");
};
const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "-": "⁻" };
const sup = (n) => String(n).split("").map((c) => SUP[c] || c).join("");

// Exact fractions (for integer inputs).
function frac(n, d = 1) {
  if (d === 0) throw new Error("division by zero");
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
const fracOps = {
  "+": (a, b) => frac(a.n * b.d + b.n * a.d, a.d * b.d),
  "-": (a, b) => frac(a.n * b.d - b.n * a.d, a.d * b.d),
  "*": (a, b) => frac(a.n * b.n, a.d * b.d),
  "/": (a, b) => frac(a.n * b.d, a.d * b.n),
};
function fracText(f) {
  if (f.d === 1) return fmt(f.n);
  const text = `${f.n < 0 ? "−" : ""}${Math.abs(f.n)}/${f.d}`;
  if (Math.abs(f.n) > f.d) {
    const whole = Math.trunc(f.n / f.d);
    return `${text} = ${whole < 0 ? "−" : ""}${Math.abs(whole)} ${Math.abs(f.n) % f.d}/${f.d}`;
  }
  return text;
}
// A decimal that is really a simple fraction: 0.75 → 3/4
function asFraction(x) {
  if (isInt(x)) return null;
  for (let d = 2; d <= 1000; d++) {
    const n = Math.round(x * d);
    if (close(n / d, x)) return frac(n, d);
  }
  return null;
}

// --- Expressions with variables (for equations) ----------------------------------------

// Parses "3(x - 2) + x/4 = 5"-style text into a function of the variables.
function parseExpression(src) {
  const tokens = [];
  const re = /\s*(\d+(?:\.\d+)?|[a-z]|[-+*/^()])/gy;
  let m;
  let at = 0;
  while (at < src.length) {
    re.lastIndex = at;
    m = re.exec(src);
    if (!m) return null;
    tokens.push(m[1]);
    at = re.lastIndex;
    while (at < src.length && src[at] === " ") at++;
  }
  // Implicit multiplication: 2x, 3(x+1), (x+1)(x-1), x(x+2)
  const withTimes = [];
  tokens.forEach((t, i) => {
    const prev = withTimes[withTimes.length - 1];
    const prevIsValue = prev !== undefined && (/^[\d.]+$/.test(prev) || /^[a-z]$/.test(prev) || prev === ")");
    const thisStartsValue = /^[a-z]$/.test(t) || t === "(" || (/^[\d.]+$/.test(t) && /^[a-z)]$/.test(prev || ""));
    if (prevIsValue && thisStartsValue) withTimes.push("*");
    withTimes.push(t);
  });
  let i = 0;
  const peek = () => withTimes[i];
  const next = () => withTimes[i++];
  const vars = new Set();
  function primary() {
    const t = next();
    if (t === undefined) throw new Error("end");
    if (t === "(") {
      const v = sum();
      if (next() !== ")") throw new Error("bracket");
      return v;
    }
    if (t === "-") {
      const v = power();
      return (env) => -v(env);
    }
    if (t === "+") return power();
    if (/^[\d.]+$/.test(t)) {
      const n = Number(t);
      return () => n;
    }
    if (/^[a-z]$/.test(t)) {
      vars.add(t);
      return (env) => env[t];
    }
    throw new Error("token");
  }
  function power() {
    const base = primary();
    if (peek() === "^") {
      next();
      const exp = power();
      return (env) => Math.pow(base(env), exp(env));
    }
    return base;
  }
  function product() {
    let v = power();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const l = v;
      const r = power();
      v = op === "*" ? (env) => l(env) * r(env) : (env) => l(env) / r(env);
    }
    return v;
  }
  function sum() {
    let v = product();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const l = v;
      const r = product();
      v = op === "+" ? (env) => l(env) + r(env) : (env) => l(env) - r(env);
    }
    return v;
  }
  try {
    const f = sum();
    if (i !== withTimes.length) return null;
    return { f, vars };
  } catch {
    return null;
  }
}

// "2x + 3 = 11" → { f: (env) => left - right, vars }
function parseEquation(text) {
  const sides = text.split("=");
  if (sides.length !== 2 || !sides[0].trim() || !sides[1].trim()) return null;
  const L = parseExpression(sides[0].trim());
  const R = parseExpression(sides[1].trim());
  if (!L || !R) return null;
  return { f: (env) => L.f(env) - R.f(env), vars: new Set([...L.vars, ...R.vars]), text: text.trim() };
}

const pretty = (s) =>
  s
    .replace(/\*/g, " × ")
    .replace(/\^2/g, "²")
    .replace(/\^3/g, "³")
    .replace(/\s*([+=])\s*/g, " $1 ")
    .replace(/(\S)-(\S)/g, "$1 − $2")
    .replace(/\s+-\s+/g, " − ")
    .replace(/\s+/g, " ")
    .trim();

// A number as an exact fraction when it is one, else a decimal.
export function exact(x) {
  if (isInt(Math.round(x * 1e9) / 1e9)) return fmt(Math.round(x));
  const f = asFraction(x);
  return f ? `${f.n < 0 ? "−" : ""}${Math.abs(f.n)}/${f.d} ≈ ${fmt(x)}` : fmt(x);
}

// One unknown, degree 1 or 2.
function solveOneVariable(eq) {
  const [v] = [...eq.vars];
  const f = (x) => eq.f({ [v]: x });
  const c = f(0);
  const a = (f(1) + f(-1)) / 2 - c;
  const b = (f(1) - f(-1)) / 2;
  const fits = [2, 3, -2, 0.5].every((x) => close(f(x), a * x * x + b * x + c));
  if (![a, b, c].every(Number.isFinite) || !fits) return null;
  const lines = [pretty(eq.text)];
  if (close(a, 0)) {
    if (close(b, 0)) return close(c, 0) ? `${pretty(eq.text)}\n\nThis is true for every value of ${v}.` : `${pretty(eq.text)}\n\nThis equation has no solution.`;
    const x = -c / b;
    lines.push(
      `Collect the ${v} terms on one side and the numbers on the other:`,
      `${lead(b, v)} = ${fmt(-c)}`,
      ...(close(b, 1) ? [] : [`${v} = ${fmt(-c)} ÷ ${paren(b)}`]),
      "",
      `So ${v} = ${exact(x)}.`,
      `Check: putting ${v} = ${fmt(x)} into the equation, both sides are equal ✓`
    );
    return lines.join("\n");
  }
  const disc = b * b - 4 * a * c;
  lines.push(
    `Written as a quadratic: ${lead(a, v)}²${close(b, 0) ? "" : then(b, v)}${close(c, 0) ? "" : ` ${c < 0 ? "−" : "+"} ${fmt(Math.abs(c))}`} = 0`,
    `Discriminant: b² − 4ac = ${fmt(disc)}`
  );
  if (disc < -1e-12) return [...lines, "", "The discriminant is negative, so there are no real solutions."].join("\n");
  if (Math.abs(disc) <= 1e-12) return [...lines, "", `One repeated solution: ${v} = ${exact(-b / (2 * a))}.`].join("\n");
  const r1 = (-b + Math.sqrt(disc)) / (2 * a);
  const r2 = (-b - Math.sqrt(disc)) / (2 * a);
  const surd = !isInt(Math.sqrt(disc)) && isInt(disc) && isInt(a) && isInt(b) ? ` (exactly (${fmt(-b)} ± √${fmt(disc)})/${fmt(2 * a)})` : "";
  return [...lines, `${v} = (−b ± √(b² − 4ac)) / 2a`, "", `So ${v} = ${exact(r1)} or ${v} = ${exact(r2)}${surd}.`].join("\n");
}

// Two unknowns, two linear equations (Cramer's rule).
function solveTwoVariables(e1, e2) {
  const vars = [...new Set([...e1.vars, ...e2.vars])].sort();
  if (vars.length !== 2) return null;
  const [p, q] = vars;
  const coeffs = (eq) => {
    const g = (x, y) => eq.f({ [p]: x, [q]: y });
    const c = g(0, 0);
    const a = g(1, 0) - c;
    const b = g(0, 1) - c;
    const linear = [[2, 3], [-1, 4], [0.5, -2]].every(([x, y]) => close(g(x, y), a * x + b * y + c));
    return linear ? { a, b, k: -c } : null;
  };
  const A = coeffs(e1);
  const B = coeffs(e2);
  if (!A || !B) return null;
  const D = A.a * B.b - A.b * B.a;
  const lines = [
    "Written as:",
    `(1)  ${lead(A.a, p)}${then(A.b, q)} = ${fmt(A.k)}`,
    `(2)  ${lead(B.a, p)}${then(B.b, q)} = ${fmt(B.k)}`,
  ];
  if (close(D, 0)) {
    const same = close(A.a * B.k - B.a * A.k, 0) && close(A.b * B.k - B.b * A.k, 0);
    return [...lines, "", same ? "The two equations are the same line, so there are infinitely many solutions." : "The two lines are parallel, so there is no solution."].join("\n");
  }
  const x = (A.k * B.b - A.b * B.k) / D;
  const y = (A.a * B.k - A.k * B.a) / D;
  lines.push(
    `Determinant D = (${fmt(A.a)})(${fmt(B.b)}) − (${fmt(A.b)})(${fmt(B.a)}) = ${fmt(D)}`,
    `${p} = (${fmt(A.k)}×${paren(B.b)} − ${paren(A.b)}×${paren(B.k)}) ÷ ${paren(D)} = ${exact(x)}`,
    `${q} = (${fmt(A.a)}×${paren(B.k)} − ${paren(A.k)}×${paren(B.a)}) ÷ ${paren(D)} = ${exact(y)}`,
    "",
    `So ${p} = ${exact(x)} and ${q} = ${exact(y)}.`,
    `Check: (1) ${fmt(A.a * x + A.b * y)} = ${fmt(A.k)} ✓  (2) ${fmt(B.a * x + B.b * y)} = ${fmt(B.k)} ✓`
  );
  return lines.join("\n");
}

function equations(q) {
  if (!q.includes("=")) return null;
  const body = q
    .replace(/^(please )?(solve|find|calculate|what is|what's)( the value of [a-z]( and [a-z])?)?( for [a-z])?:?\s*/, "")
    .replace(/\b(find|solve for|what is|what are) [a-z]( and [a-z])?\s*$/, "")
    .replace(/[?.]+$/, "")
    .trim();
  const parts = body.split(/\s*(?:,|;|\band\b|\n)\s*/).filter((p) => p.includes("="));
  if (parts.length === 1) {
    const eq = parseEquation(parts[0]);
    if (!eq || eq.vars.size !== 1) return null;
    return solveOneVariable(eq);
  }
  if (parts.length === 2) {
    const e1 = parseEquation(parts[0]);
    const e2 = parseEquation(parts[1]);
    if (!e1 || !e2) return null;
    return solveTwoVariables(e1, e2);
  }
  return null;
}

// --- Fractions ------------------------------------------------------------------------

// "1/2 + 3/4", "2/3 × 3/5", "5/6 - 1/4" (integers only), exact.
function fractions(q) {
  const expr = q.replace(/^(what is|what's|calculate|simplify|add|find)\s+/, "").replace(/[?=]+$/, "").trim();
  if (!/\d+\s*\/\s*\d+/.test(expr) || !/^[\d\s+\-*/()]+$/.test(expr)) return null;
  if ((expr.match(/\//g) || []).length < 2 && !/[+\-*]/.test(expr.replace(/^-/, ""))) {
    // a single fraction: simplify it (a plain "10 / 4" is left to the calculator)
    const m = expr.match(/^(-?\d+)\s*\/\s*(\d+)$/);
    if (!m || !/simplif|simplest|lowest terms|fraction/.test(q)) return null;
    const f = frac(Number(m[1]), Number(m[2]));
    return `${m[1]}/${m[2]} in its simplest form is ${fracText(f)}${f.d !== 1 ? ` (≈ ${fmt(f.n / f.d)})` : ""}.`;
  }
  const tokens = expr.match(/\d+|[+\-*/()]/g);
  if (!tokens || tokens.join("") !== expr.replace(/\s+/g, "")) return null;
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  function primary() {
    const t = next();
    if (t === "(") {
      const v = sum();
      if (next() !== ")") throw new Error("bracket");
      return v;
    }
    if (t === "-") return fracOps["-"](frac(0), primary());
    if (/^\d+$/.test(t)) return frac(Number(t));
    throw new Error("token");
  }
  function product() {
    let v = primary();
    while (peek() === "*" || peek() === "/") v = fracOps[next()](v, primary());
    return v;
  }
  function sum() {
    let v = product();
    while (peek() === "+" || peek() === "-") v = fracOps[next()](v, product());
    return v;
  }
  try {
    const result = sum();
    if (i !== tokens.length) return null;
    return `${pretty(expr).replace(/\//g, "/")} = ${fracText(result)}${result.d !== 1 ? `  (≈ ${fmt(result.n / result.d)})` : ""}`;
  } catch {
    return null;
  }
}

// --- Number theory ---------------------------------------------------------------------

const numbersIn = (s) => (s.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);

function hcfLcm(q) {
  const m = q.match(/\b(hcf|gcd|gcf|lcm|highest common factor|greatest common (?:divisor|factor)|lowest common multiple|least common multiple)\s*(?:and (?:hcf|lcm)\s*)?(?:of\s*)?(.*)$/);
  if (!m) return null;
  const nums = numbersIn(m[2]).filter((n) => isInt(n) && n > 0);
  if (nums.length < 2 || nums.length > 10) return null;
  const wantsBoth = /hcf and lcm|lcm and hcf|gcd and lcm|lcm and gcd/.test(q);
  const isL = /lcm|lowest|least/.test(m[1]);
  const h = nums.reduce(gcd);
  const l = nums.reduce(lcm2);
  const lines = nums.map((n) => `${n} = ${n === 1 ? "1" : powerForm(primeFactors(n))}`);
  const out = [`Prime factors:`, ...lines.map((x) => `- ${x}`), ""];
  if (wantsBoth || !isL) out.push(`HCF (common primes, lowest powers) = ${fmt(h)}`);
  if (wantsBoth || isL) out.push(`LCM (all primes, highest powers) = ${fmt(l)}`);
  if (nums.length === 2 && wantsBoth) out.push(`Check: HCF × LCM = ${fmt(h * l)} = ${nums[0]} × ${nums[1]} ✓`);
  return out.join("\n");
}

function primes(q) {
  let m = q.match(/^is (\d+) (?:a )?prime(?: number)?$/);
  if (m) {
    const n = Number(m[1]);
    if (n < 2) return `No, ${n} is not a prime number. Prime numbers start from 2.`;
    const f = primeFactors(n);
    return f.length === 1 ? `Yes, ${n} is a prime number: its only factors are 1 and ${n}.` : `No, ${n} is not prime: ${n} = ${powerForm(f)}, so it is divisible by ${f[0]}.`;
  }
  m = q.match(/prime numbers? (?:between|from) (\d+) (?:and|to) (\d+)/);
  if (m) {
    const [lo, hi] = [Number(m[1]), Number(m[2])].sort((a, b) => a - b);
    if (hi - lo > 5000) return null;
    const list = [];
    for (let n = Math.max(2, lo); n <= hi; n++) if (primeFactors(n).length === 1) list.push(n);
    return list.length ? `There are ${list.length} prime numbers between ${lo} and ${hi}:\n${list.join(", ")}` : `There are no prime numbers between ${lo} and ${hi}.`;
  }
  m = q.match(/first (\d+) prime numbers?/);
  if (m) {
    const count = Number(m[1]);
    if (count > 500) return null;
    const list = [];
    for (let n = 2; list.length < count; n++) if (primeFactors(n).length === 1) list.push(n);
    return `The first ${count} prime numbers are:\n${list.join(", ")}`;
  }
  m = q.match(/prime factori[sz]ation of (\d+)|prime factors of (\d+)|factori[sz]e (\d+)/);
  if (m) {
    const n = Number(m[1] || m[2] || m[3]);
    if (n < 2 || n > 1e12) return null;
    const f = primeFactors(n);
    return `${n} = ${f.join(" × ")}${f.length > 1 ? `\n= ${powerForm(f)}` : ` (${n} is prime)`}`;
  }
  m = q.match(/^(?:what are )?(?:the )?(?:all )?factors of (\d+)$/);
  if (m) {
    const n = Number(m[1]);
    if (n < 1 || n > 1e9) return null;
    const small = [];
    const large = [];
    for (let d = 1; d * d <= n; d++) {
      if (n % d === 0) {
        small.push(d);
        if (d * d !== n) large.unshift(n / d);
      }
    }
    const all = [...small, ...large];
    return `The factors of ${n} are: ${all.join(", ")} (${all.length} factors).`;
  }
  m = q.match(/^(?:first )?(\d+) multiples of (\d+)$|^(?:first )?multiples of (\d+)$/);
  if (m) {
    const count = Number(m[1] || 10);
    const n = Number(m[2] || m[3]);
    if (count > 100) return null;
    return `The first ${count} multiples of ${n} are: ${Array.from({ length: count }, (_, i) => n * (i + 1)).join(", ")}.`;
  }
  return null;
}

function checks(q) {
  let m = q.match(/^is (\d+) (?:a )?perfect (square|cube)$/);
  if (m) {
    const n = Number(m[1]);
    const r = m[2] === "square" ? Math.round(Math.sqrt(n)) : Math.round(Math.cbrt(n));
    const yes = (m[2] === "square" ? r * r : r * r * r) === n;
    return yes ? `Yes, ${n} is a perfect ${m[2]}: ${r}${m[2] === "square" ? "²" : "³"} = ${n}.` : `No, ${n} is not a perfect ${m[2]}.`;
  }
  m = q.match(/^is (-?\d+) (?:an? )?(even|odd)(?: number)?$/);
  if (m) {
    const n = Number(m[1]);
    const even = n % 2 === 0;
    return `${(m[2] === "even") === even ? "Yes" : "No"}, ${n} is ${even ? "even" : "odd"}${even ? " (it divides by 2 exactly)" : " (dividing by 2 leaves remainder 1)"}.`;
  }
  m = q.match(/^is (\d+) divisible by (\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (!b) return null;
    return a % b === 0 ? `Yes: ${a} ÷ ${b} = ${a / b} exactly.` : `No: ${a} ÷ ${b} = ${Math.floor(a / b)} remainder ${a % b}.`;
  }
  m = q.match(/^(?:what is )?(?:the )?remainder (?:when )?(\d+) (?:is )?divided by (\d+)$|^(\d+) mod (\d+)$/);
  if (m) {
    const a = Number(m[1] || m[3]);
    const b = Number(m[2] || m[4]);
    if (!b) return null;
    return `${a} ÷ ${b} = ${Math.floor(a / b)} remainder ${a % b}.`;
  }
  return null;
}

function factorial(q) {
  const m = q.match(/^(?:what is )?(\d+)\s*!$|factorial (?:of )?(\d+)|(\d+) factorial/);
  if (!m) return null;
  const n = Number(m[1] || m[2] || m[3]);
  if (n > 170) return null;
  let big = 1n;
  for (let k = 2n; k <= BigInt(n); k++) big *= k;
  const shown = n <= 10 ? ` = ${Array.from({ length: n }, (_, i) => n - i).join(" × ") || "1"}` : "";
  return `${n}!${shown} = ${big.toLocaleString("en-IN")}`;
}

// 2^100, 3 to the power 50: exact with big integers.
function bigPower(q) {
  const m = q.match(/^(?:what is |calculate )?(\d+)\s*(?:\^|\*\*|to the power(?: of)?|raised to(?: the power(?: of)?)?)\s*(\d+)$/);
  if (!m) return null;
  const [b, e] = [BigInt(m[1]), BigInt(m[2])];
  if (e > 2000n || (Number(m[1]) ** Number(m[2]) < 1e15 && Number(m[2]) < 60)) return null; // small ones: normal maths
  const value = b ** e;
  const digits = value.toString();
  return `${m[1]}^${m[2]} = ${digits.length > 60 ? `${digits.slice(0, 60)}… (${digits.length} digits)` : value.toLocaleString("en-IN")}`;
}

export function solveNumbers(q) {
  return hcfLcm(q) || primes(q) || checks(q) || factorial(q) || bigPower(q) || fractions(q);
}

export function solveEquations(q) {
  return equations(q);
}

// Normalises a question for the solvers.
export function cleanMaths(question) {
  return question
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    // 1,000 or 1,00,000 → plain digits, but not a point like (10,200)
    .replace(/\b\d{1,3}(?:,\d{2,3})+\b/g, (m, at, all) =>
      /^\d{1,3}(,\d{3})+$|^\d{1,2}(,\d{2})*,\d{3}$/.test(m) && !(all[at - 1] === "(" || /^\s*\)/.test(all.slice(at + m.length))) ? m.replace(/,/g, "") : m
    )
    .replace(/\s+/g, " ")
    .replace(/\?+$/, "")
    .replace(/(\D)!+$/, "$1") // "!" after a number is a factorial
    .replace(/\.$/, "")
    .trim();
}
