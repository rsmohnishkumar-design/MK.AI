import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendEmailVerification,
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
  Timestamp,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { configured, auth, db, friendlyError } from "./firebase.js";
import { keywords, votes } from "./brain.js";
import { TRIAL_HOURS } from "../firebase-config.js";

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
    await user.reload(); // pick up a just-clicked verification link
    if (!user.emailVerified) {
      loginError.textContent = "Verify your email first — check your inbox for the link from Firebase.";
      resendBtn.classList.remove("hidden");
      return;
    }
    await user.getIdToken(true); // make sure the token knows the email is verified
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
        `used ${entry.uses || 1}× · 👍 ${up} · 👎 ${down}` + (entry.timeSensitive ? " · time-sensitive" : "");
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
