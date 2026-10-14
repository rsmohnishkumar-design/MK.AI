// Photo editing. Everyday edits (brighter, black and white, crop, rotate,
// blur, sharpen, warmer…) are done instantly on the device. Changes that need
// imagination (remove an object, new background, cartoon style, add a hat) go
// to Alpaca's image model (Gemini) when it's available.

const LOCAL = [
  [/\b(auto ?(fix|enhance)|enhance|improve (the )?(photo|picture|image|quality)|better quality|fix (the )?(colou?rs|lighting))\b/i, "auto"],
  [/\b(brighter|brighten|lighter|lighten|more light|too dark)\b/i, "brighter"],
  [/\b(darker|darken|too bright)\b/i, "darker"],
  [/\b(less contrast|lower contrast|flatter)\b/i, "lesscontrast"],
  [/\b(more contrast|high contrast|contrast|punchier|pop)\b/i, "contrast"],
  [/\b(black and white|black & white|b&w|b\/w|gr[ae]y ?scale|monochrome)\b/i, "gray"],
  [/\b(sepia|vintage|old photo|retro)\b/i, "sepia"],
  [/\b(invert|negative)\b/i, "invert"],
  [/\b(more colou?rful|vivid|vibrant|saturat(e|ed|ion))\b/i, "vivid"],
  [/\b(less colou?rful|muted|desaturat\w*|faded)\b/i, "muted"],
  [/\b(warmer|warm tone|warm)\b/i, "warm"],
  [/\b(cooler|cool tone|colder|blue tone)\b/i, "cool"],
  [/\b(sharpen|sharper|crisp(er)?|less blurry)\b/i, "sharpen"],
  [/\b(blur|blurry|soften|soft focus)\b/i, "blur"],
  [/\b(rotate|turn) (it |this |the (photo|picture|image) )?(right|clockwise|90)\b/i, "rotright"],
  [/\b(rotate|turn) (it |this |the (photo|picture|image) )?(left|anti-?clockwise|counter-?clockwise)\b/i, "rotleft"],
  [/\b(upside down|rotate (it |this )?180)\b/i, "rot180"],
  [/\b(flip|mirror)\b(?!.*\b(vertical|upside)\b)/i, "fliph"],
  [/\bflip\b.*\bvertical\w*\b/i, "flipv"],
  [/\b(square|1:1|instagram post|profile (picture|photo|pic)|dp)\b/i, "square"],
  [/\b(16:9|widescreen|landscape|youtube thumbnail)\b/i, "wide"],
  [/\b(9:16|portrait|story|status|reel)\b/i, "tall"],
  [/\b(smaller|half (the )?size|compress|reduce (the )?size)\b/i, "smaller"],
];
const NAMES = {
  auto: "auto-enhanced", brighter: "brighter", darker: "darker", contrast: "more contrast", lesscontrast: "less contrast",
  gray: "black and white", sepia: "vintage sepia", invert: "inverted colours", vivid: "more vivid colours", muted: "softer colours",
  warm: "warmer tone", cool: "cooler tone", sharpen: "sharpened", blur: "blurred", rotright: "rotated right", rotleft: "rotated left",
  rot180: "turned upside down", fliph: "mirrored", flipv: "flipped vertically", square: "cropped square", wide: "cropped 16:9",
  tall: "cropped 9:16", smaller: "made smaller",
};
// Edits only an image model can do
const NEEDS_AI = /\b(remove|erase|delete|get rid of|add|put|insert|replace|swap|change (the )?(background|sky|colou?r of|hair|clothes|shirt|dress)|background|sky\b|turn (me|him|her|it|this|them|the \w+) into|make (me|him|her|them) look|cartoon|anime|ghibli|pixar|painting|sketch|drawing style|watercolou?r|oil paint|3d|style|wear|wearing|hat|glasses|sunglasses|beard|smile|object|person|people|watermark|text on|caption on|restore|colou?ri[sz]e|old photo restoration|upscale|higher resolution|expand|extend|outpaint)\b/i;
export const PHOTO_EDIT = new RegExp(`${NEEDS_AI.source}|\\b(edit|crop|rotate|flip|mirror|filter|brighter|brighten|darker|darken|contrast|black and white|grayscale|greyscale|sepia|vintage|blur|sharpen|enhance|improve|fix|warm|cool|saturat|vivid|resize|smaller|square|invert|make it|make this)\\b`, "i");

export function photoEdits(instruction) {
  const ops = [];
  for (const [re, op] of LOCAL) if (re.test(instruction) && !ops.includes(op)) ops.push(op);
  // "very", "a lot", "much" make colour changes stronger
  const strong = /\b(very|a lot|much|really|extra|super)\b/i.test(instruction);
  // "add more contrast" is an everyday edit, not an AI one
  const rest = instruction.replace(/\b(add|put|give( it)?)\s+(more|some|a bit of|a little( bit of)?|less)\s+(contrast|brightness|light|colou?rs?|warmth|blur|sharpness|saturation|vibrance)\b/gi, "");
  return { ops, strong, ai: NEEDS_AI.test(rest) };
}

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The photo couldn't be opened."));
    img.src = src;
  });

// The edits, applied to a canvas (pure pixel work: works in every browser)
export async function applyEdits(src, ops, strong = false) {
  const img = await loadImage(src);
  let canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d").drawImage(img, 0, 0);
  const k = strong ? 1.8 : 1;

  // Geometry first
  for (const op of ops) {
    const w = canvas.width;
    const h = canvas.height;
    let out = null;
    if (op === "rotright" || op === "rotleft" || op === "rot180") {
      const quarter = op !== "rot180";
      out = document.createElement("canvas");
      out.width = quarter ? h : w;
      out.height = quarter ? w : h;
      const g = out.getContext("2d");
      g.translate(out.width / 2, out.height / 2);
      g.rotate(op === "rotright" ? Math.PI / 2 : op === "rotleft" ? -Math.PI / 2 : Math.PI);
      g.drawImage(canvas, -w / 2, -h / 2);
    } else if (op === "fliph" || op === "flipv") {
      out = document.createElement("canvas");
      out.width = w;
      out.height = h;
      const g = out.getContext("2d");
      if (op === "fliph") g.setTransform(-1, 0, 0, 1, w, 0);
      else g.setTransform(1, 0, 0, -1, 0, h);
      g.drawImage(canvas, 0, 0);
    } else if (op === "square" || op === "wide" || op === "tall") {
      const ratio = op === "square" ? 1 : op === "wide" ? 16 / 9 : 9 / 16;
      let cw = w;
      let ch = Math.round(w / ratio);
      if (ch > h) {
        ch = h;
        cw = Math.round(h * ratio);
      }
      out = document.createElement("canvas");
      out.width = cw;
      out.height = ch;
      out.getContext("2d").drawImage(canvas, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, cw, ch);
    } else if (op === "smaller") {
      out = document.createElement("canvas");
      out.width = Math.max(1, Math.round(w / 2));
      out.height = Math.max(1, Math.round(h / 2));
      const g = out.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(canvas, 0, 0, out.width, out.height);
    } else if (op === "blur") {
      // Soft blur: shrink and enlarge again (smooth scaling blurs it evenly)
      const small = document.createElement("canvas");
      small.width = Math.max(1, Math.round(w / (6 * k)));
      small.height = Math.max(1, Math.round(h / (6 * k)));
      const sg = small.getContext("2d");
      sg.imageSmoothingQuality = "high";
      sg.drawImage(canvas, 0, 0, small.width, small.height);
      out = document.createElement("canvas");
      out.width = w;
      out.height = h;
      const g = out.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(small, 0, 0, w, h);
    }
    if (out) canvas = out;
  }

  // Colour, pixel by pixel
  const colour = ops.filter((o) => ["auto", "brighter", "darker", "contrast", "lesscontrast", "gray", "sepia", "invert", "vivid", "muted", "warm", "cool"].includes(o));
  const g = canvas.getContext("2d", { willReadFrequently: true });
  if (colour.length || ops.includes("sharpen")) {
    const data = g.getImageData(0, 0, canvas.width, canvas.height);
    const p = data.data;
    let bright = 0;
    let contrast = 1;
    let sat = 1;
    let warm = 0;
    if (colour.includes("auto")) {
      // Aim for a balanced exposure, a little more contrast and colour
      let sum = 0;
      for (let i = 0; i < p.length; i += 16) sum += 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
      const mean = sum / (p.length / 16);
      bright += Math.max(-40, Math.min(40, 128 - mean)) * 0.6;
      contrast *= 1.12;
      sat *= 1.15;
    }
    if (colour.includes("brighter")) bright += 30 * k;
    if (colour.includes("darker")) bright -= 30 * k;
    if (colour.includes("contrast")) contrast *= 1 + 0.25 * k;
    if (colour.includes("lesscontrast")) contrast *= 1 - 0.2 * k;
    if (colour.includes("vivid")) sat *= 1 + 0.35 * k;
    if (colour.includes("muted")) sat *= Math.max(0, 1 - 0.35 * k);
    if (colour.includes("warm")) warm += 14 * k;
    if (colour.includes("cool")) warm -= 14 * k;
    const gray = colour.includes("gray");
    const sepia = colour.includes("sepia");
    const invert = colour.includes("invert");
    const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
    for (let i = 0; i < p.length; i += 4) {
      let r = p[i];
      let gg = p[i + 1];
      let b = p[i + 2];
      r = (r - 128) * contrast + 128 + bright;
      gg = (gg - 128) * contrast + 128 + bright;
      b = (b - 128) * contrast + 128 + bright;
      const l = 0.299 * r + 0.587 * gg + 0.114 * b;
      r = l + (r - l) * sat;
      gg = l + (gg - l) * sat;
      b = l + (b - l) * sat;
      r += warm;
      b -= warm;
      if (gray) r = gg = b = 0.299 * r + 0.587 * gg + 0.114 * b;
      if (sepia) {
        const [sr, sg, sb] = [r * 0.393 + gg * 0.769 + b * 0.189, r * 0.349 + gg * 0.686 + b * 0.168, r * 0.272 + gg * 0.534 + b * 0.131];
        r = sr;
        gg = sg;
        b = sb;
      }
      if (invert) {
        r = 255 - r;
        gg = 255 - gg;
        b = 255 - b;
      }
      p[i] = clamp(r);
      p[i + 1] = clamp(gg);
      p[i + 2] = clamp(b);
    }
    if (ops.includes("sharpen")) sharpen(data, canvas.width, canvas.height, 0.6 * k);
    g.putImageData(data, 0, 0);
  }
  return canvas;
}

function sharpen(data, w, h, amount) {
  const src = new Uint8ClampedArray(data.data);
  const p = data.data;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v = src[i + c] * (1 + 4 * amount) - amount * (src[i - 4 + c] + src[i + 4 + c] + src[i - w * 4 + c] + src[i + w * 4 + c]);
        p[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
  }
}

// Alpaca's image model edits the photo itself, or null when unavailable
export async function aiEdit(photo, instruction) {
  try {
    const [{ geminiModelsMatching }, { geminiImage }] = await Promise.all([import("./ai.js"), import("./gemini-rest.js")]);
    const { key, models } = await geminiModelsMatching(/image/i, ["gemini-2.5-flash-image"]);
    if (!key) return null;
    return await geminiImage(
      key,
      models,
      `Edit this photo as the user asks: "${instruction}". Keep everything else the same: the people's faces and identity, the framing and the photo's quality. Return the edited photo only. Family-friendly.`,
      { mimeType: photo.mimeType || "image/jpeg", data: photo.data }
    );
  } catch (err) {
    console.warn("AI photo edit:", err);
    return null;
  }
}

// ---- The result in the chat ----
const results = new Map(); // id → { before, after, name }
let keepEditing = null;
export function setPhotoKeepEditing(fn) {
  keepEditing = fn;
}

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

// Edits the photo and returns the chat answer (with a "mkai-photo" block)
export async function editPhoto(photo, instruction, onStep = () => {}) {
  const { ops, strong, ai } = photoEdits(instruction);
  const before = `data:${photo.mimeType || "image/jpeg"};base64,${photo.data}`;
  let after = null;
  let how = "";
  let note = "";
  if (ai) {
    onStep("Alpaca is editing your photo");
    after = await aiEdit(photo, instruction);
    if (after) how = "Edited by Alpaca's image model";
    else note = "The AI photo editor isn't available right now, so changes like removing or adding things, a new background or a new style couldn't be made.";
  }
  // Without the AI, "blur the background" mustn't blur the whole photo
  if (!after && ops.length && !(ai && /\b(background|sky|behind)\b/i.test(instruction))) {
    onStep(`Editing on your device: ${ops.map((o) => NAMES[o]).join(", ")}`);
    const canvas = await applyEdits(before, ops, strong);
    after = canvas.toDataURL("image/jpeg", 0.92);
    how = `Edited on your device: ${ops.map((o) => NAMES[o]).join(", ")}`;
  }
  if (!after) {
    return {
      answer:
        (note ? `${note}\n\n` : "") +
        "I can edit this photo for you. Try:\n- **brighter**, **darker**, **more contrast**, **auto-enhance**\n- **black and white**, **vintage**, **warmer**, **cooler**, **more vivid**\n- **crop square**, **crop 16:9**, **rotate right**, **flip**, **make it smaller**\n- **blur** or **sharpen**\n- with the AI editor: **remove the background**, **remove the person on the left**, **make it a cartoon**, **change the sky to a sunset**",
      edited: false,
    };
  }
  const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  results.set(id, { before, after, name: photo.name || "photo" });
  return {
    answer: `Here's your edited photo.${note ? `\n\n${note}` : ""}\n\n\`\`\`mkai-photo\n${JSON.stringify({ id, how, name: photo.name || "photo" })}\n\`\`\``,
    edited: true,
  };
}

export function renderPhotoBlock(container, text) {
  let info = {};
  try {
    info = JSON.parse(text);
  } catch {}
  const r = results.get(info.id);
  const box = el("div", "photo-edit");
  if (!r) {
    box.append(el("p", "photo-note", "This edited photo was shown earlier in this session. Edited photos aren't kept after the page reloads, so download them right after editing."));
    container.append(box);
    return;
  }
  const img = el("img", "photo-img");
  img.src = r.after;
  img.alt = `Edited ${r.name}`;
  const bar = el("div", "photo-bar");
  const mk = (label, fn, cls = "photo-btn") => {
    const b = el("button", cls, label);
    b.type = "button";
    b.addEventListener("click", fn);
    bar.append(b);
    return b;
  };
  const toggle = mk("Show original", () => {
    const showingAfter = img.src === r.after;
    img.src = showingAfter ? r.before : r.after;
    toggle.textContent = showingAfter ? "Show edited" : "Show original";
    img.alt = showingAfter ? `Original ${r.name}` : `Edited ${r.name}`;
  });
  mk("⬇ Download", () => {
    const a = el("a");
    a.href = r.after;
    a.download = `${r.name.replace(/\.[^.]+$/, "")}-edited.${r.after.startsWith("data:image/png") ? "png" : "jpg"}`;
    document.body.append(a);
    a.click();
    a.remove();
  });
  if (keepEditing) {
    mk("Keep editing", async () => {
      const blob = await (await fetch(r.after)).blob();
      keepEditing(new File([blob], `${r.name.replace(/\.[^.]+$/, "")}-edited.${blob.type.includes("png") ? "png" : "jpg"}`, { type: blob.type }));
    });
  }
  box.append(img, bar);
  if (info.how) box.append(el("p", "photo-note", info.how));
  container.append(box);
}
