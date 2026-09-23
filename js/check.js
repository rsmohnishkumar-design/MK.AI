// Diagnostics: runs each step MK.ai depends on, one at a time, with timings.
import { getToken } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getGenerativeModel } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js";
import { configured, auth, db, ai, appCheck } from "./firebase.js";
import { GEMINI_MODELS, GROQ_MODELS } from "../firebase-config.js";

const list = document.getElementById("steps");

function row(name) {
  const li = document.createElement("li");
  li.className = "wait";
  li.innerHTML = `<span class="status">running…</span><span class="name"></span><div class="detail"></div>`;
  li.querySelector(".name").textContent = name;
  list.appendChild(li);
  return li;
}

function finish(li, ok, status, detail = "") {
  li.className = ok ? "ok" : "bad";
  li.querySelector(".status").textContent = status;
  li.querySelector(".detail").textContent = detail;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`no answer after ${ms / 1000}s`)), ms)),
  ]);
}

function describe(err) {
  const status = err?.customErrorData?.status ? `[${err.customErrorData.status}] ` : "";
  return (status + (err?.message || String(err))).replace(/Error fetching from \S+/, "").slice(0, 400);
}

async function step(name, fn, timeoutMs = 25000) {
  const li = row(name);
  const started = performance.now();
  try {
    const detail = await withTimeout(fn(), timeoutMs);
    finish(li, true, `✓ ${Math.round(performance.now() - started)} ms`, detail || "");
    return true;
  } catch (err) {
    finish(li, false, `✗ ${Math.round(performance.now() - started)} ms`, describe(err));
    return false;
  }
}

async function run() {
  await step("Browser", async () => `${navigator.onLine ? "online" : "OFFLINE"} · ${navigator.userAgent}`);

  if (!configured) {
    finish(row("Firebase config"), false, "✗", "firebase-config.js isn't filled in");
    return;
  }

  await step("App Check token (reCAPTCHA)", async () => {
    if (!appCheck) throw new Error("App Check isn't set up (no RECAPTCHA_SITE_KEY)");
    const { token } = await getToken(appCheck, true);
    return `got a token (${token.length} characters)`;
  });

  const user = await withTimeout(
    new Promise((resolve) => onAuthStateChanged(auth, resolve)),
    8000
  ).catch(() => null);

  await step("Logged in", async () => {
    if (!user) throw new Error("not logged in — log in on the chat page first, then reopen this page");
    return user.email;
  });

  if (user) {
    await step("Database (your profile)", async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      return snap.exists() ? `tier: ${snap.data().tier}` : "no profile yet";
    });
  }

  const ask = (model, search) => async () => {
    const m = getGenerativeModel(ai, { model, ...(search ? { tools: [{ googleSearch: {} }] } : {}) });
    const { response } = await m.generateContent("Reply with just: OK", { timeout: 25000 });
    return `answered: ${(response.text() || "").trim().slice(0, 60)}`;
  };

  // Groq (main AI when a key is saved in the vault).
  let groqKey = null;
  if (user) {
    await step("Groq key (from the vault)", async () => {
      const snap = await getDoc(doc(db, "settings", "ai"));
      groqKey = snap.exists() ? snap.data().groqKey : null;
      if (!groqKey) throw new Error("no Groq key saved — add one in the vault's AI settings");
      return "saved";
    });
  }
  if (groqKey) {
    await Promise.all(
      GROQ_MODELS.map((model) =>
        step(`Groq: ${model}`, async () => {
          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply with just: OK" }], max_completion_tokens: 20 }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(`[${res.status}] ${body?.error?.message || ""}`);
          return `answered: ${(body.choices?.[0]?.message?.content || "").trim().slice(0, 60)}`;
        }, 30000)
      )
    );
  }

  // All models at once, so the whole check takes at most ~30 seconds.
  await Promise.all([
    ...GEMINI_MODELS.map((model) => step(`AI: ${model}`, ask(model, false), 30000)),
    step(`AI: ${GEMINI_MODELS[0]} + Google Search`, ask(GEMINI_MODELS[0], true), 30000),
  ]);

  const done = document.createElement("li");
  done.className = "ok";
  done.innerHTML = `<span class="name">All checks finished — take a screenshot.</span>`;
  list.appendChild(done);
}

run();
