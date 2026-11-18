# Team training data (contrib)

Put new question–answer pairs here as `.jsonl` files (one JSON object per line), then run
`python check_contrib.py`. Only files ending in `.jsonl` are used.

```json
{"question": "What is the capital of Kerala?", "answer": "Thiruvananthapuram is the capital of Kerala.", "topic": "india", "source": "written by Priya for Nova", "licence": "own", "author": "Priya"}
```

Rules (the checker enforces most of them):
- `licence` must be one of: `own` (you wrote it yourself), `public-domain`, `cc0`, `cc-by`, `cc-by-sa`.
  For `cc-by` / `cc-by-sa`, `source` must be a link to where it came from.
- Never copy answers from ChatGPT, Claude, Gemini or other AI services, and never paste
  private information (names with phone numbers, addresses, marks, chats).
- Check facts before adding them. Wrong data teaches NOVA wrong answers.
- One clear answer per line; 1–2000 characters; Tamil, English and Hindi are all fine.
- Don't change `val.txt` / `test.txt`. New data always goes to training only.
