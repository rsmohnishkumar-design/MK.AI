"""Writes PyTorch reference outputs for tests/nova_parity.test.mjs.
The weights are rounded to float16 first, exactly as export_web.py stores them.

    python make_reference.py --ckpt ckpt/final.pt --tokenizer data/tokenizer.json --out ref.json
"""
import argparse
import json

import torch

from model import Config, NovaLM
from tokenizer import Tokenizer

ap = argparse.ArgumentParser()
ap.add_argument("--ckpt", required=True)
ap.add_argument("--tokenizer", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--text", default="<|user|>What is photosynthesis?<|assistant|>")
a = ap.parse_args()
ck = torch.load(a.ckpt, map_location="cpu", weights_only=False)  # our own checkpoints
m = NovaLM(Config(**ck["config"]))
m.load_state_dict({k: v.to(torch.float16).to(torch.float32) for k, v in ck["model"].items()})
m.eval()
tok = Tokenizer.load(a.tokenizer)
ids = tok.encode(a.text)
with torch.no_grad():
    logits, _ = m(torch.tensor([ids]))
    out = m.generate(torch.tensor([ids]), max_new=12, temperature=1e-6, top_k=1, eos=tok.special["<|eos|>"])
greedy = out[0, len(ids):].tolist()
if tok.special["<|eos|>"] in greedy:
    greedy = greedy[: greedy.index(tok.special["<|eos|>"])]
json.dump({"text": a.text, "tokens": ids, "logits": logits[0].tolist(), "greedy_tokens": greedy}, open(a.out, "w"))
print("reference written:", len(ids), "tokens")
