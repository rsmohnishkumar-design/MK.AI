// NOVA's own inference engine: runs a NOVA language model (trained with
// nova-llm/train.py, exported with nova-llm/export_web.py) entirely in the
// browser, in plain JavaScript. No AI service and no outside runtime library.
// Transformer: RoPE positions, RMSNorm, SwiGLU, tied embeddings, with a key/value
// cache so each new token costs one pass over the weights.
import { NovaTokenizer } from "./tokenizer.js";

function halfToFloat(h) {
  const s = (h & 0x8000) >> 15, e = (h & 0x7c00) >> 10, f = h & 0x03ff;
  if (e === 0) return (s ? -1 : 1) * 2 ** -14 * (f / 1024);
  if (e === 31) return f ? NaN : (s ? -1 : 1) * Infinity;
  return (s ? -1 : 1) * 2 ** (e - 15) * (1 + f / 1024);
}
function decodeHalf(buffer, offset, count) {
  const u16 = new Uint16Array(buffer, offset, count);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = halfToFloat(u16[i]);
  return out;
}

// y = W x, W stored [out, in] row-major (PyTorch Linear)
function linear(W, x, out, inDim, outDim) {
  for (let o = 0; o < outDim; o++) {
    let s = 0;
    const row = o * inDim;
    for (let i = 0; i < inDim; i++) s += W[row + i] * x[i];
    out[o] = s;
  }
  return out;
}
function rmsnorm(x, w, out) {
  let ss = 0;
  for (let i = 0; i < x.length; i++) ss += x[i] * x[i];
  const r = 1 / Math.sqrt(ss / x.length + 1e-6);
  for (let i = 0; i < x.length; i++) out[i] = x[i] * r * w[i];
  return out;
}

export class NovaModel {
  constructor(meta, weights, tokenizer) {
    this.meta = meta;
    this.c = meta.config;
    this.tok = tokenizer;
    const t = {};
    for (const e of meta.tensors) t[e.name] = decodeHalf(weights, e.offset, e.bytes / 2);
    this.t = t;
    const { width: C, heads: H, layers: L, context } = this.c;
    this.C = C;
    this.H = H;
    this.D = C / H;
    this.L = L;
    this.context = context;
    this.hidden = t["blocks.0.ffn.gate.weight"].length / C;
    const half = this.D / 2;
    this.cos = new Float32Array(context * half);
    this.sin = new Float32Array(context * half);
    for (let p = 0; p < context; p++)
      for (let i = 0; i < half; i++) {
        const a = p / 10000 ** ((2 * i) / this.D);
        this.cos[p * half + i] = Math.cos(a);
        this.sin[p * half + i] = Math.sin(a);
      }
  }

  newCache() {
    return Array.from({ length: this.L }, () => ({ k: new Float32Array(this.context * this.C), v: new Float32Array(this.context * this.C) }));
  }

  rope(vec, pos) {
    const half = this.D / 2;
    for (let h = 0; h < this.H; h++) {
      const b = h * this.D;
      for (let i = 0; i < half; i++) {
        const c = this.cos[pos * half + i], s = this.sin[pos * half + i];
        const x1 = vec[b + 2 * i], x2 = vec[b + 2 * i + 1];
        vec[b + 2 * i] = x1 * c - x2 * s;
        vec[b + 2 * i + 1] = x1 * s + x2 * c;
      }
    }
  }

  // One token at position pos → logits over the vocabulary.
  step(token, pos, cache) {
    const { C, H, D, t } = this;
    const x = t["embed.weight"].slice(token * C, token * C + C);
    const n = new Float32Array(C), qkv = new Float32Array(3 * C), att = new Float32Array(C), o = new Float32Array(C);
    const g = new Float32Array(this.hidden), u = new Float32Array(this.hidden);
    const scores = new Float32Array(pos + 1);
    for (let l = 0; l < this.L; l++) {
      const p = `blocks.${l}.`;
      rmsnorm(x, t[p + "n1.weight"], n);
      linear(t[p + "attn.qkv.weight"], n, qkv, C, 3 * C);
      const q = qkv.subarray(0, C), k = qkv.subarray(C, 2 * C), v = qkv.subarray(2 * C);
      this.rope(q, pos);
      this.rope(k, pos);
      cache[l].k.set(k, pos * C);
      cache[l].v.set(v, pos * C);
      const scale = 1 / Math.sqrt(D);
      for (let h = 0; h < H; h++) {
        const b = h * D;
        let max = -Infinity;
        for (let j = 0; j <= pos; j++) {
          let s = 0;
          const kb = j * C + b;
          for (let i = 0; i < D; i++) s += q[b + i] * cache[l].k[kb + i];
          s *= scale;
          scores[j] = s;
          if (s > max) max = s;
        }
        let sum = 0;
        for (let j = 0; j <= pos; j++) sum += scores[j] = Math.exp(scores[j] - max);
        for (let i = 0; i < D; i++) att[b + i] = 0;
        for (let j = 0; j <= pos; j++) {
          const w = scores[j] / sum, vb = j * C + b;
          for (let i = 0; i < D; i++) att[b + i] += w * cache[l].v[vb + i];
        }
      }
      linear(t[p + "attn.out.weight"], att, o, C, C);
      for (let i = 0; i < C; i++) x[i] += o[i];
      rmsnorm(x, t[p + "n2.weight"], n);
      linear(t[p + "ffn.gate.weight"], n, g, C, this.hidden);
      linear(t[p + "ffn.up.weight"], n, u, C, this.hidden);
      for (let i = 0; i < this.hidden; i++) g[i] = (g[i] / (1 + Math.exp(-g[i]))) * u[i];
      linear(t[p + "ffn.down.weight"], g, o, this.hidden, C);
      for (let i = 0; i < C; i++) x[i] += o[i];
    }
    rmsnorm(x, t["norm.weight"], n);
    const V = this.tok.vocabSize;
    return linear(t["embed.weight"], n, new Float32Array(V), C, V);
  }

  // Logits for every position of a token list (used by tests to compare with PyTorch).
  forward(tokens) {
    const cache = this.newCache();
    return tokens.map((tk, i) => this.step(tk, i, cache));
  }

  async generate(prompt, { maxNew = 120, temperature = 0.7, topK = 40, repetitionPenalty = 1.15, onText = () => {}, signal = null, seed = null } = {}) {
    let ids = this.tok.encode(prompt);
    const room = this.context - 1;
    if (ids.length > room - 8) ids = ids.slice(-(room - Math.min(maxNew, room / 2)));
    const eos = this.tok.special["<|eos|>"];
    const banned = new Set(Object.values(this.tok.special).filter((id) => id !== eos));
    let rand = seed == null ? Math.random : mulberry(seed);
    const cache = this.newCache();
    let logits;
    for (let i = 0; i < ids.length; i++) logits = this.step(ids[i], i, cache);
    const out = [];
    for (let n = 0; n < maxNew && ids.length + out.length < this.context; n++) {
      if (signal?.aborted) break;
      for (const id of banned) logits[id] = -Infinity;
      for (const id of new Set(out.slice(-32))) logits[id] = logits[id] > 0 ? logits[id] / repetitionPenalty : logits[id] * repetitionPenalty;
      const next = sample(logits, temperature, topK, rand);
      if (next === eos) break;
      out.push(next);
      onText(this.tok.decode(out));
      logits = this.step(next, ids.length + out.length - 1, cache);
      if (n % 8 === 7) await new Promise((r) => setTimeout(r, 0)); // keep the page responsive
    }
    return this.tok.decode(out).trim();
  }
}

function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function sample(logits, temperature, topK, rand) {
  if (temperature <= 0.01) {
    let best = 0;
    for (let i = 1; i < logits.length; i++) if (logits[i] > logits[best]) best = i;
    return best;
  }
  const idx = Array.from(logits.keys()).sort((a, b) => logits[b] - logits[a]).slice(0, topK);
  const max = logits[idx[0]];
  const p = idx.map((i) => Math.exp((logits[i] - max) / temperature));
  const sum = p.reduce((a, b) => a + b, 0);
  let r = rand() * sum;
  for (let i = 0; i < idx.length; i++) if ((r -= p[i]) <= 0) return idx[i];
  return idx[idx.length - 1];
}

// Loads models/<name>/ (model.json, weights.bin, tokenizer.json).
const loaded = new Map();
export function loadNova(base = new URL("../../models/nova-mini/", import.meta.url).href, fetchFn = fetch) {
  if (!loaded.has(base)) {
    loaded.set(base, (async () => {
      const [meta, tokData, weights] = await Promise.all([
        fetchFn(base + "model.json").then((r) => { if (!r.ok) throw new Error("NOVA model not found"); return r.json(); }),
        fetchFn(base + "tokenizer.json").then((r) => r.json()),
        fetchFn(base + "weights.bin").then((r) => r.arrayBuffer()),
      ]);
      return new NovaModel(meta, weights, new NovaTokenizer(tokData));
    })().catch((e) => { loaded.delete(base); throw e; }));
  }
  return loaded.get(base);
}

// Chat format used in training: <|user|>question<|assistant|>answer<|eos|>
export async function novaChat(question, opts = {}) {
  const model = await loadNova(opts.base);
  return model.generate(`<|user|>${String(question).slice(0, 600)}<|assistant|>`, opts);
}
