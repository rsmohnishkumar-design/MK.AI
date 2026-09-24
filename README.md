# MK.ai — an AI assistant that learns from every conversation

An installable web app (PWA) that runs entirely on free services, no card
needed: the site is hosted on **GitHub Pages**, and **Firebase** (free Spark
plan) handles logins and the database.

**MK.ai answers everything itself.** People never talk to an outside AI:
answers come only from what MK.ai knows and can read. Outside AI services
(Gemini, and Groq, Cerebras, OpenRouter or GitHub Models if you add a key)
are used only in the admin **Training room**, as a helper that drafts
answers for you to approve.

People sign up with an email and password and ask anything. MK.ai
answers in this order, stopping at the first that works:

1. **Curated answers** in the vault (taught and approved in the Training room).
2. **Its own brain**, instantly and on the device: greetings (including
   vanakkam and namaste), small talk, who it is, jokes, the time and date,
   maths ("12 x 7", "15% of 200", "squre root of 81") with typos allowed,
   and a full maths solver that works problems out step by step: equations
   (one or two unknowns, quadratics), fractions, HCF/LCM, primes, factors,
   percentages, simple and compound interest, profit/loss/discount, averages
   and statistics, ratios, speed/distance/time, work, consecutive numbers,
   sequences (AP/GP), combinations, logarithms, trigonometry, number systems,
   Roman numerals, Pythagoras, areas and volumes, clock angles, cubic and
   quartic equations, inequalities, differentiation and integration of
   polynomials, matrices, probability, expanding brackets, identities and
   numbers in words, multiplication tables, calendar (day of the week, days
   between dates, leap years), decimals/fractions/percentages, rounding,
   surds and roots, coordinate geometry, time/data/area/volume units, and
   exam classics (unitary method, successive discounts, trains, boats,
   ages, average speed), and advanced maths: derivatives and integrals of
   any functions (trig, exponential, log; product, quotient and chain rules,
   substitution, by parts, partial fractions), limits (L'Hôpital), tangents,
   maxima and minima, simple differential equations, complex numbers,
   systems of 3+ equations, vectors, matrix products/transpose/rank/
   eigenvalues, factorising, binomial expansions, infinite series,
   Fibonacci, arrangements, and equations with logs, powers, trig and
   absolute values, science numericals worked with units (force, motion
   and free fall, energy, work, power, pressure, density, springs,
   circular motion, electricity and bills, resistors in series/parallel,
   waves, lenses, pendulums, heat) and chemistry (molar mass, moles,
   molecules, percentage composition, balancing equations),
   unit conversions ("10 km to miles") and coding basics ("what is a loop?").
   The knowledge base adds coding how-tos with working code in Python,
   JavaScript, HTML/CSS, Java, C, C++ and SQL, plus data structures,
   algorithms and common error messages.
3. **Its app builder**: ask "make a calculator app", "create a snake game"
   or "rock paper scissors in python" and it writes a complete, tested
   program. Web apps get a **▶ run** button (they run in a sealed-off frame
   that can't touch MK.ai's data) and **⬇ download** saves any code as a file.
4. **Its knowledge base** (`data/kb/`): thousands of checked answers that ship
   with the app, then **memory**: everything it has learned or been taught
   before, matched by meaning.
5. **Your documents**: it reads the documents taught in the Training room and
   picks out the sentences that answer the question.
6. **Wikipedia**: "what is / who is" questions get the article's opening;
   other factual questions ("how tall is Mount Everest?") are answered by
   reading the best article and picking out the answering sentences.
7. Otherwise it says it doesn't know yet, puts the question on its
   **learning list** (Training room → Learn from users), and shows a
   **"Teach MK.ai"** box. Whatever someone teaches it is remembered for everyone.

**Normal and Deep think.** A switch under the message box picks how MK.ai
answers. **⚡ Normal** gives the first good answer instantly. **🧠 Deep think**
takes more care: it works out what kind of question it is, answers each
part of a multi-part question separately, double-checks maths a second way
(putting solutions back into the equation, comparing a derivative with the
measured slope, re-working sums), adds related facts it knows, and searches
again with just the core words before giving up. Its steps are shown in a
folded "🧠 Thought for …" list on the answer. The choice is remembered on
the device. (`js/deepthink.js`)

Follow-up questions ("what about its population?") are looked up together
with the topic of the previous question. Text and code files sent with the
paperclip are read by MK.ai itself (it finds the answering sentences, or
summarises the file).

MK.ai gets better the more it's used:

- **Remembers answers.** Taught and Wikipedia answers are saved. When
  someone asks the same thing again (typos and rewording are fine), it
  answers instantly from memory.
- **Learns from 👍 / 👎.** Upvoted answers are trusted more and never
  expire. A downvoted answer is never reused.
- **Learns from people's questions.** The Training room lists what it
  couldn't answer, grouped however it was worded, so you can teach it.
- **Knows what goes stale.** Questions about "today", prices, weather,
  news and so on are never answered from old memory.

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

### 6. Add a free AI key (optional — a helper for the Training room)

The Training room uses an AI to draft answers for you to approve. Gemini's
free tier allows only a few dozen a day; a key from one of these free
services (no card needed) gives it more. The chat never uses them:

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
  quickly, and log in with the admin account. The account verified as the
  creator (see "Creator mode") is an admin too.

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

## Training room (admin vault)

MK.ai learns by analysing what people give it. At the top of the admin vault:

- **Learn from users.** MK.ai analyses the last 1,000 questions people
  asked: how many it answered by itself, what people ask about most, and a
  list of questions it should learn (the ones it couldn't answer first,
  then the ones asked again and again, grouped however they were worded).
  Tick some and tap **Prepare answers with AI**: it writes an answer for
  each, using what it already knows and your documents.
- **Bulk answers.** Paste or upload many questions and answers at once:
  `Q:` / `A:` blocks, `question | answer` lines, or a CSV from a
  spreadsheet.
- **Learn from documents.** Paste text or upload a .txt, .md or .pdf (notes,
  a chapter, a handbook). **Learn this document** stores it in passages
  (`knowledge` collection). MK.ai finds the passages that match a question
  and answers from them; with no AI free, it quotes the passage. **Make Q&A
  with AI** turns the document into question/answer pairs.

Everything prepared waits in **Ready for you to approve**: edit, untick
what's wrong, and save. Saved answers go into the vault and are used
straight away.

## Neural memory

A small sentence-embedding model (all-MiniLM-L6-v2,
about 23 MB, via Transformers.js) loads quietly in the background, so memory
matches questions by meaning: "how tall is Everest" finds the saved answer
to "height of Mount Everest", credited "from memory of a similar question".
Look-alike questions are kept apart: they must share half their key words
and the same numbers. On data-saver connections it stays off, and memory
uses word matching.

## Voice

Tap the **mic** next to the send button and speak: the words appear as you
talk and the question is sent when you stop. Answers to spoken questions are
read aloud, and every answer has a **listen** button. Tamil is used when the
conversation is in Tamil. Code is described ("the code is shown on screen")
rather than read out. The mic only shows in browsers that support voice
typing (Chrome, Edge, Safari).

## Photos and files

Tap the **paperclip** (or paste a picture, or drag a file onto the chat on
a laptop) to ask about a **photo** (homework, a diagram, a screenshot), a
**PDF**, or a **text or code file** (up to 8 MB). Photos are shrunk on the
device before sending. Photos and PDFs are read by Gemini, which can see
them; text files are added to the question so every AI service can answer.
Follow-ups like "what about question 2?" keep using the chat's last file.
Answers about files aren't saved to the shared memory, and the file itself
isn't stored in the chat history (only its name).

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
| `js/wiki.js` | Knowledge questions from Wikipedia |
| `js/mathsolve.js`, `js/mathword.js`, `js/mathplus.js`, `js/mathextra.js` | The maths solver: equations, numbers, word problems and higher maths, step by step |
| `js/apps.js`, `data/apps.json`, `apps-src/` | The app builder: 32 tested web apps and 13 Python programs it writes on request ("make a snake game"); edit a template in `apps-src/` and run `python3 apps-src/bundle.py` |
| `js/deepthink.js` | Deep think: question type, splitting multi-part questions, double-checking maths |
| `js/science.js` | Physics numericals with units, and chemistry: molar mass, moles, % composition, balancing equations |
| `js/symbolic.js`, `js/mathadvanced.js` | Advanced maths: a symbolic engine (parse, simplify, differentiate, integrate) and calculus, complex numbers, vectors, matrices, series |
| `js/kb.js`, `data/kb/` | The built-in knowledge base |
| `js/algebra.js` | Two-number word problems and quadratic equations, step by step |
| `js/reader.js` | MK.ai's own reading: picking the answering sentences, summaries |
| `learn.html`, `js/knowledge.js` | Code School, and the coding answers MK.ai knows by itself |
| `js/meaning.js` | Neural (meaning) memory |
| `js/voice.js` | Voice typing and reading answers aloud |
| `js/attach.js` | Photos, PDFs and text files sent with a question |
| `js/training.js` | The Training room: analysing questions, bulk answers, documents |
| `js/creator.js` | Creator mode: the secret-code check and the details report |
| `js/ai.js` | Outside AI helpers, used only in the Training room |
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
