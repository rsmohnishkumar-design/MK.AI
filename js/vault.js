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
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { configured, auth, db, friendlyError } from "./firebase.js";
import { keywords, votes } from "./brain.js";
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
      loginError.textContent = "This account isn't the admin. The admin email is set in firestore.rules.";
      await signOut(auth);
      return;
    }
    loginScreen.classList.add("hidden");
    vaultScreen.classList.remove("hidden");
    loadEntries();
    loadActivity();
    loadUsers();
    loadGroqKey();
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
