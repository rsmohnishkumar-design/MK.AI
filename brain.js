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
}

export const storageKind = backend.kind;

// --- Fuzzy matching helpers ---
function normalize(str) {
  return str.trim().toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
}
function squash(str) {
  return normalize(str).replace(/\s+/g, "");
}

function findBestMatch(query, entries, threshold) {
  if (!entries.length) return null;

  const fuse = new Fuse(entries, {
    keys: ["question"],
    includeScore: true,
    threshold: 1, // let everything through; filter by score ourselves
    ignoreLocation: true,
  });

  const q = normalize(query);
  const qSquashed = squash(query);

  let squashedBest = null;
  for (const entry of entries) {
    if (squash(entry.question) === qSquashed && qSquashed.length > 3) {
      squashedBest = { item: entry, score: 0 };
      break;
    }
  }

  const direct = fuse.search(q)[0];
  const best = squashedBest || direct;
  if (!best) return null;

  const similarity = 1 - best.score;
  if (similarity < threshold) return null;

  return { entry: best.item, similarity };
}

// --- Vault (curated) ---
export const listVault = () => backend.getVaultEntries();
export const addVaultEntry = (question, answer) => backend.addVaultEntry(question, answer);
export const updateVaultEntry = (id, question, answer) =>
  backend.updateVaultEntry(id, { question, answer });
export const deleteVaultEntry = (id) => backend.deleteVaultEntry(id);

// --- Learned (self-taught) ---
export const listLearned = () => backend.getLearnedEntries();
export const deleteLearnedEntry = (id) => backend.deleteLearnedEntry(id);

export async function promoteLearnedEntry(id) {
  const learned = await backend.getLearnedEntries();
  const entry = learned.find((e) => e.id === id);
  if (!entry) return null;
  await backend.deleteLearnedEntry(id);
  return backend.addVaultEntry(entry.question, entry.answer);
}

export async function rememberFromSearch(question, answer, sourceLink) {
  const learned = await backend.getLearnedEntries();
  const existing = findBestMatch(question, learned, 0.85);
  if (existing) return existing.entry; // already have something close enough
  return backend.addLearnedEntry(question, answer, sourceLink);
}

// --- Recall: vault first (lower bar, curated), then learned memory (higher bar) ---
export async function recall(question) {
  const vault = await backend.getVaultEntries();
  const vaultMatch = findBestMatch(question, vault, 0.45);
  if (vaultMatch) {
    return {
      source: "vault",
      question: vaultMatch.entry.question,
      answer: vaultMatch.entry.answer,
      similarity: vaultMatch.similarity,
    };
  }

  const learned = await backend.getLearnedEntries();
  const learnedMatch = findBestMatch(question, learned, 0.6);
  if (learnedMatch) {
    return {
      source: "learned",
      question: learnedMatch.entry.question,
      answer: learnedMatch.entry.answer,
      sourceLink: learnedMatch.entry.sourceLink,
      similarity: learnedMatch.similarity,
    };
  }

  return null;
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
