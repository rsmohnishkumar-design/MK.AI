// Diagnostics: runs each step MK.ai depends on, one at a time, with timings.
import { getToken } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getGenerativeModel } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js";
import { configured, auth, db, ai, appCheck } from "./firebase.js";
import { GEMINI_MODELS } from "../firebase-config.js";
import { PROVIDERS, keyField, listModels, chooseModels, quickChat } from "./providers.js";

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

  // Free AI services with a key saved in the vault.
  let keys = {};
  if (user) {
    await step("AI keys (from the vault)", async () => {
      const snap = await getDoc(doc(db, "settings", "ai"));
      const data = snap.exists() ? snap.data() : {};
      for (const p of PROVIDERS) if (data[keyField(p)]) keys[p.id] = data[keyField(p)];
      const names = PROVIDERS.filter((p) => keys[p.id]).map((p) => p.name);
      if (!names.length) throw new Error("no keys saved — add one in the vault's AI settings");
      return names.join(", ");
    });
  }
  await Promise.all(
    PROVIDERS.filter((p) => keys[p.id]).map(async (p) => {
      let models = p.prefer;
      const ok = await step(`${p.name}: key and models`, async () => {
        models = chooseModels(p, await listModels(p, keys[p.id]));
        return models.join(", ") || "no usable models found";
      });
      if (!ok) return;
      await Promise.all(
        models.slice(0, 2).map((m) => step(`${p.name}: ${m}`, async () => `answered: ${(await quickChat(p, keys[p.id], m)).slice(0, 60)}`, 30000))
      );
    })
  );

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
