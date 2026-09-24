// MK.ai's own algebra: two-number word problems ("the difference of two
// numbers is 5 and their product is -2") and quadratic equations
// ("solve x^2 - 5x + 6 = 0"), solved step by step with exact roots.

const N = String.raw`(-?\d+(?:\.\d+)?)`;

function clean(question) {
  return question
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/²/g, "^2")
    .replace(/\s+/g, " ")
    .replace(/[?!.]+$/, "")
    .trim();
}

// 3 → "3", -0.5 → "−0.5", 4.5616 → "4.562" (up to 3 decimals, Indian grouping).
function num(n) {
  const r = Math.round(n * 1000) / 1000;
  const s = Math.abs(r).toLocaleString("en-IN", { maximumFractionDigits: 3 });
  return (r < 0 ? "−" : "") + s;
}
const signed = (n) => (n < 0 ? `− ${num(-n)}` : `+ ${num(n)}`);
// "+ 5y", "− y" (a coefficient of 1 isn't written)
const term = (n, letter) => (Math.abs(n) === 1 ? `${n < 0 ? "−" : "+"} ${letter}` : `${signed(n)}${letter}`);
const paren = (n) => (n < 0 ? `(${num(n)})` : num(n));

// √d simplified: √18 → 3√2. Returns { whole, inner } with d = whole² × inner.
function simplifyRoot(d) {
  let whole = 1;
  let inner = d;
  for (let k = Math.floor(Math.sqrt(d)); k > 1; k--) {
    if (Number.isInteger(d) && d % (k * k) === 0) {
      whole = k;
      inner = d / (k * k);
      break;
    }
  }
  return { whole, inner };
}

// Roots of a·t² + b·t + c = 0: exact text and numeric values.
function quadraticRoots(a, b, c) {
  const disc = b * b - 4 * a * c;
  if (disc < 0) return { disc, real: false };
  const sq = Math.sqrt(disc);
  const values = [(-b + sq) / (2 * a), (-b - sq) / (2 * a)];
  const isWhole = Number.isInteger(sq) || !Number.isInteger(disc);
  if (isWhole) return { disc, real: true, values, exact: values.map(num) };
  const { whole, inner } = simplifyRoot(disc);
  const root = `${whole > 1 ? whole : ""}√${inner}`;
  const top = (sign) => `${b === 0 ? "" : num(-b) + " "}${sign} ${root}`.replace(/^\+ /, "");
  const exact = ["+", "−"].map((sign) => `(${top(sign)})/${num(2 * a)}`);
  return { disc, real: true, values, exact, root };
}

// --- Two-number word problems -------------------------------------------------

function twoNumbers(q) {
  let m;
  const rel = (w) => (/^(sum|total)$/.test(w) ? "sum" : /^diff/.test(w) ? "difference" : w);
  // "(sum|difference) of two numbers is A and (their) product is B", in either order
  m = q.match(new RegExp(String.raw`(sum|total|difference) of (?:the |two |2 )?(?:two |2 )?numbers? is ${N}.*?product (?:of (?:them|the numbers|the two numbers) )?is ${N}`));
  if (m) return solveWithProduct(rel(m[1]), Number(m[2]), Number(m[3]));
  m = q.match(new RegExp(String.raw`product of (?:the |two |2 )?(?:two |2 )?numbers? is ${N}.*?(sum|total|difference) (?:of (?:them|the numbers|the two numbers) )?is ${N}`));
  if (m) return solveWithProduct(rel(m[2]), Number(m[3]), Number(m[1]));
  m = q.match(new RegExp(String.raw`sum of (?:the |two |2 )?(?:two |2 )?numbers? is ${N}.*?difference (?:of (?:them|the numbers|the two numbers) )?is ${N}`));
  if (m) return solveSumDifference(Number(m[1]), Number(m[2]));
  m = q.match(new RegExp(String.raw`difference of (?:the |two |2 )?(?:two |2 )?numbers? is ${N}.*?sum (?:of (?:them|the numbers|the two numbers) )?is ${N}`));
  if (m) return solveSumDifference(Number(m[2]), Number(m[1]));
  return null;
}

function solveSumDifference(S, D) {
  const x = (S + D) / 2;
  const y = (S - D) / 2;
  return [
    "Let the two numbers be x and y.",
    `- Their sum: x + y = ${num(S)}`,
    `- Their difference: x − y = ${num(D)}`,
    `Adding the two: 2x = ${num(S + D)}, so x = ${num(x)}.`,
    `Then y = ${num(S)} − ${num(x)} = ${num(y)}.`,
    "",
    `The two numbers are ${num(x)} and ${num(y)}.`,
    `Check: ${paren(x)} + ${paren(y)} = ${num(S)} ✓ and ${paren(x)} − ${paren(y)} = ${num(D)} ✓`,
  ].join("\n");
}

function solveWithProduct(kind, K, P) {
  const steps = ["Let the two numbers be x and y."];
  let roots;
  if (kind === "sum") {
    // x + y = K, xy = P → x² − Kx + P = 0
    steps.push(
      `- Their sum: x + y = ${num(K)}, so y = ${num(K)} − x`,
      `- Their product: x × y = ${num(P)}, so x(${num(K)} − x) = ${num(P)}`,
      `- That gives x² ${term(-K, "x")} ${signed(P)} = 0`
    );
    roots = quadraticRoots(1, -K, P);
  } else {
    // x − y = K, xy = P → y² + Ky − P = 0, x = y + K
    steps.push(
      `- Their difference: x − y = ${num(K)}, so x = y ${signed(K)}`,
      `- Their product: x × y = ${num(P)}, so (y ${signed(K)}) × y = ${num(P)}`,
      `- That gives y² ${term(K, "y")} ${signed(-P)} = 0`
    );
    roots = quadraticRoots(1, K, -P);
  }
  if (!roots.real) {
    steps.push("", `The discriminant is ${num(roots.disc)}, which is negative, so there are no real numbers that do this.`);
    return steps.join("\n");
  }
  const letter = kind === "sum" ? "x" : "y";
  steps.push(`- Solving it (quadratic formula): ${letter} = ${roots.exact[0]} or ${letter} = ${roots.exact[1]}`, "");
  const pairs = roots.values.map((r, i) => {
    const other = kind === "sum" ? K - r : r + K; // the other number
    const [first, second] = kind === "sum" ? [r, other] : [other, r];
    const exactFirst = kind === "sum" ? roots.exact[i] : shiftExact(roots, i, K);
    const exactSecond = kind === "sum" ? roots.exact[1 - i] : roots.exact[i];
    const show = (exact, value) => (exact === num(value) ? exact : `${exact} ≈ ${num(value)}`);
    return { first, second, text: `${show(exactFirst, first)} and ${show(exactSecond, second)}` };
  });
  const unique = kind === "sum" ? pairs.slice(0, 1) : pairs;
  steps.push(unique.length === 1 ? `The two numbers are ${unique[0].text}.` : "The two numbers are:");
  if (unique.length > 1) unique.forEach((p, i) => steps.push(`- ${p.text}${i === 0 ? ", or" : ""}`));
  const p = unique[0];
  const exact = !roots.root;
  steps.push(
    `Check: ${paren(p.first)} ${kind === "sum" ? "+" : "−"} ${paren(p.second)} ${exact ? "=" : "≈"} ${num(K)} ✓ and ${paren(p.first)} × ${paren(p.second)} ${exact ? "=" : "≈"} ${num(P)} ✓`
  );
  return steps.join("\n");
}

// x = y + K written exactly: y = (−K ± √d)/2 → x = (K ± √d)/2
function shiftExact(roots, i, K) {
  if (!roots.root) return num(roots.values[i] + K);
  const sign = i === 0 ? "+" : "−";
  return K === 0 ? `(${sign === "+" ? "" : "−"}${roots.root})/2` : `(${num(K)} ${sign} ${roots.root})/2`;
}

// --- Quadratic equations ------------------------------------------------------------

// "solve x^2 - 5x + 6 = 0", "2x^2+3x-2=0", "x^2 = 9", "find the roots of x^2-4x+4"
function quadraticEquation(q) {
  const body = q
    .replace(/^(solve|find (the )?(roots|root|value|values|solution|solutions) of|roots of|what are the roots of|solve for x:?)\s*/, "")
    .replace(/\s+/g, "");
  if (!/^[-+\d.x^=]+$/.test(body) || !/x\^2/.test(body)) return null;
  const [lhs, rhs = "0"] = body.split("=");
  if (body.split("=").length > 2) return null;
  const terms = (side) => {
    const out = { a: 0, b: 0, c: 0 };
    const parts = side.match(/[+-]?[^+-]+/g) || [];
    for (const t of parts) {
      const m = t.match(/^([+-]?)(\d*\.?\d*)(x\^2|x)?$/);
      if (!m) return null;
      const coef = (m[1] === "-" ? -1 : 1) * (m[2] === "" ? 1 : Number(m[2]));
      if (Number.isNaN(coef)) return null;
      if (m[3] === "x^2") out.a += coef;
      else if (m[3] === "x") out.b += coef;
      else if (m[2] !== "") out.c += coef;
      else return null;
    }
    return out;
  };
  const L = terms(lhs);
  const R = terms(rhs);
  if (!L || !R) return null;
  const a = L.a - R.a;
  const b = L.b - R.b;
  const c = L.c - R.c;
  if (!a) return null;
  const eq = `${a === 1 ? "" : a === -1 ? "−" : num(a)}x² ${b ? `${term(b, "x")} ` : ""}${c ? `${signed(c)} ` : ""}= 0`;
  const r = quadraticRoots(a, b, c);
  const lines = [`${eq}`, `Here a = ${num(a)}, b = ${num(b)}, c = ${num(c)}.`, `Discriminant: b² − 4ac = ${num(b * b)} ${signed(-4 * a * c)} = ${num(r.disc)}`];
  if (!r.real) {
    lines.push("", "The discriminant is negative, so there are no real roots.");
  } else if (r.disc === 0) {
    lines.push("", `The discriminant is 0, so there is one repeated root: x = ${r.exact[0]}.`);
  } else {
    const show = (i) => (r.root ? `${r.exact[i]} ≈ ${num(r.values[i])}` : r.exact[i]);
    lines.push(`x = (−b ± √(b² − 4ac)) / 2a`, "", `So x = ${show(0)} or x = ${show(1)}.`);
  }
  return lines.join("\n");
}

export function algebra(question) {
  const q = clean(question);
  return twoNumbers(q) || quadraticEquation(q);
}
