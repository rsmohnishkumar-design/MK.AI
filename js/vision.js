// Alpaca Vision: MK.ai's own picture and video model. It reads a description
// ("a sunset over mountains with a lake", "diwali greeting card for Asha",
// "logo for MK Tech", "video of rain in a forest at night") and paints it on
// a canvas — sky, sun and moon, landscapes, water, buildings, animals and
// objects, weather, text, and styles like neon or pixel art. Videos are the
// same scenes brought to life and recorded in the browser. No outside
// service is used.

// --- Reading the description --------------------------------------------------------------

// Things that are drawn as emoji (animals, objects, food …)
const EMOJI = {
  cat: "🐱", kitten: "🐱", dog: "🐶", puppy: "🐶", elephant: "🐘", lion: "🦁", tiger: "🐯", horse: "🐎", cow: "🐄", bull: "🐂",
  goat: "🐐", sheep: "🐑", camel: "🐫", monkey: "🐒", rabbit: "🐇", bunny: "🐇", bear: "🐻", panda: "🐼", fox: "🦊", deer: "🦌",
  giraffe: "🦒", zebra: "🦓", pig: "🐖", mouse: "🐭", squirrel: "🐿️", peacock: "🦚", parrot: "🦜", eagle: "🦅", owl: "🦉",
  duck: "🦆", swan: "🦢", chicken: "🐔", hen: "🐔", rooster: "🐓", penguin: "🐧", flamingo: "🦩", dove: "🕊️", butterfly: "🦋",
  bee: "🐝", ladybug: "🐞", snail: "🐌", frog: "🐸", turtle: "🐢", tortoise: "🐢", snake: "🐍", crocodile: "🐊", dinosaur: "🦖",
  dragon: "🐉", unicorn: "🦄", fish: "🐟", dolphin: "🐬", whale: "🐋", shark: "🦈", octopus: "🐙", crab: "🦀", jellyfish: "🪼",
  car: "🚗", bus: "🚌", bike: "🚲", bicycle: "🚲", motorbike: "🏍️", train: "🚆", plane: "✈️", aeroplane: "✈️", airplane: "✈️",
  helicopter: "🚁", rocket: "🚀", ufo: "🛸", truck: "🚚", auto: "🛺", tractor: "🚜", ship: "🚢", robot: "🤖", astronaut: "🧑‍🚀",
  boy: "👦", girl: "👧", man: "👨", woman: "👩", baby: "👶", family: "👨‍👩‍👧", student: "🧑‍🎓", teacher: "🧑‍🏫", farmer: "🧑‍🌾",
  cake: "🎂", pizza: "🍕", burger: "🍔", icecream: "🍦", "ice cream": "🍦", apple: "🍎", mango: "🥭", banana: "🍌", coffee: "☕",
  tea: "🍵", book: "📖", books: "📚", laptop: "💻", computer: "💻", phone: "📱", guitar: "🎸", football: "⚽", cricket: "🏏",
  trophy: "🏆", crown: "👑", gift: "🎁", heart: "❤️", diya: "🪔", lamp: "🪔", umbrella: "☂️", tent: "⛺",
  snowman: "⛄", "christmas tree": "🎄", pumpkin: "🎃", flower: "🌸", rose: "🌹", sunflower: "🌻", tulip: "🌷", mushroom: "🍄",
  cactus: "🌵", ghost: "👻", alien: "👽", castle: "🏰", mosque: "🕌", church: "⛪", fountain: "⛲", ferris: "🎡",
};
const SKY_THINGS = new Set(["plane", "aeroplane", "airplane", "helicopter", "rocket", "ufo", "eagle", "dove", "butterfly", "bee", "dragon", "owl", "parrot"]);
const WATER_THINGS = new Set(["fish", "dolphin", "whale", "shark", "octopus", "crab", "jellyfish", "duck", "swan", "turtle", "ship"]);
const COLOURS = {
  red: "#ef4444", orange: "#f97316", yellow: "#facc15", green: "#22c55e", blue: "#3b82f6", purple: "#a855f7", violet: "#8b5cf6",
  pink: "#ec4899", black: "#111827", white: "#f8fafc", gold: "#f5b301", golden: "#f5b301", silver: "#cbd5e1", brown: "#92400e",
  grey: "#6b7280", gray: "#6b7280", teal: "#14b8a6", cyan: "#06b6d4", maroon: "#7f1d1d", navy: "#1e3a8a",
};
const FESTIVALS = [
  ["birthday", /birthday|bday/, "Happy Birthday", ["🎂", "🎈", "🎉", "🎁"], ["#ff6b9d", "#c44dff"]],
  ["diwali", /diwali|deepavali/, "Happy Diwali", ["🪔", "✨", "🎆"], ["#1a0b3d", "#7a1f5c"]],
  ["pongal", /pongal|sankranti|thai pongal/, "Happy Pongal", ["🌾", "☀️", "🐄", "🍚"], ["#fde68a", "#f59e0b"]],
  ["christmas", /christmas|xmas/, "Merry Christmas", ["🎄", "⭐", "🎁", "❄️"], ["#064e3b", "#7f1d1d"]],
  ["newyear", /new year/, `Happy New Year ${new Date().getFullYear() + (new Date().getMonth() === 11 ? 1 : 0)}`, ["🎆", "🥂", "✨"], ["#0f172a", "#312e81"]],
  ["eid", /\beid\b|ramzan|ramadan/, "Eid Mubarak", ["🌙", "⭐", "🕌"], ["#064e3b", "#0f766e"]],
  ["holi", /\bholi\b/, "Happy Holi", ["🎨", "💦", "🌈"], ["#f472b6", "#facc15"]],
  ["valentine", /valentine|love you|i love/, "With Love", ["❤️", "💖", "🌹"], ["#be123c", "#fb7185"]],
  ["wedding", /wedding|marriage|anniversary/, "Happy Anniversary", ["💐", "💍", "💖"], ["#fdf2f8", "#fbcfe8"]],
  ["thanks", /thank/, "Thank You", ["🙏", "💐", "✨"], ["#0ea5e9", "#6366f1"]],
  ["congrats", /congrat|well done|success|passed/, "Congratulations!", ["🏆", "🎉", "⭐"], ["#f59e0b", "#ef4444"]],
  ["getwell", /get well/, "Get Well Soon", ["💐", "🌼", "💛"], ["#a7f3d0", "#38bdf8"]],
  ["independence", /independence day|republic day/, "Happy Independence Day", ["🇮🇳", "🕊️", "✨"], ["#ff9933", "#138808"]],
  ["teachers", /teachers.? day/, "Happy Teachers' Day", ["📚", "🍎", "✏️"], ["#1d4ed8", "#9333ea"]],
  ["mothers", /mother.?s day|for mom|for amma/, "Happy Mother's Day", ["💐", "💖", "🌷"], ["#fb7185", "#f9a8d4"]],
  ["fathers", /father.?s day|for dad|for appa/, "Happy Father's Day", ["👔", "💙", "⭐"], ["#1e40af", "#0ea5e9"]],
];

const has = (q, re) => re.test(q);
function hash(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
// Seeded random numbers, so a picture looks the same every time it's shown
function rng(seed) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function isVisionRequest(question) {
  const q = question.toLowerCase();
  if (/\b(app|application|website|web site|program|game|software|code)\b/.test(q)) return false;
  if (/^(what|who|why|how|when|where|explain|define)\b/.test(q) && !/\b(draw|make|create)\b/.test(q)) return false;
  return (
    /^(draw|paint|sketch|illustrate|animate)\b/.test(q) ||
    /\b(draw|paint|sketch|create|make|generate|design|give me|show me)\b.*\b(image|picture|pic|photo|drawing|painting|poster|card|greeting|logo|wallpaper|video|animation|scene|art|artwork|kolam|rangoli|mandala|banner|chart|graph|invitation)\b/.test(q) ||
    /\b(image|picture|photo|drawing|painting|video|animation) of\b/.test(q) ||
    // "birthday card for Priya", "logo for MK Tech", "diwali wishes poster"
    /\b(card|greeting|poster|banner|invitation|logo|wallpaper)\s+(for|of|with|to)\b/.test(q) ||
    /^(a |an )?(happy \w+|diwali|pongal|christmas|new year|eid|holi|birthday|wedding|thank you|congratulations?)\b.*\b(card|greeting|poster|wishes image)\b/.test(q)
  );
}

// The description → a small plan of what to draw ("spec"), saved with the chat.
export function planPicture(question, variant = 0) {
  const raw = question.trim();
  const q = raw.toLowerCase();
  const spec = { v: 1, prompt: raw.slice(0, 300), seed: (hash(q) + variant * 7919) >>> 0 };
  spec.video = has(q, /\b(video|animation|animated|animate|moving|clip|gif|movie)\b/);
  const secs = q.match(/(\d{1,2})\s*(?:s|sec|secs|second|seconds)\b/);
  spec.duration = Math.min(15, Math.max(3, secs ? Number(secs[1]) : 6));
  spec.size = has(q, /portrait|phone wallpaper|mobile wallpaper|story|vertical|poster/) ? "portrait" : has(q, /square|profile|dp|logo|instagram post/) ? "square" : "landscape";
  spec.style = has(q, /pixel/) ? "pixel" : has(q, /neon|glow/) ? "neon" : has(q, /black and white|black & white|grayscale|greyscale|sketch|pencil/) ? "mono" : has(q, /vintage|old photo|sepia|retro/) ? "sepia" : has(q, /watercolou?r|soft|dreamy/) ? "soft" : "cartoon";
  const quoted = raw.match(/["“']([^"”']{1,60})["”']/) || raw.match(/\b(?:that says|saying|with (?:the )?text|with (?:the )?words|written|titled|named)\s+(.{1,50})$/i);
  if (quoted) spec.text = quoted[1].trim();
  const colour = Object.keys(COLOURS).find((c) => new RegExp(`\\b${c}\\b`).test(q));
  if (colour) spec.colour = COLOURS[colour];

  // Real photos come from the photo service; our own drawing is the fallback
  // (and is used for logos, charts and patterns, or when asked for "offline").
  spec.own = has(q, /\b(offline|your own drawing|own drawing|simple drawing|without internet)\b/);
  const fest = FESTIVALS.find(([, re]) => re.test(q));
  if (fest || has(q, /\b(card|greeting|wishes|invitation|poster|banner)\b/)) {
    spec.kind = "card";
    spec.theme = fest ? fest[0] : "general";
    const who = raw.match(/\b(?:for|to|dear)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)/) || raw.match(/\b(?:for|to)\s+(?:my\s+)?(\w+)\s*$/i);
    // "happy birthday Asha", "diwali wishes to Ravi"
    const named = raw.match(/\b(?:birthday|anniversary|diwali|deepavali|pongal|christmas|eid|holi|new year|wishes|congratulations|congrats|thank you|thanks|get well soon)\s+(?:to\s+)?([A-Z][a-z]+)\b/);
    if (named && !/^(From|Card|Poster|Video|Wishes|Greeting)$/.test(named[1])) spec.to = named[1];
    const from = raw.match(/\bfrom\s+([A-Za-z][a-zA-Z]+)/i);
    if (who && !/^(my|the|a|an|diwali|pongal|birthday|christmas|new|eid|holi)$/i.test(who[1])) spec.to = spec.to || who[1];
    if (from) spec.from = from[1];
    const cap = (w) => w && w.charAt(0).toUpperCase() + w.slice(1);
    spec.to = cap(spec.to);
    spec.from = cap(spec.from);
    if (!spec.text) spec.text = fest ? fest[2] : "Best Wishes";
    if (spec.size === "landscape" && has(q, /card|poster|invitation/)) spec.size = "portrait";
    spec.photo = !spec.own;
    return finishPhoto(spec, raw);
  }
  if (has(q, /\blogo\b/)) {
    spec.kind = "logo";
    spec.size = "square";
    const name = raw.match(/logo (?:for|of|called|named)\s+(?:my\s+|a\s+|an\s+|the\s+)?(.{1,40})$/i) || raw.match(/(?:make|create|design|draw)\s+(?:a\s+)?(.{1,40}?)\s+logo/i);
    spec.text = spec.text || (name ? name[1].replace(/\b(company|business|shop|brand|startup)\b/i, "").trim() : "MK") || "MK";
    return spec;
  }
  const chart = q.match(/\b(bar|pie|line|column|donut)\s*(?:chart|graph)\b/) || (has(q, /\b(chart|graph)\b/) && [null, "bar"]);
  if (chart) {
    spec.kind = "chart";
    spec.chart = chart[1] === "donut" ? "pie" : chart[1] === "column" ? "bar" : chart[1];
    const pairs = [...raw.matchAll(/([A-Za-z][A-Za-z ]{0,40}?)\s*[:=-]?\s*(\d+(?:\.\d+)?)/g)]
      .map((m) => [m[1].replace(/^.*\b(?:of|chart|graph|with|for|and|showing)\s+/i, "").replace(/^(and|,)\s*/i, "").trim().slice(0, 16), Number(m[2])])
      .filter(([l]) => l && !/^(chart|graph|bar|pie|line|of|with|and|for|draw|make|a|an|the)$/i.test(l));
    const nums = pairs.length >= 2 ? pairs : (raw.match(/\d+(?:\.\d+)?/g) || []).map((n, i) => [String.fromCharCode(65 + i), Number(n)]);
    spec.data = nums.slice(0, 12);
    if (spec.data.length < 2) spec.data = [["A", 30], ["B", 50], ["C", 20], ["D", 40]];
    return spec;
  }
  if (has(q, /kolam|rangoli|mandala|pattern|abstract|geometric|wallpaper|gradient/) && !has(q, /mountain|beach|sea|forest|city|sky|garden/)) {
    spec.kind = "pattern";
    spec.pattern = has(q, /kolam|rangoli/) ? "kolam" : has(q, /mandala/) ? "mandala" : has(q, /geometric/) ? "geometric" : has(q, /gradient/) ? "gradient" : "abstract";
    return spec;
  }
  if (has(q, /\b(space|galaxy|planet|planets|nebula|solar system|saturn|universe|outer space|astronaut)\b/)) spec.kind = "space";
  else if (has(q, /underwater|under the sea|under water|ocean floor|aquarium|coral|fish tank|sea bed|seabed/)) spec.kind = "underwater";
  else spec.kind = "scene";

  spec.time = has(q, /sunrise|dawn/) ? "sunrise" : has(q, /sunset|dusk|evening/) ? "sunset" : has(q, /night|midnight|moon|stars|starry/) ? "night" : has(q, /morning/) ? "morning" : "day";
  spec.weather = has(q, /storm|thunder|lightning/) ? "storm" : has(q, /rain|rainy|monsoon/) ? "rain" : has(q, /snow|snowy|winter/) ? "snow" : has(q, /fog|foggy|mist/) ? "fog" : has(q, /cloudy|clouds/) ? "cloudy" : "clear";
  const land = [];
  for (const [word, re] of [
    ["mountains", /mountain|hills? station|himalaya|peak/], ["hills", /\bhills?\b|valley/], ["sea", /\bsea\b|ocean|beach|coast|shore|waves/], ["lake", /\blake|river|pond/],
    ["desert", /desert|dunes|sahara/], ["forest", /forest|jungle|woods/], ["city", /city|skyline|buildings|town|chennai|mumbai|street/], ["field", /field|meadow|grass|farm|village|garden|park/],
  ]) if (re.test(q)) land.push(word);
  if (!land.length) land.push(spec.kind === "scene" ? "hills" : "none");
  spec.land = land;
  spec.beach = has(q, /beach|shore|coast/);
  spec.things = [];
  for (const [word, re] of [
    ["house", /\bhouses?\b|home|cottage|hut|village/], ["trees", /(?<!palm |coconut )\btrees?\b|forest|jungle|park|garden/], ["palms", /palm|coconut|tropical|beach/], ["flowers", /flowers?|garden|meadow|spring/],
    ["boat", /\bboat|sailboat|ship/], ["lighthouse", /lighthouse/], ["windmill", /windmill/], ["temple", /temple|gopuram|kovil/], ["birds", /\bbirds?\b/],
    ["rainbow", /rainbow/], ["balloons", /balloons?/], ["kite", /\bkites?\b/], ["aurora", /aurora|northern lights/], ["shooting", /shooting stars?|meteor/], ["fireworks", /fireworks?|crackers/],
    ["road", /\broad|street|highway/], ["bridge", /bridge/],
  ]) if (re.test(q)) spec.things.push(word);
  if (spec.kind === "scene" && land.includes("forest") && !spec.things.includes("trees")) spec.things.push("trees");
  spec.emoji = [];
  for (const [word, e] of Object.entries(EMOJI)) {
    const m = q.match(new RegExp(`\\b(?:(\\d+|two|three|four|five|many|some|a|an|one)\\s+)?${word}(s|es)?\\b`));
    if (m && !spec.emoji.some((x) => x.e === e)) {
      const count = { two: 2, three: 3, four: 4, five: 5, many: 5, some: 3, a: 1, an: 1, one: 1 }[m[1]] || Number(m[1]) || (m[2] ? 3 : 1);
      spec.emoji.push({ e, w: word, n: Math.min(count, 8), sky: SKY_THINGS.has(word), water: WATER_THINGS.has(word) });
    }
  }
  if (spec.kind === "underwater" && !spec.emoji.some((x) => x.water)) spec.emoji.push({ e: "🐟", w: "fish", n: 5, water: true }, { e: "🐠", w: "fish", n: 3, water: true });
  spec.photo = !spec.own;
  return finishPhoto(spec, raw);
}

// --- Real photos ------------------------------------------------------------------------------
// The words are turned into a detailed photography prompt for the free
// AI Horde image service (free, no key, no account). Only the description is sent.

const CLEAN_COMMAND = /^(?:please\s+)?(?:can you\s+)?(?:draw|paint|sketch|create|make|generate|design|give me|show me|render|produce)\s+(?:me\s+)?(?:an?\s+|the\s+)?(?:\d+\s*(?:s|sec|second)s?\s+)?(?:(?:realistic|real|hd|high quality|beautiful|nice|good|cinematic|short)\s+)*(?:photo|picture|pic|image|drawing|painting|video|animation|clip|scene|wallpaper|illustration|art|artwork)?\s*(?:of\s+|showing\s+|about\s+|with\s+)?/i;
export function subjectOfPicture(raw) {
  return raw
    .replace(CLEAN_COMMAND, "")
    .replace(/,?\s*\b\d{1,2}\s*(?:s|sec|secs|second|seconds)\b(?:\s+(?:long|video|clip))?/gi, "")
    .replace(/,?\s*\b(?:as an? |in )?(?:video|animation|animated|clip)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.-]+|[\s,.-]+$/g, "")
    .slice(0, 240);
}

const STYLE_WORDS = {
  pixel: "pixel art, 16-bit",
  neon: "neon lights, cyberpunk, cinematic night photography",
  mono: "black and white photograph, high contrast, fine grain",
  sepia: "vintage film photograph, sepia tones, 1970s",
  soft: "soft watercolor painting, delicate brush strokes",
};
function finishPhoto(spec, raw) {
  if (!spec.photo) return spec;
  const q = raw.toLowerCase();
  const subject = subjectOfPicture(raw) || "a beautiful landscape";
  const artsy = /\b(cartoon|anime|pixar|3d render|illustration|painting|oil painting|comic|sketch|drawing style|watercolou?r|pixel art|digital art|clay)\b/.test(q);
  const extra = STYLE_WORDS[spec.style] || "";
  const quality = artsy || extra ? "highly detailed, beautiful composition, vibrant colors" : "photorealistic, professional photography, natural lighting, 50mm lens, shallow depth of field, highly detailed, sharp focus, 8k";
  if (spec.kind === "card") {
    const theme = { birthday: "birthday party with balloons, cake and candles", diwali: "Diwali festival with glowing oil lamps (diyas), rangoli and fireworks", pongal: "Pongal harvest festival in Tamil Nadu, clay pot overflowing with rice, sugarcane, kolam, sunrise", christmas: "Christmas tree with lights, gifts and snow", newyear: "New Year fireworks over a city at night", eid: "Eid crescent moon, lanterns and mosque at dusk", holi: "Holi festival colourful powder in the air", valentine: "roses and hearts with soft bokeh", wedding: "wedding flowers and rings with soft golden light", thanks: "bouquet of flowers with warm light", congrats: "golden trophy and confetti celebration", getwell: "fresh flowers by a sunny window", independence: "Indian flag waving against blue sky", teachers: "books, apple and chalkboard in a classroom", mothers: "pink flowers and a gift", fathers: "gift box, tie and coffee on a wooden table" }[spec.theme] || "festive celebration decorations";
    spec.photoPrompt = `${theme}, festive background, bokeh lights, beautiful, no text, no letters, no words, ${quality}`;
  } else spec.photoPrompt = `${subject}${extra ? `, ${extra}` : ""}, ${quality}`;
  return spec;
}

// Real photos come from AI Horde (aihorde.net): a free, volunteer-run image AI.
// No account or key: the anonymous key is 0000000000. Only the prompt is sent.
const HORDE = "https://aihorde.net/api/v2";
const HORDE_HEADERS = { "Content-Type": "application/json", apikey: "0000000000", "Client-Agent": "MK.ai:1.0:https://mkai-c042b.web.app" };
const HORDE_MODELS = ["AlbedoBase XL (SDXL)", "Juggernaut XL", "ICBINP - I Can't Believe It's Not Photography", "Realistic Vision", "Deliberate"];
const NEGATIVE = "text, letters, watermark, signature, blurry, low quality, deformed, extra fingers, bad hands, nsfw, nude, violence, blood, gore, weapon, dead body, injury";
// Horde sizes: multiples of 64, longest side 768
export function hordeSize(spec) {
  const [W, H] = sizeOf(spec);
  const k = 768 / Math.max(W, H);
  return [Math.round((W * k) / 64) * 64, Math.round((H * k) / 64) * 64];
}
export function hordeRequest(spec, withModels = true) {
  const [width, height] = hordeSize(spec);
  const n = !spec.video || spec.kind === "card" ? 1 : spec.duration >= 10 ? 5 : 4;
  const prompt = spec.video && n > 1 ? `${spec.photoPrompt}, cinematic film still` : spec.photoPrompt;
  const body = {
    prompt: `${prompt} ### ${NEGATIVE}`,
    params: { sampler_name: "k_euler_a", cfg_scale: 6, steps: 20, width, height, n, seed: String(spec.seed % 1000000), karras: true },
    nsfw: false,
    censor_nsfw: true,
    r2: false,
    slow_workers: true,
  };
  if (withModels) body.models = HORDE_MODELS;
  return body;
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function hordeJson(path, options = {}) {
  const r = await fetch(HORDE + path, { ...options, headers: HORDE_HEADERS });
  if (!r.ok) throw new Error(`AI Horde ${r.status}`);
  return r.json();
}

// Things Alpaca Vision won't make
const BLOCKED = new RegExp(
  "\\b(" +
    [
      // adult content
      "nude|naked|nudity|nsfw|porn\\w*|sex|sexy|sexual|topless|undress\\w*|lingerie|erotic|genitals?|bikini|kiss\\w*",
      // death and dying
      "die|dies|died|dying|dead|death\\w*|corpse\\w*|funeral|grave|coffin|skull|skeleton",
      // violence and weapons
      "kill\\w*|murder\\w*|stab\\w*|shooting|shot dead|gun\\w*|rifle|pistol|weapon\\w*|knife|knives|sword|bomb\\w*|explo(?:sion|de|ding)\\w*|terror\\w*|attack\\w*|fight\\w*|punch\\w*|beat(?:en|ing)|violen\\w*|war crime|massacre|execution|torture\\w*|hang(?:ed|ing)|noose|kidnap\\w*|hostage",
      // injury, blood and harm
      "gore|gory|blood\\w*|bleed\\w*|injur\\w*|wound\\w*|hurt\\w*|beheading|decapitat\\w*|mutilat\\w*|drown\\w*|self.?harm|suicid\\w*|cutting (?:myself|himself|herself)|abuse\\w*|bully\\w*|accident victim",
      // drugs and hate
      "drugs?|cocaine|heroin|smoking|cigarette\\w*|alcohol|drunk|racis\\w*|nazi\\w*",
    ].join("|") +
    ")\\b",
  "i"
);
// Harmless phrases that contain a blocked word
const ALLOWED = /\b(dead sea|death valley|dead end|screenshot|photo ?shoot|fight(?:ing)? for (?:freedom|justice)|pillow fight|water fight|snowball fight|fire ?fight\w*)\b/gi;
export const isBlockedPicture = (q) => BLOCKED.test(q.replace(ALLOWED, " "));

// A sentence saying what was drawn
export function describePicture(spec) {
  const THEME = { newyear: "New Year", getwell: "get-well", thanks: "thank-you", congrats: "congratulations", valentine: "love", independence: "Independence Day", teachers: "Teachers' Day", mothers: "Mother's Day", fathers: "Father's Day", general: "" };
  if (spec.kind === "card") return `a ${(spec.theme in THEME ? THEME[spec.theme] : spec.theme) + (THEME[spec.theme] === "" ? "" : " ")}greeting card${spec.to ? ` for ${spec.to}` : ""} that says “${spec.text}”`;
  if (spec.kind === "logo") return `a logo for “${spec.text}”`;
  if (spec.kind === "chart") return `a ${spec.chart} chart of ${spec.data.map(([l, v]) => `${l} ${v}`).join(", ")}`;
  if (spec.kind === "pattern") return `a ${spec.pattern} ${spec.pattern === "kolam" ? "" : "pattern"}`.trim();
  const bits = [];
  if (spec.kind === "space") bits.push("outer space with planets and stars");
  else if (spec.kind === "underwater") bits.push("an underwater world");
  else bits.push(`${{ day: "a sunny", morning: "a morning", sunrise: "a sunrise", sunset: "a sunset", night: "a night" }[spec.time]} scene`);
  const land = spec.land.filter((l) => l !== "none");
  if (land.length) bits.push(`with ${land.join(", ")}`);
  if (spec.things.length) bits.push(`and ${spec.things.join(", ")}`);
  if (spec.emoji.length) bits.push(`featuring ${spec.emoji.map((x) => (x.n > 1 ? `${x.n} ${x.w}s` : x.w)).join(", ")}`);
  if (spec.weather !== "clear" && spec.kind === "scene") bits.push(`in ${spec.weather === "cloudy" ? "cloudy weather" : spec.weather}`);
  return bits.join(" ");
}

// --- Painting ---------------------------------------------------------------------------------

const SIZES = { landscape: [960, 600], portrait: [600, 900], square: [720, 720] };
export const sizeOf = (spec) => SIZES[spec.size] || SIZES.landscape;

const SKIES = {
  day: ["#3b8fe8", "#8fcaf5", "#d8f0ff"],
  morning: ["#6fa8e8", "#f5c9a0", "#ffe9c7"],
  sunrise: ["#4c5bd4", "#f08a8a", "#ffd39a"],
  sunset: ["#2b1055", "#d53369", "#ffb347"],
  night: ["#020617", "#0b1a3a", "#1e2d55"],
};

function gradient(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + amount * 255)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function emoji(ctx, e, x, y, size) {
  ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(e, x, y);
}
function textBlock(ctx, text, x, y, size, colour, { font = "Georgia, serif", weight = "700", shadow = true, maxWidth } = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = size / 6;
    ctx.shadowOffsetY = size / 20;
  }
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y, maxWidth);
  ctx.restore();
}

function drawSky(ctx, W, H, spec, t, R) {
  const stops = SKIES[spec.time] || SKIES.day;
  let sky = stops;
  if (spec.colour && spec.kind === "scene" && /sky/.test(spec.prompt.toLowerCase())) sky = [shade(spec.colour, -0.25), spec.colour, shade(spec.colour, 0.3)];
  const wet = spec.weather === "storm" || spec.weather === "rain" || spec.weather === "fog";
  if (wet && spec.time === "night") sky = ["#05080f", "#111827", "#1f2937"];
  else if (spec.weather === "storm") sky = ["#1f2937", "#374151", "#4b5563"];
  else if (wet) sky = ["#5b6b82", "#8795a8", "#b5c0cc"];
  ctx.fillStyle = gradient(ctx, 0, 0, 0, H * 0.75, sky);
  ctx.fillRect(0, 0, W, H);
  const night = spec.time === "night" && !["rain", "storm", "fog"].includes(spec.weather);
  if (night) {
    for (let i = 0; i < 140; i++) {
      const x = R() * W;
      const y = R() * H * 0.6;
      const tw = 0.5 + 0.5 * Math.sin(t * 3 + i);
      ctx.globalAlpha = 0.35 + 0.65 * tw * R();
      ctx.fillStyle = "#fff";
      ctx.fillRect(x, y, 1.5 + R() * 1.5, 1.5 + R() * 1.5);
    }
    ctx.globalAlpha = 1;
  }
}

function drawSunMoon(ctx, W, H, spec, t) {
  if (spec.weather === "storm" || spec.weather === "rain") return;
  const horizon = H * 0.62;
  if (spec.time === "night") {
    const x = W * 0.78;
    const y = H * 0.18;
    const r = Math.min(W, H) * 0.06;
    ctx.save();
    ctx.shadowColor = "#fff8d6";
    ctx.shadowBlur = r;
    ctx.fillStyle = "#fff8d6";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (/crescent|half moon/.test(spec.prompt.toLowerCase())) {
      ctx.fillStyle = SKIES.night[0];
      ctx.beginPath();
      ctx.arc(x + r * 0.45, y - r * 0.15, r * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  const r = Math.min(W, H) * (spec.time === "day" ? 0.07 : 0.09);
  let x = W * 0.72;
  const tall = spec.land && (spec.land.includes("mountains") || spec.land.includes("city"));
  let y = { day: H * 0.18, morning: H * 0.3, sunrise: tall ? H * 0.3 : horizon - r * 0.4, sunset: tall ? H * 0.3 : horizon - r * 0.4 }[spec.time];
  // in videos the sun rises or sets
  if (spec.video && spec.time === "sunrise") y -= Math.min(t / spec.duration, 1) * H * 0.25;
  if (spec.video && spec.time === "sunset") y += Math.min(t / spec.duration, 1) * H * 0.2;
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 4);
  glow.addColorStop(0, spec.time === "day" ? "rgba(255,250,210,0.8)" : "rgba(255,200,120,0.8)");
  glow.addColorStop(1, "rgba(255,200,120,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
  ctx.fillStyle = spec.time === "day" ? "#fff3a3" : "#ffcf70";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawClouds(ctx, W, H, spec, t, R) {
  const n = spec.weather === "cloudy" || spec.weather === "rain" || spec.weather === "storm" ? 7 : spec.time === "night" ? 1 : 3;
  for (let i = 0; i < n; i++) {
    const baseX = R() * W;
    const y = H * (0.08 + R() * 0.25);
    const s = 40 + R() * 50;
    const x = ((baseX + t * (8 + R() * 10)) % (W + 300)) - 150;
    ctx.fillStyle = spec.weather === "storm" || spec.weather === "rain" ? "rgba(90,100,115,0.9)" : spec.time === "night" ? "rgba(200,210,230,0.18)" : spec.time === "sunset" ? "rgba(255,200,210,0.75)" : "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.moveTo(x + s * 0.6, y);
    ctx.arc(x, y, s * 0.6, 0, Math.PI * 2);
    ctx.moveTo(x + s * 1.3, y - s * 0.25);
    ctx.arc(x + s * 0.6, y - s * 0.25, s * 0.7, 0, Math.PI * 2);
    ctx.moveTo(x + s * 1.85, y);
    ctx.arc(x + s * 1.3, y, s * 0.55, 0, Math.PI * 2);
    ctx.rect(x - s * 0.1, y, s * 1.45, s * 0.5);
    ctx.fill("nonzero");
  }
}

function landColour(spec, base, ground = false) {
  if (spec.weather === "snow" && ground) return "#e8eef5";
  if (spec.time === "night") return shade(base, -0.35);
  if (spec.time === "sunset") return shade(base, -0.18);
  return base;
}

function drawMountains(ctx, W, H, spec, R) {
  const horizon = H * 0.62;
  const layers = [["#6b7fa3", 0.3], ["#4b5f82", 0.22], ["#34466a", 0.14]];
  layers.forEach(([c, height], li) => {
    ctx.fillStyle = landColour(spec, c);
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    let x = 0;
    const peaks = [];
    while (x < W + 80) {
      const px = x + 60 + R() * 120;
      const py = horizon - H * height * (0.55 + R() * 0.45);
      peaks.push([px, py]);
      ctx.lineTo(px, py);
      x = px + 50 + R() * 120;
      ctx.lineTo(x, horizon - H * height * (0.15 + R() * 0.2));
    }
    ctx.lineTo(W, horizon);
    ctx.closePath();
    ctx.fill();
    // snowy tops on the back range
    if (li === 0 || spec.weather === "snow") {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (const [px, py] of peaks) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - 22, py + 30);
        ctx.lineTo(px + 22, py + 30);
        ctx.closePath();
        ctx.fill();
      }
    }
  });
}

function drawHills(ctx, W, H, spec, R) {
  const horizon = H * 0.64;
  [["#7cc36b", 0.08, 0.62], ["#4fa55a", 0.05, 0.7]].forEach(([c, amp, top]) => {
    ctx.fillStyle = landColour(spec, c, true);
    ctx.beginPath();
    ctx.moveTo(0, H);
    const phase = R() * 6;
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, H * top - Math.sin(x / (W / 3) + phase) * H * amp);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  });
  void horizon;
}

function drawCity(ctx, W, H, spec, R) {
  const base = H * 0.66;
  let x = 0;
  while (x < W) {
    const w = 40 + R() * 70;
    const h = H * (0.12 + R() * 0.32);
    ctx.fillStyle = spec.time === "night" ? "#0f172a" : spec.time === "sunset" ? "#3b2449" : "#5a6b85";
    ctx.fillRect(x, base - h, w, h);
    // windows
    for (let wy = base - h + 10; wy < base - 10; wy += 16) {
      for (let wx = x + 6; wx < x + w - 8; wx += 12) {
        const lit = spec.time === "night" ? R() < 0.55 : R() < 0.15;
        ctx.fillStyle = lit ? "#fde68a" : spec.time === "night" ? "#1e293b" : "#8aa0bb";
        ctx.fillRect(wx, wy, 6, 8);
      }
    }
    x += w + 2 + R() * 6;
  }
}

function drawDesert(ctx, W, H, spec, R) {
  [["#f3c97a", 0.64, 0.05], ["#e4a95a", 0.72, 0.06], ["#d4914a", 0.82, 0.04]].forEach(([c, top, amp]) => {
    ctx.fillStyle = landColour(spec, c);
    ctx.beginPath();
    ctx.moveTo(0, H);
    const ph = R() * 5;
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, H * top - Math.sin(x / (W / 2.2) + ph) * H * amp);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  });
}

function drawWater(ctx, W, H, spec, t, top, bottom) {
  const grey = spec.weather === "rain" || spec.weather === "storm" || spec.weather === "fog";
  const deep = spec.time === "night" ? "#0b1f3a" : grey ? "#2f4256" : spec.time === "sunset" ? "#5a2a5c" : "#1d6fb8";
  const light = spec.time === "night" ? "#1c3558" : grey ? "#5d7085" : spec.time === "sunset" ? "#e0776b" : "#4fb3e8";
  ctx.fillStyle = gradient(ctx, 0, top, 0, bottom, [light, deep]);
  ctx.fillRect(0, top, W, bottom - top);
  // waves
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  for (let row = 0; row < 7; row++) {
    const y = top + ((bottom - top) * (row + 0.5)) / 7;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, y + Math.sin(x / 30 + t * 2 + row) * (1.5 + row * 0.5));
    ctx.stroke();
  }
  // sun or moon reflection
  if (spec.weather !== "rain" && spec.weather !== "storm") {
    ctx.fillStyle = spec.time === "night" ? "rgba(255,248,214,0.25)" : "rgba(255,230,160,0.35)";
    for (let i = 0; i < 8; i++) {
      const w = 60 - i * 5 + Math.sin(t * 3 + i) * 6;
      ctx.fillRect(W * 0.72 - w / 2, top + 6 + i * 10, w, 3);
    }
  }
}

function drawTree(ctx, x, y, s, spec, kind = "round") {
  ctx.fillStyle = "#6b3f1f";
  ctx.fillRect(x - s * 0.08, y - s * 0.5, s * 0.16, s * 0.5);
  const leaf = spec.weather === "snow" ? "#dbe7f0" : landColour(spec, kind === "pine" ? "#1f6f43" : "#2f8f46");
  ctx.fillStyle = leaf;
  if (kind === "pine") {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x, y - s * (1.3 - i * 0.28));
      ctx.lineTo(x - s * (0.35 + i * 0.1), y - s * (0.55 - i * 0.12) - s * 0.2);
      ctx.lineTo(x + s * (0.35 + i * 0.1), y - s * (0.55 - i * 0.12) - s * 0.2);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.arc(x, y - s * 0.75, s * 0.38, 0, Math.PI * 2);
    ctx.arc(x - s * 0.25, y - s * 0.6, s * 0.28, 0, Math.PI * 2);
    ctx.arc(x + s * 0.25, y - s * 0.6, s * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
}
function drawPalm(ctx, x, y, s, t) {
  ctx.strokeStyle = "#7a4a22";
  ctx.lineWidth = s * 0.08;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + s * 0.15, y - s * 0.6, x + s * 0.05, y - s * 1.2);
  ctx.stroke();
  ctx.strokeStyle = "#1f8a4c";
  ctx.lineWidth = s * 0.07;
  const sway = Math.sin(t * 1.5) * 0.08;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.55 + sway;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.05, y - s * 1.2);
    ctx.quadraticCurveTo(x + s * 0.05 + Math.cos(a) * s * 0.5, y - s * 1.2 + Math.sin(a) * s * 0.3 - s * 0.1, x + s * 0.05 + Math.cos(a) * s * 0.75, y - s * 1.2 + Math.sin(a) * s * 0.4 + s * 0.2);
    ctx.stroke();
  }
}
function drawHouse(ctx, x, y, s, spec, R) {
  const walls = ["#f5d6a8", "#f8b4a0", "#c7e0f4", "#fde68a"][Math.floor(R() * 4)];
  ctx.fillStyle = landColour(spec, walls);
  ctx.fillRect(x - s / 2, y - s * 0.6, s, s * 0.6);
  ctx.fillStyle = spec.weather === "snow" ? "#f1f5f9" : "#b4442f";
  ctx.beginPath();
  ctx.moveTo(x - s * 0.6, y - s * 0.6);
  ctx.lineTo(x, y - s * 1.05);
  ctx.lineTo(x + s * 0.6, y - s * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#6b3f1f";
  ctx.fillRect(x - s * 0.1, y - s * 0.32, s * 0.2, s * 0.32);
  ctx.fillStyle = spec.time === "night" ? "#fde68a" : "#9fd3f5";
  ctx.fillRect(x - s * 0.38, y - s * 0.48, s * 0.18, s * 0.15);
  ctx.fillRect(x + s * 0.2, y - s * 0.48, s * 0.18, s * 0.15);
}
function drawTemple(ctx, x, y, s, spec) {
  // a gopuram: stacked, narrowing tiers
  const c = landColour(spec, "#d9a066");
  for (let i = 0; i < 6; i++) {
    const w = s * (1 - i * 0.13);
    const h = s * 0.22;
    ctx.fillStyle = i % 2 ? shade(c.startsWith("#") ? c : "#d9a066", -0.08) : c;
    ctx.fillRect(x - w / 2, y - h * (i + 1), w, h);
  }
  ctx.fillStyle = "#f5b301";
  ctx.beginPath();
  ctx.arc(x, y - s * 0.22 * 6 - 8, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5b3a1a";
  ctx.fillRect(x - s * 0.12, y - s * 0.3, s * 0.24, s * 0.3);
}
function drawLighthouse(ctx, x, y, s, spec, t) {
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.moveTo(x - s * 0.18, y);
  ctx.lineTo(x - s * 0.1, y - s);
  ctx.lineTo(x + s * 0.1, y - s);
  ctx.lineTo(x + s * 0.18, y);
  ctx.fill();
  ctx.fillStyle = "#dc2626";
  for (let i = 0; i < 3; i++) ctx.fillRect(x - s * 0.16 + i * 0.02 * s, y - s * (0.25 + i * 0.3), s * (0.32 - i * 0.04), s * 0.12);
  ctx.fillStyle = "#fde68a";
  ctx.fillRect(x - s * 0.1, y - s * 1.12, s * 0.2, s * 0.12);
  if (spec.time === "night" || spec.time === "sunset") {
    const a = t * 1.5;
    ctx.fillStyle = "rgba(253,230,138,0.25)";
    ctx.beginPath();
    ctx.moveTo(x, y - s * 1.06);
    ctx.lineTo(x + Math.cos(a) * s * 4, y - s * 1.06 + Math.sin(a) * s * 0.4 - s * 0.3);
    ctx.lineTo(x + Math.cos(a) * s * 4, y - s * 1.06 + Math.sin(a) * s * 0.4 + s * 0.3);
    ctx.fill();
  }
}
function drawWindmill(ctx, x, y, s, t) {
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(x - s * 0.05, y - s, s * 0.1, s);
  ctx.save();
  ctx.translate(x, y - s);
  ctx.rotate(t * 1.2);
  ctx.fillStyle = "#f8fafc";
  for (let i = 0; i < 3; i++) {
    ctx.rotate((Math.PI * 2) / 3);
    ctx.fillRect(-s * 0.03, 0, s * 0.06, s * 0.5);
  }
  ctx.restore();
}
function drawBoat(ctx, x, y, s) {
  ctx.fillStyle = "#7c2d12";
  ctx.beginPath();
  ctx.moveTo(x - s * 0.6, y);
  ctx.lineTo(x + s * 0.6, y);
  ctx.lineTo(x + s * 0.4, y + s * 0.25);
  ctx.lineTo(x - s * 0.4, y + s * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.9);
  ctx.lineTo(x, y - s * 0.05);
  ctx.lineTo(x + s * 0.5, y - s * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - 2, y - s * 0.9, 3, s * 0.9);
}
function drawRainbow(ctx, W, H) {
  const cols = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#6366f1", "#a855f7"];
  ctx.save();
  ctx.globalAlpha = 0.55;
  cols.forEach((c, i) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(W * 0.45, H * 0.7, W * 0.42 - i * 10, Math.PI, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}
function drawAurora(ctx, W, H, t) {
  ctx.save();
  ctx.globalAlpha = 0.35;
  for (let band = 0; band < 3; band++) {
    ctx.fillStyle = gradient(ctx, 0, H * 0.05, 0, H * 0.45, ["rgba(52,211,153,0)", band === 1 ? "#a78bfa" : "#34d399", "rgba(52,211,153,0)"]);
    ctx.beginPath();
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, H * (0.12 + band * 0.06) + Math.sin(x / 90 + t + band) * 25);
    for (let x = W; x >= 0; x -= 10) ctx.lineTo(x, H * (0.32 + band * 0.06) + Math.sin(x / 70 + t * 1.3 + band) * 20);
    ctx.fill();
  }
  ctx.restore();
}
function drawBirds(ctx, W, H, t, R) {
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const x = ((R() * W + t * 60) % (W + 100)) - 50;
    const y = H * (0.15 + R() * 0.2) + Math.sin(t * 2 + i) * 5;
    const flap = Math.sin(t * 8 + i) * 4;
    ctx.beginPath();
    ctx.moveTo(x - 10, y - flap);
    ctx.quadraticCurveTo(x - 4, y - 6, x, y);
    ctx.quadraticCurveTo(x + 4, y - 6, x + 10, y - flap);
    ctx.stroke();
  }
}
function drawFireworks(ctx, W, H, t, R) {
  const cols = ["#f472b6", "#facc15", "#60a5fa", "#34d399", "#f87171", "#c084fc"];
  for (let i = 0; i < 5; i++) {
    const cx = W * (0.15 + R() * 0.7);
    const cy = H * (0.12 + R() * 0.3);
    const period = 2 + R() * 1.5;
    const phase = ((t + R() * period) % period) / period;
    const rad = 20 + phase * (60 + R() * 40);
    ctx.globalAlpha = 1 - phase;
    ctx.fillStyle = cols[i % cols.length];
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
function drawWeather(ctx, W, H, spec, t, R) {
  if (spec.weather === "rain" || spec.weather === "storm") {
    ctx.strokeStyle = "rgba(200,215,235,0.6)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 220; i++) {
      const x = R() * W;
      const y = (R() * H + t * 500) % H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y + 14);
      ctx.stroke();
    }
    if (spec.weather === "storm" && Math.sin(t * 2.3) > 0.97) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(0, 0, W, H);
    }
  }
  if (spec.weather === "snow") {
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 160; i++) {
      const x = (R() * W + Math.sin(t + i) * 10) % W;
      const y = (R() * H + t * 40) % H;
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + R() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (spec.weather === "fog") {
    ctx.fillStyle = "rgba(230,235,240,0.45)";
    ctx.fillRect(0, H * 0.35, W, H * 0.65);
  }
}

// An image scaled to fill the frame (zoom ≥ 1), shifted by (dx, dy) of the spare room
function drawCover(ctx, img, W, H, zoom = 1, dx = 0, dy = 0) {
  const s = Math.max(W / img.width, H / img.height) * zoom;
  const w = img.width * s;
  const h = img.height * s;
  ctx.drawImage(img, (W - w) / 2 + dx * (w - W) / 2, (H - h) / 2 + dy * (h - H) / 2, w, h);
}

function paintScene(ctx, W, H, spec, t) {
  const R = rng(spec.seed);
  drawSky(ctx, W, H, spec, t, rng(spec.seed + 1));
  if (spec.things.includes("aurora") && spec.time === "night") drawAurora(ctx, W, H, t);
  drawSunMoon(ctx, W, H, spec, t);
  if (spec.things.includes("shooting") && spec.time === "night") {
    const p = (t % 3) / 3;
    ctx.strokeStyle = `rgba(255,255,255,${1 - p})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W * (0.2 + p * 0.4), H * (0.1 + p * 0.15));
    ctx.lineTo(W * (0.2 + p * 0.4) - 60, H * (0.1 + p * 0.15) - 20);
    ctx.stroke();
  }
  if (spec.things.includes("rainbow")) drawRainbow(ctx, W, H);
  drawClouds(ctx, W, H, spec, t, rng(spec.seed + 2));
  if (spec.things.includes("fireworks")) drawFireworks(ctx, W, H, t, rng(spec.seed + 3));
  if (spec.things.includes("birds")) drawBirds(ctx, W, H, t, rng(spec.seed + 4));

  const land = spec.land;
  const waterTop = H * 0.62;
  if (land.includes("mountains")) drawMountains(ctx, W, H, spec, rng(spec.seed + 5));
  if (land.includes("city")) {
    drawCity(ctx, W, H, spec, rng(spec.seed + 6));
    if (!land.includes("sea") && !land.includes("lake")) {
      ctx.fillStyle = spec.time === "night" ? "#111827" : "#4b5563";
      ctx.fillRect(0, H * 0.66, W, H * 0.34);
      ctx.fillStyle = spec.time === "night" ? "rgba(253,230,138,0.5)" : "rgba(255,255,255,0.5)";
      for (let x = 20; x < W; x += 60) ctx.fillRect(x - ((t * 80) % 60), H * 0.82, 30, 4);
    }
  }
  if (land.includes("sea") || land.includes("lake")) {
    drawWater(ctx, W, H, spec, t, waterTop, spec.beach || land.includes("field") || land.includes("forest") ? H * 0.8 : H);
    if (spec.beach) {
      ctx.fillStyle = landColour(spec, "#f2d59b");
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, H * 0.8);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H * 0.8 + Math.sin(x / 50 + t) * 3);
      ctx.lineTo(W, H);
      ctx.fill();
    }
  }
  if (land.includes("desert")) drawDesert(ctx, W, H, spec, rng(spec.seed + 7));
  const ground = !(land.includes("sea") || land.includes("lake")) || land.includes("field") || land.includes("forest");
  const cityOnly = land.includes("city") && !land.includes("field") && !land.includes("forest") && !land.includes("mountains") && !land.includes("hills");
  if (!cityOnly && (land.includes("hills") || ((land.includes("field") || land.includes("forest") || land.includes("mountains") || land.includes("city")) && !land.includes("desert") && ground))) {
    if (land.includes("hills")) drawHills(ctx, W, H, spec, rng(spec.seed + 8));
    ctx.fillStyle = landColour(spec, "#5aa95a", true);
    if (land.includes("sea") || land.includes("lake")) ctx.fillRect(0, H * 0.8, W, H * 0.2);
    else if (land.includes("mountains") && !land.includes("hills")) ctx.fillRect(0, H * 0.62, W, H * 0.38);
    else ctx.fillRect(0, H * 0.78, W, H * 0.22);
  }
  if (spec.things.includes("road")) {
    ctx.fillStyle = "#374151";
    ctx.beginPath();
    ctx.moveTo(W * 0.42, H * 0.66);
    ctx.lineTo(W * 0.58, H * 0.66);
    ctx.lineTo(W * 0.85, H);
    ctx.lineTo(W * 0.15, H);
    ctx.fill();
    ctx.strokeStyle = "#fde68a";
    ctx.setLineDash([18, 16]);
    ctx.lineDashOffset = -t * 60;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(W * 0.5, H * 0.66);
    ctx.lineTo(W * 0.5, H);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (spec.things.includes("bridge")) {
    ctx.strokeStyle = "#7c2d12";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.95, W * 0.3, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }

  // Foreground things
  const gy = H * 0.86;
  const S = Math.min(W, H);
  if (spec.things.includes("temple")) drawTemple(ctx, W * 0.3, gy, S * 0.28, spec);
  if (spec.things.includes("lighthouse")) drawLighthouse(ctx, W * 0.15, H * 0.8, S * 0.3, spec, t);
  if (spec.things.includes("windmill")) drawWindmill(ctx, W * 0.82, gy - 10, S * 0.28, t);
  if (spec.things.includes("house")) {
    const n = /village|houses/.test(spec.prompt.toLowerCase()) ? 3 : 1;
    for (let i = 0; i < n; i++) drawHouse(ctx, W * (0.55 + i * 0.13), gy, S * (0.17 - i * 0.02), spec, R);
  }
  if (spec.things.includes("trees")) {
    const n = land.includes("forest") ? 14 : 3;
    const pine = land.includes("mountains") || spec.weather === "snow" || land.includes("forest");
    for (let i = 0; i < n; i++) {
      const x = land.includes("forest") ? (i / n) * W + R() * 40 : W * (0.08 + R() * 0.35);
      drawTree(ctx, x, gy + R() * 30, S * (0.14 + R() * 0.1), spec, pine && R() < 0.7 ? "pine" : "round");
    }
  }
  if (spec.things.includes("palms")) {
    drawPalm(ctx, W * 0.1, H * 0.95, S * 0.32, t);
    drawPalm(ctx, W * 0.22, H * 0.97, S * 0.26, t + 1);
  }
  if (spec.things.includes("flowers")) {
    const cols = ["#f472b6", "#facc15", "#f87171", "#c084fc", "#fb923c"];
    for (let i = 0; i < 40; i++) {
      const x = R() * W;
      const y = H * (0.84 + R() * 0.14);
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath();
      ctx.arc(x, y, 4 + R() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (spec.things.includes("boat")) {
    const bx = (W * 0.35 + t * 30) % (W + 100);
    drawBoat(ctx, bx, H * 0.7 + Math.sin(t * 2) * 3, S * 0.12);
  }
  if (spec.things.includes("balloons")) {
    const cols = ["#ef4444", "#3b82f6", "#facc15", "#22c55e", "#a855f7"];
    for (let i = 0; i < 5; i++) {
      const x = W * (0.15 + i * 0.17);
      const y = H * (0.45 - ((t * 0.05 + i * 0.07) % 0.5)) + Math.sin(t + i) * 8;
      ctx.strokeStyle = "#374151";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + 26);
      ctx.lineTo(x + 5, y + 70);
      ctx.stroke();
      ctx.fillStyle = cols[i];
      ctx.beginPath();
      ctx.ellipse(x, y, 20, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (spec.things.includes("kite")) {
    const x = W * 0.3 + Math.sin(t) * 20;
    const y = H * 0.22 + Math.cos(t * 1.3) * 10;
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.moveTo(x, y - 30);
    ctx.lineTo(x + 22, y);
    ctx.lineTo(x, y + 30);
    ctx.lineTo(x - 22, y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#374151";
    ctx.beginPath();
    ctx.moveTo(x, y + 30);
    ctx.quadraticCurveTo(W * 0.4, H * 0.6, W * 0.45, H * 0.85);
    ctx.stroke();
  }
  drawEmoji(ctx, W, H, spec, t, R);
  drawWeather(ctx, W, H, spec, t, rng(spec.seed + 9));
}

function drawEmoji(ctx, W, H, spec, t, R) {
  const S = Math.min(W, H);
  let slot = 0;
  for (const item of spec.emoji) {
    for (let i = 0; i < item.n; i++) {
      slot++;
      let x;
      let y;
      let size;
      if (item.sky) {
        x = ((W * (0.2 + R() * 0.6) + t * 50 * (i % 2 ? 1 : 0.7)) % (W + 80)) - 40;
        y = H * (0.15 + R() * 0.25) + Math.sin(t * 2 + i) * 6;
        size = S * 0.09;
      } else if (item.water && (spec.kind === "underwater" || spec.land.includes("sea") || spec.land.includes("lake"))) {
        const dir = i % 2 ? 1 : -1;
        x = (((R() * W + dir * t * 40) % W) + W) % W;
        y = spec.kind === "underwater" ? H * (0.2 + R() * 0.65) : H * (0.66 + R() * 0.1);
        size = S * (spec.kind === "underwater" ? 0.07 + R() * 0.04 : 0.07);
      } else {
        x = W * (0.3 + ((slot * 0.17) % 0.6));
        y = H * (0.85 + R() * 0.06) - Math.abs(Math.sin(t * 3 + i)) * (spec.video ? 6 : 0);
        size = S * (0.14 - Math.min(0.05, i * 0.01));
      }
      emoji(ctx, item.e, x, y, size);
    }
  }
}

function paintSpace(ctx, W, H, spec, t) {
  const R = rng(spec.seed);
  ctx.fillStyle = gradient(ctx, 0, 0, W, H, ["#020617", "#0b1030", "#1a0b2e"]);
  ctx.fillRect(0, 0, W, H);
  // nebula
  for (let i = 0; i < 5; i++) {
    const x = R() * W;
    const y = R() * H;
    const r = 120 + R() * 200;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, ["rgba(168,85,247,0.35)", "rgba(59,130,246,0.3)", "rgba(236,72,153,0.3)"][i % 3]);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  for (let i = 0; i < 250; i++) {
    ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 2 + i));
    ctx.fillStyle = "#fff";
    ctx.fillRect(R() * W, R() * H, 1.6, 1.6);
  }
  ctx.globalAlpha = 1;
  const S = Math.min(W, H);
  const planets = [["#f59e0b", "#b45309", 0.12, true], ["#60a5fa", "#1e3a8a", 0.07, false], ["#f87171", "#7f1d1d", 0.05, false]];
  planets.forEach(([a, b, r, ring], i) => {
    const angle = t * (0.3 + i * 0.2) + i * 2;
    const x = W * (0.3 + i * 0.25) + Math.cos(angle) * (spec.video ? 20 : 0);
    const y = H * (0.35 + (i % 2) * 0.3) + Math.sin(angle) * (spec.video ? 10 : 0);
    const g = ctx.createRadialGradient(x - S * r * 0.3, y - S * r * 0.3, 0, x, y, S * r);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, S * r, 0, Math.PI * 2);
    ctx.fill();
    if (ring) {
      ctx.strokeStyle = "rgba(253,230,138,0.7)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(x, y, S * r * 1.8, S * r * 0.45, -0.3, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  if (/earth/.test(spec.prompt.toLowerCase())) emoji(ctx, "🌍", W * 0.8, H * 0.75, S * 0.2);
  if (/rocket|launch/.test(spec.prompt.toLowerCase()) && !spec.emoji.some((e) => e.w === "rocket")) spec.emoji.push({ e: "🚀", w: "rocket", n: 1, sky: true });
  drawEmoji(ctx, W, H, { ...spec, emoji: spec.emoji.map((e) => ({ ...e, sky: true })) }, t, R);
}

function paintUnderwater(ctx, W, H, spec, t) {
  const R = rng(spec.seed);
  ctx.fillStyle = gradient(ctx, 0, 0, 0, H, ["#38bdf8", "#0369a1", "#082f49"]);
  ctx.fillRect(0, 0, W, H);
  // light rays
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  for (let i = 0; i < 5; i++) {
    const x = W * (0.1 + i * 0.2) + Math.sin(t + i) * 20;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 60, 0);
    ctx.lineTo(x + 160, H);
    ctx.lineTo(x + 40, H);
    ctx.fill();
  }
  // sand, seaweed, coral
  ctx.fillStyle = "#e9c98f";
  ctx.fillRect(0, H * 0.88, W, H * 0.12);
  for (let i = 0; i < 12; i++) {
    const x = R() * W;
    ctx.strokeStyle = ["#16a34a", "#15803d", "#4ade80"][i % 3];
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x, H * 0.9);
    for (let k = 1; k <= 6; k++) ctx.lineTo(x + Math.sin(t * 1.5 + k + i) * 10, H * 0.9 - k * (18 + R() * 8));
    ctx.stroke();
  }
  for (let i = 0; i < 6; i++) emoji(ctx, ["🪸", "🐚", "⭐"][i % 3], R() * W, H * 0.9, Math.min(W, H) * 0.06);
  // bubbles
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  for (let i = 0; i < 25; i++) {
    const x = R() * W + Math.sin(t * 2 + i) * 6;
    const y = H - ((R() * H + t * 60) % H);
    ctx.beginPath();
    ctx.arc(x, y, 3 + R() * 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawEmoji(ctx, W, H, { ...spec, land: ["sea"] }, t, R);
}

function paintCard(ctx, W, H, spec, t, photo = null) {
  const R = rng(spec.seed);
  const fest = FESTIVALS.find(([id]) => id === spec.theme);
  const bg = spec.colour ? [shade(spec.colour, -0.2), spec.colour] : fest ? fest[4] : ["#6366f1", "#ec4899"];
  if (photo) {
    drawCover(ctx, photo, W, H, spec.video ? 1.04 + 0.04 * Math.sin(t / 2) : 1, 0, 0);
    ctx.fillStyle = gradient(ctx, 0, 0, 0, H, ["rgba(0,0,0,0.15)", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.25)"]);
  } else ctx.fillStyle = gradient(ctx, 0, 0, W, H, bg);
  ctx.fillRect(0, 0, W, H);
  const icons = fest ? fest[3] : ["✨", "🌸", "⭐"];
  const dark = photo || ["diwali", "newyear", "christmas", "eid"].includes(spec.theme);
  // decorations
  if (spec.theme === "diwali" || spec.theme === "newyear") drawFireworks(ctx, W, H * 0.8, t, rng(spec.seed + 3));
  for (let i = 0; i < 26; i++) {
    const x = R() * W;
    const y = (R() * H + (spec.video ? t * (30 + R() * 30) : 0)) % H;
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = ["#fde68a", "#f9a8d4", "#a5f3fc", "#bbf7d0", "#fff"][i % 5];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(R() * 6 + t);
    ctx.fillRect(-4, -8, 8, 16);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // a border
  ctx.strokeStyle = dark ? "rgba(253,230,138,0.8)" : "rgba(255,255,255,0.85)";
  ctx.lineWidth = 6;
  ctx.strokeRect(22, 22, W - 44, H - 44);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(34, 34, W - 68, H - 68);
  const S = Math.min(W, H);
  // big icons (the photo already shows the festival)
  if (!photo) icons.slice(0, 3).forEach((e, i) => emoji(ctx, e, W * (0.25 + i * 0.25), H * 0.28 + Math.sin(t * 2 + i) * (spec.video ? 8 : 0), S * (i === 1 ? 0.2 : 0.13)));
  // text grows in for videos
  const grow = spec.video ? Math.min(1, t / 1.2) : 1;
  const title = spec.text;
  const size = Math.min(S * 0.12, (W * 1.6) / Math.max(8, title.length)) * (0.6 + 0.4 * grow);
  ctx.globalAlpha = grow;
  textBlock(ctx, title, W / 2, H * 0.55, size, dark ? "#fde68a" : "#ffffff", { maxWidth: W * 0.86 });
  if (spec.to) textBlock(ctx, `Dear ${spec.to}`, W / 2, H * 0.42, S * 0.055, "#ffffff", { font: "system-ui, sans-serif", weight: "600" });
  const wishes = { birthday: "Wishing you a wonderful year ahead!", diwali: "May the festival of lights fill your life with joy", pongal: "May this harvest bring you prosperity", christmas: "Peace, joy and love to you", newyear: "Wishing you joy and success", eid: "Blessings of peace and happiness", holi: "May your life be full of colours", valentine: "You make every day brighter", thanks: "You're truly appreciated", congrats: "So proud of you!", getwell: "Wishing you a speedy recovery", independence: "Jai Hind!", teachers: "Thank you for everything you teach us", mothers: "Thank you for your endless love", fathers: "Thank you for always being there", wedding: "Wishing you a lifetime of happiness", general: "With warm wishes" }[spec.theme] || "With warm wishes";
  textBlock(ctx, wishes, W / 2, H * 0.68, S * 0.045, "rgba(255,255,255,0.95)", { font: "system-ui, sans-serif", weight: "500", maxWidth: W * 0.8 });
  if (spec.from) textBlock(ctx, `— ${spec.from}`, W / 2, H * 0.8, S * 0.045, "#ffffff", { font: "Georgia, serif", weight: "italic 600" });
  ctx.globalAlpha = 1;
  if (spec.theme === "diwali" && !photo) for (let i = 0; i < 5; i++) emoji(ctx, "🪔", W * (0.15 + i * 0.175), H * 0.9, S * 0.07);
}

function paintLogo(ctx, W, H, spec, t) {
  const R = rng(spec.seed);
  const base = spec.colour || ["#6366f1", "#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"][Math.floor(R() * 6)];
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  const name = spec.text.trim();
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase() || "MK";
  const cx = W / 2;
  const cy = H * 0.42;
  const r = Math.min(W, H) * 0.24;
  const layout = Math.floor(R() * 3);
  ctx.save();
  ctx.translate(cx, cy);
  if (spec.video) ctx.rotate(Math.sin(t) * 0.05);
  ctx.fillStyle = gradient(ctx, -r, -r, r, r, [shade(base, 0.15), shade(base, -0.2)]);
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 20;
  ctx.beginPath();
  if (layout === 0) ctx.arc(0, 0, r, 0, Math.PI * 2);
  else if (layout === 1) for (let i = 0; i < 6; i++) ctx.lineTo(Math.cos((i / 6) * Math.PI * 2 - Math.PI / 2) * r, Math.sin((i / 6) * Math.PI * 2 - Math.PI / 2) * r);
  else ctx.roundRect(-r, -r, r * 2, r * 2, r * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  textBlock(ctx, initials, cx, cy + 4, r * (initials.length > 2 ? 0.62 : 0.8), "#ffffff", { font: "system-ui, sans-serif", weight: "800", shadow: false });
  textBlock(ctx, name.length > 1 ? name.toUpperCase() : "YOUR BRAND", cx, H * 0.8, Math.min(W * 0.08, (W * 1.3) / Math.max(6, name.length)), shade(base, -0.3), { font: "system-ui, sans-serif", weight: "800", shadow: false, maxWidth: W * 0.9 });
}

function paintChart(ctx, W, H, spec, t) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  const data = spec.data;
  const max = Math.max(...data.map(([, v]) => v), 1);
  const cols = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#0ea5e9", "#a855f7", "#f97316", "#14b8a6", "#ec4899", "#84cc16", "#64748b", "#eab308"];
  const grow = spec.video ? Math.min(1, t / 2) : 1;
  const title = spec.text || spec.prompt.replace(/^(draw|make|create|generate|show me)\s+(a|an)?\s*/i, "").slice(0, 60);
  textBlock(ctx, title.charAt(0).toUpperCase() + title.slice(1), W / 2, 36, 22, "#111827", { font: "system-ui, sans-serif", shadow: false, maxWidth: W * 0.9 });
  if (spec.chart === "pie") {
    const total = data.reduce((s, [, v]) => s + v, 0) || 1;
    let a = -Math.PI / 2;
    const cx = W * 0.38;
    const cy = H * 0.55;
    const r = Math.min(W, H) * 0.33;
    data.forEach(([label, v], i) => {
      const slice = (v / total) * Math.PI * 2 * grow;
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a, a + slice);
      ctx.fill();
      a += slice;
      ctx.fillRect(W * 0.75, H * 0.2 + i * 30, 18, 18);
      ctx.fillStyle = "#111827";
      ctx.font = "16px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`${label} ${Math.round((v / total) * 100)}%`, W * 0.75 + 26, H * 0.2 + i * 30 + 9);
    });
    return;
  }
  const left = 60;
  const bottom = H - 60;
  const top = 80;
  const width = W - left - 30;
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  for (let k = 0; k <= 4; k++) {
    const y = bottom - ((bottom - top) * k) / 4;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(W - 30, y);
    ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(String(Math.round((max * k) / 4)), left - 8, y);
  }
  const step = width / data.length;
  ctx.textAlign = "center";
  if (spec.chart === "line") {
    ctx.strokeStyle = spec.colour || cols[0];
    ctx.lineWidth = 3;
    ctx.beginPath();
    data.forEach(([, v], i) => {
      const x = left + step * (i + 0.5);
      const y = bottom - ((bottom - top) * v * grow) / max;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  }
  data.forEach(([label, v], i) => {
    const x = left + step * (i + 0.5);
    const h = ((bottom - top) * v * grow) / max;
    ctx.fillStyle = spec.colour || cols[i % cols.length];
    if (spec.chart === "line") {
      ctx.beginPath();
      ctx.arc(x, bottom - h, 5, 0, Math.PI * 2);
      ctx.fill();
    } else ctx.fillRect(x - step * 0.3, bottom - h, step * 0.6, h);
    ctx.fillStyle = "#111827";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(label, x, bottom + 20, step);
    ctx.fillText(String(v), x, bottom - h - 12);
  });
}

function paintPattern(ctx, W, H, spec, t) {
  const R = rng(spec.seed);
  const cx = W / 2;
  const cy = H / 2;
  const S = Math.min(W, H);
  if (spec.pattern === "kolam") {
    ctx.fillStyle = "#3b2416";
    ctx.fillRect(0, 0, W, H);
    const n = 7;
    const gap = (S * 0.8) / n;
    const x0 = cx - (gap * (n - 1)) / 2;
    const y0 = cy - (gap * (n - 1)) / 2;
    ctx.fillStyle = "#fff";
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (Math.abs(i - 3) + Math.abs(j - 3) <= 3) {
      ctx.beginPath();
      ctx.arc(x0 + i * gap, y0 + j * gap, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    const reveal = spec.video ? Math.min(1, t / (spec.duration * 0.8)) : 1;
    let drawn = 0;
    const loops = [];
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) if (Math.abs(i + 0.5 - 3) + Math.abs(j + 0.5 - 3) <= 3) loops.push([i, j]);
    for (const [i, j] of loops) {
      if (drawn++ > loops.length * reveal) break;
      const x = x0 + (i + 0.5) * gap;
      const y = y0 + (j + 0.5) * gap;
      ctx.beginPath();
      ctx.moveTo(x, y - gap * 0.5);
      ctx.quadraticCurveTo(x + gap * 0.5, y - gap * 0.5, x + gap * 0.5, y);
      ctx.quadraticCurveTo(x + gap * 0.5, y + gap * 0.5, x, y + gap * 0.5);
      ctx.quadraticCurveTo(x - gap * 0.5, y + gap * 0.5, x - gap * 0.5, y);
      ctx.quadraticCurveTo(x - gap * 0.5, y - gap * 0.5, x, y - gap * 0.5);
      ctx.stroke();
    }
    const petals = ["#f43f5e", "#f59e0b", "#22c55e", "#a855f7"];
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = petals[k];
      ctx.beginPath();
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      ctx.arc(cx + Math.cos(a) * gap * 3.6, cy + Math.sin(a) * gap * 3.6, gap * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (spec.pattern === "mandala") {
    ctx.fillStyle = "#1e1b4b";
    ctx.fillRect(0, 0, W, H);
    const cols = ["#f472b6", "#facc15", "#60a5fa", "#34d399", "#c084fc", "#fb923c"];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.2);
    for (let ring = 6; ring >= 1; ring--) {
      const petals = 6 + ring * 2;
      const rr = (S * 0.45 * ring) / 6;
      ctx.fillStyle = cols[ring % cols.length];
      for (let k = 0; k < petals; k++) {
        ctx.save();
        ctx.rotate((k / petals) * Math.PI * 2);
        ctx.beginPath();
        ctx.ellipse(0, -rr * 0.8, rr * 0.12, rr * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.fillStyle = "#fde68a";
    ctx.beginPath();
    ctx.arc(0, 0, S * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (spec.pattern === "gradient") {
    const h = (t * 20 + R() * 360) % 360;
    ctx.fillStyle = gradient(ctx, 0, 0, W, H, [`hsl(${h},80%,60%)`, `hsl(${(h + 60) % 360},80%,55%)`, `hsl(${(h + 140) % 360},80%,50%)`]);
    ctx.fillRect(0, 0, W, H);
    return;
  }
  // geometric and abstract
  ctx.fillStyle = spec.colour ? shade(spec.colour, -0.35) : "#0f172a";
  ctx.fillRect(0, 0, W, H);
  const cols = spec.colour ? [spec.colour, shade(spec.colour, 0.2), shade(spec.colour, -0.15), "#fde68a"] : ["#f472b6", "#facc15", "#38bdf8", "#34d399", "#a78bfa", "#fb7185"];
  if (spec.pattern === "geometric") {
    const size = S / 8;
    for (let y = 0; y < H; y += size) for (let x = 0; x < W; x += size) {
      ctx.fillStyle = cols[Math.floor(R() * cols.length)];
      ctx.beginPath();
      const k = Math.floor(R() * 3);
      if (k === 0) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + size, y);
        ctx.lineTo(x, y + size);
      } else if (k === 1) ctx.arc(x + size / 2, y + size / 2, (size / 2.4) * (1 + 0.1 * Math.sin(t * 2 + x)), 0, Math.PI * 2);
      else ctx.rect(x + size * 0.15, y + size * 0.15, size * 0.7, size * 0.7);
      ctx.fill();
    }
    return;
  }
  for (let i = 0; i < 18; i++) {
    const x = R() * W + Math.sin(t + i) * 20;
    const y = R() * H + Math.cos(t * 0.8 + i) * 20;
    const r = S * (0.05 + R() * 0.18);
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.6 + R() * 0.6), R() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Styles applied on top: pixel, neon, black and white, sepia, soft
function applyStyle(canvas, ctx, spec) {
  const W = canvas.width;
  const H = canvas.height;
  if (spec.style === "pixel") {
    const small = document.createElement("canvas");
    small.width = Math.round(W / 8);
    small.height = Math.round(H / 8);
    const sctx = small.getContext("2d");
    sctx.drawImage(canvas, 0, 0, small.width, small.height);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(small, 0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    return;
  }
  const filter = { mono: "grayscale(1) contrast(1.15)", sepia: "sepia(0.85) contrast(1.05)", soft: "blur(1.5px) saturate(1.3)", neon: "saturate(2) contrast(1.3) brightness(1.05)" }[spec.style];
  if (!filter) return;
  const copy = document.createElement("canvas");
  copy.width = W;
  copy.height = H;
  copy.getContext("2d").drawImage(canvas, 0, 0);
  ctx.save();
  ctx.filter = filter;
  ctx.drawImage(copy, 0, 0);
  ctx.restore();
  if (spec.style === "neon") {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "rgba(40,0,90,0.35)";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// Paints one frame (t = seconds into the video; 0 for a still picture).
export function paint(canvas, spec, t = 0, photo = null) {
  const [W, H] = sizeOf(spec);
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  const painter = { card: paintCard, logo: paintLogo, chart: paintChart, pattern: paintPattern, space: paintSpace, underwater: paintUnderwater }[spec.kind] || paintScene;
  painter(ctx, W, H, spec, t, photo);
  if (spec.text && ["scene", "space", "underwater", "pattern"].includes(spec.kind)) {
    const S = Math.min(W, H);
    textBlock(ctx, spec.text, W / 2, H * 0.12, Math.min(S * 0.09, (W * 1.5) / Math.max(8, spec.text.length)), "#ffffff", { maxWidth: W * 0.9 });
  }
  ctx.restore();
  if (spec.style && spec.style !== "cartoon") applyStyle(canvas, ctx, spec);
  // a small mark in the corner
  ctx.save();
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillStyle = spec.kind === "logo" || spec.kind === "chart" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.7)";
  ctx.shadowColor = spec.kind === "logo" || spec.kind === "chart" ? "transparent" : "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 3;
  ctx.fillText("Alpaca Vision · MK.ai", W - 10, H - 10);
  ctx.restore();
}

// --- Photo videos -----------------------------------------------------------------------------

// One frame of a photo video: slow zoom and pan on each shot, crossfades,
// a soft vignette, live weather, and the title.
function paintPhotoFrame(canvas, spec, photos, t) {
  const [W, H] = sizeOf(spec);
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, W, H);
  if (spec.kind === "card") {
    paint(canvas, spec, t, photos[0]);
    return;
  }
  const n = photos.length;
  const seg = spec.video ? spec.duration / n : 1;
  const fade = Math.min(0.9, seg * 0.3);
  const i = spec.video ? Math.min(n - 1, Math.floor(t / seg)) : 0;
  const local = spec.video ? t - i * seg : 0;
  const move = (k, u) => {
    // each shot moves differently: zoom in, zoom out, pan left, pan right
    const kind = k % 4;
    const zoom = kind === 1 ? 1.16 - 0.12 * u : 1.04 + 0.12 * u;
    const dx = kind === 2 ? 0.8 - 1.6 * u : kind === 3 ? -0.8 + 1.6 * u : 0;
    const dy = kind === 0 ? -0.3 * u : 0;
    return [zoom, dx, dy];
  };
  ctx.globalAlpha = 1;
  drawCover(ctx, photos[i], W, H, ...(spec.video ? move(i, local / seg) : [1, 0, 0]));
  if (spec.video && i < n - 1 && local > seg - fade) {
    ctx.globalAlpha = (local - (seg - fade)) / fade;
    drawCover(ctx, photos[i + 1], W, H, ...move(i + 1, 0));
    ctx.globalAlpha = 1;
  }
  if (spec.video) {
    // gentle vignette and a fade in/out
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    if (spec.weather && ["rain", "storm", "snow"].includes(spec.weather)) drawWeather(ctx, W, H, spec, t, rng(spec.seed + 9));
    const edge = Math.min(t, spec.duration - t);
    if (edge < 0.5) {
      ctx.fillStyle = `rgba(0,0,0,${1 - edge / 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
  if (spec.text) {
    const S = Math.min(W, H);
    ctx.globalAlpha = spec.video ? Math.min(1, t / 1.2) : 1;
    textBlock(ctx, spec.text, W / 2, H * 0.14, Math.min(S * 0.09, (W * 1.5) / Math.max(8, spec.text.length)), "#ffffff", { maxWidth: W * 0.9 });
    ctx.globalAlpha = 1;
  }
  ctx.save();
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 3;
  ctx.fillText("Alpaca Vision · MK.ai", W - 10, H - 10);
  ctx.restore();
}

// Loads one image; resolves with the image or null.
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img.naturalWidth ? img : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Jobs waiting at AI Horde, so "stop" can cancel them
const activeJobs = new Set();
let cancelGen = 0;
export function cancelPhotos() {
  cancelGen++;
  const n = activeJobs.size;
  for (const id of activeJobs) fetch(`${HORDE}/generate/status/${id}`, { method: "DELETE", headers: HORDE_HEADERS }).catch(() => {});
  activeJobs.clear();
  return n;
}

// Asks AI Horde for the photo (or the video's shots) and waits in its queue.
// onProgress(text) gets "In the queue…" updates. Resolves with images, or null
// (with photos.stopped = true when the person said "stop").
// Alpaca Vision HD: Gemini's picture model, with the key saved in the vault
async function geminiPhoto(spec, onProgress) {
  if (spec.video && spec.kind !== "card") return null;
  let tools;
  try {
    tools = [await import("./ai.js"), await import("./gemini-rest.js")];
  } catch {
    return null;
  }
  const [{ geminiModelsMatching }, { geminiImage }] = tools;
  const { key, models } = await geminiModelsMatching(/image/i, ["gemini-2.5-flash-image"]);
  if (!key) return null;
  const [W, H] = sizeOf(spec);
  const shape = W > H * 1.2 ? "a wide landscape (16:9)" : H > W * 1.2 ? "a tall portrait (9:16)" : "a square";
  onProgress("Painting in HD…");
  try {
    const url = await geminiImage(key, models, `Create ${shape} image: ${spec.photoPrompt}. High quality, detailed, no text or watermarks unless asked. Family-friendly.`);
    const img = await loadImage(url);
    return img ? [img] : null;
  } catch (err) {
    console.warn("Gemini picture:", err);
    return null;
  }
}

// Pollinations: a free, keyless image AI that answers in seconds (only the
// description is sent). A video gets a few shots of the same scene.
async function fastPhotos(spec, onProgress) {
  const [W, H] = hordeSize(spec);
  const shots = spec.video && spec.kind !== "card" ? (spec.duration >= 10 ? 5 : 4) : 1;
  const prompt = `${spec.photoPrompt}${shots > 1 ? ", cinematic film still" : ""}, high quality, detailed`;
  onProgress("Painting…");
  const one = (i) =>
    Promise.race([
      loadImage(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${W}&height=${H}&seed=${(spec.seed + i * 7919) % 1000000}&nologo=true&safe=true`),
      new Promise((resolve) => setTimeout(() => resolve(null), 60000)),
    ]);
  const imgs = (await Promise.all(Array.from({ length: shots }, (_, i) => one(i)))).filter(Boolean);
  return imgs.length ? imgs : null;
}

async function loadPhotos(spec, onProgress, timeoutMs = 300000) {
  const gen0 = cancelGen;
  const hd = await geminiPhoto(spec, onProgress);
  if (gen0 !== cancelGen) return { stopped: true };
  if (hd) return hd;
  const fast = await fastPhotos(spec, onProgress).catch(() => null);
  if (gen0 !== cancelGen) return { stopped: true };
  if (fast) return fast;
  const until = Date.now() + timeoutMs;
  const gen = cancelGen;
  let id = null;
  const submit = async (withModels) => {
    if (id) {
      activeJobs.delete(id);
      fetch(`${HORDE}/generate/status/${id}`, { method: "DELETE", headers: HORDE_HEADERS }).catch(() => {});
    }
    id = (await hordeJson("/generate/async", { method: "POST", body: JSON.stringify(hordeRequest(spec, withModels)) })).id;
    if (id) activeJobs.add(id);
  };
  try {
    let anyModel = false;
    try {
      await submit(true);
    } catch {
      anyModel = true;
      await submit(false);
    }
    if (!id) return null;
    for (;;) {
      if (Date.now() > until) throw new Error("timed out");
      await pause(4000);
      if (gen !== cancelGen) return { stopped: true };
      const c = await hordeJson(`/generate/check/${id}`);
      if (c.faulted) throw new Error("faulted");
      if (c.done) break;
      // The photo models have a long queue (or no volunteer has them): take any model
      if (!anyModel && (c.is_possible === false || (c.wait_time || 0) > 120)) {
        anyModel = true;
        await submit(false);
        continue;
      }
      const wait = Math.max(1, Math.round(c.wait_time || 0));
      const time = wait >= 90 ? `${Math.round(wait / 60)} min` : `${wait} s`;
      onProgress(c.processing ? `Painting… about ${time}` : c.queue_position ? `In the queue (#${c.queue_position}), about ${time}` : `Starting… about ${time}`);
    }
    const done = await hordeJson(`/generate/status/${id}`);
    activeJobs.delete(id);
    id = null;
    const gens = (done.generations || []).filter((g) => g.img && !g.censored);
    const imgs = await Promise.all(gens.map((g) => loadImage(g.img.startsWith("http") ? g.img : `data:image/webp;base64,${g.img}`)));
    const photos = imgs.filter(Boolean);
    return photos.length ? photos : null;
  } catch (err) {
    console.warn("Photo service:", err);
    if (id) {
      activeJobs.delete(id);
      fetch(`${HORDE}/generate/status/${id}`, { method: "DELETE", headers: HORDE_HEADERS }).catch(() => {});
    }
    return null;
  }
}

// --- In the chat -------------------------------------------------------------------------------

function btn(label, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "code-copy";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
const fileBase = (spec) => (spec.prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "alpaca-vision");

// Records frames drawn by draw(canvas, t) as a video, in real time.
export function recordVideo(spec, onProgress = () => {}, draw = (c, t) => paint(c, spec, t)) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    draw(canvas, 0);
    if (!canvas.captureStream || typeof MediaRecorder === "undefined") return reject(new Error("This browser can't record video."));
    const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
    if (!type) return reject(new Error("This browser can't record video."));
    let stream;
    try {
      stream = canvas.captureStream(30);
    } catch {
      return reject(new Error("This picture can't be recorded here."));
    }
    const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => resolve(new Blob(chunks, { type: type.split(";")[0] }));
    const start = performance.now();
    rec.start(250);
    const frame = () => {
      const t = (performance.now() - start) / 1000;
      draw(canvas, Math.min(t, spec.duration));
      onProgress(Math.min(1, t / spec.duration));
      if (t < spec.duration) requestAnimationFrame(frame);
      else rec.stop();
    };
    requestAnimationFrame(frame);
  });
}

// Shows a picture or video (from a saved spec) inside an answer.
export function mountVision(container, specText) {
  let spec;
  try {
    spec = JSON.parse(specText);
  } catch {
    container.textContent = "(This picture couldn't be shown.)";
    return;
  }
  const box = document.createElement("div");
  box.className = "vision-box";
  const canvas = document.createElement("canvas");
  canvas.className = "vision-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", describePicture(spec));
  const bar = document.createElement("div");
  bar.className = "vision-bar";
  const label = document.createElement("span");
  const actions = document.createElement("span");
  actions.className = "code-actions";
  bar.append(label, actions);
  box.append(canvas, bar);
  container.append(box);

  let photos = null; // loaded real photos, or null for our own drawing
  let playing = false;
  let raf = 0;
  let started = 0;
  let loadToken = 0;
  const frame = (c, t) => (photos ? paintPhotoFrame(c, spec, photos, t) : paint(c, spec, t));
  const loop = () => {
    const t = ((performance.now() - started) / 1000) % spec.duration;
    frame(canvas, t);
    raf = requestAnimationFrame(loop);
  };
  let playBtn = null;
  const setPlaying = (on) => {
    playing = on;
    cancelAnimationFrame(raf);
    if (on) {
      started = performance.now();
      loop();
    } else frame(canvas, 0);
    if (playBtn) playBtn.textContent = on ? "⏸ pause" : "▶ Play";
  };
  const setLabel = () => {
    const kind = photos ? (spec.video ? `${spec.duration} s video · ${photos.length} AI photos` : "AI photo") : spec.video ? `${spec.duration} s animation` : "Drawing";
    label.textContent = kind;
  };

  async function load() {
    const token = ++loadToken;
    photos = null;
    if (!spec.photo) {
      setLabel();
      frame(canvas, 0);
      return;
    }
    // Meanwhile: Alpaca's own drawing, with the real photo's queue status
    let waitText = "Asking for a real photo…";
    const showWaiting = () => {
      paint(canvas, spec, 0);
      label.textContent = `Real ${spec.video ? "video" : "photo"}: ${waitText} (drawing shown meanwhile)`;
    };
    showWaiting();
    const got = await loadPhotos(spec, (text) => {
      waitText = text;
      if (token === loadToken) showWaiting();
    });
    if (token !== loadToken) return;
    const stopped = got && got.stopped;
    photos = Array.isArray(got) && got.length ? got : null;
    if (!photos) label.dataset.fallback = "1";
    setLabel();
    if (!photos) label.textContent += stopped ? " (real photo stopped — drawn by Alpaca)" : " (photo service busy — drawn by Alpaca)";
    if (spec.video && playing) setPlaying(true);
    else frame(canvas, 0);
  }

  if (spec.video) {
    playBtn = btn("▶ Play", () => setPlaying(!playing));
    actions.append(playBtn);
    actions.append(
      btn("⬇ Video", async (e) => {
        const b = e.currentTarget;
        const was = b.textContent;
        b.disabled = true;
        try {
          const blob = await recordVideo(spec, (p) => (b.textContent = `recording ${Math.round(p * 100)}%`), frame);
          saveBlob(blob, `${fileBase(spec)}.${blob.type.includes("mp4") ? "mp4" : "webm"}`);
          b.textContent = was;
        } catch (err) {
          b.textContent = err.message;
          setTimeout(() => (b.textContent = was), 3000);
        } finally {
          b.disabled = false;
        }
      })
    );
  }
  actions.append(
    btn("⬇ Image", () => {
      canvas.toBlob((blob) => blob && saveBlob(blob, `${fileBase(spec)}.png`), "image/png");
    }),
    btn("New version", () => {
      spec = { ...spec, seed: (spec.seed + 7919) >>> 0 };
      load().then(() => spec.video && playing && setPlaying(true));
    })
  );
  load();
  // Videos play on their own while they're on screen
  if (spec.video && "IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !playing) setPlaying(true);
        else if (!e.isIntersecting && playing) setPlaying(false);
      }
    }).observe(canvas);
  }
}

// The chat answer for a picture or video request.
export function visionAnswer(question, { allowVideo = true } = {}) {
  if (isBlockedPicture(question)) return "I can't create that kind of picture: Alpaca Vision doesn't make images of death, violence, weapons, injuries or adult content. Try something else, like a place, a festival, nature, people doing everyday things, or an idea you like.";
  const spec = planPicture(question);
  // Videos are made only for the admin; everyone else gets a still picture
  const videoBlocked = spec.video && !allowVideo;
  if (videoBlocked) spec.video = false;
  const what = spec.photo && spec.kind !== "card" ? subjectOfPicture(spec.prompt) || describePicture(spec) : describePicture(spec);
  const lines = [
    ...(videoBlocked ? ["Video creation is reserved for MK.ai's admin, so here's a picture instead.", ""] : []),
    `**Alpaca Vision** — ${spec.video ? "here's your video" : spec.photo ? "here's your photo" : "here's your picture"}: ${what}.`,
    "",
    "```alpaca-vision\n" + JSON.stringify(spec) + "\n```",
    "",
  ];
  if (spec.photo && spec.video) lines.push("I create several real AI photos of the scene and turn them into a short film with camera moves. It plays right here; tap **⬇ Video** to save it, or **New version** for different shots.");
  else if (spec.photo && spec.kind === "card") lines.push("A real photo background with your wishes on top. Tap **⬇ Image** to save or share it, or **New version** for a different photo.");
  else if (spec.photo) lines.push(`A real AI photo (it takes a few seconds). Tap **⬇ Image** to save it, or **New version** for a different take. Add details like the time of day, weather, style (cinematic, black and white, anime, oil painting)${allowVideo ? ' or "video"' : ""} to change it.`);
  else if (spec.video) lines.push("It plays right here. Tap **⬇ Video** to save it as a video file, **⬇ Image** for a still, or **New version** for a different take.");
  else lines.push("Tap **⬇ Image** to save it, or **New version** for a different take.");
  return lines.join("\n");
}
