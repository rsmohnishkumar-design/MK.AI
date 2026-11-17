// Firestore security rules tests. Run against the Firestore emulator:
//   firebase emulators:start --only firestore --project demo-mkai   (in another terminal)
//   node tests/rules.test.mjs
// Needs @firebase/rules-unit-testing and firebase installed (see tests/README.md).
// The rules' secret codes are replaced with test values here; the real ones live only in the Firebase console.
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";

const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8")
  .replace("['your-email@example.com']", "['admin@test.com']")
  .replace("'change-this-code'", "'UNLIMITED-TEST'")
  .replace("'change-this-creator-code'", "'CREATOR-TEST'")
  .replace("'change-this-vault-password'", "'VAULT-TEST'");

const env = await initializeTestEnvironment({ projectId: "demo-mkai", firestore: { rules, host: "127.0.0.1", port: 8080 } });
const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push(["PASS", name]);
  } catch (e) {
    results.push(["FAIL", name + " — " + (e.message || e).toString().slice(0, 160)]);
  }
}
const H = 3600000;
const now = Date.now();

// Seed data with rules off
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "users/alice"), { email: "alice@test.com", tier: "trial", expiresAt: Timestamp.fromMillis(now - 10 * H), createdAt: Timestamp.fromMillis(now - 20 * H),
    usage: { windowStart: now - H, windowTokens: 5000, weekStart: now - 24 * H, weekTokens: 20000 } });
  await setDoc(doc(db, "users/bob"), { email: "bob@test.com", tier: "trial", expiresAt: null, createdAt: Timestamp.fromMillis(now - 20 * H),
    usage: { windowStart: now - 6 * H, windowTokens: 9000, weekStart: now - 8 * 86400000, weekTokens: 99000 } });
  await setDoc(doc(db, "users/admin"), { email: "admin@test.com", tier: "unlimited", expiresAt: null, createdAt: Timestamp.fromMillis(now - 20 * H) });
  await setDoc(doc(db, "settings/ai"), { groqKey: "test-not-a-real-key" });
  await setDoc(doc(db, "settings/control"), { note: "ok" });
  await setDoc(doc(db, "users/bob/chats/c1"), { title: "Bob's chat", updatedAt: 1, messages: [] });
  await setDoc(doc(db, "unknown/u1"), { question: "q?", tries: 0, createdBy: "bob", createdAt: Timestamp.fromMillis(now) });
});

const as = (uid, email) => env.authenticatedContext(uid, { email }).firestore();
const alice = as("alice", "alice@test.com");
const bob = as("bob", "bob@test.com");
const admin = as("admin", "admin@test.com");
const stranger = env.unauthenticatedContext().firestore();

// --- API keys stay with the admin ---
await check("free-plan user cannot read the AI keys (settings/ai)", () => assertFails(getDoc(doc(alice, "settings/ai"))));
await check("signed-out visitor cannot read the AI keys", () => assertFails(getDoc(doc(stranger, "settings/ai"))));
await check("admin can read the AI keys", () => assertSucceeds(getDoc(doc(admin, "settings/ai"))));
await check("free-plan user can still read other settings", () => assertSucceeds(getDoc(doc(alice, "settings/control"))));

// --- Free plan keeps working after the 3-hour trial marker (by design) ---
await check("free-plan user with an old expiresAt still reads non-secret settings", () => assertSucceeds(getDoc(doc(alice, "settings/control"))));

// --- Usage limits can't be reset by the user ---
const u = (o) => ({ usage: { windowStart: now - H, windowTokens: 5000, weekStart: now - 24 * H, weekTokens: 20000, ...o } });
await check("usage can go up", () => assertSucceeds(updateDoc(doc(alice, "users/alice"), u({ windowTokens: 6000, weekTokens: 21000 }))));
await check("usage cannot be lowered inside the window", () => assertFails(updateDoc(doc(alice, "users/alice"), u({ windowTokens: 0, weekTokens: 21000 }))));
await check("window cannot be restarted before 5 hours pass", () => assertFails(updateDoc(doc(alice, "users/alice"), u({ windowStart: now, windowTokens: 10, weekTokens: 21000 }))));
await check("week counter cannot be zeroed early", () => assertFails(updateDoc(doc(alice, "users/alice"), u({ windowTokens: 6000, weekTokens: 0 }))));
await check("start time cannot be pushed into the future", () =>
  assertFails(updateDoc(doc(bob, "users/bob"), { usage: { windowStart: now + 10 * H, windowTokens: 0, weekStart: now + 10 * H, weekTokens: 0 } })));
await check("a window that really ended restarts normally", () =>
  assertSucceeds(updateDoc(doc(bob, "users/bob"), { usage: { windowStart: now, windowTokens: 50, weekStart: now, weekTokens: 50 } })));

// --- Shared memory: only the admin writes ---
const entry = (by) => ({ question: "What is 2+2?", answer: "4", keywords: ["2"], timeSensitive: false, uses: 1, voters: {}, createdBy: by, createdAt: serverTimestamp(), lastUsedAt: serverTimestamp(), source: "ai" });
await check("free-plan user cannot add a shared learned answer", () => assertFails(addDoc(collection(alice, "learned"), entry("alice"))));
await check("admin can add a shared learned answer", () => assertSucceeds(addDoc(collection(admin, "learned"), entry("admin"))));

// --- Learning list ---
await check("a user cannot delete someone else's unknown question", () => assertFails(deleteDoc(doc(alice, "unknown/u1"))));
await check("the asker can delete their own unknown question", () => assertSucceeds(deleteDoc(doc(bob, "unknown/u1"))));

// --- Each person's data stays theirs ---
await check("a user cannot read another user's chats", () => assertFails(getDoc(doc(alice, "users/bob/chats/c1"))));
await check("a user cannot read another user's profile", () => assertFails(getDoc(doc(alice, "users/bob"))));
await check("a user can read their own chat", () => assertSucceeds(getDoc(doc(bob, "users/bob/chats/c1"))));

// --- Upgrades need the right codes ---
await check("no self-upgrade to unlimited without the code", () => assertFails(updateDoc(doc(alice, "users/alice"), { tier: "unlimited", expiresAt: null, accessCode: "guess" })));
await check("self-upgrade with the right code works", () => assertSucceeds(updateDoc(doc(alice, "users/alice"), { tier: "unlimited", expiresAt: null, accessCode: "UNLIMITED-TEST" })));
await check("wrong vault password cannot make someone the creator", () => assertFails(updateDoc(doc(bob, "users/bob"), { creator: true, creatorCode: "nope" })));

await env.cleanup();
for (const [r, n] of results) console.log(r, n);
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
