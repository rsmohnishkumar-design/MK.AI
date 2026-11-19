"""Collects new training data for the automatic training job (.github/workflows/auto-train.yml).

    python auto_sources.py            # needs env FIREBASE_SERVICE_ACCOUNT (raw JSON or base64)
    python auto_sources.py --offline mindquest.json approved.json   # for tests, no network

Sources:
  1. Mind Quest (mindquest-learn.pages.dev/api/nova-export): the owner's own quiz questions.
     Authorised with a Google ID token of Nova's service account (no shared password).
  2. Nova's Training Room: examples the admin APPROVED (Firestore trainingData, status approved).

Writes data/contrib/_auto.jsonl (git-ignored: Mind Quest questions are not published in this
public repo) after the same checks as check_contrib.py, then compares with
checkpoints/AUTO_STATE.json and tells the workflow whether there is enough new data to train.
"""
import argparse
import base64
import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from check_contrib import check_row, heldout_answers  # noqa: E402

OUT = os.path.join(HERE, "data", "contrib", "_auto.jsonl")
STATE = os.path.join(HERE, "checkpoints", "AUTO_STATE.json")
MQ_URL = "https://mindquest-learn.pages.dev/api/nova-export"
MQ_AUDIENCE = "https://mindquest-learn.pages.dev"
PROJECT = "mkai-c042b"
TOPICS = {"mathematics": "maths", "maths": "maths", "physics": "science", "chemistry": "science",
          "biology": "science", "social science": "history", "general knowledge": "general"}


def from_mindquest(q):
    """Same conversion as fromMindQuest() in js/trainer.js."""
    question = re.sub(r"\s+", " ", str(q.get("question") or "")).strip()
    answer = str(q.get("answer") if q.get("answer") is not None else "").strip()
    opts = q.get("options")
    if isinstance(opts, list) and answer.isdigit() and int(answer) < len(opts) and opts[int(answer)] is not None:
        answer = str(opts[int(answer)]).strip()
    why = re.sub(r"\s+", " ", str(q.get("explanation") or "")).strip()
    if not question or not answer:
        return None
    full = (answer if re.search(r"[.!?]$", answer) else answer + ".") + (" " + why if why else "")
    subject = str(q.get("subject") or "").lower().strip()
    return {"question": question[:500], "answer": full[:2000],
            "topic": (TOPICS.get(subject) or re.sub(r"[^a-z ]", "", subject) or "general")[:40],
            "source": f"Mind Quest #{str(q.get('id', ''))[:80]}", "licence": "own", "author": "Mind Quest"}


def from_firestore(doc):
    f = doc.get("fields", {})
    v = lambda k: f.get(k, {}).get("stringValue", "")  # noqa: E731
    return {"question": v("question"), "answer": v("answer"), "topic": v("topic") or "general",
            "source": v("source") or "Training Room", "licence": v("licence") or "own", "author": v("author") or "team"}


def credentials():
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "").strip()
    if not raw:
        raise SystemExit("FIREBASE_SERVICE_ACCOUNT is not set")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return json.loads(base64.b64decode(raw))


def fetch_online():
    import google.auth.transport.requests as gtr
    import requests
    from google.oauth2 import service_account

    info = credentials()
    print(f"Key: account {info.get('client_email', '?').split('@')[0]}, project {info.get('project_id', '?')}")
    if info.get("project_id") != PROJECT:
        raise SystemExit(f"This key is for project '{info.get('project_id')}', not {PROJECT}. Make a new key for {PROJECT}.")
    mq, approved = [], []
    try:
        idc = service_account.IDTokenCredentials.from_service_account_info(info, target_audience=MQ_AUDIENCE)
        idc.refresh(gtr.Request())
        r = requests.get(MQ_URL, headers={"Authorization": f"Bearer {idc.token}"}, timeout=60)
        if r.ok:
            mq = r.json().get("questions", [])
        else:
            print(f"Mind Quest export answered {r.status_code} ({r.text[:120]}); using Training Room data only")
    except Exception as e:  # Mind Quest being down must not stop training on approved data
        print("Mind Quest not reachable:", type(e).__name__)
    sc = service_account.Credentials.from_service_account_info(info, scopes=["https://www.googleapis.com/auth/datastore"])
    sc.refresh(gtr.Request())
    q = {"structuredQuery": {"from": [{"collectionId": "trainingData"}],
                             "where": {"fieldFilter": {"field": {"fieldPath": "status"}, "op": "EQUAL", "value": {"stringValue": "approved"}}}}}
    r = requests.post(f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents:runQuery",
                      headers={"Authorization": f"Bearer {sc.token}"}, json=q, timeout=60)
    if not r.ok:
        raise SystemExit(f"Nova database refused ({r.status_code}): {r.text[:300]}")
    approved = [x["document"] for x in r.json() if "document" in x]
    return mq, approved


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", nargs=2, metavar=("MINDQUEST_JSON", "APPROVED_JSON"))
    ap.add_argument("--min-new", type=int, default=int(os.environ.get("MIN_NEW", "10")))
    a = ap.parse_args()
    if a.offline:
        mq = json.load(open(a.offline[0])).get("questions", [])
        approved = json.load(open(a.offline[1]))
    else:
        mq, approved = fetch_online()

    held, seen, rows, dropped = heldout_answers(), set(), [], 0
    imported_mq = set()
    for d in approved:  # approved Training Room rows (includes Mind Quest ones the admin synced)
        r = from_firestore(d)
        m = re.match(r"Mind Quest #([^ ·]+)", r["source"])
        if m:
            imported_mq.add(m.group(1))
        rows.append(r)
    for q in mq:
        if str(q.get("id")) in imported_mq:
            continue
        r = from_mindquest(q)
        if r:
            rows.append(r)
        else:
            dropped += 1
    good = []
    for r in rows:
        key = (r["question"].strip().lower(), r["answer"].strip())
        if key in seen or check_row(r, held):
            dropped += 1
            continue
        seen.add(key)
        good.append(r)
    good.sort(key=lambda r: (r["source"], r["question"]))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    text = "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in good)
    open(OUT, "w", encoding="utf-8").write(text)
    sha = hashlib.sha256(text.encode()).hexdigest()

    state = json.load(open(STATE)) if os.path.exists(STATE) else {"examples": 0, "data_sha": ""}
    new = len(good) - state.get("examples", 0)
    changed = sha != state.get("data_sha")
    train = changed and (new >= a.min_new or (state.get("examples", 0) == 0 and len(good) >= a.min_new))
    print(f"Mind Quest questions: {len(mq)}, approved Training Room examples: {len(approved)}")
    print(f"Usable examples: {len(good)} ({dropped} dropped by checks), last trained on {state.get('examples', 0)}; new: {new}")
    print("Decision:", "TRAIN" if train else f"skip (needs at least {a.min_new} new examples)")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            f.write(f"train={'true' if train else 'false'}\nexamples={len(good)}\nsha={sha}\n")


if __name__ == "__main__":
    main()
