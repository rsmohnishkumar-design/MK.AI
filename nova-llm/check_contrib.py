"""Checks team-contributed training data in data/contrib/*.jsonl before training.

    python check_contrib.py          # prints a report; exit code 1 if anything must be fixed

Checks: valid JSON, required fields, allowed licence, link for CC-BY sources, length,
duplicates, answers that look copied from AI services, obvious private data, and that
no answer is identical to one in the fixed validation or test sets (that would leak).
"""
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, "data")
LICENCES = {"own", "public-domain", "cc0", "cc-by", "cc-by-sa"}
REQUIRED = ["question", "answer", "source", "licence", "author"]
PASTED = re.compile(r"(\*\*|^\s*(#{1,6}\s|[-*•]\s|\d+[.)]\s.*\n\s*\d+[.)]\s)|\b(sure!|certainly!|great question|i hope this helps|let me know if|feel free to))", re.I | re.M)
AI_SIGNS = re.compile(r"\b(as an ai (language )?model|i'm an ai|i am an ai|chatgpt|openai|gemini|claude|anthropic|i cannot browse)\b", re.I)
PRIVATE = re.compile(r"(\b\d{10}\b|\b\d{4}\s?\d{4}\s?\d{4}\b|[\w.+-]+@[\w-]+\.[\w.]+)")


def heldout_answers():
    out = set()
    for name in ("val.txt", "test.txt", "heldout.txt"):
        p = os.path.join(D, name)
        if os.path.exists(p):
            out |= set(a.strip() for a in re.findall(r"<\|assistant\|>(.*?)<\|eos\|>", open(p, encoding="utf-8").read(), re.S))
    return out


def check_row(r, held):
    """Returns None if the example is fine, else a short reason."""
    if not isinstance(r, dict):
        return "each line must be a JSON object"
    missing = [k for k in REQUIRED if not str(r.get(k, "")).strip()]
    if missing:
        return f"missing {', '.join(missing)}"
    q, a, lic = str(r["question"]).strip(), str(r["answer"]).strip(), str(r["licence"]).strip().lower()
    if lic not in LICENCES:
        return f"licence '{lic}' not allowed (use one of {sorted(LICENCES)})"
    if lic.startswith("cc-by") and not re.match(r"https?://", str(r["source"]).strip()):
        return f"{lic} needs a link in 'source'"
    if not (1 <= len(q) <= 500 and 1 <= len(a) <= 2000):
        return "question must be 1-500 and answer 1-2000 characters"
    if AI_SIGNS.search(a):
        return "answer looks copied from an AI service; write it yourself"
    if PASTED.search(a):
        return "answer looks pasted from a chatbot (bold, bullets or chatty words); write 1-3 plain sentences"
    if PRIVATE.search(q + " " + a):
        return "looks like private data (phone, ID or email number)"
    if a in held:
        return "this exact answer is in the validation/test set (leak) - remove it"
    return None


def load_contrib(strict=True):
    """Returns (rows, problems). Rows are dicts with question/answer/topic/source."""
    held = heldout_answers()
    rows, problems, seen = [], [], set()
    for path in sorted(glob.glob(os.path.join(D, "contrib", "*.jsonl"))):
        name = os.path.basename(path)
        for n, line in enumerate(open(path, encoding="utf-8"), 1):
            if not line.strip():
                continue
            where = f"{name}:{n}"
            try:
                r = json.loads(line)
            except json.JSONDecodeError as e:
                problems.append(f"{where}: not valid JSON ({e.msg})")
                continue
            problem = check_row(r, held)
            if problem:
                problems.append(f"{where}: {problem}")
                continue
            q, a, lic = r["question"].strip(), r["answer"].strip(), r["licence"].strip().lower()
            key = (q.lower(), a)
            if key in seen:
                problems.append(f"{where}: duplicate of an earlier line")
                continue
            seen.add(key)
            rows.append({"question": q, "answer": a, "topic": r.get("topic", "contrib"), "source": f"contrib/{name}", "licence": lic})
    return rows, problems


if __name__ == "__main__":
    rows, problems = load_contrib()
    files = glob.glob(os.path.join(D, "contrib", "*.jsonl"))
    print(f"{len(files)} file(s), {len(rows)} good example(s), {len(problems)} problem(s)")
    for p in problems[:200]:
        print("  FIX:", p)
    sys.exit(1 if problems else 0)
