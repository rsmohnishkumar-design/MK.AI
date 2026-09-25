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
import { knowledgeAnswer, loadKnowledge, relatedEntries } from "./kb.js";
import * as deep from "./deepthink.js";
import { appAnswer } from "./apps.js";
import { localAnswer } from "./local.js";
import { wikiAnswer, wikiFind, looksLikeKnowledgeQuestion } from "./wiki.js";
import * as creator from "./creator.js";
import { renderAnswer, registerBlock } from "./format.js";
import { isVisionRequest, visionAnswer, mountVision, cancelPhotos } from "./vision.js";
import { noteUnknown, startAutoLearner, researchMore, worthLearning } from "./learning.js";
import { personalAnswer, aboutMe } from "./personal.js";
import { wantsQuiz, quizAnswer, mountQuiz } from "./quiz.js";
import { startMeaning } from "./meaning.js";
import * as voice from "./voice.js";
import * as attach from "./attach.js";
import { TRIAL_HOURS } from "../firebase-config.js";

const $ = (id) => document.getElementById(id);
registerBlock("alpaca-vision", mountVision);
registerBlock("mkai-quiz", (container, text) =>
  mountQuiz(container, text, (label) => {
    questionInput.value = `quiz me on ${label}`;
    composer.requestSubmit();
  })
);

// --- Auth screens/elements ---
const authScreen = $("authScreen");
const chatScreen = $("chatScreen");
const authForm = $("authForm");
const authEmail = $("authEmail");
const authPassword = $("authPassword");
const authCode = $("authCode");
// The access code box stays hidden until someone asks for it
$("showCodeBtn")?.addEventListener("click", (e) => {
  authCode.hidden = false;
  authCode.focus();
  e.currentTarget.hidden = true;
});
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
      forgetSession();
      stopSync();
      showAuth();
      return;
    }
    // Returning on this device: open the chat straight away with the saved
    // profile, and refresh it from the database in the background.
    const saved = savedSession(user.uid);
    if (saved && !pendingAccessCode) {
      profile = saved;
      showChat(user);
      loadProfile(user, "")
        .then((result) => {
          if (auth.currentUser?.uid !== user.uid) return;
          profile = result.profile;
          saveSession(user.uid, profile);
          renderTier();
        })
        .catch((err) => console.warn("Couldn't refresh the profile:", err));
      return;
    }
    try {
      const result = await loadProfile(user, pendingAccessCode);
      pendingAccessCode = "";
      profile = result.profile;
      saveSession(user.uid, profile);
      showChat(user, result.notice);
    } catch (err) {
      authError.textContent = friendlyError(err);
      await signOut(auth);
    } finally {
      authSubmit.disabled = false;
    }
  });
}

// --- Remembered session ---
// The profile is kept on this device so a reload opens the chat at once
// (index.html also hides the login screen early when this is present).
const SESSION_KEY = "mkai-session";
const toSaved = (v) => (v && typeof v.toMillis === "function" ? { __ms: v.toMillis() } : v);
const fromSaved = (v) => (v && typeof v === "object" && "__ms" in v ? Timestamp.fromMillis(v.__ms) : v);

function saveSession(uid, data) {
  try {
    // Never keep the codes on the device
    const plain = Object.fromEntries(
      Object.entries(data || {})
        .filter(([k]) => k !== "accessCode" && k !== "creatorCode")
        .map(([k, v]) => [k, toSaved(v)])
    );
    localStorage.setItem(SESSION_KEY, JSON.stringify({ uid, profile: plain }));
  } catch {}
}
function savedSession(uid) {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!s || s.uid !== uid || !s.profile) return null;
    return Object.fromEntries(Object.entries(s.profile).map(([k, v]) => [k, fromSaved(v)]));
  } catch {
    return null;
  }
}
function forgetSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}
  document.documentElement.classList.remove("has-session");
}

let trialTimer = null;
let stopLearner = null; // the background self-learner

function hasAccess() {
  if (!profile) return false;
  if (profile.tier === "unlimited") return true;
  if (profile.tier !== "trial" || !profile.expiresAt) return false;
  return profile.expiresAt.toMillis() > Date.now();
}

const isCreator = () => profile?.creator === true;
const isUnlimited = () => profile?.tier === "unlimited";
const unlimitedOnly = (what) =>
  `🔒 ${what === "Alpaca Vision" ? "Pictures and videos are" : "This is"} for unlimited members.\n\n` +
  "**Want unlimited access?** Keep chatting with MK.ai and help train it: when it says \"I don't know\", teach it the answer. " +
  "The admin gives unlimited access to people who help.\n\n" +
  "Already have an access code? Tap **🔑 enter access code** under your email.";

// The empty chat greets the person by name, a little differently each time
function nameOf(email = "") {
  const told = aboutMe(auth.currentUser?.uid).name;
  if (told) return told.split(" ")[0];
  if (isCreator()) return creator.firstName();
  const word = (email.split("@")[0].match(/[a-z]{2,}/i) || [""])[0];
  return word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : "there";
}
function renderGreeting() {
  const name = nameOf(auth.currentUser?.email);
  const h = new Date().getHours();
  const part = h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const hellos = [`${part}, ${name}!`, `Hi ${name}! 👋`, `Hello, ${name}!`, `Vanakkam, ${name}! 🙏`, `Welcome back, ${name}!`, `Nice to see you, ${name}!`];
  const subs = [
    "What would you like to know today?",
    "Ask me anything: maths, science, coding or general knowledge.",
    "What shall we explore today?",
    "Got a question? I'm ready.",
    "Pick a topic, any topic.",
  ];
  if (isUnlimited()) subs.push("Want a picture? Switch to 🎨 Alpaca Vision.", "Learning to code? The Code School is open for you.");
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  $("emptyTitle").textContent = pick(hellos);
  $("emptySub").textContent = pick(subs);
  // Four things to try, a different mix each time
  const ideas = [
    "Solve 2x + 5 = 13", "Differentiate x^3 sin x", "What is 15% of 240?", "Balance H2 + O2 = H2O",
    "Molar mass of H2SO4", "Essay on pollution", "Leave letter to the principal", "Full form of ISRO",
    "When is Engineers' Day?", "Thirukkural on friendship", "Make a calculator app", "What is recursion?",
    "Who invented the telephone?", "Meaning of practice makes perfect", "What is photosynthesis?", "How to become an IAS officer?",
  ];
  if (isUnlimited()) ideas.push("Draw a sunset over the sea", "Make a birthday card for Priya");
  const shuffled = ideas.sort(() => Math.random() - 0.5).slice(0, 4);
  const box = $("emptySuggest");
  box.replaceChildren(
    ...shuffled.map((idea) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = idea;
      b.addEventListener("click", () => {
        questionInput.value = idea;
        composer.requestSubmit();
      });
      return b;
    })
  );
}

function renderTier() {
  clearInterval(trialTimer);
  renderGreeting();
  // Alpaca Vision and the Code School only appear for unlimited members
  const unlimited = isUnlimited();
  $("codeBtn").hidden = unlimited;
  $("upgradeNote").hidden = unlimited;
  $("modelSelect")?.classList.toggle("hidden", !unlimited);
  $("learnLink")?.classList.toggle("hidden", !unlimited);
  $("emptyLearn")?.classList.toggle("hidden", !unlimited);
  if (!unlimited && activeModel === "vision") setModel("alpaca");

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
      lockChat("Your trial has ended. Have an access code? Tap 🔑 enter access code, or ask the admin for unlimited access.");
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

// Entering an access code after signing in
$("codeBtn").addEventListener("click", async () => {
  const code = (prompt("Enter your access code:") || "").trim();
  if (!code || !auth.currentUser) return;
  const ref = doc(db, "users", auth.currentUser.uid);
  try {
    await updateDoc(ref, { tier: "unlimited", expiresAt: null, accessCode: code });
    profile = (await getDoc(ref)).data();
    saveSession(auth.currentUser.uid, profile);
    renderTier();
    questionInput.disabled = false;
    sendBtn.disabled = false;
    setModel(activeModel);
    const msg = createAiMessage();
    msg.finish("🎉 **Unlimited access unlocked!** Alpaca Vision and the Code School are open for you now.");
    scrollToBottom();
  } catch {
    addErrorMessage("That access code isn't right. Check it and try again, or ask the admin.");
    scrollToBottom();
  }
});

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
  setMode(answerMode);
  renderTier();
  if (notice) addErrorMessage(notice);
  questionInput.focus();
  forgetOfflineBrain();
  // Neural memory loads quietly once the page is idle.
  (window.requestIdleCallback || ((fn) => setTimeout(fn, 2000)))(() => {
    startMeaning();
    loadKnowledge().catch(() => {});
  });
  stopLearner?.();
  stopLearner = startAutoLearner({ canLearn: hasAccess, onStatus: (t) => ($("learnStatus").textContent = t) });
}

function showAuth() {
  clearInterval(trialTimer);
  stopLearner?.();
  stopLearner = null;
  document.documentElement.classList.remove("has-session");
  chatScreen.classList.add("hidden");
  authScreen.classList.remove("hidden");
  const error = authError.textContent; // keep any sign-in error visible
  setAuthMode("login");
  authError.textContent = error;
  authPassword.value = "";
  authCode.value = "";
  authCode.hidden = true;
  if ($("showCodeBtn")) $("showCodeBtn").hidden = false;
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
      ...(m.thoughts ? { thoughts: m.thoughts.slice(0, 30).map((t) => String(t).slice(0, 300)), thoughtMs: Math.round(m.thoughtMs || 0) } : {}),
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
  if (profile) renderGreeting();
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
      if (item.thoughts) msg.setThoughts(item.thoughts, item.thoughtMs);
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
    // "You might also ask": related questions MK.ai knows the answers to
    setFollowUps(questions) {
      const box = document.createElement("div");
      box.className = "follow-ups";
      const label = document.createElement("span");
      label.textContent = "You might also ask:";
      box.append(label);
      for (const q of questions) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = q;
        b.addEventListener("click", () => {
          questionInput.value = q;
          composer.requestSubmit();
        });
        box.append(b);
      }
      actions.before(box);
    },
    // Reads the answer aloud (after a spoken question).
    speakNow(answer) {
      const speakBtn = actions.querySelector(".speak-btn");
      if (voice.canSpeak) toggleSpeaking(speakBtn, answer);
    },
    setThoughts(steps, ms) {
      const box = el.querySelector(".thoughts");
      box.querySelector("summary").textContent = `🧠 Thought for ${howLong(ms || 0)} · ${steps.length} steps`;
      const list = box.querySelector("ol");
      list.replaceChildren(...steps.map((t) => Object.assign(document.createElement("li"), { textContent: t })));
      box.classList.remove("hidden");
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

const pickOne = (list) => list[Math.floor(Math.random() * list.length)];
const DONT_KNOW = [
  "I don't know that one yet 🤔 I've added it to my learning list, so I'll learn it soon. If you know the answer, teach me below and I'll remember it right away.",
  "Hmm, that's new to me! 🧠 It's on my learning list now. If you know the answer, teach me below.",
];

// MK.ai answers everything itself, in this order, stopping at the first that works:
// 1. Curated answers (the vault: taught and approved in the Training room)
// 2. Its own brain (greetings, small talk, time, maths, conversions, coding)
// 3. The built-in knowledge base, then memory (everything learned or taught, matched by meaning)
// 4. Documents taught in the Training room (it picks out the sentences that answer)
// 5. Wikipedia, for simple "what is / who is" questions
// 6. "I don't know yet": the question goes on its learning list for the Training room
// Outside AI is never used here; it only helps the admin in the Training room.
// think(step) notes what MK.ai is doing, for Deep think's "Thought for …" list.
async function answer(question, onText, attachment = null, think = () => {}) {
  const nothingSaved = Promise.resolve(null);
  // The question asked before this one in the chat (answered or not).
  const asked = (currentChat()?.messages || []).filter((m) => m.role === "user").map((m) => m.text);
  const lastAsked = asked.length > 1 ? asked[asked.length - 2] : "";
  const contextual = dependsOnContext(question, lastAsked ? [lastAsked] : []);

  // A text file sent with the question: MK.ai reads it itself.
  if (attachment) {
    think(`Reading the file ${attachment.name}`);
    logActivity(question, "file");
    const found = wantsSummary(question) ? summarise(attachment.text) : bestSentences(question, attachment.text);
    return {
      answer: found
        ? `${wantsSummary(question) ? "Here's a summary of" : "Here's what"} ${attachment.name}${wantsSummary(question) ? ":" : " says about that:"}\n\n${found}`
        : `I couldn't find that in ${attachment.name}. Try asking with words that appear in the file, or say "summarise this file".`,
      credit: `read by MK.ai from ${attachment.name}`,
      saved: nothingSaved,
      source: "file",
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

  // Pictures and videos: Alpaca Vision (chosen in the model menu, or "draw …")
  if (activeModel === "vision" || isVisionRequest(question)) {
    if (!isUnlimited()) return { answer: unlimitedOnly("Alpaca Vision"), saved: nothingSaved, source: "vision" };
    think("Handing this to Alpaca Vision, my picture and video model");
    logActivity(question, "vision");
    if (activeModel === "vision" && /^(hi|hello|hey|help|what can you (draw|make|do)|how does this work)\b/i.test(question.trim()))
      return { answer: VISION_HELP, saved: nothingSaved, source: "vision" };
    // "stop", "cancel", "ok thanks"… aren't pictures
    if (activeModel === "vision" && /^(stop|cancel|abort|wait|no|nope|never ?mind|ok|okay|thanks|thank you|thankyou|bye|done|enough)\b[\s!.]*(it|that|this|please|pls|now|thanks|thank you)?[\s!.]*$/i.test(question.trim())) {
      const stopped = cancelPhotos();
      const answer = /^(stop|cancel|abort|wait|no|nope|never ?mind|enough)/i.test(question.trim())
        ? stopped
          ? "⏹️ Stopped. I cancelled the real photo, and the drawing stays. Describe another picture whenever you like."
          : "⏹️ Nothing is being made right now. Describe a picture whenever you like."
        : "😊 You're welcome! Describe another picture whenever you like.";
      return { answer, saved: nothingSaved, source: "vision" };
    }
    think("Planned the picture from the description and painted it");
    return { answer: visionAnswer(question), saved: nothingSaved, source: "vision" };
  }

  // Things people tell MK.ai about themselves ("my name is …", "what do you know about me")
  const personal = !attachment && personalAnswer(question, auth.currentUser?.uid);
  if (personal) {
    think("This is about you: using what you've told me");
    return { answer: personal, saved: nothingSaved, source: "local" };
  }
  // "Quiz me on capitals"
  if (!attachment && wantsQuiz(question)) {
    const quiz = await quizAnswer(question).catch(() => null);
    if (quiz) {
      think("Made a quiz question from my knowledge");
      return { answer: quiz, saved: nothingSaved, source: "local" };
    }
  }
  // "Summarise: <pasted text>"
  const pasted = !attachment && question.match(/^(?:please\s+)?(?:summari[sz]e|sum up|give (?:me )?(?:a )?summary of|make (?:a )?summary of)(?:\s+(?:this|the following|it))?(?:\s*(?:text|paragraph|passage))?\s*[:\-]?\s+([\s\S]{200,})$/i);
  if (pasted) {
    think("Picked out the most important sentences");
    return { answer: `📝 **Summary:**\n\n${summarise(pasted[1], 3)}`, saved: nothingSaved, source: "local" };
  }

  think("Checking my own brain (maths, science, coding, conversations)");
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
    think(isLearned ? "Found it in my memory of earlier answers" : "Found a curated answer in the vault");
    return {
      answer: memory.answer,
      credit: credits.join(" · ") || null,
      saved: Promise.resolve(isLearned ? memory.id : null),
      source: isLearned ? "memory" : "vault",
    };
  };

  if (memory && memory.collection === "vault") return fromMemory();

  if (own) {
    think("My own brain worked it out");
    logActivity(question, "local");
    return { answer: own, saved: nothingSaved, source: "local" };
  }

  // Apps and programs MK.ai builds from its tested templates (data/apps.json).
  think("Checking whether it's something I can build");
  const built = await appAnswer(question);
  if (built) {
    think("Picked a tested app template");
    logActivity(question, "app");
    return { answer: built, saved: nothingSaved, source: "app" };
  }

  // The built-in knowledge base (checked answers that ship with MK.ai).
  think("Searching my built-in knowledge base");
  const known = await knowledgeAnswer(searchFor);
  if (known) {
    think(`Matched “${known.question}” (${Math.round(known.score * 100)}% sure)`);
    logActivity(question, "knowledge");
    return { answer: known.answer, saved: nothingSaved, source: "knowledge", matched: known.question };
  }

  if (memory) return fromMemory();

  // Documents taught in the Training room: MK.ai picks out the sentences that answer.
  for (const passage of knowledge.docs || []) {
    const found = passage.score >= 0.6 && bestSentences(searchFor, passage.text);
    if (found) {
      think(`Found it in the document “${passage.title}”`);
      logActivity(question, "document");
      return { answer: found, credit: `from "${passage.title}"`, saved: nothingSaved, source: "document" };
    }
  }

  if (!isTimeSensitive(question)) {
    think("Looking it up on Wikipedia");
    const asked = contextual ? searchFor : question;
    const core = deep.coreQuery(asked);
    const wiki =
      (looksLikeKnowledgeQuestion(asked) && (await wikiAnswer(asked).catch(() => null))) ||
      (await wikiFind(asked).catch(() => null)) ||
      // Not found as asked: search again with just the key words
      (core && core.split(" ").length <= 6 && core !== asked.toLowerCase() ? await wikiFind(core).catch(() => null) : null);
    if (wiki) {
      logActivity(question, "wiki");
      return {
        answer: wiki.answer,
        credit: "from Wikipedia",
        saved: contextual ? nothingSaved : learn(question, wiki.answer, "wikipedia").catch(() => null),
        source: "wiki",
      };
    }
  }

  if (!navigator.onLine) {
    return { answer: "You're offline. 📴 Connect to the internet and ask me again.", saved: nothingSaved, source: "offline" };
  }
  // More open sources: Wiktionary, Tamil Wikipedia, Simple English Wikipedia
  if (!contextual) {
    const more = await researchMore(question).catch(() => null);
    if (more) {
      logActivity(question, "wiki");
      return { answer: more.answer, credit: `from ${more.source}`, saved: learn(question, more.answer, "wikipedia").catch(() => null), source: "wiki" };
    }
  }
  logActivity(question, "unknown");
  // Gibberish isn't worth learning: say so honestly instead of promising to learn it
  if (!worthLearning(question)) {
    return {
      answer: pickOne(["I didn't quite catch that 🤔 Could you ask it another way?", "Hmm, I'm not sure what you mean 🤔 Try asking a full question, like \"what is photosynthesis?\""]),
      saved: nothingSaved,
      source: "unknown",
    };
  }
  if (!contextual) noteUnknown(question);
  return {
    answer: DONT_KNOW[Math.floor(Math.random() * DONT_KNOW.length)],
    saved: nothingSaved,
    teachable: !contextual,
    source: "unknown",
  };
}

const howLong = (ms) => (ms < 1000 ? `${Math.max(1, Math.round(ms))} ms` : `${(ms / 1000).toFixed(1)} s`);

// --- Deep think ---
// Slower and more careful: splits questions with several parts, double-checks
// maths, adds related facts, and tries harder before giving up. Every step is
// kept so the person can see how the answer was reached.
async function deepAnswer(question, onText, attachment, onStep) {
  const started = performance.now();
  const steps = [];
  const think = (text) => {
    steps.push(text);
    onStep(text);
  };
  const done = (result, extra = "") => {
    const answerText = extra ? `${result.answer}\n\n${extra}` : result.answer;
    think(`Done in ${howLong(performance.now() - started)}`);
    return { ...result, answer: answerText, thoughts: steps.slice(0, 30), thoughtMs: performance.now() - started };
  };

  think(`Understanding the question: it looks like ${deep.describe(question)}`);
  const words = keywords(question);
  if (words.length) think(`Key words: ${words.slice(0, 8).join(", ")}`);

  // Several questions in one message: answer each part.
  const parts = attachment ? [question] : deep.splitParts(question);
  if (parts.length > 1) {
    think(`It has ${parts.length} parts, so I'll answer them one by one`);
    const answers = [];
    for (const [i, part] of parts.entries()) {
      think(`Part ${i + 1}: “${part}”`);
      const r = await answer(part, () => {}, null, (t) => think(`  ${t}`));
      const check = r.source === "local" ? deep.verifyMaths(part, r.answer) : null;
      if (check) think(`  ${check}`);
      answers.push(`**${i + 1}. ${part.charAt(0).toUpperCase() + part.slice(1)}?**\n${r.answer}${check ? `\n${check}` : ""}`);
    }
    return done({ answer: answers.join("\n\n"), saved: Promise.resolve(null), source: "parts" });
  }

  let result = await answer(question, onText, attachment, think);

  // Maths from its own brain: work it out a second way.
  if (result.source === "local") {
    const check = deep.verifyMaths(question, result.answer);
    if (check) {
      think(check.startsWith("✓") ? "Double-checked the answer a second way: it holds" : "The double-check didn't agree");
      return done(result, check);
    }
    return done(result);
  }

  // Couldn't find it: try again with just the core words.
  if (result.source === "unknown" || result.source === "offline") {
    const core = deep.coreQuery(question);
    if (core && core !== question.toLowerCase()) {
      think(`Trying harder: searching again for just “${core}”`);
      const known = await knowledgeAnswer(core);
      const again = known ? { answer: known.answer, matched: known.question, source: "knowledge" } : navigator.onLine ? await wikiFind(core).then((w) => w && { answer: w.answer, source: "wiki" }).catch(() => null) : null;
      if (again) {
        think(`Found something close${again.matched ? `: “${again.matched}”` : " on Wikipedia"}`);
        result = { ...result, answer: `I'm not completely sure this is what you meant, but here's the closest I found:\n\n${again.answer}`, credit: again.source === "wiki" ? "from Wikipedia" : null, source: again.source, matched: again.matched };
      } else think("Still nothing, so I'll ask you to teach me");
    }
    return done(result);
  }

  // Facts: add related things it knows.
  if (["knowledge", "memory", "vault", "wiki"].includes(result.source)) {
    think("Looking for related facts I know");
    await loadKnowledge().catch(() => {});
    const related = relatedEntries(question, result.matched || null, 2).filter((r) => !result.answer.includes(deep.firstSentence(r.answer)));
    if (related.length) {
      think(`Adding ${related.length} related fact${related.length > 1 ? "s" : ""}`);
      return done(result, `**Related:**\n${related.map((r) => `- ${r.question} ${deep.firstSentence(r.answer)}`).join("\n")}`);
    }
    think("Nothing related worth adding");
  }
  return done(result);
}

// After "I created you", the next short message is the secret code. It is
// never shown, saved, logged or sent anywhere except to the security rules.
let awaitingCode = false;

async function checkCreatorCode(code) {
  const outcome = await creator.verifyCode(auth.currentUser.uid, code);
  if (outcome === "ok") {
    profile = { ...profile, creator: true };
    saveSession(auth.currentUser.uid, profile);
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
    // Deep think shows what it's doing right now.
    step(text) {
      steps.forEach(clearTimeout);
      if (label) label.lastChild.textContent = ` ${text.trim()}…`;
      label?.classList.add("step");
    },
  };
}

// --- Models: Alpaca (answers) and Alpaca Vision (pictures and videos) ---
const MODEL_KEY = "mkai-model";
let activeModel = "alpaca";
try {
  activeModel = localStorage.getItem(MODEL_KEY) === "vision" ? "vision" : "alpaca";
} catch {}
const VISION_HELP = [
  "🎨 **Alpaca Vision** turns your words into real photos and short photo-videos, plus greeting cards, logos, patterns and charts.",
  "(For photos, your description is sent to the free AI Horde image service — it can take a minute or two; logos, charts and patterns are drawn by Alpaca itself. Say \"offline\" to have Alpaca draw a scene itself.)",
  "",
  "Try:",
  "- a photo of a boy playing in the garden",
  "- a sunset over the sea with palm trees and a boat",
  "- a street in Chennai at night in the rain, cinematic",
  "- an elephant in a forest, 10 second video",
  "- night sky with stars over mountains, **video**",
  "- a temple in a village at sunrise",
  "- rain in a forest at night, 10 second video",
  "- a cat and a dog in a garden, pixel art",
  "- diwali greeting card for Asha from Ravi",
  "- birthday card for Priya, video",
  "- logo for MK Tech, blue",
  "- a kolam pattern, or a mandala video",
  "- bar chart of apples 10, mangoes 25, bananas 15",
  "- outer space with planets and a rocket",
  "",
  "Styles: cinematic, black and white, vintage, neon, anime, oil painting, watercolour, pixel art. Sizes: portrait, square.",
].join("\n");
function setModel(model) {
  activeModel = model;
  try {
    localStorage.setItem(MODEL_KEY, model);
  } catch {}
  const select = $("modelSelect");
  if (select) select.value = model;
  document.querySelector(".mode-switch")?.classList.toggle("hidden", model === "vision");
  questionInput.placeholder = model === "vision" ? "Describe a picture…" : answerMode === "deep" ? "Ask — I'll think it through…" : "Ask me anything…";
}
$("modelSelect")?.addEventListener("change", (e) => setModel(e.target.value));

// The Code School is for unlimited members
document.addEventListener("click", (e) => {
  const link = e.target.closest?.('a[href="learn.html"]');
  if (!link || !profile || isUnlimited()) return;
  e.preventDefault();
  const msg = createAiMessage();
  msg.finish(unlimitedOnly("The Code School"));
  scrollToBottom();
});

// --- Normal / Deep think ---
const MODE_KEY = "mkai-mode";
let answerMode = "normal";
try {
  answerMode = localStorage.getItem(MODE_KEY) === "deep" ? "deep" : "normal";
} catch {}
function setMode(mode) {
  answerMode = mode;
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {}
  document.querySelectorAll(".mode-btn").forEach((b) => {
    const on = b.dataset.mode === mode;
    b.classList.toggle("active", on);
    b.setAttribute("aria-checked", String(on));
  });
  setModel(activeModel);
}
document.querySelectorAll(".mode-btn").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));

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
  const offscreen = { setText() {}, finish() {}, setThoughts() {}, setCredit() {}, enableTeaching() {}, enableVotes() {} };
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
        : answerMode === "deep"
          ? await deepAnswer(question, () => {}, fileForAnswer, (step) => loading.step(step))
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
    if (result.thoughts) msg.setThoughts(result.thoughts, result.thoughtMs);
    if (spoken && stillHere()) msg.speakNow(result.answer);
    if (result.credit) msg.setCredit(result.credit);
    if (result.source === "knowledge" && answerMode !== "deep") {
      const asked = question.trim().toLowerCase().replace(/[?.!]+$/, "");
      const more = relatedEntries(question, result.matched || null, 3)
        .map((r) => r.question)
        .filter((q) => q.toLowerCase().replace(/[?.!]+$/, "") !== asked);
      if (more.length) msg.setFollowUps(more);
    }
    if (result.teachable) msg.enableTeaching(question);
    else if (stillHere() && !isCode) remember(question, result.answer);
    const saved = record(chatId, {
      role: "bot",
      text: result.answer,
      credit: result.credit || null,
      teachable: !!result.teachable,
      ...(result.thoughts ? { thoughts: result.thoughts, thoughtMs: result.thoughtMs } : {}),
    });
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
