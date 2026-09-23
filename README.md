# MK.ai — an AI assistant that learns from every conversation

An installable web app (PWA). People sign in with an email and password,
then ask it anything. **Google Gemini** writes the answers, running a
Google search itself whenever a question needs current facts. It shows
only the answer: no source lists or citation numbers. It follows the
conversation, so follow-up questions work.

MK.ai also gets better the more it's used:

- **Memory by meaning.** Every answer is saved with a "meaning
  fingerprint" (an embedding). A later question that means the same
  thing, even worded completely differently, is answered instantly from
  memory without calling the AI.
- **Learns from 👍 / 👎.** Each answer has helpful / not-helpful
  buttons. Upvoted answers are trusted more and never expire. A
  downvoted answer stops being reused; the next time someone asks,
  the AI is shown the bad answer and told to do better, and the new
  answer replaces it.
- **Uses what it knows.** Related things it has learned (and anything
  the admin taught it in the vault) are handed to the AI as background
  for new answers.
- **Knows what goes stale.** Questions about "today", prices, weather,
  news and so on are always answered fresh, and unconfirmed memories
  are re-checked after 45 days.

There's also a hidden, passcode-protected admin room where you can
teach it answers directly (those always win), see what it has learned
with use counts and votes, and see everyone's activity.

You need a Gemini API key (free tier, no card needed, from
https://aistudio.google.com/apikey). Without one, MK.ai falls back to
showing raw Google results. For a hosted deployment, set up Firebase
too (see "Storage") or everything it learns is lost on restart.

## Setup

```bash
npm install
cp .env.example .env
```

Open `.env` and set:

- `GEMINI_API_KEY` — turns on real AI answers
- `VAULT_PASSCODE` — locks the hidden admin room
- `JWT_SECRET` — signs everyone's login session; generate one with
  `openssl rand -hex 32` (or any long random string). Skipping this
  works for trying it out locally, but the server prints a warning
  and you should set a real one before anyone else uses it.

```bash
npm start
```

Then open http://localhost:3000

## Accounts

The chat itself is behind a login now, the same shape as any other AI
chat app: email + password, with a sign-up tab for new accounts.

- Passwords are hashed with bcrypt before they're ever stored — the
  plain password itself is never saved anywhere.
- A successful login sets an httpOnly session cookie, good for 30
  days.
- To close self-signup (so only accounts you create in the vault —
  see below — can log in), set `ALLOW_SIGNUP=false` in `.env`.
- You can revoke anyone's access instantly from the vault's
  **Registered users** panel — that deletes their account outright,
  they'd need to sign up again.

## Access tiers: unlimited vs. 3-hour trial

There's an access-code field on the sign-up (and login) form.

- Enter the code (`6971` by default — **change this in `.env` before
  giving this to anyone else**, since the default is right there in
  this repo) and that account gets **unlimited** access, no time
  limit.
- Leave it blank, or get it wrong, and the account still gets
  created — just as a **3-hour trial**. The header shows a live
  countdown (`trial · 2h 41m left`), and once it hits zero the chat
  locks with a message pointing them to the admin.
- The trial clock starts at signup and doesn't reset on its own.
- Entering the correct code again later while logging in to an
  existing trial account upgrades it to unlimited on the spot.

From the vault's **Registered users** panel you can also, per
account: **grant unlimited** (skip the code entirely) or **revoke**
access outright. There's no "reset trial" button in the UI by
default, but the server has the endpoint
(`POST /api/vault/users/:id/reset-trial`) if you want to wire up a
button for it later — the vault.js file has the same pattern as
"grant unlimited" to copy.

Change `TRIAL_HOURS` in `.env` if 3 hours isn't the window you want.

## How answering works, in order

1. **Vault check.** Did the admin teach it something with the same
   meaning? Answer from there.
2. **Memory check.** Has it already given a good answer to a question
   with the same meaning? Answer from there (skipped for time-sensitive
   questions, follow-ups that depend on the conversation, and answers
   people voted down).
3. **Ask the AI.** Gemini answers, using Google Search when needed plus
   related things MK.ai has learned. The answer is saved to memory so
   the next person gets it instantly.

## Install it as an app

Open the site on a phone and choose **Add to Home screen** (Android
Chrome also shows an **Install app** button in the header; on iPhone use
Share → Add to Home Screen). It then opens full-screen with its own
icon, like a native app. Installing needs the site served over HTTPS,
which Render and similar hosts provide automatically.

## The hidden vault

It's not linked anywhere in the chat UI. To get in:

- Click the **§** mark in the chat header **7 times within 3
  seconds** — it'll take you to `/vault`
- Or just go straight to `http://localhost:3000/vault`

Enter your `VAULT_PASSCODE` and you'll see:

- **Add to the vault** — type a question and the exact answer you
  want given back. These are checked first and matched loosely (typos
  and rephrasing are fine).
- **Curated entries** — everything you've manually added. Edit or
  delete anytime.
- **Self-taught memory** — everything it picked up on its own from
  search fallbacks. Promote good ones into the trusted vault, delete
  ones that turned out wrong.
- **Registered users** — everyone with an account, and when they
  joined. Revoke access with one click.
- **Activity** — every question anyone has asked the chat, in order,
  with a timestamp, who asked it (by email), their IP address, and
  how it got answered (from the vault, from memory, or a fresh Google
  search). This is the full audit trail — nothing asked in the chat is
  invisible to you here.

A privacy note: since the activity log records email addresses and IP
addresses, treat it like any other record of user activity — be
upfront with the people using this that it's kept, and handle it the
way your local privacy expectations (and, if relevant, laws like
GDPR/CCPA) require.

## Storage: local file or Firebase

**Use Firebase for any real deployment.** By default, everything
(accounts, vault entries, learned memory, activity log) is stored in a
`data/` folder as JSON files — nothing to set up, but
it only lives on that one machine's disk, and won't survive a
redeploy on hosts with an ephemeral filesystem (Render's free tier,
for instance).

To use **Firebase Firestore** instead — for real persistence, and so
the vault/activity data survives redeploys or scales across multiple
server instances — set three environment variables:

1. In the [Firebase console](https://console.firebase.google.com/),
   create a project (or use an existing one) and enable **Firestore
   Database**.
2. Go to **Project Settings → Service Accounts → Generate new private
   key**. This downloads a JSON file.
3. From that JSON, copy three values into your `.env`:

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n"
```

Keep the quotes and the `\n` sequences in `FIREBASE_PRIVATE_KEY`
exactly as they appear in the downloaded JSON — the server converts
them back into real newlines at startup.

That's it — the server detects those three variables on boot and
switches to Firestore automatically (you'll see a line in the
console log confirming which storage it picked). Leave them blank and
it just uses local files, no code changes needed either way.

Firestore's free (Spark) plan is plenty for a personal deployment.
MK.ai keeps its knowledge in memory after the first load, so it
doesn't re-read the whole database on every question.

## How the matching works

- **With a Gemini key**, questions are compared by meaning using
  Gemini embeddings (`gemini-embedding-001`), so "how tall is everest"
  matches "what's the height of mount everest". Stored answers from
  before this feature get their fingerprints filled in automatically
  on the next start.
- **Without embeddings**, it falls back to word matching: keyword
  overlap (ignoring filler words like "what" and "the") blended with
  typo-tolerant fuzzy matching from `fuse.js`.

What this *isn't* is retraining the AI model itself; that takes huge
datasets and specialised hardware. MK.ai improves the way most real AI
products do: by remembering good answers, learning from feedback, and
feeding what it knows back into the model.

## The honest limitations (carried over from before)

- These apply only to the fallback mode without a Gemini key, which
  scrapes Google with a headless browser.
- Scraping google.com isn't officially sanctioned and can get
  blocked, especially from cloud IPs or under frequent requests —
  the server detects this and reports it clearly rather than failing
  silently.
- Google's HTML changes over time, which can break the scraping
  selectors until they're updated.
- Puppeteer bundles a full Chromium build (~300 MB) and needs a host
  with enough memory (512 MB–1 GB+) to run it comfortably.
- The vault's passcode is basic protection — a single shared secret,
  no rate-limiting, no encryption. Fine for personal use; don't rely
  on it for anything sensitive.

## Data storage

Local mode: everything the vault, memory, users, and activity log
hold lives in `data/*.json` files, created automatically on first
run. All of it is in `.gitignore` alongside `.env` so none of it ships
if you push this to a repo.

Firebase mode: the same data lives in four Firestore collections —
`vault`, `learned`, `activity`, and `users` — under your project.
Manage or export it anytime from the Firebase console if you need to.
