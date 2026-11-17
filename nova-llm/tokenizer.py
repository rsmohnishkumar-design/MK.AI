"""NOVA LLM tokenizer: byte-level BPE trained from scratch on our own text.

Works for any script: text is first turned into UTF-8 bytes, so Tamil, Hindi,
English and code all round-trip exactly. BPE then learns which byte pairs are
common in OUR data and merges them into new tokens.

Pure Python (no packages) so it runs anywhere; for big corpora train it on a
sample (a few MB is plenty for a 16k vocabulary).

    python tokenizer.py train corpus.txt tokenizer.json 16000
    python tokenizer.py encode tokenizer.json "வணக்கம் Nova"
"""
import json
import re
import sys
from collections import Counter

# Split text into chunks before BPE so merges never cross word or script boundaries.
PRETOKEN = re.compile(r"\s?[^\W\d_]+|\s?\d{1,3}|\s?[^\s\w]+|\s+|_+|.", re.UNICODE | re.DOTALL)
SPECIAL = ["<|pad|>", "<|bos|>", "<|eos|>", "<|user|>", "<|assistant|>"]


def chunks(text):
    parts = [m.group(0) for m in PRETOKEN.finditer(text)]
    assert "".join(parts) == text, "pre-tokenizer dropped characters"
    return [p.encode("utf-8") for p in parts]


def merge(ids, pair, new_id):
    out, i = [], 0
    while i < len(ids):
        if i + 1 < len(ids) and ids[i] == pair[0] and ids[i + 1] == pair[1]:
            out.append(new_id)
            i += 2
        else:
            out.append(ids[i])
            i += 1
    return out


class Tokenizer:
    def __init__(self, merges=None, special=SPECIAL):
        self.merges = merges or []  # list of ((a, b), new_id), in learned order
        self.special = {tok: 256 + len(self.merges) + i for i, tok in enumerate(special)}
        self._build()

    def _build(self):
        self.vocab = {i: bytes([i]) for i in range(256)}
        self.rank = {}
        for (a, b), nid in self.merges:
            self.vocab[nid] = self.vocab[a] + self.vocab[b]
            self.rank[(a, b)] = nid
        self.special = {tok: 256 + len(self.merges) + i for i, tok in enumerate(self.special)}
        self.inverse_special = {v: k for k, v in self.special.items()}

    @property
    def vocab_size(self):
        return 256 + len(self.merges) + len(self.special)

    @classmethod
    def train(cls, text, vocab_size=16000, verbose=False):
        if vocab_size < 256 + len(SPECIAL) + 1:
            raise ValueError("vocab_size too small")
        counts = Counter(chunks(text))
        words = {w: list(w) for w in counts}
        merges = []
        next_id = 256
        target = vocab_size - len(SPECIAL)
        while next_id < target:
            pairs = Counter()
            for w, ids in words.items():
                c = counts[w]
                for p in zip(ids, ids[1:]):
                    pairs[p] += c
            if not pairs:
                break
            best, freq = pairs.most_common(1)[0]
            if freq < 2:
                break
            for w in words:
                if len(words[w]) > 1:
                    words[w] = merge(words[w], best, next_id)
            merges.append((best, next_id))
            if verbose and next_id % 500 == 0:
                print("merges:", next_id - 255, "freq:", freq)
            next_id += 1
        return cls(merges)

    def _encode_chunk(self, b):
        ids = list(b)
        while len(ids) > 1:
            pairs = [(self.rank.get(p, 10**9), i) for i, p in enumerate(zip(ids, ids[1:]))]
            r, i = min(pairs)
            if r == 10**9:
                break
            ids = ids[:i] + [r] + ids[i + 2 :]
        return ids

    def encode(self, text, bos=False, eos=False):
        out = [self.special["<|bos|>"]] if bos else []
        # special tokens written literally in the text stay single tokens
        parts = re.split("(" + "|".join(map(re.escape, self.special)) + ")", text)
        for part in parts:
            if part in self.special:
                out.append(self.special[part])
            elif part:
                for c in chunks(part):
                    out.extend(self._encode_chunk(c))
        if eos:
            out.append(self.special["<|eos|>"])
        return out

    def decode(self, ids):
        buf, out = b"", []
        for i in ids:
            if i in self.inverse_special:
                out.append(buf.decode("utf-8", errors="replace"))
                buf = b""
                out.append(self.inverse_special[i])
            else:
                buf += self.vocab[i]
        out.append(buf.decode("utf-8", errors="replace"))
        return "".join(out)

    def save(self, path):
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"type": "nova-byte-bpe", "version": 1, "merges": [[a, b, n] for (a, b), n in self.merges], "special": list(self.special)}, f)

    @classmethod
    def load(cls, path):
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        return cls([((a, b), n) for a, b, n in d["merges"]], d["special"])


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "train":
        text = open(sys.argv[2], encoding="utf-8").read()
        tok = Tokenizer.train(text, int(sys.argv[4]) if len(sys.argv) > 4 else 16000, verbose=True)
        tok.save(sys.argv[3])
        print("vocab size:", tok.vocab_size)
    elif len(sys.argv) >= 4 and sys.argv[1] == "encode":
        tok = Tokenizer.load(sys.argv[2])
        ids = tok.encode(sys.argv[3])
        print(len(ids), "tokens:", ids)
        print("decoded:", tok.decode(ids))
    else:
        print(__doc__)
