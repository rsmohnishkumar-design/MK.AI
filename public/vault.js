const loginScreen = document.getElementById("loginScreen");
const vaultScreen = document.getElementById("vaultScreen");
const loginForm = document.getElementById("loginForm");
const passcodeInput = document.getElementById("passcodeInput");
const loginError = document.getElementById("loginError");
const addForm = document.getElementById("addForm");
const newQuestion = document.getElementById("newQuestion");
const newAnswer = document.getElementById("newAnswer");
const vaultList = document.getElementById("vaultList");
const learnedList = document.getElementById("learnedList");
const vaultCount = document.getElementById("vaultCount");
const learnedCount = document.getElementById("learnedCount");
const entryRowTpl = document.getElementById("entry-row");
const activityBody = document.getElementById("activityBody");
const activityCount = document.getElementById("activityCount");
const storageBadge = document.getElementById("storageBadge");
const refreshActivityBtn = document.getElementById("refreshActivity");
const usersBody = document.getElementById("usersBody");
const usersCount = document.getElementById("usersCount");

let passcode = sessionStorage.getItem("vaultPasscode") || "";

function api(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-vault-passcode": passcode,
      ...(options.headers || {}),
    },
  });
}

async function tryEnter(code) {
  const res = await fetch("/api/vault/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode: code }),
  });
  if (!res.ok) return false;
  passcode = code;
  sessionStorage.setItem("vaultPasscode", code);
  return true;
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const ok = await tryEnter(passcodeInput.value);
  if (ok) {
    showVault();
  } else {
    loginError.textContent = "Wrong passcode.";
  }
});

function showVault() {
  loginScreen.classList.add("hidden");
  vaultScreen.classList.remove("hidden");
  loadEntries();
  loadActivity();
  loadUsers();
}

function renderList(container, entries, kind) {
  container.innerHTML = "";
  if (!entries.length) {
    const note = document.createElement("p");
    note.className = "empty-col-note";
    note.textContent = kind === "vault" ? "Nothing here yet." : "Nothing learned yet — ask it something new in the chat.";
    container.appendChild(note);
    return;
  }

  entries
    .slice()
    .reverse()
    .forEach((entry) => {
      const node = entryRowTpl.content.cloneNode(true);
      node.querySelector(".entry-q").textContent = entry.question;
      node.querySelector(".entry-a").textContent = entry.answer;
      const actions = node.querySelector(".entry-actions");

      if (kind === "learned") {
        const stats = document.createElement("span");
        stats.className = "entry-stats";
        stats.textContent =
          `used ${entry.uses || 1}× · 👍 ${entry.upvotes || 0} · 👎 ${entry.downvotes || 0}` +
          (entry.timeSensitive ? " · time-sensitive" : "");
        actions.appendChild(stats);
      }

      if (kind === "vault") {
        const editBtn = document.createElement("button");
        editBtn.textContent = "edit";
        editBtn.onclick = () => editVaultEntry(entry);
        actions.appendChild(editBtn);

        const delBtn = document.createElement("button");
        delBtn.textContent = "delete";
        delBtn.className = "danger";
        delBtn.onclick = () => deleteVaultEntry(entry.id);
        actions.appendChild(delBtn);
      } else {
        const promoteBtn = document.createElement("button");
        promoteBtn.textContent = "promote to vault";
        promoteBtn.onclick = () => promoteLearned(entry.id);
        actions.appendChild(promoteBtn);

        const delBtn = document.createElement("button");
        delBtn.textContent = "delete";
        delBtn.className = "danger";
        delBtn.onclick = () => deleteLearned(entry.id);
        actions.appendChild(delBtn);
      }

      container.appendChild(node);
    });
}

async function loadEntries() {
  const res = await api("/api/vault/entries");
  if (!res.ok) return;
  const data = await res.json();
  vaultCount.textContent = `(${data.vault.length})`;
  learnedCount.textContent = `(${data.learned.length})`;
  renderList(vaultList, data.vault, "vault");
  renderList(learnedList, data.learned, "learned");
}

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = newQuestion.value.trim();
  const answer = newAnswer.value.trim();
  if (!question || !answer) return;

  await api("/api/vault/entries", {
    method: "POST",
    body: JSON.stringify({ question, answer }),
  });

  newQuestion.value = "";
  newAnswer.value = "";
  loadEntries();
});

async function editVaultEntry(entry) {
  const question = prompt("Question:", entry.question);
  if (question === null) return;
  const answer = prompt("Answer:", entry.answer);
  if (answer === null) return;

  await api(`/api/vault/entries/${entry.id}`, {
    method: "PUT",
    body: JSON.stringify({ question, answer }),
  });
  loadEntries();
}

async function deleteVaultEntry(id) {
  if (!confirm("Delete this entry?")) return;
  await api(`/api/vault/entries/${id}`, { method: "DELETE" });
  loadEntries();
}

async function deleteLearned(id) {
  if (!confirm("Delete this memory?")) return;
  await api(`/api/vault/learned/${id}`, { method: "DELETE" });
  loadEntries();
}

async function promoteLearned(id) {
  await api(`/api/vault/learned/${id}/promote`, { method: "POST" });
  loadEntries();
}

// --- Activity log ---
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function badgeFor(row) {
  if (row.mode === "memory" && row.source === "vault") return '<span class="badge badge-vault">vault</span>';
  if (row.mode === "memory" && row.source === "learned") return '<span class="badge badge-learned">memory</span>';
  if (row.mode === "search") return '<span class="badge badge-google">google search</span>';
  if (row.mode === "ai") return '<span class="badge badge-google">ai answer</span>';
  if (row.mode === "feedback") return `<span class="badge badge-learned">${row.source === "up" ? "👍 helpful" : "👎 unhelpful"}</span>`;
  return '<span class="badge badge-error">error</span>';
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadActivity() {
  const res = await api("/api/vault/activity?limit=300");
  if (!res.ok) return;
  const data = await res.json();

  activityCount.textContent = `(${data.activity.length})`;
  storageBadge.textContent = data.storage === "firebase" ? "firestore" : "local file";

  activityBody.innerHTML = "";
  if (!data.activity.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="5" class="empty-col-note">Nothing asked yet.</td>`;
    activityBody.appendChild(row);
    return;
  }

  data.activity.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="time">${formatTime(row.createdAt)}</td>
      <td class="ip">${escapeHtml(row.email || "—")}</td>
      <td class="ip">${escapeHtml(row.ip || "—")}</td>
      <td class="question">${escapeHtml(row.question || "")}</td>
      <td>${badgeFor(row)}</td>
    `;
    activityBody.appendChild(tr);
  });
}

refreshActivityBtn.addEventListener("click", loadActivity);

// --- Registered users ---
function tierLabel(user) {
  if (user.tier === "unlimited") return '<span class="badge badge-vault">unlimited</span>';
  const msLeft = user.expiresAt ? new Date(user.expiresAt).getTime() - Date.now() : -1;
  if (msLeft <= 0) return '<span class="badge badge-error">expired</span>';
  const h = Math.floor(msLeft / 3600000);
  const m = Math.floor((msLeft % 3600000) / 60000);
  return `<span class="badge badge-learned">trial · ${h}h ${m}m left</span>`;
}

async function loadUsers() {
  const res = await api("/api/vault/users");
  if (!res.ok) return;
  const data = await res.json();

  usersCount.textContent = `(${data.users.length})`;
  usersBody.innerHTML = "";

  if (!data.users.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="4" class="empty-col-note">No one has signed up yet.</td>`;
    usersBody.appendChild(row);
    return;
  }

  data.users
    .slice()
    .reverse()
    .forEach((user) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="question">${escapeHtml(user.email)}</td>
        <td>${tierLabel(user)}</td>
        <td class="time">${formatTime(user.createdAt)}</td>
        <td></td>
      `;
      const actionsCell = tr.querySelector("td:last-child");
      actionsCell.style.cssText = "display:flex;gap:8px;";

      if (user.tier !== "unlimited") {
        const upgradeBtn = document.createElement("button");
        upgradeBtn.textContent = "grant unlimited";
        upgradeBtn.style.cssText =
          "background:transparent;border:1px solid var(--panel-border);font-family:var(--font-mono);font-size:11px;padding:4px 10px;border-radius:3px;cursor:pointer;color:var(--brass);";
        upgradeBtn.onclick = async () => {
          await api(`/api/vault/users/${user.id}/upgrade`, { method: "POST" });
          loadUsers();
        };
        actionsCell.appendChild(upgradeBtn);
      }

      const delBtn = document.createElement("button");
      delBtn.textContent = "revoke";
      delBtn.style.cssText =
        "background:transparent;border:1px solid var(--panel-border);font-family:var(--font-mono);font-size:11px;padding:4px 10px;border-radius:3px;cursor:pointer;color:var(--paper-dim);";
      delBtn.onclick = async () => {
        if (!confirm(`Revoke access for ${user.email}?`)) return;
        await api(`/api/vault/users/${user.id}`, { method: "DELETE" });
        loadUsers();
      };
      actionsCell.appendChild(delBtn);

      usersBody.appendChild(tr);
    });
}

// If a passcode is already remembered for this tab session, skip straight in.
if (passcode) {
  api("/api/vault/entries").then((res) => {
    if (res.ok) showVault();
  });
}
