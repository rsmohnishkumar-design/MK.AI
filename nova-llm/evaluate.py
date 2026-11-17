"""Measures a trained NOVA checkpoint honestly on held-out text it never trained on.

    python evaluate.py --ckpt ckpt/final.pt --tokenizer data/tokenizer.json --data data/corpus.txt

Reports:
- perplexity on the held-out 2% (same split as train.py), next to a unigram baseline
  (a "model" that only knows how common each token is) so the number means something;
- answers to held-out questions, with word-overlap F1 against the reference answer.
Nothing here is compared with ChatGPT: a model this size is not in that class.
"""
import argparse
import json
import math
import re
from collections import Counter

import torch

from model import Config, NovaLM
from tokenizer import Tokenizer


def words(s):
    return re.findall(r"[\w']+", s.lower())


def f1(pred, ref):
    p, r = Counter(words(pred)), Counter(words(ref))
    common = sum((p & r).values())
    if not common:
        return 0.0
    prec, rec = common / sum(p.values()), common / sum(r.values())
    return 2 * prec * rec / (prec + rec)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", required=True)
    ap.add_argument("--tokenizer", required=True)
    ap.add_argument("--data", required=True, help="training text (for the unigram baseline)")
    ap.add_argument("--heldout", required=True, help="held-out text the model never trained on")
    ap.add_argument("--questions", type=int, default=25)
    ap.add_argument("--out")
    a = ap.parse_args()
    tok = Tokenizer.load(a.tokenizer)
    ck = torch.load(a.ckpt, map_location="cpu")
    cfg = Config(**ck["config"])
    model = NovaLM(cfg)
    model.load_state_dict(ck["model"])
    model.eval()

    train_ids = torch.load(a.data + ".ids.pt")
    heldout_text = open(a.heldout, encoding="utf-8").read()
    val_ids = torch.tensor(tok.encode(heldout_text), dtype=torch.long)

    # perplexity over the whole held-out stream, in context-sized windows
    nll, n = 0.0, 0
    with torch.no_grad():
        for i in range(0, len(val_ids) - 1, cfg.context):
            x = val_ids[i : i + cfg.context].unsqueeze(0)
            y = val_ids[i + 1 : i + 1 + cfg.context].unsqueeze(0)
            x = x[:, : y.shape[1]]
            if y.numel() == 0:
                break
            _, loss = model(x, y)
            nll += loss.item() * y.numel()
            n += y.numel()
    ppl = math.exp(nll / n)
    counts = Counter(train_ids.tolist())
    total = sum(counts.values())
    V = tok.vocab_size
    uni = sum(-math.log((counts.get(t, 0) + 1) / (total + V)) for t in val_ids.tolist()) / len(val_ids)
    uni_ppl = math.exp(uni)

    # held-out questions (answers never seen in training); one per distinct answer
    seen, pairs = set(), []
    for q, ref in re.findall(r"<\|user\|>(.*?)<\|assistant\|>(.*?)<\|eos\|>", heldout_text, re.S):
        if ref not in seen:
            seen.add(ref)
            pairs.append((q, ref))
    pairs = pairs[: a.questions]
    results = []
    eos = tok.special["<|eos|>"]
    for q, ref in pairs:
        prompt = torch.tensor([tok.encode(f"<|user|>{q}<|assistant|>")])
        out = model.generate(prompt, max_new=80, temperature=0.01, top_k=1, eos=eos)
        ans = tok.decode(out[0, prompt.shape[1] :].tolist()).replace("<|eos|>", "").strip()
        results.append({"question": q.strip(), "reference": ref.strip()[:300], "nova": ans[:300], "f1": round(f1(ans, ref), 3)})
    mean_f1 = sum(r["f1"] for r in results) / max(1, len(results))
    report = {
        "parameters": model.params(),
        "config": ck["config"],
        "train_tokens": len(train_ids),
        "heldout_tokens": len(val_ids),
        "heldout_perplexity": round(ppl, 2),
        "unigram_baseline_perplexity": round(uni_ppl, 2),
        "heldout_questions": len(results),
        "mean_word_f1": round(mean_f1, 3),
        "samples": results[:8],
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    if a.out:
        json.dump(report, open(a.out, "w", encoding="utf-8"), indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
