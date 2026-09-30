// The vault password. It is checked by the database's security rules (the
// password lives only there), so it never appears in the website's code: the
// signed-in account asks to become MK.ai's creator with it, and the rules say
// yes only when it's right. The creator is an admin, so the vault opens.

import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

const OK_KEY = "mkai-vault-ok";

// Resolves when the password is right; throws { code: "signin" | "wrong" } otherwise.
export async function unlockVault(password) {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error("Sign in to MK.ai first."), { code: "signin" });
  try {
    await updateDoc(doc(db, "users", user.uid), { creator: true, creatorCode: password.trim() });
  } catch (err) {
    if (err?.code === "permission-denied") throw Object.assign(new Error("Wrong password."), { code: "wrong" });
    throw err;
  }
  try {
    sessionStorage.setItem(OK_KEY, user.uid);
  } catch {}
}

// Whether the password was entered in this browser session (the database still
// checks every vault action, so this only decides what to show).
export function vaultUnlocked() {
  try {
    const v = sessionStorage.getItem(OK_KEY);
    return !!v && (v === "*" || v === auth.currentUser?.uid);
  } catch {
    return false;
  }
}
