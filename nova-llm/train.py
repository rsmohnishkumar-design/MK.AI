"""Pretrain NOVA LLM on our own token file. Meant for a free Kaggle/Colab GPU.

    python tokenizer.py train data/corpus.txt tokenizer.json 16000
    python train.py --data data/corpus.txt --tokenizer tokenizer.json --out ckpt

Saves a checkpoint every --save-every steps so a notebook reset loses little.
Training compute ≈ 6 × parameters × tokens (see README.md for the budget).
"""
import argparse
import math
import os
import time

import torch

from model import Config, NovaLM
from tokenizer import Tokenizer


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--tokenizer", required=True)
    ap.add_argument("--out", default="ckpt")
    ap.add_argument("--steps", type=int, default=20000)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--lr", type=float, default=6e-4)
    ap.add_argument("--save-every", type=int, default=1000)
    ap.add_argument("--small", action="store_true", help="tiny model for a CPU smoke test")
    a = ap.parse_args()

    tok = Tokenizer.load(a.tokenizer)
    cache = a.data + ".ids.pt"
    if os.path.exists(cache):
        ids = torch.load(cache)
    else:
        ids = torch.tensor(tok.encode(open(a.data, encoding="utf-8").read()), dtype=torch.long)
        torch.save(ids, cache)
    split = int(len(ids) * 0.98)
    train, val = ids[:split], ids[split:]
    cfg = Config(vocab_size=tok.vocab_size, layers=2, width=128, heads=4, context=128) if a.small else Config(vocab_size=tok.vocab_size)
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    model = NovaLM(cfg).to(dev)
    print(f"parameters: {model.params() / 1e6:.1f}M  tokens: {len(ids) / 1e6:.1f}M  device: {dev}")
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr, betas=(0.9, 0.95), weight_decay=0.1)
    os.makedirs(a.out, exist_ok=True)
    start = 0
    last = os.path.join(a.out, "last.pt")
    if os.path.exists(last):
        s = torch.load(last, map_location=dev)
        model.load_state_dict(s["model"])
        opt.load_state_dict(s["opt"])
        start = s["step"]
        print("resumed at step", start)
    use_amp = dev == "cuda"
    scaler = torch.amp.GradScaler(enabled=use_amp)

    def batch(src):
        i = torch.randint(len(src) - cfg.context - 1, (a.batch,))
        x = torch.stack([src[j : j + cfg.context] for j in i])
        y = torch.stack([src[j + 1 : j + 1 + cfg.context] for j in i])
        return x.to(dev), y.to(dev)

    def lr_at(step, warm=500):
        if step < warm:
            return a.lr * step / warm
        p = (step - warm) / max(1, a.steps - warm)
        return a.lr * (0.1 + 0.9 * 0.5 * (1 + math.cos(math.pi * min(1, p))))

    t0 = time.time()
    for step in range(start, a.steps):
        for g in opt.param_groups:
            g["lr"] = lr_at(step)
        x, y = batch(train)
        with torch.autocast(dev, dtype=torch.float16, enabled=use_amp):
            _, loss = model(x, y)
        opt.zero_grad(set_to_none=True)
        scaler.scale(loss).backward()
        scaler.unscale_(opt)
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        scaler.step(opt)
        scaler.update()
        if step % 100 == 0:
            print(f"step {step} loss {loss.item():.3f} {time.time() - t0:.0f}s")
        if step and step % a.save_every == 0:
            model.eval()
            with torch.no_grad():
                vl = sum(model(*batch(val))[1].item() for _ in range(20)) / 20
            model.train()
            print(f"val loss {vl:.3f}  perplexity {math.exp(vl):.1f}")
            torch.save({"model": model.state_dict(), "opt": opt.state_dict(), "step": step, "config": cfg.__dict__}, last)
    torch.save({"model": model.state_dict(), "step": a.steps, "config": cfg.__dict__}, os.path.join(a.out, "final.pt"))


if __name__ == "__main__":
    main()
