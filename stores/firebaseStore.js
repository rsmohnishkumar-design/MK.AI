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

export async function addVaultEntry(question, answer) {
  const createdAt = new Date().toISOString();
  const ref = await vaultCol.add({ question, answer, createdAt });
  return { id: ref.id, question, answer, createdAt };
}

export async function updateVaultEntry(id, patch) {
  const ref = vaultCol.doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const updates = { updatedAt: new Date().toISOString() };
  if (patch.question !== undefined) updates.question = patch.question;
  if (patch.answer !== undefined) updates.answer = patch.answer;

  await ref.update(updates);
  const updated = await ref.get();
  return docToEntry(updated);
}

export async function deleteVaultEntry(id) {
  await vaultCol.doc(id).delete();
}

export async function addLearnedEntry(question, answer, sourceLink) {
  const createdAt = new Date().toISOString();
  const ref = await learnedCol.add({ question, answer, sourceLink: sourceLink || null, createdAt });
  return { id: ref.id, question, answer, sourceLink: sourceLink || null, createdAt };
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
