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
  getDocs,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { configured, auth, db, friendlyError } from "./firebase.js";
import { lookup, learn, markUsed, vote, votes, logActivity, dependsOnContext, isTimeSensitive, keywords } from "./brain.js";
import { bestSentences, summarise, wantsSummary, sentencesOf } from "./reader.js";
import { knowledgeAnswer, loadKnowledge, relatedEntries, spellFix } from "./kb.js";
import * as deep from "./deepthink.js";
import { appAnswer } from "./apps.js";
import { localAnswer } from "./local.js";
import { wikiAnswer, wikiFind, looksLikeKnowledgeQuestion } from "./wiki.js";
import * as creator from "./creator.js";
import { renderAnswer, registerBlock, setFixHandler, setCodeActionHandler } from "./format.js";
import { isVisionRequest, visionAnswer, mountVision, cancelPhotos } from "./vision.js";
import { askAlpaca, YOUTUBE, WEB_LINK } from "./ai.js";
import { unlockVault } from "./vaultkey.js";
import { noteUnknown, startAutoLearner, researchMore, worthLearning, research } from "./learning.js";
import { personalAnswer, aboutMe } from "./personal.js";
import { wantsQuiz, quizAnswer, mountQuiz } from "./quiz.js";
import { converse, needsCare } from "./converse.js";
import { LIMITS, tokensFor, addUsage, usageSummary, limitReached, resetText, setLimits } from "./limits.js";
import { officeKind, officeAnswer, mountOffice, DOC_EDIT, editOfficeFile } from "./office.js";
import { isVoiceoverRequest, voiceoverAnswer, mountVoiceover } from "./voiceover.js";
import { startMeaning } from "./meaning.js";
import { analyze, nlpNote, nextSteps } from "./nlp.js";
import { applySettings, openSettings, pref } from "./settings.js";
import { toggleSaved, isSaved, openSaved } from "./saved.js";
import { PHOTO_EDIT, editPhoto, renderPhotoBlock, setPhotoKeepEditing } from "./photoedit.js";
import { editVideo, renderVideoBlock } from "./videoedit.js";
import { recentWithin } from "./tokenizer.js";
import * as voice from "./voice.js";
import * as attach from "./attach.js";
import { TRIAL_HOURS } from "../firebase-config.js";

applySettings();
// The hint under the box follows the Enter setting
function updateDeskHint() {
  const hint = document.querySelector(".desk-hint");
  if (hint) hint.textContent = pref("enterSends") ? "Enter to send · Shift + Enter for a new line" : "Ctrl + Enter to send · Enter for a new line";
}
updateDeskHint();
document.addEventListener("mkai-settings", updateDeskHint);

const $ = (id) => document.getElementById(id);
registerBlock("alpaca-vision", mountVision);
registerBlock("mkai-office", mountOffice);
registerBlock("mkai-voice", mountVoiceover);
// "Fix with Alpaca" in an app preview: send the code and the error back to Alpaca
setFixHandler((code, error, lang = "html") => {
  questionInput.value = `Fix this ${lang === "html" ? "app" : `${lang === "python" ? "Python" : "JavaScript"} program`}. When it runs it shows this error:\n${error}\n\nGive me the complete corrected code.\n\n\`\`\`${lang}\n${code}\n\`\`\``;
  composer.requestSubmit();
});
// "✦ Alpaca" on a code block: explain, improve, debug, test or convert it
setCodeActionHandler((code, lang, anchor) => {
  const ask = (instruction) => {
    questionInput.value = `${instruction}\n\n\`\`\`${lang || ""}\n${code}\n\`\`\``;
    composer.requestSubmit();
  };
  const other = ["Python", "JavaScript", "Java", "C++", "C#", "Kotlin"].filter((l) => l.toLowerCase().replace("++", "pp") !== (lang || "").toLowerCase().replace("++", "pp"));
  openMenu(anchor, [
    { heading: "Alpaca on this code" },
    { label: "Explain it line by line", run: () => ask("Explain this code step by step, in simple words, for a learner.") },
    { label: "Find and fix bugs", run: () => ask("Find any bugs or problems in this code, explain them, and give the complete fixed code.") },
    { label: "Improve it", run: () => ask("Improve this code: make it cleaner, faster and more robust, keep the same behaviour, and give the complete improved code with a short list of what changed.") },
    { label: "Add comments", run: () => ask("Add clear, helpful comments to this code and give the complete commented code.") },
    { label: "Write tests", run: () => ask("Write thorough tests for this code (normal cases, edge cases, errors) and explain how to run them.") },
    { label: "Time and space complexity", run: () => ask("What is the time and space complexity of this code? Explain simply and suggest how to make it more efficient.") },
    "-",
    { heading: "Convert to" },
    ...other.slice(0, 4).map((l) => ({ label: l, run: () => ask(`Convert this code to ${l}. Give the complete, working ${l} code and note any differences.`) })),
  ]);
});
// Editing results: photos, videos and code files opened in the studio
registerBlock("mkai-photo", renderPhotoBlock);
registerBlock("mkai-video", renderVideoBlock);
setPhotoKeepEditing((file) => useFile(file));
const studioFiles = new Map(); // id → { code, lang, name }
registerBlock("mkai-studio", (container, text) => {
  let info = {};
  try {
    info = JSON.parse(text);
  } catch {}
  const f = studioFiles.get(info.id);
  const b = Object.assign(document.createElement("button"), { type: "button", className: "photo-btn", textContent: f ? `Open ${f.name} in Code Studio` : "This file isn't open any more (attach it again)" });
  b.disabled = !f;
  b.addEventListener("click", async () => (await import("./editor.js")).openEditor(f.code, f.lang, { fileName: f.name }));
  container.append(b);
});
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
  const wrongCode = "That access code isn't right. You're on the free plan.";

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
  return profile.tier === "unlimited" || profile.tier === "trial";
}
// Free plan: has this account used up its 5-hour or weekly tokens?
const outOfTokens = () => (profile?.tier === "trial" ? limitReached(profile.usage) : null);
function limitMessage(hit) {
  return hit.which === "week"
    ? `You've used this week's free limit (${LIMITS.weekTokens.toLocaleString()} tokens). It resets ${resetText(hit.resetAt)}.`
    : `You've used your free limit for now (${LIMITS.windowTokens.toLocaleString()} tokens per 5 hours). It resets ${resetText(hit.resetAt)}.`;
}
// Counts the tokens of a question and its answer against the free plan
function spendTokens(question, answer) {
  if (profile?.tier !== "trial" || !auth.currentUser) return;
  profile = { ...profile, usage: addUsage(profile.usage, tokensFor(question, answer)) };
  saveSession(auth.currentUser.uid, profile);
  updateDoc(doc(db, "users", auth.currentUser.uid), { usage: profile.usage }).catch((err) => console.warn("Couldn't save usage:", err));
  renderTier();
}

// The creator can step out of creator mode on this device (saying "I created you" brings it back)
const creatorOffKey = () => `mkai-creator-off-${auth.currentUser?.uid || "guest"}`;
const creatorOff = () => {
  try {
    return localStorage.getItem(creatorOffKey()) === "1";
  } catch {
    return false;
  }
};
const isCreator = () => profile?.creator === true && !creatorOff();
const isUnlimited = () => profile?.tier === "unlimited";
// MK.ai's admin (the master account)
const ADMIN_EMAIL = "mkaiadmin@gmail.com";
const isAdmin = () => (auth.currentUser?.email || "").toLowerCase() === ADMIN_EMAIL || profile?.creator === true;
const unlimitedOnly = (what) =>
  `${what === "Alpaca Vision" ? "Pictures are" : "This is"} available to unlimited members.\n\n` +
  "**Want unlimited access?** Tap **Ask for unlimited access** under your email, and the admin will review it. " +
  "People who use MK.ai a lot get it automatically.";

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
  const hellos = [`${part}, ${name}.`, `Hi, ${name}.`, `Hello, ${name}.`, `Vanakkam, ${name}.`, `Welcome back, ${name}.`];
  const subs = [
    "What would you like to know today?",
    "Ask me anything: maths, science, coding or general knowledge.",
    "What shall we explore today?",
    "Got a question? I'm ready.",
    "Pick a topic, any topic.",
  ];
  if (isUnlimited()) subs.push("Want a picture? Switch to Alpaca Vision.", "Learning to code? The Code School is open for you.");
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  $("emptyTitle").textContent = pick(hellos);
  $("emptySub").textContent = pick(subs);
  // Four things to try, a different mix each time
  const ideas = [
    "Solve 2x + 5 = 13", "Differentiate x^3 sin x", "What is 15% of 240?", "Balance H2 + O2 = H2O",
    "Molar mass of H2SO4", "Essay on pollution", "Leave letter to the principal", "Full form of ISRO",
    "When is Engineers' Day?", "Thirukkural on friendship", "Make a calculator app", "What is recursion?",
    "Who invented the telephone?", "Meaning of practice makes perfect", "Quiz me on capitals", "Quiz me on full forms", "What is photosynthesis?", "How to become an IAS officer?",
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

// --- Usage meter for free (trial) users ---
const usageKey = () => `mkai-asked-${auth.currentUser?.uid || "guest"}`;
function countQuestion() {
  try {
    const n = (Number(localStorage.getItem(usageKey())) || 0) + 1;
    localStorage.setItem(usageKey(), String(n));
    $("usageCount").textContent = String(n);
  } catch {}
}
function renderUsage() {
  const trial = profile?.tier === "trial";
  const unlimited = profile?.tier === "unlimited";
  $("usage").hidden = !trial && !unlimited;
  $("sideMeter").hidden = !trial;
  $("creatorExitBtn").hidden = !isCreator();
  $("usagePanel").classList.toggle("unlimited", unlimited);
  let asked = 0;
  try {
    asked = Number(localStorage.getItem(usageKey())) || 0;
  } catch {}
  $("usageCount").textContent = String(asked);
  if (unlimited) {
    $("usageHead").textContent = isCreator() ? "Creator · Unlimited plan" : "Unlimited plan";
    $("usageShort").textContent = "Unlimited";
    $("usageRing").style.setProperty("--used", 100);
    $("usageExtras").textContent = "Included";
    return;
  }
  if (!trial) return;
  const s = usageSummary(profile.usage);
  $("usageHead").textContent = "Free plan usage";
  $("usageExtras").textContent = "Unlimited plan";
  const used = Math.max(s.windowPct, s.weekPct);
  $("usageShort").textContent = `${used}% used`;
  $("usageRing").style.setProperty("--used", used);
  $("usageWinText").textContent = s.windowReset ? `${s.windowPct}% · resets ${resetText(s.windowReset)}` : "0% · starts with your next message";
  $("usageWeekText").textContent = s.weekReset ? `${s.weekPct}% · resets ${resetText(s.weekReset)}` : "0%";
  $("usageWinBar").style.width = `${s.windowPct}%`;
  $("usageWeekBar").style.width = `${s.weekPct}%`;
  $("usageWinBar").parentElement.classList.toggle("low", s.windowPct >= 80);
  $("usageWeekBar").parentElement.classList.toggle("low", s.weekPct >= 80);
  $("sideMeter").firstElementChild.style.width = `${used}%`;
}
$("usageBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  const open = $("usagePanel").hidden;
  $("usagePanel").hidden = !open;
  $("usageBtn").setAttribute("aria-expanded", String(open));
});
document.addEventListener("click", (e) => {
  if (!$("usagePanel").hidden && !e.target.closest("#usage")) {
    $("usagePanel").hidden = true;
    $("usageBtn").setAttribute("aria-expanded", "false");
  }
});
$("creatorExitBtn").addEventListener("click", () => {
  try {
    localStorage.setItem(creatorOffKey(), "1");
  } catch {}
  renderTier();
  emptyState.classList.contains("hidden") || renderGreeting();
  const msg = createAiMessage();
  msg.finish('You\'ve left creator mode on this device, so MK.ai treats you as a normal member now. To come back, say **"I created you"** and enter your creator code.');
  emptyState.classList.add("hidden");
  scrollToBottom();
});
$("usageCodeBtn").addEventListener("click", () => {
  $("usagePanel").hidden = true;
  $("codeBtn").click();
});

function renderTier() {
  clearInterval(trialTimer);
  renderUsage();
  renderGreeting();
  // Alpaca Vision and the Code School only appear for unlimited members
  const unlimited = isUnlimited();
  $("codeBtn").hidden = true;
  renderAccessRequest();
  $("learnLink")?.classList.toggle("hidden", !unlimited);
  $("emptyLearn")?.classList.toggle("hidden", !unlimited);
  if (!unlimited && activeModel === "vision") setModel("alpaca");

  if (profile.tier === "unlimited") {
    renderUsage();
    tierBadge.textContent = isCreator() ? "creator · unlimited" : "unlimited";
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
    renderUsage();
    const hit = outOfTokens();
    tierBadge.textContent = `${isCreator() ? "creator · " : ""}free plan${hit ? " · limit reached" : ""}`;
    tierBadge.className = `tier-badge ${hit ? "expired" : "trial"}`;
    if (hit) {
      lockChat(limitMessage(hit));
      noteLimitHit(hit);
    } else if (questionInput.disabled && !answering) {
      questionInput.disabled = false;
      sendBtn.disabled = false;
      setModel(activeModel);
    }
  };

  update();
  trialTimer = setInterval(update, 30000);
}

// --- Unlimited access: ask the admin, or get it automatically after reaching the
// weekly limit on 5 different weeks ---
const AUTO_UNLIMITED_AFTER = 5;
function renderAccessRequest() {
  const btn = $("askAccessBtn");
  const note = $("upgradeNote");
  if (!btn || !note) return;
  if (!profile || isUnlimited() || profile.tier !== "trial") {
    btn.hidden = true;
    note.hidden = true;
    return;
  }
  const req = profile.accessRequest?.status;
  const hits = profile.limitHits || 0;
  btn.hidden = req === "pending";
  btn.textContent = req === "rejected" ? "Ask again for unlimited access" : "Ask for unlimited access";
  note.hidden = false;
  note.textContent =
    req === "pending"
      ? "Request sent. The admin will review it soon."
      : req === "rejected"
        ? "The admin said not yet. Keep using MK.ai: he may give it when you use it more."
        : hits
          ? `Weekly limit reached ${hits} of ${AUTO_UNLIMITED_AFTER} times. At ${AUTO_UNLIMITED_AFTER}, unlimited access turns on by itself.`
          : `Heavy users get unlimited access automatically after reaching the weekly limit ${AUTO_UNLIMITED_AFTER} times.`;
}
$("askAccessBtn")?.addEventListener("click", async () => {
  if (!auth.currentUser || !profile) return;
  const ref = doc(db, "users", auth.currentUser.uid);
  try {
    await updateDoc(ref, { accessRequest: { status: "pending", at: serverTimestamp() } });
    profile = { ...profile, accessRequest: { status: "pending", at: new Date() } };
    saveSession(auth.currentUser.uid, profile);
    renderAccessRequest();
    toast("Request sent to the admin.");
  } catch (err) {
    console.warn("Access request:", err);
    toast("Couldn't send the request. Try again later.");
  }
});
// Called when the free limit is reached: counts weekly-limit weeks (at most one per 6 days)
// and turns on unlimited access at the fifth.
let countingHit = false;
async function noteLimitHit(hit) {
  if (hit?.which !== "week" || countingHit || !auth.currentUser || profile?.tier !== "trial") return;
  const last = profile.limitHitAt?.toMillis?.() ?? (profile.limitHitAt ? new Date(profile.limitHitAt).getTime() : 0);
  const ref = doc(db, "users", auth.currentUser.uid);
  countingHit = true;
  try {
    if (!last || Date.now() - last > 6 * 86400000) {
      const limitHits = (profile.limitHits || 0) + 1;
      await updateDoc(ref, { limitHits, limitHitAt: serverTimestamp() });
      profile = { ...profile, limitHits, limitHitAt: new Date() };
    }
    if ((profile.limitHits || 0) >= AUTO_UNLIMITED_AFTER) {
      await updateDoc(ref, { tier: "unlimited", expiresAt: null, autoUnlimited: true });
      profile = { ...profile, tier: "unlimited", expiresAt: null, autoUnlimited: true };
      saveSession(auth.currentUser.uid, profile);
      renderTier();
      questionInput.disabled = false;
      sendBtn.disabled = false;
      setModel(activeModel);
      const msg = createAiMessage();
      msg.finish(`**Unlimited access is on.** You've reached the weekly limit ${AUTO_UNLIMITED_AFTER} times, so MK.ai upgraded you automatically. Thank you for using MK.ai so much!`);
      scrollToBottom();
      return;
    }
    saveSession(auth.currentUser.uid, profile);
    renderAccessRequest();
  } catch (err) {
    console.warn("Couldn't count the weekly limit:", err);
  } finally {
    countingHit = false;
  }
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
    msg.finish("**Unlimited access unlocked.** Alpaca Vision and the Code School are now available to you.");
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
  setModel(activeModel);
  renderTier();
  loadControl();
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
      if (!item.teachable && !/^•+$/.test(lastQuestion || "")) msg.enableSave(lastQuestion);
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
  chats.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  for (const chat of chats) {
    const g = chat.pinned ? "Pinned" : dayGroup(chat.updatedAt);
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
    const more = document.createElement("button");
    more.type = "button";
    more.className = "chat-more";
    more.innerHTML = DOTS;
    more.title = "More";
    more.setAttribute("aria-label", `More options: ${chat.title}`);
    more.addEventListener("click", (e) => {
      e.stopPropagation();
      openMenu(more, chatMenu(chat.id));
    });
    if (chat.pinned) open.prepend(Object.assign(document.createElement("span"), { className: "pin-mark", innerHTML: PIN_ICON }));
    item.append(open, more);
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

// --- "⋯" menus ---
const DOTS = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>';
const PIN_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 17v5M9 3h6l-1 6 4 4H6l4-4-1-6z"/></svg>';
let menuEl = null;
function closeMenu() {
  menuEl?.remove();
  menuEl = null;
}
// items: [{ label, run, danger }] or "-" for a divider
function openMenu(anchor, items) {
  closeMenu();
  menuEl = document.createElement("div");
  menuEl.className = "pop-menu";
  menuEl.setAttribute("role", "menu");
  for (const it of items) {
    if (it === "-") {
      menuEl.append(Object.assign(document.createElement("hr"), { className: "pop-sep" }));
      continue;
    }
    if (it.heading) {
      menuEl.append(Object.assign(document.createElement("div"), { className: "pop-heading", textContent: it.heading }));
      continue;
    }
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "menuitem");
    b.className = "pop-item" + (it.danger ? " danger" : "") + (it.checked ? " checked" : "");
    b.textContent = it.label;
    if (it.sub) b.append(Object.assign(document.createElement("span"), { className: "pop-sub", textContent: it.sub }));
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      closeMenu();
      it.run();
    });
    menuEl.append(b);
  }
  document.body.append(menuEl);
  const r = anchor.getBoundingClientRect();
  const w = menuEl.offsetWidth;
  const h = menuEl.offsetHeight;
  menuEl.style.left = `${Math.max(8, Math.min(r.right - w, innerWidth - w - 8))}px`;
  menuEl.style.top = `${r.bottom + 4 + h > innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4}px`;
  menuEl.querySelector("button")?.focus();
}
document.addEventListener("click", (e) => menuEl && !menuEl.contains(e.target) && closeMenu());
document.addEventListener("keydown", (e) => e.key === "Escape" && closeMenu());
addEventListener("resize", closeMenu);

function chatText(chat) {
  return chat.messages.map((m) => `${m.role === "user" ? "You" : "MK.ai"}: ${m.text || ""}`).join("\n\n");
}
function renameChat(id) {
  const chat = store.chats.find((c) => c.id === id);
  if (!chat) return;
  const name = prompt("Rename chat", chat.title);
  if (!name || !name.trim()) return;
  chat.title = name.trim().slice(0, 120);
  saveChats();
  uploadChat(id);
  renderChatList();
  if (store.currentId === id) $("chatTitle").textContent = chat.title;
}
function togglePin(id) {
  const chat = store.chats.find((c) => c.id === id);
  if (!chat) return;
  chat.pinned = !chat.pinned;
  saveChats();
  renderChatList();
}
async function shareChat(id) {
  const chat = store.chats.find((c) => c.id === id);
  if (!chat) return;
  const text = `${chat.title}\n\n${chatText(chat)}\n\n— shared from MK.ai (https://mkai-c042b.web.app)`;
  try {
    if (navigator.share) return await navigator.share({ title: chat.title, text });
  } catch (err) {
    if (err?.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast("Chat copied. Paste it anywhere to share.");
  } catch {
    toast("Couldn't share this chat.");
  }
}
function downloadChat(id) {
  const chat = store.chats.find((c) => c.id === id);
  if (!chat) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([`# ${chat.title}\n\n${chatText(chat)}\n`], { type: "text/markdown" }));
  a.download = `${chat.title.replace(/[^\w -]+/g, "").trim().replace(/\s+/g, "-").slice(0, 50) || "chat"}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function chatMenu(id) {
  const chat = store.chats.find((c) => c.id === id);
  return [
    { label: "Rename", run: () => renameChat(id) },
    { label: chat?.pinned ? "Unpin" : "Pin", run: () => togglePin(id) },
    { label: "Share", run: () => shareChat(id) },
    { label: "Download", run: () => downloadChat(id) },
    { label: "Print or save as PDF", run: () => printChat(id) },
    "-",
    { label: "Delete", danger: true, run: () => deleteChat(id) },
  ];
}
// Print / save as PDF: a clean copy of the whole chat, without the app around it
function printChat(id) {
  const chat = store.chats.find((c) => c.id === id);
  if (!chat) return;
  document.getElementById("printView")?.remove();
  const view = document.createElement("article");
  view.id = "printView";
  const h = document.createElement("h1");
  h.textContent = chat.title;
  const meta = document.createElement("p");
  meta.className = "print-meta";
  meta.textContent = `MK.ai chat · ${new Date(chat.updatedAt || Date.now()).toLocaleString()}`;
  view.append(h, meta);
  for (const m of chat.messages) {
    const block = document.createElement("section");
    block.className = m.role === "user" ? "print-q" : "print-a";
    const who = document.createElement("p");
    who.className = "print-who";
    who.textContent = m.role === "user" ? "You" : "MK.ai";
    const body = document.createElement("div");
    if (m.role === "user") body.textContent = m.text;
    else renderAnswer(body, m.text || "");
    block.append(who, body);
    view.append(block);
  }
  document.body.append(view);
  document.body.classList.add("print-mode");
  const done = () => {
    document.body.classList.remove("print-mode");
    view.remove();
  };
  window.addEventListener("afterprint", done, { once: true });
  setTimeout(() => window.print(), 50);
}
function toast(text) {
  const t = Object.assign(document.createElement("div"), { className: "toast", textContent: text });
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}
$("chatMoreTop")?.addEventListener("click", (e) => {
  e.stopPropagation();
  const id = store.currentId;
  const items = id && store.chats.some((c) => c.id === id) ? [...chatMenu(id).slice(0, 4), "-"] : [];
  items.push(
    { label: "New chat", run: newChat },
    ...(voice.canListen && voice.canSpeak ? [{ label: voiceChat ? "End voice chat" : "Voice chat (hands-free)", run: () => setVoiceChat(!voiceChat) }] : []),
    {
      label: `Personality: ${PERSONAS[persona].label.replace(" (default)", "")}`,
      run: () => {
        const btn = $("chatMoreTop");
        setTimeout(() => openMenu(btn, Object.entries(PERSONAS).map(([k, v]) => ({ label: `${k === persona ? "✓ " : ""}${v.label}`, run: () => setPersona(k) }))), 0);
      },
    },
    { label: "Saved answers", run: () => openSaved({ onAsk: (q) => ((questionInput.value = q), composer.requestSubmit()) }) },
    { label: "Settings", run: openSettings },
    { label: "Keyboard shortcuts", run: showShortcuts },
    { label: "About MK.ai", run: () => (location.href = "about.html") },
  );
  if (id && store.chats.some((c) => c.id === id)) items.push("-", { label: "Delete chat", danger: true, run: () => deleteChat(id) });
  openMenu(e.currentTarget, items);
});

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
  if (slashMenu && ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key)) return slashKey(e);
  // Enter sends (or adds a line, if chosen in Settings; then Ctrl+Enter sends)
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing && (pref("enterSends") || e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    composer.requestSubmit();
  }
});

// --- Quick commands: type "/" in the box for a list of shortcuts ---
const SLASH = [
  { cmd: "code", hint: "Write a program", text: "Write complete, working code for: " },
  { cmd: "debug", hint: "Find and fix a bug", text: "Find and fix the bug in this code, then explain the fix:\n" },
  { cmd: "explain", hint: "Explain simply", text: "Explain simply, with an example: " },
  { cmd: "diagram", hint: "A flowchart or mind map", text: "Make a flowchart diagram of " },
  { cmd: "summarise", hint: "Short summary", text: "Summarise: " },
  { cmd: "translate", hint: "Into Tamil (or any language)", text: "Translate into Tamil: " },
  { cmd: "quiz", hint: "5 questions to test yourself", text: "Make a 5-question quiz with answers on " },
  { cmd: "notes", hint: "Study notes", text: "Make short study notes with key points on " },
  { cmd: "essay", hint: "An essay", text: "Write an essay on " },
  { cmd: "email", hint: "A polite email or letter", text: "Write a polite, professional email about " },
  { cmd: "image", hint: "Make a picture", text: "Draw a picture of " },
  { cmd: "deep", hint: "Deep thinking for the next question", run: () => { deepOnce = true; toast("Deep thinking is on for your next question."); } },
  { cmd: "new", hint: "Start a new chat", run: () => newChat() },
];
let slashMenu = null;
let slashItems = [];
let slashIndex = 0;
function closeSlash() {
  slashMenu?.remove();
  slashMenu = null;
}
function useSlash(item) {
  closeSlash();
  questionInput.value = item.run ? "" : item.text;
  if (item.run) item.run();
  fitQuestion();
  questionInput.focus();
  questionInput.setSelectionRange(questionInput.value.length, questionInput.value.length);
}
function showSlash() {
  const m = questionInput.value.match(/^\/(\w*)$/);
  if (!m) return closeSlash();
  slashItems = SLASH.filter((c) => c.cmd.startsWith(m[1].toLowerCase()));
  if (!slashItems.length) return closeSlash();
  if (!slashMenu) {
    slashMenu = document.createElement("div");
    slashMenu.className = "slash-menu";
    slashMenu.setAttribute("role", "listbox");
    composer.append(slashMenu);
  }
  slashIndex = Math.min(slashIndex, slashItems.length - 1);
  slashMenu.replaceChildren(
    ...slashItems.map((c, i) => {
      const b = Object.assign(document.createElement("button"), { type: "button", className: "slash-item" + (i === slashIndex ? " active" : "") });
      b.setAttribute("role", "option");
      b.append(Object.assign(document.createElement("span"), { className: "slash-cmd", textContent: `/${c.cmd}` }), Object.assign(document.createElement("span"), { className: "slash-hint", textContent: c.hint }));
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => useSlash(c));
      return b;
    })
  );
}
function slashKey(e) {
  e.preventDefault();
  if (e.key === "Escape") return closeSlash();
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    slashIndex = (slashIndex + (e.key === "ArrowDown" ? 1 : -1) + slashItems.length) % slashItems.length;
    return showSlash();
  }
  useSlash(slashItems[slashIndex]);
}
questionInput.addEventListener("input", () => {
  slashIndex = questionInput.value.length <= 1 ? 0 : slashIndex;
  showSlash();
});
questionInput.addEventListener("blur", () => setTimeout(closeSlash, 150));

// --- Keyboard shortcuts ---
const SHORTCUTS = [
  ["/", "Focus the question box (then / again for commands)"],
  ["Ctrl + K", "Search chats"],
  ["Ctrl + Shift + O", "New chat"],
  ["Ctrl + Shift + C", "Copy the last answer"],
  ["Esc", "Stop the answer"],
  ["Shift + Enter", "New line"],
];
function showShortcuts() {
  const d = document.createElement("dialog");
  d.className = "shortcuts-dialog";
  d.append(Object.assign(document.createElement("p"), { className: "shortcuts-title", textContent: "Keyboard shortcuts" }));
  for (const [k, what] of SHORTCUTS) {
    const row = Object.assign(document.createElement("div"), { className: "shortcut-row" });
    row.append(Object.assign(document.createElement("kbd"), { textContent: k }), Object.assign(document.createElement("span"), { textContent: what }));
    d.append(row);
  }
  const ok = Object.assign(document.createElement("button"), { type: "button", textContent: "Close" });
  ok.addEventListener("click", () => d.close());
  d.append(ok);
  d.addEventListener("close", () => d.remove());
  document.body.append(d);
  d.showModal();
}
document.addEventListener("keydown", (e) => {
  if ($("chatScreen").classList.contains("hidden") || document.querySelector(".studio, dialog[open]")) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === "Escape" && stopCurrent && !slashMenu && !menuEl) {
    e.preventDefault();
    return stopCurrent();
  }
  if (mod && !e.shiftKey && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (window.innerWidth < 900) $("sidebarOpen")?.click();
    return $("chatSearch").focus();
  }
  if (mod && e.shiftKey && e.key.toLowerCase() === "o") {
    e.preventDefault();
    return newChat();
  }
  if (mod && e.shiftKey && e.key.toLowerCase() === "c" && !window.getSelection()?.toString()) {
    const last = currentChat()?.messages.filter((m) => m.role === "bot").pop()?.text;
    if (!last) return;
    e.preventDefault();
    navigator.clipboard?.writeText(last).then(() => toast("Last answer copied."), () => {});
    return;
  }
  if (e.key === "/" && !typing && !mod) {
    e.preventDefault();
    questionInput.focus();
  }
});

function addUserMessage(text, attachment = null) {
  const node = tUser.content.cloneNode(true);
  node.querySelector(".msg-body").textContent = text;
  // Edit: put the message back in the box to change and send again
  if (!/^•+$/.test(text)) {
    const edit = Object.assign(document.createElement("button"), { type: "button", className: "edit-q-btn", textContent: "Edit", title: "Edit and send again" });
    edit.addEventListener("click", () => {
      questionInput.value = text.replace(/^📎[^\n]*\n/, "");
      fitQuestion();
      questionInput.focus();
    });
    node.querySelector(".msg-body").after(edit);
  }
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

  // Streaming: text is revealed smoothly and steadily as it arrives (it never
  // restarts), with a cursor while more is coming.
  const stream = { target: "", shown: 0, raf: 0, done: false };
  let answerText = "";
  const reveal = () => {
    stream.raf = 0;
    const left = stream.target.length - stream.shown;
    if (left > 0) {
      stream.shown += Math.max(2, Math.ceil(left / 10));
      stream.shown = Math.min(stream.shown, stream.target.length);
    }
    const complete = stream.done && stream.shown >= stream.target.length;
    renderAnswer(body, complete ? stream.target : stream.target.slice(0, stream.shown) + " ▍");
    if (!complete && (stream.shown < stream.target.length || !stream.done)) {
      if (stream.shown < stream.target.length) stream.raf = requestAnimationFrame(reveal);
    }
    if (complete) stream.onDone?.();
  };
  return {
    setText(text) {
      stream.target = text;
      if (document.hidden) {
        stream.shown = text.length;
        renderAnswer(body, text + " ▍");
        return;
      }
      if (!stream.raf) stream.raf = requestAnimationFrame(reveal);
    },
    finish(answer, searchSuggestions) {
      answerText = answer;
      if (stream.target) {
        // Already streaming: carry on to the end without starting over
        cancelAnimationFrame(stream.raf);
        stream.target = answer;
        stream.shown = Math.min(stream.shown, answer.length);
        stream.done = true;
        if (document.hidden) stream.shown = answer.length;
        stream.raf = requestAnimationFrame(reveal);
      } else typeOut(body, answer);
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
          copyBtn.textContent = "Copied";
          setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
        } catch {}
      });
      actions.classList.remove("hidden");
    },
    // "Save": keep this answer in Saved answers
    enableSave(question) {
      const btn = actions.querySelector(".save-btn");
      if (!btn || !answerText) return;
      const show = (on) => {
        btn.textContent = on ? "Saved" : "Save";
        btn.classList.toggle("on", on);
        btn.setAttribute("aria-pressed", String(on));
      };
      show(isSaved(question, answerText));
      btn.classList.remove("hidden");
      btn.addEventListener("click", () => {
        const on = toggleSaved(question, answerText);
        show(on);
        toast(on ? "Saved. Find it in ⋯ › Saved answers." : "Removed from saved answers.");
      });
    },
    // "Retry": ask Alpaca again for a fresh, better answer
    enableRetry(question) {
      const btn = actions.querySelector(".retry-btn");
      if (!btn || !question) return;
      btn.classList.remove("hidden");
      btn.addEventListener("click", () => {
        retryOnce = true;
        questionInput.value = question;
        composer.requestSubmit();
      });
    },
    // "More detail" (Deep think) and "Simpler" for explanations
    setRefine(question) {
      const box = document.createElement("div");
      box.className = "refine";
      const more = document.createElement("button");
      more.type = "button";
      more.textContent = "More detail";
      more.addEventListener("click", () => {
        deepOnce = true;
        questionInput.value = question;
        composer.requestSubmit();
      });
      const simpler = document.createElement("button");
      simpler.type = "button";
      simpler.textContent = "Simpler";
      simpler.addEventListener("click", () => {
        questionInput.value = `explain simply: ${question}`;
        composer.requestSubmit();
      });
      box.append(more, simpler);
      actions.append(box);
    },
    // "You might also ask": related questions MK.ai knows the answers to
    setFollowUps(questions, title = "You might also ask:") {
      const box = document.createElement("div");
      box.className = "follow-ups";
      const label = document.createElement("span");
      label.textContent = title;
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
      if (voice.canSpeak) toggleSpeaking(speakBtn, answer, () => voiceChat && setTimeout(() => voiceChat && !stopVoiceTyping && micBtn.click(), 350));
    },
    setThoughts(steps, ms) {
      const box = el.querySelector(".thoughts");
      box.querySelector("summary").textContent = `Thought for ${howLong(ms || 0)} · ${steps.length} steps`;
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
            textContent: "Thanks! I'll remember that from now on.",
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
  if (speakingBtn) speakingBtn.textContent = "Listen";
  speakingBtn = null;
}
function toggleSpeaking(btn, text, onDone) {
  const wasThis = speakingBtn === btn;
  voice.stopSpeaking();
  resetSpeakingBtn();
  if (wasThis) return;
  speakingBtn = btn;
  btn.classList.add("speaking");
  btn.textContent = "Stop";
  voice.speak(text, {
    onEnd: () => {
      if (speakingBtn === btn) resetSpeakingBtn();
      onDone?.();
    },
  });
}

function addErrorMessage(message) {
  const node = tError.content.cloneNode(true);
  node.querySelector(".msg-body").textContent = message;
  thread.appendChild(node);
}

// Answers appear as if being typed (about half a second), like other AI
// assistants. Code, pictures, quizzes and very short answers show at once.
function typeOut(container, text) {
  const instant = text.length < 60 || text.includes("```") || matchMedia("(prefers-reduced-motion: reduce)").matches || document.hidden;
  if (instant) return renderAnswer(container, text);
  const frames = 30;
  const step = Math.ceil(text.length / frames);
  let shown = 0;
  const tick = () => {
    shown = Math.min(text.length, shown + step);
    renderAnswer(container, shown < text.length ? text.slice(0, shown) + " ▍" : text);
    if (shown < text.length) requestAnimationFrame(tick);
  };
  tick();
}

function scrollToBottom() {
  thread.scrollTop = thread.scrollHeight;
}

const pickOne = (list) => list[Math.floor(Math.random() * list.length)];
// --- Alpaca's router ---
const ALPACA_LABEL = {
  pro: "✦ Alpaca Pro",
  live: "✦ Alpaca Live · searched the web",
  deep: "✦ Alpaca Deep",
  follow: "✦ Alpaca Pro",
  video: "✦ Alpaca Pro · watched the video",
  link: "✦ Alpaca Pro · read the page",
  study: "✦ Alpaca Pro · study pack",
};
const ALPACA_STEP = {
  live: "Alpaca Live: searching the web for the latest",
  deep: "Alpaca Deep: thinking it through step by step",
  video: "Alpaca is watching the video",
  link: "Alpaca is reading the page",
  study: "Alpaca is making your study pack",
};
// Coding questions get Alpaca's senior-engineer standard automatically
const CODE_ASK = /```|\b(code|coding|program|programming|function|class|method|bug|debug|error|exception|compile|algorithm|api|sql|regex|html|css|javascript|typescript|python|java|c\+\+|c#|kotlin|swift|flutter|react|node|django|flask|firebase|git|leetcode|data structure|array|linked list|recursion|loop)\b/i;
const CODER_NOTE = `This is a coding request. Answer like a world-class senior engineer:
- Understand exactly what's needed first; if something is ambiguous, pick the sensible default and say so in one line.
- Give complete, correct, runnable code (never placeholders or "…"), with the right language on each fenced block, clear names and brief comments where they help.
- For a multi-file project, put each file in its own fenced block with its file name in bold on the line just before it (for example **index.html**).
- Handle edge cases and errors; prefer simple, modern, secure, efficient solutions; mention time/space complexity for algorithms.
- After the code: how to run it, a quick example of input and output, and (for bugs) what was wrong and why the fix works.`;

// What the person told MK.ai about themselves, so Alpaca can tailor its answers
function personalNote() {
  const me = aboutMe(auth.currentUser?.uid) || {};
  const bits = [];
  if (me.name) bits.push(`their name is ${me.name}`);
  if (me.class || me.grade) bits.push(`they are in ${me.class || me.grade}`);
  if (me.city || me.place) bits.push(`they live in ${me.city || me.place}`);
  const likes = [].concat(me.likes || []).filter(Boolean);
  if (likes.length) bits.push(`they like ${likes.slice(0, 5).join(", ")}`);
  return bits.length ? `About the person you're talking to (use this naturally when it helps; don't repeat it back): ${bits.join("; ")}.` : "";
}

// Alpaca personalities: how Pro answers are written (chosen in the ⋯ menu)
const PERSONAS = {
  assistant: { label: "Assistant (default)", note: "" },
  tutor: { label: "Tutor", note: "Personality: a patient teacher. Explain step by step with simple examples, check understanding, and for homework give hints and guide the student to the answer instead of only giving it, unless they ask for the full answer." },
  coder: { label: "Coder", note: "Personality: a senior software engineer. Give complete, correct, well-structured code with brief comments, mention edge cases and complexity when relevant, prefer modern best practices, and explain how to run it. Keep prose short." },
  writer: { label: "Writer", note: "Personality: a skilled writer and editor. Write polished, natural, well-structured text in the right format and tone (letters, emails, essays, posts, speeches), and offer a short improved alternative when useful." },
  career: { label: "Career guide", note: "Personality: a practical career counsellor for Indian students and job seekers. Give realistic paths, courses, entrance exams, skills, salaries in ₹ and next steps." },
  friend: { label: "Friend", note: "Personality: a warm, supportive friend. Be kind, casual and encouraging, keep answers short and conversational." },
};
const PERSONA_KEY = "mkai-persona";
let persona = (() => {
  try {
    const p = localStorage.getItem(PERSONA_KEY);
    return PERSONAS[p] ? p : "assistant";
  } catch {
    return "assistant";
  }
})();
function personaNote() {
  return PERSONAS[persona]?.note || "";
}
function setPersona(p) {
  persona = PERSONAS[p] ? p : "assistant";
  try {
    localStorage.setItem(PERSONA_KEY, persona);
  } catch {}
  // The chosen style shows on the model button ("Alpaca · Coder")
  const name = document.querySelector("#modelBtn .model-name");
  if (name) name.textContent = name.textContent.split(" · ")[0] + (persona !== "assistant" ? ` · ${PERSONAS[persona].label}` : "");
}
setPersona(persona);
$("personaBadge")?.addEventListener("click", (e) => {
  e.stopPropagation();
  openMenu(e.currentTarget, Object.entries(PERSONAS).map(([k, v]) => ({ label: `${k === persona ? "✓ " : ""}${v.label}`, run: () => setPersona(k) })));
});

// "Make a study pack / notes / flashcards / mock test on …"
const STUDY_ASK = /\b(study pack|study material|revision notes|short notes|make notes|notes (on|for|about)|flash ?cards|mock test|practice test|question paper|important questions|test paper|worksheet)\b/i;
const STUDY_NOTE = `The user wants study material. Make a complete, well-organised study pack for their topic and level (assume Indian school syllabus, CBSE/State Board, if a class is given):
1. **Key notes**: the important points as short, clear bullets, with definitions, formulas and examples.
2. **Flashcards**: 8-10 as "**Q:** … / **A:** …".
3. **Practice questions**: 5 multiple-choice (options a-d) and 3 short-answer questions.
4. **Answer key** at the end.
If they asked for only one part (for example only flashcards or only a question paper), give just that part, done well.`;
// Asking for writing, reasoning, advice or code (not a plain "what is X")
const PRO_ASK =
  /^(please |pls |can you |could you |kindly )?(write|compose|draft|create|generate|explain|why|how (do|does|did|can|could|would|should|to|is|are|was|were|will|much|many|long)|compare|contrast|what(?:'s| is| are) the (difference|best|pros|advantages|disadvantages|benefits|reasons?|causes?|effects?|impact)|differentiate|plan|suggest|recommend|give me|help me|translate|rewrite|rephrase|improve|correct|fix|debug|solve|analy[sz]e|review|evaluate|describe|elaborate|discuss|list|outline|prepare|teach me|guide me|should i|is it (good|bad|safe|better|worth)|which is better|what should|what would|what if|brainstorm|tips|ideas)\b/i;
// Asking for something to be written or made, not answered
const WRITE_ASK = /^(please |pls |can you |could you |kindly )?(write|compose|draft|create|generate|translate|rewrite|rephrase|improve|correct|fix|debug|review|brainstorm|prepare)\b|```|\b(code|program|essay|letter|email|story|poem|speech|paragraph|article)\b/i;
// The admin's controls from the vault (settings/control), read at sign-in
let control = {};
async function loadControl() {
  try {
    const snap = await getDoc(doc(db, "settings", "control"));
    control = snap.exists() ? snap.data() : {};
  } catch {
    control = {};
  }
  setLimits(control);
  window.MKAI_NO_RUN = control.code === false;
  const bar = $("announceBar");
  if (bar) {
    bar.textContent = control.announcement || "";
    bar.hidden = !control.announcement;
  }
  if (control.maintenance && !isAdmin()) lockChat("MK.ai is being updated by the admin. Please come back in a little while.");
  renderTier();
  if (isAdmin() && control.autoPromote !== false) setTimeout(promoteLearned, 4000);
}
// While the admin is signed in, everything MK.ai has learned moves into the vault
// (answers people marked unhelpful stay out), a few hundred at a time.
async function promoteLearned() {
  try {
    const snap = await getDocs(query(collection(db, "learned"), limit(200)));
    const good = snap.docs.filter((d) => {
      const e = d.data();
      const { up, down } = votes(e);
      return e.question && e.answer && !(down > 0 && down >= up);
    });
    if (!good.length) return;
    const batch = writeBatch(db);
    for (const d of good) {
      const e = d.data();
      batch.set(doc(collection(db, "vault")), { question: e.question, answer: e.answer, keywords: keywords(e.question).slice(0, 50), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      batch.delete(d.ref);
    }
    await batch.commit();
  } catch (err) {
    console.warn("Auto-promote:", err);
  }
}

// What MK.ai's own brain is exact at: maths, units, time and date, who it is
const INSTANT_ASK = /^(what(?:'s| is)? (the )?(time|date|day)|what day is|who (made|created|built|developed|owns) you|who is your (creator|owner|developer)|what can you do|help|what are your features|what (ai |)(model|version) (are you|is this)|who are you|what is your name|convert\b|\d)|\b(to|in) (km|miles?|kg|pounds?|lbs?|celsius|fahrenheit|°?[cf]|metres?|meters?|feet|ft|inches|cm|mm|litres?|liters?|gallons?|rupees?|inr|usd|dollars?)\b|[\d)]\s*[-+*/×÷^%=]\s*[\d(]|\b(sqrt|square root|cube root|factorial|percent|% of|log|sin|cos|tan|derivative|differentiate|integrate|integral|solve|simplify|factori[sz]e|lcm|hcf|gcd|prime)\b/i;
// "Alpaca" (automatic), "pro", "deep" or "vision" from the model menu; the admin can
// also force every answer to "pro" or "instant" from the vault
function routeMode() {
  if (control.mode === "instant" || control.mode === "pro") return control.mode;
  return activeModel === "pro" || activeModel === "deep" ? "pro" : "auto";
}
function alpacaRoute(question, { contextual = false, deep = false } = {}) {
  const q = question.trim();
  if (!worthLearning(q) && !contextual) return null;
  if (deep) return "deep";
  if (isTimeSensitive(q)) return "live";
  if (contextual) return "follow";
  if (PRO_ASK.test(q) || q.split(/\s+/).length > 14 || /```|\b(code|program|function|error|bug|essay|letter|email|story|poem|speech|paragraph|article)\b/i.test(q)) return "pro";
  return null;
}

const DONT_KNOW = [
  "I don't know that one yet. I've added it to my learning list, so I'll learn it soon. If you know the answer, teach me below and I'll remember it right away.",
  "Hmm, that's new to me! It's on my learning list now. If you know the answer, teach me below.",
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
// Attachments with an editing instruction go to the right editor; plain
// questions about a file ("what's in this photo?") are answered as usual.
const ASKING = /^(what|who|whom|whose|where|why|which|when|how (many|much|old|long|does|do|is|are|can|did)|is |are |does |do |did |describe|explain|summari[sz]e|tell me|read|list|count|identify|analy[sz]e|review)\b/i;
const CODE_FILE = /\.(js|mjs|ts|py|java|c|cpp|h|cs|html|css|sql|sh|json|xml|ya?ml|php|rb|go|rs|kt|swift|dart)$/i;
const CODE_EDIT = /\b(edit|open|fix|debug|refactor|improve|add|change|rename|convert|optimi[sz]e|clean( it)? up|format|update|rewrite|remove|implement)\b/i;
const LANG_OF = { js: "javascript", mjs: "javascript", ts: "javascript", py: "python", java: "java", c: "c", cpp: "cpp", h: "c", cs: "text", html: "html", css: "css", sql: "sql", json: "json" };
async function editAttachment(question, att, think, signal, fresh = true) {
  const nothingSaved = Promise.resolve(null);
  const q = question.trim();
  // Code in the message, or a long follow-up about an earlier file, isn't an edit of that file
  if (/```/.test(q) || (!fresh && q.length > 160)) return null;
  if (att.kind === "video") {
    const r = editVideo(att, q);
    if (r.edited) think("Editing your video on this device");
    return { answer: r.answer, saved: nothingSaved, source: "edit" };
  }
  if (ASKING.test(q)) return null;
  if (att.kind === "image" && PHOTO_EDIT.test(q)) {
    think("Editing your photo");
    const r = await editPhoto(att, q, think);
    return { answer: r.answer, saved: nothingSaved, source: "edit" };
  }
  if (att.office && DOC_EDIT.test(q)) {
    think(`Alpaca is editing ${att.name}`);
    const answer = await editOfficeFile(att.office, q, { signal }).catch((err) => (console.warn("Edit:", err), null));
    return answer
      ? { answer, credit: `✦ Alpaca edited ${att.name}`, saved: nothingSaved, source: "edit" }
      : { answer: "Alpaca couldn't edit the file right now. Try again in a minute.", saved: nothingSaved, source: "edit" };
  }
  if (att.kind === "text" && !att.office && CODE_FILE.test(att.name) && CODE_EDIT.test(q)) {
    const ext = att.name.split(".").pop().toLowerCase();
    const lang = LANG_OF[ext] || ext;
    // "open it" just opens; anything more is sent to Alpaca inside the studio
    const request = /^(please\s+)?(open|edit)( it| this( file| code)?| the (file|code))?( in (the )?(editor|code studio|studio))?[.!]?$/i.test(q) ? "" : q;
    const id = `s${Date.now().toString(36)}`;
    studioFiles.set(id, { code: att.text, lang, name: att.name });
    const { openEditor } = await import("./editor.js");
    openEditor(att.text, lang, { fileName: att.name, request });
    think(`Opened ${att.name} in Code Studio`);
    return {
      answer: `I opened **${att.name}** in Alpaca Code Studio${request ? " and asked Alpaca to make your change. Tap **Changes** to see exactly what changed, **Undo** to go back, and **⬇ Download** to save the file" : ". Edit it yourself or tell Alpaca what to change; **⬇ Download** saves the file"}.\n\n\`\`\`mkai-studio\n${JSON.stringify({ id })}\n\`\`\``,
      saved: nothingSaved,
      source: "edit",
    };
  }
  return null;
}

async function answer(question, onText, attachment = null, think = () => {}, opts = {}) {
  const nothingSaved = Promise.resolve(null);
  // The question asked before this one in the chat (answered or not).
  const asked = (currentChat()?.messages || []).filter((m) => m.role === "user").map((m) => m.text);
  const lastAsked = asked.length > 1 ? asked[asked.length - 2] : "";
  const contextual = dependsOnContext(question, lastAsked ? [lastAsked] : []);
  // NLP first: language, kind of message, key words and token count
  const nlp = analyze(question);
  const langNote = nlpNote(nlp);
  think(`Read your message: ${nlp.intent === "statement" ? "a message" : `a ${nlp.intent}`} in ${nlp.language}, ${nlp.tokens} token${nlp.tokens === 1 ? "" : "s"}`);

  // Editing: a photo, video, Word/PowerPoint/Excel or code file with an instruction
  if (attachment) {
    const edited = await editAttachment(question, attachment, think, opts.signal, opts.freshFile !== false);
    if (edited) return edited;
  }

  // A photo, PDF or text file: Alpaca reads it (photos and PDFs need the big models).
  if (attachment && navigator.onLine) {
    think(`Alpaca is reading ${attachment.name}`);
    const seen = await askAlpaca(question, recentWithin(history, 6, 3000), { good: [], bad: [], docs: [] }, onText, { creator: isCreator(), attachment, deep: opts.deep, system: langNote, signal: opts.signal }).catch((err) => (console.warn("Alpaca:", err), null));
    if (seen?.answer) {
      logActivity(question, "file");
      return { answer: seen.answer, credit: `✦ Alpaca read ${attachment.name}`, saved: nothingSaved, source: "alpaca" };
    }
  }
  if (attachment && attachment.kind !== "text") {
    return {
      answer: navigator.onLine
        ? "I couldn't read that file right now. The big models are busy. Try again in a minute, or copy the text in and ask me about it."
        : "Reading photos and PDFs needs the internet. Connect and try again.",
      saved: nothingSaved,
      source: "file",
    };
  }
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

  async function tryAlpaca(route, knowledge = { good: [], bad: [], docs: [] }) {
    think(ALPACA_STEP[route] || "Alpaca Pro: writing a full answer");
    const system = [
      control.instructions ? `Instructions from MK.ai's admin (follow them): ${control.instructions}` : "",
      route === "study" ? STUDY_NOTE : personaNote(),
      CODE_ASK.test(question) && persona !== "coder" ? CODER_NOTE : "",
      personalNote(),
      langNote,
      opts.retry ? "The user asked again because they want a better answer than before: give a fresh, more complete and more accurate answer." : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const pro = await askAlpaca(question, recentWithin(history, 8, 3000), knowledge, onText, { creator: isCreator(), deep: opts.deep, system, signal: opts.signal }).catch((err) => (console.warn("Alpaca:", err), null));
    if (!pro?.answer) return null;
    const keep = route === "pro" && !contextual && !pro.partial && !isTimeSensitive(question) && worthLearning(question) && question.length < 400;
    logActivity(question, "alpaca");
    return {
      answer: pro.answer,
      credit: ALPACA_LABEL[route] + (isCreator() && pro.by ? ` · via ${pro.by.replace(/^geminikey:/, "Gemini key: ").replace(/^gemini:/, "Firebase Gemini: ")}` : ""),
      searchSuggestions: pro.searchSuggestions,
      saved: keep ? learn(question, pro.answer, "ai").catch(() => null) : nothingSaved,
      source: "alpaca",
    };
  }
  // Straight to Alpaca: code pasted with a question ("fix this"), a YouTube video or
  // web page link ("summarise https://…"), or a study pack
  const direct = /```[\s\S]{20,}```/.test(question) ? "pro" : YOUTUBE.test(question) ? "video" : WEB_LINK.test(question) ? "link" : STUDY_ASK.test(question) ? "study" : null;
  if (!attachment && direct && navigator.onLine) {
    const pro = await tryAlpaca(opts.deep ? "deep" : direct);
    if (pro) return pro;
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
  // In Alpaca Vision, a question ("who is Gemini?") is answered, not drawn
  const visionHelp = /^(hi|hello|hey|help|what can you (draw|make|do)|how does this work)\b/i.test(question.trim());
  const asksQuestion = !visionHelp && (/^(who|what|why|how|when|where|which|whose|is|are|was|were|do|does|did|can|could|should|would|will|explain|define|tell me)\b/i.test(question.trim()) || /\?\s*$/.test(question));
  if ((activeModel === "vision" && !(asksQuestion && !isVisionRequest(question))) || isVisionRequest(question)) {
    if (!isUnlimited()) return { answer: unlimitedOnly("Alpaca Vision"), saved: nothingSaved, source: "vision" };
    if (control.vision === false && !isAdmin()) return { answer: "Alpaca Vision is switched off by the admin for now. Please try again later.", saved: nothingSaved, source: "vision" };
    think("Handing this to Alpaca Vision, my picture and video model");
    logActivity(question, "vision");
    if (activeModel === "vision" && /^(hi|hello|hey|help|what can you (draw|make|do)|how does this work)\b/i.test(question.trim()))
      return { answer: isAdmin() ? VISION_HELP : VISION_HELP.replace(" and short photo-videos", "").split("\n").filter((l) => !/\bvideo\b/i.test(l)).join("\n"), saved: nothingSaved, source: "vision" };
    // "stop", "cancel", "ok thanks"… aren't pictures
    if (activeModel === "vision" && /^(stop|cancel|abort|wait|no|nope|never ?mind|ok|okay|thanks|thank you|thankyou|bye|done|enough)\b[\s!.]*(it|that|this|please|pls|now|thanks|thank you)?[\s!.]*$/i.test(question.trim())) {
      const stopped = cancelPhotos();
      const answer = /^(stop|cancel|abort|wait|no|nope|never ?mind|enough)/i.test(question.trim())
        ? stopped
          ? "⏹️ Stopped. I cancelled the real photo, and the drawing stays. Describe another picture whenever you like."
          : "⏹️ Nothing is being made right now. Describe a picture whenever you like."
        : "You're welcome! Describe another picture whenever you like.";
      return { answer, saved: nothingSaved, source: "vision" };
    }
    think("Planned the picture from the description and painted it");
    return { answer: visionAnswer(question, { allowVideo: isAdmin() }), saved: nothingSaved, source: "vision" };
  }

  // Someone in distress gets care and helplines before anything else
  if (!attachment && needsCare(question)) {
    think("This sounds serious: sharing people who can help right now");
    return { answer: converse(question), saved: nothingSaved, source: "local" };
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
  // "Explain simply: X": the same answer in fewer, easier words
  const simply = !attachment && question.match(/^explain (?:it |this |that )?(?:simply|in simple words|in simple terms|like i'?m (?:5|five|a kid|a child))[:,]?\s+([\s\S]{3,})$/i);
  if (simply) {
    const topic = simply[1].trim();
    think("Looking for an easier explanation");
    const easy = await researchMore(topic).catch(() => null);
    const base = easy?.source === "Simple English Wikipedia" ? easy : await answer(topic, () => {}, null, think);
    // Lists ("**Weather** - … **Climate** - …"): the first point of each part
    const parts = base.answer
      .split(/\n\s*\n/)
      .map((block) => block.match(/^\*\*(.+?)\*\*\s*\n\s*[-*]\s+(.+)/))
      .filter(Boolean);
    const first =
      parts.length >= 2
        ? "\n" + parts.map((m) => `- **${m[1]}:** ${m[2]}`).join("\n")
        : sentencesOf(base.answer.replace(/\*\*/g, "")).slice(0, 2).join(" ");
    return { answer: `**In simple words:** ${first || base.answer}`, saved: nothingSaved, source: "local", credit: easy?.source === "Simple English Wikipedia" ? "from Simple English Wikipedia" : null };
  }
  // "Summarise: <pasted text>"
  const pasted = !attachment && question.match(/^(?:please\s+)?(?:summari[sz]e|sum up|give (?:me )?(?:a )?summary of|make (?:a )?summary of)(?:\s+(?:this|the following|it))?(?:\s*(?:text|paragraph|passage))?\s*[:\-]?\s+([\s\S]{200,})$/i);
  if (pasted) {
    if (navigator.onLine && routeMode() !== "instant") {
      const pro = await tryAlpaca("pro");
      if (pro) return pro;
    }
    think("Picked out the most important sentences");
    return { answer: `**Summary**\n\n${summarise(pasted[1], 3)}`, saved: nothingSaved, source: "local" };
  }

  // PowerPoint, Word and Excel files
  if (!attachment && officeKind(question) && (control.office !== false || isAdmin())) {
    think("Researching the topic and building the file");
    const office = await officeAnswer(question).catch((err) => (console.warn(err), null));
    if (office) return { answer: office, saved: nothingSaved, source: "local" };
  }

  // AI voiceover: a script (given or written by MK.ai) read aloud
  if (!attachment && isVoiceoverRequest(question) && (control.voice !== false || isAdmin())) {
    think("Writing the voiceover script");
    const voice = await voiceoverAnswer(question).catch((err) => (console.warn(err), null));
    if (voice) return { answer: voice, saved: nothingSaved, source: "local" };
  }

  // Quick small talk ("hi", "thanks", "good night") is answered instantly; anything
  // longer (stories, advice, jokes, feelings) is Alpaca's.
  const aiFirst = navigator.onLine && routeMode() !== "instant";
  const quickChat = !aiFirst || question.trim().split(/\s+/).length <= 4;
  const chat = quickChat && !attachment && (!isCreator() || !localAnswer(question, { creator: true })) && converse(question);
  if (chat) {
    think("Talking with you like a friend");
    return { answer: chat, saved: nothingSaved, source: "local" };
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

  if (memory && memory.collection === "vault" && !opts.retry) return fromMemory();

  // Alpaca-first: MK.ai's own brain answers only what it is exact at (maths,
  // conversions, time, who it is); an exact earlier Alpaca answer is reused.
  const exactOwn = own && (INSTANT_ASK.test(question.trim()) || /\d/.test(question) || question.trim().split(/\s+/).length <= 3);
  if (aiFirst && !opts.retry && memory && memory.collection === "learned" && !memory.similarTo && ["ai", "taught"].includes(memory.source || "ai")) return fromMemory();
  if (own && (!aiFirst || exactOwn)) {
    think("My own brain worked it out");
    logActivity(question, "local");
    return { answer: own, saved: nothingSaved, source: "local" };
  }

  // Apps and programs MK.ai builds from its tested templates (data/apps.json).
  think("Checking whether it's something I can build");
  const built = await appAnswer(question, onText);
  if (built) {
    think("Picked a tested app template");
    logActivity(question, "app");
    return { answer: built, saved: nothingSaved, source: "app" };
  }

  // Alpaca Pro and Live: writing, explaining, advice, code, follow-ups and
  // anything about now go to the big models first; plain facts stay instant.
  // A document the admin taught answers questions about itself directly
  for (const passage of knowledge.docs || []) {
    const found = passage.score >= 0.6 && bestSentences(searchFor, passage.text);
    if (found) {
      think(`Found it in the document “${passage.title}”`);
      logActivity(question, "document");
      return { answer: found, credit: `from "${passage.title}"`, saved: nothingSaved, source: "document" };
    }
  }

  let route = alpacaRoute(question, { contextual, deep: opts.deep });
  if (opts.retry && navigator.onLine && !route) route = "pro";
  // Alpaca answers everything else; what MK.ai already knows is given to it as facts
  if (aiFirst && !route && (worthLearning(question) || contextual)) route = "pro";
  if (!aiFirst) route = null;
  if (route) {
    const kb = await knowledgeAnswer(searchFor).catch(() => null);
    if (kb && kb.score >= 0.6) knowledge = { ...knowledge, good: [{ question: kb.question, answer: kb.answer, curated: true }, ...(knowledge.good || [])] };
    if (own) knowledge = { ...knowledge, good: [{ question, answer: own }, ...(knowledge.good || [])] };
    const pro = await tryAlpaca(route, knowledge);
    if (pro) return pro;
    think("The big models are busy, so I'm answering from my own knowledge");
  }
  // Big models unavailable: MK.ai's own friendly replies for everyday talk
  const talk = !quickChat && !attachment && converse(question);
  if (talk) {
    think("Talking with you like a friend");
    return { answer: talk, saved: nothingSaved, source: "local" };
  }
  if (own) {
    think("My own brain worked it out");
    logActivity(question, "local");
    return { answer: own, saved: nothingSaved, source: "local" };
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

  // "Did you mean …?": a spelling slip away from something MK.ai knows
  if (!contextual) {
    await loadKnowledge().catch(() => {});
    const fix = spellFix(question);
    if (fix) {
      think(`Fixed the spelling: “${fix.hit.question}”`);
      return { answer: `Did you mean **“${fix.hit.question}”**?\n\n${fix.hit.answer}`, saved: nothingSaved, source: "knowledge", matched: fix.hit.question };
    }
  }

  if (!navigator.onLine) {
    return { answer: "You're offline. Connect to the internet and ask me again.", saved: nothingSaved, source: "offline" };
  }
  // More open sources: Wiktionary, Tamil Wikipedia, Simple English Wikipedia
  if (!contextual) {
    const more = await researchMore(question).catch(() => null);
    if (more) {
      logActivity(question, "wiki");
      return { answer: more.answer, credit: `from ${more.source}`, saved: learn(question, more.answer, "wikipedia").catch(() => null), source: "wiki" };
    }
  }
  // Still unknown: MK.ai's teacher, Gemini, answers, and MK.ai keeps the answer in
  // its memory so next time it answers on its own.
  if (worthLearning(question) && routeMode() !== "instant") {
    think("Asking Alpaca Pro");
    const taught = await askAlpaca(question, recentWithin(history, 6, 3000), knowledge, onText, { creator: isCreator(), deep: opts.deep, system: [personaNote(), langNote].filter(Boolean).join("\n\n"), signal: opts.signal }).catch((err) => (console.warn("Gemini:", err), null));
    // News, prices and scores change, so those answers aren't kept
    const fresh = isTimeSensitive(question);
    if (taught?.answer) {
      logActivity(question, "alpaca");
      return {
        answer: taught.answer,
        credit: fresh ? ALPACA_LABEL.live : `${ALPACA_LABEL.pro} · saved to my memory`,
        searchSuggestions: taught.searchSuggestions,
        saved: contextual || fresh || taught.partial ? nothingSaved : learn(question, taught.answer, "ai").catch(() => null),
        source: "gemini",
      };
    }
  }
  logActivity(question, "unknown");
  // Gibberish isn't worth learning: say so honestly instead of promising to learn it
  if (!worthLearning(question)) {
    return {
      answer: pickOne(["I didn't quite catch that. Could you ask it another way?", "Hmm, I'm not sure what you mean. Try asking a full question, like \"what is photosynthesis?\""]),
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

  let result = await answer(question, onText, attachment, think, { deep: true });

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
    try {
      localStorage.removeItem(creatorOffKey());
    } catch {}
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
  const saved = localStorage.getItem(MODEL_KEY);
  activeModel = ["vision", "pro", "deep"].includes(saved) ? saved : localStorage.getItem("mkai-mode") === "deep" ? "deep" : "alpaca";
} catch {}
const VISION_HELP = [
  "**Alpaca Vision** turns your words into real photos and short photo-videos, plus greeting cards, logos, patterns and charts.",
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
// The model menu: which Alpaca answers, and in which style
const MODELS = {
  alpaca: { label: "Alpaca", about: "Fast, smart answers" },
  pro: { label: "Alpaca Pro", about: "The big model for every answer" },
  deep: { label: "Alpaca Pro (Deep thinking)", about: "Thinks step by step, checks its work" },
  vision: { label: "Alpaca Vision", about: "Pictures and videos" },
};
function setModel(model) {
  if (!MODELS[model]) model = "alpaca";
  if (model === "vision" && profile && !isUnlimited()) model = "alpaca";
  activeModel = model;
  answerMode = model === "deep" ? "deep" : "normal";
  try {
    localStorage.setItem(MODEL_KEY, model);
    localStorage.setItem(MODE_KEY, answerMode);
  } catch {}
  const select = $("modelSelect");
  if (select) select.value = model === "vision" ? "vision" : "alpaca";
  const btn = $("modelBtn");
  if (btn) {
    const style = persona !== "assistant" && model !== "vision" ? ` · ${PERSONAS[persona].label}` : "";
    btn.querySelector(".model-name").textContent = MODELS[model].label + style;
  }
  questionInput.placeholder = model === "vision" ? "Describe a picture…" : model === "deep" ? "Ask — I'll think it through…" : "Ask me anything…";
}
$("modelSelect")?.addEventListener("change", (e) => setModel(e.target.value));
function modelMenu() {
  const items = [{ heading: "Models" }];
  for (const [k, m] of Object.entries(MODELS)) {
    if (k === "vision" && !isUnlimited()) continue;
    items.push({ label: m.label, sub: k === "vision" && !isAdmin() ? "Pictures" : m.about, checked: k === activeModel, run: () => setModel(k) });
  }
  items.push("-", { heading: "Style" });
  for (const [k, p] of Object.entries(PERSONAS)) items.push({ label: p.label.replace(" (default)", ""), checked: k === persona, run: () => (setPersona(k), setModel(activeModel)) });
  return items;
}
$("modelBtn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  openMenu(e.currentTarget, modelMenu());
});

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
  // Normal / Deep think now live in the model menu: Deep = Alpaca Pro (Deep thinking)
  if (mode === "deep") setModel("deep");
  else if (activeModel === "deep") setModel("alpaca");
  document.querySelectorAll(".mode-btn").forEach((b) => {
    const on = b.dataset.mode === mode;
    b.classList.toggle("active", on);
    b.setAttribute("aria-checked", String(on));
  });
}
document.querySelectorAll(".mode-btn").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));

let deepOnce = false; // "more detail" asks one question with Deep think
let retryOnce = false; // "Retry" asks Alpaca again for a fresh answer
composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (answering) return; // one answer at a time (the button is Stop meanwhile)
  const deepNow = answerMode === "deep" || deepOnce;
  deepOnce = false;
  const retryNow = retryOnce;
  retryOnce = false;
  if (questionInput.value.trim() || pendingAttachment) countQuestion();
  const attachment = pendingAttachment;
  let question = questionInput.value.trim().slice(0, 4000);
  if (!question && !attachment) return;
  if (!question) question = attach.defaultQuestion(attachment);
  if (!hasAccess() || outOfTokens()) {
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
  const offscreen = { setText() {}, finish() {}, setThoughts() {}, setCredit() {}, enableTeaching() {}, enableVotes() {}, setFollowUps() {}, setRefine() {}, enableRetry() {}, enableSave() {} };
  const showBubble = () => {
    if (!stillHere()) return offscreen;
    if (!bubble) {
      loading.remove();
      bubble = createAiMessage();
    }
    return bubble;
  };

  // Stop: the send button becomes ■ while answering; pressing it ends the answer
  // there (keeping what was already written) and cancels the request.
  let partial = "";
  const stopCtrl = new AbortController();
  globalThis.mkaiStop = stopCtrl.signal;
  const stopped = new Promise((resolve) => {
    stopCurrent = () => {
      stopCtrl.abort();
      cancelPhotos();
      resolve({ answer: partial ? `${partial}\n\n(Stopped.)` : "Stopped. Ask again whenever you're ready.", saved: Promise.resolve(null), source: "stopped" });
    };
  });
  setStopMode(true);

  try {
    const result = await Promise.race([
      (async () =>
        isCode
          ? await checkCreatorCode(question)
          : cancelled
            ? { answer: creator.replies.cancelled(), saved: Promise.resolve(null) }
            : deepNow
              ? await deepAnswer(question, () => {}, fileForAnswer, (step) => loading.step(step))
              : await answer(
                  question,
                  (text) => {
                    if (stopCtrl.signal.aborted) return;
                    partial = text;
                    showBubble().setText(text);
                    scrollToBottom();
                  },
                  fileForAnswer,
                  undefined,
                  { retry: retryNow, signal: stopCtrl.signal, freshFile: !!attachment }
                ))(),
      stopped,
    ]);
    const msg = showBubble();
    msg.finish(result.answer, result.searchSuggestions);
    spendTokens(question, result.answer);
    if (result.thoughts) msg.setThoughts(result.thoughts, result.thoughtMs);
    if (spoken && stillHere()) msg.speakNow(result.answer);
    if (result.credit) msg.setCredit(result.credit);
    if (result.source === "knowledge" && !deepNow) {
      const asked = question.trim().toLowerCase().replace(/[?.!]+$/, "");
      const more = relatedEntries(question, result.matched || null, 3)
        .map((r) => r.question)
        .filter((q) => q.toLowerCase().replace(/[?.!]+$/, "") !== asked);
      if (more.length) msg.setFollowUps(more);
    } else if (!deepNow && !isCode && !cancelled && ["alpaca", "wiki", "memory", "vault"].includes(result.source) && stillHere()) {
      // Smart next steps, chosen from what was asked (NLP)
      const steps = nextSteps(question, result.answer);
      if (steps.length) msg.setFollowUps(steps, "Next:");
    }
    if (!isCode && !cancelled && result.source !== "stopped" && !result.teachable) msg.enableSave(question);
    if (["knowledge", "wiki"].includes(result.source) && !deepNow && result.answer.length > 120 && !result.answer.includes("```")) msg.setRefine(question);
    if (!isCode && !cancelled && !result.teachable && ["alpaca", "knowledge", "wiki", "memory", "vault", "local", "app"].includes(result.source) && navigator.onLine) msg.enableRetry(question);
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
    stopCurrent = null;
    if (globalThis.mkaiStop === stopCtrl.signal) globalThis.mkaiStop = null;
    setStopMode(false);
    answering = false;
    sendBtn.disabled = !hasAccess();
    questionInput.focus();
    scrollToBottom();
  }
});

// --- Stop button ---
let stopCurrent = null;
const SEND_ICON = sendBtn.innerHTML;
const STOP_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none"/></svg>';
function setStopMode(on) {
  sendBtn.classList.toggle("stop-mode", on);
  sendBtn.innerHTML = on ? STOP_ICON : SEND_ICON;
  sendBtn.title = on ? "Stop" : "Send";
  sendBtn.setAttribute("aria-label", on ? "Stop answering" : "Send");
  if (on) sendBtn.disabled = false;
}
sendBtn.addEventListener("click", (e) => {
  if (!stopCurrent) return;
  e.preventDefault();
  stopCurrent();
});

// --- Hidden vault entrance: tap the MK logo 5 times, then enter the vault password ---
// (The database checks the password; it isn't in the website's code.)
let clickCount = 0;
let clickTimer = null;
secretMark.addEventListener("click", () => {
  clickCount += 1;
  clearTimeout(clickTimer);
  clickTimer = setTimeout(() => (clickCount = 0), 3000);
  if (clickCount >= 5) {
    clickCount = 0;
    $("vaultGatePass").value = "";
    $("vaultGateError").textContent = "";
    $("vaultGate").showModal();
    $("vaultGatePass").focus();
  }
});
$("vaultGateCancel").addEventListener("click", () => $("vaultGate").close());
$("vaultGateForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pass = $("vaultGatePass").value.trim();
  if (!pass) return;
  $("vaultGateError").textContent = "Checking…";
  try {
    await unlockVault(pass);
    window.location.href = "vault.html";
  } catch (err) {
    $("vaultGateError").textContent = err.code === "wrong" ? "Wrong password." : err.code === "signin" ? "Sign in first." : "Couldn't check the password. Try again.";
    $("vaultGatePass").select();
  }
});

// --- Attachments: photos, PDFs and text files ---
const attachInput = $("attachInput");
const attachChip = $("attachChip");
let pendingAttachment = null;
const lastAttachment = new Map(); // chat id → its most recent file, for follow-ups
// MK.ai reads text and code files itself; photos and PDFs would need outside AI.
attachInput.accept = attach.ACCEPT;

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

// --- Voice chat: hands-free, back and forth (listen, answer aloud, listen) ---
let voiceChat = false;
function setVoiceChat(on) {
  voiceChat = on && voice.canListen && voice.canSpeak;
  $("voiceChatBar")?.classList.toggle("hidden", !voiceChat);
  if (!voiceChat) {
    stopVoiceTyping?.();
    voice.stopSpeaking();
    resetSpeakingBtn();
  } else if (!stopVoiceTyping) micBtn.click();
}
$("voiceChatEnd")?.addEventListener("click", () => setVoiceChat(false));

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
        } else if (voiceChat) setVoiceChat(false);
      },
      onError: (code) => {
        stopVoiceTyping = null;
        setListening(false);
        if (voiceChat) setVoiceChat(false);
        if (code !== "aborted" && code !== "no-speech") addErrorMessage(voice.listenErrorMessage(code));
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
