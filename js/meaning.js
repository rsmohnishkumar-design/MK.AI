// Neural memory: a small sentence-embedding model (all-MiniLM-L6-v2, about
// 23 MB, run on the device with Transformers.js) turns questions into
// "meaning vectors", so "how tall is Everest?" can find a saved answer to
// "height of Mount Everest". It loads quietly in the background; until it's
// ready (or on devices that can't run it) memory falls back to word matching.

const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0";
const MODEL = "Xenova/all-MiniLM-L6-v2";

let embedder = null;
let loading = null;
const vectors = new Map(); // text → vector, so each question is embedded once

export const meaningReady = () => !!embedder;

// Tests can swap in a fake through window.MKAI_EMBED(texts) → number[][].
export function startMeaning() {
  if (embedder || loading) return loading;
  if (window.MKAI_EMBED) {
    embedder = window.MKAI_EMBED;
    return Promise.resolve();
  }
  // Respect "data saver" on phones.
  if (navigator.connection?.saveData) return null;
  loading = (async () => {
    try {
      const { pipeline } = await import(TRANSFORMERS_URL);
      const extractor = await pipeline("feature-extraction", MODEL, { dtype: "q8" });
      embedder = async (texts) => (await extractor(texts, { pooling: "mean", normalize: true })).tolist();
    } catch (err) {
      console.warn("Neural memory isn't available on this device:", err);
    } finally {
      loading = null;
    }
  })();
  return loading;
}

// Meaning vectors for these texts, or null while the model isn't ready.
export async function embed(texts) {
  if (!embedder) return null;
  const missing = [...new Set(texts.filter((t) => !vectors.has(t)))];
  if (missing.length) {
    const out = await embedder(missing);
    missing.forEach((t, i) => vectors.set(t, out[i]));
    if (vectors.size > 2000) vectors.clear();
  }
  return texts.map((t) => vectors.get(t));
}

// Vectors are normalized, so the dot product is the cosine similarity (-1..1).
export function closeness(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}
