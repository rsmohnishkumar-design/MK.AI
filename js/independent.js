// Independent mode: Nova AI uses only its own engines (its maths, science and
// knowledge solvers, analytics, the NOVA LLM experiment) and never calls an
// outside AI service (Gemini, Groq, Cerebras, OpenRouter, GitHub Models,
// Pollinations, AI Horde). There is no silent fallback to them while it's on.
// Off by default until NOVA's own models are good enough; the person chooses.
const KEY = "mkai-independent";
export function independent() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
export function setIndependent(on) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {}
  document.dispatchEvent(new CustomEvent("mkai-independent", { detail: !!on }));
}
export const INDEPENDENT_NOTE = "Independent mode is on, so Nova AI is using only its own engines and outside AI services are switched off. Nova's own engines can't answer this yet.";
