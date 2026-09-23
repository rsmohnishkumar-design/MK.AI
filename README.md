# MK.ai — an AI assistant that learns from every conversation

An installable web app (PWA) that runs entirely on free services: the
site is hosted on **GitHub Pages**, and **Firebase** (free Spark plan,
no card) handles logins, the database and the AI (Google Gemini).

People sign up with an email and password and ask anything. Gemini
writes the answer, running a Google search itself when a question needs
current facts. Only the answer is shown.

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
   two lines near the top:
   - `your-email@example.com` → your own email, in lowercase (this
     makes you the admin)
   - `change-this-code` → a secret access code for unlimited use
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

### 6. Open your app

Go to **https://rsmohnishkumar-design.github.io/MK.AI/** and sign up
using the admin email from step 3. Firebase emails you a verification
link — click it. That's it.

- **Install it:** on Android, tap **Install app** in the header (or the
  browser menu → **Add to Home screen**). On iPhone, Share → **Add to
  Home Screen**.
- **Open the admin vault:** tap the **§** mark at the top left 7 times
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

## Files

| File | What it does |
| --- | --- |
| `index.html`, `style.css`, `js/app.js` | The chat app |
| `js/brain.js` | Memory: matching questions, learning, votes |
| `js/ai.js` | Asking Gemini |
| `js/firebase.js`, `firebase-config.js` | Connecting to your Firebase project (and App Check) |
| `vault.html`, `vault.css`, `js/vault.js` | The admin vault |
| `firestore.rules` | Database security rules (paste into Firebase) |
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
- **Free-tier limits.** Firebase's free plan caps AI requests and
  database reads per day, which is plenty for personal use. If you hit
  the cap, MK.ai says it's busy and to try again later.
- **Google Search suggestions.** When an answer used Google Search,
  Google requires apps to show its small search-suggestion chip under
  the answer, so it appears there.
