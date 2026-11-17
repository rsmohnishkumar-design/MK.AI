"""Builds NOVA LLM's training text from data we own or that is public domain,
and writes a provenance record next to it (data/MANIFEST.json).

Sources used now:
- Nova AI's own knowledge base (data/kb/*.json): written for this project.
- Thirukkural couplets in js/thirukkural.js: public-domain classical Tamil text.

    python prepare_data.py            -> nova-llm/data/corpus.txt + MANIFEST.json
"""
import hashlib
import json
import os
import random
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


def kb_pairs():
    pairs = []
    kb = os.path.join(ROOT, "data", "kb")
    for name in sorted(os.listdir(kb)):
        if not name.endswith(".json"):
            continue
        d = json.load(open(os.path.join(kb, name), encoding="utf-8"))
        for e in d.get("entries", []):
            q, a = e[0], e[1]
            pairs.append((q, a, f"data/kb/{name}"))
            for alt in (e[2] if len(e) > 2 else [])[:2]:  # a couple of paraphrased questions
                pairs.append((alt[:1].upper() + alt[1:] + ("?" if not alt.endswith("?") else ""), a, f"data/kb/{name}"))
    return pairs


def kural_pairs():
    src = open(os.path.join(ROOT, "js", "thirukkural.js"), encoding="utf-8").read()
    out = []
    # [number, "section", [topics], "Tamil\nlines", "meaning"]
    for m in re.finditer(r'\[(\d+),\s*"([^"]*)",\s*\[[^\]]*\],\s*"([^"]+)",\s*"([^"]+)"\]', src):
        n, section, ta, en = m.groups()
        tamil = ta.replace("\\n", "\n")
        out.append((f"Thirukkural {n}", f"{tamil}\nMeaning: {en}", "js/thirukkural.js"))
        out.append((f"Give me a kural about {section.split('·')[-1].strip().lower()}", f"Kural {n}:\n{tamil}\nMeaning: {en}", "js/thirukkural.js"))
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    pairs = kb_pairs() + kural_pairs()
    random.Random(7).shuffle(pairs)
    lines = [f"<|user|>{q}<|assistant|>{a}<|eos|>" for q, a, _ in pairs]
    text = "\n".join(lines) + "\n"
    path = os.path.join(OUT, "corpus.txt")
    open(path, "w", encoding="utf-8").write(text)
    by_source = {}
    for _, _, s in pairs:
        by_source[s] = by_source.get(s, 0) + 1
    manifest = {
        "file": "corpus.txt",
        "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        "characters": len(text),
        "examples": len(pairs),
        "sources": {
            "data/kb/*.json": {"licence": "Nova AI project content (owned)", "examples": sum(v for k, v in by_source.items() if k.startswith("data/kb"))},
            "js/thirukkural.js": {"licence": "Public domain (Thiruvalluvar); English meanings written for this project", "examples": by_source.get("js/thirukkural.js", 0)},
        },
        "excluded": "No user conversations, no private data, no output of other AI services.",
    }
    json.dump(manifest, open(os.path.join(OUT, "MANIFEST.json"), "w"), indent=2)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
