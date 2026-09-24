# MK.ai — an AI assistant that learns from every conversation

An installable web app (PWA) that runs entirely on free services, no card
needed: the site is hosted on **GitHub Pages**, **Firebase** (free Spark
plan) handles logins and the database, and answers come from free AI
services — **Groq, Cerebras, OpenRouter or GitHub Models**, whichever you
add a key for — with **Google Gemini** as a backup.

People sign up with an email and password and ask anything. MK.ai
answers in this order, stopping at the first that works:

1. **Curated answers** you added in the admin vault.
2. **Its own brain**, instantly and on the device: greetings (including
   vanakkam and namaste), small talk, who it is, jokes, the time and date,
   maths ("12 x 7", "15% of 200", "square root of 81") and unit
   conversions ("10 km to miles", "37 c to f").
3. **Memory**: everything it has learned or been taught before.
4. **Wikipedia**, for simple "what is / who is / explain" questions (free,
   no account; answers are credited "from Wikipedia").
5. **Outside AI services**, if any are set up and have free allowance left.
6. Otherwise it says it doesn't know yet and shows a **"Teach MK.ai"** box.
   Whatever someone teaches it is remembered for everyone.

MK.ai gets better the more it's used:

- **Remembers answers.** Every new answer is saved. When someone asks
  the same thing again (typos and rewording are fine), it answers
  instantly from memory without calling the AI.
- **Learns from 👍 / 👎.** Upvoted answers are trusted more and never
  expire. A downvoted answer is never reused; next time, the AI is
  shown the bad answer and told to do better.
- **Uses what it knows.** Related things it has learned, and anything
  you teach it in the vault, are handed to the AI as background.
- **Knows what goes stale.** Questions about "today", prices, weather,
  news and so on are always answered fresh, and unconfirmed memories are
  re-checked after 45 days.

## One-time setup (about 15 minutes, all free)

### 1. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
   and tap **Create a project**. Any name works (e.g. `mk-ai`). You can
   turn Google Analytics off.
2. On the project home page, tap the **Web** icon (`</>`) to add a web
   app. Give it a nickname and tap **Register app**.
3. Firebase shows a `firebaseConfig = { ... }` block. Copy those values
   into [`firebase-config.js`](firebase-config.js) in this repo (on
   GitHub: open the file → pencil icon → edit → **Commit changes**).
   These values are safe to publish.

### 2. Turn on logins

1. In Firebase, open **Build → Authentication → Get started**.
2. Under **Sign-in method**, choose **Email/Password**, switch it on,
   and **Save**.
3. Open the **Settings** tab → **Authorized domains** → **Add domain**
   and add `rsmohnishkumar-design.github.io`.

### 3. Create the database

1. Open **Build → Firestore Database → Create database**. Pick a
   location near you and start in **production mode**.
2. Open the **Rules** tab and replace everything with the contents of
   [`firestore.rules`](firestore.rules). Before publishing, change the
   three lines near the top:
   - `your-email@example.com` → your own email, in lowercase (this
     makes you the admin)
   - `change-this-code` → a secret access code for unlimited use
   - `change-this-creator-code` → the creator's secret code (see
     "Creator mode" below)
3. Tap **Publish**.

### 4. Turn on the AI

1. Open **Build → AI Logic → Get started**.
2. Choose the **Gemini Developer API** (it has a free tier) and follow
   the prompts to enable it.

### 5. Turn on App Check (required for the AI)

Firebase AI Logic only answers requests that prove they come from your
website. This uses a free reCAPTCHA key (reCAPTCHA Enterprise).

1. Go to [google.com/recaptcha/admin/create](https://www.google.com/recaptcha/admin/create).
   Give it any label, choose **Score based (v3)**, add the domain
   `rsmohnishkumar-design.github.io`, pick your Firebase project under
   **Google Cloud Platform**, and submit. Copy the **site key**.
2. In Firebase, open **Security → App Check → Apps**, pick your web app,
   choose **reCAPTCHA Enterprise**, paste the **site key**, and **Save**.
3. Put the same **site key** into `RECAPTCHA_SITE_KEY` in
   [`firebase-config.js`](firebase-config.js).
4. In **App Check → APIs**, find **Firebase AI Logic** and tap
   **Enforce**.

### 6. Add a free AI key (recommended — the main AI)

Gemini's free tier allows only a few dozen answers a day. Add a key from
at least one of these free services (no card needed); MK.ai uses every
key you save, in this order:

| Service | How to get a key |
| --- | --- |
| **Groq** | [console.groq.com](https://console.groq.com) → API Keys → Create API Key |
| **Cerebras** | [cloud.cerebras.ai](https://cloud.cerebras.ai) → API Keys |
| **OpenRouter** | [openrouter.ai](https://openrouter.ai) → Sign in (GitHub works) → Keys → Create Key. Only its free models are used. |
| **GitHub Models** | No new account: [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new) → any name → Permissions → **Models: Read-only** → Generate token |

Then open MK.ai's admin vault (step 7), paste the key into its box under
**AI settings** and tap **Save key**. Each key is checked with its service
before saving, and MK.ai picks the models that service offers you.

Keys are stored in your database, readable only by signed-in members with
access — never in the public code (GitHub would detect keys there and the
service would cancel them). If your Firestore rules were published before
this feature, republish [`firestore.rules`](firestore.rules) (with your
email and code) so the vault can save keys.

### 7. Open your app

Go to **https://rsmohnishkumar-design.github.io/MK.AI/** and sign up
using the admin email from step 3. That's it.

- **Install it:** on Android, tap **Install app** in the header (or the
  browser menu → **Add to Home screen**). On iPhone, Share → **Add to
  Home Screen**.
- **Open the admin vault:** tap the **MK** logo at the top left 7 times
  quickly, and log in with the admin account.

## Accounts and access

- Every new account gets a **3-hour trial**.
- Anyone who enters the **access code** (on sign-up or at login) gets
  unlimited use.
- In the vault you can grant unlimited access, start a new trial, or
  block an account.

## The admin vault

- **Curated answers:** add question/answer pairs. MK.ai answers from
  these first, and follows them when writing related answers.
- **Self-taught memory:** everything it has learned, with how often each
  answer was reused and how people voted. Promote good answers to the
  vault, delete bad ones.
- **Users** and **activity:** everyone's account and every question
  asked.

## Code School

`learn.html` (the **Learn to code** button in the sidebar) teaches coding
fundamentals in 11 short lessons, explained through how MK.ai itself works:
code you can edit and run, live demos and a quiz per lesson. Signed-in
people's progress is saved to their account (`users/<uid>/progress/learn`).

MK.ai's own brain also answers coding questions instantly, like "what is a
variable?", "explain loops" or "what is git?", with a small example and a
link to the matching lesson (`js/knowledge.js`).

## Creator mode

Say **"I created you"** (or "I'm your creator") in the chat and MK.ai asks
for the secret creator code. The code is checked by the database rules, so
it never appears in the public code; what you type is hidden as dots and
never saved or logged. Three wrong tries lock the check for 15 minutes on
that device.

Once verified, the account is marked as the creator on every device:
MK.ai greets you by name (`CREATOR_NAME`), the badge shows 👑, and
**"show your details"** gives a full report: what it has learned (and from
where), curated answers, saved AI services, and your account.

## Chats

Each person's chats are listed in the sidebar and saved in the database
(`users/<uid>/chats`), so they follow them to any device and update live
across open devices. A copy is kept on the device so chats appear
instantly. Only the owner can read their chats — not even the admin
vault shows them.

## Files

| File | What it does |
| --- | --- |
| `index.html`, `style.css`, `js/app.js` | The chat app |
| `js/brain.js` | Memory: matching questions, learning, votes |
| `js/local.js` | MK.ai's own brain: greetings, small talk, time, maths, conversions |
| `js/wiki.js` | Simple knowledge questions from Wikipedia |
| `learn.html`, `js/knowledge.js` | Code School, and the coding answers MK.ai knows by itself |
| `js/creator.js` | Creator mode: the secret-code check and the details report |
| `js/ai.js` | Asking outside AI services (saved keys first, then Gemini) |
| `js/providers.js` | The free AI services and their models |
| `js/firebase.js`, `firebase-config.js` | Connecting to your Firebase project (and App Check) |
| `vault.html`, `vault.css`, `js/vault.js` | The admin vault |
| `firestore.rules` | Database security rules (paste into Firebase) |
| `check.html`, `js/check.js` | Tests each part (App Check, login, database, every AI model) |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installable app and offline support |

## Honest limitations

- **Word matching, not meaning.** Memory matches questions that share
  their key words (typos and small rewording are fine), so a completely
  reworded question goes to the AI instead. It still gets a good answer;
  it just isn't instant. Firebase's free AI service has no embedding
  (meaning-matching) feature.
- **It doesn't retrain the model.** Teaching an AI model itself needs
  huge datasets and specialised hardware. MK.ai improves the way most
  AI products do: by remembering good answers, learning from feedback,
  and feeding what it knows back into the model.
- **Trials are enforced by the database.** An expired trial account
  can't save anything, and the app locks the chat. App Check stops other
  websites from using your AI, but someone on your own site who knows
  what they're doing could still call the AI directly.
- **Free-tier limits.** Every free AI service has daily limits. MK.ai
  tries every saved service's models (see `js/providers.js`), then
  Gemini's (`GEMINI_MODELS`),
  and skips any that are used up, retired or overloaded for a while, so
  the allowances add up. Answers from memory cost nothing. Open
  `check.html` on your site to see which models are answering right now.
- **AI keys are visible to members.** Anyone signed in with access could
  extract them from their browser. The worst they could do is use up your
  free allowance (no card is attached, so it can't cost money); you can
  create a new key and save it in the vault anytime.
- **Google Search suggestions.** When an answer used Google Search,
  Google requires apps to show its small search-suggestion chip under
  the answer, so it appears there.
