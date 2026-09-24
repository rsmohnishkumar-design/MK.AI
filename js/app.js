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
  deleteDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { configured, auth, db, friendlyError } from "./firebase.js";
import { lookup, learn, markUsed, vote, logActivity, dependsOnContext, isTimeSensitive, keywords } from "./brain.js";
import { bestSentences, summarise, wantsSummary } from "./reader.js";
import { localAnswer } from "./local.js";
import { wikiAnswer, wikiFind, looksLikeKnowledgeQuestion } from "./wiki.js";
import * as creator from "./creator.js";
import { renderAnswer } from "./format.js";
import { startMeaning } from "./meaning.js";
import * as voice from "./voice.js";
import * as attach from "./attach.js";
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
      awaitingCode = false;
      stopSync();
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

const isCreator = () => profile?.creator === true;

function renderTier() {
  clearInterval(trialTimer);

  if (profile.tier === "unlimited") {
    tierBadge.textContent = isCreator() ? "👑 creator · unlimited" : "unlimited";
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
    tierBadge.textContent = `${isCreator() ? "👑 creator · " : ""}trial · ${h}h ${m}m left`;
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
  signOutBtn.title = `Signed in as ${user.email}`;
  $("accountEmail").textContent = user.email;
  $("accountAvatar").textContent = (user.email || "?").charAt(0);
  loadChats(user.uid);
  questionInput.disabled = false;
  sendBtn.disabled = false;
  questionInput.placeholder = "Ask me anything…";
  renderTier();
  if (notice) addErrorMessage(notice);
  questionInput.focus();
  forgetOfflineBrain();
  // Neural memory loads quietly once the page is idle.
  (window.requestIdleCallback || ((fn) => setTimeout(fn, 2000)))(() => startMeaning());
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

// ---------------------------------------------------------------------------
// Chats, saved on this device per account so a refresh keeps them. Each chat
// has its own messages; the sidebar lists them newest first.
// ---------------------------------------------------------------------------
const MAX_CHATS = 60;
const MAX_MESSAGES = 100;
let store = { chats: [], currentId: null };
let storeKey = null;

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function saveChats() {
  if (!storeKey) return;
  try {
    localStorage.setItem(storeKey, JSON.stringify(store));
  } catch {} // storage full or blocked: the chat still works, it just won't survive a refresh
}

function currentChat() {
  return store.chats.find((c) => c.id === store.currentId) || null;
}

function titleFrom(text) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 48 ? `${t.slice(0, 48)}…` : t || "New chat";
}

function loadChats(uid) {
  storeKey = `mkai-chats-${uid}`;
  try {
    store = JSON.parse(localStorage.getItem(storeKey)) || { chats: [], currentId: null };
  } catch {
    store = { chats: [], currentId: null };
  }
  // Bring over the single conversation saved by the previous version.
  try {
    const oldKey = `mkai-chat-${uid}`;
    const old = JSON.parse(localStorage.getItem(oldKey));
    if (Array.isArray(old) && old.length) {
      const first = old.find((m) => m.role === "user");
      store.chats.unshift({ id: newId(), title: titleFrom(first ? first.text : "Earlier chat"), updatedAt: Date.now(), messages: old });
      store.currentId = store.chats[0].id;
    }
    localStorage.removeItem(oldKey);
  } catch {}
  if (!currentChat()) store.currentId = store.chats[0]?.id || null;
  saveChats();
  renderThread();
  renderChatList();
  startSync(uid);
}

// ---------------------------------------------------------------------------
// Cloud sync: every chat is also kept in the database (users/<uid>/chats), so
// the chat list follows the person to any device. The copy on this device
// shows instantly; the database copy wins when it's newer. Only the owner can
// read or write their chats (see firestore.rules).
// ---------------------------------------------------------------------------
let syncUid = null;
let stopListening = null;
let answering = false;
const uploadTimers = new Map();

function stopSync() {
  if (stopListening) stopListening();
  stopListening = null;
  syncUid = null;
  uploadTimers.forEach(clearTimeout);
  uploadTimers.clear();
}

function cloudCopy(chat) {
  return {
    title: chat.title.slice(0, 200),
    updatedAt: chat.updatedAt,
    messages: chat.messages.slice(-MAX_MESSAGES).map((m) => ({
      role: m.role,
      text: (m.text || "").slice(0, 8000),
      ...(m.credit ? { credit: m.credit } : {}),
      ...(m.entryId ? { entryId: m.entryId } : {}),
      ...(m.teachable ? { teachable: true } : {}),
    })),
  };
}

// Uploads a chat shortly after it changes (several quick changes → one write).
function uploadChat(id) {
  if (!syncUid) return;
  clearTimeout(uploadTimers.get(id));
  uploadTimers.set(
    id,
    setTimeout(async () => {
      uploadTimers.delete(id);
      const chat = store.chats.find((c) => c.id === id);
      if (!chat || !syncUid) return;
      try {
        await setDoc(doc(db, "users", syncUid, "chats", id), cloudCopy(chat));
        if (!chat.synced) {
          chat.synced = true;
          saveChats();
        }
      } catch (err) {
        console.warn("Couldn't sync this chat (it's still saved on this device):", err);
      }
    }, 700)
  );
}

function startSync(uid) {
  stopSync();
  syncUid = uid;
  let firstLoad = true;
  const chatsQuery = query(collection(db, "users", uid, "chats"), orderBy("updatedAt", "desc"), limit(MAX_CHATS));
  stopListening = onSnapshot(
    chatsQuery,
    (snap) => {
      let changed = false;
      const remote = new Map(snap.docs.map((d) => [d.id, d.data()]));
      for (const [id, data] of remote) {
        const local = store.chats.find((c) => c.id === id);
        if (!local) {
          store.chats.push({ id, ...data, synced: true });
          changed = true;
        } else if (data.updatedAt > local.updatedAt) {
          Object.assign(local, data, { synced: true });
          changed = true;
        }
      }
      if (firstLoad) {
        firstLoad = false;
        for (const chat of [...store.chats]) {
          const r = remote.get(chat.id);
          if (!r && chat.synced && remote.size < MAX_CHATS) {
            // Deleted on another device.
            store.chats = store.chats.filter((c) => c !== chat);
            if (store.currentId === chat.id) store.currentId = null;
            changed = true;
          } else if (!r || chat.updatedAt > r.updatedAt) {
            uploadChat(chat.id); // only on this device so far, or newer here
          }
        }
      }
      if (!changed) return;
      store.chats.sort((a, b) => b.updatedAt - a.updatedAt);
      store.chats.length = Math.min(store.chats.length, MAX_CHATS);
      if (!currentChat() && !answering) store.currentId = store.chats[0]?.id || null;
      saveChats();
      if (!answering) renderThread();
      renderChatList();
    },
    (err) => console.warn("Chat sync is off (chats stay on this device):", err)
  );
}

// Adds a message to a chat (creating the chat on its first message).
function record(chatId, item) {
  let chat = store.chats.find((c) => c.id === chatId);
  if (!chat) {
    chat = { id: chatId, title: "New chat", updatedAt: Date.now(), messages: [] };
    store.chats.unshift(chat);
  }
  chat.messages.push(item);
  if (chat.messages.length > MAX_MESSAGES) chat.messages.splice(0, chat.messages.length - MAX_MESSAGES);
  if (item.role === "user" && chat.title === "New chat") chat.title = titleFrom(item.text);
  chat.updatedAt = Date.now();
  store.chats.sort((a, b) => b.updatedAt - a.updatedAt);
  store.chats.length = Math.min(store.chats.length, MAX_CHATS);
  saveChats();
  uploadChat(chat.id);
  renderChatList();
  return item;
}

function clearThread() {
  thread.querySelectorAll(".msg").forEach((n) => n.remove());
  emptyState.classList.remove("hidden");
  history.length = 0;
}

function renderThread() {
  clearThread();
  const chat = currentChat();
  $("chatTitle").textContent = chat ? chat.title : "New chat";
  if (!chat || !chat.messages.length) return;
  emptyState.classList.add("hidden");
  let lastQuestion = null;
  for (const item of chat.messages) {
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
  scrollToBottom();
}

function dayGroup(ts) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (ts >= start.getTime()) return "Today";
  if (ts >= start.getTime() - 86400000) return "Yesterday";
  if (ts >= start.getTime() - 7 * 86400000) return "Previous 7 days";
  return "Older";
}

function renderChatList() {
  const list = $("chatList");
  const filter = $("chatSearch").value.trim().toLowerCase();
  list.innerHTML = "";
  const chats = store.chats.filter(
    (c) =>
      !filter ||
      c.title.toLowerCase().includes(filter) ||
      c.messages.some((m) => (m.text || "").toLowerCase().includes(filter))
  );
  if (!chats.length) {
    const empty = document.createElement("p");
    empty.className = "chat-empty";
    empty.textContent = filter ? "No chats match." : "Your chats will appear here.";
    list.appendChild(empty);
    return;
  }
  let group = null;
  for (const chat of chats) {
    const g = dayGroup(chat.updatedAt);
    if (g !== group) {
      group = g;
      const label = document.createElement("div");
      label.className = "chat-group";
      label.textContent = g;
      list.appendChild(label);
    }
    const item = document.createElement("div");
    item.className = "chat-item" + (chat.id === store.currentId ? " active" : "");
    const open = document.createElement("button");
    open.type = "button";
    open.className = "chat-open";
    open.textContent = chat.title;
    open.title = chat.title;
    open.addEventListener("click", () => openChat(chat.id));
    const del = document.createElement("button");
    del.type = "button";
    del.className = "chat-delete";
    del.textContent = "×";
    del.title = "Delete chat";
    del.setAttribute("aria-label", `Delete chat: ${chat.title}`);
    del.addEventListener("click", () => deleteChat(chat.id));
    item.append(open, del);
    list.appendChild(item);
  }
}

function openChat(id) {
  awaitingCode = false;
  store.currentId = id;
  saveChats();
  renderThread();
  renderChatList();
  closeSidebarOnPhone();
}

function newChat() {
  awaitingCode = false;
  store.currentId = null;
  saveChats();
  renderThread();
  renderChatList();
  closeSidebarOnPhone();
  questionInput.focus();
}

function deleteChat(id) {
  const chat = store.chats.find((c) => c.id === id);
  if (!chat || !confirm(`Delete "${chat.title}"?`)) return;
  store.chats = store.chats.filter((c) => c.id !== id);
  if (store.currentId === id) store.currentId = null;
  saveChats();
  clearTimeout(uploadTimers.get(id));
  if (syncUid) deleteDoc(doc(db, "users", syncUid, "chats", id)).catch((err) => console.warn("Couldn't delete the synced copy:", err));
  renderThread();
  renderChatList();
}

$("newChatBtn").addEventListener("click", newChat);
$("newChatTop").addEventListener("click", newChat);
$("chatSearch").addEventListener("input", renderChatList);

// --- Sidebar: beside the chat on laptops (remembered open/closed), sliding
// over the chat on phones (closed until opened).
const layout = $("chatScreen");
const isPhone = () => window.matchMedia("(max-width: 899px)").matches;
function setSidebar(open) {
  layout.classList.toggle("sidebar-open", open);
  if (!isPhone()) {
    try {
      localStorage.setItem("mkai-sidebar", open ? "open" : "closed");
    } catch {}
  }
}
function closeSidebarOnPhone() {
  if (isPhone()) setSidebar(false);
}
let savedSidebar = null;
try {
  savedSidebar = localStorage.getItem("mkai-sidebar");
} catch {}
layout.classList.toggle("sidebar-open", !isPhone() && savedSidebar !== "closed");
$("sidebarOpen").addEventListener("click", () => setSidebar(!layout.classList.contains("sidebar-open")));
$("sidebarClose").addEventListener("click", () => setSidebar(false));
$("sidebarBackdrop").addEventListener("click", () => setSidebar(false));
window.matchMedia("(max-width: 899px)").addEventListener("change", (e) => {
  layout.classList.toggle("sidebar-open", !e.matches && savedSidebar !== "closed");
});

// --- The typing box grows with the text; Enter sends, Shift+Enter adds a line.
function fitQuestion() {
  questionInput.style.height = "auto";
  questionInput.style.height = `${Math.min(questionInput.scrollHeight, 200)}px`;
}
questionInput.addEventListener("input", fitQuestion);
questionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    composer.requestSubmit();
  }
});

function addUserMessage(text, attachment = null) {
  const node = tUser.content.cloneNode(true);
  node.querySelector(".msg-body").textContent = text;
  if (attachment?.previewUrl) {
    const img = Object.assign(document.createElement("img"), { className: "msg-attach", src: attachment.previewUrl, alt: attachment.name });
    node.querySelector(".msg-body").before(img);
  }
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
      renderAnswer(body, text);
    },
    finish(answer, searchSuggestions) {
      renderAnswer(body, answer);
      if (searchSuggestions) {
        // Shadow DOM keeps Google's own styling from clashing with the page.
        const host = el.querySelector(".search-suggestions");
        host.classList.remove("hidden");
        host.attachShadow({ mode: "open" }).innerHTML = searchSuggestions;
      }
      const speakBtn = actions.querySelector(".speak-btn");
      if (voice.canSpeak) {
        speakBtn.classList.remove("hidden");
        speakBtn.addEventListener("click", () => toggleSpeaking(speakBtn, answer));
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
    // Reads the answer aloud (after a spoken question).
    speakNow(answer) {
      const speakBtn = actions.querySelector(".speak-btn");
      if (voice.canSpeak) toggleSpeaking(speakBtn, answer);
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

// --- Voice ---
let speakingBtn = null;
function resetSpeakingBtn() {
  speakingBtn?.classList.remove("speaking");
  if (speakingBtn) speakingBtn.textContent = "listen";
  speakingBtn = null;
}
function toggleSpeaking(btn, text) {
  const wasThis = speakingBtn === btn;
  voice.stopSpeaking();
  resetSpeakingBtn();
  if (wasThis) return;
  speakingBtn = btn;
  btn.classList.add("speaking");
  btn.textContent = "stop";
  voice.speak(text, {
    onEnd: () => {
      if (speakingBtn === btn) resetSpeakingBtn();
    },
  });
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
  "I don't know that one yet 🤔 I've added it to my learning list, so I'll learn it soon. If you know the answer, teach me below and I'll remember it right away.",
  "Hmm, that's new to me! 🧠 It's on my learning list now. If you know the answer, teach me below.",
];

// MK.ai answers everything itself, in this order, stopping at the first that works:
// 1. Curated answers (the vault: taught and approved in the Training room)
// 2. Its own brain (greetings, small talk, time, maths, conversions, coding)
// 3. Memory (everything learned or taught before, matched by meaning)
// 4. Documents taught in the Training room (it picks out the sentences that answer)
// 5. Wikipedia, for simple "what is / who is" questions
// 6. "I don't know yet": the question goes on its learning list for the Training room
// Outside AI is never used here; it only helps the admin in the Training room.
async function answer(question, onText, attachment = null) {
  const nothingSaved = Promise.resolve(null);
  // The question asked before this one in the chat (answered or not).
  const asked = (currentChat()?.messages || []).filter((m) => m.role === "user").map((m) => m.text);
  const lastAsked = asked.length > 1 ? asked[asked.length - 2] : "";
  const contextual = dependsOnContext(question, lastAsked ? [lastAsked] : []);

  // A text file sent with the question: MK.ai reads it itself.
  if (attachment) {
    logActivity(question, "file");
    const found = wantsSummary(question) ? summarise(attachment.text) : bestSentences(question, attachment.text);
    return {
      answer: found
        ? `${wantsSummary(question) ? "Here's a summary of" : "Here's what"} ${attachment.name}${wantsSummary(question) ? ":" : " says about that:"}\n\n${found}`
        : `I couldn't find that in ${attachment.name}. Try asking with words that appear in the file, or say "summarise this file".`,
      credit: `read by MK.ai from ${attachment.name}`,
      saved: nothingSaved,
    };
  }

  if (creator.claimsCreator(question)) {
    logActivity(question, "creator");
    if (isCreator()) return { answer: creator.replies.already(), saved: nothingSaved };
    if (creator.lockedMinutes()) return { answer: creator.replies.locked(), saved: nothingSaved };
    awaitingCode = true;
    return { answer: creator.replies.askCode(), saved: nothingSaved };
  }
  if (creator.asksForDetails(question)) {
    if (!isCreator()) return { answer: creator.replies.detailsLocked(), saved: nothingSaved };
    logActivity(question, "creator");
    const report = await creator.detailsReport({ user: auth.currentUser, profile, chats: store.chats.length });
    return { answer: report, saved: nothingSaved };
  }

  const own = localAnswer(question, { creator: isCreator() });

  // A follow-up ("what about its population?") is looked up together with
  // the topic of the previous question.
  const searchFor = contextual ? `${question} ${keywords(lastAsked).join(" ")}` : question;

  // Memory lookup, capped so a slow connection never delays the instant replies.
  let memory = null;
  let knowledge = { good: [], bad: [], docs: [] };
  if (!own || /^(what|who|how|why|when|where|which|explain|define)\b/i.test(question.trim())) {
    try {
      ({ memory, knowledge } = await Promise.race([
        lookup(searchFor),
        new Promise((_, reject) => setTimeout(() => reject(new Error("memory lookup timed out")), 3000)),
      ]));
    } catch (err) {
      console.warn("Memory lookup failed:", err);
    }
  }
  const fromMemory = () => {
    const isLearned = memory.collection === "learned";
    if (isLearned) markUsed(memory.id).catch(() => {});
    logActivity(question, isLearned ? "memory" : "vault");
    const credits = [
      memory.source === "wikipedia" ? "from Wikipedia" : "",
      memory.similarTo ? `from memory of a similar question: “${memory.similarTo.slice(0, 120)}”` : "",
    ].filter(Boolean);
    return {
      answer: memory.answer,
      credit: credits.join(" · ") || null,
      saved: Promise.resolve(isLearned ? memory.id : null),
    };
  };

  if (memory && memory.collection === "vault") return fromMemory();

  if (own) {
    logActivity(question, "local");
    return { answer: own, saved: nothingSaved };
  }

  if (memory) return fromMemory();

  // Documents taught in the Training room: MK.ai picks out the sentences that answer.
  for (const passage of knowledge.docs || []) {
    const found = passage.score >= 0.6 && bestSentences(searchFor, passage.text);
    if (found) {
      logActivity(question, "document");
      return { answer: found, credit: `from "${passage.title}"`, saved: nothingSaved };
    }
  }

  if (!isTimeSensitive(question)) {
    const asked = contextual ? searchFor : question;
    const wiki =
      (looksLikeKnowledgeQuestion(asked) && (await wikiAnswer(asked).catch(() => null))) ||
      (await wikiFind(asked).catch(() => null));
    if (wiki) {
      logActivity(question, "wiki");
      return {
        answer: wiki.answer,
        credit: "from Wikipedia",
        saved: contextual ? nothingSaved : learn(question, wiki.answer, "wikipedia").catch(() => null),
      };
    }
  }

  if (!navigator.onLine) {
    return { answer: "You're offline. 📴 Connect to the internet and ask me again.", saved: nothingSaved };
  }
  logActivity(question, "unknown");
  return {
    answer: DONT_KNOW[Math.floor(Math.random() * DONT_KNOW.length)],
    saved: nothingSaved,
    teachable: !contextual,
  };
}

// After "I created you", the next short message is the secret code. It is
// never shown, saved, logged or sent anywhere except to the security rules.
let awaitingCode = false;

async function checkCreatorCode(code) {
  const outcome = await creator.verifyCode(auth.currentUser.uid, code);
  if (outcome === "ok") {
    profile = { ...profile, creator: true };
    renderTier();
  }
  const text = outcome === "ok" ? creator.replies.welcome() : outcome === "wrong" ? creator.replies.wrong() : creator.replies.error();
  return { answer: text, saved: Promise.resolve(null) };
}

// The waiting message changes if a lookup is slow, so it never looks frozen.
function startLoading() {
  const el = addLoading();
  const label = el.querySelector(".pulling");
  const steps = [
    [5000, "still looking…"],
    [15000, "searching a bit longer…"],
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
  const attachment = pendingAttachment;
  let question = questionInput.value.trim().slice(0, 4000);
  if (!question && !attachment) return;
  if (!question) question = attach.defaultQuestion(attachment);
  if (!hasAccess()) {
    renderTier();
    return;
  }

  // The answer belongs to this chat even if the person switches chats meanwhile.
  if (!store.currentId) store.currentId = newId();
  const chatId = store.currentId;
  const stillHere = () => store.currentId === chatId;

  voice.stopSpeaking();
  resetSpeakingBtn();
  const spoken = askedByVoice;
  askedByVoice = false;

  const waitingForCode = awaitingCode;
  awaitingCode = false;
  const cancelled = waitingForCode && creator.isCancel(question);
  const isCode = waitingForCode && !cancelled && creator.looksLikeCode(question);
  const shown = isCode ? "•".repeat(Math.min(question.length, 12)) : attachment ? `${attach.label(attachment)}\n${question}` : question;

  // A follow-up ("what about question 2?") keeps using the chat's last file.
  if (attachment) lastAttachment.set(chatId, attachment);
  // Its own brain (maths, algebra…) comes first, even in a chat with a file.
  const fileForAnswer =
    attachment || (dependsOnContext(question, history) && !localAnswer(question) ? lastAttachment.get(chatId) : null);
  clearAttachment();

  emptyState.classList.add("hidden");
  addUserMessage(shown, attachment);
  record(chatId, { role: "user", text: shown });
  $("chatTitle").textContent = currentChat()?.title || "New chat";
  questionInput.value = "";
  fitQuestion();
  sendBtn.disabled = true;
  answering = true;
  scrollToBottom();

  const loading = startLoading();
  scrollToBottom();
  let bubble = null;
  const offscreen = { setText() {}, finish() {}, setCredit() {}, enableTeaching() {}, enableVotes() {} };
  const showBubble = () => {
    if (!stillHere()) return offscreen;
    if (!bubble) {
      loading.remove();
      bubble = createAiMessage();
    }
    return bubble;
  };

  try {
    const result = isCode
      ? await checkCreatorCode(question)
      : cancelled
        ? { answer: creator.replies.cancelled(), saved: Promise.resolve(null) }
        : await answer(
            question,
            (text) => {
              showBubble().setText(text);
              scrollToBottom();
            },
            fileForAnswer
          );
    const msg = showBubble();
    msg.finish(result.answer, result.searchSuggestions);
    if (spoken && stillHere()) msg.speakNow(result.answer);
    if (result.credit) msg.setCredit(result.credit);
    if (result.teachable) msg.enableTeaching(question);
    else if (stillHere() && !isCode) remember(question, result.answer);
    const saved = record(chatId, { role: "bot", text: result.answer, credit: result.credit || null, teachable: !!result.teachable });
    result.saved.then((entryId) => {
      if (!entryId) return;
      msg.enableVotes(entryId);
      saved.entryId = entryId;
      saveChats();
      uploadChat(chatId);
    });
  } catch (err) {
    console.error(err);
    loading.remove();
    if (stillHere()) addErrorMessage("Something went wrong while answering. Please try again.");
  } finally {
    answering = false;
    sendBtn.disabled = !hasAccess();
    questionInput.focus();
    scrollToBottom();
  }
});

// --- Hidden vault entrance: click the MK logo 7 times within 3 seconds ---
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

// --- Attachments: photos, PDFs and text files ---
const attachInput = $("attachInput");
const attachChip = $("attachChip");
let pendingAttachment = null;
const lastAttachment = new Map(); // chat id → its most recent file, for follow-ups
// MK.ai reads text and code files itself; photos and PDFs would need outside AI.
attachInput.accept = attach.TEXT_ACCEPT;

function clearAttachment() {
  pendingAttachment = null;
  attachChip.classList.add("hidden");
  attachInput.value = "";
}
async function useFile(file) {
  if (!file) return;
  $("attachName").textContent = `Reading ${file.name || "image"}…`;
  $("attachThumb").classList.add("hidden");
  attachChip.classList.remove("hidden");
  try {
    const read = await attach.readAttachment(file);
    if (read.kind !== "text") {
      throw Object.assign(new Error("I read text and code files by myself (.txt, .md, .csv, code…). I can't read photos or PDFs yet: copy the text in and ask me about it."), { friendly: true });
    }
    pendingAttachment = read;
    $("attachName").textContent = pendingAttachment.name;
    if (pendingAttachment.previewUrl) {
      $("attachThumb").src = pendingAttachment.previewUrl;
      $("attachThumb").classList.remove("hidden");
    }
    questionInput.focus();
  } catch (err) {
    clearAttachment();
    addErrorMessage(err.friendly ? err.message : "That file couldn't be read.");
  }
}
$("attachBtn").addEventListener("click", () => attachInput.click());
attachInput.addEventListener("change", () => useFile(attachInput.files[0]));
$("attachRemove").addEventListener("click", clearAttachment);
questionInput.addEventListener("paste", (e) => {
  const file = [...(e.clipboardData?.files || [])][0];
  if (file) {
    e.preventDefault();
    useFile(file);
  }
});
composer.addEventListener("dragover", (e) => {
  e.preventDefault();
  composer.classList.add("dragging");
});
composer.addEventListener("dragleave", () => composer.classList.remove("dragging"));
composer.addEventListener("drop", (e) => {
  e.preventDefault();
  composer.classList.remove("dragging");
  useFile(e.dataTransfer?.files?.[0]);
});

// --- Voice typing: tap the mic, speak, and the question is sent ---
const micBtn = $("micBtn");
let askedByVoice = false;
let stopVoiceTyping = null;
function setListening(on) {
  micBtn.classList.toggle("listening", on);
  micBtn.setAttribute("aria-pressed", String(on));
  micBtn.title = on ? "Stop listening" : "Speak your question";
  questionInput.placeholder = on ? "Listening… speak now" : "Ask me anything…";
}
if (voice.canListen) micBtn.classList.remove("hidden");
micBtn.addEventListener("click", () => {
  if (stopVoiceTyping) {
    stopVoiceTyping();
    return;
  }
  voice.stopSpeaking();
  resetSpeakingBtn();
  const lastWritten = [...(currentChat()?.messages || [])].reverse().find((m) => m.role === "user")?.text || questionInput.value;
  setListening(true);
  try {
    stopVoiceTyping = voice.listen({
      lang: voice.languageOf(lastWritten),
      onText: (text) => {
        questionInput.value = text;
        fitQuestion();
      },
      onEnd: (text) => {
        stopVoiceTyping = null;
        setListening(false);
        if (text && !sendBtn.disabled) {
          questionInput.value = text;
          askedByVoice = true;
          composer.requestSubmit();
        }
      },
      onError: (code) => {
        stopVoiceTyping = null;
        setListening(false);
        if (code !== "aborted") addErrorMessage(voice.listenErrorMessage(code));
      },
    });
  } catch (err) {
    stopVoiceTyping = null;
    setListening(false);
    addErrorMessage(voice.listenErrorMessage(err?.name));
  }
});

// The optional offline brain was removed: free the space it took on devices
// that downloaded it (its model files live in the browser's "webllm" caches).
function forgetOfflineBrain() {
  try {
    if (localStorage.getItem("mkai-own-brain") === null) return;
    localStorage.removeItem("mkai-own-brain");
  } catch {
    return;
  }
  caches
    ?.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith("webllm")).map((k) => caches.delete(k))))
    .catch(() => {});
}

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
