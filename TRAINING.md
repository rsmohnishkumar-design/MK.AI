# How to train NOVA Mini — guide for the Nova AI team

NOVA Mini is Nova AI's own language model. It's trained by us, on our own data, and runs
inside the app on the user's device. This guide is everything a team member needs:
adding data, training, checking whether a new model is really better, and handing it in.

Today's live model: **NOVA Mini v2**: 2.4M parameters, test perplexity 46.7 (lower is
better). It writes in Nova's style but often gets facts wrong. **The fastest way to make
it better is more good, checked data**, not a bigger model.

---

## 1. Roles

| Role | Does | Needs |
| --- | --- | --- |
| Data writer | Writes question–answer pairs (English, Tamil, Hindi) | A browser |
| Fact checker | Checks every new answer is true and clear | A browser |
| Trainer | Runs training on Kaggle, Colab or a laptop | A Kaggle or Google account |
| Team lead | Reviews results, promotes a new model, asks the owner to make it live | Repo access |

## 2. Golden rules (read these first)

1. **Only data we're allowed to use:** written by us (`own`), public domain, or CC0/CC-BY/CC-BY-SA with a link.
2. **Never copy answers from ChatGPT, Claude, Gemini or any AI service.** It's against their terms and it isn't NOVA learning.
3. **No private information:** no phone numbers, addresses, marks or anyone's chats.
4. **Never edit `nova-llm/data/val.txt`, `test.txt` or `heldout.txt`.** They are the fixed exams. If the model sees them, our scores become lies.
5. **Pick models by the validation score only.** The final test is used once per candidate, just before promotion (it's logged in `reports/test_usage.jsonl`).
6. **Change one thing at a time** (data, or size, or learning rate) so you know what helped.
7. **Never paste keys or passwords** into notebooks, chats or files.

## 3. Adding training data (data writers + fact checkers)

1. Open the repo on GitHub: https://github.com/rsmohnishkumar-design/MK.AI
2. Go to `nova-llm/data/contrib/`, press **Add file → Create new file**, and name it `yourname-topic.jsonl` (for example `priya-geography.jsonl`).
3. Write one example per line, exactly like this:

```json
{"question": "What is the capital of Kerala?", "answer": "Thiruvananthapuram is the capital of Kerala.", "topic": "india", "source": "written for Nova", "licence": "own", "author": "Priya"}
```

4. Press **Commit changes → Create a new branch → Propose changes** (this opens a pull request).
5. A fact checker reads every line and comments on anything wrong.
6. The team lead runs `python nova-llm/check_contrib.py`, which catches bad JSON, a wrong licence, a missing link, copied AI text, private data, duplicates and leaks into the exams. Then they merge.

**Good data looks like:** one clear fact or explanation per answer; correct spelling; a
complete sentence or two; school-level topics Nova users ask about; Tamil written properly.

**How much helps?** Today's model trained on about 7,400 examples (0.37M tokens). Each extra
1,000 good examples is a real improvement; around 50,000 examples (about 5M tokens) is when the bigger
`gpu-medium` preset starts to pay off.

## 4. Training on Kaggle (free GPU, recommended)

1. Sign in at https://www.kaggle.com, then go to **Settings → Phone verification** (needed for GPU and internet).
2. **Create → New Notebook.** In the right panel, set **Accelerator → GPU T4 x2** (or P100) and turn **Internet → On**.
3. In the first cell, paste this and press Run:

```python
!git clone --depth 1 https://github.com/rsmohnishkumar-design/MK.AI.git
%cd MK.AI/nova-llm
!python check_contrib.py
```

4. In the next cell, train (pick your own run name):

```python
!python pipeline.py --name kaggle-yourname-1 --preset cpu-small
```

   On a GPU this takes a few minutes. You'll see the validation score falling, then:
   `VERDICT (validation): candidate looks better` or `not better than the live model`.

5. Only if it says **candidate looks better**, run the final test once:

```python
!python pipeline.py --name kaggle-yourname-1 --skip-train --final-test
```

6. Download these files from the **Output** panel (or the file browser on the left) and send them to the team lead:
   - `MK.AI/nova-llm/runs/kaggle-yourname-1/best.pt`
   - `MK.AI/nova-llm/runs/kaggle-yourname-1/run.json` and `log.jsonl`
   - `MK.AI/nova-llm/reports/val-kaggle-yourname-1.json` and `test-kaggle-yourname-1.json`

Kaggle gives a weekly GPU allowance (around 30 hours; check your quota page). Stop the
notebook when you're done so you don't waste it.

## 5. Training on Google Colab (free GPU, alternative)

1. Open https://colab.research.google.com, then **New notebook**.
2. **Runtime → Change runtime type → T4 GPU → Save.**
3. Run the same cells as in Kaggle steps 3–5. Colab deletes files when the session ends, so download the files from step 6 before closing.

## 6. Training on a laptop (CPU, slower but fine)

1. Install **Python 3.11+** (python.org, tick "Add to PATH") and **Git** (git-scm.com).
2. Open a terminal and run:

```bash
git clone https://github.com/rsmohnishkumar-design/MK.AI.git
cd MK.AI/nova-llm
pip install torch --index-url https://download.pytorch.org/whl/cpu
python pipeline.py --name laptop-yourname-1 --preset cpu-small
```

The `cpu-small` preset takes about 15–25 minutes on a 4-core laptop. To check
everything works first, run the 1-minute smoke test:
`python pipeline.py --name smoke --preset smoke --quick` (it makes a useless tiny model on purpose).

## 7. Promoting a better model (team lead)

1. Put the trainer's files back in place: `best.pt`, `run.json` and `log.jsonl` into `nova-llm/runs/<name>/`, and the two report files into `nova-llm/reports/`.
2. Check the numbers yourself: the candidate's `val_ppl` must be lower than the live model's, and word-F1 must not drop.
3. Run:

```bash
cd nova-llm
python promote.py --name <name>
```

   It keeps the old model, makes the new one live in `models/nova-mini/`, and checks that the
   browser engine gives the same output as PyTorch. If that check fails, don't commit.
4. Commit and push to the testing branch, then ask the owner to **"make it live"**.

## 8. Which preset to use

| Preset | Size | Use when the training text is about | Time |
| --- | --- | --- | --- |
| `smoke` | 0.25M | — (pipeline check only) | 1 min |
| `cpu-small` | 2.4M | up to ~2M tokens (today: 0.37M) | ~20 min CPU, ~3 min GPU |
| `gpu-medium` | 15.3M | ~5M+ tokens | ~1–3 GPU-hours |
| `gpu-large` | 40.1M | ~50M+ tokens | ~10–30 GPU-hours |

The pipeline prints **tokens per parameter**. Below about 0.05, the model just memorises,
so use a smaller preset or add data. A bigger preset on today's small data will score *worse*.

## 9. Ideas to try (one at a time, judged on validation)

1. More checked data in weak topics. `reports/` shows scores by topic; maths, coding and English are the weakest.
2. Tamil data: a big opportunity, and nobody else is building small Tamil models for students.
3. Learning rate ×0.5 or ×2 (`train2.py --lr`), dropout 0.1–0.3 (`--resid-dropout`).
4. A different seed (`--seed 7`), to see how much results vary by luck.
5. Later, with lots of data: retrain the tokenizer with a bigger vocabulary (this needs the team lead, because it changes how every model is compared).

## 10. Files you'll touch

| File | What it is |
| --- | --- |
| `nova-llm/data/contrib/*.jsonl` | Team training data |
| `nova-llm/check_contrib.py` | Data checker |
| `nova-llm/pipeline.py` | One-command train + evaluate + export |
| `nova-llm/train2.py` | Training (early stopping, best checkpoint, works on GPU or CPU) |
| `nova-llm/evaluate2.py` | Fair comparison: same questions and settings for every model |
| `nova-llm/promote.py` | Makes a reviewed model live in the app (team lead) |
| `nova-llm/reports/leaderboard.jsonl` | Every run's validation result |
| `nova-llm/checkpoints/` | Saved models (`LIVE.txt` says which one the app uses) |

## 11. Image and video research (nova-gen)

`nova-gen/` has tiny image and video models that learn from pictures our own code draws
(coloured shapes and moving balls). Run `python train_gen.py --kind image --steps 1500 --out ckpt_image.pt`,
then `python evaluate_gen.py ckpt_image.pt`. Real photo-quality images or video need millions of
licensed images and many GPU-days. Treat these as learning projects, not product features.

## 12. Honest expectations

NOVA Mini will **not** match ChatGPT, Claude or Gemini. Those are millions of times bigger
and trained on far more data with huge computers. What a team can realistically build is a
small, private, offline model that's good at Nova's own school topics and at Tamil, and real
experience in how AI models are made. Every improvement must be shown by the validation
and test numbers, not by how a few answers look.
