# NOVA LLM — Nova AI's own language model (research)

NOVA LLM is separate from the Nova AI app. It has its own tokenizer, architecture,
training run and weights. It is not Gemini or any other provider's model renamed.

## Status

| Part | File | Status |
| --- | --- | --- |
| Byte-level BPE tokenizer (English, Tamil, Hindi, code) | tokenizer.py | Implemented and tested (`python -I test_tokenizer.py`, 10/10) |
| Transformer (RoPE, RMSNorm, SwiGLU, tied embeddings, ~27M params by default) | model.py | Written, NOT run yet (no PyTorch in the dev container) |
| Pretraining loop (AdamW, cosine LR, fp16, resumable checkpoints) | train.py | Written, NOT run yet |
| Instruction tuning, evaluation, quantisation, browser export | — | Planned (below) |

## Honest expectations

Training compute ≈ 6 × parameters × tokens.

| Size | Tokens | Compute | Free T4-class GPU time (estimate) | Expect |
| --- | --- | --- | --- | --- |
| ~2M (CPU smoke test, `--small`) | 20M | ~2e14 FLOPs | minutes–hours on CPU | spelling, short phrases |
| ~27M (default) | ~600M | ~1e17 FLOPs | ~5–15 GPU-hours | short coherent paragraphs |
| ~125M | ~2.5B | ~2e18 FLOPs | ~100–250 GPU-hours | fluent text, weak facts and reasoning |

A small model will not match Gemini or other frontier systems. Free GPUs: Kaggle
notebooks (weekly GPU quota) and Google Colab's free tier (not guaranteed). Check
current quotas before planning; they change.

## Data (licences must be respected)

- Wikipedia in English and Tamil (CC BY-SA 4.0: credit and share-alike).
- Public-domain books (Project Gutenberg), Thirukkural and other public-domain Tamil texts.
- Nova AI's own knowledge files in `kb-src/`.
- Not allowed without checking terms: outputs of Gemini or other AI services (many terms forbid training competing models).

## Steps

1. Collect and clean text into `data/corpus.txt` (remove duplicates, very short lines, personal data).
2. `python tokenizer.py train data/corpus.txt tokenizer.json 16000`
3. On Kaggle/Colab: `pip install torch`, then `python train.py --data data/corpus.txt --tokenizer tokenizer.json --small --steps 200` (smoke test), then the full run.
4. Instruction tuning on openly licensed sets (e.g. Dolly 15k CC BY-SA, OpenAssistant oasst1 Apache 2.0) plus our own Q&A.
5. Evaluate: held-out perplexity, Nova's eval sets (English and Tamil), and the same tests the app uses.
6. Quantise to 8-bit and export to ONNX so it can run in the browser (Transformers.js / onnxruntime-web) as an optional "NOVA LLM (experimental)" mode.
7. Publish a model card: data, licences, settings, compute used, known limits.
