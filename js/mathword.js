// Nova AI's own maths solver, part 2: everyday and exam word problems:
// percentages, interest, profit and loss, averages, ratios, speed/time,
// work, sequences, combinations, logarithms, trigonometry, number systems,
// Pythagoras, areas and volumes, clock angles. Step by step, no outside service.

import { fmt, exact, gcd } from "./mathsolve.js";

const N = String.raw`(-?\d+(?:\.\d+)?)`;
const P = String.raw`(?:rs\.?|₹|inr|\$)?\s*`; // money prefix
const nums = (s) => (s.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
const money = (n) => `₹${fmt(n, 2)}`;
const pct = (n) => `${fmt(n, 2)}%`;
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

// --- Percentages --------------------------------------------------------------------

function percentages(q) {
  let m = q.match(new RegExp(`^(?:what is |find )?${N} (?:is )?what (?:percent|percentage|%) of ${N}$|^what (?:percent|percentage|%) of ${N} is ${N}$|^${N} out of ${N} (?:in|as a|as) (?:percent|percentage)$|^(?:percentage|percent) of ${N} out of ${N}$`));
  if (m) {
    const [part, whole] = m[1] !== undefined ? [m[1], m[2]] : m[3] !== undefined ? [m[4], m[3]] : m[5] !== undefined ? [m[5], m[6]] : [m[7], m[8]];
    const [a, b] = [Number(part), Number(whole)];
    if (!b) return null;
    return `${fmt(a)} is ${pct((a / b) * 100)} of ${fmt(b)}.\n(${fmt(a)} ÷ ${fmt(b)} × 100 = ${pct((a / b) * 100)})`;
  }
  m = q.match(new RegExp(`^(increase|decrease|reduce) ${P}${N} by ${N}\\s*%$`));
  if (m) {
    const [x, r] = [Number(m[2]), Number(m[3])];
    const change = (x * r) / 100;
    const result = m[1] === "increase" ? x + change : x - change;
    return `${r}% of ${fmt(x)} = ${fmt(change)}\n${fmt(x)} ${m[1] === "increase" ? "+" : "−"} ${fmt(change)} = ${fmt(result)}`;
  }
  m = q.match(new RegExp(`(?:percent(?:age)?|%) (increase|decrease|change|growth) (?:from|of) ${P}${N} to ${P}${N}`));
  if (m) {
    const [a, b] = [Number(m[2]), Number(m[3])];
    if (!a) return null;
    const change = ((b - a) / a) * 100;
    return `Change = ${fmt(b)} − ${fmt(a)} = ${fmt(b - a)}\nPercentage change = ${fmt(b - a)} ÷ ${fmt(a)} × 100 = ${pct(change)}\nSo it is a ${pct(Math.abs(change))} ${change >= 0 ? "increase" : "decrease"}.`;
  }
  return null;
}

// --- Interest ---------------------------------------------------------------------------

function interest(q) {
  if (!/interest|amount/.test(q)) return null;
  const P0 = q.match(new RegExp(`(?:principal|sum|on|of|amount of|deposit(?:ed)?|invest(?:ed)?|borrow(?:ed)?)\\s*(?:of\\s*)?${P}(\\d+(?:\\.\\d+)?)`));
  const R = q.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)/);
  const T = q.match(/(\d+(?:\.\d+)?)\s*(years?|yrs?|months?)/);
  if (!P0 || !R || !T) return null;
  const principal = Number(P0[1]);
  const rate = Number(R[1]);
  const years = /month/.test(T[2]) ? Number(T[1]) / 12 : Number(T[1]);
  if (/compound/.test(q)) {
    const n = /half[- ]?year|semi[- ]?annual/.test(q) ? 2 : /quarter/.test(q) ? 4 : /month(ly)? compound|compounded monthly/.test(q) ? 12 : 1;
    const amount = principal * (1 + rate / 100 / n) ** (n * years);
    const label = { 1: "yearly", 2: "half-yearly", 4: "quarterly", 12: "monthly" }[n];
    return [
      `Compound interest (compounded ${label}):`,
      `A = P(1 + r/${n === 1 ? "100" : `(100×${n})`})^${n === 1 ? "t" : `${n}t`}`,
      `A = ${fmt(principal)} × (1 + ${fmt(rate / n, 4)}/100)^${fmt(n * years)} = ${money(amount)}`,
      `Compound interest = A − P = ${money(amount)} − ${money(principal)} = ${money(amount - principal)}`,
    ].join("\n");
  }
  const si = (principal * rate * years) / 100;
  return [
    "Simple interest:",
    `SI = P × R × T ÷ 100 = ${fmt(principal)} × ${fmt(rate)} × ${fmt(years)} ÷ 100 = ${money(si)}`,
    `Amount = P + SI = ${money(principal)} + ${money(si)} = ${money(principal + si)}`,
  ].join("\n");
}

// --- Profit, loss and discount -------------------------------------------------------------

function profitLoss(q) {
  const cp = q.match(new RegExp(`(?:cost price|cp|bought (?:it )?(?:for|at))\\s*(?:is|of|=|:)?\\s*${P}(\\d+(?:\\.\\d+)?)`));
  const sp = q.match(new RegExp(`(?:selling price|sp|sold (?:it )?(?:for|at))\\s*(?:is|of|=|:)?\\s*${P}(\\d+(?:\\.\\d+)?)`));
  const mp = q.match(new RegExp(`(?:marked price|mp|list price|price tag|price)\\s*(?:is|of|=|:)?\\s*${P}(\\d+(?:\\.\\d+)?)`));
  const disc = q.match(/discount (?:of )?(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*% (?:discount|off)/);
  const gain = q.match(/(profit|gain|loss) (?:of )?(\d+(?:\.\d+)?)\s*%/);
  if (cp && sp) {
    const [c, s] = [Number(cp[1]), Number(sp[1])];
    if (!c) return null;
    const diff = s - c;
    if (close(diff, 0)) return `Cost price = selling price = ${money(c)}, so there is no profit and no loss.`;
    const kind = diff > 0 ? "Profit" : "Loss";
    return `${kind} = ${diff > 0 ? "SP − CP" : "CP − SP"} = ${money(Math.abs(diff))}\n${kind} % = ${money(Math.abs(diff))} ÷ ${money(c)} × 100 = ${pct((Math.abs(diff) / c) * 100)}`;
  }
  if (cp && gain) {
    const c = Number(cp[1]);
    const r = Number(gain[2]);
    const loss = gain[1] === "loss";
    const s = c * (1 + ((loss ? -1 : 1) * r) / 100);
    return `SP = CP × (100 ${loss ? "−" : "+"} ${fmt(r)}) ÷ 100 = ${money(c)} × ${fmt(100 + (loss ? -r : r))} ÷ 100 = ${money(s)}`;
  }
  if (sp && gain) {
    const s = Number(sp[1]);
    const r = Number(gain[2]);
    const loss = gain[1] === "loss";
    const c = s / (1 + ((loss ? -1 : 1) * r) / 100);
    return `CP = SP × 100 ÷ (100 ${loss ? "−" : "+"} ${fmt(r)}) = ${money(s)} × 100 ÷ ${fmt(100 + (loss ? -r : r))} = ${money(c)}`;
  }
  if (mp && disc) {
    const price = Number(mp[1]);
    const d = Number(disc[1] || disc[2]);
    const off = (price * d) / 100;
    return `Discount = ${fmt(d)}% of ${money(price)} = ${money(off)}\nSelling price = ${money(price)} − ${money(off)} = ${money(price - off)}`;
  }
  return null;
}

// --- Averages and statistics ----------------------------------------------------------------

function statistics(q) {
  const m = q.match(/^(?:find |what is |calculate )?(?:the )?(average|mean|arithmetic mean|median|mode|range|sum|total|product|standard deviation|variance)(?: value)? of (?:the )?(?:numbers? |data |values? )?(?:are )?:?\s*(.+)$/);
  if (!m) return null;
  if (/first|natural|odd|even|consecutive|squares|cubes|terms/.test(m[2])) return null;
  const list = nums(m[2]);
  if (list.length < 2 || /[a-z]{3,}/.test(m[2].replace(/\band\b/g, ""))) return null;
  const n = list.length;
  const sum = list.reduce((a, b) => a + b, 0);
  const sorted = [...list].sort((a, b) => a - b);
  const kind = m[1];
  if (kind === "sum" || kind === "total") return `${list.map(fmt).join(" + ")} = ${fmt(sum)}`;
  if (kind === "product") return `${list.map(fmt).join(" × ")} = ${fmt(list.reduce((a, b) => a * b, 1))}`;
  if (/average|mean/.test(kind)) return `Sum = ${list.map(fmt).join(" + ")} = ${fmt(sum)}\nAverage = ${fmt(sum)} ÷ ${n} = ${exact(sum / n)}`;
  if (kind === "median") {
    const mid = Math.floor(n / 2);
    const med = n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return `In order: ${sorted.map(fmt).join(", ")}\n${n % 2 ? `The middle value is ${fmt(med)}.` : `The two middle values are ${fmt(sorted[mid - 1])} and ${fmt(sorted[mid])}, so the median is their average: ${fmt(med)}.`}`;
  }
  if (kind === "mode") {
    const counts = new Map();
    list.forEach((x) => counts.set(x, (counts.get(x) || 0) + 1));
    const top = Math.max(...counts.values());
    if (top === 1) return "Every value appears once, so there is no mode.";
    const modes = [...counts].filter(([, c]) => c === top).map(([x]) => fmt(x));
    return `The mode is ${modes.join(" and ")} (appears ${top} times).`;
  }
  if (kind === "range") return `Range = largest − smallest = ${fmt(sorted[n - 1])} − ${fmt(sorted[0])} = ${fmt(sorted[n - 1] - sorted[0])}`;
  const mean = sum / n;
  const variance = list.reduce((a, x) => a + (x - mean) ** 2, 0) / n;
  return `Mean = ${exact(mean)}\nVariance = average of squared differences from the mean = ${fmt(variance)}\nStandard deviation = √variance = ${fmt(Math.sqrt(variance))}\n(population formula; for a sample, divide by ${n - 1} instead: SD = ${fmt(Math.sqrt((variance * n) / (n - 1)))})`;
}

// --- Ratios ---------------------------------------------------------------------------------

function ratios(q) {
  let m = q.match(new RegExp(`(?:divide|share|split|distribute) ${P}${N}(?: \\w+)? (?:in|into|in the) (?:the )?ratio (?:of )?(\\d+(?:\\s*:\\s*\\d+)+)`));
  if (m) {
    const total = Number(m[1]);
    const parts = m[2].split(":").map(Number);
    const sum = parts.reduce((a, b) => a + b, 0);
    return `Total parts = ${parts.join(" + ")} = ${sum}\nOne part = ${fmt(total)} ÷ ${sum} = ${fmt(total / sum)}\n${parts.map((p, i) => `Share ${i + 1} = ${p} × ${fmt(total / sum)} = ${fmt((total * p) / sum)}`).join("\n")}`;
  }
  m = q.match(/(?:simplify|simplest form of|reduce) (?:the )?(?:ratio )?(\d+(?:\s*:\s*\d+)+)/);
  if (m) {
    const parts = m[1].split(":").map(Number);
    const g = parts.reduce(gcd);
    return `Divide each part by ${g} (their HCF): ${parts.join(" : ")} = ${parts.map((p) => p / g).join(" : ")}`;
  }
  return null;
}

// --- Speed, distance, time; work ---------------------------------------------------------------

function motion(q) {
  const dist = q.match(/(\d+(?:\.\d+)?)\s*(km|kilometres?|kilometers?|m|metres?|meters?|miles?)\b(?!\s*(?:\/|per|an hour|a hour))/);
  const time = q.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|seconds?|secs?|s)\b/);
  const speed = q.match(/(\d+(?:\.\d+)?)\s*(km\/h|kmph|km per hour|kilometres? per hour|kilometers? per hour|km\/hr|m\/s|metres? per second|meters? per second|mph|miles per hour)/);
  const unitOf = (u) => (/^(km|kilomet)/.test(u) ? "km" : /^mile/.test(u) ? "miles" : "m");
  const hours = (t) => (/^(m|min)/.test(t[2]) ? Number(t[1]) / 60 : /^s/.test(t[2]) ? Number(t[1]) / 3600 : Number(t[1]));
  if (/(speed|how fast|average speed|velocity)/.test(q) && dist && time && !speed) {
    const d = Number(dist[1]);
    const unit = unitOf(dist[2]);
    if (unit === "m" && /^s/.test(time[2])) return `Speed = distance ÷ time = ${fmt(d)} m ÷ ${fmt(Number(time[1]))} s = ${fmt(d / Number(time[1]))} m/s`;
    const h = hours(time);
    return `Speed = distance ÷ time = ${fmt(d)} ${unit} ÷ ${fmt(h)} h = ${fmt(d / h)} ${unit === "miles" ? "mph" : `${unit}/h`}`;
  }
  if (/(how long|time|how many hours|how much time)/.test(q) && dist && speed) {
    const t = Number(dist[1]) / Number(speed[1]);
    const hh = Math.floor(t);
    const mm = Math.round((t - hh) * 60);
    return `Time = distance ÷ speed = ${fmt(Number(dist[1]))} ÷ ${fmt(Number(speed[1]))} = ${fmt(t)} hours${mm && hh ? ` (${hh} h ${mm} min)` : ""}`;
  }
  if (/(distance|how far|how much distance)/.test(q) && speed && time) {
    const v = Number(speed[1]);
    const isMs = /m\/s|per second/.test(speed[2]);
    const t = isMs ? (/^s/.test(time[2]) ? Number(time[1]) : hours(time) * 3600) : hours(time);
    return `Distance = speed × time = ${fmt(v)} × ${fmt(t)} = ${fmt(v * t)} ${isMs ? "m" : /mph|mile/.test(speed[2]) ? "miles" : "km"}`;
  }
  let m = q.match(/(\d+(?:\.\d+)?)\s*(?:km\/h|kmph|km per hour)\s*(?:in|to|into)\s*(?:m\/s|metres? per second|meters? per second)/);
  if (m) return `${fmt(Number(m[1]))} km/h × 5/18 = ${fmt((Number(m[1]) * 5) / 18)} m/s`;
  m = q.match(/(\d+(?:\.\d+)?)\s*(?:m\/s|metres? per second|meters? per second)\s*(?:in|to|into)\s*(?:km\/h|kmph|km per hour)/);
  if (m) return `${fmt(Number(m[1]))} m/s × 18/5 = ${fmt((Number(m[1]) * 18) / 5)} km/h`;
  return null;
}

function work(q) {
  const m = q.match(/(?:a|\w+) can (?:do|finish|complete)[^.]*? in (\d+(?:\.\d+)?) days?[^.]*?(?:b|\w+) (?:can do it |can (?:do|finish|complete)[^.]*? )?in (\d+(?:\.\d+)?) days?.*(together|both|working together|combined)/);
  if (!m) return null;
  const [a, b] = [Number(m[1]), Number(m[2])];
  const t = (a * b) / (a + b);
  return `In one day: A does 1/${fmt(a)} and B does 1/${fmt(b)} of the work.\nTogether in one day: 1/${fmt(a)} + 1/${fmt(b)} = ${fmt(a + b)}/${fmt(a * b)}\nTime together = ${fmt(a * b)} ÷ ${fmt(a + b)} = ${exact(t)} days`;
}

// --- Consecutive numbers ---------------------------------------------------------------------

const COUNT = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
function consecutive(q) {
  const m = q.match(/sum of (two|three|four|five|six|seven|eight|nine|ten|\d+) consecutive (even |odd )?(?:natural |whole )?(?:numbers|integers) is (-?\d+)/);
  if (!m) return null;
  const k = COUNT[m[1]] || Number(m[1]);
  const step = m[2] ? 2 : 1;
  const S = Number(m[3]);
  // x + (x+step) + … = k·x + step·k(k−1)/2
  const x = (S - (step * k * (k - 1)) / 2) / k;
  const list = Array.from({ length: k }, (_, i) => x + i * step);
  const valid = Number.isInteger(x) && (!m[2] || (m[2] === "even " ? x % 2 === 0 : Math.abs(x % 2) === 1));
  const setup = `Let the numbers be ${list.map((_, i) => (i ? `x + ${i * step}` : "x")).join(", ")}.\n${k}x + ${(step * k * (k - 1)) / 2} = ${S}  →  x = ${fmt(x)}`;
  if (!valid) return `${setup}\n\nThat isn't a whole ${m[2] ? m[2].trim() + " " : ""}number, so no such consecutive ${m[2] ? m[2].trim() + " " : ""}numbers exist.`;
  return `${setup}\n\nThe numbers are ${list.join(", ")}.\nCheck: ${list.join(" + ")} = ${S} ✓`;
}

// --- Sequences and series ----------------------------------------------------------------------

function sequences(q) {
  let m = q.match(/sum of (?:the )?first (\d+) (natural numbers|numbers|positive integers|odd numbers|odd natural numbers|even numbers|even natural numbers|squares|square numbers|cubes|cube numbers)/);
  if (m) {
    const n = Number(m[1]);
    const kind = m[2];
    if (/odd/.test(kind)) return `Sum of the first n odd numbers = n² = ${n}² = ${fmt(n * n)}`;
    if (/even/.test(kind)) return `Sum of the first n even numbers = n(n + 1) = ${n} × ${n + 1} = ${fmt(n * (n + 1))}`;
    if (/square/.test(kind)) return `Sum of squares = n(n + 1)(2n + 1) ÷ 6 = ${n} × ${n + 1} × ${2 * n + 1} ÷ 6 = ${fmt((n * (n + 1) * (2 * n + 1)) / 6)}`;
    if (/cube/.test(kind)) return `Sum of cubes = [n(n + 1) ÷ 2]² = ${fmt((n * (n + 1)) / 2)}² = ${fmt(((n * (n + 1)) / 2) ** 2)}`;
    return `Sum = n(n + 1) ÷ 2 = ${n} × ${n + 1} ÷ 2 = ${fmt((n * (n + 1)) / 2)}`;
  }
  const listMatch = q.match(/(-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?){2,})/);
  if (!listMatch || !/(term|sequence|series|progression|\bap\b|\bgp\b|next|pattern|sum)/.test(q)) return null;
  const list = nums(listMatch[1]);
  const d = list[1] - list[0];
  const isAP = list.every((x, i) => i === 0 || close(x - list[i - 1], d));
  const r = list[0] ? list[1] / list[0] : NaN;
  const isGP = !isAP && Number.isFinite(r) && list.every((x, i) => i === 0 || close(x, list[i - 1] * r));
  const nth = q.match(/(\d+)(?:st|nd|rd|th) term/);
  const sumN = q.match(/sum of (?:the )?first (\d+) terms/);
  const a = list[0];
  if (isAP) {
    const head = `This is an arithmetic progression: first term a = ${fmt(a)}, common difference d = ${fmt(d)}.`;
    if (sumN) {
      const n = Number(sumN[1]);
      return `${head}\nSum of n terms = n/2 × [2a + (n − 1)d] = ${n}/2 × [${fmt(2 * a)} + ${n - 1} × ${fmt(d)}] = ${fmt((n / 2) * (2 * a + (n - 1) * d))}`;
    }
    if (nth) {
      const n = Number(nth[1]);
      return `${head}\nnth term = a + (n − 1)d = ${fmt(a)} + ${n - 1} × ${fmt(d)} = ${fmt(a + (n - 1) * d)}`;
    }
    return `${head}\nThe next terms are ${[1, 2, 3].map((k) => fmt(list[list.length - 1] + k * d)).join(", ")}.`;
  }
  if (isGP) {
    const head = `This is a geometric progression: first term a = ${fmt(a)}, common ratio r = ${exact(r)}.`;
    if (sumN) {
      const n = Number(sumN[1]);
      return `${head}\nSum of n terms = a(rⁿ − 1) ÷ (r − 1) = ${fmt((a * (r ** n - 1)) / (r - 1))}`;
    }
    if (nth) {
      const n = Number(nth[1]);
      return `${head}\nnth term = a × r^(n − 1) = ${fmt(a)} × ${exact(r)}^${n - 1} = ${fmt(a * r ** (n - 1))}`;
    }
    return `${head}\nThe next terms are ${[1, 2, 3].map((k) => fmt(list[list.length - 1] * r ** k)).join(", ")}.`;
  }
  // Squares, cubes, or differences that grow steadily
  const diffs = list.slice(1).map((x, i) => x - list[i]);
  const dd = diffs[1] - diffs[0];
  if (diffs.length >= 2 && diffs.every((x, i) => i === 0 || close(x - diffs[i - 1], dd)) && /next|pattern|sequence|series/.test(q)) {
    const next = [];
    let last = list[list.length - 1];
    let lastDiff = diffs[diffs.length - 1];
    for (let k = 0; k < 3; k++) {
      lastDiff += dd;
      last += lastDiff;
      next.push(fmt(last));
    }
    return `The differences are ${diffs.map(fmt).join(", ")}, which go up by ${fmt(dd)} each time.\nSo the next terms are ${next.join(", ")}.`;
  }
  return null;
}

// --- Counting ---------------------------------------------------------------------------------------

function nChooseR(n, r) {
  if (r < 0 || r > n) return 0n;
  let x = 1n;
  for (let i = 1n; i <= BigInt(r); i++) x = (x * (BigInt(n) - BigInt(r) + i)) / i;
  return x;
}
function counting(q) {
  let m = q.match(/^(\d+)\s*c\s*(\d+)$|^(\d+) choose (\d+)$|combinations? of (\d+) (?:\w+ )?(?:taken|choose|chosen) (\d+)|^ncr (?:for |with )?n\s*=\s*(\d+),? r\s*=\s*(\d+)$/);
  if (m) {
    const [n, r] = [m[1] || m[3] || m[5] || m[7], m[2] || m[4] || m[6] || m[8]].map(Number);
    if (r > n || n > 1000) return null;
    return `ⁿCᵣ = n! ÷ (r!(n − r)!) = ${n}! ÷ (${r}! × ${n - r}!) = ${nChooseR(n, r).toLocaleString("en-IN")}`;
  }
  m = q.match(/^(\d+)\s*p\s*(\d+)$|permutations? of (\d+) (?:\w+ )?(?:taken|at a time) ?(\d+)?|^npr (?:for |with )?n\s*=\s*(\d+),? r\s*=\s*(\d+)$/);
  if (m) {
    const n = Number(m[1] || m[3] || m[5]);
    const r = Number(m[2] || m[4] || m[6] || n);
    if (r > n || n > 1000) return null;
    let x = 1n;
    for (let i = 0; i < r; i++) x *= BigInt(n - i);
    return `ⁿPᵣ = n! ÷ (n − r)! = ${n}! ÷ ${n - r}! = ${x.toLocaleString("en-IN")}`;
  }
  m = q.match(/how many (?:ways|arrangements) (?:can|to) (?:you )?(?:arrange|order|seat|line up) (\d+)/);
  if (m) {
    const n = Number(m[1]);
    if (n > 170) return null;
    let x = 1n;
    for (let i = 2n; i <= BigInt(n); i++) x *= i;
    return `${n} different things can be arranged in ${n}! = ${x.toLocaleString("en-IN")} ways.`;
  }
  return null;
}

// --- Logarithms, trigonometry, angles --------------------------------------------------------------

function logs(q) {
  // "log 100" (base 10), "log base 2 of 8", "log_2 8", "log2 8"
  let m = q.match(/^(?:what is |find )?(?:the )?log(?:arithm)?(?:\s*base\s*(\d+(?:\.\d+)?)(?:\s*of)?|\s*_\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)(?=\s))?\s*(?:of\s*)?\(?\s*(\d+(?:\.\d+)?)\s*\)?$/);
  if (m) {
    const baseText = m[1] || m[2] || m[3];
    const base = baseText ? Number(baseText) : 10;
    const x = Number(m[4]);
    if (base <= 0 || base === 1 || x <= 0) return "The logarithm is only defined for positive numbers (and a base other than 1).";
    const value = Math.log(x) / Math.log(base);
    const whole = Math.round(value);
    const exactPow = close(base ** whole, x);
    return `log${base === 10 ? "" : `₍${fmt(base)}₎`} ${fmt(x)} = ${exactPow ? fmt(whole) : fmt(value, 6)}${exactPow ? `, because ${fmt(base)}${whole >= 0 && whole < 10 ? "^" + whole : "^" + whole} = ${fmt(x)}` : ""}`;
  }
  m = q.match(/^(?:what is )?(?:ln|natural log(?:arithm)?(?: of)?)\s*\(?\s*(\d+(?:\.\d+)?)\s*\)?$/);
  if (m) {
    const x = Number(m[1]);
    return x > 0 ? `ln ${fmt(x)} = ${fmt(Math.log(x), 6)}` : "The natural logarithm is only defined for positive numbers.";
  }
  return null;
}

const EXACT_TRIG = {
  sin: { 0: "0", 30: "1/2", 45: "1/√2", 60: "√3/2", 90: "1", 120: "√3/2", 135: "1/√2", 150: "1/2", 180: "0", 270: "−1", 360: "0" },
  cos: { 0: "1", 30: "√3/2", 45: "1/√2", 60: "1/2", 90: "0", 120: "−1/2", 135: "−1/√2", 150: "−√3/2", 180: "−1", 270: "0", 360: "1" },
  tan: { 0: "0", 30: "1/√3", 45: "1", 60: "√3", 90: "not defined", 120: "−√3", 135: "−1", 150: "−1/√3", 180: "0", 270: "not defined", 360: "0" },
};
function trig(q) {
  const m = q.match(/^(?:what is |find |value of )?(?:the value of )?(sin|cos|tan|cosec|csc|sec|cot)\s*\(?\s*(-?\d+(?:\.\d+)?)\s*(°|degrees?|deg|radians?|rad)?\s*\)?$/);
  if (!m) return null;
  const fn = m[1] === "csc" ? "cosec" : m[1];
  const angle = Number(m[2]);
  const rad = /rad/.test(m[3] || "") ? angle : (angle * Math.PI) / 180;
  const base = { sin: Math.sin(rad), cos: Math.cos(rad), tan: Math.tan(rad) };
  const recip = { cosec: "sin", sec: "cos", cot: "tan" }[fn];
  const deg = /rad/.test(m[3] || "") ? null : ((angle % 360) + 360) % 360;
  const unit = /rad/.test(m[3] || "") ? " radians" : "°";
  if (!recip) {
    const ex = deg !== null ? EXACT_TRIG[fn][deg] : null;
    if (ex === "not defined") return `${fn} ${fmt(angle)}° is not defined (cos ${fmt(angle)}° = 0).`;
    const v = Math.abs(base[fn]) < 1e-12 ? 0 : base[fn];
    return `${fn} ${fmt(angle)}${unit} = ${ex && ex !== fmt(v) ? `${ex} ≈ ` : ""}${fmt(v, 4)}`;
  }
  const b = base[recip];
  if (Math.abs(b) < 1e-12) return `${fn} ${fmt(angle)}${unit} is not defined (${recip} ${fmt(angle)}${unit} = 0).`;
  return `${fn} ${fmt(angle)}${unit} = 1 ÷ ${recip} ${fmt(angle)}${unit} = ${fmt(1 / b, 4)}`;
}

function angles(q) {
  let m = q.match(/^(?:convert )?(-?\d+(?:\.\d+)?)\s*(?:°|degrees?)\s*(?:in|to|into)\s*radians?$/);
  if (m) {
    const d = Number(m[1]);
    const g = gcd(Math.round(d), 180);
    const exactText = Number.isInteger(d) ? ` = ${d / g === 1 ? "" : d / g}π/${180 / g}`.replace("/1", "") : "";
    return `${fmt(d)}° × π/180${exactText} ≈ ${fmt((d * Math.PI) / 180, 4)} radians`;
  }
  m = q.match(/^(?:convert )?(-?\d+(?:\.\d+)?)\s*radians?\s*(?:in|to|into)\s*degrees?$/);
  if (m) return `${m[1]} radians × 180/π ≈ ${fmt((Number(m[1]) * 180) / Math.PI, 4)}°`;
  m = q.match(/angle between (?:the )?(?:hands|hour and minute hands)[^\d]*(\d{1,2})[:.](\d{2})/);
  if (m) {
    const h = Number(m[1]) % 12;
    const min = Number(m[2]);
    if (min >= 60) return null;
    const diff = Math.abs(30 * h - 5.5 * min);
    const angle = Math.min(diff, 360 - diff);
    return `Angle = |30 × hours − 5.5 × minutes| = |30 × ${h} − 5.5 × ${min}| = ${fmt(diff)}°${diff > 180 ? `, and the smaller angle is 360° − ${fmt(diff)}° = ${fmt(angle)}°` : ""}\nThe angle between the hands at ${m[1]}:${m[2]} is ${fmt(angle)}°.`;
  }
  return null;
}

// --- Number systems -----------------------------------------------------------------------------------

const BASES = { binary: 2, octal: 8, decimal: 10, hexadecimal: 16, hex: 16 };
function numberSystems(q) {
  let m = q.match(/^(?:convert )?(\d+) (?:in|to|into) (binary|octal|hexadecimal|hex)$/);
  if (m) {
    const n = Number(m[1]);
    const b = BASES[m[2]];
    return `${n} in ${m[2] === "hex" ? "hexadecimal" : m[2]} is ${n.toString(b).toUpperCase()}${b === 2 && n < 256 ? `\n(${n.toString(2).split("").map((bit, i, all) => `${bit}×2${sup(all.length - 1 - i)}`).join(" + ")})` : ""}`;
  }
  m = q.match(/^(?:convert )?(binary|octal|hexadecimal|hex) (?:number )?([0-9a-f]+) (?:in|to|into) decimal$|^(?:convert )?([0-9a-f]+) (?:in |from )?(binary|octal|hexadecimal|hex) (?:in|to|into) decimal$/);
  if (m) {
    const kind = m[1] || m[4];
    const digits = m[2] || m[3];
    const b = BASES[kind];
    const n = parseInt(digits, b);
    if (Number.isNaN(n) || n.toString(b) !== digits.replace(/^0+(?=.)/, "").toLowerCase()) return `${digits} isn't a valid ${kind} number.`;
    return `${digits.toUpperCase()} (${kind}) = ${fmt(n)} in decimal`;
  }
  m = q.match(/^(?:convert )?(\d+) (?:in|to|into) roman(?: numerals?)?$|^roman numerals? (?:for|of) (\d+)$|^how (?:do you )?write (\d+) in roman(?: numerals?)?$/);
  if (m) {
    let n = Number(m[1] || m[2] || m[3]);
    if (n < 1 || n > 3999) return "Roman numerals are written for numbers from 1 to 3999.";
    const map = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
    const start = n;
    let out = "";
    for (const [v, s] of map) while (n >= v) {
      out += s;
      n -= v;
    }
    return `${start} in Roman numerals is ${out}.`;
  }
  m = q.match(/^(?:what is |convert )?(?:the roman numeral )?([mdclxvi]+)(?: in (?:numbers|decimal|arabic numerals?|number))?$/);
  if (m && /^(?:what is |convert )|in (numbers|decimal|arabic|number)|roman/.test(q) && m[1].length >= 2) {
    const values = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
    const s = m[1];
    let total = 0;
    for (let i = 0; i < s.length; i++) {
      const v = values[s[i]];
      total += i + 1 < s.length && values[s[i + 1]] > v ? -v : v;
    }
    return `${s.toUpperCase()} = ${total}`;
  }
  return null;
}
const SUPS = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const sup = (n) => String(n).split("").map((c) => SUPS[c] || c).join("");

// --- Geometry ---------------------------------------------------------------------------------------

const UNIT = String.raw`\s*(mm|cm|m|km|in|inch|inches|ft|feet|units?)?`;
function dim(q, names) {
  const m = q.match(new RegExp(`\\b(?:${names})\\b\\s*(?:is|of|=|:|as)?\\s*(\\d+(?:\\.\\d+)?)${UNIT}`));
  return m ? { v: Number(m[1]), u: m[2] && !/^unit/.test(m[2]) ? m[2].replace(/^(inch|inches)$/, "in").replace(/^feet$/, "ft") : "" } : null;
}
function piNote(value, rCoef) {
  // With π = 22/7 when that gives a neat answer (radius a multiple of 7).
  return rCoef ? ` (with π = 22/7: ${fmt((value / Math.PI) * (22 / 7), 2)})` : "";
}

function geometry(q) {
  const wants = /volume/.test(q) ? "volume" : /curved surface|lateral/.test(q) ? "csa" : /surface area|total surface/.test(q) ? "tsa" : /circumference/.test(q) ? "circumference" : /perimeter/.test(q) ? "perimeter" : /area/.test(q) ? "area" : /diagonal/.test(q) ? "diagonal" : null;
  if (!wants) return null;
  const r0 = dim(q, "radius|r");
  const dia = dim(q, "diameter|d");
  const r = r0 || (dia && { v: dia.v / 2, u: dia.u });
  const side = dim(q, "side(?: length)?|edge|side of|a");
  const len = dim(q, "length|l");
  const br = dim(q, "breadth|width|b|w");
  const h = dim(q, "height|h|altitude|depth");
  const base = dim(q, "base");
  const u = (x) => (x && x.u ? ` ${x.u}` : "");
  const sq = (x) => (x && x.u ? ` ${x.u}²` : " square units");
  const cu = (x) => (x && x.u ? ` ${x.u}³` : " cubic units");
  const neat = (rv) => rv && Number.isInteger(rv / 7);
  const shape = /hemisphere/.test(q) ? "hemisphere" : /sphere|ball/.test(q) ? "sphere" : /cylinder/.test(q) ? "cylinder" : /cone/.test(q) ? "cone" : /cuboid|rectangular box|rectangular prism/.test(q) ? "cuboid" : /cube/.test(q) ? "cube" : /circle|circular/.test(q) ? "circle" : /semicircle/.test(q) ? "semicircle" : /square/.test(q) ? "square" : /rectangle|rectangular/.test(q) ? "rectangle" : /equilateral/.test(q) ? "equilateral" : /triangle/.test(q) ? "triangle" : /parallelogram/.test(q) ? "parallelogram" : /rhombus/.test(q) ? "rhombus" : /trapezium|trapezoid/.test(q) ? "trapezium" : null;
  if (!shape) return null;
  const PI = "π";
  switch (shape) {
    case "circle": {
      if (!r) return null;
      const R = r.v;
      if (wants === "area") return `Area of a circle = ${PI}r² = ${PI} × ${fmt(R)}² ≈ ${fmt(Math.PI * R * R, 2)}${sq(r)}${piNote(Math.PI * R * R, neat(R))}`;
      if (wants === "circumference" || wants === "perimeter") return `Circumference = 2${PI}r = 2 × ${PI} × ${fmt(R)} ≈ ${fmt(2 * Math.PI * R, 2)}${u(r)}${piNote(2 * Math.PI * R, neat(R))}`;
      return null;
    }
    case "semicircle": {
      if (!r) return null;
      const R = r.v;
      if (wants === "area") return `Area of a semicircle = ${PI}r²/2 ≈ ${fmt((Math.PI * R * R) / 2, 2)}${sq(r)}`;
      if (wants === "perimeter") return `Perimeter of a semicircle = ${PI}r + 2r ≈ ${fmt(Math.PI * R + 2 * R, 2)}${u(r)}`;
      return null;
    }
    case "square": {
      const s = side || len;
      if (!s) return null;
      if (wants === "area") return `Area of a square = side² = ${fmt(s.v)}² = ${fmt(s.v * s.v)}${sq(s)}`;
      if (wants === "perimeter") return `Perimeter of a square = 4 × side = 4 × ${fmt(s.v)} = ${fmt(4 * s.v)}${u(s)}`;
      if (wants === "diagonal") return `Diagonal of a square = side × √2 = ${fmt(s.v)}√2 ≈ ${fmt(s.v * Math.SQRT2, 2)}${u(s)}`;
      return null;
    }
    case "rectangle": {
      if (!len || !br) return null;
      if (wants === "area") return `Area of a rectangle = length × breadth = ${fmt(len.v)} × ${fmt(br.v)} = ${fmt(len.v * br.v)}${sq(len)}`;
      if (wants === "perimeter") return `Perimeter of a rectangle = 2(length + breadth) = 2(${fmt(len.v)} + ${fmt(br.v)}) = ${fmt(2 * (len.v + br.v))}${u(len)}`;
      if (wants === "diagonal") return `Diagonal = √(l² + b²) = √(${fmt(len.v ** 2)} + ${fmt(br.v ** 2)}) ≈ ${fmt(Math.hypot(len.v, br.v), 2)}${u(len)}`;
      return null;
    }
    case "equilateral": {
      const s = side;
      if (!s) return null;
      if (wants === "area") return `Area of an equilateral triangle = (√3/4) × side² = (√3/4) × ${fmt(s.v)}² ≈ ${fmt((Math.sqrt(3) / 4) * s.v * s.v, 2)}${sq(s)}`;
      if (wants === "perimeter") return `Perimeter = 3 × side = ${fmt(3 * s.v)}${u(s)}`;
      return null;
    }
    case "triangle": {
      const sides = q.match(/sides?(?: are| of)?(?: lengths?)? (\d+(?:\.\d+)?)\s*(?:cm|m|mm|units?)?\s*,?\s*(\d+(?:\.\d+)?)\s*(?:cm|m|mm|units?)?\s*,?\s*(?:and\s*)?(\d+(?:\.\d+)?)/);
      if (sides) {
        const [a, b, c] = sides.slice(1, 4).map(Number);
        if (a + b <= c || a + c <= b || b + c <= a) return `Sides ${a}, ${b} and ${c} can't make a triangle: any two sides must add up to more than the third.`;
        const s = (a + b + c) / 2;
        if (wants === "perimeter") return `Perimeter = ${a} + ${b} + ${c} = ${fmt(a + b + c)}`;
        const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
        return `Using Heron's formula: s = (a + b + c) ÷ 2 = ${fmt(s)}\nArea = √(s(s − a)(s − b)(s − c)) = √(${fmt(s)} × ${fmt(s - a)} × ${fmt(s - b)} × ${fmt(s - c)}) = ${fmt(area, 2)} square units`;
      }
      const b = base;
      if (wants === "area" && b && h) return `Area of a triangle = ½ × base × height = ½ × ${fmt(b.v)} × ${fmt(h.v)} = ${fmt((b.v * h.v) / 2)}${sq(b)}`;
      return null;
    }
    case "parallelogram":
      if (wants === "area" && base && h) return `Area of a parallelogram = base × height = ${fmt(base.v)} × ${fmt(h.v)} = ${fmt(base.v * h.v)}${sq(base)}`;
      return null;
    case "rhombus": {
      const d = q.match(/diagonals?(?: are| of)? (\d+(?:\.\d+)?)\s*(?:cm|m|units?)?\s*(?:and|,)\s*(\d+(?:\.\d+)?)/);
      if (wants === "area" && d) return `Area of a rhombus = ½ × d₁ × d₂ = ½ × ${d[1]} × ${d[2]} = ${fmt((Number(d[1]) * Number(d[2])) / 2)} square units`;
      return null;
    }
    case "trapezium": {
      const p = q.match(/parallel sides?(?: are| of)? (\d+(?:\.\d+)?)\s*(?:cm|m|units?)?\s*(?:and|,)\s*(\d+(?:\.\d+)?)/);
      if (wants === "area" && p && h) return `Area of a trapezium = ½ × (sum of parallel sides) × height = ½ × (${p[1]} + ${p[2]}) × ${fmt(h.v)} = ${fmt(((Number(p[1]) + Number(p[2])) / 2) * h.v)} square units`;
      return null;
    }
    case "cube": {
      const s = side || dim(q, "cube of side|cube with side");
      if (!s) return null;
      if (wants === "volume") return `Volume of a cube = side³ = ${fmt(s.v)}³ = ${fmt(s.v ** 3)}${cu(s)}`;
      if (wants === "tsa" || wants === "area") return `Total surface area of a cube = 6 × side² = 6 × ${fmt(s.v)}² = ${fmt(6 * s.v * s.v)}${sq(s)}`;
      if (wants === "csa") return `Lateral surface area of a cube = 4 × side² = ${fmt(4 * s.v * s.v)}${sq(s)}`;
      if (wants === "diagonal") return `Diagonal of a cube = side × √3 ≈ ${fmt(s.v * Math.sqrt(3), 2)}${u(s)}`;
      return null;
    }
    case "cuboid": {
      if (!len || !br || !h) return null;
      const [l, b, H] = [len.v, br.v, h.v];
      if (wants === "volume") return `Volume of a cuboid = l × b × h = ${fmt(l)} × ${fmt(b)} × ${fmt(H)} = ${fmt(l * b * H)}${cu(len)}`;
      if (wants === "tsa" || wants === "area") return `Total surface area = 2(lb + bh + hl) = 2(${fmt(l * b)} + ${fmt(b * H)} + ${fmt(H * l)}) = ${fmt(2 * (l * b + b * H + H * l))}${sq(len)}`;
      if (wants === "csa") return `Lateral surface area = 2h(l + b) = ${fmt(2 * H * (l + b))}${sq(len)}`;
      if (wants === "diagonal") return `Diagonal = √(l² + b² + h²) ≈ ${fmt(Math.sqrt(l * l + b * b + H * H), 2)}${u(len)}`;
      return null;
    }
    case "cylinder": {
      if (!r || !h) return null;
      const [R, H] = [r.v, h.v];
      if (wants === "volume") return `Volume of a cylinder = ${PI}r²h = ${PI} × ${fmt(R)}² × ${fmt(H)} ≈ ${fmt(Math.PI * R * R * H, 2)}${cu(r)}${piNote(Math.PI * R * R * H, neat(R))}`;
      if (wants === "csa") return `Curved surface area = 2${PI}rh ≈ ${fmt(2 * Math.PI * R * H, 2)}${sq(r)}${piNote(2 * Math.PI * R * H, neat(R))}`;
      if (wants === "tsa" || wants === "area") return `Total surface area = 2${PI}r(r + h) = 2 × ${PI} × ${fmt(R)} × ${fmt(R + H)} ≈ ${fmt(2 * Math.PI * R * (R + H), 2)}${sq(r)}${piNote(2 * Math.PI * R * (R + H), neat(R))}`;
      return null;
    }
    case "cone": {
      if (!r || !h) return null;
      const [R, H] = [r.v, h.v];
      const l = Math.hypot(R, H);
      if (wants === "volume") return `Volume of a cone = ⅓${PI}r²h = ⅓ × ${PI} × ${fmt(R)}² × ${fmt(H)} ≈ ${fmt((Math.PI * R * R * H) / 3, 2)}${cu(r)}${piNote((Math.PI * R * R * H) / 3, neat(R))}`;
      const slant = `Slant height l = √(r² + h²) = √(${fmt(R * R)} + ${fmt(H * H)}) ≈ ${fmt(l, 2)}`;
      if (wants === "csa") return `${slant}\nCurved surface area = ${PI}rl ≈ ${fmt(Math.PI * R * l, 2)}${sq(r)}`;
      if (wants === "tsa" || wants === "area") return `${slant}\nTotal surface area = ${PI}r(l + r) ≈ ${fmt(Math.PI * R * (l + R), 2)}${sq(r)}`;
      return null;
    }
    case "sphere": {
      if (!r) return null;
      const R = r.v;
      if (wants === "volume") return `Volume of a sphere = ⁴⁄₃${PI}r³ = ⁴⁄₃ × ${PI} × ${fmt(R)}³ ≈ ${fmt((4 / 3) * Math.PI * R ** 3, 2)}${cu(r)}${piNote((4 / 3) * Math.PI * R ** 3, neat(R))}`;
      if (wants === "tsa" || wants === "area" || wants === "csa") return `Surface area of a sphere = 4${PI}r² = 4 × ${PI} × ${fmt(R)}² ≈ ${fmt(4 * Math.PI * R * R, 2)}${sq(r)}${piNote(4 * Math.PI * R * R, neat(R))}`;
      return null;
    }
    case "hemisphere": {
      if (!r) return null;
      const R = r.v;
      if (wants === "volume") return `Volume of a hemisphere = ⅔${PI}r³ ≈ ${fmt((2 / 3) * Math.PI * R ** 3, 2)}${cu(r)}${piNote((2 / 3) * Math.PI * R ** 3, neat(R))}`;
      if (wants === "csa") return `Curved surface area of a hemisphere = 2${PI}r² ≈ ${fmt(2 * Math.PI * R * R, 2)}${sq(r)}`;
      if (wants === "tsa" || wants === "area") return `Total surface area of a hemisphere = 3${PI}r² ≈ ${fmt(3 * Math.PI * R * R, 2)}${sq(r)}${piNote(3 * Math.PI * R * R, neat(R))}`;
      return null;
    }
  }
  return null;
}

function pythagoras(q) {
  if (!/right|hypotenuse|pythag/.test(q)) return null;
  let m = q.match(/hypotenuse (?:is |of |=\s*)?(\d+(?:\.\d+)?).*?(?:side|leg|base|height|perpendicular) (?:is |of |=\s*)?(\d+(?:\.\d+)?)|(?:side|leg|base|height|perpendicular) (?:is |of |=\s*)?(\d+(?:\.\d+)?).*?hypotenuse (?:is |of |=\s*)?(\d+(?:\.\d+)?)/);
  if (m && /(other|third|remaining|missing|find the side|find the leg|find the base|find the height|find the perpendicular)/.test(q)) {
    const c = Number(m[1] || m[4]);
    const a = Number(m[2] || m[3]);
    if (a >= c) return "The hypotenuse must be the longest side of a right triangle.";
    return `By Pythagoras: other side = √(c² − a²) = √(${fmt(c * c)} − ${fmt(a * a)}) = √${fmt(c * c - a * a)} = ${exact(Math.sqrt(c * c - a * a))}`;
  }
  const two = nums(q).filter((x) => x > 0);
  if (/hypotenuse|longest side/.test(q) && two.length >= 2 && !/hypotenuse (?:is|of|=)\s*\d/.test(q)) {
    const [a, b] = two;
    return `By Pythagoras: hypotenuse = √(a² + b²) = √(${fmt(a * a)} + ${fmt(b * b)}) = √${fmt(a * a + b * b)} = ${exact(Math.sqrt(a * a + b * b))}`;
  }
  return null;
}

export function solveWordProblems(q) {
  return (
    percentages(q) ||
    interest(q) ||
    profitLoss(q) ||
    statistics(q) ||
    ratios(q) ||
    work(q) ||
    motion(q) ||
    consecutive(q) ||
    sequences(q) ||
    counting(q) ||
    logs(q) ||
    trig(q) ||
    angles(q) ||
    numberSystems(q) ||
    pythagoras(q) ||
    geometry(q)
  );
}
