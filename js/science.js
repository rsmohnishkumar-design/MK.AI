// MK.ai's science solver: physics numericals (force, motion, energy, power,
// pressure, electricity, waves, heat, lenses …) worked step by step with
// units, and chemistry (molar mass, moles, percentage composition and
// balancing equations). Runs on the device; no outside service.

import { decimal, solveLinear, roundNice } from "./symbolic.js";

// --- Reading quantities with units ------------------------------------------------------------

// kind, factor to SI; longest names first when matching
const UNITS = [
  ["m/s²", "acceleration", 1], ["m/s^2", "acceleration", 1], ["m/s2", "acceleration", 1], ["ms-2", "acceleration", 1], ["ms^-2", "acceleration", 1], ["cm/s^2", "acceleration", 0.01], ["cm/s²", "acceleration", 0.01],
  ["km/h", "velocity", 1 / 3.6], ["km/hr", "velocity", 1 / 3.6], ["kmph", "velocity", 1 / 3.6], ["km per hour", "velocity", 1 / 3.6], ["kilometres per hour", "velocity", 1 / 3.6], ["kilometers per hour", "velocity", 1 / 3.6],
  ["m/s", "velocity", 1], ["ms-1", "velocity", 1], ["ms^-1", "velocity", 1], ["metres per second", "velocity", 1], ["meters per second", "velocity", 1], ["cm/s", "velocity", 0.01],
  ["kg/m^3", "density", 1], ["kg/m³", "density", 1], ["kg/m3", "density", 1], ["g/cm^3", "density", 1000], ["g/cm³", "density", 1000], ["g/cm3", "density", 1000], ["g/ml", "density", 1000],
  ["j/kg°c", "specificHeat", 1], ["j/kg k", "specificHeat", 1], ["j/(kg k)", "specificHeat", 1], ["j/kgk", "specificHeat", 1], ["j/kg/°c", "specificHeat", 1], ["j/kg°c", "specificHeat", 1], ["j kg^-1 k^-1", "specificHeat", 1], ["cal/g°c", "specificHeat", 4184],
  ["n/m^2", "pressure", 1], ["n/m²", "pressure", 1], ["n/m2", "pressure", 1], ["n/m", "springConstant", 1],
  ["kg m/s", "momentum", 1], ["kgm/s", "momentum", 1], ["kg·m/s", "momentum", 1],
  ["kwh", "energy", 3.6e6], ["kilowatt hour", "energy", 3.6e6], ["kilowatt hours", "energy", 3.6e6], ["units of electricity", "energy", 3.6e6],
  ["kj", "energy", 1000], ["mj", "energy", 1e6], ["kcal", "energy", 4184], ["cal", "energy", 4.184], ["calories", "energy", 4.184], ["ev", "energy", 1.602e-19], ["joules", "energy", 1], ["joule", "energy", 1], ["j", "energy", 1],
  ["kw", "power", 1000], ["mw", "power", 1e6], ["hp", "power", 746], ["horsepower", "power", 746], ["watts", "power", 1], ["watt", "power", 1], ["w", "power", 1],
  ["kn", "force", 1000], ["newtons", "force", 1], ["newton", "force", 1], ["n", "force", 1],
  ["kpa", "pressure", 1000], ["atm", "pressure", 101325], ["pascal", "pressure", 1], ["pa", "pressure", 1],
  ["kv", "voltage", 1000], ["volts", "voltage", 1], ["volt", "voltage", 1], ["v", "voltage", 1],
  ["ma", "current", 0.001], ["amperes", "current", 1], ["ampere", "current", 1], ["amps", "current", 1], ["amp", "current", 1], ["a", "current", 1],
  ["kω", "resistance", 1000], ["kohm", "resistance", 1000], ["ohms", "resistance", 1], ["ohm", "resistance", 1], ["ω", "resistance", 1],
  ["coulombs", "charge", 1], ["coulomb", "charge", 1],
  ["mhz", "frequency", 1e6], ["khz", "frequency", 1000], ["hz", "frequency", 1], ["hertz", "frequency", 1],
  ["°c", "temperature", 1], ["degree celsius", "temperature", 1], ["degrees celsius", "temperature", 1], ["degrees c", "temperature", 1], ["celsius", "temperature", 1],
  ["m^2", "area", 1], ["m²", "area", 1], ["m2", "area", 1], ["cm^2", "area", 1e-4], ["cm²", "area", 1e-4], ["cm2", "area", 1e-4], ["mm^2", "area", 1e-6], ["mm²", "area", 1e-6],
  ["m^3", "volume", 1], ["m³", "volume", 1], ["m3", "volume", 1], ["cm^3", "volume", 1e-6], ["cm³", "volume", 1e-6], ["cm3", "volume", 1e-6], ["cc", "volume", 1e-6], ["litres", "volume", 0.001], ["liters", "volume", 0.001], ["litre", "volume", 0.001], ["liter", "volume", 0.001], ["ml", "volume", 1e-6], ["l", "volume", 0.001],
  ["dioptre", "lensPower", 1], ["diopter", "lensPower", 1], ["d", "lensPower", 1],
  ["tonnes", "mass", 1000], ["tonne", "mass", 1000], ["tons", "mass", 1000], ["ton", "mass", 1000], ["kilograms", "mass", 1], ["kilogram", "mass", 1], ["kg", "mass", 1], ["mg", "mass", 1e-6], ["grams", "mass", 0.001], ["gram", "mass", 0.001], ["g", "mass", 0.001],
  ["km", "length", 1000], ["kilometres", "length", 1000], ["kilometers", "length", 1000], ["cm", "length", 0.01], ["centimetres", "length", 0.01], ["centimeters", "length", 0.01], ["mm", "length", 0.001], ["nm", "length", 1e-9], ["metres", "length", 1], ["meters", "length", 1], ["metre", "length", 1], ["meter", "length", 1], ["m", "length", 1],
  ["hours", "time", 3600], ["hour", "time", 3600], ["hrs", "time", 3600], ["hr", "time", 3600], ["h", "time", 3600], ["minutes", "time", 60], ["minute", "time", 60], ["mins", "time", 60], ["min", "time", 60], ["ms", "time", 0.001], ["seconds", "time", 1], ["second", "time", 1], ["secs", "time", 1], ["sec", "time", 1], ["s", "time", 1],
  ["degrees", "angle", 1], ["degree", "angle", 1], ["°", "angle", 1],
];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const UNIT_RE = new RegExp(String.raw`(-?\d+(?:\.\d+)?)(?:\s*(?:×|x|\*)\s*10\s*\^\s*\(?(-?\d+)\)?|e(-?\d+))?\s*(${UNITS.map(([u]) => esc(u)).join("|")})(?![a-z])`, "g");

const SI = {
  mass: "kg", length: "m", time: "s", velocity: "m/s", acceleration: "m/s²", force: "N", energy: "J", power: "W", pressure: "Pa", area: "m²", volume: "m³",
  density: "kg/m³", voltage: "V", current: "A", resistance: "Ω", charge: "C", frequency: "Hz", temperature: "°C", momentum: "kg·m/s", specificHeat: "J/(kg·°C)",
  springConstant: "N/m", lensPower: "D", angle: "°", none: "",
};

function readQuantities(q) {
  const out = [];
  for (const m of q.matchAll(UNIT_RE)) {
    const [, n, exp1, exp2, unit] = m;
    const [, kind, factor] = UNITS.find(([u]) => u === unit);
    let value = Number(n) * 10 ** Number(exp1 ?? exp2 ?? 0);
    // "a" and "d" are also ordinary words
    if ((unit === "a" || unit === "d") && !/current|amp|electric|circuit|wire|lens|power/.test(q)) continue;
    const before = q.slice(Math.max(0, m.index - 60), m.index).split(/[,;]|\band\b/).pop();
    out.push({ kind, value: value * factor, raw: `${n}${exp1 ?? exp2 ? ` × 10^${exp1 ?? exp2}` : ""} ${unit}`, before, used: false, index: m.index });
  }
  return out;
}

// --- Formulas ------------------------------------------------------------------------------------------

const G = 9.8;
// Each variable: kind, words that name it (to spot what's asked and label givens)
const F = (name, show, vars, solve, when = null) => ({ name, show, vars, solve, when });
const FORMULAS = [
  // motion (suvat)
  F("First equation of motion", "v = u + at", { v: ["velocity", /final (?:velocity|speed)|reach(?:es)?|attains?|after|becomes|\bto\b|velocity after|speed after/], u: ["velocity", /initial|starts?|from|with (?:a )?(?:velocity|speed)|thrown|projected|moving (?:at|with)/], a: ["acceleration", /accelerat|retard|decelerat/], t: ["time", /time|how long|seconds?|in\b|for\b/] }, { v: (x) => x.u + x.a * x.t, u: (x) => x.v - x.a * x.t, a: (x) => (x.v - x.u) / x.t, t: (x) => (x.v - x.u) / x.a }),
  F("Second equation of motion", "s = ut + ½at²", { s: ["length", /distance|displacement|how far|travel|covers?|height|how high|fall/], u: ["velocity", /initial|starts?|from|with|thrown|projected|moving/], a: ["acceleration", /accelerat|retard|decelerat/], t: ["time", /time|how long|in\b|for\b/] }, { s: (x) => x.u * x.t + 0.5 * x.a * x.t ** 2, a: (x) => (2 * (x.s - x.u * x.t)) / x.t ** 2, u: (x) => (x.s - 0.5 * x.a * x.t ** 2) / x.t, t: (x) => (x.a === 0 ? x.s / x.u : (-x.u + Math.sqrt(x.u ** 2 + 2 * x.a * x.s)) / x.a) }),
  F("Third equation of motion", "v² = u² + 2as", { v: ["velocity", /final|reach|attains|strikes|hits|with what (?:velocity|speed)|ground|becomes/], u: ["velocity", /initial|starts?|from|with|thrown|projected|moving/], a: ["acceleration", /accelerat|retard|decelerat/], s: ["length", /distance|displacement|how far|height|how high|fall|travel|covers?|stopping/] }, { v: (x) => Math.sqrt(Math.max(0, x.u ** 2 + 2 * x.a * x.s)), u: (x) => Math.sqrt(Math.max(0, x.v ** 2 - 2 * x.a * x.s)), a: (x) => (x.v ** 2 - x.u ** 2) / (2 * x.s), s: (x) => (x.v ** 2 - x.u ** 2) / (2 * x.a) }),
  F("Average velocity", "s = ((u + v)/2) × t", { s: ["length", /distance|displacement|how far|travel|covers?/], u: ["velocity", /initial|starts?|from/], v: ["velocity", /final|reach|to\b/], t: ["time", /time|how long|in\b/] }, { s: (x) => ((x.u + x.v) / 2) * x.t }),
  // uniform speed
  F("Speed", "speed = distance ÷ time", { v: ["velocity", /speed|velocity|how fast/], s: ["length", /distance|how far|travel|covers?|length/], t: ["time", /time|how long|in\b/] }, { v: (x) => x.s / x.t, s: (x) => x.v * x.t, t: (x) => x.s / x.v }, (q) => !/accelerat|retard|decelerat|rest|fall|dropped|thrown/.test(q)),
  // forces
  F("Newton's second law", "F = m × a", { F: ["force", /force|push|pull/], m: ["mass", /mass|body|object|car|ball|block/], a: ["acceleration", /accelerat|retard|decelerat/] }, { F: (x) => x.m * x.a, m: (x) => x.F / x.a, a: (x) => x.F / x.m }),
  F("Weight", "W = m × g", { W: ["force", /weight|weighs/], m: ["mass", /mass|body|object|person|man|boy|girl/] }, { W: (x) => x.m * G, m: (x) => x.W / G }, (q) => /weight|weighs/.test(q)),
  F("Momentum", "p = m × v", { p: ["momentum", /momentum/], m: ["mass", /mass|body|ball|car|object|bullet|truck/], v: ["velocity", /velocity|speed|moving/] }, { p: (x) => x.m * x.v, m: (x) => x.p / x.v, v: (x) => x.p / x.m }, (q) => /momentum/.test(q)),
  F("Impulse", "Impulse = F × t", { J: ["momentum", /impulse/], F: ["force", /force/], t: ["time", /time|for\b/] }, { J: (x) => x.F * x.t, F: (x) => x.J / x.t, t: (x) => x.J / x.F }, (q) => /impulse/.test(q)),
  F("Pressure", "P = F ÷ A", { P: ["pressure", /pressure/], F: ["force", /force|weight/], A: ["area", /area/] }, { P: (x) => x.F / x.A, F: (x) => x.P * x.A, A: (x) => x.F / x.P }),
  F("Density", "ρ = m ÷ V", { rho: ["density", /density/], m: ["mass", /mass|weighs|object|block/], V: ["volume", /volume/] }, { rho: (x) => x.m / x.V, m: (x) => x.rho * x.V, V: (x) => x.m / x.rho }),
  F("Hooke's law", "F = k × x", { F: ["force", /force|load/], k: ["springConstant", /spring constant|stiffness|constant/], x: ["length", /extension|stretch|compress|elongation/] }, { F: (x) => x.k * x.x, k: (x) => x.F / x.x, x: (x) => x.F / x.k }, (q) => /spring|hooke|extension|stretch/.test(q)),
  F("Centripetal force", "F = mv² ÷ r", { F: ["force", /force/], m: ["mass", /mass|body|car|ball|object|stone/], v: ["velocity", /velocity|speed|moving/], r: ["length", /radius|circle|circular|track/] }, { F: (x) => (x.m * x.v ** 2) / x.r, v: (x) => Math.sqrt((x.F * x.r) / x.m), m: (x) => (x.F * x.r) / x.v ** 2, r: (x) => (x.m * x.v ** 2) / x.F }, (q) => /circ|centripetal|radius/.test(q)),
  // energy
  F("Kinetic energy", "KE = ½ m v²", { KE: ["energy", /kinetic energy|\bke\b/], m: ["mass", /mass|body|car|ball|object|bullet|truck/], v: ["velocity", /velocity|speed|moving/] }, { KE: (x) => 0.5 * x.m * x.v ** 2, m: (x) => (2 * x.KE) / x.v ** 2, v: (x) => Math.sqrt((2 * x.KE) / x.m) }, (q) => /kinetic|\bke\b/.test(q)),
  F("Potential energy", "PE = m g h", { PE: ["energy", /potential energy|\bpe\b|energy/], m: ["mass", /mass|body|object|ball|stone|person/], h: ["length", /height|high|raised|lifted|above/] }, { PE: (x) => x.m * G * x.h, m: (x) => x.PE / (G * x.h), h: (x) => x.PE / (x.m * G) }, (q) => /potential|\bpe\b|height|lifted|raised/.test(q)),
  F("Work done", "W = F × s", { W: ["energy", /work/], F: ["force", /force/], s: ["length", /distance|displacement|through|moves?|by/] }, { W: (x) => x.F * x.s, F: (x) => x.W / x.s, s: (x) => x.W / x.F }, (q) => /work/.test(q)),
  F("Power", "P = W ÷ t", { P: ["power", /power|rate of (?:doing )?work/], W: ["energy", /work|energy|lifts?/], t: ["time", /time|in\b|seconds?|how long/] }, { P: (x) => x.W / x.t, W: (x) => x.P * x.t, t: (x) => x.W / x.P }),
  F("Power (lifting)", "P = m g h ÷ t", { P: ["power", /power/], m: ["mass", /mass|lifts?|climbs?|boy|man|girl|person|load/], h: ["length", /height|high|climbs?|stairs|up|lifts?/], t: ["time", /time|in\b|seconds?/] }, { P: (x) => (x.m * G * x.h) / x.t }, (q) => /power/.test(q)),
  F("Efficiency", "Efficiency = output ÷ input × 100%", { eta: ["none", /efficiency/], out: ["energy", /output|useful/], inp: ["energy", /input|supplied|consumed/] }, { eta: (x) => (x.out / x.inp) * 100 }, (q) => /efficiency/.test(q)),
  F("Mass–energy", "E = mc²", { E: ["energy", /energy/], m: ["mass", /mass/] }, { E: (x) => x.m * 9e16, m: (x) => x.E / 9e16 }, (q) => /mc|einstein|mass.energy|converted/.test(q)),
  F("Gravitational force", "F = G m₁m₂ ÷ r²", { F: ["force", /force/], m1: ["mass", /mass|each|two|body|masses/], m2: ["mass", /mass|each|and|other/], r: ["length", /distance|apart|separated|between/] }, { F: (x) => (6.674e-11 * x.m1 * x.m2) / x.r ** 2 }, (q) => /gravitational|gravity between|attraction/.test(q)),
  // electricity
  F("Ohm's law", "V = I × R", { V: ["voltage", /voltage|potential difference|p\.?d|emf|battery|volts?/], I: ["current", /current/], R: ["resistance", /resistance|resistor/] }, { V: (x) => x.I * x.R, I: (x) => x.V / x.R, R: (x) => x.V / x.I }),
  F("Electric power", "P = V × I", { P: ["power", /power|rated|bulb|heater|appliance/], V: ["voltage", /voltage|volts?|supply|potential/], I: ["current", /current/] }, { P: (x) => x.V * x.I, I: (x) => x.P / x.V, V: (x) => x.P / x.I }),
  F("Electric power", "P = I² × R", { P: ["power", /power|heat|dissipat/], I: ["current", /current/], R: ["resistance", /resistance|resistor/] }, { P: (x) => x.I ** 2 * x.R, I: (x) => Math.sqrt(x.P / x.R), R: (x) => x.P / x.I ** 2 }),
  F("Electric power", "P = V² ÷ R", { P: ["power", /power|bulb|heater/], V: ["voltage", /voltage|volts?|supply/], R: ["resistance", /resistance|resistor/] }, { P: (x) => x.V ** 2 / x.R, R: (x) => x.V ** 2 / x.P, V: (x) => Math.sqrt(x.P * x.R) }),
  F("Charge", "Q = I × t", { Q: ["charge", /charge/], I: ["current", /current/], t: ["time", /time|for\b|in\b/] }, { Q: (x) => x.I * x.t, I: (x) => x.Q / x.t, t: (x) => x.Q / x.I }),
  F("Electrical energy", "E = P × t", { E: ["energy", /energy|units|consumed|consumption|electricity/], P: ["power", /power|bulb|heater|appliance|rated|watt/], t: ["time", /time|for\b|hours?|daily|every day|per day/] }, { E: (x) => x.P * x.t, P: (x) => x.E / x.t, t: (x) => x.E / x.P }),
  // waves, light
  F("Wave equation", "v = f × λ", { v: ["velocity", /speed|velocity/], f: ["frequency", /frequency/], lam: ["length", /wavelength|λ/] }, { v: (x) => x.f * x.lam, f: (x) => x.v / x.lam, lam: (x) => x.v / x.f }),
  F("Wave equation (sound)", "λ = v ÷ f (v of sound in air ≈ 340 m/s)", { lam: ["length", /wavelength/], f: ["frequency", /frequency/] }, { lam: (x) => 340 / x.f, f: (x) => 340 / x.lam }, (q) => /sound/.test(q) && !/m\/s/.test(q)),
  F("Wave equation (light)", "λ = c ÷ f (c = 3 × 10⁸ m/s)", { lam: ["length", /wavelength/], f: ["frequency", /frequency/] }, { lam: (x) => 3e8 / x.f, f: (x) => 3e8 / x.lam }, (q) => /light|electromagnetic|radio|photon|x.?ray|microwave/.test(q) && !/m\/s/.test(q)),
  F("Time period", "T = 1 ÷ f", { T: ["time", /time period|period/], f: ["frequency", /frequency/] }, { T: (x) => 1 / x.f, f: (x) => 1 / x.T }, (q) => /period/.test(q)),
  F("Photon energy", "E = h × f", { E: ["energy", /energy/], f: ["frequency", /frequency/] }, { E: (x) => 6.626e-34 * x.f, f: (x) => x.E / 6.626e-34 }, (q) => /photon|quantum|planck/.test(q)),
  F("Power of a lens", "P = 1 ÷ f (f in metres)", { P: ["lensPower", /power/], f: ["length", /focal length/] }, { P: (x) => 1 / x.f, f: (x) => 1 / x.P }, (q) => /lens|focal/.test(q)),
  F("Simple pendulum", "T = 2π√(L ÷ g)", { T: ["time", /time period|period/], L: ["length", /length|long/] }, { T: (x) => 2 * Math.PI * Math.sqrt(x.L / G), L: (x) => (G * (x.T / (2 * Math.PI)) ** 2) }, (q) => /pendulum/.test(q)),
  // heat
  F("Heat", "Q = m × c × ΔT", { Q: ["energy", /heat|energy/], m: ["mass", /mass|of water|of iron|of|kg|g\b/], c: ["specificHeat", /specific heat/], dT: ["temperature", /rise|change|raise|increase|heated|from|to|by/] }, { Q: (x) => x.m * x.c * x.dT, c: (x) => x.Q / (x.m * x.dT), m: (x) => x.Q / (x.c * x.dT), dT: (x) => x.Q / (x.m * x.c) }, (q) => /heat|specific|temperature|°c|celsius/.test(q)),
];

// What's being asked for, from the question words
const ASKED = [
  [/kinetic energy|\bk\.?e\b/, "energy", /kinetic/],
  [/potential energy|\bp\.?e\b/, "energy", /potential/],
  [/work done|how much work|the work|find work|calculate work/, "energy", /work/],
  [/heat (?:energy )?(?:required|needed|absorbed|given|supplied)|amount of heat|how much heat|quantity of heat/, "energy", /heat/],
  [/energy (?:consumed|used)|units of electricity|electrical energy|how many units|energy consumption/, "energy", /consum|units|electric/],
  [/\benergy\b/, "energy", /energy/],
  [/specific heat/, "specificHeat"],
  [/rise in temperature|temperature (?:rise|change)|change in temperature|final temperature/, "temperature"],
  [/momentum/, "momentum"],
  [/impulse/, "momentum"],
  [/efficiency/, "none"],
  [/weight/, "force", /weight/],
  [/\bforce\b|tension|thrust/, "force"],
  [/power of (?:the |a )?lens/, "lensPower"],
  [/\bpower\b/, "power"],
  [/pressure/, "pressure"],
  [/density/, "density"],
  [/volume/, "volume"],
  [/accelerat|retardation|deceleration/, "acceleration"],
  [/wavelength/, "length", /wavelength/],
  [/time period|\bperiod\b/, "time", /period/],
  [/frequency/, "frequency"],
  [/focal length/, "length", /focal/],
  [/spring constant/, "springConstant"],
  [/extension|stretch/, "length", /extension/],
  [/(?:final|initial)? ?(?:velocity|speed)|how fast/, "velocity"],
  [/maximum height|how high|height reached|height/, "length", /height|high/],
  [/distance|displacement|how far|stopping|length/, "length"],
  [/how long|time taken|\btime\b|how many seconds|how much time/, "time"],
  [/\bmass\b/, "mass"],
  [/current/, "current"],
  [/resistance/, "resistance"],
  [/voltage|potential difference|\bp\.?d\.?\b|emf/, "voltage"],
  [/charge/, "charge"],
];

function askedPart(q) {
  const m = q.match(/.*\b(find|calculate|what is|what's|what will be|what would be|what|determine|compute|how much|how many|how far|how long|how fast|how high|with what|estimate|work out)\b(.*)$/);
  return m ? m[1] + m[2] : null;
}

function fmtValue(v, kind) {
  const u = SI[kind] ?? "";
  const abs = Math.abs(v);
  let s;
  if (abs !== 0 && (abs >= 1e7 || abs < 1e-3)) {
    const e = Math.floor(Math.log10(abs));
    const mant = v / 10 ** e;
    s = `${decimal(mant, 3)} × 10${String(e).replace(/-/, "⁻").replace(/\d/g, (c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[c])}`;
  } else s = decimal(v, 4);
  return u ? `${s} ${u}` : s;
}

const symName = (s) => ({ lam: "λ", rho: "ρ", eta: "Efficiency", dT: "ΔT", m1: "m₁", m2: "m₂", out: "Output", inp: "Input" })[s] || s;

// --- The physics solver ----------------------------------------------------------------------------------

function physics(q) {
  if (!/\d/.test(q)) return null;
  // "5 kg in pounds" is a conversion; "my weight is 60 kg" is just a statement
  if (/\b(?:in|to|into) (?:pounds?|lbs?|ounces?|oz|grams?|kilograms?|kg|g|stones?|tonnes?|miles?|feet|foot|inch(?:es)?|metres?|meters?|m\/s|km\/h|mph|cm|mm|km|litres?|ml|fahrenheit|celsius|kelvin|joules?|calories?|kwh|hours?|minutes?|seconds?)\s*\??$/.test(q)) return null;
  if (/^(?:my|i|i'm|im|i am|we|our|he|she|his|her)\b/.test(q) && !/\b(?:find|calculate|what|how)\b/.test(q)) return null;
  const asked = askedPart(q) || q;
  const quantities = readQuantities(q);
  if (!quantities.length) return null;
  // Known facts from words
  const facts = {};
  const notes = [];
  if (/from rest|at rest|starts? from rest|initially at rest|dropped|released|let fall|falls freely|free(?:ly)? fall/.test(q)) facts.u = 0;
  if (/comes? to (?:a )?(?:rest|stop|halt)|stops|brought to rest|to rest|maximum height/.test(q)) facts.v = 0;
  let aFromG = false;
  if (/dropped|falls? freely|free(?:ly)? fall|released from|let fall|falls from|fall from/.test(q) && !quantities.some((x) => x.kind === "acceleration")) {
    facts.a = G;
    aFromG = true;
  }
  if (/thrown (?:vertically )?up|projected (?:vertically )?up|upward|maximum height|thrown straight up/.test(q) && !quantities.some((x) => x.kind === "acceleration")) {
    facts.a = -G;
    aFromG = true;
  }
  const decel = /decelerat|retard|brakes?|slows? down/.test(q);
  // "from 10 m/s to 20 m/s"
  const fromTo = q.match(/from (-?\d+(?:\.\d+)?)\s*(m\/s|km\/h|kmph|km\/hr)\s*to (-?\d+(?:\.\d+)?)\s*(m\/s|km\/h|kmph|km\/hr)?/);
  if (fromTo) {
    const f1 = /km/.test(fromTo[2]) ? 1 / 3.6 : 1;
    const f2 = /km/.test(fromTo[4] || fromTo[2]) ? 1 / 3.6 : 1;
    facts.u = Number(fromTo[1]) * f1;
    facts.v = Number(fromTo[3]) * f2;
  }
  // the quantity named first in the question part (longest name on a tie)
  let askedMatch = null;
  let at = Infinity;
  let len = 0;
  for (const entry of ASKED) {
    const m = asked.match(entry[0]);
    if (m && (m.index < at || (m.index === at && m[0].length > len))) [askedMatch, at, len] = [entry, m.index, m[0].length];
  }
  if (!askedMatch) return null;
  const [, askKind, askLabel] = askedMatch;

  const tries = [];
  for (const f of FORMULAS) {
    if (f.when && !f.when(q)) continue;
    // the asked variable
    const target = Object.entries(f.vars).find(([sym, [kind, label]]) => kind === askKind && (!askLabel || askLabel.test(label.source) || label.test(asked)) && f.solve[sym]);
    if (!target) continue;
    const [tSym] = target;
    // suvat: which velocity is asked
    if (askKind === "velocity" && (tSym === "u" || tSym === "v")) {
      const wantsInitial = /initial/.test(asked);
      if ((tSym === "u") !== wantsInitial) continue;
    }
    const pool = quantities.map((x) => ({ ...x, used: false }));
    const known = {};
    const given = [];
    let ok = true;
    for (const [sym, [kind, label]] of Object.entries(f.vars)) {
      if (sym === tSym) continue;
      if (sym in facts && ["u", "v", "a"].includes(sym) && (kind === "velocity" || kind === "acceleration")) {
        known[sym] = facts[sym];
        continue;
      }
      const same = pool.filter((x) => !x.used && x.kind === kind);
      let pick = same.find((x) => label.test(x.before));
      // two velocities: the first mentioned is usually the initial one
      if (!pick && kind === "velocity" && same.length > 1) pick = sym === "u" ? same[0] : same[same.length - 1];
      if (!pick && same.length === 1) pick = same[0];
      if (!pick && same.length > 1) pick = same[0];
      if (!pick) {
        ok = false;
        break;
      }
      pick.used = true;
      let value = pick.value;
      if (kind === "acceleration" && decel && value > 0) value = -value;
      known[sym] = value;
      const raw = pick.raw.trim();
      given.push(`${symName(sym)} = ${raw}${raw.toLowerCase() !== fmtValue(value, kind).toLowerCase() && kind !== "temperature" ? ` = ${fmtValue(value, kind)}` : ""}`);
    }
    if (!ok) continue;
    // every number given should be used (otherwise it's probably the wrong formula)
    const unused = pool.filter((x) => !x.used && x.kind !== "angle" && !(fromTo && x.kind === "velocity")).length;
    const value = f.solve[tSym](known);
    if (!Number.isFinite(value)) continue;
    tries.push({ f, tSym, known, given, value, unused, kind: f.vars[tSym][0] });
  }
  if (!tries.length) return null;
  tries.sort((a, b) => a.unused - b.unused);
  const best = tries[0];
  if (best.unused > 1) return null;
  const { f, tSym, known, given, value, kind } = best;
  const factLines = [];
  if ("u" in facts && "u" in known && facts.u === known.u && tSym !== "u") factLines.push("u = 0 (starts from rest)");
  if ("v" in facts && "v" in known && facts.v === known.v && tSym !== "v") factLines.push(/maximum height/.test(q) ? "v = 0 (at the highest point it stops for an instant)" : "v = 0 (comes to rest)");
  if (aFromG && "a" in known) factLines.push(`a = ${known.a < 0 ? "−" : ""}g = ${known.a < 0 ? "−" : ""}9.8 m/s² (${known.a < 0 ? "gravity slows it on the way up" : "free fall"})`);
  if (/m g h|m × g|G m/.test(f.show) && !aFromG) notes.push("taking g = 9.8 m/s²");
  if (decel && "a" in known && known.a < 0) notes.push("deceleration, so a is negative");
  let answer = fmtValue(value, kind);
  if (tSym === "eta") answer = `${decimal(value, 2)}%`;
  if (kind === "velocity" && /km\/h|kmph|km\/hr/.test(q) && Math.abs(value) > 0) answer += ` (= ${decimal(value * 3.6, 2)} km/h)`;
  if (kind === "energy" && /units|kwh|consum|electricity|bill/.test(q)) answer += ` = ${decimal(value / 3.6e6, 3)} kWh (units)`;
  if (kind === "time" && value >= 120) answer += ` (= ${decimal(value / 60, 2)} minutes)`;
  const cost = q.match(/(?:₹|rs\.?|rupees?)\s*(\d+(?:\.\d+)?)\s*(?:per|\/|a)\s*(?:unit|kwh)|(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|rupees?)\s*(?:per|\/|a)\s*(?:unit|kwh)/);
  const lines = [
    `Formula: ${f.name} — ${f.show}`,
    `Given: ${[...given, ...factLines].join(", ")}${notes.length ? ` (${notes.join("; ")})` : ""}`,
    "",
    `${symName(tSym)} = ${answer}`,
  ];
  if (cost && kind === "energy") {
    const rate = Number(cost[1] || cost[2]);
    lines.push(`Cost = ${decimal(value / 3.6e6, 3)} units × ₹${rate} = ₹${decimal((value / 3.6e6) * rate, 2)}`);
  }
  return lines.join("\n");
}

// Resistors in series and parallel
function resistors(q) {
  if (!/resist|ohm|ω/.test(q) || !/series|parallel/.test(q)) return null;
  const values = [...q.matchAll(/(\d+(?:\.\d+)?)\s*(kω|kohm|ohms?|ω)?/g)]
    .filter((m) => m[2] || /resist/.test(q))
    .map((m) => Number(m[1]) * (m[2] && /^k/.test(m[2]) ? 1000 : 1));
  const rs = values.filter((v) => v > 0);
  if (rs.length < 2 || rs.length > 10) return null;
  const inSeries = /series/.test(q) && !/parallel/.test(q);
  const inParallel = /parallel/.test(q) && !/series/.test(q);
  if (inSeries) return `In series, resistances add: R = R₁ + R₂ + …\nR = ${rs.map((r) => decimal(r)).join(" + ")}\n\n= ${decimal(rs.reduce((s, r) => s + r, 0), 4)} Ω`;
  if (inParallel) {
    const inv = rs.reduce((s, r) => s + 1 / r, 0);
    const R = 1 / inv;
    const f = roundNice(R);
    return `In parallel: 1/R = 1/R₁ + 1/R₂ + …\n1/R = ${rs.map((r) => `1/${decimal(r)}`).join(" + ")} = ${decimal(inv, 4)}\n\nR = ${Math.abs(f - R) < 1e-9 && !Number.isInteger(f) ? `${fracOf(f)} ≈ ` : ""}${decimal(R, 4)} Ω${rs.length === 2 ? `\n(For two resistors: R = R₁R₂/(R₁ + R₂).)` : ""}`;
  }
  return null;
}
function fracOf(v) {
  for (let d = 2; d <= 1000; d++) if (Math.abs(Math.round(v * d) - v * d) < 1e-9) return `${Math.round(v * d)}/${d}`;
  return decimal(v);
}

// --- Chemistry ------------------------------------------------------------------------------------------

const MASSES = Object.fromEntries(
  "H 1.008 He 4.0026 Li 6.94 Be 9.0122 B 10.81 C 12.011 N 14.007 O 15.999 F 18.998 Ne 20.180 Na 22.990 Mg 24.305 Al 26.982 Si 28.085 P 30.974 S 32.06 Cl 35.45 Ar 39.948 K 39.098 Ca 40.078 Sc 44.956 Ti 47.867 V 50.942 Cr 51.996 Mn 54.938 Fe 55.845 Co 58.933 Ni 58.693 Cu 63.546 Zn 65.38 Ga 69.723 Ge 72.630 As 74.922 Se 78.971 Br 79.904 Kr 83.798 Rb 85.468 Sr 87.62 Y 88.906 Zr 91.224 Nb 92.906 Mo 95.95 Tc 98 Ru 101.07 Rh 102.91 Pd 106.42 Ag 107.87 Cd 112.41 In 114.82 Sn 118.71 Sb 121.76 Te 127.60 I 126.90 Xe 131.29 Cs 132.91 Ba 137.33 La 138.91 Ce 140.12 Pr 140.91 Nd 144.24 Pm 145 Sm 150.36 Eu 151.96 Gd 157.25 Tb 158.93 Dy 162.50 Ho 164.93 Er 167.26 Tm 168.93 Yb 173.05 Lu 174.97 Hf 178.49 Ta 180.95 W 183.84 Re 186.21 Os 190.23 Ir 192.22 Pt 195.08 Au 196.97 Hg 200.59 Tl 204.38 Pb 207.2 Bi 208.98 Po 209 At 210 Rn 222 Fr 223 Ra 226 Ac 227 Th 232.04 Pa 231.04 U 238.03 Np 237 Pu 244 Am 243 Cm 247 Bk 247 Cf 251 Es 252 Fm 257 Md 258 No 259 Lr 266 Rf 267 Db 268 Sg 269 Bh 270 Hs 277 Mt 278 Ds 281 Rg 282 Cn 285 Nh 286 Fl 289 Mc 290 Lv 293 Ts 294 Og 294"
    .split(" ")
    .reduce((pairs, x, i, all) => (i % 2 ? pairs : [...pairs, [all[i], Number(all[i + 1])]]), [])
);
const NAMES = {
  water: "H2O", "carbon dioxide": "CO2", "carbon monoxide": "CO", "sodium chloride": "NaCl", salt: "NaCl", "common salt": "NaCl", glucose: "C6H12O6", ammonia: "NH3", methane: "CH4",
  "sulphuric acid": "H2SO4", "sulfuric acid": "H2SO4", "hydrochloric acid": "HCl", "nitric acid": "HNO3", "calcium carbonate": "CaCO3", "sodium hydroxide": "NaOH", ethanol: "C2H5OH",
  oxygen: "O2", hydrogen: "H2", nitrogen: "N2", chlorine: "Cl2", ozone: "O3", benzene: "C6H6", "baking soda": "NaHCO3", "sodium bicarbonate": "NaHCO3", "sodium hydrogen carbonate": "NaHCO3",
  sucrose: "C12H22O11", sugar: "C12H22O11", "copper sulphate": "CuSO4", "copper sulfate": "CuSO4", "potassium permanganate": "KMnO4", "calcium hydroxide": "Ca(OH)2", "slaked lime": "Ca(OH)2",
  "quick lime": "CaO", quicklime: "CaO", "calcium oxide": "CaO", "sulphur dioxide": "SO2", "sulfur dioxide": "SO2", "hydrogen peroxide": "H2O2", "acetic acid": "CH3COOH", ethanoic: "CH3COOH",
  "washing soda": "Na2CO3·10H2O", "sodium carbonate": "Na2CO3", "potassium chloride": "KCl", "magnesium oxide": "MgO", "iron oxide": "Fe2O3", rust: "Fe2O3", "aluminium oxide": "Al2O3",
  propane: "C3H8", butane: "C4H10", ethane: "C2H6", ethene: "C2H4", ethylene: "C2H4", acetylene: "C2H2", ethyne: "C2H2", urea: "CO(NH2)2", "silver nitrate": "AgNO3", "potassium nitrate": "KNO3",
};

// "Ca(OH)2" → {Ca: 1, O: 2, H: 2}; tolerant of all-lowercase "h2so4"
export function parseFormula(text) {
  const t = text.replace(/[·.*]/g, "·").replace(/\s+/g, "");
  if (!t || /[^A-Za-z0-9()[\]·]/.test(t)) return null;
  const parts = t.split("·");
  const total = {};
  for (const p of parts) {
    const lead = p.match(/^(\d+)(.*)$/);
    const mult = lead ? Number(lead[1]) : 1;
    const body = lead ? lead[2] : p;
    const counts = parseGroup(body, /[A-Z]/.test(body));
    if (!counts) return null;
    for (const [el, n] of Object.entries(counts)) total[el] = (total[el] || 0) + n * mult;
  }
  return Object.keys(total).length ? total : null;
}
function parseGroup(s, cased) {
  // returns counts or null; lowercase input tries every split and prefers more elements
  let best = null;
  const go = (i, stack) => {
    if (i === s.length) {
      if (stack.length !== 1) return;
      const c = stack[0];
      const n = Object.keys(c).length;
      if (!best || n > best.n) best = { c, n };
      return;
    }
    const ch = s[i];
    if (ch === "(" || ch === "[") return go(i + 1, [...stack, {}]);
    if (ch === ")" || ch === "]") {
      if (stack.length < 2) return;
      const m = s.slice(i + 1).match(/^\d+/);
      const k = m ? Number(m[0]) : 1;
      const top = stack[stack.length - 1];
      const below = { ...stack[stack.length - 2] };
      for (const [el, n] of Object.entries(top)) below[el] = (below[el] || 0) + n * k;
      return go(i + 1 + (m ? m[0].length : 0), [...stack.slice(0, -2), below]);
    }
    for (const len of [2, 1]) {
      const raw = s.slice(i, i + len);
      if (raw.length < len) continue;
      const sym = cased ? raw : raw[0].toUpperCase() + raw.slice(1).toLowerCase();
      if (cased && !/^[A-Z][a-z]?$/.test(raw)) continue;
      if (cased && len === 1 && /[a-z]/.test(s[i + 1] || "") && MASSES[s.slice(i, i + 2)]) continue;
      if (!MASSES[sym]) continue;
      const m = s.slice(i + len).match(/^\d+/);
      const k = m ? Number(m[0]) : 1;
      const top = { ...stack[stack.length - 1] };
      top[sym] = (top[sym] || 0) + k;
      go(i + len + (m ? m[0].length : 0), [...stack.slice(0, -1), top]);
    }
  };
  go(0, [{}]);
  return best && best.c;
}
const SUB = (s) => s.replace(/\d/g, (c) => "₀₁₂₃₄₅₆₇₈₉"[c]);
// "CuSO4·5H2O" → "CuSO₄·5H₂O" (the 5 of a hydrate stays full size)
const pretty = (f) =>
  f
    .split(/[·.]/)
    .map((part) => {
      const m = part.match(/^(\d*)(.*)$/);
      return m[1] + SUB(m[2]);
    })
    .join("·");
// "ca(oh)2" → "Ca(OH)2": split each run of letters into element symbols
function capitalise(f) {
  if (/[A-Z]/.test(f)) return f;
  return f.replace(/[a-z]+/g, (run) => {
    let best = null;
    const go = (i, out) => {
      if (i === run.length) {
        if (!best || out.length > best.length) best = out;
        return;
      }
      for (const len of [2, 1]) {
        const sym = run.slice(i, i + len);
        const cap = sym[0].toUpperCase() + sym.slice(1);
        if (sym.length === len && MASSES[cap]) go(i + len, [...out, cap]);
      }
    };
    go(0, []);
    return best ? best.join("") : run;
  });
}
const molarMass = (counts) => Object.entries(counts).reduce((s, [el, n]) => s + MASSES[el] * n, 0);

function formulaFrom(text) {
  const t = text.trim().replace(/^(?:the |a |an )/, "").replace(/[?.]$/, "");
  const name = NAMES[t.toLowerCase()];
  const f = name || t;
  const counts = parseFormula(f);
  if (!counts) return null;
  // all-lowercase input ("h2so4") is written back with capitals
  const shown = capitalise(f);
  return { f: shown, counts, name: name ? t : null };
}
function massLines(counts) {
  const parts = Object.entries(counts).map(([el, n]) => `${el}: ${n} × ${MASSES[el]} = ${decimal(n * MASSES[el], 3)}`);
  return parts.join("\n");
}

function chemistry(original) {
  const q = original.trim().replace(/\?+$/, "");
  const lq = q.toLowerCase();
  let m = lq.match(/^(?:what is |find |calculate |the )*(?:the )?(?:molar|molecular|formula|atomic) (?:mass|weight) of (.+)$/);
  if (m) {
    const src = q.slice(q.length - m[1].length);
    const x = formulaFrom(src);
    if (!x) return null;
    const M = molarMass(x.counts);
    return `${x.name ? `${x.name} is ${pretty(x.f)}.\n` : ""}Add up the atomic masses:\n${massLines(x.counts)}\n\nMolar mass of ${pretty(x.f)} = ${decimal(M, 3)} g/mol`;
  }
  m = lq.match(/(?:number of )?moles? (?:are )?(?:in|of|present in) (\d+(?:\.\d+)?)\s*(g|grams?|kg) of (.+)$/) || lq.match(/how many moles (?:are )?(?:there )?in (\d+(?:\.\d+)?)\s*(g|grams?|kg) (?:of )?(.+)$/);
  if (m) {
    const x = formulaFrom(q.slice(q.length - m[3].length));
    if (!x) return null;
    const mass = Number(m[1]) * (m[2] === "kg" ? 1000 : 1);
    const M = molarMass(x.counts);
    const n = mass / M;
    return `Molar mass of ${pretty(x.f)} = ${decimal(M, 3)} g/mol\nMoles = mass ÷ molar mass = ${decimal(mass)} ÷ ${decimal(M, 3)}\n\n= ${decimal(n, 4)} mol\n(That's ${fmtValue(n * 6.022e23, "none")} molecules, using Avogadro's number 6.022 × 10²³.)`;
  }
  m = lq.match(/(?:mass|weight) of (\d+(?:\.\d+)?) moles? of (.+)$/);
  if (m) {
    const x = formulaFrom(q.slice(q.length - m[2].length));
    if (!x) return null;
    const M = molarMass(x.counts);
    return `Mass = moles × molar mass = ${m[1]} × ${decimal(M, 3)}\n\n= ${decimal(Number(m[1]) * M, 3)} g`;
  }
  m = lq.match(/how many (?:molecules|atoms|particles) (?:are )?(?:there )?in (\d+(?:\.\d+)?)\s*(g|grams?) (?:of )?(.+)$/);
  if (m) {
    const x = formulaFrom(q.slice(q.length - m[3].length));
    if (!x) return null;
    const M = molarMass(x.counts);
    const n = Number(m[1]) / M;
    return `Moles = ${m[1]} ÷ ${decimal(M, 3)} = ${decimal(n, 4)} mol\nMolecules = moles × 6.022 × 10²³\n\n= ${fmtValue(n * 6.022e23, "none")} molecules`;
  }
  m = lq.match(/(?:percentage|percent|%|mass percent) (?:composition )?of (\w+) in (.+)$/);
  if (m) {
    const x = formulaFrom(q.slice(q.length - m[2].length));
    if (!x) return null;
    const elName = m[1];
    const sym = Object.keys(x.counts).find((el) => el.toLowerCase() === elName || ELEMENT_NAMES[el] === elName);
    if (!sym) return null;
    const M = molarMass(x.counts);
    const part = MASSES[sym] * x.counts[sym];
    return `Molar mass of ${pretty(x.f)} = ${decimal(M, 3)} g/mol\nMass of ${sym} in it = ${x.counts[sym]} × ${MASSES[sym]} = ${decimal(part, 3)}\n\n% of ${sym} = ${decimal(part, 3)} ÷ ${decimal(M, 3)} × 100 = ${decimal((part / M) * 100, 2)}%`;
  }
  m = q.match(/^(?:balance(?: the)?(?: chemical)?(?: equation)?:?\s*)?(.+?)\s*(?:->|→|⟶|=+>|=|\bgives\b|\bproduces\b|\byields\b)\s*(.+)$/i);
  if (m && /balance/i.test(q)) return balance(m[1], m[2]);
  return null;
}
const ELEMENT_NAMES = { H: "hydrogen", O: "oxygen", C: "carbon", N: "nitrogen", Na: "sodium", Cl: "chlorine", S: "sulphur", Ca: "calcium", Fe: "iron", K: "potassium", Mg: "magnesium", Cu: "copper", Al: "aluminium", P: "phosphorus", Zn: "zinc", Ag: "silver", Mn: "manganese" };

// Balance a chemical equation with the smallest whole numbers.
export function balance(left, right) {
  const side = (s) => s.split(/\s+\+\s+|\s*\+\s*(?=[A-Za-z(])/).map((t) => t.trim().replace(/^\d+\s*/, "")).filter(Boolean);
  const L = side(left).map(capitalise);
  const R = side(right).map(capitalise);
  const all = [...L, ...R];
  const parsed = all.map((f) => parseFormula(f));
  if (parsed.some((p) => !p) || all.length < 2 || all.length > 8) return null;
  const els = [...new Set(parsed.flatMap((p) => Object.keys(p)))];
  // Rows: elements; columns: compounds (products negative). Fix the last coefficient to 1.
  const n = all.length;
  const A = els.map((el) => all.map((_, j) => (parsed[j][el] || 0) * (j < L.length ? 1 : -1)));
  // Solve A[:, :n-1] c = −A[:, n-1] in least squares via normal equations (square system)
  const M = A.map((r) => r.slice(0, n - 1));
  const b = A.map((r) => -r[n - 1]);
  const MtM = Array.from({ length: n - 1 }, (_, i) => Array.from({ length: n - 1 }, (_, j) => M.reduce((s, r) => s + r[i] * r[j], 0)));
  const Mtb = Array.from({ length: n - 1 }, (_, i) => M.reduce((s, r, k) => s + r[i] * b[k], 0));
  const c = solveLinear(MtM, Mtb);
  if (!c) return "I couldn't balance that one: check the formulas (it may have more than one way to balance).";
  const coefs = [...c, 1];
  if (coefs.some((x) => x <= 1e-9)) return "That equation can't be balanced as written: check the formulas.";
  // scale to whole numbers
  let scale = 1;
  for (; scale <= 1000; scale++) if (coefs.every((x) => Math.abs(x * scale - Math.round(x * scale)) < 1e-6)) break;
  const ints = coefs.map((x) => Math.round(x * scale));
  const g = ints.reduce((a, x) => gcd(a, x));
  const final = ints.map((x) => x / g);
  // verify
  for (const row of A) if (Math.abs(row.reduce((s, v, j) => s + v * final[j], 0)) > 1e-9) return "I couldn't balance that one: check the formulas.";
  const term = (k, f) => `${final[k] === 1 ? "" : final[k]}${pretty(f)}`;
  const eq = `${L.map((f, k) => term(k, f)).join(" + ")} → ${R.map((f, k) => term(k + L.length, f)).join(" + ")}`;
  const counts = els.map((el) => `${el}: ${all.slice(0, L.length).reduce((s, f, k) => s + (parsed[k][el] || 0) * final[k], 0)}`).join(", ");
  return `Balanced equation:\n${eq}\n\nAtoms on each side: ${counts} ✓`;
}
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

// Questions that are clearly physics or chemistry go before the maths
// solvers (which would treat "comes to rest in 4 s" as a steady speed).
const CUES = /accelerat|retard|decelerat|comes? to (?:a )?(?:rest|stop)|from rest|brought to rest|dropped|thrown|projected|free(?:ly)? fall|\bforce\b|momentum|impulse|kinetic|potential energy|work done|\bpower\b|pressure|density|current|voltage|resistance|resistor|\bohms?\b|wavelength|frequency|specific heat|\bheat\b|molar|\bmoles?\b|molecules|balance|weight of|pendulum|focal|lens|spring|efficiency|units of electricity|electricity/;
export function solveScienceFirst(question) {
  return CUES.test(question.toLowerCase()) ? solveScience(question) : null;
}

export function solveScience(question) {
  const q = question
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\s+/g, " ")
    .trim();
  try {
    return chemistry(question) || resistors(q) || physics(q);
  } catch (err) {
    console.warn("Science solver failed:", err);
    return null;
  }
}
