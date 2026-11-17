"""Splits data/heldout.txt into a validation set (for checkpoint selection and tuning)
and a final test set (used ONLY for the final before/after comparison), by distinct
answer, with each example's topic. data/corpus.txt (training) is not touched, so the
step-450 model and new models train on identical data.

    python split_heldout.py  ->  data/val.txt, data/test.txt, data/val.jsonl, data/test.jsonl
"""
import hashlib
import json
import os
import random
import re

from prepare_data import kb_pairs, kural_pairs

HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, "data")
held = open(os.path.join(D, "heldout.txt"), encoding="utf-8").read()
pairs = re.findall(r"<\|user\|>(.*?)<\|assistant\|>(.*?)<\|eos\|>", held, re.S)
topic = {}
for q, a, src in kb_pairs() + kural_pairs():
    topic.setdefault(a, os.path.basename(src).replace(".json", "").replace(".js", ""))
groups = {}
for q, a in pairs:
    groups.setdefault(a, []).append(q)
answers = sorted(groups)
random.Random(2026).shuffle(answers)
half = len(answers) // 2
sets = {"val": answers[:half], "test": answers[half:]}
train_answers = set(re.findall(r"<\|assistant\|>(.*?)<\|eos\|>", open(os.path.join(D, "corpus.txt"), encoding="utf-8").read(), re.S))
info = {}
for name, ans in sets.items():
    assert not (set(ans) & train_answers), "leak: answer also in training"
    rows = [{"question": q, "answer": a, "topic": topic.get(a, "unknown")} for a in ans for q in groups[a]]
    text = "\n".join(f"<|user|>{r['question']}<|assistant|>{r['answer']}<|eos|>" for r in rows) + "\n"
    open(os.path.join(D, f"{name}.txt"), "w", encoding="utf-8").write(text)
    with open(os.path.join(D, f"{name}.jsonl"), "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    info[name] = {"examples": len(rows), "distinct_answers": len(ans), "sha256": hashlib.sha256(text.encode()).hexdigest()}
assert not (set(sets["val"]) & set(sets["test"]))
m = json.load(open(os.path.join(D, "MANIFEST.json")))
m["final_split"] = {**info, "rule": "heldout.txt split by distinct answer (seed 2026); val = checkpoint selection and tuning; test = final comparison only; no answer is shared between train, val and test"}
json.dump(m, open(os.path.join(D, "MANIFEST.json"), "w"), indent=2)
print(json.dumps(info, indent=2))
