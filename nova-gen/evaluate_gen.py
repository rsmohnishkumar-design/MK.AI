"""Measures the NOVA generation prototypes on what they actually produce.

Image: for each caption, generate pictures and check
  - colour adherence: the shape's average colour is closest to the requested colour;
  - shape adherence: fill ratio of the shape in its bounding box (circle ~0.79,
    square ~1.0, triangle ~0.5) matches the requested shape.
Video: for each caption, generate clips and check
  - colour adherence, and
  - motion adherence: the ball's centre moves in the requested direction over the
    8 frames, and temporal coherence: the ball is present in every frame and moves
    steadily (no jumps).
Also writes sample sheets as PNG. Run:  python evaluate_gen.py ckpt_image.pt ckpt_video.pt
"""
import json
import struct
import sys
import time
import zlib

import torch

from data import COLORS
from diffusion import Diffusion, UNet


def png(path, img):  # img: H x W x 3 floats 0..1
    h, w, _ = img.shape
    raw = b"".join(b"\x00" + bytes((img[y] * 255).clamp(0, 255).byte().flatten().tolist()) for y in range(h))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def load(path):
    ck = torch.load(path, map_location="cpu")
    m = UNet(ck["channels"], len(ck["captions"]), base=ck["base"])
    m.load_state_dict(ck["model"])
    m.eval()
    return m, ck


def nearest_color(rgb):
    return min(COLORS, key=lambda c: sum((a - b) ** 2 for a, b in zip(COLORS[c], rgb)))


def fg_mask(img):  # img 3xHxW in 0..1; foreground = clearly brighter than the dark background
    return img.max(0).values > 0.35


def eval_images(path, per=6, out="samples_image.png"):
    m, ck = load(path)
    caps = ck["captions"]
    g = torch.Generator().manual_seed(42)
    ids = torch.tensor([i for i in range(len(caps)) for _ in range(per)])
    t0 = time.time()
    x = Diffusion(200).sample(m, ids, (3, 32, 32), generator=g)
    secs = (time.time() - t0) / len(ids)
    x = (x + 1) / 2
    color_ok = shape_ok = 0
    for img, i in zip(x, ids.tolist()):
        want_c, want_s = caps[i].split()
        mk = fg_mask(img)
        if mk.sum() < 10:
            continue
        rgb = [img[c][mk].mean().item() for c in range(3)]
        color_ok += nearest_color(rgb) == want_c
        ys, xs = mk.nonzero(as_tuple=True)
        box = (ys.max() - ys.min() + 1) * (xs.max() - xs.min() + 1)
        fill = mk.sum().item() / box.item()
        got = "square" if fill > 0.9 else "circle" if fill > 0.66 else "triangle"
        shape_ok += got == want_s
    n = len(ids)
    sheet = x.reshape(len(caps), per, 3, 32, 32).permute(0, 3, 1, 4, 2).reshape(len(caps) * 32, per * 32, 3)
    png(out, sheet)
    return {"samples": n, "colour_adherence": round(color_ok / n, 3), "shape_adherence": round(shape_ok / n, 3), "seconds_per_image_cpu": round(secs, 3), "sheet": out, "chance_colour": round(1 / len(COLORS), 3), "chance_shape": round(1 / 3, 3)}


def eval_videos(path, per=4, out="samples_video.png"):
    m, ck = load(path)
    caps = ck["captions"]
    g = torch.Generator().manual_seed(7)
    ids = torch.tensor([i for i in range(len(caps)) for _ in range(per)])
    t0 = time.time()
    x = Diffusion(200).sample(m, ids, (24, 16, 16), generator=g)
    secs = (time.time() - t0) / len(ids)
    x = ((x + 1) / 2).reshape(len(ids), 8, 3, 16, 16)
    color_ok = motion_ok = coherent = 0
    for clip, i in zip(x, ids.tolist()):
        words = caps[i].split()
        want_c, want_m = words[0], words[-1]
        cents, rgbs, present = [], [], True
        for f in clip:
            mk = fg_mask(f)
            if mk.sum() < 4:
                present = False
                break
            ys, xs = mk.nonzero(as_tuple=True)
            cents.append((xs.float().mean().item(), ys.float().mean().item()))
            rgbs.append([f[c][mk].mean().item() for c in range(3)])
        if not present:
            continue
        rgb = [sum(r[c] for r in rgbs) / len(rgbs) for c in range(3)]
        color_ok += nearest_color(rgb) == want_c
        dx, dy = cents[-1][0] - cents[0][0], cents[-1][1] - cents[0][1]
        got = ("right" if dx > 0 else "left") if abs(dx) > abs(dy) else ("down" if dy > 0 else "up")
        motion_ok += got == want_m and max(abs(dx), abs(dy)) > 3
        steps = [((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5 for a, b in zip(cents, cents[1:])]
        coherent += max(steps) < 3.0  # no jumps bigger than 3 px between frames
    n = len(ids)
    rows = x[:: per][: len(caps)]  # one clip per caption, frames left to right
    sheet = rows.permute(0, 3, 1, 4, 2).reshape(len(rows) * 16, 8 * 16, 3)
    png(out, sheet)
    return {"samples": n, "colour_adherence": round(color_ok / n, 3), "motion_direction_adherence": round(motion_ok / n, 3), "temporal_coherence": round(coherent / n, 3), "seconds_per_clip_cpu": round(secs, 3), "sheet": out, "chance_direction": 0.25}


if __name__ == "__main__":
    report = {}
    if len(sys.argv) > 1:
        report["image"] = eval_images(sys.argv[1])
    if len(sys.argv) > 2:
        report["video"] = eval_videos(sys.argv[2])
    print(json.dumps(report, indent=2))
    json.dump(report, open("eval_report.json", "w"), indent=2)
