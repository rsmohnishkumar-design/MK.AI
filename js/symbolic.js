// Nova AI's symbolic maths core: reads expressions like "x² sin x" or
// "e^(2x)/(1 + x)" into a tree, and can simplify, print, evaluate,
// differentiate and integrate them, and turn polynomials into coefficient
// lists. Everything runs here in the browser; mathadvanced.js uses it to
// answer calculus, algebra and other higher maths questions.

// --- Exact fractions ------------------------------------------------------------------------------

const igcd = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};

// A number node: p/q when exact, or an approximate decimal (q = 1, approx).
export function num(p, q = 1) {
  if (!Number.isFinite(p) || !Number.isFinite(q) || q === 0) return { t: "n", p: p / q, q: 1, approx: true };
  if (!Number.isInteger(p) || !Number.isInteger(q)) {
    // 0.25 → 1/4 when it's a short decimal, else keep it as a decimal
    const v = p / q;
    for (let d = 1; d <= 1000; d++) {
      if (Math.abs(Math.round(v * d) - v * d) < 1e-9 * Math.max(1, Math.abs(v))) return num(Math.round(v * d), d);
    }
    for (const d of [10000, 100000, 1000000]) {
      if (Math.abs(Math.round(v * d) - v * d) < 1e-9) return num(Math.round(v * d), d);
    }
    return { t: "n", p: v, q: 1, approx: true };
  }
  if (q < 0) [p, q] = [-p, -q];
  const g = igcd(p, q) || 1;
  p /= g;
  q /= g;
  if (!Number.isSafeInteger(p) || !Number.isSafeInteger(q)) return { t: "n", p: p / q, q: 1, approx: true };
  return { t: "n", p, q };
}
const val = (n) => n.p / n.q;
const nadd = (a, b) => (a.approx || b.approx ? num(val(a) + val(b)) : num(a.p * b.q + b.p * a.q, a.q * b.q));
const nmul = (a, b) => (a.approx || b.approx ? num(val(a) * val(b)) : num(a.p * b.p, a.q * b.q));
const isNum = (n, v) => n.t === "n" && (v === undefined || (!n.approx && n.p === v && n.q === 1) || (n.approx && n.p === v));
const isInt = (n) => n.t === "n" && !n.approx && n.q === 1;

// --- Tree nodes ------------------------------------------------------------------------------------

export const V = (n) => ({ t: "v", n });
export const C = (n) => ({ t: "c", n }); // "pi" or "e"
export const add = (...xs) => ({ t: "+", xs });
export const mul = (...xs) => ({ t: "*", xs });
export const pow = (b, e) => ({ t: "^", b, e });
export const fn = (f, a) => ({ t: "f", f, a });
export const neg = (x) => mul(num(-1), x);
export const sub = (a, b) => add(a, neg(b));
export const div = (a, b) => mul(a, pow(b, num(-1)));
const E = C("e");

// --- Reading expressions ------------------------------------------------------------------------------

const FUNCS = ["arcsin", "arccos", "arctan", "asin", "acos", "atan", "sinh", "cosh", "tanh", "cosec", "sin", "cos", "tan", "cot", "sec", "csc", "log", "ln", "exp", "sqrt", "cbrt", "abs"];
const ALIAS = { asin: "arcsin", acos: "arccos", atan: "arctan", csc: "cosec" };
const SUPER = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };

function tokenize(text) {
  const s = text
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/π/g, " pi ")
    .replace(/√/g, " sqrt ")
    .replace(/∛/g, " cbrt ")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (m) => "^(" + [...m].map((c) => SUPER[c]).join("") + ")")
    .replace(/\*\*/g, "^")
    .replace(/\bof\b/g, " ");
  const out = [];
  const re = /\s*(\d+\.?\d*|\.\d+|[a-z]+|[-+*/^()|,])/y;
  let i = 0;
  while (i < s.length) {
    if (/^\s*$/.test(s.slice(i))) break;
    re.lastIndex = i;
    const m = re.exec(s);
    if (!m) return null;
    i = re.lastIndex;
    const tok = m[1];
    if (/^[a-z]+$/.test(tok)) {
      // split "sinx" → sin x, "xy" → x y, "pi" stays
      let w = tok;
      while (w) {
        const f = FUNCS.find((name) => w.startsWith(name)) || (w.startsWith("pi") ? "pi" : null);
        if (f) {
          out.push({ k: f === "pi" ? "const" : "fn", v: ALIAS[f] || f });
          w = w.slice(f.length);
        } else {
          out.push(w[0] === "e" ? { k: "const", v: "e" } : { k: "var", v: w[0] });
          w = w.slice(1);
        }
      }
    } else if (/^[\d.]/.test(tok)) out.push({ k: "num", v: tok });
    else out.push({ k: "op", v: tok });
  }
  return out;
}

// opts.imaginary: read "i" as the imaginary unit (complex numbers)
export function parse(text, opts = {}) {
  const toks = tokenize(text);
  if (!toks || !toks.length) return null;
  let i = 0;
  let absDepth = 0;
  const peek = () => toks[i];
  const isOp = (v) => peek() && peek().k === "op" && peek().v === v;
  const startsAtom = () => {
    const t = peek();
    if (!t) return false;
    if (t.k !== "op") return true;
    return t.v === "(" || (t.v === "|" && absDepth === 0);
  };
  const leaf = (t) => {
    if (t.k === "num") return num(Number(t.v));
    if (t.k === "const") return C(t.v);
    if (t.v === "i" && opts.imaginary) return { t: "i" };
    return V(t.v);
  };

  function expr() {
    let left = term();
    while (isOp("+") || isOp("-")) {
      const op = toks[i++].v;
      const right = term();
      left = op === "+" ? add(left, right) : sub(left, right);
    }
    return left;
  }
  function term() {
    let left = unary();
    for (;;) {
      if (isOp("*")) {
        i++;
        left = mul(left, unary());
      } else if (isOp("/")) {
        i++;
        left = div(left, unary());
      } else if (startsAtom()) left = mul(left, power());
      else return left;
    }
  }
  function unary() {
    if (isOp("-")) {
      i++;
      return neg(unary());
    }
    if (isOp("+")) {
      i++;
      return unary();
    }
    return power();
  }
  function power() {
    const base = atom();
    if (isOp("^")) {
      i++;
      return pow(base, unary());
    }
    return base;
  }
  function atom() {
    const t = toks[i++];
    if (!t) throw new Error("end");
    if (t.k === "op") {
      if (t.v === "(") {
        const e = expr();
        if (!isOp(")")) throw new Error(")");
        i++;
        return e;
      }
      if (t.v === "|") {
        absDepth++;
        const e = expr();
        absDepth--;
        if (!isOp("|")) throw new Error("|");
        i++;
        return fn("abs", e);
      }
      throw new Error("op");
    }
    if (t.k === "fn") return func(t.v);
    return leaf(t);
  }
  function func(name) {
    let power = null;
    if (isOp("^")) {
      i++;
      const neg1 = isOp("-") && toks[i + 1] && toks[i + 1].v === "1";
      if (neg1) {
        i += 2;
        if (["sin", "cos", "tan"].includes(name)) name = "arc" + name;
        else throw new Error("inverse");
      } else if (isOp("(")) {
        power = atom();
      } else {
        const t = toks[i++];
        if (!t || t.k !== "num") throw new Error("power");
        power = num(Number(t.v));
      }
    }
    let arg;
    if (isOp("(")) {
      i++;
      arg = expr();
      if (!isOp(")")) throw new Error(")");
      i++;
      // "sin(x)^2"
      if (isOp("^") && !power) {
        i++;
        power = unary();
      }
    } else {
      // "sin 2x", "ln x²": a short run of numbers and letters
      let sign = 1;
      if (isOp("-")) {
        i++;
        sign = -1;
      }
      const part = () => {
        const t = toks[i++];
        if (!t || t.k === "op" || t.k === "fn") throw new Error("arg");
        let b = leaf(t);
        if (isOp("^")) {
          i++;
          b = pow(b, unary());
        }
        return b;
      };
      arg = part();
      while (peek() && (peek().k === "var" || peek().k === "const" || peek().k === "num")) arg = mul(arg, part());
      if (sign < 0) arg = neg(arg);
    }
    let node = name === "sqrt" ? pow(arg, num(1, 2)) : name === "cbrt" ? pow(arg, num(1, 3)) : name === "exp" ? pow(E, arg) : fn(name, arg);
    if (power) node = pow(node, power);
    return node;
  }

  try {
    const tree = expr();
    if (i !== toks.length) return null;
    return tree;
  } catch {
    return null;
  }
}

// --- Looking at trees ---------------------------------------------------------------------------------

export function vars(node, out = new Set()) {
  if (node.t === "v") out.add(node.n);
  else if (node.t === "+" || node.t === "*") node.xs.forEach((x) => vars(x, out));
  else if (node.t === "^") {
    vars(node.b, out);
    vars(node.e, out);
  } else if (node.t === "f") vars(node.a, out);
  return out;
}
export const has = (node, v) => vars(node).has(v);
export function hasFn(node) {
  if (node.t === "f") return true;
  if (node.t === "c") return true;
  if (node.t === "+" || node.t === "*") return node.xs.some(hasFn);
  if (node.t === "^") return hasFn(node.b) || hasFn(node.e) || !isNum(node.e) || (node.e.q !== 1 && !node.e.approx);
  return false;
}

export function substitute(node, v, by) {
  switch (node.t) {
    case "v":
      return node.n === v ? by : node;
    case "+":
    case "*":
      return { t: node.t, xs: node.xs.map((x) => substitute(x, v, by)) };
    case "^":
      return pow(substitute(node.b, v, by), substitute(node.e, v, by));
    case "f":
      return fn(node.f, substitute(node.a, v, by));
    default:
      return node;
  }
}

// --- Numbers from trees -------------------------------------------------------------------------------

const RAD = Math.PI / 180;
// deg: trig functions take degrees and inverse trig gives degrees
export function evaluate(node, env = {}, deg = false) {
  const ev = (n) => evaluate(n, env, deg);
  switch (node.t) {
    case "n":
      return val(node);
    case "v":
      return node.n in env ? env[node.n] : NaN;
    case "c":
      return node.n === "pi" ? Math.PI : Math.E;
    case "+":
      return node.xs.reduce((s, x) => s + ev(x), 0);
    case "*":
      return node.xs.reduce((s, x) => s * ev(x), 1);
    case "^": {
      const b = ev(node.b);
      const e = ev(node.e);
      // real odd roots of negative numbers: ∛(−8) = −2
      if (b < 0 && node.e.t === "n" && !node.e.approx && node.e.q % 2 === 1 && node.e.q > 1) return (node.e.p % 2 ? -1 : 1) * Math.abs(b) ** e;
      return b ** e;
    }
    case "f": {
      const a = ev(node.a);
      const r = deg ? a * RAD : a;
      const inv = (x) => (deg ? x / RAD : x);
      switch (node.f) {
        case "sin": return Math.abs(Math.sin(r)) < 1e-15 ? 0 : Math.sin(r);
        case "cos": return Math.abs(Math.cos(r)) < 1e-15 ? 0 : Math.cos(r);
        case "tan": return Math.abs(Math.cos(r)) < 1e-15 ? NaN : Math.tan(r);
        case "cot": return 1 / Math.tan(r);
        case "sec": return 1 / Math.cos(r);
        case "cosec": return 1 / Math.sin(r);
        case "arcsin": return inv(Math.asin(a));
        case "arccos": return inv(Math.acos(a));
        case "arctan": return inv(Math.atan(a));
        case "sinh": return Math.sinh(a);
        case "cosh": return Math.cosh(a);
        case "tanh": return Math.tanh(a);
        case "ln": return Math.log(a);
        case "log": return Math.log10(a);
        case "abs": return Math.abs(a);
      }
    }
  }
  return NaN;
}
export const compile = (node, v, deg = false) => (x) => evaluate(node, { [v]: x }, deg);

// --- Simplifying ----------------------------------------------------------------------------------------

// A number times the rest: 3x² → [3, x²]
function split(term) {
  if (term.t === "n") return [term, null];
  if (term.t === "*") {
    let c = num(1);
    const rest = [];
    for (const x of term.xs) {
      if (x.t === "n") c = nmul(c, x);
      else rest.push(x);
    }
    return [c, rest.length === 0 ? null : rest.length === 1 ? rest[0] : mul(...rest)];
  }
  return [num(1), term];
}
const key = (n) => JSON.stringify(n);
// Order of factors when printing: numbers, letters, brackets, functions.
function rank(x) {
  if (x.t === "n") return 0;
  if (x.t === "v" || x.t === "c") return 1;
  if (x.t === "^") {
    if (x.b.t === "c" && x.b.n === "e") return 1.5;
    return rank(x.b) === 3 ? 3 : rank(x.b);
  }
  if (x.t === "+") return 2;
  return 3;
}

export function simplify(node) {
  switch (node.t) {
    case "n":
    case "v":
    case "c":
    case "i":
      return node;
    case "f":
      return simplifyFn(node.f, simplify(node.a));
    case "^":
      return simplifyPow(simplify(node.b), simplify(node.e));
    case "+":
      return simplifySum(node.xs.map(simplify));
    case "*":
      return simplifyProduct(node.xs.map(simplify));
  }
  return node;
}

function simplifyFn(f, a) {
  if (f === "ln" && a.t === "c" && a.n === "e") return num(1);
  if ((f === "ln" || f === "log") && isNum(a, 1)) return num(0);
  if (f === "log" && isInt(a) && a.p > 0 && Number.isInteger(Math.log10(a.p)) && 10 ** Math.round(Math.log10(a.p)) === a.p) return num(Math.round(Math.log10(a.p)));
  if (f === "ln" && a.t === "^" && a.b.t === "c" && a.b.n === "e") return a.e;
  if (isNum(a, 0) && ["sin", "tan", "arcsin", "arctan", "sinh", "tanh"].includes(f)) return num(0);
  if (isNum(a, 0) && ["cos", "cosh"].includes(f)) return num(1);
  if (f === "abs" && a.t === "n") return num(Math.abs(a.p), a.q);
  if (f === "abs" && a.t === "^" && isInt(a.e) && a.e.p % 2 === 0) return a;
  return fn(f, a);
}

function simplifyPow(b, e) {
  if (isNum(e, 0)) return num(1);
  if (isNum(e, 1)) return b;
  if (isNum(b, 1)) return num(1);
  if (isNum(b, 0) && e.t === "n" && val(e) > 0) return num(0);
  if (b.t === "n" && e.t === "n") {
    if (isInt(e) && Math.abs(e.p) <= 64 && !b.approx) {
      const r = e.p >= 0 ? num(b.p ** e.p, b.q ** e.p) : num(b.q ** -e.p, b.p ** -e.p);
      if (!r.approx) return r;
    }
    if (!e.approx && !b.approx && val(b) > 0) {
      // 8^(2/3) = 4 when the root is exact
      const rootP = Math.round(b.p ** (1 / e.q));
      const rootQ = Math.round(b.q ** (1 / e.q));
      if (rootP ** e.q === b.p && rootQ ** e.q === b.q) return simplifyPow(num(rootP, rootQ), num(e.p));
    }
    if (b.approx || e.approx) return num(val(b) ** val(e));
    return pow(b, e);
  }
  if (b.t === "c" && b.n === "e" && e.t === "f" && e.f === "ln") return e.a;
  if (b.t === "^" && e.t === "n" && b.e.t === "n") return simplifyPow(b.b, nmul(b.e, e));
  if (b.t === "*" && isInt(e)) return simplifyProduct(b.xs.map((x) => simplifyPow(x, e)));
  return pow(b, e);
}

function simplifySum(xs) {
  const flat = [];
  for (const x of xs) {
    if (x.t === "+") flat.push(...x.xs);
    else flat.push(x);
  }
  let constant = num(0);
  const order = [];
  const groups = new Map();
  for (const x of flat) {
    const [c, rest] = split(x);
    if (!rest) {
      constant = nadd(constant, c);
      continue;
    }
    const k = key(rest);
    if (!groups.has(k)) {
      groups.set(k, { c: num(0), rest });
      order.push(k);
    }
    const g = groups.get(k);
    g.c = nadd(g.c, c);
  }
  const terms = [];
  for (const k of order) {
    const { c, rest } = groups.get(k);
    if (isNum(c, 0) || (c.approx && Math.abs(c.p) < 1e-12)) continue;
    terms.push(isNum(c, 1) ? rest : simplifyProduct([c, rest]));
  }
  if (!isNum(constant, 0)) terms.push(constant);
  if (!terms.length) return num(0);
  return terms.length === 1 ? terms[0] : { t: "+", xs: terms };
}

function simplifyProduct(xs) {
  const flat = [];
  for (const x of xs) {
    if (x.t === "*") flat.push(...x.xs);
    else flat.push(x);
  }
  let c = num(1);
  const order = [];
  const groups = new Map();
  for (const x of flat) {
    if (x.t === "n") {
      c = nmul(c, x);
      continue;
    }
    const [b, e] = x.t === "^" ? [x.b, x.e] : [x, num(1)];
    const k = key(b);
    if (!groups.has(k)) {
      groups.set(k, { b, es: [] });
      order.push(k);
    }
    groups.get(k).es.push(e);
  }
  if (isNum(c, 0)) return num(0);
  const factors = [];
  for (const k of order) {
    const { b, es } = groups.get(k);
    const e = es.length === 1 ? es[0] : simplifySum(es);
    const f = simplifyPow(b, e);
    if (f.t === "n") c = nmul(c, f);
    else if (f.t === "*") {
      for (const y of f.xs) y.t === "n" ? (c = nmul(c, y)) : factors.push(y);
    } else factors.push(f);
  }
  factors.sort((a, b) => rank(a) - rank(b));
  if (!factors.length) return c;
  if (isNum(c, 1)) return factors.length === 1 ? factors[0] : { t: "*", xs: factors };
  return { t: "*", xs: [c, ...factors] };
}

// --- Printing ---------------------------------------------------------------------------------------------

const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "−": "⁻", x: "ˣ", y: "ʸ", n: "ⁿ", a: "ᵃ", b: "ᵇ", k: "ᵏ", t: "ᵗ" };
const sup = (s) => ([...s].every((ch) => SUP[ch]) ? [...s].map((ch) => SUP[ch]).join("") : null);
const NAMES = { arcsin: "sin⁻¹", arccos: "cos⁻¹", arctan: "tan⁻¹" };

export function numText(n) {
  if (n.approx) {
    const r = Math.round(n.p * 1e6) / 1e6;
    return (r < 0 ? "−" : "") + String(Math.abs(r));
  }
  const s = n.q === 1 ? String(Math.abs(n.p)) : `${Math.abs(n.p)}/${n.q}`;
  return (n.p < 0 ? "−" : "") + s;
}

const atomic = (n) => n.t === "v" || n.t === "c" || (n.t === "n" && !n.approx && n.q === 1 && n.p >= 0);

export function print(node) {
  switch (node.t) {
    case "n":
      return numText(node);
    case "v":
      return node.n;
    case "i":
      return "i";
    case "c":
      return node.n === "pi" ? "π" : "e";
    case "+": {
      let xs = node.xs;
      if (xs.length === 2 && val(split(xs[0])[0]) < 0 && val(split(xs[1])[0]) > 0) xs = [xs[1], xs[0]];
      return xs
        .map((x, k) => {
          const [c, rest] = split(x);
          const negative = val(c) < 0;
          const shown = negative ? (rest ? (isNum(c, -1) ? rest : mul(num(-c.p, c.q), rest)) : num(-c.p, c.q)) : x;
          const s = shown.t === "*" ? printProduct(shown) : print(shown);
          return k === 0 ? (negative ? "−" + s : s) : (negative ? " − " : " + ") + s;
        })
        .join("");
    }
    case "*":
      return printProduct(node);
    case "^":
      if (node.e.t === "n" && val(node.e) < 0) return printProduct(mul(node));
      return printPow(node);
    case "f":
      if (node.f === "abs") return `|${print(node.a)}|`;
      return (NAMES[node.f] || node.f) + fnArg(node.a);
  }
  return "?";
}
const fnArg = (a) => (atomic(a) ? " " + print(a) : a.t === "f" && a.f === "abs" ? print(a) : `(${print(a)})`);
// Is there a + or − outside all brackets?
function topLevelSum(s) {
  let depth = 0;
  let bars = 0;
  for (let k = 0; k < s.length; k++) {
    const ch = s[k];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "|") bars ^= 1;
    else if (depth === 0 && !bars && k > 0 && (ch === "+" || ch === "−") && s[k - 1] === " ") return true;
  }
  return false;
}

function printPow({ b, e }) {
  if (isNum(e, 0.5) || (e.t === "n" && !e.approx && e.p === 1 && e.q === 2)) return "√" + (atomic(b) ? print(b) : `(${print(b)})`);
  if (e.t === "n" && !e.approx && e.p === 1 && e.q === 3) return "∛" + (atomic(b) ? print(b) : `(${print(b)})`);
  if (b.t === "f" && isInt(e) && e.p > 0 && b.f !== "abs") return (NAMES[b.f] || b.f) + sup(String(e.p)) + fnArg(b.a).trimStart();
  const base = atomic(b) ? print(b) : `(${print(b)})`;
  const es = e.t === "n" ? numText(e) : print(e);
  const s = sup(es.replace(/\s/g, ""));
  if (s) return base + s;
  return `${base}^(${es})`;
}

function factorText(f) {
  if (f.t === "+") return `(${print(f)})`;
  if (f.t === "^" && f.e.t === "n" && val(f.e) < 0) return factorText(pow(f.b, num(-f.e.p, f.e.q)));
  return print(f);
}
const spaced = (f) => f.t === "f" || (f.t === "^" && (f.b.t === "f" || (f.b.t === "c" && f.b.n === "e")));
function joinFactors(fs) {
  let out = "";
  fs.forEach((f, k) => {
    const s = factorText(f);
    if (k > 0 && (spaced(f) || spaced(fs[k - 1]))) out += " ";
    out += s;
  });
  return out;
}

function printProduct(node) {
  let c = num(1);
  const top = [];
  const bottom = [];
  for (const x of node.xs) {
    if (x.t === "n") c = nmul(c, x);
    else if (x.t === "^" && x.e.t === "n" && val(x.e) < 0) bottom.push(simplifyPow(x.b, num(-x.e.p, x.e.q)));
    else top.push(x);
  }
  const sign = val(c) < 0 ? "−" : "";
  const cp = c.approx ? numText(num(Math.abs(c.p))) : String(Math.abs(c.p));
  const cq = c.approx ? 1 : c.q;
  let numerator = joinFactors(top);
  if (!numerator) numerator = cp;
  else if (cp !== "1") numerator = cp + (top[0].t === "f" || (top[0].t === "^" && top[0].b.t === "f") ? " " : "") + numerator;
  if (cq === 1 && !bottom.length) return sign + numerator;
  const parts = [];
  if (cq !== 1) parts.push(String(cq));
  const b = joinFactors(bottom);
  if (b) parts.push(b);
  let den = parts.join("");
  if (cq !== 1 && b && !/^[(\d]/.test(b)) den = String(cq) + b;
  const many = bottom.length > 1 || (cq !== 1 && bottom.length);
  if (many || (bottom.length === 1 && bottom[0].t === "*")) den = `(${den})`;
  if (topLevelSum(numerator)) numerator = `(${numerator})`;
  return `${sign}${numerator}/${den}`;
}

export const show = (node) => print(simplify(node));

// --- Differentiating --------------------------------------------------------------------------------------

export function derivative(node, x) {
  const d = (n) => derivative(n, x);
  if (!has(node, x)) return num(0);
  switch (node.t) {
    case "v":
      return num(1);
    case "+":
      return add(...node.xs.map(d));
    case "*":
      return add(...node.xs.map((f, k) => mul(...node.xs.map((g, j) => (j === k ? d(g) : g)))));
    case "^": {
      const { b, e } = node;
      if (!has(e, x)) return mul(e, pow(b, add(e, num(-1))), d(b));
      if (!has(b, x)) return mul(node, fn("ln", b), d(e));
      return mul(node, add(mul(d(e), fn("ln", b)), mul(e, d(b), pow(b, num(-1)))));
    }
    case "f": {
      const a = node.a;
      const da = d(a);
      const outer = {
        sin: () => fn("cos", a),
        cos: () => neg(fn("sin", a)),
        tan: () => pow(fn("sec", a), num(2)),
        cot: () => neg(pow(fn("cosec", a), num(2))),
        sec: () => mul(fn("sec", a), fn("tan", a)),
        cosec: () => neg(mul(fn("cosec", a), fn("cot", a))),
        ln: () => pow(a, num(-1)),
        log: () => pow(mul(a, fn("ln", num(10))), num(-1)),
        arcsin: () => pow(sub(num(1), pow(a, num(2))), num(-1, 2)),
        arccos: () => neg(pow(sub(num(1), pow(a, num(2))), num(-1, 2))),
        arctan: () => pow(add(num(1), pow(a, num(2))), num(-1)),
        sinh: () => fn("cosh", a),
        cosh: () => fn("sinh", a),
        tanh: () => sub(num(1), pow(fn("tanh", a), num(2))),
        abs: () => mul(a, pow(fn("abs", a), num(-1))),
      }[node.f];
      return outer ? mul(outer(), da) : null;
    }
  }
  return num(0);
}

// --- Polynomials ------------------------------------------------------------------------------------------

// Coefficients [c0, c1, c2, …] of a polynomial in v, or null.
export function toPoly(node, v) {
  const P = (n) => toPoly(n, v);
  switch (node.t) {
    case "n":
      return [val(node)];
    case "v":
      return node.n === v ? [0, 1] : null;
    case "c":
      return [evaluate(node)];
    case "+": {
      let out = [0];
      for (const x of node.xs) {
        const p = P(x);
        if (!p) return null;
        out = polyAdd(out, p);
      }
      return out;
    }
    case "*": {
      let out = [1];
      for (const x of node.xs) {
        const p = P(x);
        if (!p) return null;
        out = polyMul(out, p);
      }
      return out;
    }
    case "^": {
      if (!has(node, v) && !hasFn(node)) return [evaluate(node)];
      if (!isInt(node.e) || node.e.p < 0 || node.e.p > 40) return null;
      const b = P(node.b);
      if (!b) return null;
      let out = [1];
      for (let k = 0; k < node.e.p; k++) out = polyMul(out, b);
      return out;
    }
  }
  return null;
}
export const trim = (p) => {
  const out = p.map((c) => (Math.abs(c) < 1e-12 ? 0 : c));
  while (out.length > 1 && out[out.length - 1] === 0) out.pop();
  return out;
};
export function polyAdd(a, b) {
  const out = [];
  for (let k = 0; k < Math.max(a.length, b.length); k++) out.push((a[k] || 0) + (b[k] || 0));
  return trim(out);
}
export function polyMul(a, b) {
  const out = Array(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] += x * y)));
  return trim(out);
}
// a = q·b + r
export function polyDiv(a, b) {
  a = trim(a);
  b = trim(b);
  const q = Array(Math.max(1, a.length - b.length + 1)).fill(0);
  let r = a.slice();
  while (r.length >= b.length && !(r.length === 1 && r[0] === 0)) {
    const k = r.length - b.length;
    const c = r[r.length - 1] / b[b.length - 1];
    q[k] = c;
    r = trim(r.map((x, i) => (i >= k && i - k < b.length ? x - c * b[i - k] : x)).slice(0, r.length - 1));
    if (r.length < b.length) break;
  }
  return { q: trim(q), r: trim(r) };
}
export const polyEval = (p, x) => p.reduce((s, c, k) => s + c * x ** k, 0);

// A polynomial as a tree (so it prints like any other expression).
export function polyTree(p, v) {
  const terms = [];
  for (let k = p.length - 1; k >= 0; k--) {
    if (Math.abs(p[k]) < 1e-12) continue;
    const c = num(p[k]);
    terms.push(k === 0 ? c : simplifyProduct([c, k === 1 ? V(v) : pow(V(v), num(k))]));
  }
  if (!terms.length) return num(0);
  return terms.length === 1 ? terms[0] : { t: "+", xs: terms };
}

// Rational roots of a polynomial with (near-)integer coefficients, with repeats.
export function rationalRoots(p) {
  let poly = trim(p.slice());
  const scale = poly.reduce((m, c) => {
    for (let d = 1; d <= 10000; d *= 10) if (Math.abs(Math.round(c * d) - c * d) < 1e-9) return Math.max(m, d);
    return m;
  }, 1);
  poly = poly.map((c) => Math.round(c * scale));
  const roots = [];
  while (poly.length > 1 && poly[0] === 0) {
    roots.push(0);
    poly = poly.slice(1);
  }
  const divisors = (n) => {
    n = Math.abs(n);
    const out = [];
    for (let k = 1; k * k <= n && k <= 100000; k++) if (n % k === 0) out.push(k, n / k);
    return out;
  };
  let found = true;
  while (found && poly.length > 1) {
    found = false;
    const ps = divisors(poly[0]);
    const qs = divisors(poly[poly.length - 1]);
    outer: for (const q of qs) {
      for (const pp of ps) {
        for (const r of [pp / q, -pp / q]) {
          if (Math.abs(polyEval(poly, r)) < 1e-9 * Math.max(1, ...poly.map(Math.abs))) {
            roots.push(r);
            poly = polyDiv(poly, [-r, 1]).q;
            found = true;
            break outer;
          }
        }
      }
    }
  }
  return { roots, rest: poly.map((c) => c / scale) };
}

// --- Integrating --------------------------------------------------------------------------------------------

// The linear inside of f(ax + b): returns a, or null.
function linearCoef(inner, x) {
  const p = toPoly(inner, x);
  return p && p.length === 2 && p[1] !== 0 ? p[1] : null;
}

function integrateBasic(node, x) {
  if (!has(node, x)) return mul(node, V(x));
  const X = V(x);
  if (node.t === "v") return mul(num(1, 2), pow(X, num(2)));
  if (node.t === "^") {
    const { b, e } = node;
    if (!has(e, x)) {
      const a = linearCoef(b, x);
      if (a !== null) {
        if (isNum(e, -1)) return mul(num(1 / a), fn("ln", fn("abs", b)));
        return mul(pow(mul(num(a), add(e, num(1))), num(-1)), pow(b, add(e, num(1))));
      }
      // 1/(x² + c), 1/√(c − x²)
      const q = toPoly(b, x);
      if (q && q.length === 3 && q[1] === 0) {
        const [c0, , c2] = q;
        if (isNum(e, -1) && c0 / c2 > 0) {
          const k = Math.sqrt(c0 / c2);
          return mul(num(1 / (c2 * k)), fn("arctan", mul(pow(num(k), num(-1)), X)));
        }
        if (e.t === "n" && val(e) === -0.5 && c2 < 0 && c0 > 0) {
          const k = Math.sqrt(c0 / -c2);
          return mul(num(1 / Math.sqrt(-c2)), fn("arcsin", mul(pow(num(k), num(-1)), X)));
        }
      }
      // sec²(ax + b), cosec²(ax + b)
      if (b.t === "f" && isNum(e, 2)) {
        const a = linearCoef(b.a, x);
        if (a !== null && b.f === "sec") return mul(num(1 / a), fn("tan", b.a));
        if (a !== null && b.f === "cosec") return mul(num(-1 / a), fn("cot", b.a));
        if (a !== null && b.f === "sin") return mul(num(1, 2), sub(X, mul(num(1 / (2 * a)), fn("sin", mul(num(2), b.a)))));
        if (a !== null && b.f === "cos") return mul(num(1, 2), add(X, mul(num(1 / (2 * a)), fn("sin", mul(num(2), b.a)))));
      }
      return null;
    }
    if (!has(b, x)) {
      const a = linearCoef(e, x);
      if (a === null) return null;
      const lnb = b.t === "c" && b.n === "e" ? num(1) : fn("ln", b);
      return mul(pow(mul(num(a), lnb), num(-1)), node);
    }
    return null;
  }
  if (node.t === "f") {
    const a = linearCoef(node.a, x);
    if (a === null) return null;
    const k = num(1 / a);
    const u = node.a;
    const table = {
      sin: () => neg(fn("cos", u)),
      cos: () => fn("sin", u),
      tan: () => fn("ln", fn("abs", fn("sec", u))),
      cot: () => fn("ln", fn("abs", fn("sin", u))),
      sec: () => fn("ln", fn("abs", add(fn("sec", u), fn("tan", u)))),
      cosec: () => neg(fn("ln", fn("abs", add(fn("cosec", u), fn("cot", u))))),
      ln: () => sub(mul(u, fn("ln", u)), u),
      log: () => mul(pow(fn("ln", num(10)), num(-1)), sub(mul(u, fn("ln", u)), u)),
      sinh: () => fn("cosh", u),
      cosh: () => fn("sinh", u),
      arctan: () => sub(mul(u, fn("arctan", u)), mul(num(1, 2), fn("ln", add(num(1), pow(u, num(2)))))),
      arcsin: () => add(mul(u, fn("arcsin", u)), pow(sub(num(1), pow(u, num(2))), num(1, 2))),
    }[node.f];
    return table ? mul(k, table()) : null;
  }
  return null;
}

// Does F' equal f? Checked at several points, so a wrong answer is never shown.
export function checkAntiderivative(F, f, x) {
  const dF = compile(simplify(derivative(F, x)), x);
  const g = compile(f, x);
  let tested = 0;
  for (const t of [0.37, 0.81, 1.3, 1.9, 2.6, -0.43, -1.7, 3.3, 0.12]) {
    const a = dF(t);
    const b = g(t);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(b))) return false;
    tested++;
  }
  return tested >= 3;
}

const sampleRatio = (a, b, x) => {
  const fa = compile(a, x);
  const fb = compile(b, x);
  let r = null;
  for (const t of [0.37, 0.81, 1.3, 1.9, 2.6]) {
    const v = fa(t) / fb(t);
    if (!Number.isFinite(v)) continue;
    if (r === null) r = v;
    else if (Math.abs(v - r) > 1e-8 * Math.max(1, Math.abs(r))) return null;
  }
  return r;
};

export function integrate(node, x) {
  const f = simplify(node);
  const F = integrateInner(f, x, 0);
  if (!F) return null;
  const out = simplify(F);
  return checkAntiderivative(out, f, x) ? out : null;
}

function integrateInner(f, x, depth) {
  if (depth > 6) return null;
  if (!has(f, x)) return mul(f, V(x));
  if (f.t === "^") {
    const basic = integrateBasic(f, x);
    if (basic) return basic;
  }
  // Polynomials: power rule term by term
  const p = toPoly(f, x);
  if (p) return polyTree([0, ...p.map((c, k) => c / (k + 1))], x);
  if (f.t === "+") {
    const parts = f.xs.map((t) => integrateInner(t, x, depth + 1));
    return parts.every(Boolean) ? add(...parts) : null;
  }
  const basic = integrateBasic(f, x);
  if (basic) return basic;
  if (f.t === "*" || f.t === "^") {
    const xs = f.t === "*" ? f.xs : [f];
    const constant = xs.filter((t) => !has(t, x));
    const varying = xs.filter((t) => has(t, x));
    if (constant.length) {
      const inner = integrateInner(simplify(mul(...varying)), x, depth + 1);
      return inner ? mul(...constant, inner) : null;
    }
    // Rational functions: partial fractions
    const rf = rationalParts(f, x);
    if (rf) {
      const pf = partialFractions(rf.num, rf.den);
      if (pf && (pf.terms.length || pf.poly.some((c) => c))) {
        const parts = [];
        if (pf.poly.some((c) => c)) parts.push(polyTree([0, ...pf.poly.map((c, k) => c / (k + 1))], x));
        for (const t of pf.terms) {
          const lin = add(V(x), num(-t.r));
          if (t.power === 1) parts.push(mul(num(t.c), fn("ln", fn("abs", lin))));
          else parts.push(mul(num(-t.c / (t.power - 1)), pow(lin, num(1 - t.power))));
        }
        const inner = pf.quad ? integrateInner(simplify(pf.quad), x, depth + 1) : num(0);
        if (inner) return add(...parts, inner);
      }
    }
    // Substitution: f(u)·u'
    for (const g of varying) {
      const inner = g.t === "f" ? g.a : g.t === "^" ? (has(g.e, x) ? g.e : g.b) : null;
      if (!inner || inner.t === "v") continue;
      const rest = varying.filter((t) => t !== g);
      const du = simplify(derivative(inner, x));
      const ratio = sampleRatio(rest.length ? mul(...rest) : num(1), du, x);
      if (ratio === null || !Number.isFinite(ratio) || ratio === 0) continue;
      const G = integrateBasic(simplify(substituteNode(g, inner, V("u"))), "u");
      if (G) return mul(num(ratio), substitute(G, "u", inner));
    }
    // A factor whose derivative is the whole thing: ∫ sec x tan x = sec x
    for (const g of varying) {
      for (const cand of [g, mul(num(1, 2), pow(g, num(2)))]) {
        const r = sampleRatio(f, simplify(derivative(cand, x)), x);
        if (r !== null && Number.isFinite(r) && r !== 0) return mul(num(r), cand);
      }
    }
    // By parts: polynomial × (eˣ, sin, cos) and polynomial × ln
    if (varying.length >= 2) {
      const polyParts = varying.filter((t) => toPoly(t, x));
      const others = varying.filter((t) => !toPoly(t, x));
      if (polyParts.length && others.length === 1) {
        const P = simplify(mul(...polyParts));
        const g = others[0];
        if (g.t === "f" && g.f === "ln") {
          // ∫ P ln u = Q ln u − ∫ Q u'/u, with Q = ∫ P
          const Q = integrateInner(P, x, depth + 1);
          if (!Q) return null;
          const rest = integrateInner(simplify(mul(Q, derivative(g, x))), x, depth + 1);
          return rest ? sub(mul(Q, g), rest) : null;
        }
        // Tabular: ∫ P g = P G1 − P' G2 + P'' G3 − …
        const terms = [];
        let Pk = P;
        let Gk = g;
        for (let k = 0; k < 12; k++) {
          if (isNum(Pk, 0)) return add(...terms);
          Gk = integrateInner(simplify(Gk), x, depth + 1);
          if (!Gk) return null;
          Gk = simplify(Gk);
          terms.push(mul(num(k % 2 ? -1 : 1), Pk, Gk));
          Pk = simplify(derivative(Pk, x));
        }
        return null;
      }
      // eᵃˣ sin bx and eᵃˣ cos bx
      if (varying.length === 2) {
        const ex = varying.find((t) => t.t === "^" && t.b.t === "c" && t.b.n === "e");
        const tr = varying.find((t) => t.t === "f" && (t.f === "sin" || t.f === "cos"));
        if (ex && tr) {
          const a = linearCoef(ex.e, x);
          const b = linearCoef(tr.a, x);
          if (a !== null && b !== null) {
            const k = num(1 / (a * a + b * b));
            const s = fn("sin", tr.a);
            const c = fn("cos", tr.a);
            const inner = tr.f === "sin" ? sub(mul(num(a), s), mul(num(b), c)) : add(mul(num(a), c), mul(num(b), s));
            return mul(k, ex, inner);
          }
        }
      }
    }
  }
  return null;
}

// Replace a whole sub-tree (by shape) with another tree.
function substituteNode(node, target, by) {
  if (key(node) === key(target)) return by;
  switch (node.t) {
    case "+":
    case "*":
      return { t: node.t, xs: node.xs.map((y) => substituteNode(y, target, by)) };
    case "^":
      return pow(substituteNode(node.b, target, by), substituteNode(node.e, target, by));
    case "f":
      return fn(node.f, substituteNode(node.a, target, by));
    default:
      return node;
  }
}

// A rational function as numerator and denominator polynomials, or null.
export function rationalParts(node, x) {
  const f = simplify(node);
  const xs = f.t === "*" ? f.xs : [f];
  let top = [1];
  let bottom = [1];
  for (const t of xs) {
    if (t.t === "^" && t.e.t === "n" && val(t.e) < 0 && isInt(num(-t.e.p, t.e.q))) {
      const p = toPoly(t.b, x);
      if (!p) return null;
      for (let k = 0; k < -val(t.e); k++) bottom = polyMul(bottom, p);
    } else {
      const p = toPoly(t, x);
      if (!p) return null;
      top = polyMul(top, p);
    }
  }
  if (bottom.length < 2) return null;
  return { num: top, den: bottom };
}

// Partial fractions: num/den = poly + Σ c/(x − r)^k (+ a leftover quadratic part)
export function partialFractions(top, den) {
  const { q: poly, r: rem } = polyDiv(top, den);
  const { roots, rest } = rationalRoots(den);
  if (rest.length > 3) return null;
  const lead = den[den.length - 1] / (rest[rest.length - 1] || 1);
  const counts = new Map();
  for (const r of roots) counts.set(r, (counts.get(r) || 0) + 1);
  // Unknowns: c for each 1/(x−r)^k, and (Bx + C)/rest when rest is a quadratic
  const basis = [];
  for (const [r, m] of counts) for (let k = 1; k <= m; k++) basis.push({ r, power: k, f: (x) => 1 / (x - r) ** k });
  const hasQuad = rest.length === 3;
  if (hasQuad) {
    basis.push({ quad: 1, f: (x) => x / polyEval(rest, x) / lead });
    basis.push({ quad: 0, f: (x) => 1 / polyEval(rest, x) / lead });
  }
  if (!basis.length) return null;
  const pts = basis.map((_, k) => 0.5 + 1.37 * k + 0.113 * k * k + 7.1);
  const A = pts.map((t) => basis.map((b) => b.f(t)));
  const y = pts.map((t) => polyEval(rem, t) / polyEval(den, t));
  const c = solveLinear(A, y);
  if (!c) return null;
  const terms = basis.map((b, k) => ({ ...b, c: roundNice(c[k]) })).filter((b) => b.quad === undefined && Math.abs(b.c) > 1e-12);
  let quad = null;
  if (hasQuad) {
    const B = roundNice(c[basis.length - 2]);
    const Cc = roundNice(c[basis.length - 1]);
    quad = mul(add(mul(num(B), V("x")), num(Cc)), pow(polyTree(rest.map((v) => v * lead), "x"), num(-1)));
  }
  return { poly: poly.map(roundNice), terms, quad, lead };
}

export const roundNice = (v) => {
  for (let d = 1; d <= 720; d++) if (Math.abs(Math.round(v * d) - v * d) < 1e-7) return Math.round(v * d) / d;
  return v;
};

// Gaussian elimination with partial pivoting; null when singular.
export function solveLinear(A, y) {
  const n = A.length;
  const M = A.map((row, i) => [...row, y[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = M[r][c] / M[c][c];
      for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// --- Recognising exact values ------------------------------------------------------------------------------

function fraction(v, maxDen = 1000) {
  for (let d = 1; d <= maxDen; d++) {
    const n = Math.round(v * d);
    if (Math.abs(n / d - v) < 1e-10 * Math.max(1, Math.abs(v))) return [n, d];
  }
  return null;
}
const fracText = ([n, d]) => (d === 1 ? `${n < 0 ? "−" : ""}${Math.abs(n)}` : `${n < 0 ? "−" : ""}${Math.abs(n)}/${d}`);
const times = ([n, d], sym) => {
  const s = n < 0 ? "−" : "";
  const a = Math.abs(n);
  return `${s}${a === 1 ? "" : a}${sym}${d === 1 ? "" : "/" + d}`;
};

// "π²/6", "3√2/2", "ln 2", or null
export function recognise(v) {
  if (!Number.isFinite(v)) return null;
  if (Math.abs(v) < 1e-12) return "0";
  const f = fraction(v, 1000);
  if (f) return fracText(f);
  const tries = [
    [Math.PI, "π", 24],
    [Math.PI ** 2, "π²", 24],
    [Math.E, "e", 12],
    [Math.LN2, "ln 2", 12],
    [Math.log(3), "ln 3", 12],
    [1 / Math.PI, "/π", 12],
  ];
  for (const [base, sym, maxD] of tries) {
    const g = fraction(v / base, maxD);
    if (g && Math.abs(g[0]) <= 50) {
      if (sym === "/π") return `${g[0] < 0 ? "−" : ""}${Math.abs(g[0])}/${g[1] === 1 ? "" : g[1]}π`;
      return times(g, sym);
    }
  }
  // ln k
  const ek = Math.exp(v);
  if (v > 0 && v < 12 && Math.abs(ek - Math.round(ek)) < 1e-8 * ek && Math.round(ek) > 1) return `ln ${Math.round(ek)}`;
  // aπ + b, aπ² + b (like π² − 4)
  for (const [base, sym] of [[Math.PI, "π"], [Math.PI ** 2, "π²"]]) {
    for (let b = -20; b <= 20; b++) {
      if (!b) continue;
      const g = fraction((v - b) / base, 12);
      if (g && g[0] && Math.abs(g[0]) <= 20) return `${times(g, sym)} ${b < 0 ? "−" : "+"} ${Math.abs(b)}`;
    }
  }
  // a√b/c
  const sq = fraction(v * v, 400);
  if (sq && sq[0] > 0) {
    let [n, d] = sq;
    // √(n/d) = √(n·d)/d
    let inside = n * d;
    let outside = 1;
    for (let k = 2; k * k <= inside; k++) {
      while (inside % (k * k) === 0) {
        inside /= k * k;
        outside *= k;
      }
    }
    if (inside > 1 && inside < 1000) {
      const g = igcd(outside, d);
      const o = outside / g;
      const dd = d / g;
      return `${v < 0 ? "−" : ""}${o === 1 ? "" : o}√${inside}${dd === 1 ? "" : "/" + dd}`;
    }
  }
  return null;
}

// "π/4 ≈ 0.7854", or just the decimal
export function valueText(v, digits = 6) {
  const r = recognise(v);
  const dec = decimal(v, digits);
  if (!r || /^−?\d+$/.test(r)) return dec;
  return r.replace(/^−/, "−") === dec ? r : `${r} ≈ ${dec}`;
}
export function decimal(v, digits = 6) {
  if (!Number.isFinite(v)) return v > 0 ? "∞" : v < 0 ? "−∞" : "undefined";
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  const s = Math.abs(r).toLocaleString("en-IN", { maximumFractionDigits: digits });
  return (r < 0 ? "−" : "") + s;
}
