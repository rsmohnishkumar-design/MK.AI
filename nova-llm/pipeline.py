"""NOVA Mini training pipeline: one command for the whole team.

    python pipeline.py --name priya-try1                      # CPU laptop, safe defaults
    python pipeline.py --name team-gpu1 --preset gpu-medium   # Kaggle / Colab GPU
    python pipeline.py --name team-gpu1 --final-test          # once you're sure: run the final test
    python pipeline.py --name team-gpu1 --export              # make a browser copy (candidate)

Steps:
 1. check team data (data/contrib) and rebuild the training file (val/test stay frozen);
 2. train with early stopping on the validation set (runs/<name>/best.pt);
 3. compare with the LIVE model on the validation set, same conditions;
 4. optional --final-test: compare on the test set (use rarely; logged in reports/test_usage.jsonl);
 5. optional --export: write models/nova-mini-candidate/ for review (the live model is not touched).
Promoting a candidate to live is a separate, reviewed step (see TRAINING.md).
"""
import argparse
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
# what the app runs now (changed only by promote.py)
LIVE = os.path.join(HERE, open(os.path.join(HERE, "checkpoints", "LIVE.txt")).read().strip())

PRESETS = {
    # the NOVA Mini v2 recipe: right for today's ~0.4M training tokens
    "cpu-small": dict(layers=6, width=160, heads=4, context=256, dropout=0.1, resid_dropout=0.2, lr=1e-3, batch=24, max_steps=1500, eval_every=75, patience=4),
    # for ~5M+ training tokens (after the team adds data), on one free GPU
    "gpu-medium": dict(layers=8, width=384, heads=6, context=512, dropout=0.1, resid_dropout=0.1, lr=6e-4, batch=48, max_steps=8000, eval_every=250, patience=5),
    # tiny run to check the pipeline works (a minute on any computer); not a real model
    "smoke": dict(layers=1, width=64, heads=4, context=128, dropout=0.0, resid_dropout=0.0, lr=2e-3, batch=16, max_steps=60, eval_every=30, patience=2),
    # for ~50M+ training tokens; needs many GPU-hours
    "gpu-large": dict(layers=12, width=512, heads=8, context=512, dropout=0.0, resid_dropout=0.1, lr=4e-4, batch=64, max_steps=30000, eval_every=500, patience=6),
}
PARAMS_APPROX = {"cpu-small": 2.4e6, "gpu-medium": 15.3e6, "gpu-large": 40.1e6, "smoke": 0.25e6}


def run(cmd):
    print("\n$ " + " ".join(cmd), flush=True)
    r = subprocess.run(cmd, cwd=HERE)
    if r.returncode:
        raise SystemExit(f"Step failed: {' '.join(cmd[:3])} (exit {r.returncode})")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--name", required=True, help="a short name for this run, e.g. priya-try1")
    ap.add_argument("--preset", choices=PRESETS, default="cpu-small")
    ap.add_argument("--seed", type=int, default=1337)
    ap.add_argument("--skip-train", action="store_true", help="reuse runs/<name>/best.pt")
    ap.add_argument("--final-test", action="store_true", help="also compare on the final test set (rarely!)")
    ap.add_argument("--export", action="store_true", help="write models/nova-mini-candidate/")
    ap.add_argument("--quick", action="store_true", help="evaluate on 5 questions only (for checking the pipeline)")
    a = ap.parse_args()
    py = sys.executable
    best = os.path.join(HERE, "runs", a.name, "best.pt")

    run([py, "check_contrib.py"])
    run([py, "prepare_data.py"])
    cache = os.path.join(HERE, "data", "corpus.txt.ids.pt")
    if os.path.exists(cache) and os.path.getmtime(cache) < os.path.getmtime(os.path.join(HERE, "data", "corpus.txt")):
        os.remove(cache)  # training text changed: re-tokenise
    m = json.load(open(os.path.join(HERE, "data", "MANIFEST.json")))
    chars = m["files"]["corpus.txt"]["characters"]
    tokens = chars / 3.3
    ratio = tokens / PARAMS_APPROX[a.preset]
    print(f"\nTraining text: {m['examples']['train']} examples (~{tokens / 1e6:.2f}M tokens, {m['examples'].get('team_contrib', 0)} from the team). "
          f"Preset {a.preset}: ~{PARAMS_APPROX[a.preset] / 1e6:.1f}M parameters -> {ratio:.2f} tokens per parameter.")
    if ratio < 0.05:
        print("WARNING: far too little data for this preset; it will memorise instead of learning. Use a smaller preset or add data.")

    if not a.skip_train:
        p = PRESETS[a.preset]
        run([py, "-u", "train2.py", "--run", a.name, "--seed", str(a.seed)] + [f"--{k.replace('_', '-')}={v}" for k, v in p.items()])
    if not os.path.exists(best):
        raise SystemExit(f"No checkpoint at {best}")

    os.makedirs(os.path.join(HERE, "reports"), exist_ok=True)
    val_out = os.path.join(HERE, "reports", f"val-{a.name}.json")
    run([py, "evaluate2.py", "--split", "val", "--questions", "5" if a.quick else "67", "--ckpt", f"live={LIVE}", "--ckpt", f"{a.name}={best}", "--out", val_out])
    rep = json.load(open(val_out))
    live, new = rep["live"], rep[a.name]
    print("\n=== Validation comparison (same data, prompts and decoders) ===")
    for key in ("val_ppl",):
        print(f"{key:24} live {live[key]:>8}   new {new[key]:>8}   ({'better' if new[key] < live[key] else 'not better'})")
    for key in ("word_f1", "repeated_trigram_rate", "ended_properly"):
        print(f"guarded {key:16} live {live['guarded'][key]:>8}   new {new['guarded'][key]:>8}")
    verdict = new["val_ppl"] < live["val_ppl"] and new["guarded"]["word_f1"] >= live["guarded"]["word_f1"] - 0.01
    print("VERDICT (validation):", "candidate looks better" if verdict else "not better than the live model; keep experimenting")
    with open(os.path.join(HERE, "reports", "leaderboard.jsonl"), "a") as f:
        f.write(json.dumps({"at": time.strftime("%Y-%m-%d %H:%M"), "run": a.name, "preset": a.preset, "params": new["params"],
                            "train_examples": m["examples"]["train"], "val_ppl": new["val_ppl"], "val_word_f1": new["guarded"]["word_f1"],
                            "live_val_ppl": live["val_ppl"], "better": verdict, "quick": a.quick}) + "\n")

    if a.final_test:
        with open(os.path.join(HERE, "reports", "test_usage.jsonl"), "a") as f:
            f.write(json.dumps({"at": time.strftime("%Y-%m-%d %H:%M"), "run": a.name}) + "\n")
        test_out = os.path.join(HERE, "reports", f"test-{a.name}.json")
        run([py, "evaluate2.py", "--split", "test", "--questions", "5" if a.quick else "68", "--ckpt", f"live={LIVE}", "--ckpt", f"{a.name}={best}", "--out", test_out])
        t = json.load(open(test_out))
        print(f"\nFINAL TEST: test_ppl live {t['live']['test_ppl']}  new {t[a.name]['test_ppl']} | guarded word_f1 live {t['live']['guarded']['word_f1']}  new {t[a.name]['guarded']['word_f1']}")

    if a.export:
        run([py, "export_web.py", "--ckpt", best, "--tokenizer", "data/tokenizer.json", "--name", "nova-mini-candidate", "--eval", val_out])
        print("\nCandidate written to models/nova-mini-candidate/. Promote it only after review (TRAINING.md, step 7).")


if __name__ == "__main__":
    main()
