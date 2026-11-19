// Team Training Room. Team members enter the team code once (checked by the database's
// security rules, never stored in this code) and can then add, edit and export training
// examples, and nothing else. The admin (vault owner) can also approve or reject examples.
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  doc, getDoc, updateDoc, deleteField, collection, addDoc, getDocs, query, orderBy, limit,
  serverTimestamp, deleteDoc,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

const $ = (id) => document.getElementById(id);
const LICENCES = ["own", "public-domain", "cc0", "cc-by", "cc-by-sa"];
const AI_SIGNS = /\b(as an ai (language )?model|i'm an ai|i am an ai|chatgpt|openai|gemini|claude|anthropic|i cannot browse)\b/i;
// Signs that text was pasted straight from a chatbot (markdown, chatty openers/closers).
const PASTED = /(\*\*|^\s*(#{1,6}\s|[-*•]\s|\d+[.)]\s.*\n\s*\d+[.)]\s)|\b(sure!|certainly!|great question|i hope this helps|let me know if|feel free to))/im;
const PRIVATE = /(\b\d{10}\b|\b\d{4}\s?\d{4}\s?\d{4}\b|[\w.+-]+@[\w-]+\.[\w.]+)/;
let user = null, admin = false, rows = [], editing = null;

const show = (id) => ["trSignin", "trJoin", "trRoom"].forEach((s) => ($(s).hidden = s !== id));
const msg = (el, text, kind = "") => { el.textContent = text; el.className = `tr-msg ${kind}`; };

// Same checks as nova-llm/check_contrib.py, so problems are caught while typing.
export function checkExample(r, opts = {}) {
  const q = String(r.question || "").trim(), a = String(r.answer || "").trim();
  const lic = String(r.licence || "").trim().toLowerCase(), src = String(r.source || "").trim();
  if (!q || q.length > 500) return "The question must be 1–500 characters.";
  if (!a || a.length > 2000) return "The answer must be 1–2000 characters.";
  if (!LICENCES.includes(lic)) return "Pick a licence from the list.";
  if (!src) return "Say where it came from (\"written for Nova\" if you wrote it).";
  if (lic.startsWith("cc-by") && !/^https?:\/\//.test(src)) return "CC-BY needs a link to the source.";
  if (AI_SIGNS.test(a)) return "This looks copied from an AI service. Please write it yourself.";
  if (PASTED.test(a)) return "This looks pasted from a chatbot (bold text, bullet points or chatty words). Write it as 1–3 plain sentences in your own words.";
  if (!opts.imported && a.length > 600 && lic === "own") return "That's long. Keep it to 1–3 short sentences in your own words (under 600 letters).";
  if (PRIVATE.test(q + " " + a)) return "This looks like private data (a phone, ID or email). Remove it.";
  if (rows.some((x) => x.id !== editing && x.question.toLowerCase() === q.toLowerCase() && x.answer === a)) return "This exact example is already here.";
  return null;
}

async function isAdminNow() {
  try {
    await getDoc(doc(db, "settings", "ai")); // only the admin may read this
    return true;
  } catch {
    return false;
  }
}

async function enter() {
  try {
    await getDocs(query(collection(db, "trainingData"), limit(1)));
  } catch (err) {
    if (err?.code === "permission-denied") return show("trJoin");
    throw err;
  }
  admin = await isAdminNow();
  $("trMQ").hidden = !admin;
  show("trRoom");
  for (const o of $("trFilter").options) if (["pending", "all"].includes(o.value)) o.textContent = o.value === "pending" ? (admin ? "Waiting for your review" : "Waiting for review") : "All";
  await load();
  loadModelInfo();
}

$("trJoinForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = $("trCode").value.trim();
  if (!code) return;
  msg($("trJoinMsg"), "Checking…");
  try {
    await updateDoc(doc(db, "users", user.uid), { trainer: true, trainerCode: code });
    await updateDoc(doc(db, "users", user.uid), { trainerCode: deleteField() }).catch(() => {});
    $("trCode").value = "";
    msg($("trJoinMsg"), "Welcome to the team!", "good");
    await enter();
  } catch (err) {
    msg($("trJoinMsg"), err?.code === "permission-denied" ? "That code isn't right." : "Couldn't check the code. Try again.", "bad");
  }
});

async function load() {
  const snap = await getDocs(query(collection(db, "trainingData"), orderBy("createdAt", "desc"), limit(1000)));
  rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  render();
}

function render() {
  const f = $("trFilter").value;
  const list = rows.filter((r) => f === "all" || (f === "mine" ? r.createdBy === user.uid : r.status === f));
  const mine = rows.filter((r) => r.createdBy === user.uid);
  const count = (s) => rows.filter((r) => r.status === s).length;
  $("trStats").replaceChildren(
    ...[["Your examples", mine.length], ["Waiting for review", count("pending")], ["Approved", count("approved")], ["Team total", rows.length]].map(([k, v]) => {
      const d = document.createElement("div");
      d.append(Object.assign(document.createElement("b"), { textContent: v }), k);
      return d;
    }),
  );
  $("trList").replaceChildren(
    ...(list.length ? list.slice(0, 300).map(item) : [Object.assign(document.createElement("li"), { textContent: "Nothing here yet." })]),
  );
}

function btn(label, fn, cls = "ghost small") {
  const b = Object.assign(document.createElement("button"), { type: "button", className: `tr-btn ${cls}`, textContent: label });
  b.addEventListener("click", fn);
  return b;
}

function item(r) {
  const li = document.createElement("li");
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.append(
    Object.assign(document.createElement("span"), { className: `tr-pill ${r.status}`, textContent: r.status }),
    `${r.topic || "general"} · ${r.licence} · by ${r.author || "?"}`,
  );
  const own = r.createdBy === user.uid && r.status === "pending";
  if (own || admin) meta.append(btn("Edit", () => startEdit(r)));
  if (own || admin) meta.append(btn("Delete", () => remove(r), "ghost small danger"));
  if (admin && r.status !== "approved") meta.append(btn("Approve", () => setStatus(r, "approved"), "small"));
  if (admin && r.status !== "rejected") meta.append(btn("Reject", () => setStatus(r, "rejected"), "ghost small"));
  li.append(Object.assign(document.createElement("div"), { className: "q", textContent: r.question }), Object.assign(document.createElement("div"), { className: "a", textContent: r.answer }), meta);
  return li;
}

function formValue() {
  return { question: $("fQ").value.trim(), answer: $("fA").value.trim(), topic: ($("fT").value.trim() || "general").slice(0, 40), licence: $("fL").value, source: $("fS").value.trim() };
}

function startEdit(r) {
  editing = r.id;
  $("fQ").value = r.question;
  $("fA").value = r.answer;
  setTopic(r.topic || "general");
  $("fL").value = r.licence;
  $("fS").value = r.source;
  $("fSave").textContent = "Save changes";
  $("fCancel").hidden = false;
  $("fQ").focus();
}
function stopEdit() {
  editing = null;
  const topic = $("fT").value;
  $("trForm").reset();
  $("fT").value = topic; // keep the chosen subject for the next example
  $("fS").value = "written for Nova";
  $("fSave").textContent = "Add example";
  $("fCancel").hidden = true;
  $("fCount").textContent = "";
}
$("fCancel").addEventListener("click", stopEdit);

function setTopic(t) {
  if (![...$("fT").options].some((o) => o.value === t)) $("fT").append(new Option(t, t));
  $("fT").value = t;
}

// Question ideas so students always know what to write next.
const IDEAS = {
  general: ["What is the difference between weather and climate?", "Why do we need sleep?", "What is a library?", "How do you make a good study timetable?"],
  science: ["What is photosynthesis?", "Why is the sky blue?", "What are the three states of matter?", "What does the heart do?", "What is gravity?", "Why do we have day and night?"],
  maths: ["What is a prime number?", "How do you find the area of a rectangle?", "What is 15% of 200?", "What is the difference between mean and median?", "What is a right angle?"],
  geography: ["What is the longest river in India?", "What causes earthquakes?", "What is a peninsula?", "Which is the largest ocean?", "What is the capital of Tamil Nadu?"],
  history: ["Who was the first Prime Minister of India?", "When did India become independent?", "Who built the Brihadeeswarar Temple?", "What was the Dandi March?"],
  india: ["How many states does India have?", "What is the national animal of India?", "When is Republic Day celebrated?", "What does the Indian flag's wheel stand for?"],
  english: ["What is a noun?", "What is the past tense of 'go'?", "What is the difference between 'their' and 'there'?", "What is a synonym?"],
  tamil: ["திருக்குறளை எழுதியவர் யார்?", "தமிழ்நாட்டின் தலைநகரம் எது?", "பொங்கல் ஏன் கொண்டாடப்படுகிறது?", "What does 'vanakkam' mean?"],
  computers: ["What is a computer virus?", "What is the difference between RAM and storage?", "What is a password manager?", "What does a web browser do?"],
  health: ["Why should we wash our hands?", "Why is drinking water important?", "What is a balanced diet?", "Why is exercise good for us?"],
  nova: ["What is Nova AI?", "Is Nova AI free to use?", "What can Nova AI help me with?"],
};
$("fIdea").addEventListener("click", () => {
  const list = IDEAS[$("fT").value] || IDEAS.general;
  const used = new Set(rows.map((r) => r.question.toLowerCase()));
  const fresh = list.filter((q) => !used.has(q.toLowerCase()) && q !== $("fQ").value);
  $("fQ").value = (fresh.length ? fresh : list)[Math.floor(Math.random() * (fresh.length || list.length))];
  $("fA").focus();
});
$("fA").addEventListener("input", () => {
  const n = $("fA").value.trim().split(/(?<=[.!?।])\s+/).filter(Boolean).length;
  $("fCount").textContent = $("fA").value.trim() ? `${n} sentence${n === 1 ? "" : "s"}${n > 3 ? " — try to keep it to 1–3" : " ✓"}` : "";
});

async function addOne(v, opts) {
  const problem = checkExample(v, opts);
  if (problem) throw new Error(problem);
  const author = (user.displayName || user.email || "team").split("@")[0].slice(0, 60);
  await addDoc(collection(db, "trainingData"), { ...v, author, createdBy: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), status: "pending" });
}

$("trForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const v = formValue();
  const out = $("trFormMsg");
  try {
    if (editing) {
      const problem = checkExample(v);
      if (problem) throw new Error(problem);
      await updateDoc(doc(db, "trainingData", editing), { ...v, updatedAt: serverTimestamp() });
      msg(out, "Saved.", "good");
    } else {
      await addOne(v);
      msg(out, "Added. Thank you! It now waits for review. Press 💡 for the next question.", "good");
    }
    stopEdit();
    await load();
  } catch (err) {
    msg(out, err?.code === "permission-denied" ? "Not allowed (approved examples can't be edited)." : err.message, "bad");
  }
});

$("trBulkBtn").addEventListener("click", async () => {
  const lines = $("trBulk").value.split("\n").map((l) => l.trim()).filter(Boolean);
  const out = $("trBulkMsg");
  let ok = 0;
  const problems = [];
  for (const [i, line] of lines.slice(0, 200).entries()) {
    try {
      const r = JSON.parse(line);
      await addOne({ question: String(r.question || "").trim(), answer: String(r.answer || "").trim(), topic: String(r.topic || "general").slice(0, 40), licence: String(r.licence || "own").toLowerCase(), source: String(r.source || "written for Nova").trim() });
      ok++;
    } catch (err) {
      problems.push(`line ${i + 1}: ${err instanceof SyntaxError ? "not valid JSON" : err.message}`);
    }
  }
  msg(out, `Added ${ok}.${problems.length ? ` Fix: ${problems.slice(0, 3).join("; ")}${problems.length > 3 ? "…" : ""}` : ""}`, problems.length ? "bad" : "good");
  if (ok) {
    $("trBulk").value = "";
    await load();
  }
});

async function setStatus(r, status) {
  await updateDoc(doc(db, "trainingData", r.id), { status });
  r.status = status;
  render();
}
async function remove(r) {
  if (!confirm("Delete this example?")) return;
  await deleteDoc(doc(db, "trainingData", r.id));
  rows = rows.filter((x) => x.id !== r.id);
  render();
}

// Export in the format of nova-llm/data/contrib/*.jsonl (approved only for the admin)
$("trExport").addEventListener("click", () => {
  const pick = admin ? rows.filter((r) => r.status === "approved") : rows.filter((r) => r.createdBy === user.uid);
  if (!pick.length) return alert(admin ? "No approved examples yet." : "You haven't added any examples yet.");
  const text = pick.map((r) => JSON.stringify({ question: r.question, answer: r.answer, topic: r.topic, source: r.source, licence: r.licence, author: r.author })).join("\n") + "\n";
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([text], { type: "application/jsonl" })), download: `team-${new Date().toISOString().slice(0, 10)}.jsonl` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

$("trFilter").addEventListener("change", render);

// ---- Mind Quest sync (admin only) ----------------------------------------------
// Mind Quest (mindquest-learn.pages.dev, also the owner's app) has a private export
// endpoint that checks this admin's Firebase sign-in token; no shared secret exists.
const MQ_EXPORT = "https://mindquest-learn.pages.dev/api/nova-export";
const MQ_TOPICS = { mathematics: "maths", maths: "maths", physics: "science", chemistry: "science", biology: "science", "social science": "history", "general knowledge": "general" };

export function fromMindQuest(q) {
  const question = String(q.question || "").replace(/\s+/g, " ").trim();
  let answer = String(q.answer ?? "").trim();
  if (Array.isArray(q.options) && /^\d+$/.test(answer) && q.options[+answer] != null) answer = String(q.options[+answer]).trim();
  const why = String(q.explanation || "").replace(/\s+/g, " ").trim();
  if (!question || !answer) return null;
  const full = (/[.!?]$/.test(answer) ? answer : answer + ".") + (why ? " " + why : "");
  const subject = String(q.subject || "").toLowerCase().trim();
  return {
    question: question.slice(0, 500),
    answer: full.slice(0, 2000),
    topic: (MQ_TOPICS[subject] || subject.replace(/[^a-z ]/g, "") || "general").slice(0, 40),
    licence: "own",
    source: `Mind Quest #${String(q.id || "").slice(0, 80)}${q.grade ? " · " + String(q.grade).slice(0, 40) : ""}`,
  };
}

$("trMQBtn").addEventListener("click", async () => {
  const out = $("trMQMsg");
  if (!admin) return;
  msg(out, "Fetching from Mind Quest…");
  try {
    const token = await user.getIdToken();
    const res = await fetch(MQ_EXPORT, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 404) throw new Error("Mind Quest doesn't have the Nova export yet (its session needs to add it).");
    if (res.status === 401 || res.status === 403) throw new Error("Mind Quest refused this account. Check NOVA_ADMIN_EMAILS there.");
    if (!res.ok) throw new Error(`Mind Quest said ${res.status}. Try again later.`);
    const data = await res.json();
    const items = Array.isArray(data.questions) ? data.questions : [];
    const have = new Set(rows.map((r) => (/^Mind Quest #([^ ·]+)/.exec(r.source || "") || [])[1]).filter(Boolean));
    let added = 0, skipped = 0, bad = 0;
    for (const q of items) {
      if (have.has(String(q.id))) { skipped++; continue; }
      const v = fromMindQuest(q);
      if (!v || checkExample(v, { imported: true })) { bad++; continue; }
      await addOne(v, { imported: true }).then(() => added++, () => bad++);
      have.add(String(q.id));
    }
    msg(out, `Added ${added} new question${added === 1 ? "" : "s"} for review. ${skipped} already here${bad ? `, ${bad} skipped (empty, too long or failed checks)` : ""}.`, "good");
    await load();
  } catch (err) {
    msg(out, err?.message?.startsWith("Failed to fetch") ? "Couldn't reach Mind Quest (it may not allow this site yet)." : err.message, "bad");
  }
});

async function loadModelInfo() {
  try {
    const m = await (await fetch("models/nova-mini/model.json")).json();
    const e = m.evaluation || {};
    $("trModel").textContent = `Live model: NOVA Mini, ${(m.parameters / 1e6).toFixed(1)}M parameters${e.test_ppl ? `, test perplexity ${e.test_ppl} (lower is better)` : ""}.`;
  } catch {}
}

onAuthStateChanged(auth, async (u) => {
  user = u;
  if (!u) return show("trSignin");
  try {
    await enter();
  } catch (err) {
    console.warn("Training room:", err);
    show("trJoin");
    msg($("trJoinMsg"), "Couldn't reach the database. Check your connection.", "bad");
  }
});
