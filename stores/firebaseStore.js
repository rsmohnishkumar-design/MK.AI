import admin from "firebase-admin";

if (!admin.apps.length) {
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const db = admin.firestore();
// Firestore rejects `undefined` fields; skip them instead of failing the write.
db.settings({ ignoreUndefinedProperties: true });
const vaultCol = db.collection("vault");
const learnedCol = db.collection("learned");
const activityCol = db.collection("activity");
const usersCol = db.collection("users");

function docToEntry(doc) {
  return { id: doc.id, ...doc.data() };
}

export const kind = "firebase";

export async function getVaultEntries() {
  const snap = await vaultCol.get();
  return snap.docs.map(docToEntry);
}

export async function getLearnedEntries() {
  const snap = await learnedCol.get();
  return snap.docs.map(docToEntry);
}

export async function addVaultEntry(question, answer, extra = {}) {
  const fields = { question, answer, ...extra, createdAt: new Date().toISOString() };
  const ref = await vaultCol.add(fields);
  return { id: ref.id, ...fields };
}

export async function updateVaultEntry(id, patch) {
  const ref = vaultCol.doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const updates = { updatedAt: new Date().toISOString() };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) updates[key] = value;
  }

  await ref.update(updates);
  const updated = await ref.get();
  return docToEntry(updated);
}

export async function deleteVaultEntry(id) {
  await vaultCol.doc(id).delete();
}

export async function addLearnedEntry(fields) {
  const data = { ...fields, createdAt: new Date().toISOString() };
  const ref = await learnedCol.add(data);
  return { id: ref.id, ...data };
}

export async function updateLearnedEntry(id, patch) {
  const ref = learnedCol.doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.update(patch);
  return { id, ...snap.data(), ...patch };
}

export async function deleteLearnedEntry(id) {
  await learnedCol.doc(id).delete();
}

export async function logActivity(entry) {
  await activityCol.add({ ...entry, createdAt: new Date().toISOString() });
}

export async function getActivity(limit = 200) {
  const snap = await activityCol.orderBy("createdAt", "desc").limit(limit).get();
  return snap.docs.map(docToEntry);
}

// --- Users ---
export async function getUserByEmail(email) {
  const snap = await usersCol.where("email", "==", email.toLowerCase()).limit(1).get();
  if (snap.empty) return null;
  return docToEntry(snap.docs[0]);
}

export async function addUser(email, passwordHash, tier = "trial", expiresAt = null) {
  const createdAt = new Date().toISOString();
  const ref = await usersCol.add({ email: email.toLowerCase(), passwordHash, tier, expiresAt, createdAt });
  return { id: ref.id, email: email.toLowerCase(), passwordHash, tier, expiresAt, createdAt };
}

export async function updateUserTier(id, tier, expiresAt) {
  const ref = usersCol.doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.update({ tier, expiresAt });
  const updated = await ref.get();
  return docToEntry(updated);
}

export async function listUsers() {
  const snap = await usersCol.get();
  return snap.docs.map((doc) => {
    const { passwordHash, ...safe } = docToEntry(doc);
    return safe;
  });
}

export async function deleteUser(id) {
  await usersCol.doc(id).delete();
}
