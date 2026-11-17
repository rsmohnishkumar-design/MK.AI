"""NOVA LLM model: a small decoder-only transformer written from scratch.

RoPE positions, RMSNorm, SwiGLU feed-forward, tied input/output embeddings.
Default size (~30M parameters with a 16k vocabulary) is chosen to train on one
free Kaggle/Colab GPU in roughly 5-15 GPU-hours. NOT verified in the Nova AI
dev container (no PyTorch there): run test_model.py on Kaggle/Colab first.
"""
import math
from dataclasses import dataclass

import torch
import torch.nn as nn
import torch.nn.functional as F


@dataclass
class Config:
    vocab_size: int = 16000
    context: int = 512
    layers: int = 8
    width: int = 448
    heads: int = 7
    ffn_mult: float = 8 / 3
    dropout: float = 0.0  # attention-weight dropout (used by the step-450 model)
    resid_dropout: float = 0.0  # dropout on each block's attention/FFN output and on embeddings (added later; 0 = old behaviour)


class RMSNorm(nn.Module):
    def __init__(self, d, eps=1e-6):
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(d))

    def forward(self, x):
        return x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + self.eps) * self.weight


def rope(seq, dim, device, base=10000.0):
    inv = 1.0 / (base ** (torch.arange(0, dim, 2, device=device).float() / dim))
    t = torch.arange(seq, device=device).float()
    freqs = torch.outer(t, inv)
    return torch.cos(freqs), torch.sin(freqs)


def apply_rope(x, cos, sin):
    x1, x2 = x[..., 0::2], x[..., 1::2]
    out = torch.stack((x1 * cos - x2 * sin, x1 * sin + x2 * cos), dim=-1)
    return out.flatten(-2)


class Attention(nn.Module):
    def __init__(self, c: Config):
        super().__init__()
        self.h, self.d = c.heads, c.width // c.heads
        self.qkv = nn.Linear(c.width, 3 * c.width, bias=False)
        self.out = nn.Linear(c.width, c.width, bias=False)
        self.drop = c.dropout

    def forward(self, x, cos, sin):
        B, T, C = x.shape
        q, k, v = self.qkv(x).view(B, T, 3, self.h, self.d).unbind(2)
        q, k, v = (t.transpose(1, 2) for t in (q, k, v))
        q, k = apply_rope(q, cos[:T], sin[:T]), apply_rope(k, cos[:T], sin[:T])
        y = F.scaled_dot_product_attention(q, k, v, is_causal=True, dropout_p=self.drop if self.training else 0.0)
        return self.out(y.transpose(1, 2).reshape(B, T, C))


class FeedForward(nn.Module):
    def __init__(self, c: Config):
        super().__init__()
        hidden = int(c.width * c.ffn_mult / 64 + 0.999) * 64
        self.gate = nn.Linear(c.width, hidden, bias=False)
        self.up = nn.Linear(c.width, hidden, bias=False)
        self.down = nn.Linear(hidden, c.width, bias=False)

    def forward(self, x):
        return self.down(F.silu(self.gate(x)) * self.up(x))


class Block(nn.Module):
    def __init__(self, c: Config):
        super().__init__()
        self.n1, self.attn, self.n2, self.ffn = RMSNorm(c.width), Attention(c), RMSNorm(c.width), FeedForward(c)
        self.drop = nn.Dropout(c.resid_dropout)

    def forward(self, x, cos, sin):
        x = x + self.drop(self.attn(self.n1(x), cos, sin))
        return x + self.drop(self.ffn(self.n2(x)))


class NovaLM(nn.Module):
    def __init__(self, c: Config):
        super().__init__()
        self.c = c
        self.embed = nn.Embedding(c.vocab_size, c.width)
        self.edrop = nn.Dropout(c.resid_dropout)
        self.blocks = nn.ModuleList(Block(c) for _ in range(c.layers))
        self.norm = RMSNorm(c.width)
        self.head = nn.Linear(c.width, c.vocab_size, bias=False)
        self.head.weight = self.embed.weight  # tied
        cos, sin = rope(c.context, c.width // c.heads, "cpu")
        self.register_buffer("cos", cos, persistent=False)
        self.register_buffer("sin", sin, persistent=False)
        self.apply(self._init)
        for n, p in self.named_parameters():
            if n.endswith("out.weight") or n.endswith("down.weight"):
                nn.init.normal_(p, std=0.02 / math.sqrt(2 * c.layers))

    @staticmethod
    def _init(m):
        if isinstance(m, (nn.Linear, nn.Embedding)):
            nn.init.normal_(m.weight, std=0.02)

    def params(self):
        return sum(p.numel() for p in self.parameters())

    def forward(self, idx, targets=None):
        x = self.edrop(self.embed(idx))
        for b in self.blocks:
            x = b(x, self.cos, self.sin)
        logits = self.head(self.norm(x))
        loss = None if targets is None else F.cross_entropy(logits.reshape(-1, logits.size(-1)), targets.reshape(-1), ignore_index=-1)
        return logits, loss

    @torch.no_grad()
    def generate(self, idx, max_new=100, temperature=0.8, top_k=50, eos=None):
        for _ in range(max_new):
            logits, _ = self(idx[:, -self.c.context :])
            logits = logits[:, -1] / max(temperature, 1e-5)
            if top_k:
                v, _ = torch.topk(logits, min(top_k, logits.size(-1)))
                logits[logits < v[:, [-1]]] = -float("inf")
            nxt = torch.multinomial(F.softmax(logits, -1), 1)
            idx = torch.cat([idx, nxt], 1)
            if eos is not None and nxt.item() == eos:
                break
        return idx
