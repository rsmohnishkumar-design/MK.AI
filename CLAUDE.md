# Nova AI — notes for Claude (project memory)

Read this first. It carries over what was learned in earlier chats with the owner.

## Talking with the owner
- The owner is a student, not a programmer. Uses an Android tablet, a Windows laptop and a
  school computer (Lenovo ThinkCentre, Windows — no PowerShell/installs, can't download zips there).
- Keep replies short, simple, outcome first, numbered steps. Give direct links when possible.
- When they want code to copy, paste it in chat as text ("copiable") — not only as a download.
- Be friendly and keep the conversation going like a teammate. They often send screenshots.
- Never ask them to paste keys/passwords into chat. Never commit secrets to this repo (it's public).
- The vault password and admin details belong to the owner; never write them into files.

## The project
- Nova AI (formerly "MK.ai"): a free AI assistant, static PWA (no build step).
  Models are branded "Alpaca" (Alpaca, Pro, Deep thinking, Vision).
- Real app: Firebase Hosting, project `mkai-c042b` → https://mkai-c042b.web.app
- GitHub Pages copy (github.io) is deliberately a DUMMY: a guard script in index/vault/learn/check
  and whether/index.html redirects github.io visitors to demo.html (a friend was copying the app).
  Keep that guard.
- Firebase SDK 12.19.0 (Auth, Firestore, AI Logic, App Check reCAPTCHA Enterprise). Config in firebase-config.js
  (the AIza web key is public by design).
- Main code: js/app.js (chat, personas, slash commands), js/avatar.js (talking avatar),
  js/robot.js (BLE / Web Serial / WebSocket link to a physical robot, see robot/README.md),
  vault.html (admin vault, opened by tapping the logo 5 times). whether/ = weather app with Nova AI.
- Personas include Wellbeing (Tele-MANAS 14416, 112, Childline 1098) and Money
  (RBI CMS, Sachet, 1930 cyber fraud) support modes.
- Logo: the owner's own image, icons/logo.png (+ favicon-32, icon-192/512, apple-touch-icon).

## Nova AI on other sites (embed)
- embed/nova-ai.js: a chat-bubble helper other sites load from
  https://mkai-c042b.web.app/embed/nova-ai.js (data-app="Name" sets the site's name).
  Used by Myhomely (myhomely.pages.dev). Updates reach those sites once Nova is made live
  (cached 5 min). Each site's domain must be in the reCAPTCHA key's domain list.

## Agent platform (v101, on the testing branch; NOT live yet)
- js/agent/: engine.js (task states CREATED…COMPLETED, planner, 9 specialist agents, approvals,
  verification, resume), tools.js (permissioned tools), analytics.js (stats/forecast/decisions),
  memory.js (per-device, user-controlled), ui.js (Nova Workspace: Agent, Research, Images,
  Memory, Tasks, Status). Open with /agent /research /images /memory /tasks or the ⋯ menu.
- gateway/: Cloudflare Worker that keeps AI keys server-side + server usage limits. Not deployed;
  needs the owner's Cloudflare account (gateway/README.md). GATEWAY_URL in firebase-config.js.
- firestore.rules changed (keys admin-only, usage can't be lowered, shared learned answers
  admin-only). The owner must paste them into the Firebase console WITH their real codes.
- Tests: tests/README.md (agent 31, gateway 14, rules 21, tokenizer 10, browser e2e 21).
- nova-llm/: our own tokenizer (tested) + PyTorch model/training (untested here). docs/RESEARCH.md.

## NOVA's own models
- nova-llm/: NOVA Mini v2 (2.4M params, checkpoints/nova-mini-v2-r4.pt) is live in models/nova-mini;
  v1 kept at checkpoints/nova-mini-step450.pt. Data split train/val/test by answer (data/MANIFEST.json);
  test set only for final comparisons. train2.py + evaluate2.py; reports in nova-llm/reports/.
- nova-gen/: tiny image/video diffusion prototypes (shapes only), NOT shown as a product.
- Team training: TRAINING.md (root). Team data in nova-llm/data/contrib/*.jsonl (check_contrib.py);
  pipeline.py (train+evaluate+export), promote.py (team lead), checkpoints/LIVE.txt = live model.
- Owner wants the vault and its API keys KEPT. Independent mode is optional and off by default.

## Versioning — bump on every app change
- sw.js `CACHE = "mkai-vNNN"` and `?v=NNN` on scripts/styles in index.html and vault.html.
- Current version: v102. New files must be added to the sw.js precache list.

## Workflow the owner expects
1. Develop on branch `claude/repo-integration-sn5fit`, test (Playwright + Firebase emulators,
   project `demo-mkai`), scan for secrets, commit, push.
2. Merge into `main` (`git merge --no-ff`) and push main — GitHub Pages updates from main.
3. Deploy to Firebase ONLY when the owner says "make it live" / "deploy".

## Deploying to Firebase
- Key: env var `FIREBASE_SERVICE_ACCOUNT` (service-account JSON; may be raw JSON starting
  with `{` or base64). Write it to a temp file outside the repo, set
  GOOGLE_APPLICATION_CREDENTIALS, run
  `npx firebase-tools deploy --only hosting --project mkai-c042b --non-interactive`, delete the file.
- Alternative: GitHub Actions workflow "Deploy to Firebase" (.github/workflows/firebase-deploy.yml,
  manual run) using the repo secret `FIREBASE_SERVICE_ACCOUNT`.
- Firebase serves v102 (deployed 2026-11-17): Workspace, Image Studio, Independent mode, NOVA Mini v2.

## Ideas mentioned but not done
- Making the GitHub repo private (only the owner can: Settings → Change visibility).
