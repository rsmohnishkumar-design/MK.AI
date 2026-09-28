// Gemini's own web API, used with the key saved in the vault. Unlike the
// OpenAI-style endpoint it can search Google, read photos and PDFs, speak
// (text to speech) and draw pictures.

const BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

function httpError(status, message) {
  const err = new Error(message || `HTTP ${status}`);
  err.customErrorData = { status };
  return err;
}

async function failure(res, model) {
  let message = res.statusText;
  try {
    message = (await res.json())?.error?.message || message;
  } catch {}
  return httpError(res.status, `Gemini ${model}: [${res.status}] ${message}`);
}

const textOf = (candidate) => (candidate?.content?.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join("");

// One request, whole answer at once.
export async function geminiGenerate(key, model, body, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await failure(res, model);
    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") throw httpError(504, `Gemini ${model}: timeout`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Streams an answer. Resolves { text, complete, suggestions }.
export async function geminiStream(key, model, body, onText, timeoutMs = 20000) {
  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), timeoutMs);
  const alive = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), timeoutMs);
  };
  try {
    const res = await fetch(`${BASE}${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await failure(res, model);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let finish = null;
    let suggestions = null;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      alive();
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        let event;
        try {
          event = JSON.parse(line.slice(5));
        } catch {
          continue;
        }
        if (event.error) throw httpError(event.error.code || 500, `Gemini ${model}: ${event.error.message}`);
        const c = event.candidates?.[0];
        finish = c?.finishReason || finish;
        suggestions = c?.groundingMetadata?.searchEntryPoint?.renderedContent || suggestions;
        const piece = textOf(c);
        if (piece) {
          text += piece;
          onText(text);
        }
      }
    }
    return { text, complete: !finish || finish === "STOP", suggestions };
  } catch (err) {
    if (err.name === "AbortError") throw httpError(504, `Gemini ${model}: timeout — no reply for ${timeoutMs / 1000}s`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// --- Speech: text → a .wav file ---

// Gemini returns raw 16-bit PCM; a WAV header makes it playable everywhere.
function wavFromPcm(pcm, rate = 24000) {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + pcm.length, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, pcm.length, true);
  return new Blob([header, pcm], { type: "audio/wav" });
}

const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export async function geminiSpeech(key, models, text, voice = "Kore", style = "") {
  let last = null;
  for (const model of models) {
    try {
      const body = {
        contents: [{ parts: [{ text: style ? `${style}:\n${text}` : text }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
      };
      const json = await geminiGenerate(key, model, body, 120000);
      const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part) throw httpError(500, `Gemini ${model}: no audio came back`);
      const rate = Number((part.inlineData.mimeType || "").match(/rate=(\d+)/)?.[1]) || 24000;
      return wavFromPcm(bytes(part.inlineData.data), rate);
    } catch (err) {
      last = err;
    }
  }
  throw last || httpError(503, "No speech model available");
}

// --- Pictures: a description → an image ---
export async function geminiImage(key, models, prompt, photo = null) {
  let last = null;
  for (const model of models) {
    try {
      const parts = [{ text: prompt }];
      if (photo) parts.push({ inlineData: { mimeType: photo.mimeType, data: photo.data } });
      const json = await geminiGenerate(key, model, { contents: [{ parts }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }, 120000);
      const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part) throw httpError(500, `Gemini ${model}: no picture came back${json.candidates?.[0]?.finishReason ? ` (${json.candidates[0].finishReason})` : ""}`);
      return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
    } catch (err) {
      last = err;
    }
  }
  throw last || httpError(503, "No picture model available");
}
