"""Tests for the NOVA tokenizer (pure Python): python -I nova-llm/test_tokenizer.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tokenizer import Tokenizer  # noqa: E402

CORPUS = (
    "Nova AI helps students learn. Nova AI explains science and maths. "
    "வணக்கம்! நான் நோவா. தமிழ் கற்றுக்கொள்வோம். தமிழ் ஒரு அழகான மொழி. "
    "नमस्ते, मैं नोवा हूँ। def add(a, b): return a + b\n" * 20
)
ok = 0
tests = 0


def check(name, cond):
    global ok, tests
    tests += 1
    ok += bool(cond)
    print("PASS" if cond else "FAIL", name)


tok = Tokenizer.train(CORPUS, vocab_size=600)
check("learns merges from our own text", len(tok.merges) > 50)
for sample in ["Nova AI explains maths.", "வணக்கம்! தமிழ் மொழி.", "नमस्ते नोवा", "def add(a, b): return a + b", "unseen wörds ✓ 😀 123456"]:
    check(f"round-trips exactly: {sample!r}", tok.decode(tok.encode(sample)) == sample)
english = "Nova AI explains science and maths."
check("compresses trained text (fewer tokens than bytes)", len(tok.encode(english)) < len(english.encode("utf-8")) / 2)
tamil = "தமிழ் கற்றுக்கொள்வோம்"
check("Tamil is compressed too, not left as raw bytes", len(tok.encode(tamil)) < len(tamil.encode("utf-8")) / 2)
ids = tok.encode("<|user|>hi<|assistant|>", bos=True, eos=True)
check("special tokens stay single tokens", ids[0] == tok.special["<|bos|>"] and tok.special["<|user|>"] in ids and ids[-1] == tok.special["<|eos|>"])
with tempfile.TemporaryDirectory() as d:
    p = os.path.join(d, "t.json")
    tok.save(p)
    again = Tokenizer.load(p)
    check("save and load give identical encodings", again.encode(english) == tok.encode(english) and again.vocab_size == tok.vocab_size)
print(f"\n{ok}/{tests} passed")
sys.exit(0 if ok == tests else 1)
