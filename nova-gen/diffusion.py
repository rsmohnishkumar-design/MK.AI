"""NOVA generation prototype: a small text-conditioned diffusion model (DDPM with
classifier-free guidance), written from scratch. The same code trains:
  image: 32x32 RGB pictures from captions like "red circle"
  video: 8-frame 16x16 clips from captions like "blue ball moving right"
(video frames are stacked as channels, so the network models them jointly and
learns the motion). This is a research prototype, not a production model.
"""
import math

import torch
import torch.nn as nn
import torch.nn.functional as F


def timestep_embedding(t, dim):
    half = dim // 2
    freqs = torch.exp(-math.log(10000) * torch.arange(half, device=t.device) / half)
    a = t.float()[:, None] * freqs[None]
    return torch.cat([a.sin(), a.cos()], 1)


class Res(nn.Module):
    def __init__(self, cin, cout, emb):
        super().__init__()
        self.n1 = nn.GroupNorm(8, cin)
        self.c1 = nn.Conv2d(cin, cout, 3, padding=1)
        self.e = nn.Linear(emb, cout)
        self.n2 = nn.GroupNorm(8, cout)
        self.c2 = nn.Conv2d(cout, cout, 3, padding=1)
        self.skip = nn.Conv2d(cin, cout, 1) if cin != cout else nn.Identity()

    def forward(self, x, e):
        h = self.c1(F.silu(self.n1(x)))
        h = h + self.e(e)[:, :, None, None]
        h = self.c2(F.silu(self.n2(h)))
        return h + self.skip(x)


class UNet(nn.Module):
    def __init__(self, channels, n_captions, base=48, emb=128):
        super().__init__()
        self.emb = emb
        self.t_mlp = nn.Sequential(nn.Linear(emb, emb), nn.SiLU(), nn.Linear(emb, emb))
        self.cap = nn.Embedding(n_captions + 1, emb)  # last id = "no caption" (for guidance)
        self.null = n_captions
        self.inp = nn.Conv2d(channels, base, 3, padding=1)
        self.d1 = Res(base, base, emb)
        self.d2 = Res(base, base * 2, emb)
        self.mid = Res(base * 2, base * 2, emb)
        self.u2 = Res(base * 4, base, emb)
        self.u1 = Res(base * 2, base, emb)
        self.out = nn.Sequential(nn.GroupNorm(8, base), nn.SiLU(), nn.Conv2d(base, channels, 3, padding=1))

    def forward(self, x, t, cap):
        e = self.t_mlp(timestep_embedding(t, self.emb)) + self.cap(cap)
        h0 = self.inp(x)
        h1 = self.d1(h0, e)
        h2 = self.d2(F.avg_pool2d(h1, 2), e)
        m = self.mid(F.avg_pool2d(h2, 2), e)
        u = F.interpolate(m, scale_factor=2)
        u = self.u2(torch.cat([u, h2], 1), e)
        u = F.interpolate(u, scale_factor=2)
        u = self.u1(torch.cat([u, h1], 1), e)
        return self.out(u)


class Diffusion:
    def __init__(self, steps=200):
        self.T = steps
        self.beta = torch.linspace(1e-4, 0.02 * 1000 / steps, steps)
        self.alpha = 1 - self.beta
        self.abar = torch.cumprod(self.alpha, 0)

    def loss(self, model, x0, cap, drop=0.15):
        n = x0.shape[0]
        t = torch.randint(0, self.T, (n,))
        noise = torch.randn_like(x0)
        ab = self.abar[t][:, None, None, None]
        xt = ab.sqrt() * x0 + (1 - ab).sqrt() * noise
        cap = torch.where(torch.rand(n) < drop, torch.full_like(cap, model.null), cap)
        return F.mse_loss(model(xt, t, cap), noise)

    @torch.no_grad()
    def sample(self, model, cap, shape, guidance=3.0, generator=None, on_step=None, should_stop=None):
        x = torch.randn((len(cap), *shape), generator=generator)
        null = torch.full_like(cap, model.null)
        for i in reversed(range(self.T)):
            if should_stop and should_stop():
                return None
            t = torch.full((len(cap),), i)
            eps_c, eps_u = model(x, t, cap), model(x, t, null)
            eps = eps_u + guidance * (eps_c - eps_u)
            a, ab, b = self.alpha[i], self.abar[i], self.beta[i]
            x = (x - b / (1 - ab).sqrt() * eps) / a.sqrt()
            if i:
                x = x + b.sqrt() * torch.randn(x.shape, generator=generator)
            if on_step:
                on_step(self.T - i, self.T)
        return x.clamp(-1, 1)
