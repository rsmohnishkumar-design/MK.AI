"""NOVA Mini training, version 2 (train.py is kept unchanged for the step-450 model).

Changes, each from the audit:
- Validation is a full, deterministic pass over data/val.txt (was 20 random batches).
- Short warm-up then cosine decay to a floor, sized to the run (the step-450 model's
  best point fell inside a 500-step warm-up).
- Early stopping on validation loss with patience; the best checkpoint is saved on its
  own and never overwritten by a worse one.
- Weight decay only on weight matrices (not on norms).
- Optional residual/embedding dropout for this tiny-data regime (model.Config.resid_dropout).
- Train-subset loss logged next to validation loss to show the generalisation gap.
- Full reproducibility record: seed, args, data hashes, git commit, library versions.
The final test set (data/test.txt) is never read here.

    python train2.py --run r1 --layers 4 --width 256 --heads 4 --resid-dropout 0.2
"""
import argparse
import hashlib
import json
import math
import os
import random
import subprocess
import time

import torch

from model import Config, NovaLM
from tokenizer import Tokenizer

HERE = os.path.dirname(os.path.abspath(__file__))


def sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def windows(ids, ctx):
    """Non-overlapping (x, y) windows covering every token once: deterministic evaluation."""
    out = []
    for i in range(0, len(ids) - 1, ctx):
        y = ids[i + 1 : i + 1 + ctx]
        out.append((ids[i : i + len(y)], y))
    return out


@torch.no_grad()
def eval_loss(model, wins, bs=16):
    model.eval()
    total, n = 0.0, 0
    for k in range(0, len(wins), bs):
        group = wins[k : k + bs]
        L = max(len(x) for x, _ in group)
        X = torch.zeros(len(group), L, dtype=torch.long)
        Y = torch.full((len(group), L), -1, dtype=torch.long)
        for j, (x, y) in enumerate(group):
            X[j, : len(x)] = x
            Y[j, : len(y)] = y
        _, loss = model(X, Y)
        cnt = (Y != -1).sum().item()
        total += loss.item() * cnt
        n += cnt
    model.train()
    return total / n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True, help="run name; output goes to --root/<run>")
    ap.add_argument("--root", default=os.path.join(HERE, "runs"))
    ap.add_argument("--data", default=os.path.join(HERE, "data/corpus.txt"))
    ap.add_argument("--val", default=os.path.join(HERE, "data/val.txt"))
    ap.add_argument("--tokenizer", default=os.path.join(HERE, "data/tokenizer.json"))
    ap.add_argument("--layers", type=int, default=4)
    ap.add_argument("--width", type=int, default=256)
    ap.add_argument("--heads", type=int, default=4)
    ap.add_argument("--context", type=int, default=256)
    ap.add_argument("--dropout", type=float, default=0.1)
    ap.add_argument("--resid-dropout", type=float, default=0.0)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--min-lr-ratio", type=float, default=0.1)
    ap.add_argument("--warmup", type=int, default=100)
    ap.add_argument("--max-steps", type=int, default=1500)
    ap.add_argument("--batch", type=int, default=24)
    ap.add_argument("--weight-decay", type=float, default=0.1)
    ap.add_argument("--clip", type=float, default=1.0)
    ap.add_argument("--eval-every", type=int, default=75)
    ap.add_argument("--patience", type=int, default=4)
    ap.add_argument("--seed", type=int, default=1337)
    a = ap.parse_args()

    out = os.path.join(a.root, a.run)
    os.makedirs(out, exist_ok=True)
    random.seed(a.seed)
    torch.manual_seed(a.seed)
    torch.set_num_threads(os.cpu_count() or 4)
    tok = Tokenizer.load(a.tokenizer)
    cache = a.data + ".ids.pt"
    if os.path.exists(cache):
        train = torch.load(cache)
    else:
        train = torch.tensor(tok.encode(open(a.data, encoding="utf-8").read()), dtype=torch.long)
        torch.save(train, cache)
    val = torch.tensor(tok.encode(open(a.val, encoding="utf-8").read()), dtype=torch.long)
    cfg = Config(vocab_size=tok.vocab_size, layers=a.layers, width=a.width, heads=a.heads, context=a.context, dropout=a.dropout, resid_dropout=a.resid_dropout)
    model = NovaLM(cfg)
    val_w = windows(val, cfg.context)
    g = torch.Generator().manual_seed(a.seed + 1)
    starts = torch.randint(0, len(train) - cfg.context - 1, (40,), generator=g)
    train_probe = [(train[s : s + cfg.context], train[s + 1 : s + 1 + cfg.context]) for s in starts.tolist()]

    decay = [p for n, p in model.named_parameters() if p.dim() >= 2]
    no_decay = [p for n, p in model.named_parameters() if p.dim() < 2]
    opt = torch.optim.AdamW([{"params": decay, "weight_decay": a.weight_decay}, {"params": no_decay, "weight_decay": 0.0}], lr=a.lr, betas=(0.9, 0.95))

    def lr_at(step):
        if step < a.warmup:
            return a.lr * (step + 1) / a.warmup
        p = min(1.0, (step - a.warmup) / max(1, a.max_steps - a.warmup))
        return a.lr * (a.min_lr_ratio + (1 - a.min_lr_ratio) * 0.5 * (1 + math.cos(math.pi * p)))

    record = {
        "run": a.run,
        "args": vars(a),
        "config": cfg.__dict__,
        "parameters": model.params(),
        "train_tokens": len(train),
        "val_tokens": len(val),
        "data_sha256": {"train": sha(a.data), "val": sha(a.val), "tokenizer": sha(a.tokenizer)},
        "git_commit": subprocess.run(["git", "rev-parse", "HEAD"], cwd=HERE, capture_output=True, text=True).stdout.strip(),
        "torch": torch.__version__,
        "note": "data/test.txt is not used by training or selection",
    }
    json.dump(record, open(os.path.join(out, "run.json"), "w"), indent=2)
    log = open(os.path.join(out, "log.jsonl"), "w")
    print(f"[{a.run}] params {model.params() / 1e6:.2f}M  train tokens {len(train)}  val tokens {len(val)}", flush=True)

    best, best_step, bad, ema, t0 = float("inf"), -1, 0, None, time.time()
    for step in range(a.max_steps):
        for gr in opt.param_groups:
            gr["lr"] = lr_at(step)
        i = torch.randint(0, len(train) - cfg.context - 1, (a.batch,))
        x = torch.stack([train[j : j + cfg.context] for j in i])
        y = torch.stack([train[j + 1 : j + 1 + cfg.context] for j in i])
        _, loss = model(x, y)
        opt.zero_grad(set_to_none=True)
        loss.backward()
        gn = torch.nn.utils.clip_grad_norm_(model.parameters(), a.clip).item()
        ema = loss.item() if ema is None else 0.95 * ema + 0.05 * loss.item()
        opt.step()
        if (step + 1) % a.eval_every == 0 or step == a.max_steps - 1:
            vl = eval_loss(model, val_w)
            tl = eval_loss(model, train_probe)
            row = {"step": step + 1, "train_loss_ema": round(ema, 4), "train_probe_loss": round(tl, 4), "val_loss": round(vl, 4), "val_ppl": round(math.exp(vl), 2), "lr": lr_at(step), "grad_norm": round(gn, 3), "seconds": round(time.time() - t0)}
            improved = vl < best - 1e-3
            if improved:
                best, best_step, bad = vl, step + 1, 0
                torch.save({"model": model.state_dict(), "step": step + 1, "config": cfg.__dict__, "val_loss": vl, "run": record}, os.path.join(out, "best.pt"))
            else:
                bad += 1
            row["best"] = improved
            log.write(json.dumps(row) + "\n")
            log.flush()
            print(f"[{a.run}] step {step + 1} train {tl:.3f} val {vl:.3f} (ppl {math.exp(vl):.1f}){' *best' if improved else ''} {row['seconds']}s", flush=True)
            if bad >= a.patience:
                print(f"[{a.run}] early stop: no val improvement for {a.patience} evals", flush=True)
                break
    record.update({"best_step": best_step, "best_val_loss": best, "best_val_ppl": math.exp(best), "stopped_at": step + 1, "train_seconds": round(time.time() - t0)})
    json.dump(record, open(os.path.join(out, "run.json"), "w"), indent=2)
    print(f"[{a.run}] DONE best val ppl {math.exp(best):.2f} at step {best_step}", flush=True)


if __name__ == "__main__":
    main()
