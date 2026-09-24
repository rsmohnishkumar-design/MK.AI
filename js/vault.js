import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  deleteField,
  Timestamp,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { configured, auth, db, friendlyError } from "./firebase.js";
import { keywords, votes, lookup } from "./brain.js";
import { askGemini, aiErrorMessage } from "./ai.js";
import { readAttachment } from "./attach.js";
import * as training from "./training.js";
import { TRIAL_HOURS } from "../firebase-config.js";
import { PROVIDERS, keyField, listModels, chooseModels, quickChat } from "./providers.js";

const $ = (id) => document.getElementById(id);
const loginScreen = $("loginScreen");
const vaultScreen = $("vaultScreen");
const loginForm = $("loginForm");
const emailInput = $("emailInput");
const passwordInput = $("passwordInput");
const loginError = $("loginError");
const resendBtn = $("resendBtn");
const addForm = $("addForm");
const newQuestion = $("newQuestion");
const newAnswer = $("newAnswer");
const vaultList = $("vaultList");
const learnedList = $("learnedList");
const vaultCount = $("vaultCount");
const learnedCount = $("learnedCount");
const entryRowTpl = $("entry-row");
const activityBody = $("activityBody");
const activityCount = $("activityCount");
const refreshActivityBtn = $("refreshActivity");
const usersBody = $("usersBody");
const usersCount = $("usersCount");

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function showError(err) {
  alert(friendlyError(err));
}

if (!configured) {
  loginError.textContent = "MK.ai isn't connected to Firebase yet — fill in firebase-config.js first.";
  loginForm.classList.add("hidden");
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
  } catch (err) {
    loginError.textContent = friendlyError(err);
  }
});

resendBtn.addEventListener("click", async () => {
  try {
    await sendEmailVerification(auth.currentUser);
    loginError.textContent = "Verification email sent — click the link in it, then log in again.";
  } catch (err) {
    loginError.textContent = friendlyError(err);
  }
});

$("signOutBtn").addEventListener("click", () => signOut(auth));

// Emails a password-reset link to the address typed in the email box.
async function sendReset(emailInput, messageEl) {
  const email = emailInput.value.trim();
  if (!email) {
    messageEl.textContent = "Type your email above first, then tap Forgot password.";
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    messageEl.textContent = `If ${email} has an account, a reset link is on its way — check your inbox and spam folder.`;
  } catch (err) {
    messageEl.textContent = friendlyError(err);
  }
}
$("forgotBtn").addEventListener("click", () => sendReset(emailInput, loginError));

// The security rules decide who the admin is; reading the activity log is the test.
async function isAdmin() {
  try {
    await getDocs(query(collection(db, "activity"), limit(1)));
    return true;
  } catch {
    return false;
  }
}

if (configured) {
  onAuthStateChanged(auth, async (user) => {
    resendBtn.classList.add("hidden");
    if (!user) {
      vaultScreen.classList.add("hidden");
      loginScreen.classList.remove("hidden");
      return;
    }
    // The security rules decide who the admin is (by email).
    if (!(await isAdmin())) {
      loginError.textContent =
        `You were signed in as ${user.email}, which isn't an admin. Log in below with the admin email, ` +
        `or open the chat with your own account, say "I created you" and enter the creator code: the creator is an admin too.`;
      await signOut(auth);
      return;
    }
    loginScreen.classList.add("hidden");
    vaultScreen.classList.remove("hidden");
    loadEntries();
    loadActivity();
    loadUsers();
    loadGroqKey();
    loadTraining();
    loadDocuments();
  });
}

// --- Vault and learned memory ---
function renderList(container, entries, kind) {
  container.innerHTML = "";
  if (!entries.length) {
    const note = document.createElement("p");
    note.className = "empty-col-note";
    note.textContent = kind === "vault" ? "Nothing here yet." : "Nothing learned yet — ask it something new in the chat.";
    container.appendChild(note);
    return;
  }

  entries.forEach((entry) => {
    const node = entryRowTpl.content.cloneNode(true);
    node.querySelector(".entry-q").textContent = entry.question;
    node.querySelector(".entry-a").textContent = entry.answer;
    const actions = node.querySelector(".entry-actions");

    const button = (label, onClick, danger = false) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      if (danger) btn.className = "danger";
      btn.onclick = onClick;
      actions.appendChild(btn);
    };

    if (kind === "vault") {
      button("edit", () => editVaultEntry(entry));
      button("delete", () => deleteEntry("vault", entry.id, "Delete this entry?"), true);
    } else {
      const { up, down } = votes(entry);
      const stats = document.createElement("span");
      stats.className = "entry-stats";
      stats.textContent =
        `${entry.source === "taught" ? "taught by a person · " : entry.source === "wikipedia" ? "from Wikipedia · " : ""}` +
        `used ${entry.uses || 1}× · 👍 ${up} · 👎 ${down}` +
        (entry.timeSensitive ? " · time-sensitive" : "");
      actions.appendChild(stats);
      button("promote to vault", () => promoteLearned(entry));
      button("delete", () => deleteEntry("learned", entry.id, "Delete this memory?"), true);
    }

    container.appendChild(node);
  });
}

async function loadEntries() {
  try {
    const [vaultSnap, learnedSnap] = await Promise.all([
      getDocs(query(collection(db, "vault"), orderBy("createdAt", "desc"))),
      getDocs(query(collection(db, "learned"), orderBy("createdAt", "desc"), limit(300))),
    ]);
    const vault = vaultSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const learned = learnedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    vaultCount.textContent = `(${vault.length})`;
    learnedCount.textContent = `(${learned.length})`;
    renderList(vaultList, vault, "vault");
    renderList(learnedList, learned, "learned");
  } catch (err) {
    showError(err);
  }
}

function vaultFields(question, answer) {
  return { question, answer, keywords: keywords(question).slice(0, 50), updatedAt: serverTimestamp() };
}

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = newQuestion.value.trim();
  const answer = newAnswer.value.trim();
  if (!question || !answer) return;
  try {
    await addDoc(collection(db, "vault"), { ...vaultFields(question, answer), createdAt: serverTimestamp() });
    newQuestion.value = "";
    newAnswer.value = "";
    loadEntries();
  } catch (err) {
    showError(err);
  }
});

async function editVaultEntry(entry) {
  const question = prompt("Question:", entry.question);
  if (question === null) return;
  const answer = prompt("Answer:", entry.answer);
  if (answer === null) return;
  try {
    await updateDoc(doc(db, "vault", entry.id), vaultFields(question.trim(), answer.trim()));
    loadEntries();
  } catch (err) {
    showError(err);
  }
}

async function deleteEntry(collectionName, id, message) {
  if (!confirm(message)) return;
  try {
    await deleteDoc(doc(db, collectionName, id));
    loadEntries();
  } catch (err) {
    showError(err);
  }
}

async function promoteLearned(entry) {
  try {
    await addDoc(collection(db, "vault"), {
      ...vaultFields(entry.question, entry.answer),
      createdAt: serverTimestamp(),
    });
    await deleteDoc(doc(db, "learned", entry.id));
    loadEntries();
  } catch (err) {
    showError(err);
  }
}

// --- Activity log ---
function badgeFor(mode) {
  if (mode === "vault") return '<span class="badge badge-vault">vault</span>';
  if (mode === "memory") return '<span class="badge badge-learned">memory</span>';
  if (mode === "ai") return '<span class="badge badge-google">ai answer</span>';
  if (mode === "local") return '<span class="badge badge-vault">own brain</span>';
  if (mode === "wiki") return '<span class="badge badge-google">wikipedia</span>';
  if (mode === "taught") return '<span class="badge badge-learned">taught</span>';
  if (mode === "unknown") return '<span class="badge badge-error">didn\'t know</span>';
  if (mode === "document") return '<span class="badge badge-learned">your documents</span>';
  if (mode === "knowledge") return '<span class="badge badge-vault">knowledge base</span>';
  if (mode === "app") return '<span class="badge badge-vault">app builder</span>';
  if (mode === "file") return '<span class="badge badge-google">photo / file</span>';
  if (mode === "creator") return '<span class="badge badge-vault">creator</span>';
  return `<span class="badge badge-error">${escapeHtml(mode || "?")}</span>`;
}

function formatTime(ts) {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function loadActivity() {
  try {
    const snap = await getDocs(query(collection(db, "activity"), orderBy("createdAt", "desc"), limit(300)));
    activityCount.textContent = `(${snap.size})`;
    activityBody.innerHTML = "";
    if (snap.empty) {
      activityBody.innerHTML = `<tr><td colspan="4" class="empty-col-note">Nothing asked yet.</td></tr>`;
      return;
    }
    snap.docs.forEach((d) => {
      const row = d.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="time">${formatTime(row.createdAt)}</td>
        <td class="ip">${escapeHtml(row.email || "—")}</td>
        <td class="question">${escapeHtml(row.question || "")}</td>
        <td>${badgeFor(row.mode)}</td>
      `;
      activityBody.appendChild(tr);
    });
  } catch (err) {
    showError(err);
  }
}

refreshActivityBtn.addEventListener("click", loadActivity);

// --- Registered users ---
function tierLabel(user) {
  if (user.tier === "unlimited") return '<span class="badge badge-vault">unlimited</span>';
  if (user.tier !== "trial") return '<span class="badge badge-error">blocked</span>';
  const msLeft = user.expiresAt ? user.expiresAt.toMillis() - Date.now() : -1;
  if (msLeft <= 0) return '<span class="badge badge-error">expired</span>';
  const h = Math.floor(msLeft / 3600000);
  const m = Math.floor((msLeft % 3600000) / 60000);
  return `<span class="badge badge-learned">trial · ${h}h ${m}m left</span>`;
}

const smallButtonStyle =
  "background:transparent;border:1px solid var(--panel-border);font-family:var(--font-mono);font-size:11px;padding:4px 10px;border-radius:3px;cursor:pointer;";

async function setTier(id, fields) {
  try {
    await updateDoc(doc(db, "users", id), fields);
    loadUsers();
  } catch (err) {
    showError(err);
  }
}

async function loadUsers() {
  try {
    const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")));
    usersCount.textContent = `(${snap.size})`;
    usersBody.innerHTML = "";
    if (snap.empty) {
      usersBody.innerHTML = `<tr><td colspan="4" class="empty-col-note">No one has signed up yet.</td></tr>`;
      return;
    }

    snap.docs.forEach((d) => {
      const user = { id: d.id, ...d.data() };
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="question">${escapeHtml(user.email)}</td>
        <td>${tierLabel(user)}</td>
        <td class="time">${formatTime(user.createdAt)}</td>
        <td></td>
      `;
      const cell = tr.querySelector("td:last-child");
      cell.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";

      const add = (label, color, onClick) => {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.style.cssText = smallButtonStyle + `color:${color};`;
        btn.onclick = onClick;
        cell.appendChild(btn);
      };

      if (user.tier !== "unlimited") {
        add("grant unlimited", "var(--brass)", () => setTier(user.id, { tier: "unlimited", expiresAt: null }));
      }
      add("new trial", "var(--paper-dim)", () =>
        setTier(user.id, {
          tier: "trial",
          expiresAt: Timestamp.fromMillis(Date.now() + TRIAL_HOURS * 3600000),
        })
      );
      if (user.tier !== "blocked") {
        add("block", "var(--error)", () => {
          if (confirm(`Turn off access for ${user.email}?`)) setTier(user.id, { tier: "blocked", expiresAt: null });
        });
      }

      usersBody.appendChild(tr);
    });
  } catch (err) {
    showError(err);
  }
}

// --- AI settings: keys for the free AI services ---
const providerRows = $("providerRows");
const settingsRef = () => doc(db, "settings", "ai");

function providerRow(provider, savedKey) {
  const row = document.createElement("div");
  row.className = "provider-row";
  row.innerHTML = `
    <h3><span class="provider-name"></span> <span class="provider-status"></span></h3>
    <p class="col-hint provider-signup"></p>
    <form class="groq-form">
      <input type="password" autocomplete="off" />
      <button type="submit">Save key</button>
      <button type="button" class="secondary test-btn">Test</button>
      <button type="button" class="secondary danger remove-btn">Remove</button>
    </form>
    <p class="col-hint provider-message"></p>
  `;
  row.querySelector(".provider-name").textContent = provider.name;
  row.querySelector(".provider-status").textContent = savedKey ? "· key saved" : "";
  row.querySelector(".provider-signup").textContent = `Get a free key: ${provider.signup}`;
  const input = row.querySelector("input");
  input.placeholder = `${provider.name} key`;
  input.value = savedKey || "";
  const message = row.querySelector(".provider-message");

  // Checks the key: first the service's model list, and if the browser isn't
  // allowed to read that, a tiny real question to the first preferred model.
  const test = async () => {
    const key = input.value.trim();
    try {
      return chooseModels(provider, await listModels(provider, key));
    } catch (err) {
      if (!/failed to fetch|network|load failed/i.test(err.message)) throw err;
      try {
        await quickChat(provider, key, provider.prefer[0]);
        return provider.prefer;
      } catch (err2) {
        if (/failed to fetch|network|load failed/i.test(err2.message)) {
          throw new Error(
            `${provider.name} doesn't allow requests from websites (the browser blocked it), so MK.ai can't use it. Try another service above — OpenRouter works from websites.`
          );
        }
        throw err2;
      }
    }
  };

  row.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const key = input.value.trim();
    if (!key) return;
    message.textContent = `Checking the key with ${provider.name}…`;
    try {
      const models = await test();
      await setDoc(settingsRef(), { [keyField(provider)]: key, updatedAt: serverTimestamp() }, { merge: true });
      message.textContent = `Saved. The key works — MK.ai will use: ${models.join(", ") || "its default models"}.`;
      row.querySelector(".provider-status").textContent = "· key saved";
    } catch (err) {
      message.textContent = `Not saved: ${err.message || friendlyError(err)}`;
    }
  });

  row.querySelector(".test-btn").addEventListener("click", async () => {
    if (!input.value.trim()) {
      message.textContent = "Paste a key first.";
      return;
    }
    message.textContent = "Testing…";
    try {
      const models = await test();
      message.textContent = `Works. MK.ai would use: ${models.join(", ") || "its default models"}.`;
    } catch (err) {
      message.textContent = err.message;
    }
  });

  row.querySelector(".remove-btn").addEventListener("click", async () => {
    if (!confirm(`Remove the ${provider.name} key?`)) return;
    try {
      await setDoc(settingsRef(), { [keyField(provider)]: deleteField(), updatedAt: serverTimestamp() }, { merge: true });
      input.value = "";
      row.querySelector(".provider-status").textContent = "";
      message.textContent = "Removed.";
    } catch (err) {
      message.textContent = friendlyError(err);
    }
  });

  return row;
}

async function loadGroqKey() {
  let data = {};
  try {
    const snap = await getDoc(settingsRef());
    data = snap.exists() ? snap.data() : {};
  } catch (err) {
    providerRows.textContent =
      "Couldn't read AI settings — republish firestore.rules from the repo (it includes a settings rule). " +
      friendlyError(err);
    return;
  }
  providerRows.innerHTML = "";
  PROVIDERS.forEach((p) => providerRows.appendChild(providerRow(p, data[keyField(p)])));
}

// ---------------------------------------------------------------------------
// Training room: MK.ai learns from people's questions, bulk answer lists and
// documents. Everything it prepares is reviewed here before it's saved.
// ---------------------------------------------------------------------------
const setStatus = (id, text, tone = "") => {
  const el = $(id);
  el.textContent = text;
  el.className = `train-status ${tone}`;
};

document.querySelectorAll(".train-tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    document.querySelectorAll(".train-tab").forEach((t) => {
      t.classList.toggle("active", t === tab);
      t.setAttribute("aria-selected", String(t === tab));
    });
    ["users", "bulk", "docs"].forEach((name) => $(`tab-${name}`).classList.toggle("hidden", name !== tab.dataset.tab));
  })
);

// Saves many documents in batches (Firestore allows 500 writes per batch).
async function saveInBatches(items, write) {
  for (let i = 0; i < items.length; i += 400) {
    const batch = writeBatch(db);
    items.slice(i, i + 400).forEach((item) => write(batch, item));
    await batch.commit();
  }
}

// --- Review: approve what MK.ai prepared ---
let reviewItems = [];
function setReview(pairs, note = "") {
  reviewItems = pairs.map((p) => ({ ...p, keep: true }));
  const list = $("reviewList");
  list.innerHTML = "";
  reviewItems.forEach((item) => {
    const row = document.createElement("div");
    row.className = "review-row";
    row.innerHTML = `<input type="checkbox" checked aria-label="Keep this answer" /><div class="fields"><input type="text" aria-label="Question" /><textarea aria-label="Answer"></textarea></div>`;
    const [box, q, a] = row.querySelectorAll("input, textarea");
    q.value = item.question;
    a.value = item.answer;
    box.addEventListener("change", () => {
      item.keep = box.checked;
      row.classList.toggle("off", !box.checked);
      renderReviewCount();
    });
    q.addEventListener("input", () => (item.question = q.value));
    a.addEventListener("input", () => (item.answer = a.value));
    list.appendChild(row);
  });
  $("review").classList.toggle("hidden", !reviewItems.length);
  setStatus("reviewStatus", note);
  renderReviewCount();
  if (reviewItems.length) $("review").scrollIntoView({ behavior: "smooth", block: "start" });
}
function renderReviewCount() {
  $("reviewCount").textContent = `(${reviewItems.filter((i) => i.keep).length} of ${reviewItems.length})`;
}
$("reviewDiscard").addEventListener("click", () => setReview([]));
$("reviewSave").addEventListener("click", async () => {
  const keep = reviewItems.filter((i) => i.keep && i.question.trim() && i.answer.trim());
  if (!keep.length) return setStatus("reviewStatus", "Nothing ticked to save.", "bad");
  $("reviewSave").disabled = true;
  try {
    await saveInBatches(keep, (batch, item) =>
      batch.set(doc(collection(db, "vault")), { ...vaultFields(item.question.trim(), item.answer.trim()), createdAt: serverTimestamp() })
    );
    setReview([]);
    setStatus("prepareStatus", `✓ MK.ai learned ${keep.length} answer${keep.length === 1 ? "" : "s"}. It uses them from now on.`, "good");
    setStatus("bulkStatus", "");
    loadEntries();
    loadTraining();
  } catch (err) {
    setStatus("reviewStatus", friendlyError(err), "bad");
  } finally {
    $("reviewSave").disabled = false;
  }
});

// --- Learn from users: analyse what people asked ---
let needs = [];
async function loadTraining() {
  try {
    const [activitySnap, vaultSnap] = await Promise.all([
      getDocs(query(collection(db, "activity"), orderBy("createdAt", "desc"), limit(1000))),
      getDocs(collection(db, "vault")),
    ]);
    const analysis = training.analyseActivity(
      activitySnap.docs.map((d) => d.data()),
      vaultSnap.docs.map((d) => d.data().question || "")
    );
    const m = analysis.modes;
    const selfAnswered = ["local", "memory", "vault", "document", "creator", "knowledge", "app", "wiki", "file"].reduce((n, k) => n + (m[k] || 0), 0);
    const stat = (value, label) => `<div class="train-stat"><b>${value}</b><span>${label}</span></div>`;
    $("trainStats").innerHTML =
      stat(analysis.total, "questions analysed") +
      stat(analysis.distinct, "different questions") +
      stat(analysis.total ? `${Math.round((selfAnswered / analysis.total) * 100)}%` : "–", "answered by MK.ai itself") +
      stat(m.unknown || 0, "it didn't know");
    $("trainTopics").innerHTML = analysis.topics.length
      ? `What people ask about most: ${analysis.topics.map(([w, n]) => `<b>${escapeHtml(w)}</b> (${n})`).join(", ")}`
      : "";
    needs = analysis.needs.slice(0, 60);
    $("needsCount").textContent = `(${needs.length})`;
    const list = $("needsList");
    list.innerHTML = needs.length ? "" : `<p class="empty-col-note">Nothing to learn right now. As people ask questions, MK.ai lists what it should learn here.</p>`;
    needs.forEach((need, i) => {
      const row = document.createElement("label");
      row.className = "need-row";
      row.innerHTML = `<input type="checkbox" ${i < 15 ? "checked" : ""} /><span class="need-q"></span><span class="need-meta"></span>`;
      row.querySelector(".need-q").textContent = need.question;
      const meta = row.querySelector(".need-meta");
      meta.textContent = `${need.unknown ? "didn't know · " : ""}asked ${need.count}×${need.people > 1 ? ` by ${need.people}` : ""}`;
      meta.classList.toggle("unknown", need.unknown > 0);
      row.querySelector("input").addEventListener("change", (e) => (need.picked = e.target.checked));
      need.picked = i < 15;
      list.appendChild(row);
    });
  } catch (err) {
    setStatus("prepareStatus", friendlyError(err), "bad");
  }
}
$("reanalyseBtn").addEventListener("click", loadTraining);

$("prepareBtn").addEventListener("click", async () => {
  const picked = needs.filter((n) => n.picked);
  if (!picked.length) return setStatus("prepareStatus", "Tick at least one question first.", "bad");
  $("prepareBtn").disabled = true;
  const ready = [];
  let failed = 0;
  for (const [i, need] of picked.entries()) {
    setStatus("prepareStatus", `Writing answer ${i + 1} of ${picked.length}…`);
    try {
      // What MK.ai already knows (including taught documents) goes in as background.
      const { knowledge } = await lookup(need.question).catch(() => ({ knowledge: { good: [], bad: [] } }));
      const result = await askGemini(need.question, [], knowledge);
      if (result.answer && !result.partial) ready.push({ question: need.question, answer: result.answer });
      else failed++;
    } catch (err) {
      failed++;
      console.warn("Couldn't prepare an answer:", aiErrorMessage(err));
      if (/resting|quota|used up/i.test(aiErrorMessage(err))) break;
    }
  }
  $("prepareBtn").disabled = false;
  setStatus(
    "prepareStatus",
    ready.length
      ? `${ready.length} answer${ready.length === 1 ? "" : "s"} ready below.${failed ? ` ${failed} couldn't be written (the AI may be busy) — try those again later.` : ""}`
      : "The AI couldn't write answers right now (it may be busy or used up for today). Try again later.",
    ready.length ? "good" : "bad"
  );
  setReview(ready);
});

// --- Bulk answers ---
$("bulkFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  $("bulkText").value = await file.text();
  e.target.value = "";
  $("bulkCheckBtn").click();
});
$("bulkCheckBtn").addEventListener("click", () => {
  const pairs = training.parsePairs($("bulkText").value);
  if (!pairs.length) {
    return setStatus("bulkStatus", "No questions and answers found. Check the format examples above.", "bad");
  }
  setStatus("bulkStatus", `Found ${pairs.length} question${pairs.length === 1 ? "" : "s"} and answers. Review them below.`, "good");
  setReview(pairs);
});

// --- Learn from documents ---
let docPdf = null;
$("docFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (!$("docTitle").value.trim()) $("docTitle").value = file.name.replace(/\.[^.]+$/, "");
  try {
    if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
      docPdf = await readAttachment(file);
      $("docText").value = "";
      $("docText").placeholder = `PDF ready: ${file.name}. MK.ai will read it when you tap a button below.`;
      setStatus("docStatus", `PDF ready: ${file.name}`, "good");
    } else {
      docPdf = null;
      $("docText").value = await file.text();
      setStatus("docStatus", "");
    }
  } catch (err) {
    setStatus("docStatus", err.friendly ? err.message : "That file couldn't be read.", "bad");
  }
});
$("docText").addEventListener("input", () => {
  if ($("docText").value.trim()) docPdf = null;
});

// The document's text: typed/pasted, or read out of the PDF by the AI.
async function documentText() {
  const typed = $("docText").value.trim();
  if (typed) return typed;
  if (!docPdf) return "";
  setStatus("docStatus", "Reading the PDF…");
  const result = await askGemini(training.TEXT_FROM_DOCUMENT, [], { good: [], bad: [] }, () => {}, { attachment: docPdf });
  return result.answer.trim();
}

$("docLearnBtn").addEventListener("click", async () => {
  const title = $("docTitle").value.trim() || "Untitled document";
  $("docLearnBtn").disabled = true;
  try {
    const text = await documentText();
    if (!text) return setStatus("docStatus", "Paste some text or upload a file first.", "bad");
    const chunks = training.chunkText(text);
    const docId = Date.now().toString(36);
    await saveInBatches(chunks, (batch, chunk) =>
      batch.set(doc(collection(db, "knowledge")), {
        title: title.slice(0, 200),
        text: chunk,
        keywords: training.chunkKeywords(`${title} ${chunk}`),
        docId,
        createdAt: serverTimestamp(),
      })
    );
    setStatus("docStatus", `✓ MK.ai learned "${title}" (${chunks.length} passage${chunks.length === 1 ? "" : "s"}). It answers questions about it from now on.`, "good");
    loadDocuments();
  } catch (err) {
    setStatus("docStatus", /permission/i.test(String(err?.code || err)) ? "The database rules need updating before MK.ai can learn documents (see the README)." : aiErrorMessage(err), "bad");
  } finally {
    $("docLearnBtn").disabled = false;
  }
});

$("docQaBtn").addEventListener("click", async () => {
  const title = $("docTitle").value.trim() || "the document";
  $("docQaBtn").disabled = true;
  setStatus("docStatus", "MK.ai is reading the document and writing questions and answers…");
  try {
    const typed = $("docText").value.trim();
    const attachment = typed ? { kind: "text", name: title, text: typed } : docPdf;
    if (!attachment) return setStatus("docStatus", "Paste some text or upload a file first.", "bad");
    const result = await askGemini(training.QA_FROM_DOCUMENT(20), [], { good: [], bad: [] }, () => {}, { attachment });
    const pairs = training.readPairsJson(result.answer);
    if (!pairs.length) return setStatus("docStatus", "The AI's reply couldn't be read as questions and answers. Try again.", "bad");
    setStatus("docStatus", `${pairs.length} questions and answers ready below.`, "good");
    setReview(pairs);
  } catch (err) {
    setStatus("docStatus", aiErrorMessage(err), "bad");
  } finally {
    $("docQaBtn").disabled = false;
  }
});

async function loadDocuments() {
  try {
    const snap = await getDocs(query(collection(db, "knowledge"), orderBy("createdAt", "desc"), limit(2000)));
    const docs = new Map();
    snap.docs.forEach((d) => {
      const data = d.data();
      const key = data.docId || data.title;
      const entry = docs.get(key) || { title: data.title, createdAt: data.createdAt, ids: [] };
      entry.ids.push(d.id);
      docs.set(key, entry);
    });
    $("docsCount").textContent = `(${docs.size})`;
    const list = $("docsList");
    list.innerHTML = docs.size ? "" : `<p class="empty-col-note">No documents yet.</p>`;
    docs.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "doc-row";
      row.innerHTML = `<span class="need-q"><b></b></span><span class="need-meta"></span><button type="button">delete</button>`;
      row.querySelector("b").textContent = entry.title;
      row.querySelector(".need-meta").textContent = `${entry.ids.length} passage${entry.ids.length === 1 ? "" : "s"} · ${formatTime(entry.createdAt)}`;
      row.querySelector("button").addEventListener("click", async () => {
        if (!confirm(`Make MK.ai forget "${entry.title}"?`)) return;
        try {
          await saveInBatches(entry.ids, (batch, id) => batch.delete(doc(db, "knowledge", id)));
          loadDocuments();
        } catch (err) {
          showError(err);
        }
      });
      list.appendChild(row);
    });
  } catch (err) {
    $("docsList").innerHTML = `<p class="empty-col-note">${/permission/i.test(String(err?.code)) ? "Publish the updated database rules to use documents." : escapeHtml(friendlyError(err))}</p>`;
  }
}
