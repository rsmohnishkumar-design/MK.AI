"""Promotes a reviewed run to be the model the app uses (team lead only).

    python promote.py --name team-gpu1

Requires: reports/val-<name>.json showing it beats the live model on validation, and
reports/test-<name>.json (pipeline.py --final-test). Then it
 1. copies runs/<name>/best.pt to checkpoints/nova-mini-<name>.pt (the old live model stays),
 2. points checkpoints/LIVE.txt at it,
 3. exports it to models/nova-mini/ for the app,
 4. runs the browser-engine check (needs Node.js): JS output must match PyTorch.
After that: commit, push, and the owner decides when to "make it live".
"""
import argparse
import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument("--name", required=True)
a = ap.parse_args()
py = sys.executable
best = os.path.join(HERE, "runs", a.name, "best.pt")
val = json.load(open(os.path.join(HERE, "reports", f"val-{a.name}.json")))
test_path = os.path.join(HERE, "reports", f"test-{a.name}.json")
if not os.path.exists(test_path):
    raise SystemExit("Run the final test first: python pipeline.py --name %s --skip-train --final-test" % a.name)
if not val[a.name]["val_ppl"] < val["live"]["val_ppl"]:
    raise SystemExit("This run is not better than the live model on validation; not promoting.")
dest = os.path.join(HERE, "checkpoints", f"nova-mini-{a.name}.pt")
shutil.copy(best, dest)
open(os.path.join(HERE, "checkpoints", "LIVE.txt"), "w").write(os.path.relpath(dest, HERE) + "\n")
subprocess.run([py, "export_web.py", "--ckpt", dest, "--tokenizer", "data/tokenizer.json", "--name", "nova-mini", "--eval", test_path], cwd=HERE, check=True)
ref = os.path.join(HERE, "reports", f"ref-{a.name}.json")
subprocess.run([py, "make_reference.py", "--ckpt", dest, "--tokenizer", "data/tokenizer.json", "--out", ref], cwd=HERE, check=True)
r = subprocess.run(["node", "tests/nova_parity.test.mjs", "models/nova-mini", ref], cwd=os.path.dirname(HERE))
os.remove(ref)
if r.returncode:
    raise SystemExit("Browser engine check FAILED: do not commit; ask for help.")
print(f"Promoted {a.name}. Now commit and push; the owner decides when to make it live.")
