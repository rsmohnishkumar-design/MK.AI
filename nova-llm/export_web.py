"""Exports a trained NOVA checkpoint for NOVA's own browser engine (js/nova/llm.js):
models/<name>/model.json (config + tensor index), weights.bin (float16), tokenizer.json.

    python export_web.py --ckpt ckpt/final.pt --tokenizer data/tokenizer.json --name nova-mini
"""
import argparse
import json
import os
import shutil

import torch

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", required=True)
    ap.add_argument("--tokenizer", required=True)
    ap.add_argument("--name", default="nova-mini")
    ap.add_argument("--eval", help="evaluation report JSON to include in the model card")
    a = ap.parse_args()
    ck = torch.load(a.ckpt, map_location="cpu", weights_only=False)  # our own checkpoints
    out = os.path.join(ROOT, "models", a.name)
    os.makedirs(out, exist_ok=True)
    index, offset = [], 0
    with open(os.path.join(out, "weights.bin"), "wb") as f:
        for name, t in ck["model"].items():
            if name == "head.weight":  # tied to embed.weight
                continue
            arr = t.detach().to(torch.float16).contiguous().numpy().tobytes()
            index.append({"name": name, "shape": list(t.shape), "offset": offset, "bytes": len(arr)})
            f.write(arr)
            offset += len(arr)
    meta = {
        "format": "nova-web-1",
        "dtype": "float16",
        "config": ck["config"],
        "tensors": index,
        "trained_steps": ck.get("step"),
        "val_loss": ck.get("val_loss"),
        "parameters": sum(t.numel() for n, t in ck["model"].items() if n != "head.weight"),
    }
    if a.eval and os.path.exists(a.eval):
        meta["evaluation"] = {k: v for k, v in json.load(open(a.eval, encoding="utf-8")).items() if k != "samples"}
    json.dump(meta, open(os.path.join(out, "model.json"), "w"), indent=1)
    shutil.copy(a.tokenizer, os.path.join(out, "tokenizer.json"))
    print("exported", out, f"{offset / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
