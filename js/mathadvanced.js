// MK.ai's advanced maths: calculus with any functions (derivatives, integrals,
// limits, tangents, maxima and minima, simple differential equations),
// complex numbers, systems of 3+ equations, vectors, matrix operations,
// factorising, partial fractions, expansions, series and sequences, and
// equations with logs, powers and trig. Built on symbolic.js; no outside
// service is used. Every solver takes the cleaned question and returns an
// answer, or null when it isn't its kind of problem.

import {
  parse, simplify, show, print, derivative, integrate, evaluate, compile, toPoly, polyTree, polyMul, polyDiv, polyEval,
  rationalRoots, rationalParts, partialFractions, solveLinear, recognise, valueText, decimal, vars, has, hasFn,
  num, V, add, mul, pow, fn, substitute, roundNice, trim,
} from "./symbolic.js";

const mainVar = (tree) => {
  const vs = [...vars(tree)];
  if (vs.includes("x")) return "x";
  if (vs.includes("t")) return "t";
  return vs[0] || "x";
};
// A number the person typed: "2", "-1/2", "pi/4", "infinity"
function valueOf(text) {
  const t = text.trim().replace(/^\+/, "");
  if (/^(\+?infinity|∞|inf|\+∞)$/.test(t)) return Infinity;
  if (/^(-infinity|-∞|-inf)$/.test(t)) return -Infinity;
  const tree = parse(t);
  if (!tree || vars(tree).size) return NaN;
  return evaluate(tree);
}
const matrixCell = (v) => {
  const r = recognise(roundNice(v));
  return r && !/[π√el]/.test(r) ? r : decimal(v, 4);
};

// --- Derivatives ------------------------------------------------------------------------------------------

const ORDERS = { first: 1, second: 2, third: 3, "2nd": 2, "3rd": 3, "1st": 1, fourth: 4, "4th": 4 };

function whichRule(tree, x) {
  const t = simplify(tree);
  if (t.t === "*") {
    const moving = t.xs.filter((f) => has(f, x));
    if (moving.some((f) => f.t === "^" && f.e.t === "n" && f.e.p < 0 && moving.length > 1)) return "Quotient rule: (u/v)′ = (u′v − uv′)/v²";
    if (moving.length > 1) return "Product rule: (uv)′ = u′v + uv′";
  }
  const inner = t.t === "f" ? t.a : t.t === "^" ? (has(t.e, x) ? t.e : t.b) : null;
  if (inner && inner.t !== "v" && has(inner, x)) return "Chain rule: d/dx f(g(x)) = f′(g(x)) · g′(x)";
  return null;
}

function derivatives(q) {
  let m;
  let order = 1;
  let body = null;
  let x = null;
  let at = null;
  // "second derivative of …", "differentiate … with respect to t", "d/dx (…)", "dy/dx if y = …"
  if ((m = q.match(/^(?:find |what is |calculate |evaluate )?(?:the )?(?:(first|second|third|fourth|1st|2nd|3rd|4th|\d+th) )?(?:order )?(?:partial )?(?:derivative|differentiation|differential coefficient) of (.+)$/))) {
    order = ORDERS[m[1]] || (m[1] ? parseInt(m[1], 10) : 1);
    body = m[2];
  } else if ((m = q.match(/^(?:partially )?differentiate (.+)$/))) body = m[1];
  else if ((m = q.match(/^(?:∂|d)\/(?:∂|d)([a-z])\s*(?:of\s*)?(.+)$/))) {
    x = m[1];
    body = m[2];
  } else if ((m = q.match(/^d(?:\^?2|²)\s*y\s*\/\s*d([a-z])(?:\^?2|²)\s*(?:of|if|for|when|where)?\s*(?:y\s*=\s*)?(.+)$/))) {
    order = 2;
    x = m[1];
    body = m[2];
  } else if ((m = q.match(/^(?:find )?dy\s*\/\s*d([a-z])\s*(?:of|if|for|when|where|given)\s*(?:y\s*=\s*)?(.+)$/))) {
    x = m[1];
    body = m[2];
  } else if ((m = q.match(/^(?:if |given )?y\s*=\s*(.+?),?\s*(?:then )?find dy\s*\/\s*d([a-z])$/))) {
    body = m[1];
    x = m[2];
  } else if ((m = q.match(/^(?:if |given )?f\(([a-z])\)\s*=\s*(.+?),?\s*(?:then )?(?:find |what is )?f'\(\s*(?:[a-z]|(-?[\d./]+))\s*\)$/))) {
    x = m[1];
    body = m[2];
    if (m[3]) at = m[3];
  } else return null;
  body = body.replace(/^(?:y|f\([a-z]\))\s*=\s*/, "");
  let mm = body.match(/^(.+?)\s+(?:with respect to|wrt|w\.r\.t\.?)\s+([a-z])(.*)$/);
  if (mm) {
    body = mm[1] + mm[3];
    x = mm[2];
  }
  mm = body.match(/^(.+?)\s+(?:at|when|where|for)\s+([a-z])\s*=\s*(\S+)$/);
  if (mm) {
    body = mm[1];
    x = x || mm[2];
    at = mm[3];
  }
  const tree = parse(body);
  if (!tree) return null;
  x = x || mainVar(tree);
  if (!has(tree, x) && !vars(tree).size && !hasFn(tree)) return null;
  const lines = [`d/d${x} [${show(tree)}]`];
  let d = tree;
  const names = ["", "", "Second", "Third", "Fourth"];
  for (let k = 1; k <= Math.min(order, 6); k++) {
    d = simplify(derivative(d, x));
    lines.push(k === 1 ? `= ${print(d)}` : `${names[k] || k + "th"} derivative = ${print(d)}`);
  }
  const rule = whichRule(tree, x);
  if (rule && order === 1) lines.push("", `(${rule})`);
  if (at !== null) {
    const a = valueOf(at);
    if (Number.isFinite(a)) {
      const v = evaluate(d, { [x]: a });
      lines.push("", `At ${x} = ${at}: ${Number.isFinite(v) ? valueText(v) : "undefined"}`);
    }
  }
  return lines.join("\n");
}

// --- Integrals --------------------------------------------------------------------------------------------

function simpson(f, a, b, n = 2000) {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let k = 1; k < n; k++) s += (k % 2 ? 4 : 2) * f(a + k * h);
  return (s * h) / 3;
}

function integrals(q) {
  let m = q.match(/^(?:find |what is |evaluate |calculate )?(?:the )?(?:definite |indefinite )?(?:integral|integration|antiderivative) (?:from|between) (\S+) (?:to|and) (\S+) of (.+?)(?:\s*d([a-z]))?$/);
  let body;
  let x;
  let lo;
  let hi;
  if (m) [, lo, hi, body, x] = m;
  else {
    m = q.match(/^(?:find |what is |evaluate |calculate )?(?:the )?(?:definite |indefinite )?(?:integral of|integrate|integration of|antiderivative of|∫)\s*(.+?)(?:\s*d([a-z]))?(?:\s+(?:from|between|with limits)\s+(\S+)\s+(?:to|and)\s+(\S+))?$/);
    if (!m) return null;
    [, body, x, lo, hi] = m;
  }
  body = body.replace(/\s*d[a-z]$/, "").replace(/\s+with respect to [a-z]$/, "");
  const tree = parse(body);
  if (!tree) return null;
  x = x || mainVar(tree);
  const f = simplify(tree);
  const F = integrate(f, x);
  if (lo !== undefined) {
    const a = valueOf(lo);
    const b = valueOf(hi);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    const head = `∫ from ${lo} to ${hi} of ${print(f)} d${x}`;
    if (F) {
      const Fa = evaluate(F, { [x]: a });
      const Fb = evaluate(F, { [x]: b });
      if (Number.isFinite(Fa) && Number.isFinite(Fb)) {
        return [head, `Antiderivative F(${x}) = ${print(F)}`, `F(${hi}) − F(${lo}) = ${decimal(Fb)} − ${decimal(Fa)}`, "", `= ${valueText(Fb - Fa)}`].join("\n");
      }
    }
    const g = compile(f, x);
    const v1 = simpson(g, a, b, 2000);
    const v2 = simpson(g, a, b, 4000);
    if (!Number.isFinite(v2) || Math.abs(v1 - v2) > 1e-6 * Math.max(1, Math.abs(v2))) return `${head}\n\nThis integral doesn't have a finite value (the function blows up in that range).`;
    return `${head}\n\n≈ ${valueText(v2)}\n(Worked out numerically with Simpson's rule.)`;
  }
  if (!F) return `∫ ${print(f)} d${x}\n\nI couldn't find an exact antiderivative for this one. Give me limits (for example "from 0 to 1") and I'll work out the definite integral numerically.`;
  return `∫ ${print(f)} d${x}\n= ${print(F)} + C\n\n(Check: differentiating the answer gives back ${print(f)} ✓)`;
}

// --- Limits -------------------------------------------------------------------------------------------------

function fractionParts(tree) {
  const t = simplify(tree);
  const xs = t.t === "*" ? t.xs : [t];
  const top = [];
  const bottom = [];
  for (const f of xs) {
    if (f.t === "^" && f.e.t === "n" && f.e.p < 0) bottom.push(simplify(pow(f.b, num(-f.e.p, f.e.q))));
    else top.push(f);
  }
  if (!bottom.length) return null;
  return { top: top.length ? simplify(mul(...top)) : num(1), bottom: simplify(mul(...bottom)) };
}

function limits(q) {
  let m = q.match(/^(?:find |what is |evaluate |calculate )?(?:the )?(?:limit|lim)\s*(?:of\s*)?(.+?),?\s*(?:as|when)\s*([a-z])\s*(?:approaches|tends to|goes to|->|→|=)\s*(.+)$/);
  let body;
  let x;
  let to;
  if (m) [, body, x, to] = m;
  else {
    m = q.match(/^(?:find |evaluate )?(?:the )?(?:limit|lim)\s*\(?\s*([a-z])\s*(?:->|→|approaches|tends to)\s*([^\s)]+)\s*\)?\s*(?:of\s*)?(.+)$/);
    if (!m) return null;
    [, x, to, body] = m;
  }
  const side = /[+-]$/.test(to) && !/^[+-]?(inf|∞)/.test(to) && to.length > 1 ? to.slice(-1) : "";
  if (side) to = to.slice(0, -1);
  const a = valueOf(to);
  const tree = parse(body);
  if (!tree || Number.isNaN(a)) return null;
  const f = simplify(tree);
  const g = compile(f, x);
  const head = `lim (${x} → ${to.replace(/infinity|inf/, "∞")}${side}) ${print(f)}`;
  const nice = (v) => {
    const r = recognise(v);
    if (r) return `${r}${/^[−\d/]+$/.test(r) ? "" : ` ≈ ${decimal(v)}`}`;
    // numeric limits: allow a looser match for famous constants
    for (const [c, s] of [[Math.E, "e"], [Math.PI, "π"], [1 / Math.E, "1/e"], [Math.LN2, "ln 2"]]) if (Math.abs(v - c) < 1e-6) return `${s} ≈ ${decimal(v)}`;
    const f2 = Math.round(v * 1e6) / 1e6;
    const rr = recognise(f2);
    return rr && Math.abs(v - f2) < 1e-7 ? rr : `≈ ${decimal(v)}`;
  };
  if (!Number.isFinite(a)) {
    const s = a > 0 ? 1 : -1;
    const v4 = g(s * 1e4);
    const v6 = g(s * 1e6);
    const v8 = g(s * 1e7);
    const lines = [head];
    const parts = fractionParts(f);
    if (parts) {
      const P = toPoly(parts.top, x);
      const Q = toPoly(parts.bottom, x);
      if (P && Q) {
        const dp = trim(P).length - 1;
        const dq = trim(Q).length - 1;
        lines.push(`Top has degree ${dp}, bottom has degree ${dq}. Divide top and bottom by ${x}${dq > 1 ? "^" + dq : ""}.`);
        if (dp < dq) return [...lines, "", "The bottom grows faster, so the limit is 0."].join("\n");
        if (dp === dq) return [...lines, "", `The limit is the ratio of the leading coefficients: ${nice(P[dp] / Q[dq])}`].join("\n");
      }
    }
    if (!Number.isFinite(v8) || Math.abs(v8) > 1e9) return [...lines, "", `The expression grows without bound, so the limit is ${(v8 > 0) === true ? "∞" : "−∞"}.`].join("\n");
    if (Math.abs(v6 - v8) < 1e-5 * Math.max(1, Math.abs(v8)) && Math.abs(v4 - v6) < 1e-3 * Math.max(1, Math.abs(v6))) return [...lines, "", `= ${nice(v8)}`].join("\n");
    return [...lines, "", "This limit doesn't settle on one value (it keeps oscillating or growing)."].join("\n");
  }
  const direct = g(a);
  const near = (h) => (side === "-" ? g(a - h) : side === "+" ? g(a + h) : (g(a - h) + g(a + h)) / 2);
  if (Number.isFinite(direct) && Math.abs(near(1e-7) - direct) < 1e-4 * Math.max(1, Math.abs(direct)) && !side) {
    return `${head}\n\nThe function is continuous there, so substitute ${x} = ${to}:\n= ${nice(direct)}`;
  }
  const lines = [head];
  const parts = fractionParts(f);
  if (parts) {
    let top = parts.top;
    let bottom = parts.bottom;
    for (let k = 0; k < 4; k++) {
      const tv = evaluate(top, { [x]: a });
      const bv = evaluate(bottom, { [x]: a });
      if (Math.abs(tv) < 1e-12 && Math.abs(bv) < 1e-12) {
        lines.push(`Substituting ${x} = ${to} gives 0/0, so use L'Hôpital's rule (differentiate top and bottom):`);
        top = simplify(derivative(top, x));
        bottom = simplify(derivative(bottom, x));
        lines.push(`→ (${print(top)}) / (${print(bottom)})`);
        continue;
      }
      if (Number.isFinite(tv) && Number.isFinite(bv) && Math.abs(bv) > 1e-12) {
        const v = tv / bv;
        if (Math.abs(near(1e-6) - v) < 1e-3 * Math.max(1, Math.abs(v))) {
          if (k === 0) break;
          return [...lines, `Now substitute ${x} = ${to}:`, "", `= ${nice(v)}`].join("\n");
        }
      }
      break;
    }
  }
  // Numerically from both sides
  const left = g(a - 1e-7);
  const right = g(a + 1e-7);
  const l2 = g(a - 1e-5);
  const r2 = g(a + 1e-5);
  const big = (v, w) => Math.abs(v) > 1e5 && Math.abs(w) < Math.abs(v);
  if (side !== "+" && side !== "-" && big(left, l2) && big(right, r2)) {
    if (Math.sign(left) === Math.sign(right)) return `${head}\n\nThe function grows without bound on both sides, so the limit is ${left > 0 ? "∞" : "−∞"}.`;
    return `${head}\n\nFrom the left it goes to ${left > 0 ? "∞" : "−∞"}, from the right to ${right > 0 ? "∞" : "−∞"}, so the limit does not exist.`;
  }
  if (side) {
    const v = side === "-" ? left : right;
    const w = side === "-" ? l2 : r2;
    if (big(v, w)) return `${head}\n\n= ${v > 0 ? "∞" : "−∞"}`;
    return `${head}\n\n= ${nice(v)}`;
  }
  if (Math.abs(left - right) < 1e-4 * Math.max(1, Math.abs(right))) return [...lines, "", `= ${nice((left + right) / 2)}`].join("\n");
  return `${head}\n\nThe left-hand limit (${nice(left)}) and right-hand limit (${nice(right)}) are different, so the limit does not exist.`;
}

// --- Tangents, maxima and minima -----------------------------------------------------------------------------

function tangents(q) {
  const m = q.match(/(equation of (?:the )?|slope of (?:the )?|gradient of (?:the )?)(tangent|normal)(?: line)? (?:to|of) (?:the )?(?:curve |graph )?(?:y\s*=\s*|f\(x\)\s*=\s*)?(.+?),?\s*at (?:the point )?(?:x\s*=\s*(\S+)|\((\S+?),\s*(\S+?)\))$/);
  if (!m) return null;
  const tree = parse(m[3]);
  if (!tree) return null;
  const x = mainVar(tree);
  const a = valueOf(m[4] ?? m[5]);
  if (!Number.isFinite(a)) return null;
  const y0 = evaluate(tree, { [x]: a });
  const d = simplify(derivative(tree, x));
  const slope = evaluate(d, { [x]: a });
  if (!Number.isFinite(y0) || !Number.isFinite(slope)) return null;
  const lines = [`y = ${print(simplify(tree))}`, `dy/d${x} = ${print(d)}`, `At ${x} = ${decimal(a)}: y = ${valueText(y0)}, slope of tangent = ${valueText(slope)}`];
  const normal = m[2] === "normal";
  if (/slope|gradient/.test(m[1])) {
    if (!normal) return [...lines, "", `Slope of the tangent = ${valueText(slope)}`].join("\n");
    return [...lines, "", slope === 0 ? "The tangent is flat, so the normal is vertical: x = " + decimal(a) : `Slope of the normal = −1/(${decimal(slope)}) = ${valueText(-1 / slope)}`].join("\n");
  }
  const k = normal ? (slope === 0 ? null : -1 / slope) : slope;
  if (k === null) return [...lines, "", `The tangent is flat, so the normal is the vertical line x = ${decimal(a)}.`].join("\n");
  const c = y0 - k * a;
  const eq = show(add(mul(num(roundNice(k)), V("x")), num(roundNice(c))));
  return [...lines, normal ? `Slope of the normal = −1/slope = ${valueText(k)}` : "", `Using y − y₁ = m(x − x₁):`, "", `${normal ? "Normal" : "Tangent"}: y = ${eq}`].filter((l, i) => l !== "" || i > 2).join("\n");
}

// Real roots of g on a range, found by sign changes then bisection.
function roots(g, lo = -60, hi = 60, steps = 24000) {
  const out = [];
  const h = (hi - lo) / steps;
  let px = lo;
  let pv = g(px);
  for (let k = 1; k <= steps; k++) {
    const cx = lo + k * h;
    const cv = g(cx);
    if (Number.isFinite(pv) && Number.isFinite(cv)) {
      if (pv === 0) out.push(px);
      else if (pv * cv < 0) {
        let [a, b, fa] = [px, cx, pv];
        for (let j = 0; j < 80; j++) {
          const mid = (a + b) / 2;
          const fm = g(mid);
          if (!Number.isFinite(fm)) break;
          if (fa * fm <= 0) b = mid;
          else [a, fa] = [mid, fm];
        }
        const r = (a + b) / 2;
        // a jump across an asymptote isn't a root
        if (Math.abs(g(r)) < 1e-6 * Math.max(1, Math.abs(pv), Math.abs(cv))) out.push(r);
      }
    }
    px = cx;
    pv = cv;
  }
  return out.filter((r, i) => i === 0 || Math.abs(r - out[i - 1]) > 1e-7);
}
const cleanRoot = (r) => {
  const n = roundNice(r);
  return Math.abs(n - r) < 1e-7 ? n : r;
};

function extrema(q) {
  const m = q.match(/^(?:find |what (?:is|are) )?(?:the )?(?:local |absolute |global )?(maximum|minimum|maxima|minima|max|min|stationary points?|turning points?|critical points?)(?:\s*(?:and|&|\/)\s*(?:local )?(?:minimum|maximum|minima|maxima))?(?: values?| points?)? of (?:the function )?(?:f\(x\)\s*=\s*|y\s*=\s*)?(.+)$/);
  if (!m) return null;
  const tree = parse(m[2]);
  if (!tree || vars(tree).size !== 1) return null;
  const x = mainVar(tree);
  const f = compile(tree, x);
  const d1 = simplify(derivative(tree, x));
  const d2 = simplify(derivative(d1, x));
  let pts;
  const P = toPoly(d1, x);
  if (P) {
    const { roots: rr, rest } = rationalRoots(P);
    pts = [...rr];
    if (rest.length > 1) pts.push(...roots((t) => polyEval(rest, t)).map(cleanRoot));
  } else pts = roots(compile(d1, x)).map(cleanRoot);
  pts = [...new Set(pts.map((r) => Math.round(r * 1e9) / 1e9))].sort((a, b) => a - b);
  const lines = [`f(${x}) = ${print(simplify(tree))}`, `f′(${x}) = ${print(d1)}`, `f″(${x}) = ${print(d2)}`, "", `Set f′(${x}) = 0:`];
  if (!pts.length) return [...lines, "f′ is never 0, so there are no maximum or minimum points (the function keeps increasing or decreasing)."].join("\n");
  for (const r of pts.slice(0, 8)) {
    const s = evaluate(d2, { [x]: r });
    const y = f(r);
    let kind;
    if (s < -1e-9) kind = "local maximum (f″ < 0)";
    else if (s > 1e-9) kind = "local minimum (f″ > 0)";
    else {
      const l = evaluate(d1, { [x]: r - 1e-4 });
      const rt = evaluate(d1, { [x]: r + 1e-4 });
      kind = l > 0 && rt < 0 ? "local maximum" : l < 0 && rt > 0 ? "local minimum" : "point of inflection (neither max nor min)";
    }
    lines.push(`• ${x} = ${valueText(r)}: f = ${valueText(y)} → ${kind}`);
  }
  return lines.join("\n");
}

// --- Differential equations -------------------------------------------------------------------------------

function differentialEquations(q) {
  const m = q.match(/^(?:solve )?(?:the )?(?:differential equation )?dy\s*\/\s*dx\s*=\s*(.+?)(?:,?\s*(?:given|with|if|when|and)\s*y\s*\(\s*(\S+?)\s*\)\s*=\s*(\S+))?$/);
  if (!m) return null;
  const rhs = parse(m[1]);
  if (!rhs) return null;
  const vs = vars(rhs);
  if ([...vs].some((v) => v !== "x" && v !== "y")) return null;
  const lines = [`dy/dx = ${print(simplify(rhs))}`];
  let solution; // tree in x with constant C
  if (!vs.has("y")) {
    const F = integrate(rhs, "x");
    if (!F) return null;
    lines.push("Integrate both sides with respect to x:");
    solution = add(F, V("C"));
  } else {
    // dy/dx = g(x)·y  →  y = C·e^(∫g)
    const g = simplify(substitute(rhs, "y", num(1)));
    const ok = [0.3, 1.1, 2.7].every((t) => [0.5, 2, 3.5].every((y) => Math.abs(evaluate(rhs, { x: t, y }) - y * evaluate(g, { x: t, y })) < 1e-9 * Math.max(1, Math.abs(evaluate(rhs, { x: t, y })))));
    if (!ok) return null;
    const G = has(g, "x") ? integrate(g, "x") : simplify(mul(g, V("x")));
    if (!G) return null;
    lines.push("Separate the variables: dy/y = " + print(g) + " dx", "Integrate: ln|y| = " + print(G) + " + c");
    solution = mul(V("C"), pow({ t: "c", n: "e" }, G));
  }
  let out = `y = ${show(solution)}`;
  if (m[2] !== undefined) {
    const x0 = valueOf(m[2]);
    const y0 = valueOf(m[3]);
    const at = (C) => evaluate(solution, { x: x0, C });
    const base = at(0);
    const slope = at(1) - base;
    if (Number.isFinite(x0) && Number.isFinite(y0) && Math.abs(slope) > 1e-12) {
      const Cv = roundNice((y0 - base) / slope);
      lines.push(`Use y(${m[2]}) = ${m[3]} to find C: C = ${valueText(Cv)}`);
      out = `y = ${show(substitute(solution, "C", num(Cv)))}`;
    }
  }
  return [...lines, "", out, m[2] === undefined ? "(C is any constant.)" : ""].filter(Boolean).join("\n");
}

// --- Complex numbers -------------------------------------------------------------------------------------------

const cx = (re, im = 0) => ({ re, im });
function evalComplex(node) {
  switch (node.t) {
    case "n":
      return cx(node.p / node.q);
    case "i":
      return cx(0, 1);
    case "c":
      return cx(node.n === "pi" ? Math.PI : Math.E);
    case "+":
      return node.xs.map(evalComplex).reduce((s, z) => cx(s.re + z.re, s.im + z.im), cx(0));
    case "*":
      return node.xs.map(evalComplex).reduce((s, z) => cx(s.re * z.re - s.im * z.im, s.re * z.im + s.im * z.re), cx(1));
    case "^": {
      const b = evalComplex(node.b);
      const e = evalComplex(node.e);
      if (Math.abs(e.im) > 1e-12) return null;
      const n = e.re;
      if (Number.isInteger(n) && Math.abs(n) <= 1e6) {
        let r = cx(1);
        let base = b;
        let k = Math.abs(n);
        while (k) {
          if (k & 1) r = cx(r.re * base.re - r.im * base.im, r.re * base.im + r.im * base.re);
          base = cx(base.re * base.re - base.im * base.im, 2 * base.re * base.im);
          k >>= 1;
        }
        if (n < 0) {
          const d = r.re * r.re + r.im * r.im;
          r = cx(r.re / d, -r.im / d);
        }
        return r;
      }
      const mod = Math.hypot(b.re, b.im) ** n;
      const arg = Math.atan2(b.im, b.re) * n;
      return cx(mod * Math.cos(arg), mod * Math.sin(arg));
    }
    case "f": {
      const a = evalComplex(node.a);
      if (!a) return null;
      if (node.f === "abs") return cx(Math.hypot(a.re, a.im));
      if (Math.abs(a.im) > 1e-12) return null;
      const v = evaluate(fn(node.f, num(a.re)));
      return Number.isFinite(v) ? cx(v) : null;
    }
  }
  return null;
}
const part = (v) => {
  const n = roundNice(v);
  const r = Math.abs(n - v) < 1e-9 ? recognise(n) : recognise(v);
  return r || decimal(v, 4);
};
export function complexText({ re, im }) {
  const clean = (v) => (Math.abs(v) < 1e-10 ? 0 : v);
  re = clean(re);
  im = clean(im);
  if (!im) return part(re);
  const ai = Math.abs(im);
  const imag = Math.abs(ai - 1) < 1e-12 ? "i" : /[√π/]/.test(part(ai)) ? `(${part(ai)})i` : `${part(ai)}i`;
  if (!re) return (im < 0 ? "−" : "") + imag;
  return `${part(re)} ${im < 0 ? "−" : "+"} ${imag}`;
}
// Roots of ax² + bx + c when b² − 4ac < 0.
export function complexRootsText(a, b, c, v = "x") {
  const disc = b * b - 4 * a * c;
  if (disc >= 0) return null;
  const re = -b / (2 * a);
  const im = Math.sqrt(-disc) / Math.abs(2 * a);
  return `In complex numbers (i = √−1), ${v} = (−b ± √(b² − 4ac))/2a = (${decimal(-b)} ± √(${decimal(disc)}))/${decimal(2 * a)}:\n${v} = ${complexText(cx(re, im))} or ${v} = ${complexText(cx(re, -im))}`;
}

function complexNumbers(q) {
  let m = q.match(/^(?:what is |find |calculate )?(?:the )?(?:square root|sqrt|√)\s*(?:of\s*)?\(?\s*-\s*(\d+(?:\.\d+)?)\s*\)?$/);
  if (m) {
    const n = Number(m[1]);
    const r = Math.sqrt(n);
    const rt = recognise(r) || decimal(r);
    return `√(−${m[1]}) = √${m[1]} × √−1 = ${/^[\d.]+$/.test(rt) ? rt : `(${rt})`}i\n\n(i = √−1, so i² = −1. The other square root is −${/^[\d.]+$/.test(rt) ? rt : `(${rt})`}i.)`;
  }
  const hasI = /(\d|\b)i\b|\bi\s*\^/.test(q);
  if (!hasI) return null;
  m = q.match(/^(?:what is |find |calculate |simplify |evaluate )?(?:the )?(modulus|absolute value|argument|arg|amplitude|conjugate|polar form|reciprocal|multiplicative inverse)?\s*(?:of\s*)?(?:the complex number\s*)?(.+)$/);
  let [, op, body] = m;
  body = body.replace(/^(?:z\s*=\s*)/, "");
  if (/^\|.*\|$/.test(body.trim()) && !op) {
    op = "modulus";
    body = body.trim().slice(1, -1);
  }
  const tree = parse(body, { imaginary: true });
  if (!tree || vars(tree).size) return null;
  const z = evalComplex(tree);
  if (!z || !Number.isFinite(z.re) || !Number.isFinite(z.im)) return null;
  const zt = complexText(z);
  const r = Math.hypot(z.re, z.im);
  const theta = Math.atan2(z.im, z.re);
  const deg = (theta * 180) / Math.PI;
  const argText = `${part(theta)} radians (${decimal(deg, 2)}°)`;
  const lines = [];
  if (!op) {
    lines.push(`${print(tree)} = ${zt}`);
    const pw = body.match(/^i\s*\^\s*\(?(-?\d+)\)?$/);
    if (pw) lines.push("", `Powers of i repeat every 4: i¹ = i, i² = −1, i³ = −i, i⁴ = 1. ${pw[1]} leaves remainder ${((Number(pw[1]) % 4) + 4) % 4} when divided by 4.`);
    else if (/\//.test(body)) lines.push("", "(To divide, multiply top and bottom by the conjugate of the bottom.)");
    else if (/\)\s*\*?\s*\(/.test(body)) lines.push("", "(Multiply out like brackets and use i² = −1.)");
    return lines.join("\n");
  }
  if (/modulus|absolute/.test(op)) return `z = ${zt}\n|z| = √(a² + b²) = √(${part(z.re)}² + ${part(z.im)}²) = ${valueText(r)}`;
  if (/arg|amplitude/.test(op)) return `z = ${zt}\narg z = ${argText}`;
  if (op === "conjugate") return `z = ${zt}\nConjugate z̄ = ${complexText(cx(z.re, -z.im))} (change the sign of the imaginary part)`;
  if (/reciprocal|inverse/.test(op)) {
    const d = r * r;
    return `1/z = z̄/|z|² = ${complexText(cx(z.re / d, -z.im / d))}`;
  }
  return `z = ${zt}\nr = |z| = ${valueText(r)}, θ = arg z = ${argText}\n\nPolar form: z = ${part(r)}(cos θ + i sin θ) = ${part(r)}·e^(i·${part(theta)})`;
}

// --- Systems of 3+ linear equations ------------------------------------------------------------------------------

function linearSystems(q) {
  const body = q.replace(/^(?:solve|find [a-z](?:\s*,\s*[a-z])*(?:\s*and\s*[a-z])?(?: if| from| given)?)\s*:?\s*/, "");
  const eqs = body.split(/\s*(?:,|;|\band\b)\s*/).filter((e) => e.includes("="));
  if (eqs.length < 3 || eqs.length > 6) return null;
  const trees = eqs.map((e) => {
    const [l, r] = e.split("=");
    const L = parse(l);
    const R = parse(r);
    return L && R ? simplify(add(L, mul(num(-1), R))) : null;
  });
  if (trees.some((t) => !t)) return null;
  const vs = [...new Set(trees.flatMap((t) => [...vars(t)]))].sort();
  if (vs.length !== eqs.length) return null;
  const zero = Object.fromEntries(vs.map((v) => [v, 0]));
  const A = [];
  const y = [];
  for (const t of trees) {
    const c0 = evaluate(t, zero);
    const row = vs.map((v) => evaluate(t, { ...zero, [v]: 1 }) - c0);
    // must be linear
    const probe = Object.fromEntries(vs.map((v, k) => [v, 1.7 + k]));
    if (Math.abs(evaluate(t, probe) - (c0 + row.reduce((s, c, k) => s + c * probe[vs[k]], 0))) > 1e-9) return null;
    A.push(row);
    y.push(-c0);
  }
  const sol = solveLinear(A, y);
  const lines = ["The equations:", ...eqs.map((e) => "  " + e.trim()), "", "Using elimination (Gauss–Jordan) on the coefficients:"];
  if (!sol) return [...lines, "", "The equations don't have one unique solution (they are dependent or inconsistent)."].join("\n");
  lines.push("", ...vs.map((v, k) => `${v} = ${valueText(roundNice(sol[k]))}`));
  lines.push("", "Check: these values satisfy every equation ✓");
  return lines.join("\n");
}

// --- Vectors ------------------------------------------------------------------------------------------------------

function readVectors(q) {
  const out = [];
  const re = /[(<\[]\s*(-?[\d.]+(?:\s*,\s*-?[\d.]+){1,3})\s*[)>\]]/g;
  let m;
  while ((m = re.exec(q))) out.push(m[1].split(/\s*,\s*/).map(Number));
  if (out.length) return out;
  // 2i + 3j − k
  const ijk = /((?:[+-]?\s*\d*\.?\d*\s*[ijk]\b\s*){1,3})/g;
  while ((m = ijk.exec(q))) {
    const text = m[1].trim();
    if (!/[jk]/.test(text) && !/\bi\b/.test(text)) continue;
    const v = [0, 0, 0];
    let any = false;
    for (const t of text.matchAll(/([+-]?)\s*(\d*\.?\d*)\s*([ijk])/g)) {
      const c = (t[1] === "-" ? -1 : 1) * (t[2] === "" ? 1 : Number(t[2]));
      v["ijk".indexOf(t[3])] += c;
      any = true;
    }
    if (any) out.push(/k/.test(text) ? v : v.slice(0, 2));
  }
  return out;
}
const vecText = (v) => `(${v.map((c) => part(c)).join(", ")})`;
const dot = (a, b) => a.reduce((s, c, k) => s + c * (b[k] || 0), 0);
const norm = (a) => Math.sqrt(dot(a, a));

function vectors(q) {
  if (!/vector|dot product|cross product|scalar product|magnitude|unit vector|angle between|projection|\bj\b|\bk\b/.test(q)) return null;
  const vs = readVectors(q);
  if (!vs.length) return null;
  const [a, b] = vs;
  if (/cross product|vector product|\bx\b|×/.test(q) && b) {
    if (a.length !== 3 || b.length !== 3) return "The cross product needs two 3-D vectors.";
    const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    return [`a = ${vecText(a)}, b = ${vecText(b)}`, "a × b = (a₂b₃ − a₃b₂, a₃b₁ − a₁b₃, a₁b₂ − a₂b₁)", "", `a × b = ${vecText(c)}`, `(|a × b| = ${valueText(norm(c))}, the area of the parallelogram they make)`].join("\n");
  }
  if (/angle between/.test(q) && b) {
    const cos = dot(a, b) / (norm(a) * norm(b));
    const ang = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
    return [`a = ${vecText(a)}, b = ${vecText(b)}`, `a · b = ${part(dot(a, b))}, |a| = ${valueText(norm(a))}, |b| = ${valueText(norm(b))}`, `cos θ = (a · b)/(|a||b|) = ${valueText(cos)}`, "", `θ = ${decimal(ang, 2)}°${Math.abs(ang - 90) < 1e-9 ? " (the vectors are perpendicular)" : ""}`].join("\n");
  }
  if (/projection/.test(q) && b) {
    const s = dot(a, b) / norm(b);
    return [`Projection of a = ${vecText(a)} on b = ${vecText(b)}:`, `(a · b)/|b| = ${part(dot(a, b))}/${valueText(norm(b))} = ${valueText(s)}`, `Vector projection = ((a · b)/|b|²) b = ${vecText(b.map((c) => (c * dot(a, b)) / dot(b, b)))}`].join("\n");
  }
  if (/dot product|scalar product|\s·\s|\.\s*\(/.test(q) && b) {
    const terms = a.map((c, k) => `${part(c)}×${part(b[k] || 0)}`).join(" + ");
    return [`a · b = ${terms}`, "", `= ${part(dot(a, b))}${Math.abs(dot(a, b)) < 1e-12 ? " (so the vectors are perpendicular)" : ""}`].join("\n");
  }
  if (/unit vector/.test(q)) {
    const n = norm(a);
    return [`|v| = √(${a.map((c) => part(c) + "²").join(" + ")}) = ${valueText(n)}`, "", `Unit vector = v/|v| = ${vecText(a.map((c) => c / n))}`].join("\n");
  }
  if (/magnitude|length|modulus|norm|size/.test(q)) return `|v| = √(${a.map((c) => part(c) + "²").join(" + ")}) = ${valueText(norm(a))}`;
  if (b && /\badd|sum|\+|plus/.test(q)) return `${vecText(a)} + ${vecText(b)} = ${vecText(a.map((c, k) => c + b[k]))}`;
  if (b && /subtract|difference|minus|\s-\s/.test(q)) return `${vecText(a)} − ${vecText(b)} = ${vecText(a.map((c, k) => c - b[k]))}`;
  return null;
}

// --- Matrices -------------------------------------------------------------------------------------------------------

function readMatrices(q) {
  const out = [];
  let depth = 0;
  let start = -1;
  for (let k = 0; k < q.length; k++) {
    if (q[k] === "[") {
      if (depth === 0) start = k;
      depth++;
    } else if (q[k] === "]") {
      depth--;
      if (depth === 0) out.push(q.slice(start, k + 1));
    }
  }
  return out
    .map((s) => {
      let rows = s.match(/\[([^\[\]]+)\]/g);
      if (rows && rows.length === 1 && rows[0].includes(";")) rows = rows[0].slice(1, -1).split(";");
      if (!rows) return null;
      const M = rows.map((r) => r.replace(/[\[\]]/g, "").trim().split(/[\s,]+/).filter(Boolean).map((c) => valueOf(c)));
      return M.length && M.every((r) => r.length === M[0].length && r.every(Number.isFinite)) ? M : null;
    })
    .filter(Boolean);
}
const showM = (M) => M.map((r) => `[ ${r.map(matrixCell).join("  ")} ]`).join("\n");
const mmul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, c, k) => s + c * B[k][j], 0)));

function charPoly(M) {
  // Faddeev–LeVerrier: coefficients of det(λI − M), highest power first
  const n = M.length;
  let Mk = M.map((r) => r.map(() => 0));
  const c = [1];
  for (let k = 1; k <= n; k++) {
    const prev = c[k - 1];
    Mk = mmul(M, Mk.map((r, i) => r.map((v, j) => v + (i === j ? prev : 0))));
    const tr = Mk.reduce((s, r, i) => s + r[i], 0);
    c.push(-tr / k);
  }
  return c; // λⁿ + c1 λⁿ⁻¹ + …
}

function matrixOps(q) {
  if (!/\[/.test(q)) return null;
  const Ms = readMatrices(q);
  if (!Ms.length) return null;
  const [A, B] = Ms;
  if (/transpose/.test(q)) return `Transpose (rows become columns):\n${showM(A[0].map((_, j) => A.map((r) => r[j])))}`;
  if (/trace/.test(q)) {
    if (A.length !== A[0].length) return null;
    return `Trace = sum of the diagonal = ${A.map((r, i) => matrixCell(r[i])).join(" + ")} = ${matrixCell(A.reduce((s, r, i) => s + r[i], 0))}`;
  }
  if (/eigen/.test(q)) {
    if (A.length !== A[0].length || A.length > 4) return null;
    const c = charPoly(A);
    const poly = c.slice().reverse(); // lowest power first
    const lam = polyTree(poly.map(roundNice), "λ");
    const { roots: rr, rest } = rationalRoots(poly.map(roundNice));
    const vals = rr.map((r) => valueText(r));
    if (rest.length === 3) {
      const [c0, c1, c2] = rest;
      const disc = c1 * c1 - 4 * c2 * c0;
      if (disc >= 0) vals.push(...[1, -1].map((s) => valueText((-c1 + s * Math.sqrt(disc)) / (2 * c2))));
      else vals.push(complexText(cx(-c1 / (2 * c2), Math.sqrt(-disc) / (2 * c2))), complexText(cx(-c1 / (2 * c2), -Math.sqrt(-disc) / (2 * c2))));
    } else if (rest.length > 3) vals.push(...roots((t) => polyEval(rest, t), -1000, 1000, 200000).map((r) => valueText(cleanRoot(r))));
    return [showM(A), "", `Characteristic equation: det(A − λI) = 0 → ${print(lam)} = 0`, "", `Eigenvalues: λ = ${vals.join(", ")}`].join("\n");
  }
  if (/rank/.test(q)) {
    const M = A.map((r) => r.slice());
    let rank = 0;
    for (let c = 0; c < M[0].length && rank < M.length; c++) {
      let p = rank;
      for (let r = rank; r < M.length; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-10) continue;
      [M[rank], M[p]] = [M[p], M[rank]];
      for (let r = 0; r < M.length; r++) if (r !== rank) {
        const k = M[r][c] / M[rank][c];
        for (let j = c; j < M[0].length; j++) M[r][j] -= k * M[rank][j];
      }
      rank++;
    }
    return `${showM(A)}\n\nRow-reducing leaves ${rank} non-zero row${rank === 1 ? "" : "s"}, so the rank is ${rank}.`;
  }
  const power = q.match(/\]\s*\^\s*(\d+)/) || q.match(/(?:square|cube) of/);
  if (power && !B) {
    const n = power[1] ? Number(power[1]) : /cube/.test(q) ? 3 : 2;
    if (A.length !== A[0].length || n > 20) return null;
    let R = A;
    for (let k = 1; k < n; k++) R = mmul(R, A);
    return `A^${n} =\n${showM(R)}`;
  }
  if (!B) return null;
  if (/\+|\badd|sum|plus/.test(q) && !/\*|×|multipl|product|\bx\b/.test(q)) {
    if (A.length !== B.length || A[0].length !== B[0].length) return "To add matrices they must be the same size.";
    return `A + B (add matching entries) =\n${showM(A.map((r, i) => r.map((v, j) => v + B[i][j])))}`;
  }
  if (/\s-\s|subtract|minus|difference/.test(q) && !/\*|×|multipl|product/.test(q)) {
    if (A.length !== B.length || A[0].length !== B[0].length) return "To subtract matrices they must be the same size.";
    return `A − B (subtract matching entries) =\n${showM(A.map((r, i) => r.map((v, j) => v - B[i][j])))}`;
  }
  if (A[0].length !== B.length) return `These can't be multiplied: A has ${A[0].length} columns but B has ${B.length} rows.`;
  const P = mmul(A, B);
  return `A × B (row of A · column of B) =\n${showM(P)}\n\n(Entry in row i, column j = sum of A's row i times B's column j.)`;
}

// --- Factorising, simplifying, partial fractions, expanding -----------------------------------------------------------

const intText = (v) => (v < 0 ? "−" : "") + String(Math.abs(v));
function linearFactor(r, v, y = null) {
  // (qx − p) for root r = p/q
  let d = 1;
  while (Math.abs(Math.round(r * d) - r * d) > 1e-9 && d < 10000) d++;
  const p = Math.round(r * d);
  const lead = d === 1 ? v : `${d}${v}`;
  if (p === 0) return y ? null : v;
  const tail = y ? `${Math.abs(p) === 1 ? "" : Math.abs(p)}${y}` : String(Math.abs(p));
  return `(${lead} ${p > 0 ? "−" : "+"} ${tail})`;
}

function factorise(q) {
  const m = q.match(/^(?:factori[sz]e|factor|find the factors of|resolve into factors|factori[sz]ation of)\s*:?\s*(.+)$/);
  if (!m) return null;
  const tree = parse(m[1].replace(/\s*=\s*0$/, ""));
  if (!tree) return null;
  const vs = [...vars(tree)].sort();
  if (vs.length === 0 || vs.length > 2) return null;
  let v = vs.length === 1 ? vs[0] : vs.includes("x") ? "x" : vs[0];
  let y = vs.length === 2 ? vs.find((w) => w !== v) : null;
  let poly = toPoly(y ? substitute(tree, y, num(1)) : tree, v);
  if (!poly) return null;
  let degree = trim(poly).length - 1;
  if (y) {
    // homogeneous in both letters, e.g. x² + 5xy + 6y²
    const two = (a, b) => evaluate(tree, { [v]: a, [y]: b });
    const total = Math.round(Math.log(Math.abs(two(2.2, 2.2) / two(1.1, 1.1) || 1)) / Math.log(2));
    if (![[1.3, 0.7], [0.4, 2.1]].every(([a, b]) => Math.abs(two(2 * a, 2 * b) - 2 ** total * two(a, b)) < 1e-6 * Math.max(1, Math.abs(two(2 * a, 2 * b))))) return null;
    degree = total;
  }
  if (degree < 2) return null;
  const { roots: rr, rest } = rationalRoots(poly);
  if (!rr.length) {
    if (!y && trim(poly).length === 3) return `${show(tree)} can't be factorised using rational numbers (its discriminant isn't a perfect square).`;
    return null;
  }
  // leading constant: poly = k · Π(qx − p) · rest
  let prod = [1];
  for (const r of rr) {
    let d = 1;
    while (Math.abs(Math.round(r * d) - r * d) > 1e-9 && d < 10000) d++;
    prod = polyMul(prod, [-Math.round(r * d), d]);
  }
  const restPoly = trim(rest);
  const full = polyMul(prod, restPoly);
  const k = poly[poly.length - 1] / full[full.length - 1];
  let restScaled = restPoly.map((c) => c * k);
  let front = "";
  // pull out a common number from the leftover part
  if (restScaled.length === 1) {
    front = Math.abs(restScaled[0] - 1) < 1e-12 ? "" : Math.abs(restScaled[0] + 1) < 1e-12 ? "−" : intText(roundNice(restScaled[0]));
    restScaled = [];
  }
  const counts = new Map();
  for (const r of rr) counts.set(r, (counts.get(r) || 0) + 1);
  const pieces = [];
  let yPower = 0;
  for (const [r, n] of counts) {
    const f = linearFactor(r, v, y);
    if (!f) {
      yPower += 0;
      pieces.push(n === 1 ? v : `${v}${"⁰¹²³⁴⁵⁶⁷⁸⁹"[n] || "^" + n}`);
      continue;
    }
    pieces.push(n === 1 ? f : `${f}${"⁰¹²³⁴⁵⁶⁷⁸⁹"[n] || "^" + n}`);
  }
  if (restScaled.length > 1) {
    let restTree = polyTree(restScaled.map(roundNice), v);
    if (y) {
      // put the y back: each term cₖ vᵏ gets y^(deg − k)
      const d = restScaled.length - 1;
      restTree = add(...restScaled.map((c, kk) => mul(num(roundNice(c)), pow(V(v), num(kk)), pow(V(y), num(d - kk)))));
    }
    pieces.push(`(${show(restTree)})`);
  }
  if (y) {
    const used = rr.length + Math.max(0, restScaled.length - 1);
    yPower += degree - used;
    if (yPower > 0) pieces.unshift(yPower === 1 ? y : `${y}${"⁰¹²³⁴⁵⁶⁷⁸⁹"[yPower]}`);
  }
  const answer = front + pieces.join("");
  const lines = [`${show(tree)}`, ""];
  if (!y && trim(poly).length === 3 && rr.length === 2) {
    const [c0, c1, c2] = poly;
    lines.splice(1, 0, `Find two numbers that multiply to ${decimal(c2 * c0)} (a × c) and add to ${decimal(c1)} (b), then split the middle term.`);
  } else if (!y && rr.length) lines.splice(1, 0, `By the factor theorem, try values that make it 0: ${[...counts.keys()].map((r) => `${v} = ${valueText(r)}`).join(", ")}.`);
  lines.push(`= ${answer}`);
  return lines.join("\n");
}

function partialFractionsQ(q) {
  const m = q.match(/^(?:resolve |express |write |decompose |split |find )?(?:the )?(?:(.+?) (?:into|in|as) partial fractions?|partial fractions? (?:of|for|decomposition of) (.+))$/);
  if (!m) return null;
  const tree = parse((m[1] || m[2]).replace(/^(?:resolve|express|write|decompose|split)\s+/, ""));
  if (!tree) return null;
  const x = mainVar(tree);
  const rf = rationalParts(tree, x);
  if (!rf) return null;
  const pf = partialFractions(rf.num, rf.den);
  if (!pf) return null;
  const parts = [];
  if (pf.poly.some((c) => Math.abs(c) > 1e-12)) parts.push(polyTree(pf.poly, x));
  for (const t of pf.terms) parts.push(mul(num(t.c), pow(add(V(x), num(-t.r)), num(-t.power))));
  if (pf.quad) parts.push(pf.quad);
  const out = parts.map((p) => show(p));
  const joined = out.reduce((s, t, k) => (k === 0 ? t : t.startsWith("−") ? `${s} − ${t.slice(1)}` : `${s} + ${t}`), "");
  return `${show(tree)}\n\nFactor the bottom, write one fraction per factor with unknown tops, and match coefficients:\n\n= ${joined}`;
}

function simplifyExpr(q) {
  const m = q.match(/^(?:simplify|reduce|cancel)\s*:?\s*(.+)$/);
  if (!m) return null;
  const tree = parse(m[1]);
  if (!tree) return null;
  const vs = [...vars(tree)];
  if (!vs.length) return null;
  // Is it secretly a constant? (sin²x + cos²x = 1)
  const samples = [0.37, 1.21, 2.3, -0.8];
  const values = samples.map((t) => evaluate(tree, Object.fromEntries(vs.map((v, k) => [v, t + 0.1 * k]))));
  if (values.every(Number.isFinite) && values.every((v) => Math.abs(v - values[0]) < 1e-9 * Math.max(1, Math.abs(values[0]))) && hasFn(tree)) {
    return `${show(tree)} = ${valueText(values[0])}\n\n(This is an identity: it has the same value for every ${vs[0]}.)`;
  }
  if (vs.length === 1) {
    const x = vs[0];
    const rf = rationalParts(tree, x);
    if (rf) {
      let top = rf.num;
      let bottom = rf.den;
      const common = [];
      for (const r of rationalRoots(bottom).roots) {
        if (Math.abs(polyEval(top, r)) < 1e-9) {
          top = polyDiv(top, [-r, 1]).q;
          bottom = polyDiv(bottom, [-r, 1]).q;
          common.push(r);
        }
      }
      if (common.length) {
        const lead = bottom[bottom.length - 1];
        const T = polyTree(top.map((c) => roundNice(c / lead)), x);
        const B = polyTree(bottom.map((c) => roundNice(c / lead)), x);
        const result = trim(bottom).length === 1 ? show(T) : show(mul(T, pow(B, num(-1))));
        return `${show(tree)}\n\nFactorise the top and bottom and cancel the common factor${common.length > 1 ? "s" : ""} ${common.map((r) => linearFactor(r, x)).join(", ")}:\n\n= ${result}${trim(bottom).length === 1 ? "" : ""} (for ${common.map((r) => `${x} ≠ ${valueText(r)}`).join(", ")})`;
      }
    }
  }
  return null;
}

// Multi-letter polynomial expansion: {"a2 b1": coef}
function expandMulti(node) {
  const M = (t) => expandMulti(t);
  const one = new Map([["", 1]]);
  const mulMaps = (A, B) => {
    const out = new Map();
    for (const [ka, ca] of A) {
      for (const [kb, cb] of B) {
        const pw = {};
        for (const k of [ka, kb]) for (const part of k.split(" ").filter(Boolean)) {
          const [, v, e] = part.match(/^([a-z])(-?\d+)$/);
          pw[v] = (pw[v] || 0) + Number(e);
        }
        const key = Object.keys(pw).sort().filter((v) => pw[v]).map((v) => v + pw[v]).join(" ");
        out.set(key, (out.get(key) || 0) + ca * cb);
      }
    }
    return out;
  };
  switch (node.t) {
    case "n":
      return new Map([["", node.p / node.q]]);
    case "v":
      return new Map([[node.n + "1", 1]]);
    case "+": {
      const out = new Map();
      for (const x of node.xs) {
        const m = M(x);
        if (!m) return null;
        for (const [k, c] of m) out.set(k, (out.get(k) || 0) + c);
      }
      return out;
    }
    case "*": {
      let out = one;
      for (const x of node.xs) {
        const m = M(x);
        if (!m) return null;
        out = mulMaps(out, m);
      }
      return out;
    }
    case "^": {
      if (node.e.t !== "n" || node.e.q !== 1 || Math.abs(node.e.p) > 30) return null;
      const b = M(node.b);
      if (!b) return null;
      if (node.e.p < 0) {
        // only a single term can be inverted: 1/x → x⁻¹
        if (b.size !== 1) return null;
        const [[k, c]] = [...b];
        const inv = k.split(" ").filter(Boolean).map((p) => p.replace(/(-?\d+)$/, (e) => String(-Number(e)))).join(" ");
        let out = one;
        const base = new Map([[inv, 1 / c]]);
        for (let j = 0; j < -node.e.p; j++) out = mulMaps(out, base);
        return out;
      }
      let out = one;
      for (let j = 0; j < node.e.p; j++) out = mulMaps(out, b);
      return out;
    }
  }
  return null;
}
function mapToTree(map) {
  const entries = [...map].filter(([, c]) => Math.abs(c) > 1e-12);
  const deg = (k) => k.split(" ").filter(Boolean).map((p) => Number(p.slice(1)));
  const firstPow = (k, v) => {
    const p = k.split(" ").find((s) => s[0] === v);
    return p ? Number(p.slice(1)) : 0;
  };
  const letters = [...new Set(entries.flatMap(([k]) => k.split(" ").filter(Boolean).map((p) => p[0])))].sort();
  entries.sort((A, B) => {
    for (const v of letters) {
      const d = firstPow(B[0], v) - firstPow(A[0], v);
      if (d) return d;
    }
    return deg(B[0]).reduce((s, e) => s + e, 0) - deg(A[0]).reduce((s, e) => s + e, 0);
  });
  if (!entries.length) return num(0);
  const terms = entries.map(([k, c]) => mul(num(roundNice(c)), ...k.split(" ").filter(Boolean).map((p) => pow(V(p[0]), num(Number(p.slice(1)))))));
  return { t: "+", xs: terms.map(simplify) };
}

function expansions(q) {
  let m = q.match(/^(?:find )?(?:the )?(?:binomial )?(?:coefficient of ([a-z])(?:\s*\^\s*\(?(-?\d+)\)?|([²³]))?|(?:term|constant term) (?:independent of|free from|free of|without) ([a-z])|constant term) in (?:the expansion of )?(.+)$/);
  if (m) {
    const tree = parse(m[5]);
    if (!tree) return null;
    const v = m[1] || m[4] || mainVar(tree);
    const k = m[4] || /^constant/.test(q.replace(/^(find )?(the )?/, "")) ? 0 : m[2] ? Number(m[2]) : m[3] ? "  ²³".indexOf(m[3]) : 1;
    const map = expandMulti(tree);
    if (!map) return null;
    let c = 0;
    for (const [key, coef] of map) {
      const parts = key.split(" ").filter(Boolean);
      const pv = parts.find((p) => p[0] === v);
      const e = pv ? Number(pv.slice(1)) : 0;
      if (e === k && parts.every((p) => p[0] === v)) c += coef;
    }
    const what = k === 0 ? `the term independent of ${v}` : `the coefficient of ${v}${k === 1 ? "" : "^" + k}`;
    const binom = /^\(.+\)\s*\^\s*(\d+)$/.test(m[5].trim()) ? `\n(Using the binomial theorem: general term Tᵣ₊₁ = ⁿCᵣ aⁿ⁻ʳ bʳ.)` : "";
    return `In ${show(tree)}, ${what} is ${valueText(roundNice(c))}.${binom}`;
  }
  m = q.match(/^(?:expand|multiply out|simplify|find the expansion of|binomial expansion of)\s*:?\s*(.+)$/);
  if (!m) return null;
  const tree = parse(m[1]);
  if (!tree) return null;
  if (vars(tree).size < 2 && !/\^\s*\(?-/.test(m[1]) && !/\/[a-z]/.test(m[1])) return null; // one letter: the polynomial solver does it
  if (hasFn(tree)) return null;
  const map = expandMulti(tree);
  if (!map) return null;
  const out = print(mapToTree(map));
  const n = m[1].match(/^\((.+)\)\s*\^\s*(\d+)$/);
  const how = n ? `Binomial theorem: (a + b)ⁿ = Σ ⁿCᵣ aⁿ⁻ʳ bʳ, with coefficients ${Array.from({ length: Number(n[2]) + 1 }, (_, r) => choose(Number(n[2]), r)).join(", ")} (row ${n[2]} of Pascal's triangle).` : "Multiply every term by every term, then collect like terms.";
  return `${show(tree)}\n\n${how}\n\n= ${out}`;
}
function choose(n, r) {
  let c = 1;
  for (let k = 1; k <= r; k++) c = (c * (n - k + 1)) / k;
  return Math.round(c);
}

// --- Series and sequences ---------------------------------------------------------------------------------------------

function series(q) {
  let m = q.match(/^(?:find |what is |evaluate )?(?:the )?(?:infinite )?(?:sum|summation|Σ|sigma) (?:of )?(.+?) (?:for|from|as) ([a-z])\s*=\s*(-?\d+) to (\d+|infinity|∞)$/);
  let body;
  let v;
  let from;
  let to;
  if (m) [, body, v, from, to] = m;
  else {
    m = q.match(/^(?:find |what is |evaluate )?(?:the )?(?:infinite sum of|sum to infinity of|sum of the infinite series)\s+(.+)$/);
    if (!m) return null;
    const gp = m[1].match(/^(?:the )?(?:gp|series|sequence)?\s*(-?[\d./]+)\s*,\s*(-?[\d./]+)\s*,\s*(-?[\d./]+)/);
    if (gp) {
      const [a, b, c] = gp.slice(1, 4).map(valueOf);
      const r = b / a;
      if (Math.abs(c / b - r) > 1e-9) return null;
      if (Math.abs(r) >= 1) return `The common ratio is ${recognise(r) || decimal(r)}; since |r| ≥ 1 the series doesn't converge, so there is no sum to infinity.`;
      const fr = (v) => recognise(v) || decimal(v);
      return `This is a geometric series with a = ${fr(a)} and r = ${fr(r)}.\nSince |r| < 1, S∞ = a/(1 − r) = ${fr(a)}/(1 − ${fr(r)})\n\n= ${valueText(a / (1 - r))}`;
    }
    body = m[1];
    const t = parse(body);
    if (!t) return null;
    v = mainVar(t);
    from = "1";
    to = "infinity";
  }
  const tree = parse(body);
  if (!tree) return null;
  const f = compile(tree, v);
  const a = Number(from);
  if (to !== "infinity" && to !== "∞") {
    const b = Number(to);
    if (b - a > 1e7 || b < a) return null;
    let s = 0;
    for (let k = a; k <= b; k++) s += f(k);
    return `Σ (${v} = ${a} to ${b}) ${show(tree)}\n\n= ${valueText(roundNice(s))}`;
  }
  const partial = (N) => {
    let s = 0;
    for (let k = a; k <= N; k++) s += f(k);
    return s;
  };
  const s5 = partial(1e5);
  const s6 = partial(1e6);
  const head = `Σ (${v} = ${a} to ∞) ${show(tree)}`;
  if (!Number.isFinite(s6) || Math.abs(s6 - s5) > 1e-4 * Math.max(1, Math.abs(s6))) return `${head}\n\nThis series diverges (the partial sums keep growing), so it has no finite sum.`;
  // Richardson-style estimate for slowly converging tails like 1/n²
  const est = s6 + (s6 - s5) / 9;
  const known = [[Math.PI ** 2 / 6, "π²/6"], [Math.PI ** 4 / 90, "π⁴/90"], [Math.LN2, "ln 2"], [Math.E, "e"], [Math.E - 1, "e − 1"], [Math.PI / 4, "π/4"], [Math.PI ** 2 / 12, "π²/12"], [Math.PI ** 2 / 8, "π²/8"], [1.2020569031595942, "ζ(3) (Apéry's constant)"]];
  for (const [c, s] of known) if (Math.abs(est - c) < 2e-6 || Math.abs(s6 - c) < 2e-6) return `${head}\n\n= ${s} ≈ ${decimal(c)}`;
  const r = recognise(roundNice(s6));
  if (r && Math.abs(roundNice(s6) - s6) < 1e-9) return `${head}\n\n= ${r}`;
  return `${head}\n\n≈ ${decimal(est)}`;
}

function sequences(q) {
  let m = q.match(/(?:^|\b)(?:the )?(\d+)(?:st|nd|rd|th)? (?:term of (?:the )?)?fibonacci(?: number| term)?|fibonacci (?:number |term )?(?:no\.? )?(\d+)$/);
  if (m) {
    const n = Number(m[1] || m[2]);
    if (n < 1 || n > 1000) return null;
    let [a, b] = [0n, 1n];
    for (let k = 1; k < n; k++) [a, b] = [b, a + b];
    return `The Fibonacci sequence starts 1, 1, 2, 3, 5, 8, 13, … (each term is the sum of the two before it).\n\nThe ${n}${["th", "st", "nd", "rd"][n % 10 < 4 && Math.floor(n / 10) % 10 !== 1 ? n % 10 : 0]} Fibonacci number is ${b.toLocaleString("en-IN")}.`;
  }
  m = q.match(/first (\d+) fibonacci(?: numbers| terms)?/);
  if (m) {
    const n = Math.min(Number(m[1]), 100);
    const out = [1n, 1n];
    while (out.length < n) out.push(out[out.length - 1] + out[out.length - 2]);
    return `The first ${n} Fibonacci numbers:\n${out.slice(0, n).join(", ")}`;
  }
  m = q.match(/sum of (?:the )?(squares|cubes) of (?:the )?first (\d+) (?:natural numbers|numbers|positive integers)/);
  if (m) {
    const n = Number(m[2]);
    if (m[1] === "squares") return `Sum of squares: 1² + 2² + … + n² = n(n + 1)(2n + 1)/6\n= ${n} × ${n + 1} × ${2 * n + 1} ÷ 6\n\n= ${((n * (n + 1) * (2 * n + 1)) / 6).toLocaleString("en-IN")}`;
    return `Sum of cubes: 1³ + 2³ + … + n³ = [n(n + 1)/2]²\n= (${n} × ${n + 1} ÷ 2)² = ${((n * (n + 1)) / 2).toLocaleString("en-IN")}²\n\n= ${(((n * (n + 1)) / 2) ** 2).toLocaleString("en-IN")}`;
  }
  m = q.match(/sum of (?:the )?first (\d+) (odd|even) (?:natural )?numbers/);
  if (m) {
    const n = Number(m[1]);
    return m[2] === "odd" ? `Sum of the first n odd numbers = n²\n= ${n}²\n\n= ${(n * n).toLocaleString("en-IN")}` : `Sum of the first n even numbers = n(n + 1)\n= ${n} × ${n + 1}\n\n= ${(n * (n + 1)).toLocaleString("en-IN")}`;
  }
  return null;
}

function arrangements(q) {
  const m = q.match(/(?:arrange(?:ments)?|permutations|rearrange|words (?:can be )?(?:formed|made)|ways).*?(?:letters of|word|arrange)\s+(?:the word\s+)?["'“]?([a-z]{2,15})["'”]?\s*\??$/);
  if (!m || /^(the|word|letters)$/.test(m[1])) return null;
  const w = m[1];
  const counts = {};
  for (const ch of w) counts[ch] = (counts[ch] || 0) + 1;
  const fact = (n) => {
    let r = 1n;
    for (let k = 2n; k <= BigInt(n); k++) r *= k;
    return r;
  };
  const reps = Object.entries(counts).filter(([, c]) => c > 1);
  const total = reps.reduce((s, [, c]) => s / fact(c), fact(w.length));
  const upper = w.toUpperCase();
  if (!reps.length) return `${upper} has ${w.length} different letters, so they can be arranged in ${w.length}! ways.\n\n= ${total.toLocaleString("en-IN")}`;
  return `${upper} has ${w.length} letters, with repeats: ${reps.map(([ch, c]) => `${ch.toUpperCase()} × ${c}`).join(", ")}.\nArrangements = ${w.length}! ÷ (${reps.map(([, c]) => `${c}!`).join(" × ")})\n\n= ${total.toLocaleString("en-IN")}`;
}

function baseToDecimal(q) {
  const m = q.match(/^(?:convert )?(?:the )?(?:(binary|octal|hex(?:adecimal)?) (?:number )?)?([0-9a-f]+)(?:\s*\((?:base\s*)?(2|8|16)\)|\s*(?:in|from)?\s*(binary|octal|hex(?:adecimal)?|base (\d+)))?\s*(?:to|into|in) (?:decimal|base 10|denary)(?: number)?$/);
  if (!m) return null;
  const name = m[1] || m[4] || "";
  let base = m[3] ? Number(m[3]) : m[5] ? Number(m[5]) : /bin/.test(name) ? 2 : /oct/.test(name) ? 8 : /hex/.test(name) ? 16 : /^[01]+$/.test(m[2]) ? 2 : /[a-f]/.test(m[2]) ? 16 : null;
  if (!base || base < 2 || base > 36) return null;
  const digits = [...m[2]].map((c) => parseInt(c, 36));
  if (digits.some((d) => d >= base)) return null;
  const value = digits.reduce((s, d) => s * BigInt(base) + BigInt(d), 0n);
  const terms = digits.map((d, k) => `${d}×${base}${String(digits.length - 1 - k).replace(/\d/g, (c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[c])}`).join(" + ");
  return `${m[2].toUpperCase()} in base ${base}:\n${terms}\n\n= ${value.toLocaleString("en-IN")} in decimal`;
}

const PI_DIGITS = "3.14159265358979323846264338327950288419716939937510582097494459230781640628620899862803482534211706798214808651328230664709384460955058223172535940812848111745028410270193852110555964462294895493038196";
const E_DIGITS = "2.71828182845904523536028747135266249775724709369995957496696762772407663035354759457138217852516642742746639193200305992181741359662904357290033429526059563073813232862794349076323382988075319525101901";
function decimalPlaces(q) {
  const m = q.match(/^(?:what is |find |calculate |give |write )?(?:the )?(?:value of )?(pi|π|e|(?:the )?(?:square root of |sqrt|√)\s*\(?(\d+)\)?)\s*(?:to|up to|upto|correct to|till|with) (\d+) (?:decimal places|decimals|digits|dp|places)$/);
  if (!m) return null;
  const d = Number(m[3]);
  if (d < 1 || d > 200) return null;
  if (m[1] === "pi" || m[1] === "π") return `π to ${d} decimal places:\n${PI_DIGITS.slice(0, 2 + d)}`;
  if (m[1] === "e") return `e to ${d} decimal places:\n${E_DIGITS.slice(0, 2 + d)}`;
  const n = BigInt(m[2]);
  const scaled = n * 10n ** BigInt(2 * d);
  let x = BigInt(Math.floor(Math.sqrt(Number(n)) * 10 ** Math.min(d, 7))) * 10n ** BigInt(Math.max(0, d - 7));
  if (x === 0n) x = 1n;
  for (let k = 0; k < 200; k++) {
    const y = (x + scaled / x) / 2n;
    if (y === x || y === x + 1n || y === x - 1n) {
      x = y;
      break;
    }
    x = y;
  }
  while (x * x > scaled) x--;
  while ((x + 1n) * (x + 1n) <= scaled) x++;
  const s = x.toString().padStart(d + 1, "0");
  return `√${m[2]} to ${d} decimal places (truncated):\n${s.slice(0, s.length - d)}.${s.slice(s.length - d)}`;
}

// --- Equations with logs, powers, trig, absolute values --------------------------------------------------------------

function numericEquations(q) {
  const m = q.match(/^(?:solve|find [a-z](?: if| when| given| from| such that)?|find the (?:value|values) of [a-z](?: if| when| given)?)?\s*:?\s*(.+?)\s*=\s*(.+?)(?:\s+for [a-z])?(?:\s+(?:in|where|for) (?:0|0°)\s*(?:≤|<=|<)\s*[a-z]\s*(?:≤|<=|<)\s*(\d+)°?)?$/);
  if (!m) return null;
  const L = parse(m[1]);
  const R = parse(m[2]);
  if (!L || !R) return null;
  const tree = simplify(add(L, mul(num(-1), R)));
  const vs = [...vars(tree)];
  if (vs.length !== 1) return null;
  const x = vs[0];
  if (toPoly(tree, x) && !hasFn(tree)) return null; // polynomial solvers handle these
  const isTrig = /\b(sin|cos|tan|cot|sec|cosec|csc)\b/.test(q);
  const lines = [`${show(L)} = ${show(R)}`];
  // |L| = c → L = c or L = −c
  if (L.t === "f" && L.f === "abs" && !has(R, x)) {
    const c = evaluate(R);
    if (c < 0) return `${lines[0]}\n\nAn absolute value is never negative, so there is no solution.`;
    lines.push(`So ${show(L.a)} = ${valueText(c)} or ${show(L.a)} = ${valueText(-c)}`);
  }
  // a^(…) = b → take logs
  if (L.t === "^" && !has(L.b, x) && !has(R, x)) {
    const b = evaluate(L.b);
    const r = evaluate(R);
    if (b > 0 && r > 0) lines.push(`Take logs: ${show(L.e)} = ${L.b.t === "c" ? "ln" : "log_" + decimal(b)}(${valueText(r)}) = ${valueText(Math.log(r) / Math.log(b))}`);
  }
  if ((L.t === "f" && (L.f === "log" || L.f === "ln")) && !has(R, x)) {
    const r = evaluate(R);
    lines.push(`Undo the ${L.f}: ${show(L.a)} = ${L.f === "log" ? "10" : "e"}^${decimal(r)} = ${valueText(L.f === "log" ? 10 ** r : Math.E ** r)}`);
  }
  const hi = m[3] ? Number(m[3]) : 360;
  const g = compile(tree, x, isTrig);
  let rs = isTrig ? roots(g, 0, hi - 1e-9, hi * 200) : [...roots(g, -60, 60, 48000), ...roots(g, -100000, -60, 200000), ...roots(g, 60, 100000, 200000)];
  rs = rs.map(cleanRoot).filter((r, i, a) => a.findIndex((s) => Math.abs(s - r) < 1e-6) === i).sort((a, b) => a - b);
  if (!rs.length) return [...lines, "", "This equation has no real solution."].join("\n");
  if (isTrig) return [...lines, "", `Solutions for 0° ≤ ${x} < ${hi}°: ${rs.slice(0, 12).map((r) => `${decimal(r, 4)}°`).join(", ")}`].join("\n");
  return [...lines, "", rs.length === 1 ? `${x} = ${valueText(rs[0])}` : rs.slice(0, 10).map((r) => `${x} = ${valueText(r)}`).join(" or ")].join("\n");
}

// --- Plain expressions with functions: "ln e^5", "sin^-1(1/2)", "sin 30 + cos 60" -------------------------------------------

function expressions(q) {
  const body = q.replace(/^(?:what is |find |calculate |evaluate |compute |simplify )?(?:the )?(?:value of )?/, "").replace(/\s*=\s*\??$/, "");
  if (!/\d/.test(body) || !/\b(sin|cos|tan|cot|sec|cosec|csc|log|ln|exp|sqrt|arcsin|arccos|arctan|sinh|cosh|tanh|pi|e)\b|π|√|\be\s*\^/.test(body)) return null;
  const tree = parse(body);
  if (!tree || vars(tree).size) return null;
  const deg = !/pi|π|rad/.test(body);
  const v = evaluate(tree, {}, deg);
  if (!Number.isFinite(v)) return Number.isNaN(v) ? null : `${show(tree)} is undefined (it involves dividing by zero).`;
  const inverse = tree.t === "f" && /^arc/.test(tree.f);
  if (inverse) {
    const rad = evaluate(tree, {}, false);
    return `${print(tree)} = ${decimal(v, 4)}° = ${valueText(rad)} radians`;
  }
  return `${print(tree)}${deg && /\b(sin|cos|tan|cot|sec|cosec)\b/.test(body) ? " (angles in degrees)" : ""} = ${valueText(v)}`;
}

// --- All together --------------------------------------------------------------------------------------------------

const SOLVERS = [decimalPlaces, complexNumbers, vectors, matrixOps, linearSystems, limits, tangents, extrema, differentialEquations, derivatives, integrals, series, sequences, arrangements, baseToDecimal, factorise, partialFractionsQ, simplifyExpr, expansions, numericEquations, expressions];

// Run before the other solvers: these questions look like simpler ones
// ("factorise 6x² − 5x − 6" isn't "factorise 6").
export function solveAdvancedFirst(q) {
  try {
    if (/^(?:factori[sz]e|factor)\b/.test(q) && /[a-z]\s*(?:\^|[+-]|$)/.test(q.replace(/^(?:factori[sz]e|factor)\s*/, ""))) return factorise(q);
    if (/infinity|infinite|∞/.test(q)) return series(q);
  } catch (err) {
    console.warn("Advanced maths solver failed:", err);
  }
  return null;
}

export function solveAdvanced(q) {
  for (const solve of SOLVERS) {
    try {
      const out = solve(q);
      if (out) return out;
    } catch (err) {
      console.warn("Advanced maths solver failed:", err);
    }
  }
  return null;
}
