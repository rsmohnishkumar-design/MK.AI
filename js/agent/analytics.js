// Nova AI's own analytical, predictive and prescriptive engines. Plain maths that
// runs on the device, with no AI model involved, so results are exact and repeatable.
// - Analytical: descriptive statistics, outliers, correlation, comparison of groups.
// - Predictive: trend fitting and forecasting with honest uncertainty ranges.
// - Prescriptive: scoring options against weighted goals and hard constraints.
// The agents use these as tools; the AI only explains the numbers.

// ---------------- reading numbers ----------------
// "12, 15, 14 18" or a CSV column → [12, 15, 14, 18]
export function numbersIn(text) {
  return (String(text).match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) || []).map((s) => Number(s.replace(/,/g, ""))).filter(Number.isFinite);
}

// CSV text → { headers, rows } (simple: commas or tabs, quotes allowed)
export function parseTable(text) {
  const lines = String(text).trim().split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const sep = lines[0].includes("\t") ? "\t" : ",";
  const split = (line) => {
    const out = [];
    let cur = "", q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === sep && !q) { out.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const first = split(lines[0]);
  const hasHeader = first.some((c) => c && !Number.isFinite(Number(c.replace(/,/g, ""))));
  const headers = hasHeader ? first : first.map((_, i) => `col${i + 1}`);
  const rows = (hasHeader ? lines.slice(1) : lines).map(split);
  return { headers, rows };
}
export function column(table, name) {
  const i = typeof name === "number" ? name : table.headers.indexOf(name);
  return table.rows.map((r) => Number(String(r[i] ?? "").replace(/,/g, ""))).filter(Number.isFinite);
}

// ---------------- analytical ----------------
const sum = (a) => a.reduce((s, x) => s + x, 0);
export const mean = (a) => (a.length ? sum(a) / a.length : NaN);
export function quantile(a, q) {
  const s = [...a].sort((x, y) => x - y);
  if (!s.length) return NaN;
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
export function stdev(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - 1));
}
export function describe(a) {
  if (!a.length) throw new Error("No numbers to analyse.");
  return {
    count: a.length, sum: round(sum(a)), mean: round(mean(a)), median: round(quantile(a, 0.5)),
    stdev: round(stdev(a)), min: Math.min(...a), max: Math.max(...a),
    q1: round(quantile(a, 0.25)), q3: round(quantile(a, 0.75)),
  };
}
// Outliers by the 1.5 × IQR rule (works for small samples, not fooled by the outlier itself)
export function outliers(a) {
  const q1 = quantile(a, 0.25), q3 = quantile(a, 0.75), iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
  return a.map((x, i) => ({ index: i, value: x })).filter((p) => p.value < lo || p.value > hi);
}
export function correlation(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 3) throw new Error("Need at least 3 pairs for a correlation.");
  const mx = mean(x.slice(0, n)), my = mean(y.slice(0, n));
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  const r = sxy / Math.sqrt(sxx * syy);
  const strength = Math.abs(r) >= 0.7 ? "strong" : Math.abs(r) >= 0.4 ? "moderate" : Math.abs(r) >= 0.2 ? "weak" : "no clear";
  return { r: round(r, 3), strength, direction: r > 0 ? "positive" : r < 0 ? "negative" : "none", n, note: "Correlation is not causation." };
}
export function compareGroups(a, b) {
  const da = describe(a), db = describe(b);
  const diff = da.mean - db.mean;
  const pooled = Math.sqrt(((a.length - 1) * stdev(a) ** 2 + (b.length - 1) * stdev(b) ** 2) / Math.max(1, a.length + b.length - 2));
  const d = pooled ? diff / pooled : 0;
  const size = Math.abs(d) >= 0.8 ? "large" : Math.abs(d) >= 0.5 ? "medium" : Math.abs(d) >= 0.2 ? "small" : "negligible";
  return { a: da, b: db, meanDifference: round(diff), effectSize: round(d, 2), effect: size };
}

// ---------------- predictive ----------------
export function linearFit(y, x = y.map((_, i) => i)) {
  const n = y.length;
  if (n < 3) throw new Error("Need at least 3 values to fit a trend.");
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
  const slope = sxy / sxx, intercept = my - slope * mx;
  const fitted = x.map((xi) => intercept + slope * xi);
  const resid = y.map((yi, i) => yi - fitted[i]);
  const se = Math.sqrt(sum(resid.map((r) => r * r)) / Math.max(1, n - 2));
  const ssTot = sum(y.map((yi) => (yi - my) ** 2));
  const r2 = ssTot ? 1 - sum(resid.map((r) => r * r)) / ssTot : 1;
  return { slope, intercept, se, r2, n, mx, sxx };
}
// Holt's linear smoothing for the level and trend, with ranges that widen with distance.
export function forecast(y, horizon = 3, { alpha = 0.5, beta = 0.3 } = {}) {
  if (!Array.isArray(y) || y.length < 4) throw new Error("Give at least 4 past values to forecast.");
  horizon = Math.max(1, Math.min(24, Math.round(horizon)));
  let level = y[0], trend = y[1] - y[0];
  const errors = [];
  for (let t = 1; t < y.length; t++) {
    const predicted = level + trend;
    errors.push(y[t] - predicted);
    const prevLevel = level;
    level = alpha * y[t] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  const rmse = Math.sqrt(mean(errors.slice(1).map((e) => e * e)) || 0);
  const fit = linearFit(y);
  const points = [];
  for (let h = 1; h <= horizon; h++) {
    const value = level + h * trend;
    const spread = 1.96 * rmse * Math.sqrt(h); // about 95% if errors are roughly normal
    points.push({ step: h, value: round(value), low: round(value - spread), high: round(value + spread) });
  }
  const confidence = y.length < 8 ? "low (few data points)" : fit.r2 > 0.8 ? "moderate (steady trend)" : "low (noisy data)";
  return {
    method: "Holt linear exponential smoothing",
    trendPerStep: round(trend), r2OfStraightLine: round(fit.r2, 3), typicalError: round(rmse), points, confidence,
    assumptions: ["The recent trend continues.", "No sudden changes (holidays, policy, shocks) that the past data doesn't show.", "Ranges are about 95% only if errors are roughly random."],
  };
}

// ---------------- prescriptive ----------------
// options: [{ name, scores: { cost: 3, time: 8 }, facts?: { price: 50000 } }]
// criteria: [{ name: "cost", weight: 2, better: "higher" | "lower" }]
// constraints: [{ fact: "price", max: 60000 }] or { fact, min }
export function decide(options, criteria, constraints = []) {
  if (!options?.length || !criteria?.length) throw new Error("Need options and criteria.");
  const totalW = sum(criteria.map((c) => Math.max(0, Number(c.weight) || 1)));
  const range = {};
  for (const c of criteria) {
    const vals = options.map((o) => Number(o.scores?.[c.name])).filter(Number.isFinite);
    range[c.name] = { min: Math.min(...vals), max: Math.max(...vals) };
  }
  const results = options.map((o) => {
    const broken = constraints.filter((k) => {
      const v = Number(o.facts?.[k.fact] ?? o.scores?.[k.fact]);
      return !Number.isFinite(v) || (k.max != null && v > k.max) || (k.min != null && v < k.min);
    }).map((k) => `${k.fact} ${k.max != null ? `over ${k.max}` : `under ${k.min}`}`);
    let score = 0;
    const parts = {};
    for (const c of criteria) {
      const v = Number(o.scores?.[c.name]);
      const { min, max } = range[c.name];
      let norm = max === min ? 1 : (v - min) / (max - min);
      if (c.better === "lower") norm = 1 - norm;
      if (!Number.isFinite(norm)) norm = 0;
      const w = (Math.max(0, Number(c.weight) || 1) / totalW) * norm;
      parts[c.name] = round(w * 100, 1);
      score += w;
    }
    return { name: o.name, score: round(score * 100, 1), parts, feasible: !broken.length, broken };
  });
  results.sort((a, b) => b.feasible - a.feasible || b.score - a.score);
  const best = results.find((r) => r.feasible);
  const runnerUp = results.filter((r) => r.feasible)[1];
  // Sensitivity: would the winner change if any one weight doubled?
  const flips = [];
  for (const c of criteria) {
    const alt = decideNoSens(options, criteria.map((k) => (k.name === c.name ? { ...k, weight: (Number(k.weight) || 1) * 2 } : k)), constraints);
    if (best && alt && alt !== best.name) flips.push(`If ${c.name} mattered twice as much, ${alt} would win.`);
  }
  return {
    recommendation: best ? best.name : null,
    margin: best && runnerUp ? round(best.score - runnerUp.score, 1) : null,
    ranking: results,
    sensitivity: flips.length ? flips : ["The winner stays the same if any single weight doubles."],
    note: best ? null : "No option meets every constraint.",
  };
}
function decideNoSens(options, criteria, constraints) {
  const r = decideCore(options, criteria, constraints);
  return r.find((x) => x.feasible)?.name || null;
}
function decideCore(options, criteria, constraints) {
  const totalW = sum(criteria.map((c) => Math.max(0, Number(c.weight) || 1)));
  return options.map((o) => {
    const ok = constraints.every((k) => {
      const v = Number(o.facts?.[k.fact] ?? o.scores?.[k.fact]);
      return Number.isFinite(v) && !(k.max != null && v > k.max) && !(k.min != null && v < k.min);
    });
    let score = 0;
    for (const c of criteria) {
      const vals = options.map((p) => Number(p.scores?.[c.name])).filter(Number.isFinite);
      const min = Math.min(...vals), max = Math.max(...vals), v = Number(o.scores?.[c.name]);
      let norm = max === min ? 1 : (v - min) / (max - min);
      if (c.better === "lower") norm = 1 - norm;
      score += (Math.max(0, Number(c.weight) || 1) / totalW) * (Number.isFinite(norm) ? norm : 0);
    }
    return { name: o.name, score, feasible: ok };
  }).sort((a, b) => b.feasible - a.feasible || b.score - a.score);
}

// ---------------- safe calculator ----------------
// + - * / ^ % ( ) and sqrt sin cos tan log ln abs round floor ceil, pi, e. No eval.
const FN = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10, ln: Math.log, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil, exp: Math.exp };
export function calculate(expr) {
  const src = String(expr).toLowerCase().replace(/×/g, "*").replace(/÷/g, "/").replace(/\s+/g, "");
  if (!src || src.length > 300) throw new Error("Give a maths expression.");
  let i = 0;
  const peek = () => src[i];
  const num = () => {
    const m = src.slice(i).match(/^(\d+(\.\d+)?|\.\d+)(e[+-]?\d+)?/);
    if (!m) throw new Error(`Unexpected "${src.slice(i, i + 5)}"`);
    i += m[0].length;
    return Number(m[0]);
  };
  function primary() {
    if (peek() === "(") { i++; const v = expr0(); if (src[i++] !== ")") throw new Error("Missing )"); return v; }
    if (peek() === "-") { i++; return -factor(); }
    if (peek() === "+") { i++; return factor(); }
    const word = src.slice(i).match(/^[a-z]+/)?.[0];
    if (word) {
      i += word.length;
      if (word === "pi") return Math.PI;
      if (word === "e") return Math.E;
      if (!FN[word]) throw new Error(`Unknown function ${word}`);
      if (src[i++] !== "(") throw new Error(`${word} needs ( )`);
      const v = expr0();
      if (src[i++] !== ")") throw new Error("Missing )");
      return FN[word](v);
    }
    return num();
  }
  function factor() {
    let v = primary();
    while (peek() === "%") { i++; v = v / 100; }
    if (peek() === "^") { i++; return v ** factor(); }
    return v;
  }
  function term() {
    let v = factor();
    for (;;) {
      if (peek() === "*") { i++; v *= factor(); }
      else if (peek() === "/") { i++; const d = factor(); if (d === 0) throw new Error("Division by zero"); v /= d; }
      else return v;
    }
  }
  function expr0() {
    let v = term();
    for (;;) {
      if (peek() === "+") { i++; v += term(); }
      else if (peek() === "-") { i++; v -= term(); }
      else return v;
    }
  }
  const v = expr0();
  if (i !== src.length) throw new Error(`Unexpected "${src.slice(i, i + 5)}"`);
  if (!Number.isFinite(v)) throw new Error("The result isn't a finite number.");
  return round(v, 10);
}

export function round(x, d = 2) {
  if (!Number.isFinite(x)) return x;
  const f = 10 ** d;
  return Math.round(x * f) / f;
}
