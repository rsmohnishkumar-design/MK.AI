// NOVA tokenizer for the browser: the same byte-level BPE as nova-llm/tokenizer.py
// (same pre-splitting rules, same merges file), so the model sees the same tokens.
const PRETOKEN = /\s?[\p{L}\p{Nl}\p{No}]+|\s?\p{Nd}{1,3}|\s?[^\s\p{L}\p{N}_]+|\s+|_+|[\s\S]/gu;
const enc = new TextEncoder();
const dec = new TextDecoder();

export class NovaTokenizer {
  constructor(data) {
    this.merges = data.merges; // [a, b, newId]
    this.rank = new Map(this.merges.map(([a, b, n]) => [a * 65536 + b, n]));
    this.vocab = [];
    for (let i = 0; i < 256; i++) this.vocab[i] = Uint8Array.of(i);
    for (const [a, b, n] of this.merges) {
      const x = this.vocab[a], y = this.vocab[b], z = new Uint8Array(x.length + y.length);
      z.set(x);
      z.set(y, x.length);
      this.vocab[n] = z;
    }
    const base = 256 + this.merges.length;
    this.special = Object.fromEntries(data.special.map((s, i) => [s, base + i]));
    this.inverseSpecial = Object.fromEntries(Object.entries(this.special).map(([k, v]) => [v, k]));
    this.vocabSize = base + data.special.length;
    this.cache = new Map();
  }
  encodeChunk(bytes) {
    let ids = Array.from(bytes);
    while (ids.length > 1) {
      let best = Infinity, at = -1;
      for (let i = 0; i < ids.length - 1; i++) {
        const r = this.rank.get(ids[i] * 65536 + ids[i + 1]);
        if (r !== undefined && r < best) { best = r; at = i; }
      }
      if (at < 0) break;
      ids.splice(at, 2, best);
    }
    return ids;
  }
  encode(text) {
    const out = [];
    const names = Object.keys(this.special).map((s) => s.replace(/[|]/g, "\\|"));
    for (const part of String(text).split(new RegExp(`(${names.join("|")})`))) {
      if (!part) continue;
      if (part in this.special) { out.push(this.special[part]); continue; }
      for (const m of part.match(PRETOKEN) || []) {
        let ids = this.cache.get(m);
        if (!ids) {
          ids = this.encodeChunk(enc.encode(m));
          if (this.cache.size < 50000) this.cache.set(m, ids);
        }
        out.push(...ids);
      }
    }
    return out;
  }
  decode(ids) {
    let text = "", buf = [];
    const flush = () => { if (buf.length) { text += dec.decode(Uint8Array.from(buf)); buf = []; } };
    for (const id of ids) {
      if (id in this.inverseSpecial) { flush(); text += this.inverseSpecial[id]; }
      else buf.push(...(this.vocab[id] || []));
    }
    flush();
    return text;
  }
}
