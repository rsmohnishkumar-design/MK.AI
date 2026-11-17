"""Real (not mocked) checks of the NOVA model code with PyTorch on CPU:
    python test_model.py
"""
import torch

from model import Config, NovaLM

ok = tests = 0


def check(name, cond):
    global ok, tests
    tests += 1
    ok += bool(cond)
    print("PASS" if cond else "FAIL", name)


torch.manual_seed(0)
c = Config(vocab_size=300, layers=2, width=64, heads=4, context=32)
m = NovaLM(c)
x = torch.randint(0, 300, (2, 32))
logits, loss = m(x, torch.randint(0, 300, (2, 32)))  # targets unrelated to inputs
check("output shape is batch x time x vocab", logits.shape == (2, 32, 300))
check("initial loss is near log(vocab) (untrained)", abs(loss.item() - torch.log(torch.tensor(300.0)).item()) < 1.0)
# causal: changing a later token must not change earlier outputs
y = x.clone()
y[:, 20] = (y[:, 20] + 1) % 300
l2, _ = m(y)
check("causal mask: future tokens don't affect the past", torch.allclose(logits[:, :20], l2[:, :20], atol=1e-5))
check("embeddings are tied to the output layer", m.head.weight.data_ptr() == m.embed.weight.data_ptr())
# it can learn: overfit one batch
opt = torch.optim.AdamW(m.parameters(), lr=3e-3)
seq = torch.arange(32).repeat(2, 1) % 300
for _ in range(150):
    _, l = m(seq[:, :-1], seq[:, 1:])
    opt.zero_grad()
    l.backward()
    opt.step()
check(f"learns a pattern (loss {l.item():.3f} < 0.1)", l.item() < 0.1)
out = m.generate(torch.tensor([[0, 1, 2]]), max_new=5, temperature=0.01, top_k=1)
check(f"generates the learned continuation {out.tolist()[0]}", out.tolist()[0][:8] == [0, 1, 2, 3, 4, 5, 6, 7])
print(f"\n{ok}/{tests} passed")
raise SystemExit(0 if ok == tests else 1)
