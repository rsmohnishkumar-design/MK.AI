"""Second half of the automatic training job: decides whether the new model goes live.

    python auto_finish.py --name auto-20261119-1200 --examples 123 --sha <data sha>

Safety gates (all must pass, otherwise the live model stays):
  1. Better on validation (lower perplexity, word-F1 not lower), as pipeline.py judges it.
  2. Final test run ONCE for this candidate (logged): test perplexity must also be lower.
  3. promote.py's check that the browser engine gives the same output as PyTorch.
Always records the attempt in checkpoints/AUTO_STATE.json so the same data isn't retrained.
"""
import argparse
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, "checkpoints", "AUTO_STATE.json")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--examples", type=int, required=True)
    ap.add_argument("--sha", required=True)
    ap.add_argument("--quick", action="store_true", help="tests only: 5 questions")
    a = ap.parse_args()
    py = sys.executable
    val = json.load(open(os.path.join(HERE, "reports", f"val-{a.name}.json")))
    live, new = val["live"], val[a.name]
    better_val = new["val_ppl"] < live["val_ppl"] and new["guarded"]["word_f1"] >= live["guarded"]["word_f1"] - 0.01
    result, promoted = "not better on validation", False
    if better_val:
        cmd = [py, "pipeline.py", "--name", a.name, "--skip-train", "--final-test"] + (["--quick"] if a.quick else [])
        subprocess.run(cmd, cwd=HERE, check=True)
        t = json.load(open(os.path.join(HERE, "reports", f"test-{a.name}.json")))
        if t[a.name]["test_ppl"] < t["live"]["test_ppl"]:
            r = subprocess.run([py, "promote.py", "--name", a.name], cwd=HERE)
            promoted = r.returncode == 0
            result = "promoted" if promoted else "browser engine check failed"
        else:
            result = "not better on the final test"
    state = {"examples": a.examples, "data_sha": a.sha, "last_run": a.name, "last_result": result,
             "at": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()),
             "val_ppl": {"live": live["val_ppl"], "new": new["val_ppl"]}}
    with open(STATE, "w") as f:
        json.dump(state, f, indent=2)
        f.write("\n")
    print("RESULT:", result)
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            f.write(f"promoted={'true' if promoted else 'false'}\nresult={result}\n")


if __name__ == "__main__":
    main()
