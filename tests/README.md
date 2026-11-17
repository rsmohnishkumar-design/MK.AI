# Tests

| Suite | Command | Needs |
| --- | --- | --- |
| Agent engine, tools, memory, analytics (31) | `node tests/agent.test.mjs` | Node 20+ |
| Nova Gateway (14) | `node gateway/test/worker.test.mjs` | Node 20+ |
| Firestore security rules (21) | `node tests/rules.test.mjs` | Firestore emulator running on 127.0.0.1:8080, `npm i @firebase/rules-unit-testing firebase` |
| NOVA LLM tokenizer (10) | `python -I nova-llm/test_tokenizer.py` | Python 3 |
| Workspace in a real browser | `tests/workspace.e2e.cjs` (see its header) | Playwright + Chromium, local web server |

The AI model is faked in these tests so they are repeatable. Real answer quality is
measured separately with evaluation sets (planned: `evals/`).
