import "dotenv/config"; // first, so every module below sees .env values
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as brain from "./brain.js";
import * as ai from "./ai.js";
puppeteer.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const HEADLESS = process.env.HEADLESS !== "false"; // set HEADLESS=false to watch it work
const VAULT_PASSCODE = process.env.VAULT_PASSCODE || "changeme";
const ALLOW_SIGNUP = process.env.ALLOW_SIGNUP !== "false"; // set to "false" to close self-signup
const UNLIMITED_ACCESS_CODE = process.env.UNLIMITED_ACCESS_CODE || "6971";
const TRIAL_HOURS = Number(process.env.TRIAL_HOURS) || 3;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn(
    "⚠️  JWT_SECRET is not set in .env — using an insecure default. " +
      "Sessions will be invalidated every restart, and anyone who guesses the default can forge logins. " +
      "Set a real JWT_SECRET before putting this anywhere other people can reach."
  );
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || "insecure-dev-secret-change-me";
const COOKIE_NAME = "mkai_token";
const TOKEN_TTL = "30d";

// So req.ip reflects the real visitor when hosted behind a proxy/load balancer.
app.set("trust proxy", true);

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, EFFECTIVE_JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

// --- User auth: required to use the chat itself ---
function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Not signed in." });
  try {
    const payload = jwt.verify(token, EFFECTIVE_JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: "Session expired — please sign in again." });
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post("/api/auth/signup", async (req, res) => {
  try {
    if (!ALLOW_SIGNUP) {
      return res.status(403).json({ error: "New sign-ups are closed. Ask the admin for access." });
    }
    const { email, password, accessCode } = req.body || {};
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const existing = await brain.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }

    const unlimited = accessCode && accessCode === UNLIMITED_ACCESS_CODE;
    const tier = unlimited ? "unlimited" : "trial";
    const expiresAt = unlimited ? null : new Date(Date.now() + TRIAL_HOURS * 60 * 60 * 1000).toISOString();

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await brain.addUser(email.toLowerCase(), passwordHash, tier, expiresAt);

    setAuthCookie(res, signToken(user));
    res.json({ email: user.email, tier: user.tier, expiresAt: user.expiresAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't create the account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, accessCode } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    let user = await brain.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: "Wrong email or password." });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Wrong email or password." });

    // Entering the unlimited access code at login upgrades an existing account too.
    if (accessCode && accessCode === UNLIMITED_ACCESS_CODE && user.tier !== "unlimited") {
      user = await brain.updateUserTier(user.id, "unlimited", null);
    }

    setAuthCookie(res, signToken(user));
    res.json({ email: user.email, tier: user.tier, expiresAt: user.expiresAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't sign in." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const user = await brain.getUserByEmail(req.user.email);
  if (!user) return res.status(401).json({ error: "Account no longer exists." });
  res.json({ email: user.email, tier: user.tier, expiresAt: user.expiresAt });
});

// Blocks trial users once their window is up; unlimited accounts always pass.
async function enforceAccess(req, res, next) {
  const user = await brain.getUserByEmail(req.user.email);
  if (!user) return res.status(401).json({ error: "Account no longer exists." });

  if (user.tier !== "unlimited") {
    const expired = !user.expiresAt || Date.now() > new Date(user.expiresAt).getTime();
    if (expired) {
      return res.status(403).json({
        error: "trial_expired",
        message: `Your ${TRIAL_HOURS}-hour trial has ended. Ask the admin for unlimited access.`,
      });
    }
  }
  next();
}

// --- Vault auth: a simple shared passcode, checked on every vault request. ---
function requireVaultAuth(req, res, next) {
  const provided = req.get("x-vault-passcode");
  if (!provided || provided !== VAULT_PASSCODE) {
    return res.status(401).json({ error: "Wrong passcode." });
  }
  next();
}

// --- Browser automation (unchanged from before) ---
let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: HEADLESS,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserPromise;
}

async function searchGoogle(query) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    );

    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=8&hl=en`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });

    const blocked = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return (
        text.includes("unusual traffic") ||
        text.includes("verify you're a human") ||
        !!document.querySelector("form#captcha-form")
      );
    });
    if (blocked) {
      throw new Error(
        "Google blocked this automated request (it detected the headless browser). " +
          "This happens more with cloud-hosted IPs and frequent requests. Try again in a " +
          "moment, or run the server locally with HEADLESS=false to see what's happening."
      );
    }

    const results = await page.evaluate(() => {
      const blocks = Array.from(
        document.querySelectorAll("div#search div.g, div#search div[data-hveid]")
      );

      const seen = new Set();
      const out = [];

      for (const block of blocks) {
        const linkEl = block.querySelector("a[href^='http']");
        const titleEl = block.querySelector("h3");
        const snippetEl = block.querySelector("div[data-sncf], .VwiC3b, .IsZvec");

        if (!linkEl || !titleEl) continue;
        const link = linkEl.href;
        if (seen.has(link)) continue;
        seen.add(link);

        out.push({
          title: titleEl.innerText.trim(),
          link,
          snippet: snippetEl ? snippetEl.innerText.trim() : "",
        });

        if (out.length >= 6) break;
      }
      return out;
    });

    return results.map((r, i) => ({ index: i + 1, ...r }));
  } finally {
    await page.close();
  }
}

function safeLog(entry) {
  // Activity logging should never break the actual chat response.
  brain.logActivity(entry).catch((err) => console.error("Activity log failed:", err.message));
}

// --- AI mode: vault answers still win; otherwise search, then Claude writes the answer ---
async function answerWithAI(req, res, message) {
  const ip = req.ip;
  const email = req.user.email;

  const memory = await brain.recall(message);
  if (memory && memory.source === "vault") {
    safeLog({
      question: message,
      mode: "memory",
      source: "vault",
      confidence: Math.round(memory.similarity * 100),
      ip,
      email,
    });
    return res.json({
      mode: "memory",
      source: "vault",
      answer: memory.answer,
      matchedQuestion: memory.question,
      confidence: Math.round(memory.similarity * 100),
      sourceLink: null,
    });
  }

  let results = [];
  try {
    results = await searchGoogle(message);
  } catch (err) {
    // Google often blocks cloud servers; Claude then searches the web itself.
    console.warn("Google search failed, answering without it:", err.message);
  }

  const { answer, sources } = await ai.generateAnswer({
    question: message,
    history: req.body.history,
    results,
  });

  brain
    .rememberFromSearch(message, answer, sources[0]?.link || null)
    .catch((err) => console.error("Failed to save learned entry:", err.message));

  safeLog({ question: message, mode: "ai", source: results.length ? "google" : "web", resultCount: sources.length, ip, email });

  res.json({ mode: "ai", answer, results: sources });
}

// --- Chat endpoint: check memory first, fall back to a live search, then learn from it ---
app.post("/api/chat", requireAuth, enforceAccess, async (req, res) => {
  const { message } = req.body;
  const ip = req.ip;
  const email = req.user.email;

  try {
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing 'message' string in request body." });
    }

    if (ai.aiEnabled) {
      return await answerWithAI(req, res, message);
    }

    const memory = await brain.recall(message);
    if (memory) {
      safeLog({
        question: message,
        mode: "memory",
        source: memory.source,
        confidence: Math.round(memory.similarity * 100),
        ip,
        email,
      });

      return res.json({
        mode: "memory",
        source: memory.source, // "vault" (curated) or "learned" (self-taught)
        answer: memory.answer,
        matchedQuestion: memory.question,
        confidence: Math.round(memory.similarity * 100),
        sourceLink: memory.sourceLink || null,
      });
    }

    const results = await searchGoogle(message);

    if (!results.length) {
      safeLog({ question: message, mode: "search", source: "none", ip, email });
      return res.json({
        mode: "search",
        results: [],
        note: "No results came back — Google may have changed its page layout, or the query returned nothing.",
      });
    }

    // Teach itself: remember this question against the top result, so a
    // similar question next time can be answered from memory instantly.
    const top = results[0];
    brain
      .rememberFromSearch(message, `${top.title} — ${top.snippet}`.trim(), top.link)
      .catch((err) => console.error("Failed to save learned entry:", err.message));

    safeLog({ question: message, mode: "search", source: "google", resultCount: results.length, ip, email });

    res.json({ mode: "search", results, note: null });
  } catch (err) {
    console.error(err);
    safeLog({ question: message, mode: "error", source: "none", error: err.message, ip, email });
    res.status(500).json({ error: err.message || "Something went wrong." });
  }
});

// --- Vault routes (hidden admin room) ---
app.post("/api/vault/login", (req, res) => {
  const { passcode } = req.body || {};
  if (passcode === VAULT_PASSCODE) return res.json({ ok: true });
  res.status(401).json({ ok: false, error: "Wrong passcode." });
});

app.get("/api/vault/entries", requireVaultAuth, async (req, res) => {
  const [vault, learned] = await Promise.all([brain.listVault(), brain.listLearned()]);
  res.json({ vault, learned });
});

app.post("/api/vault/entries", requireVaultAuth, async (req, res) => {
  const { question, answer } = req.body || {};
  if (!question || !answer) {
    return res.status(400).json({ error: "Both 'question' and 'answer' are required." });
  }
  const entry = await brain.addVaultEntry(question.trim(), answer.trim());
  res.json({ entry });
});

app.put("/api/vault/entries/:id", requireVaultAuth, async (req, res) => {
  const { question, answer } = req.body || {};
  const entry = await brain.updateVaultEntry(req.params.id, question, answer);
  if (!entry) return res.status(404).json({ error: "Not found." });
  res.json({ entry });
});

app.delete("/api/vault/entries/:id", requireVaultAuth, async (req, res) => {
  await brain.deleteVaultEntry(req.params.id);
  res.json({ ok: true });
});

app.delete("/api/vault/learned/:id", requireVaultAuth, async (req, res) => {
  await brain.deleteLearnedEntry(req.params.id);
  res.json({ ok: true });
});

app.post("/api/vault/learned/:id/promote", requireVaultAuth, async (req, res) => {
  const entry = await brain.promoteLearnedEntry(req.params.id);
  if (!entry) return res.status(404).json({ error: "Not found." });
  res.json({ entry });
});

// Everyone's activity: what was asked, when, from where, by whom, and how it got answered.
app.get("/api/vault/activity", requireVaultAuth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
  const activity = await brain.getActivity(limit);
  res.json({ activity, storage: brain.storageKind });
});

// Registered accounts.
app.get("/api/vault/users", requireVaultAuth, async (req, res) => {
  const users = await brain.listUsers();
  res.json({ users });
});

app.delete("/api/vault/users/:id", requireVaultAuth, async (req, res) => {
  await brain.deleteUser(req.params.id);
  res.json({ ok: true });
});

app.post("/api/vault/users/:id/upgrade", requireVaultAuth, async (req, res) => {
  const user = await brain.updateUserTier(req.params.id, "unlimited", null);
  if (!user) return res.status(404).json({ error: "Not found." });
  res.json({ user });
});

app.post("/api/vault/users/:id/reset-trial", requireVaultAuth, async (req, res) => {
  const expiresAt = new Date(Date.now() + TRIAL_HOURS * 60 * 60 * 1000).toISOString();
  const user = await brain.updateUserTier(req.params.id, "trial", expiresAt);
  if (!user) return res.status(404).json({ error: "Not found." });
  res.json({ user });
});

process.on("SIGINT", async () => {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
  }
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`MK.ai running at http://localhost:${PORT}`);
});
