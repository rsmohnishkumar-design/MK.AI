// Checks that NOVA's browser engine (js/nova/llm.js) computes the same thing as the
// PyTorch model (nova-llm/model.py) for the same weights: real numbers, not mocks.
//   node tests/nova_parity.test.mjs <models dir> <reference.json>
// reference.json comes from nova-llm/make_reference.py (tokens + PyTorch logits).
import { readFileSync } from "node:fs";
import { NovaModel } from "../js/nova/llm.js";
import { NovaTokenizer } from "../js/nova/tokenizer.js";

const [dir, refPath] = process.argv.slice(2);
const meta = JSON.parse(readFileSync(`${dir}/model.json`, "utf8"));
const tok = new NovaTokenizer(JSON.parse(readFileSync(`${dir}/tokenizer.json`, "utf8")));
const buf = readFileSync(`${dir}/weights.bin`);
const model = new NovaModel(meta, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), tok);
const ref = JSON.parse(readFileSync(refPath, "utf8"));
let pass = 0, total = 0;
const check = (name, ok, info = "") => { total++; if (ok) pass++; console.log(ok ? "PASS" : "FAIL", name, info); };

check("JS tokenizer gives the same tokens as Python", JSON.stringify(tok.encode(ref.text)) === JSON.stringify(ref.tokens));
const t0 = Date.now();
const logits = model.forward(ref.tokens);
const ms = (Date.now() - t0) / ref.tokens.length;
let maxDiff = 0, argmaxSame = 0;
for (let p = 0; p < ref.tokens.length; p++) {
  const a = logits[p], b = ref.logits[p];
  let am = 0, bm = 0;
  for (let i = 0; i < a.length; i++) {
    maxDiff = Math.max(maxDiff, Math.abs(a[i] - b[i]));
    if (a[i] > a[am]) am = i;
    if (b[i] > b[bm]) bm = i;
  }
  argmaxSame += am === bm;
}
check("logits match PyTorch (max difference < 2e-3)", maxDiff < 2e-3, `max diff ${maxDiff.toExponential(2)}`);
check("same top prediction at every position", argmaxSame === ref.tokens.length, `${argmaxSame}/${ref.tokens.length}`);
const greedy = await model.generate(ref.text, { maxNew: ref.greedy_tokens.length, temperature: 0, repetitionPenalty: 1 });
check("greedy generation matches PyTorch", greedy === tok.decode(ref.greedy_tokens).trim(), JSON.stringify(greedy.slice(0, 60)));
console.log(`speed: ${ms.toFixed(1)} ms per token (no cache warm-up)\n${pass}/${total} passed`);
process.exit(pass === total ? 0 : 1);
