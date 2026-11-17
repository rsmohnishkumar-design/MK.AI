"""Evaluates NOVA Mini checkpoints under identical conditions.

    python evaluate2.py --ckpt name=path [--ckpt name2=path2 ...] [--split test] --out report.json

For each checkpoint:
- perplexity on a fixed training probe, on val.txt and on the chosen split (default test.txt);
  the train-vs-held-out gap shows memorisation;
- generation on one question per distinct held-out answer, with two decoders:
    greedy  (plain argmax), and
    guarded (repetition penalty 1.15 + no repeated 3-grams), the decoder the app uses;
  measured by word-F1 against the reference, repeated-trigram rate, distinct-2,
  how often the answer ends properly (<|eos|>), mean length; plus F1 by topic.
The test split must only be used for final comparisons, never for tuning.
"""
import argparse
import json
import math
import re
from collections import Counter, defaultdict

import torch

from model import Config, NovaLM
from tokenizer import Tokenizer
from train2 import eval_loss, windows


def words(s):
    return re.findall(r"[\w']+", s.lower())


def f1(pred, ref):
    p, r = Counter(words(pred)), Counter(words(ref))
    c = sum((p & r).values())
    if not c:
        return 0.0
    pr, rc = c / sum(p.values()), c / sum(r.values())
    return 2 * pr * rc / (pr + rc)


def rep3(text):
    w = words(text)
    tri = [tuple(w[i : i + 3]) for i in range(len(w) - 2)]
    return 0.0 if not tri else 1 - len(set(tri)) / len(tri)


def distinct2(text):
    w = words(text)
    bi = [tuple(w[i : i + 2]) for i in range(len(w) - 1)]
    return 1.0 if not bi else len(set(bi)) / len(bi)


@torch.no_grad()
def decode(model, prompt_ids, eos, max_new=100, guarded=False, banned=()):
    ids = list(prompt_ids)
    out = []
    for _ in range(max_new):
        logits, _ = model(torch.tensor([ids[-model.c.context :]]))
        lg = logits[0, -1].clone()
        for b in banned:
            lg[b] = -float("inf")
        if guarded:
            for t in set(out[-32:]):
                lg[t] = lg[t] / 1.15 if lg[t] > 0 else lg[t] * 1.15
            if len(out) >= 2:
                prev = tuple(out[-2:])
                for i in range(len(out) - 2):
                    if tuple(out[i : i + 2]) == prev:
                        lg[out[i + 2]] = -float("inf")
        nxt = int(lg.argmax())
        if nxt == eos:
            return out, True
        out.append(nxt)
        ids.append(nxt)
    return out, False


def load(path):
    ck = torch.load(path, map_location="cpu")
    m = NovaLM(Config(**ck["config"]))
    m.load_state_dict(ck["model"])
    m.eval()
    return m, ck


def evaluate(path, tok, split, train_ids, max_questions):
    model, ck = load(path)
    ctx = model.c.context
    g = torch.Generator().manual_seed(99)
    starts = torch.randint(0, len(train_ids) - 257, (60,), generator=g).tolist()
    probe = [(train_ids[s : s + min(ctx, 256)], train_ids[s + 1 : s + 1 + min(ctx, 256)]) for s in starts]
    val_ids = torch.tensor(tok.encode(open("data/val.txt", encoding="utf-8").read()))
    sp_text = open(f"data/{split}.txt", encoding="utf-8").read()
    sp_ids = torch.tensor(tok.encode(sp_text))
    res = {
        "params": model.params(),
        "config": ck["config"],
        "selected_step": ck.get("step"),
        "train_probe_ppl": round(math.exp(eval_loss(model, probe)), 2),
        "val_ppl": round(math.exp(eval_loss(model, windows(val_ids, ctx))), 2),
        f"{split}_ppl": round(math.exp(eval_loss(model, windows(sp_ids, ctx))), 2),
    }
    rows = [json.loads(l) for l in open(f"data/{split}.jsonl", encoding="utf-8")]
    seen, qs = set(), []
    for r in rows:
        if r["answer"] not in seen:
            seen.add(r["answer"])
            qs.append(r)
    qs = qs[:max_questions]
    eos = tok.special["<|eos|>"]
    banned = [v for k, v in tok.special.items() if k != "<|eos|>"]
    for mode in ("greedy", "guarded"):
        f1s, reps, d2s, ends, lens, by_topic, samples = [], [], [], 0, [], defaultdict(list), []
        for r in qs:
            p = tok.encode(f"<|user|>{r['question']}<|assistant|>")
            out, ended = decode(model, p, eos, guarded=(mode == "guarded"), banned=banned)
            text = tok.decode(out).strip()
            s = f1(text, r["answer"])
            f1s.append(s)
            reps.append(rep3(text))
            d2s.append(distinct2(text))
            ends += ended
            lens.append(len(words(text)))
            by_topic[r["topic"]].append(s)
            if len(samples) < 6:
                samples.append({"q": r["question"], "ref": r["answer"][:160], "nova": text[:220], "f1": round(s, 3)})
        n = len(qs)
        res[mode] = {
            "questions": n,
            "word_f1": round(sum(f1s) / n, 3),
            "repeated_trigram_rate": round(sum(reps) / n, 3),
            "distinct_2": round(sum(d2s) / n, 3),
            "ended_properly": round(ends / n, 3),
            "mean_words": round(sum(lens) / n, 1),
            "f1_by_topic": {k: round(sum(v) / len(v), 3) for k, v in sorted(by_topic.items()) if len(v) >= 3},
            "samples": samples,
        }
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", action="append", required=True, help="name=path")
    ap.add_argument("--split", default="test", choices=["val", "test"])
    ap.add_argument("--questions", type=int, default=68)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    torch.manual_seed(0)
    tok = Tokenizer.load("data/tokenizer.json")
    train_ids = torch.load("data/corpus.txt.ids.pt")
    report = {"split": a.split, "conditions": "identical data, tokenizer, prompts and decoders for every checkpoint"}
    for spec in a.ckpt:
        name, path = spec.split("=", 1)
        report[name] = evaluate(path, tok, a.split, train_ids, a.questions)
        print(name, json.dumps({k: v for k, v in report[name].items() if k not in ("greedy", "guarded")}), flush=True)
        for mode in ("greedy", "guarded"):
            print("  ", mode, json.dumps({k: v for k, v in report[name][mode].items() if k not in ("samples", "f1_by_topic")}), flush=True)
    json.dump(report, open(a.out, "w", encoding="utf-8"), indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
