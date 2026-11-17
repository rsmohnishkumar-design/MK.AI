"""Train the NOVA generation prototype on NOVA-drawn data (CPU is fine).

    python train_gen.py --kind image --steps 3000 --out ckpt_image.pt
    python train_gen.py --kind video --steps 3000 --out ckpt_video.pt
"""
import argparse
import random
import time

import torch

from data import IMAGE_CAPTIONS, VIDEO_CAPTIONS, batch
from diffusion import Diffusion, UNet


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kind", choices=["image", "video"], required=True)
    ap.add_argument("--steps", type=int, default=3000)
    ap.add_argument("--batch", type=int, default=48)
    ap.add_argument("--lr", type=float, default=2e-3)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    torch.manual_seed(0)
    rng = random.Random(0)
    caps = IMAGE_CAPTIONS if a.kind == "image" else VIDEO_CAPTIONS
    channels = 3 if a.kind == "image" else 24
    model = UNet(channels, len(caps), base=48 if a.kind == "image" else 64)
    diff = Diffusion(200)
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, a.lr, total_steps=a.steps)
    print(f"{a.kind}: {sum(p.numel() for p in model.parameters()) / 1e6:.2f}M parameters")
    t0 = time.time()
    for step in range(a.steps):
        x, y = batch(a.kind, a.batch, rng)
        loss = diff.loss(model, x, y)
        opt.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        sched.step()
        if step % 250 == 0 or step == a.steps - 1:
            print(f"step {step} loss {loss.item():.4f} {time.time() - t0:.0f}s", flush=True)
    torch.save({"model": model.state_dict(), "kind": a.kind, "channels": channels, "captions": caps, "base": model.inp.out_channels, "steps": a.steps}, a.out)
    print("saved", a.out, f"train time {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
