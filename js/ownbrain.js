// MK.ai's own brain: a small open neural language model (Llama 3.2 1B) that
// runs entirely on the person's device through WebGPU, using WebLLM. It is
// downloaded only when the person asks (about 0.9 GB, kept by the browser),
// then answers when the outside AI services are resting and works offline.

const WEBLLM_URL = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/lib/index.js";
const MODELS = {
  f16: "Llama-3.2-1B-Instruct-q4f16_1-MLC", // smaller and faster, needs 16-bit GPU maths
  f32: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
};
export const DOWNLOAD_SIZE = "about 0.9 GB";
const WANTED_KEY = "mkai-own-brain";

let engine = null;
let loading = null;
let busy = Promise.resolve();
let state = { status: "off", progress: 0, text: "" };
const listeners = new Set();

function setState(next) {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn(state));
}
export const brainState = () => state;
export function onBrainChange(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function wanted() {
  try {
    return localStorage.getItem(WANTED_KEY) === "on";
  } catch {
    return false;
  }
}
function setWanted(on) {
  try {
    if (on) localStorage.setItem(WANTED_KEY, "on");
    else localStorage.removeItem(WANTED_KEY);
  } catch {}
}

// Tests can swap in a fake WebLLM through window.MKAI_WEBLLM.
const webllm = () => (window.MKAI_WEBLLM ? Promise.resolve(window.MKAI_WEBLLM) : import(WEBLLM_URL));

// { ok, f16, reason }
let supportCheck = null;
export function checkSupport() {
  supportCheck ||= (async () => {
    if (window.MKAI_WEBLLM) return { ok: true, f16: true };
    if (!("gpu" in navigator)) return { ok: false, reason: "This browser can't run it (it needs WebGPU). Try the latest Chrome or Edge." };
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return { ok: false, reason: "This device's graphics chip can't run it." };
      return { ok: true, f16: adapter.features.has("shader-f16") };
    } catch {
      return { ok: false, reason: "This device's graphics chip can't run it." };
    }
  })();
  return supportCheck;
}

async function modelId() {
  const { f16 } = await checkSupport();
  return f16 ? MODELS.f16 : MODELS.f32;
}

// Downloads (first time) or loads from the browser's storage.
export function loadBrain() {
  if (engine) return Promise.resolve(engine);
  if (loading) return loading;
  loading = (async () => {
    const support = await checkSupport();
    if (!support.ok) {
      setState({ status: "unsupported", text: support.reason });
      throw new Error(support.reason);
    }
    setState({ status: "loading", progress: 0, text: "Starting…" });
    try {
      const lib = await webllm();
      const id = await modelId();
      const cached = await lib.hasModelInCache?.(id).catch(() => false);
      engine = await lib.CreateMLCEngine(id, {
        initProgressCallback: (p) =>
          setState({
            status: cached ? "loading" : "downloading",
            progress: Math.round((p.progress || 0) * 100),
            text: p.text || "",
          }),
      });
      setState({ status: "ready", progress: 100, text: "" });
      return engine;
    } catch (err) {
      console.warn("MK.ai's own brain couldn't load:", err);
      setState({ status: "error", text: /quota|space|storage/i.test(String(err)) ? "Not enough free space on this device." : "It couldn't load. Check your internet and try again." });
      throw err;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

export async function enableBrain() {
  setWanted(true);
  return loadBrain();
}

// Frees the memory and deletes the downloaded files.
export async function removeBrain() {
  setWanted(false);
  try {
    await engine?.unload?.();
  } catch {}
  engine = null;
  try {
    const lib = await webllm();
    for (const id of Object.values(MODELS)) await lib.deleteModelAllInfoInCache?.(id).catch(() => {});
  } catch {}
  setState({ status: "off", progress: 0, text: "" });
}

// Wakes the brain up in the background if the person downloaded it before.
export async function startBrain() {
  if (!wanted()) return;
  const support = await checkSupport();
  if (!support.ok) return setState({ status: "unsupported", text: support.reason });
  loadBrain().catch(() => {});
}

// messages: OpenAI-style [{ role, content }]. Resolves { text, complete }.
// One answer at a time: the model can't think about two things at once.
export function ownAnswer(messages, onText) {
  const run = async () => {
    const e = await loadBrain();
    const chunks = await e.chat.completions.create({ messages, stream: true, temperature: 0.6, max_tokens: 1024 });
    let text = "";
    let finish = null;
    for await (const chunk of chunks) {
      const choice = chunk.choices?.[0];
      finish = choice?.finish_reason || finish;
      const piece = choice?.delta?.content || "";
      if (piece) {
        text += piece;
        onText(text);
      }
    }
    return { text, complete: finish !== "length" };
  };
  const result = busy.then(run, run);
  busy = result.catch(() => {});
  return result;
}
