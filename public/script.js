// --- Auth screens/elements ---
const authScreen = document.getElementById("authScreen");
const chatScreen = document.getElementById("chatScreen");
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authCode = document.getElementById("authCode");
const authSubmit = document.getElementById("authSubmit");
const authError = document.getElementById("authError");
const tabLogin = document.getElementById("tabLogin");
const tabSignup = document.getElementById("tabSignup");
const signOutBtn = document.getElementById("signOutBtn");
const tierBadge = document.getElementById("tierBadge");

let authMode = "login"; // or "signup"

function setAuthMode(mode) {
  authMode = mode;
  const isLogin = mode === "login";
  tabLogin.classList.toggle("active", isLogin);
  tabSignup.classList.toggle("active", !isLogin);
  authSubmit.textContent = isLogin ? "Log in" : "Create account";
  authPassword.autocomplete = isLogin ? "current-password" : "new-password";
  authError.textContent = "";
}
tabLogin.addEventListener("click", () => setAuthMode("login"));
tabSignup.addEventListener("click", () => setAuthMode("signup"));

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  authSubmit.disabled = true;

  try {
    const res = await fetch(`/api/auth/${authMode === "login" ? "login" : "signup"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        email: authEmail.value.trim(),
        password: authPassword.value,
        accessCode: authCode.value.trim(),
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      authError.textContent = data.error || "Something went wrong.";
      return;
    }

    showChat(data);
  } catch {
    authError.textContent = "Couldn't reach the server. Is it running?";
  } finally {
    authSubmit.disabled = false;
  }
});

signOutBtn.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  location.reload();
});

let trialTimer = null;

function renderTier(tier, expiresAt) {
  clearInterval(trialTimer);

  if (tier === "unlimited") {
    tierBadge.textContent = "unlimited";
    tierBadge.className = "tier-badge unlimited";
    return;
  }

  const update = () => {
    const msLeft = new Date(expiresAt).getTime() - Date.now();
    if (msLeft <= 0) {
      tierBadge.textContent = "trial expired";
      tierBadge.className = "tier-badge expired";
      clearInterval(trialTimer);
      lockChatExpired();
      return;
    }
    const h = Math.floor(msLeft / 3600000);
    const m = Math.floor((msLeft % 3600000) / 60000);
    tierBadge.textContent = `trial · ${h}h ${m}m left`;
    tierBadge.className = "tier-badge trial";
  };

  update();
  trialTimer = setInterval(update, 30000);
}

function lockChatExpired() {
  questionInput.disabled = true;
  sendBtn.disabled = true;
  questionInput.placeholder = "Your trial has ended — ask the admin for unlimited access.";
}

function showChat({ email, tier, expiresAt }) {
  authScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  signOutBtn.textContent = `sign out (${email})`;
  renderTier(tier, expiresAt);
  questionInput.focus();
}

function showAuth() {
  chatScreen.classList.add("hidden");
  authScreen.classList.remove("hidden");
  authPassword.value = "";
}

(async function checkSession() {
  try {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (res.ok) {
      const data = await res.json();
      showChat(data);
    } else {
      showAuth();
    }
  } catch {
    showAuth();
  }
})();

// --- Chat ---
const thread = document.getElementById("thread");
const emptyState = document.getElementById("emptyState");
const composer = document.getElementById("composer");
const questionInput = document.getElementById("question");
const sendBtn = document.getElementById("sendBtn");
const secretMark = document.getElementById("secretMark");

const tUser = document.getElementById("msg-user");
const tBot = document.getElementById("msg-bot");
const tAi = document.getElementById("msg-ai");

// Recent conversation, sent with each question so the AI can follow up.
const history = [];
const MAX_HISTORY = 12;
function remember(role, content) {
  history.push({ role, content });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
}
const tLoading = document.getElementById("msg-loading");
const tError = document.getElementById("msg-error");

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function addUserMessage(text) {
  const node = tUser.content.cloneNode(true);
  node.querySelector(".msg-body").textContent = text;
  thread.appendChild(node);
}

function addLoading() {
  const node = tLoading.content.cloneNode(true);
  thread.appendChild(node);
  return thread.lastElementChild;
}

function addBotMessage(results, note) {
  const node = tBot.content.cloneNode(true);
  const sourcesEl = node.querySelector(".sources");

  if (note) {
    const noteEl = document.createElement("p");
    noteEl.className = "results-note";
    noteEl.textContent = note;
    sourcesEl.appendChild(noteEl);
  }

  results.forEach((r) => {
    const row = document.createElement("div");
    row.className = "source-item";
    row.innerHTML = `
      <span class="source-index">[${r.index}]</span>
      <div class="source-body">
        <a class="source-title" href="${escapeHtml(r.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.title)}</a>
        <span class="source-link">${escapeHtml(r.link)}</span>
        ${r.snippet ? `<p class="source-snippet">${escapeHtml(r.snippet)}</p>` : ""}
      </div>
    `;
    sourcesEl.appendChild(row);
  });

  thread.appendChild(node);
}

function addAiMessage(answer, entryId) {
  const node = tAi.content.cloneNode(true);
  node.querySelector(".msg-body").textContent = answer;

  const actions = node.querySelector(".answer-actions");
  const copyBtn = actions.querySelector(".copy-btn");
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(answer);
      copyBtn.textContent = "copied";
      setTimeout(() => (copyBtn.textContent = "copy"), 1500);
    } catch {}
  });

  const voteButtons = actions.querySelectorAll(".vote-btn");
  if (!entryId) {
    voteButtons.forEach((b) => b.remove());
  } else {
    voteButtons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const vote = btn.dataset.vote;
        voteButtons.forEach((b) => b.classList.toggle("chosen", b === btn));
        try {
          await fetch("/api/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ entryId, vote }),
          });
        } catch {}
      });
    });
  }

  thread.appendChild(node);
}

function addErrorMessage(message) {
  const node = tError.content.cloneNode(true);
  node.querySelector(".msg-body").textContent = message;
  thread.appendChild(node);
}

function scrollToBottom() {
  thread.scrollTop = thread.scrollHeight;
}

composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = questionInput.value.trim();
  if (!question) return;

  if (emptyState) emptyState.remove();

  addUserMessage(question);
  questionInput.value = "";
  sendBtn.disabled = true;
  scrollToBottom();

  const loadingEl = addLoading();
  scrollToBottom();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ message: question, history }),
    });

    const data = await res.json();
    loadingEl.remove();

    if (res.status === 401) {
      addErrorMessage("Your session expired — signing you out.");
      setTimeout(() => location.reload(), 1200);
    } else if (res.status === 403 && data.error === "trial_expired") {
      addErrorMessage(data.message || "Your trial has ended.");
      lockChatExpired();
    } else if (!res.ok) {
      addErrorMessage(data.error || "Something went wrong.");
    } else if (data.mode === "ai") {
      addAiMessage(data.answer, data.entryId);
      remember("user", question);
      remember("assistant", data.answer);
    } else {
      addBotMessage(data.results || [], data.note);
    }
  } catch (err) {
    loadingEl.remove();
    addErrorMessage(navigator.onLine ? "Couldn't reach the server — please try again." : "You're offline — connect to the internet to ask.");
  } finally {
    sendBtn.disabled = false;
    questionInput.focus();
    scrollToBottom();
  }
});

// --- Hidden vault entrance: click the § mark 7 times within 3 seconds ---
let clickCount = 0;
let clickTimer = null;
secretMark.addEventListener("click", () => {
  clickCount += 1;
  clearTimeout(clickTimer);
  clickTimer = setTimeout(() => (clickCount = 0), 3000);

  if (clickCount >= 7) {
    clickCount = 0;
    window.location.href = "/vault";
  }
});

// --- Installable app (PWA) ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

const installBtn = document.getElementById("installBtn");
let installPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  installBtn.classList.remove("hidden");
});
installBtn.addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installBtn.classList.add("hidden");
});
window.addEventListener("appinstalled", () => installBtn.classList.add("hidden"));
