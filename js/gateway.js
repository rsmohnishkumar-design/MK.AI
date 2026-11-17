// Talks to the Nova Gateway (gateway/src/worker.js), which holds the AI service
// keys on the server. Every request carries the signed-in user's Firebase ID
// token; the gateway checks it and counts usage on the server.
import { auth } from "./firebase.js";
import { GATEWAY_URL } from "../firebase-config.js";

export const gatewayOn = () => !!GATEWAY_URL && !!auth?.currentUser;

// The gateway speaks the same streaming chat format as the AI services, so the
// existing streamChat() client works with it (the "key" is the user's ID token).
export const GATEWAY_PROVIDER = { id: "gateway", name: "Nova Gateway", chatUrl: `${GATEWAY_URL}/v1/chat` };

export async function idToken() {
  if (!auth?.currentUser) throw Object.assign(new Error("Sign in first."), { customErrorData: { status: 401 } });
  return auth.currentUser.getIdToken();
}

async function post(path, body, signal) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${await idToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Gateway error ${res.status}`), { customErrorData: { status: res.status } });
  return data;
}

// { text, sources: [{ title, url }], by }
export const gatewayResearch = (question, signal) => post("/v1/research", { question }, signal);
// { dataUrl, by }
export const gatewayImage = (prompt, signal) => post("/v1/image", { prompt }, signal);
