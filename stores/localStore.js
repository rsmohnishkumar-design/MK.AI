import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const BRAIN_PATH = path.join(DATA_DIR, "brain.json");
const ACTIVITY_PATH = path.join(DATA_DIR, "activity.json");
const MAX_ACTIVITY = 1000; // trim the log so it doesn't grow forever

function ensureFile(filePath, fallback) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
}

function loadBrain() {
  ensureFile(BRAIN_PATH, { vault: [], learned: [] });
  try {
    return JSON.parse(fs.readFileSync(BRAIN_PATH, "utf-8"));
  } catch {
    return { vault: [], learned: [] };
  }
}
function saveBrain(data) {
  fs.writeFileSync(BRAIN_PATH, JSON.stringify(data, null, 2));
}

function loadActivity() {
  ensureFile(ACTIVITY_PATH, []);
  try {
    return JSON.parse(fs.readFileSync(ACTIVITY_PATH, "utf-8"));
  } catch {
    return [];
  }
}
function saveActivity(list) {
  fs.writeFileSync(ACTIVITY_PATH, JSON.stringify(list, null, 2));
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const kind = "local";

// --- Users ---
const USERS_PATH = path.join(DATA_DIR, "users.json");
function loadUsers() {
  ensureFile(USERS_PATH, []);
  try {
    return JSON.parse(fs.readFileSync(USERS_PATH, "utf-8"));
  } catch {
    return [];
  }
}
function saveUsers(list) {
  fs.writeFileSync(USERS_PATH, JSON.stringify(list, null, 2));
}

export async function getUserByEmail(email) {
  const users = loadUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

export async function addUser(email, passwordHash, tier = "trial", expiresAt = null) {
  const users = loadUsers();
  const user = {
    id: makeId(),
    email,
    passwordHash,
    tier, // "unlimited" or "trial"
    expiresAt, // ISO string or null (null = no expiry)
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  return user;
}

export async function updateUserTier(id, tier, expiresAt) {
  const users = loadUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return null;
  user.tier = tier;
  user.expiresAt = expiresAt;
  saveUsers(users);
  return user;
}

export async function listUsers() {
  return loadUsers().map(({ passwordHash, ...safe }) => safe);
}

export async function deleteUser(id) {
  const users = loadUsers().filter((u) => u.id !== id);
  saveUsers(users);
}

export async function getVaultEntries() {
  return loadBrain().vault;
}

export async function getLearnedEntries() {
  return loadBrain().learned;
}

export async function addVaultEntry(question, answer) {
  const data = loadBrain();
  const entry = { id: makeId(), question, answer, createdAt: new Date().toISOString() };
  data.vault.push(entry);
  saveBrain(data);
  return entry;
}

export async function updateVaultEntry(id, patch) {
  const data = loadBrain();
  const entry = data.vault.find((e) => e.id === id);
  if (!entry) return null;
  if (patch.question !== undefined) entry.question = patch.question;
  if (patch.answer !== undefined) entry.answer = patch.answer;
  entry.updatedAt = new Date().toISOString();
  saveBrain(data);
  return entry;
}

export async function deleteVaultEntry(id) {
  const data = loadBrain();
  data.vault = data.vault.filter((e) => e.id !== id);
  saveBrain(data);
}

export async function addLearnedEntry(question, answer, sourceLink) {
  const data = loadBrain();
  const entry = {
    id: makeId(),
    question,
    answer,
    sourceLink: sourceLink || null,
    createdAt: new Date().toISOString(),
  };
  data.learned.push(entry);
  saveBrain(data);
  return entry;
}

export async function deleteLearnedEntry(id) {
  const data = loadBrain();
  data.learned = data.learned.filter((e) => e.id !== id);
  saveBrain(data);
}

export async function logActivity(entry) {
  const list = loadActivity();
  list.push({ id: makeId(), ...entry, createdAt: new Date().toISOString() });
  const trimmed = list.length > MAX_ACTIVITY ? list.slice(-MAX_ACTIVITY) : list;
  saveActivity(trimmed);
}

export async function getActivity(limit = 200) {
  const list = loadActivity();
  return list.slice(-limit).reverse();
}
