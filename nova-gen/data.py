"""NOVA-owned training data for the generation prototypes: pictures and short
clips drawn by code, with their captions. No downloaded or third-party images.

Image sample: a coloured shape on a background, caption like "red circle".
Video sample: 8 frames of a coloured ball moving in a direction, caption like
"blue ball moving right".
"""
import math
import random

import torch

COLORS = {"red": (0.9, 0.15, 0.15), "green": (0.15, 0.8, 0.25), "blue": (0.2, 0.35, 0.95), "yellow": (0.95, 0.85, 0.1), "purple": (0.6, 0.2, 0.8), "white": (0.95, 0.95, 0.95)}
SHAPES = ["circle", "square", "triangle"]
MOVES = ["left", "right", "up", "down"]
IMAGE_CAPTIONS = [f"{c} {s}" for c in COLORS for s in SHAPES]
VIDEO_CAPTIONS = [f"{c} ball moving {m}" for c in COLORS for m in MOVES]


def _mask(shape, size, cx, cy, r):
    ys, xs = torch.meshgrid(torch.arange(size).float(), torch.arange(size).float(), indexing="ij")
    if shape == "circle":
        return ((xs - cx) ** 2 + (ys - cy) ** 2) <= r * r
    if shape == "square":
        return ((xs - cx).abs() <= r * 0.85) & ((ys - cy).abs() <= r * 0.85)
    # triangle pointing up
    top = cy - r
    inside_y = (ys >= top) & (ys <= cy + r * 0.8)
    half = (ys - top) / (1.8 * r) * r
    return inside_y & ((xs - cx).abs() <= half)


def image_sample(rng, size=32):
    caption_id = rng.randrange(len(IMAGE_CAPTIONS))
    color, shape = IMAGE_CAPTIONS[caption_id].split()
    bg = 0.05 + 0.1 * rng.random()
    img = torch.full((3, size, size), bg)
    r = rng.uniform(size * 0.2, size * 0.32)
    cx, cy = rng.uniform(r + 1, size - r - 1), rng.uniform(r + 1, size - r - 1)
    m = _mask(shape, size, cx, cy, r)
    for ch, v in enumerate(COLORS[color]):
        img[ch][m] = v
    return img * 2 - 1, caption_id  # pixels in [-1, 1]


def video_sample(rng, size=16, frames=8):
    caption_id = rng.randrange(len(VIDEO_CAPTIONS))
    words = VIDEO_CAPTIONS[caption_id].split()
    color, move = words[0], words[-1]
    dx, dy = {"left": (-1, 0), "right": (1, 0), "up": (0, -1), "down": (0, 1)}[move]
    r = 2.6
    speed = rng.uniform(0.9, 1.3)
    span = speed * (frames - 1)
    # start so the whole path stays inside the frame
    sx = rng.uniform(r + 1 + (span if dx < 0 else 0), size - r - 1 - (span if dx > 0 else 0))
    sy = rng.uniform(r + 1 + (span if dy < 0 else 0), size - r - 1 - (span if dy > 0 else 0))
    clip = torch.full((frames, 3, size, size), 0.08)
    for f in range(frames):
        m = _mask("circle", size, sx + dx * speed * f, sy + dy * speed * f, r)
        for ch, v in enumerate(COLORS[color]):
            clip[f, ch][m] = v
    return clip.reshape(frames * 3, size, size) * 2 - 1, caption_id


def batch(kind, n, rng):
    fn = image_sample if kind == "image" else video_sample
    xs, ys = zip(*(fn(rng) for _ in range(n)))
    return torch.stack(xs), torch.tensor(ys)
