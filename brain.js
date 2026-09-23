import Fuse from "fuse.js";

const useFirebase = Boolean(
  process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
);

let backend;
if (useFirebase) {
  try {
    backend = await import("./stores/firebaseStore.js");
    console.log("MK.ai: using Firebase Firestore for storage.");
  } catch (err) {
    console.error(
      "MK.ai: FIREBASE_* env vars are set but Firebase init failed — falling back to local storage.",
      err.message
    );
    backend = await import("./stores/localStore.js");
  }
} else {
  backend = await import("./stores/localStore.js");
  console.log("MK.ai: using local file storage (data/). Set FIREBASE_* env vars to use Firestore instead.");
  if (process.env.NODE_ENV === "production" || process.env.RENDER) {
    console.warn(
      "⚠️  MK.ai is running on a cloud host with local file storage. Most free hosts wipe the disk on " +
        "every restart, so accounts and everything MK.ai has learned will be lost. Set FIREBASE_* env vars."
    );
  }
}

export const storageKind = backend.kind;

// ---------------------------------------------------------------------------
// Knowledge cache. The vault (curated answers) and learned memory are read
// from storage once, then kept in memory and written through on every change,
// so matching a question doesn't re-read the whole database each time.
// ---------------------------------------------------------------------------
let cache = null;
async function knowledge() {
  if (!cache) {
    const [vault, learned] = await Promise.all([backend.getVaultEntries(), backend.getLearnedEntries()]);
    cache = { vault, learned };
  }
  return cache;
}

function replaceIn(list, entry) {
  const i = list.findIndex((e) => e.id === entry.id);
  if (i === -1) list.push(entry);
  else list[i] = entry;
}

// Embeddings are internal; never send them to the browser.
function publicEntry({ embedding, voters, ...rest }) {
  return { ...rest, hasEmbedding: Array.isArray(embedding) };
}

// ---------------------------------------------------------------------------
// Matching. When both sides have an embedding (a list of numbers describing
// the question's meaning), questions are compared by meaning, so "how tall is
// everest" matches "what's the height of mount everest". Without embeddings
// it falls back to improved word matching.
// ---------------------------------------------------------------------------
const STOPWORDS = new Set(
  "a an the is are was were be been am do does did of to in on at for by with from and or but " +
    "what whats who whom which when where why how can could would should will shall may might " +
    "i me my you your it its this that these those tell please about there their they them"
      .split(" ")
);

function normalize(str) {
  return str.trim().toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ");
}

function keywords(str) {
  return normalize(str)
    .split(" ")
    .filter((w) => w && !STOPWORDS.has(w))
    .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w)); // crude plural folding
}

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return null;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : null;
}

// Word-based similarity (0..1): keyword overlap blended with typo-tolerant fuzzy matching.
function wordSimilarity(query, entries) {
  const qWords = new Set(keywords(query));
  const fuse = new Fuse(entries, { keys: ["question"], includeScore: true, threshold: 1, ignoreLocation: true });
  const fuzzy = new Map(fuse.search(normalize(query)).map((r) => [r.item.id, 1 - r.score]));

  return entries.map((entry) => {
    const eWords = new Set(keywords(entry.question));
    const shared = [...qWords].filter((w) => eWords.has(w)).length;
    const union = new Set([...qWords, ...eWords]).size || 1;
    const overlap = shared / union;
    const exact = normalize(entry.question) === normalize(query) ? 1 : 0;
    return { entry, score: Math.max(exact, 0.6 * overlap + 0.4 * (fuzzy.get(entry.id) || 0)) };
  });
}

function rank(query, embedding, entries) {
  const words = wordSimilarity(query, entries);
  return words
    .map(({ entry, score }) => {
      const semantic = cosine(embedding, entry.embedding);
      return semantic === null
        ? { entry, score, method: "words" }
        : { entry, score: semantic, method: "meaning" };
    })
    .sort((a, b) => b.score - a.score);
}

// How sure a match must be before it's reused without asking the AI.
const THRESHOLD = {
  vault: { meaning: 0.86, words: 0.6 },
  learned: { meaning: 0.92, words: 0.85 },
  related: { meaning: 0.75, words: 0.45 },
};

const LEARNED_MAX_AGE_DAYS = 45;

// Feedback shifts how readily a learned answer is reused: upvoted answers are
// trusted a bit more, downvoted ones stop being reused at all.
function learnedThreshold(entry, method) {
  const base = THRESHOLD.learned[method];
  const up = entry.upvotes || 0;
  return base - Math.min(up, 3) * 0.015;
}

function isUsable(entry) {
  if ((entry.downvotes || 0) > (entry.upvotes || 0)) return false;
  if ((entry.upvotes || 0) > 0) return true; // confirmed good answers don't expire
  const ageDays = (Date.now() - new Date(entry.updatedAt || entry.createdAt).getTime()) / 86400000;
  return ageDays < LEARNED_MAX_AGE_DAYS;
}

// Questions whose answer changes over time shouldn't be answered from memory.
const TIME_SENSITIVE =
  /\b(today|tonight|tomorrow|yesterday|now|current(ly)?|latest|recent(ly)?|this (week|month|year)|news|weather|price|rate|score|stock|live|trending|upcoming|20\d\d)\b/i;
export function isTimeSensitive(question) {
  return TIME_SENSITIVE.test(question);
}

// Returns a stored answer good enough to reuse directly, or null.
export async function recall(question, embedding) {
  const { vault, learned } = await knowledge();

  const vaultBest = rank(question, embedding, vault)[0];
  if (vaultBest && vaultBest.score >= THRESHOLD.vault[vaultBest.method]) {
    return { kind: "vault", entry: vaultBest.entry, similarity: vaultBest.score };
  }

  if (isTimeSensitive(question)) return null;
  const candidates = learned.filter((e) => isUsable(e) && !e.timeSensitive);
  const learnedBest = rank(question, embedding, candidates)[0];
  if (learnedBest && learnedBest.score >= learnedThreshold(learnedBest.entry, learnedBest.method)) {
    return { kind: "learned", entry: learnedBest.entry, similarity: learnedBest.score };
  }
  return null;
}

// Related knowledge handed to the AI as context, so what MK.ai has been taught
// and confirmed shapes new answers too. Also returns similar answers people
// marked unhelpful, so the AI can avoid repeating them.
export async function related(question, embedding, limit = 3) {
  const { vault, learned } = await knowledge();
  const good = [];
  const bad = [];

  for (const { entry, score, method } of rank(question, embedding, [...vault, ...learned])) {
    if (score < THRESHOLD.related[method]) break;
    const isVault = vault.includes(entry);
    if (!isVault && (entry.downvotes || 0) > (entry.upvotes || 0)) {
      if (bad.length < 1) bad.push(entry);
    } else if (good.length < limit && (isVault || (entry.upvotes || 0) > 0 || !entry.timeSensitive)) {
      good.push({ ...entry, curated: isVault });
    }
  }
  return { good, bad };
}

// Saves a fresh AI answer. A near-duplicate question updates the existing
// entry instead of piling up copies.
export async function learn(question, answer, embedding, { timeSensitive = false } = {}) {
  const { learned } = await knowledge();
  const best = rank(question, embedding, learned)[0];
  const duplicate = best && best.score >= (best.method === "meaning" ? 0.95 : 0.9) ? best.entry : null;

  if (duplicate) {
    const wasBad = (duplicate.downvotes || 0) > (duplicate.upvotes || 0);
    const patch = {
      answer,
      timeSensitive,
      updatedAt: new Date().toISOString(),
      ...(embedding ? { embedding } : {}),
      // A replaced bad answer starts over with a clean slate.
      ...(wasBad ? { upvotes: 0, downvotes: 0, voters: {} } : {}),
    };
    const updated = await backend.updateLearnedEntry(duplicate.id, patch);
    if (updated) replaceIn(learned, { ...duplicate, ...patch });
    return { ...duplicate, ...patch };
  }

  const entry = await backend.addLearnedEntry({
    question,
    answer,
    embedding: embedding || null,
    timeSensitive,
    uses: 1,
    upvotes: 0,
    downvotes: 0,
    voters: {},
    lastUsedAt: new Date().toISOString(),
  });
  learned.push(entry);
  return entry;
}

export async function markUsed(entry) {
  const { learned } = await knowledge();
  if (!learned.includes(entry)) return; // vault entries don't track usage
  const patch = { uses: (entry.uses || 0) + 1, lastUsedAt: new Date().toISOString() };
  Object.assign(entry, patch);
  await backend.updateLearnedEntry(entry.id, patch);
}

// One vote per user per answer; voting again changes the vote.
export async function vote(entryId, userId, direction) {
  const { learned } = await knowledge();
  const entry = learned.find((e) => e.id === entryId);
  if (!entry) return null;

  const voters = { ...(entry.voters || {}) };
  voters[userId] = direction;
  const values = Object.values(voters);
  const patch = {
    voters,
    upvotes: values.filter((v) => v === "up").length,
    downvotes: values.filter((v) => v === "down").length,
  };
  Object.assign(entry, patch);
  await backend.updateLearnedEntry(entry.id, patch);
  return publicEntry(entry);
}

// Fills in missing embeddings (e.g. entries saved before this feature, or
// while the embedding API was unavailable) using the given embed function.
export async function backfillEmbeddings(embed) {
  const { vault, learned } = await knowledge();
  let filled = 0;
  for (const [list, update] of [
    [vault, backend.updateVaultEntry],
    [learned, backend.updateLearnedEntry],
  ]) {
    for (const entry of list) {
      if (Array.isArray(entry.embedding)) continue;
      const embedding = await embed(entry.question);
      if (!embedding) return filled; // API unavailable or rate-limited; try again next start
      entry.embedding = embedding;
      await update(entry.id, { embedding });
      filled++;
    }
  }
  return filled;
}

// --- Vault (curated) ---
export async function listVault() {
  return (await knowledge()).vault.map(publicEntry);
}

export async function addVaultEntry(question, answer, embedding) {
  const entry = await backend.addVaultEntry(question, answer, embedding ? { embedding } : {});
  (await knowledge()).vault.push(entry);
  return publicEntry(entry);
}

export async function updateVaultEntry(id, question, answer, embedding) {
  const entry = await backend.updateVaultEntry(id, { question, answer, embedding: embedding || undefined });
  if (!entry) return null;
  replaceIn((await knowledge()).vault, entry);
  return publicEntry(entry);
}

export async function deleteVaultEntry(id) {
  await backend.deleteVaultEntry(id);
  const k = await knowledge();
  k.vault = k.vault.filter((e) => e.id !== id);
}

// --- Learned (self-taught) ---
export async function listLearned() {
  return (await knowledge()).learned.map(publicEntry);
}

export async function deleteLearnedEntry(id) {
  await backend.deleteLearnedEntry(id);
  const k = await knowledge();
  k.learned = k.learned.filter((e) => e.id !== id);
}

export async function promoteLearnedEntry(id) {
  const k = await knowledge();
  const entry = k.learned.find((e) => e.id === id);
  if (!entry) return null;
  await deleteLearnedEntry(id);
  return addVaultEntry(entry.question, entry.answer, entry.embedding);
}

// --- Activity log ---
export const logActivity = (entry) => backend.logActivity(entry);
export const getActivity = (limit) => backend.getActivity(limit);

// --- Users ---
export const getUserByEmail = (email) => backend.getUserByEmail(email);
export const addUser = (email, passwordHash, tier, expiresAt) =>
  backend.addUser(email, passwordHash, tier, expiresAt);
export const updateUserTier = (id, tier, expiresAt) => backend.updateUserTier(id, tier, expiresAt);
export const listUsers = () => backend.listUsers();
export const deleteUser = (id) => backend.deleteUser(id);
