# External dependency register

Every outside service, model, library and dataset Nova AI uses, and whether
Independent mode (js/independent.js) turns it off. Updated with v102.

## Outside AI inference services (to be replaced by NOVA's own models)

| Service | Used for | Where | Off in Independent mode? |
| --- | --- | --- | --- |
| Google Gemini via Firebase AI Logic (App Check) | Main chat fallback, photos, PDFs, search grounding | js/firebase.js, js/ai.js | Yes |
| Google Gemini API with vault key | Chat, search, speech (TTS), pictures | js/gemini-rest.js, js/ai.js | Yes |
| Groq, Cerebras, OpenRouter (free models), GitHub Models | Chat | js/providers.js, js/ai.js | Yes |
| Pollinations (FLUX image model) | Pictures | js/vision.js, js/agent/ui.js | Yes |
| AI Horde (volunteer image AI) | Pictures | js/vision.js | Yes |
| Gemini through Firebase AI Logic | Whether app assistant, embed widget for other sites | whether/index.html, embed/nova-ai.js | No (separate sites; not yet wired to the switch) |
| Nova Gateway (our Cloudflare Worker) | Would call Gemini/Groq/etc. server-side | gateway/ | Not deployed |

## NOVA's own models and engines (no outside AI)

| Component | Status |
| --- | --- |
| NOVA Mini language model (models/nova-mini, trained by nova-llm/train.py on our own data) | Trained, tiny, experimental |
| NOVA browser inference engine (js/nova/llm.js, js/nova/tokenizer.js) | Working, tested against PyTorch |
| Maths, science, knowledge base, Thirukkural, analytics, forecasting, decisions, agent engine | Working (rule-based and statistical, not neural) |
| Drawing engine (canvas scenes in js/vision.js) | Working; procedural, not an AI image model |
| On-device sentence embeddings: all-MiniLM-L6-v2 via Transformers.js (js/meaning.js) | Third-party pretrained model running locally; to be replaced or labelled as baseline |

## Infrastructure (approved)

| Service | Used for |
| --- | --- |
| Firebase Hosting | The website |
| Firebase Authentication | Accounts |
| Cloud Firestore | Profiles, chats, settings, shared knowledge |
| Firebase App Check / reCAPTCHA Enterprise | Protects the Gemini path |
| GitHub Pages | Dummy public copy only |
| Cloudflare Workers + KV | Nova Gateway (not deployed) |
| Cloudflare R2 | Planned: generated media and model files (not set up) |

## Other outside data services (not AI)

| Service | Used for |
| --- | --- |
| Wikipedia / Wiktionary APIs | Facts and word meanings |
| Open-Meteo, OpenStreetMap Nominatim | Whether app weather and place names |
| Google Fonts (Inter, JetBrains Mono) | Fonts |
| cdn.jsdelivr.net | Pyodide (Python in the browser), Transformers.js |

## Bundled open-source libraries (lib/)

| Library | Version | Licence |
| --- | --- | --- |
| pdf.js | 4.10.38 | Apache-2.0 |
| SheetJS (xlsx) | 0.18.5 (known CVEs; update pending) | Apache-2.0 |
| docx | header says 1.15.0 | MIT |
| PptxGenJS | bundled | MIT |
| Mermaid | bundled | MIT |
| highlight.js | 11.12.0 | BSD-3-Clause |
| Firebase JS SDK | 12.19.0 (from gstatic) | Apache-2.0 |
| Pyodide | 0.27.8 (CDN) | MPL-2.0 |

## Training-side software (nova-llm/, not shipped to users)

PyTorch (BSD-3), Python 3.11 standard library. Datasets: see nova-llm/data/MANIFEST.json
(Nova's own knowledge base + public-domain Thirukkural; no user data, no AI-service outputs).
