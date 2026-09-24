import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { configured, auth, db, friendlyError } from "./firebase.js";
import { lookup, learn, markUsed, vote, logActivity, dependsOnContext, isTimeSensitive } from "./brain.js";
import { askGemini, aiErrorMessage } from "./ai.js";
import { localAnswer } from "./local.js";
import { wikiAnswer, looksLikeKnowledgeQuestion } from "./wiki.js";
import { TRIAL_HOURS } from "../firebase-config.js";

const $ = (id) => document.getElementById(id);

// --- Auth screens/elements ---
const authScreen = $("authScreen");
const chatScreen = $("chatScreen");
const authForm = $("authForm");
const authEmail = $("authEmail");
const authPassword = $("authPassword");
const authCode = $("authCode");
const authSubmit = $("authSubmit");
const authError = $("authError");
const authCopy = $("authCopy");
const tabLogin = $("tabLogin");
const tabSignup = $("tabSignup");
const signOutBtn = $("signOutBtn");
const tierBadge = $("tierBadge");

let authMode = "login"; // or "signup"
let pendingAccessCode = "";
let profile = null;

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

if (!configured) {
  authForm.classList.add("hidden");
  document.querySelector(".auth-tabs").classList.add("hidden");
  document.querySelector(".auth-hint").classList.add("hidden");
  authCopy.textContent =
    "MK.ai isn't connected to Firebase yet. The owner needs to fill in firebase-config.js — see the README.";
}

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  authSubmit.disabled = true;
  pendingAccessCode = authCode.value.trim();

  try {
    const email = authEmail.value.trim();
    if (authMode === "signup") {
      const { user } = await createUserWithEmailAndPassword(auth, email, authPassword.value);
      // Verified emails are required for the admin vault; harmless for everyone else.
      sendEmailVerification(user).catch(() => {});
    } else {
      await signInWithEmailAndPassword(auth, email, authPassword.value);
    }
    // onAuthStateChanged takes it from here.
  } catch (err) {
    authError.textContent = friendlyError(err);
    authSubmit.disabled = false;
  }
});

signOutBtn.addEventListener("click", () => signOut(auth));

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
$("forgotBtn").addEventListener("click", () => sendReset(authEmail, authError));

// Creates the account's profile on first sign-in, and applies an access code if one was entered.
async function loadProfile(user, accessCode) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  let notice = "";
  const wrongCode = `That access code isn't right — you're on the ${TRIAL_HOURS}-hour trial.`;

  if (!snap.exists()) {
    if (accessCode) {
      try {
        await setDoc(ref, {
          email: user.email,
          tier: "unlimited",
          expiresAt: null,
          accessCode,
          createdAt: serverTimestamp(),
        });
        return { profile: (await getDoc(ref)).data(), notice };
      } catch {
        notice = wrongCode; // the security rules reject a wrong code
      }
    }
    await setDoc(ref, {
      email: user.email,
      tier: "trial",
      expiresAt: Timestamp.fromMillis(Date.now() + TRIAL_HOURS * 3600000),
      createdAt: serverTimestamp(),
    });
    return { profile: (await getDoc(ref)).data(), notice };
  }

  let data = snap.data();
  if (accessCode && data.tier === "trial") {
    try {
      await updateDoc(ref, { tier: "unlimited", expiresAt: null, accessCode });
      data = (await getDoc(ref)).data();
    } catch {
      notice = "That access code isn't right.";
    }
  }
  return { profile: data, notice };
}

if (configured) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      profile = null;
      showAuth();
      return;
    }
    try {
      const result = await loadProfile(user, pendingAccessCode);
      pendingAccessCode = "";
      profile = result.profile;
      showChat(user, result.notice);
    } catch (err) {
      authError.textContent = friendlyError(err);
      await signOut(auth);
    } finally {
      authSubmit.disabled = false;
    }
  });
}

let trialTimer = null;

function hasAccess() {
  if (!profile) return false;
  if (profile.tier === "unlimited") return true;
  if (profile.tier !== "trial" || !profile.expiresAt) return false;
  return profile.expiresAt.toMillis() > Date.now();
}

function renderTier() {
  clearInterval(trialTimer);

  if (profile.tier === "unlimited") {
    tierBadge.textContent = "unlimited";
    tierBadge.className = "tier-badge unlimited";
    return;
  }
  if (profile.tier !== "trial") {
    tierBadge.textContent = "no access";
    tierBadge.className = "tier-badge expired";
    lockChat("Your access has been turned off — ask the admin.");
    return;
  }

  const update = () => {
    const msLeft = profile.expiresAt.toMillis() - Date.now();
    if (msLeft <= 0) {
      tierBadge.textContent = "trial expired";
      tierBadge.className = "tier-badge expired";
      clearInterval(trialTimer);
      lockChat("Your trial has ended — log in with an access code, or ask the admin for unlimited access.");
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

function lockChat(message) {
  questionInput.disabled = true;
  sendBtn.disabled = true;
  questionInput.placeholder = message;
}

function showChat(user, notice) {
  authScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  signOutBtn.textContent = "sign out";
  signOutBtn.title = `Signed in as ${user.email}`;
  restoreConversation(user.uid);
  questionInput.disabled = false;
  sendBtn.disabled = false;
  questionInput.placeholder = "Ask me anything…";
  renderTier();
  if (notice) addErrorMessage(notice);
  questionInput.focus();
}

function showAuth() {
  clearInterval(trialTimer);
  chatScreen.classList.add("hidden");
  authScreen.classList.remove("hidden");
  const error = authError.textContent; // keep any sign-in error visible
  setAuthMode("login");
  authError.textContent = error;
  authPassword.value = "";
  authCode.value = "";
}

// --- Chat ---
const thread = $("thread");
const emptyState = $("emptyState");
const composer = $("composer");
const questionInput = $("question");
const sendBtn = $("sendBtn");
const secretMark = $("secretMark");

const tUser = $("msg-user");
const tAi = $("msg-ai");
const tLoading = $("msg-loading");
const tError = $("msg-error");

// Recent conversation, sent with each question so the AI can follow up.
const history = [];
const MAX_HISTORY = 12;
function remember(question, answer) {
  history.push({ role: "user", content: question }, { role: "assistant", content: answer.slice(0, 8000) });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
}

// --- The conversation, saved on this device per account so a refresh keeps it ---
const MAX_SAVED = 100;
let conversation = [];
let conversationKey = null;

function saveConversation() {
  if (!conversationKey) return;
  try {
    localStorage.setItem(conversationKey, JSON.stringify(conversation.slice(-MAX_SAVED)));
  } catch {} // storage full or blocked: the chat still works, it just won't survive a refresh
}

function record(item) {
  conversation.push(item);
  if (conversation.length > MAX_SAVED) conversation.splice(0, conversation.length - MAX_SAVED);
  saveConversation();
  return item;
}

function clearThread() {
  thread.querySelectorAll(".msg").forEach((n) => n.remove());
  emptyState.classList.remove("hidden");
  history.length = 0;
}

function restoreConversation(uid) {
  conversationKey = `mkai-chat-${uid}`;
  try {
    conversation = JSON.parse(localStorage.getItem(conversationKey)) || [];
  } catch {
    conversation = [];
  }
  clearThread();
  let lastQuestion = null;
  for (const item of conversation) {
    if (item.role === "user") {
      addUserMessage(item.text);
      lastQuestion = item.text;
    } else if (item.role === "bot") {
      const msg = createAiMessage();
      msg.finish(item.text, null);
      if (item.credit) msg.setCredit(item.credit);
      if (item.entryId) msg.enableVotes(item.entryId);
      if (lastQuestion && !item.teachable) remember(lastQuestion, item.text);
      lastQuestion = null;
    }
  }
  if (conversation.length) emptyState.classList.add("hidden");
  scrollToBottom();
}

$("newChatBtn").addEventListener("click", () => {
  conversation = [];
  saveConversation();
  clearThread();
  questionInput.focus();
});

function addUserMessage(text) {
  const node = tUser.content.cloneNode(true);
  node.querySelector(".msg-body").textContent = text;
  thread.appendChild(node);
}

function addLoading() {
  thread.appendChild(tLoading.content.cloneNode(true));
  return thread.lastElementChild;
}

// An answer bubble that can fill in as the answer streams, then gets its
// buttons once it's done. Vote buttons appear once the answer is saved.
function createAiMessage() {
  const node = tAi.content.cloneNode(true);
  const el = node.firstElementChild;
  const body = el.querySelector(".msg-body");
  const actions = el.querySelector(".answer-actions");
  const voteButtons = [...actions.querySelectorAll(".vote-btn")];
  actions.classList.add("hidden");
  voteButtons.forEach((b) => b.classList.add("hidden"));
  thread.appendChild(node);

  return {
    setText(text) {
      body.textContent = text;
    },
    finish(answer, searchSuggestions) {
      body.textContent = answer;
      if (searchSuggestions) {
        // Shadow DOM keeps Google's own styling from clashing with the page.
        const host = el.querySelector(".search-suggestions");
        host.classList.remove("hidden");
        host.attachShadow({ mode: "open" }).innerHTML = searchSuggestions;
      }
      const copyBtn = actions.querySelector(".copy-btn");
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(answer);
          copyBtn.textContent = "copied";
          setTimeout(() => (copyBtn.textContent = "copy"), 1500);
        } catch {}
      });
      actions.classList.remove("hidden");
    },
    setCredit(text) {
      const credit = el.querySelector(".answer-credit");
      credit.textContent = text;
      credit.classList.remove("hidden");
    },
    // "I don't know yet" answers get a box to teach MK.ai the right answer.
    enableTeaching(question) {
      const form = el.querySelector(".teach-form");
      const box = form.querySelector("textarea");
      const button = form.querySelector("button");
      form.classList.remove("hidden");
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const taught = box.value.trim();
        if (!taught) return;
        button.disabled = true;
        try {
          await learn(question, taught, "taught");
          logActivity(question, "taught");
          form.replaceWith(Object.assign(document.createElement("p"), {
            className: "answer-credit",
            textContent: "Thanks! 🧠 I'll remember that from now on.",
          }));
        } catch (err) {
          console.warn("Couldn't save what was taught:", err);
          button.disabled = false;
          button.textContent = "Couldn't save — try again";
        }
      });
    },
    enableVotes(entryId) {
      voteButtons.forEach((btn) => {
        btn.classList.remove("hidden");
        btn.addEventListener("click", () => {
          voteButtons.forEach((b) => b.classList.toggle("chosen", b === btn));
          vote(entryId, btn.dataset.vote).catch(() => {});
        });
      });
    },
  };
}

function addErrorMessage(message) {
  const node = tError.content.cloneNode(true);
  node.querySelector(".msg-body").textContent = message;
  thread.appendChild(node);
}

function scrollToBottom() {
  thread.scrollTop = thread.scrollHeight;
}

const DONT_KNOW = [
  "I don't know that one yet 🤔 — I'm still learning. If you know the answer, teach me below and I'll remember it.",
  "Hmm, that's new to me! 🧠 Teach me the answer below and I'll know it next time.",
];

// Answers in this order, stopping at the first that works:
// 1. Curated answers the admin put in the vault
// 2. MK.ai's own brain (greetings, small talk, time, maths, conversions)
// 3. Memory (everything learned or taught before)
// 4. Wikipedia, for simple "what is / who is" questions
// 5. Outside AI services, when available
// 6. "I don't know yet — teach me"
async function answer(question, onText) {
  const nothingSaved = Promise.resolve(null);
  const contextual = dependsOnContext(question, history);

  // Memory lookup, capped so a slow connection never delays the instant replies.
  let memory = null;
  let knowledge = { good: [], bad: [] };
  if (!contextual) {
    try {
      ({ memory, knowledge } = await Promise.race([
        lookup(question),
        new Promise((_, reject) => setTimeout(() => reject(new Error("memory lookup timed out")), 2500)),
      ]));
    } catch (err) {
      console.warn("Memory lookup failed:", err);
    }
  }
  const fromMemory = () => {
    const isLearned = memory.collection === "learned";
    if (isLearned) markUsed(memory.id).catch(() => {});
    logActivity(question, isLearned ? "memory" : "vault");
    return {
      answer: memory.answer,
      credit: memory.source === "wikipedia" ? "from Wikipedia" : null,
      saved: Promise.resolve(isLearned ? memory.id : null),
    };
  };

  if (memory && memory.collection === "vault") return fromMemory();

  const own = localAnswer(question);
  if (own) {
    logActivity(question, "local");
    return { answer: own, saved: nothingSaved };
  }

  if (memory) return fromMemory();

  if (!contextual && !isTimeSensitive(question) && looksLikeKnowledgeQuestion(question)) {
    const wiki = await wikiAnswer(question).catch(() => null);
    if (wiki) {
      logActivity(question, "wiki");
      return {
        answer: wiki.answer,
        credit: "from Wikipedia",
        saved: learn(question, wiki.answer, "wikipedia").catch(() => null),
      };
    }
  }

  try {
    const result = await askGemini(question, history, knowledge, onText);
    if (!result.answer) throw new Error("empty answer");
    logActivity(question, "ai");
    // Answers that depend on the conversation or go stale ("today", prices…) aren't saved.
    const saved =
      contextual || isTimeSensitive(question)
        ? nothingSaved
        : learn(question, result.answer).catch((err) => {
            console.warn("Couldn't save to memory:", err);
            return null;
          });
    return { ...result, saved };
  } catch (err) {
    console.warn("No AI service could answer:", aiErrorMessage(err));
    logActivity(question, "unknown");
    return {
      answer: DONT_KNOW[Math.floor(Math.random() * DONT_KNOW.length)],
      saved: nothingSaved,
      teachable: !contextual,
    };
  }
}

// The waiting message changes if Gemini is slow, so it never looks frozen.
function startLoading() {
  const el = addLoading();
  const label = el.querySelector(".pulling");
  const steps = [
    [8000, "still thinking…"],
    [20000, "Google's AI is busy — trying another model…"],
    [45000, "still trying…"],
  ].map(([ms, text]) =>
    setTimeout(() => {
      if (label) label.lastChild.textContent = ` ${text}`;
    }, ms)
  );
  return {
    remove() {
      steps.forEach(clearTimeout);
      el.remove();
    },
  };
}

composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = questionInput.value.trim().slice(0, 4000);
  if (!question) return;
  if (!hasAccess()) {
    renderTier();
    return;
  }

  emptyState.classList.add("hidden");
  addUserMessage(question);
  record({ role: "user", text: question });
  questionInput.value = "";
  sendBtn.disabled = true;
  scrollToBottom();

  const loading = startLoading();
  scrollToBottom();
  let bubble = null;
  const showBubble = () => {
    if (!bubble) {
      loading.remove();
      bubble = createAiMessage();
    }
    return bubble;
  };

  try {
    const result = await answer(question, (text) => {
      showBubble().setText(text);
      scrollToBottom();
    });
    const msg = showBubble();
    msg.finish(result.answer, result.searchSuggestions);
    if (result.credit) msg.setCredit(result.credit);
    if (result.teachable) msg.enableTeaching(question);
    else remember(question, result.answer);
    const saved = record({ role: "bot", text: result.answer, credit: result.credit || null, teachable: !!result.teachable });
    result.saved.then((entryId) => {
      if (!entryId) return;
      msg.enableVotes(entryId);
      saved.entryId = entryId;
      saveConversation();
    });
  } catch (err) {
    console.error(err);
    loading.remove();
    addErrorMessage(aiErrorMessage(err));
  } finally {
    sendBtn.disabled = !hasAccess();
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
    window.location.href = "vault.html";
  }
});

// --- Installable app (PWA) ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

const installBtn = $("installBtn");
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
