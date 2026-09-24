# Writes a knowledge pack to data/kb/<name>.json and lists it in index.json.
# Edit a pack script (e.g. people.py) and run: python3 kb-src/people.py
import json, os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "kb")
def save(name, topic, entries):
    os.makedirs(OUT, exist_ok=True)
    seen = set()
    clean = []
    for e in entries:
        q, a = e[0].strip(), e[1].strip()
        alts = [x.strip() for x in (e[2] if len(e) > 2 else []) if x.strip() and x.strip().lower() != q.lower()]
        key = q.lower()
        if key in seen:
            raise SystemExit(f"duplicate question in {name}: {q}")
        seen.add(key)
        clean.append([q, a, alts] if alts else [q, a])
    with open(f"{OUT}/{name}.json", "w", encoding="utf-8") as f:
        json.dump({"topic": topic, "entries": clean}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{name}: {len(clean)} entries")
    idx_path = f"{OUT}/index.json"
    idx = json.load(open(idx_path)) if os.path.exists(idx_path) else {"packs": []}
    if f"{name}.json" not in idx["packs"]:
        idx["packs"].append(f"{name}.json")
    json.dump(idx, open(idx_path, "w"), indent=1)
