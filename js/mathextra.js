// MK.ai's own maths solver, part 4: everyday school maths. Multiplication
// tables, calendar questions, decimals/fractions/percentages, rounding,
// surds and roots, coordinate geometry, unit conversions (time, data, area,
// volume), and classic exam problems: unitary method, successive discounts,
// average speed, trains, boats and streams, and ages.

import { fmt, exact, gcd } from "./mathsolve.js";

const N = String.raw`(-?\d+(?:\.\d+)?)`;
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twice: 2, thrice: 3, double: 2, triple: 3, half: 0.5 };
const num = (s) => (s in WORDNUM ? WORDNUM[s] : Number(s));

// --- Multiplication tables ----------------------------------------------------------------

function tables(q) {
  const m = q.match(/^(?:multiplication )?table (?:of|for) (\d+)(?: (?:up ?to|till|to) (\d+))?$|^(\d+)(?:s)? (?:multiplication )?table(?: (?:up ?to|till|to) (\d+))?$|^(?:say|write|tell) (?:the )?(\d+) table$/);
  if (!m) return null;
  const n = Number(m[1] || m[3] || m[5]);
  const upto = Number(m[2] || m[4] || 10);
  if (upto > 50 || n > 100000) return null;
  return [`Multiplication table of ${n}:`, ...Array.from({ length: upto }, (_, i) => `${n} × ${i + 1} = ${fmt(n * (i + 1))}`)].join("\n");
}

// --- Calendar ---------------------------------------------------------------------------------

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MON = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function parseDate(text) {
  let m = text.match(new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?(?: of)? ${MON},? (\\d{3,4})`));
  if (m) return { d: Number(m[1]), m: MONTHS.findIndex((x) => x.startsWith(m[2].slice(0, 3))), y: Number(m[3]) };
  m = text.match(new RegExp(`${MON} (\\d{1,2})(?:st|nd|rd|th)?,? (\\d{3,4})`));
  if (m) return { d: Number(m[2]), m: MONTHS.findIndex((x) => x.startsWith(m[1].slice(0, 3))), y: Number(m[3]) };
  m = text.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return { d: Number(m[1]), m: Number(m[2]) - 1, y: Number(m[3]) }; // Indian order: day/month/year
  return null;
}
const utc = (x) => Date.UTC(x.y, x.m, x.d);
const valid = (x) => x && x.m >= 0 && new Date(utc(x)).getUTCDate() === x.d && x.y >= 1;
const show = (x) => `${x.d} ${MONTHS[x.m][0].toUpperCase()}${MONTHS[x.m].slice(1)} ${x.y}`;

function calendar(q) {
  if (/what day|which day|day of the week|weekday/.test(q)) {
    const dt = parseDate(q);
    if (!valid(dt)) return null;
    const day = DAYS[new Date(utc(dt)).getUTCDay()];
    const past = utc(dt) < Date.now();
    return `${show(dt)} ${past ? "was" : "is"} a ${day}.`;
  }
  if (/how many days|days between|number of days/.test(q)) {
    const parts = q.split(/\band\b|\bto\b|\buntil\b|\btill\b/);
    const dates = parts.map(parseDate).filter(valid);
    if (dates.length === 2) {
      const days = Math.round(Math.abs(utc(dates[1]) - utc(dates[0])) / 86400000);
      return `From ${show(dates[0])} to ${show(dates[1])} is ${fmt(days)} days (about ${fmt(days / 7, 1)} weeks).`;
    }
  }
  let m = q.match(/^is (\d{3,4}) a leap year$/);
  if (m) {
    const y = Number(m[1]);
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const why = y % 400 === 0 ? "it divides by 400" : y % 100 === 0 ? "century years must divide by 400" : y % 4 === 0 ? "it divides by 4" : "it doesn't divide by 4";
    return `${leap ? "Yes" : "No"}, ${y} is ${leap ? "" : "not "}a leap year (${why}).`;
  }
  m = q.match(/(?:how old (?:am i|is (?:someone|a person|he|she))|age of (?:someone|a person)|my age)(?: if (?:i was |i am |he was |she was )?)?(?: born)? in (\d{4})/);
  if (m) {
    const y = Number(m[1]);
    const now = new Date().getFullYear();
    if (y > now) return null;
    return `Someone born in ${y} turns ${now - y} in ${now} (they are ${now - y - 1} until their birthday this year).`;
  }
  return null;
}

// --- Decimals, fractions, percentages; rounding ------------------------------------------------------

function conversionsNumeric(q) {
  let m = q.match(/^(?:convert )?(\d*\.\d+) (?:as a|to a|to|into|in) fraction$/);
  if (m) {
    const x = Number(m[1]);
    const places = m[1].split(".")[1].length;
    const d = 10 ** places;
    const n = Math.round(x * d);
    const g = gcd(n, d);
    return `${m[1]} = ${n}/${d} = ${n / g}/${d / g}${n / g > d / g ? ` = ${Math.floor(n / d)} ${(n / g) % (d / g)}/${d / g}` : ""}`;
  }
  m = q.match(/^(?:convert )?(\d+)\s*\/\s*(\d+) (?:as a |to a |to |into |in )?(decimal|percent(?:age)?|%)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (!b) return null;
    return /dec/.test(m[3]) ? `${a}/${b} = ${a} ÷ ${b} = ${fmt(a / b, 6)}` : `${a}/${b} × 100 = ${fmt((a / b) * 100, 4)}%`;
  }
  m = q.match(/^(?:convert )?(\d*\.?\d+) (?:as a |to a |to |into |in )?(?:percent(?:age)?|%)$/);
  if (m) return `${m[1]} × 100 = ${fmt(Number(m[1]) * 100, 4)}%`;
  m = q.match(/^(?:convert )?(\d+(?:\.\d+)?)\s*% (?:as a |to a |to |into |in )?(fraction|decimal)$/);
  if (m) {
    const p = Number(m[1]);
    if (m[2] === "decimal") return `${m[1]}% = ${m[1]} ÷ 100 = ${fmt(p / 100, 6)}`;
    const places = (m[1].split(".")[1] || "").length;
    const n = Math.round(p * 10 ** places);
    const d = 100 * 10 ** places;
    const g = gcd(n, d);
    return `${m[1]}% = ${n}/${d} = ${n / g}/${d / g}`;
  }
  m = q.match(/^round (?:off )?(-?\d+(?:\.\d+)?) to (?:the )?(?:nearest )?(\d+|one|two|three|four) (?:decimal places?|dp|decimals?)$|^round (?:off )?(-?\d+(?:\.\d+)?) to (?:the )?nearest (whole number|integer|ten|hundred|thousand|tenth|hundredth|thousandth)$/);
  if (m) {
    if (m[1] !== undefined) {
      const places = num(m[2]);
      const factor = 10 ** places;
      return `${m[1]} rounded to ${places} decimal place${places === 1 ? "" : "s"} is ${(Math.round(Number(m[1]) * factor) / factor).toFixed(places)}.`;
    }
    const step = { "whole number": 1, integer: 1, ten: 10, hundred: 100, thousand: 1000, tenth: 0.1, hundredth: 0.01, thousandth: 0.001 }[m[4]];
    const r = Math.round(Number(m[3]) / step) * step;
    return `${m[3]} rounded to the nearest ${m[4]} is ${fmt(r, 3)}.`;
  }
  return null;
}

// --- Surds and roots ----------------------------------------------------------------------------------

function roots(q) {
  let m = q.match(/^simplify (?:√|root |sqrt|square root of )\s*\(?(\d+)\)?$/);
  if (m) {
    const n = Number(m[1]);
    let outside = 1;
    let inside = n;
    for (let k = Math.floor(Math.sqrt(n)); k > 1; k--) {
      if (n % (k * k) === 0) {
        outside = k;
        inside = n / (k * k);
        break;
      }
    }
    if (inside === 1) return `√${n} = ${outside} (${n} is a perfect square).`;
    if (outside === 1) return `√${n} can't be simplified: ${n} has no square factor except 1.`;
    return `√${n} = √(${outside * outside} × ${inside}) = ${outside}√${inside} ≈ ${fmt(Math.sqrt(n), 4)}`;
  }
  m = q.match(/^(?:the )?(\d+)(?:st|nd|rd|th) root of (\d+(?:\.\d+)?)$|^(fourth|fifth|sixth) root of (\d+(?:\.\d+)?)$/);
  if (m) {
    const k = Number(m[1]) || { fourth: 4, fifth: 5, sixth: 6 }[m[3]];
    const x = Number(m[2] || m[4]);
    const r = x ** (1 / k);
    const whole = Math.round(r);
    return close(whole ** k, x) ? `The ${k}th root of ${fmt(x)} is ${whole}, because ${whole}^${k} = ${fmt(x)}.` : `The ${k}th root of ${fmt(x)} ≈ ${fmt(r, 6)}`;
  }
  return null;
}

// --- Coordinate geometry --------------------------------------------------------------------------------

const PT = String.raw`\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)`;
function coordinates(q) {
  const pts = [...q.matchAll(new RegExp(PT, "g"))].map((m) => [Number(m[1]), Number(m[2])]);
  if (pts.length < 2) return null;
  const [[x1, y1], [x2, y2]] = pts;
  const p = (x, y) => `(${fmt(x)}, ${fmt(y)})`;
  if (/area/.test(q) && pts.length >= 3 && /triangle/.test(q)) {
    const [x3, y3] = pts[2];
    const area = Math.abs(x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)) / 2;
    return `Area = ½ |x₁(y₂ − y₃) + x₂(y₃ − y₁) + x₃(y₁ − y₂)| = ${exact(area)} square units${area === 0 ? " (the points are on one line)" : ""}`;
  }
  if (/distance|length/.test(q)) {
    const d = Math.hypot(x2 - x1, y2 - y1);
    return `Distance = √((x₂ − x₁)² + (y₂ − y₁)²) = √(${fmt((x2 - x1) ** 2)} + ${fmt((y2 - y1) ** 2)}) = √${fmt((x2 - x1) ** 2 + (y2 - y1) ** 2)} = ${exact(d)}`;
  }
  if (/mid ?point/.test(q)) return `Midpoint = ((x₁ + x₂)/2, (y₁ + y₂)/2) = ${p((x1 + x2) / 2, (y1 + y2) / 2)}`;
  if (/slope|gradient|equation|line/.test(q)) {
    if (close(x1, x2)) return `The line through ${p(x1, y1)} and ${p(x2, y2)} is vertical: x = ${fmt(x1)} (its slope is undefined).`;
    const mSlope = (y2 - y1) / (x2 - x1);
    const c = y1 - mSlope * x1;
    const slopeLine = `Slope m = (y₂ − y₁) ÷ (x₂ − x₁) = ${fmt(y2 - y1)} ÷ ${fmt(x2 - x1)} = ${exact(mSlope)}`;
    if (/slope|gradient/.test(q) && !/equation/.test(q)) return slopeLine;
    const mText = exact(mSlope).split(" ≈")[0];
    return `${slopeLine}\nIntercept c = y₁ − m·x₁ = ${exact(c).split(" ≈")[0]}\nEquation: y = ${mText === "1" ? "" : mText === "−1" ? "−" : mText}x ${c < 0 ? "−" : "+"} ${exact(Math.abs(c)).split(" ≈")[0]}`;
  }
  return null;
}

// --- Units: time, data, area, volume --------------------------------------------------------------------

const UNIT_GROUPS = {
  time: { second: 1, sec: 1, minute: 60, min: 60, hour: 3600, hr: 3600, day: 86400, week: 604800, month: 2629800, year: 31557600, decade: 315576000, century: 3155760000 },
  data: { bit: 1 / 8, byte: 1, kb: 1024, kilobyte: 1024, mb: 1024 ** 2, megabyte: 1024 ** 2, gb: 1024 ** 3, gigabyte: 1024 ** 3, tb: 1024 ** 4, terabyte: 1024 ** 4 },
  area: { "square metre": 1, "square meter": 1, "sq m": 1, "m2": 1, "square km": 1e6, "square kilometre": 1e6, "square kilometer": 1e6, "km2": 1e6, "square cm": 1e-4, "cm2": 1e-4, hectare: 1e4, acre: 4046.8564224, "square foot": 0.09290304, "square feet": 0.09290304, "sq ft": 0.09290304, cent: 40.468564224 },
  volume: { litre: 1, liter: 1, l: 1, millilitre: 0.001, milliliter: 0.001, ml: 0.001, "cubic metre": 1000, "cubic meter": 1000, m3: 1000, "cubic cm": 0.001, cc: 0.001, cm3: 0.001, gallon: 3.785411784 },
};
function findUnit(word) {
  const w = word.trim().replace(/s$/, "").replace(/ies$/, "y");
  for (const [group, table] of Object.entries(UNIT_GROUPS)) {
    for (const name of Object.keys(table)) if (name === w || name === word.trim() || `${name}s` === word.trim()) return { group, name, factor: table[name] };
  }
  return null;
}
function units(q) {
  const m = q.match(/^(?:convert |how many )?(\d+(?:\.\d+)?)?\s*([a-z0-9 ]+?)\s+(?:in|to|into|are in|are there in|make|equals?|=)\s+(?:a |an |one |(\d+(?:\.\d+)?) )?([a-z0-9 ]+?)$/);
  if (!m) return null;
  // "how many minutes in 5 hours" or "5 hours to minutes"
  let [value, from, to] = [m[1], m[2], m[4]];
  let amount = m[3];
  if (!value && /^how many/.test(q)) {
    [from, to] = [m[4], m[2]];
    value = amount || "1";
  }
  if (!value) return null;
  const F = findUnit(from);
  const T = findUnit(to);
  if (!F || !T || F.group !== T.group || F.name === T.name) return null;
  const result = (Number(value) * F.factor) / T.factor;
  const note = F.group === "time" && /month|year/.test(`${F.name}${T.name}`) ? " (using an average year of 365.25 days)" : F.group === "data" ? " (1 KB = 1024 bytes)" : "";
  // Short forms stay short: "2 GB = 2,048 MB"; words take a plural: "5 hours"
  const label = (name, n) => (/^(kb|mb|gb|tb|ml|l|cc|m2|km2|cm2|m3|cm3|sq m|sq ft)$/.test(name) ? name.toUpperCase().replace("ML", "ml").replace(/^L$/, "L") : `${name}${close(n, 1) ? "" : name.endsWith("y") && !/day$/.test(name) ? "" : "s"}`.replace(/centurys$/, "centuries").replace(/foots$/, "feet").replace(/feets$/, "feet"));
  return `${fmt(Number(value))} ${label(F.name, Number(value))} = ${fmt(result, 4)} ${label(T.name, result)}${note}`;
}

// --- Classic exam problems -------------------------------------------------------------------------------------

function examProblems(q) {
  // Unitary method: "if 5 pens cost 60 rupees, how much do 8 pens cost"
  let m = q.match(/(\d+(?:\.\d+)?) ([a-z]+?)s? costs? (?:rs\.? ?|₹ ?)?(\d+(?:\.\d+)?)(?: rupees| rs)?.*?(?:how much|what) (?:do|does|will|would)? ?(\d+(?:\.\d+)?) \2/);
  if (m) {
    const [n1, price, n2] = [Number(m[1]), Number(m[3]), Number(m[4])];
    return `Cost of 1 ${m[2]} = ${fmt(price)} ÷ ${fmt(n1)} = ₹${fmt(price / n1, 2)}\nCost of ${fmt(n2)} = ${fmt(n2)} × ${fmt(price / n1, 4)} = ₹${fmt((price / n1) * n2, 2)}`;
  }
  // Successive discounts
  m = q.match(/successive (?:discounts?|increases?|decreases?) (?:of )?(\d+(?:\.\d+)?)\s*%\s*(?:and|,)\s*(\d+(?:\.\d+)?)\s*%/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    const inc = /increase/.test(q);
    const net = inc ? a + b + (a * b) / 100 : a + b - (a * b) / 100;
    return `Single equivalent ${inc ? "increase" : "discount"} = a + b ${inc ? "+" : "−"} ab/100 = ${fmt(a)} + ${fmt(b)} ${inc ? "+" : "−"} ${fmt((a * b) / 100)} = ${fmt(net)}%`;
  }
  // Average speed for a round trip
  m = q.match(/(?:goes|travels|drives|walks|rides|went|travelled|traveled)[^.]*?(?:at|with a speed of) (\d+(?:\.\d+)?) ?(?:km\/h|kmph|km per hour|m\/s)?[^.]*?(?:returns?|comes? back|back)[^.]*?(?:at|with) (\d+(?:\.\d+)?)/);
  if (m && /average speed/.test(q)) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return `For equal distances, average speed = 2ab ÷ (a + b) = 2 × ${fmt(a)} × ${fmt(b)} ÷ ${fmt(a + b)} = ${exact((2 * a * b) / (a + b))}\n(Not the simple average ${fmt((a + b) / 2)}: more time is spent at the slower speed.)`;
  }
  // Trains
  m = q.match(/train (?:of length |which is )?(\d+(?:\.\d+)?) ?m(?:etres?|eters?)? long[^.]*?(\d+(?:\.\d+)?) ?(km\/h|kmph|km per hour|m\/s)/) || q.match(/(\d+(?:\.\d+)?) ?m(?:etres?|eters?)? long train[^.]*?(\d+(?:\.\d+)?) ?(km\/h|kmph|km per hour|m\/s)/);
  if (m && /cross|pass/.test(q)) {
    const L = Number(m[1]);
    const v = /m\/s/.test(m[3]) ? Number(m[2]) : (Number(m[2]) * 5) / 18;
    const plat = q.match(/(?:platform|bridge|tunnel)(?: of length| which is)? (\d+(?:\.\d+)?) ?m|(\d+(?:\.\d+)?) ?m(?:etres?|eters?)? long (?:platform|bridge|tunnel)/);
    const extra = plat ? Number(plat[1] || plat[2]) : 0;
    const speedLine = /m\/s/.test(m[3]) ? `Speed = ${fmt(v)} m/s` : `Speed = ${fmt(Number(m[2]))} × 5/18 = ${fmt(v, 4)} m/s`;
    return `${speedLine}\nDistance to cover = ${extra ? `train + ${/bridge/.test(q) ? "bridge" : /tunnel/.test(q) ? "tunnel" : "platform"} = ${fmt(L)} + ${fmt(extra)}` : "length of the train"} = ${fmt(L + extra)} m\nTime = ${fmt(L + extra)} ÷ ${fmt(v, 4)} = ${fmt((L + extra) / v, 2)} seconds`;
  }
  // Boats and streams
  m = q.match(/(?:speed of (?:a |the )?boat|boat(?:'s)? speed)(?: in still water)?(?: is)? (\d+(?:\.\d+)?)[^.]*?(?:speed of (?:the )?(?:stream|current|river)|stream(?:'s)? speed|current)(?: is)? (\d+(?:\.\d+)?)/);
  if (m) {
    const [b, s] = [Number(m[1]), Number(m[2])];
    return `Downstream speed = boat + stream = ${fmt(b)} + ${fmt(s)} = ${fmt(b + s)}\nUpstream speed = boat − stream = ${fmt(b)} − ${fmt(s)} = ${fmt(b - s)}`;
  }
  // Ages: "A is k times as old as B" with the sum or difference of their ages
  m = q.match(/(?:is|was) (\d+(?:\.\d+)?|twice|thrice|three|four|five|two) times? (?:as old as|the age of)|(?:is|was) (twice|thrice|double) (?:as old as|the age of)/);
  const sum = q.match(/sum of (?:their|the) ages (?:is|was) (\d+(?:\.\d+)?)/);
  const diff = q.match(/difference (?:of|between|in) (?:their|the) ages (?:is|was) (\d+(?:\.\d+)?)|(\d+(?:\.\d+)?) years older/);
  if (m && (sum || diff) && !/years? (?:ago|hence|later|after|before)/.test(q)) {
    const k = num(m[1] || m[2]);
    if (!(k > 1)) return null;
    if (sum) {
      const S = Number(sum[1]);
      const young = S / (k + 1);
      return `Let the younger person's age be x; the older is ${fmt(k)}x.\nx + ${fmt(k)}x = ${fmt(S)}  →  ${fmt(k + 1)}x = ${fmt(S)}  →  x = ${exact(young)}\nSo the ages are ${exact(young)} and ${exact(k * young)} years.`;
    }
    const D = Number(diff[1] || diff[2]);
    const young = D / (k - 1);
    return `Let the younger person's age be x; the older is ${fmt(k)}x.\n${fmt(k)}x − x = ${fmt(D)}  →  x = ${exact(young)}\nSo the ages are ${exact(young)} and ${exact(k * young)} years.`;
  }
  return null;
}

export function solveEveryday(q) {
  return tables(q) || calendar(q) || conversionsNumeric(q) || roots(q) || coordinates(q) || examProblems(q) || units(q);
}
