// MK.ai Voiceover: "make a voiceover: Welcome to our school annual day…" or
// "make a voiceover about the water cycle". MK.ai writes the script (or uses
// yours), then reads it aloud with the voices built into the device, with a
// choice of voice, style, speed and pitch. On a computer the narration can
// also be recorded to an audio file by sharing the tab's sound. No outside AI.

import { researchTopic } from "./office.js";

const ASK = /\b(voice ?-?overs?|narrat(?:e|ion|or)|text to speech|tts|text to voice|read (?:this|it|the following|my script)(?: out)?(?: aloud| loud)?|speak (?:this|the following)|ai voice|dubbing|audio version)\b/i;

export function isVoiceoverRequest(question) {
  const q = question.trim();
  if (!ASK.test(q)) return false;
  // Questions about voiceovers aren't requests for one
  if (/^(what|who|why|when|where|which|is|are|does|explain|define|tell me about|how (?:do|does|much))\b/i.test(q) && !/[:"“]/.test(q)) return false;
  // "how to become a voice over artist" is a career question
  if (/\b(artists?|actors?|career|jobs?|become|salary|courses?|earn|meaning)\b/i.test(q) && !scriptIn(q)) return false;
  return true;
}

// The script the person gave: after a colon, inside quotes, or after "saying"
export function scriptIn(question) {
  const q = question.trim();
  const quoted = q.match(/["“]([\s\S]{8,})["”]/);
  if (quoted) return quoted[1].trim();
  const colon = q.match(/^[^:\n]{0,80}[:\n]\s*([\s\S]{8,})$/);
  if (colon) return colon[1].trim();
  const saying = q.match(/\b(?:saying|that says|which says|for this text|for this script|for the text|of this text|this text)\s+([\s\S]{8,})$/i);
  if (saying) return saying[1].trim();
  return "";
}

// "make a voiceover about the water cycle" → "the water cycle"
export function topicIn(question) {
  const q = question.toLowerCase().replace(/[?.!]+$/, "");
  const m = q.match(/\b(?:about|on|explaining|describing|introducing)\s+(.+)$/) || q.match(/\bfor\s+(.+)$/);
  if (!m) return "";
  return m[1]
    .replace(/\b(in (english|tamil|hindi)|with (a )?(male|female|deep|calm|kid|child|cartoon|energetic) voice|please|pls|for (my )?(video|youtube|reel|project|class|school|presentation|channel))\b.*$/g, "")
    .replace(/^(a|an|the)\s+(?=\w+\s)/, "")
    .trim();
}

function styleIn(q) {
  const t = q.toLowerCase();
  if (/\b(energetic|excited|exciting|hype|promo|advert|ad\b|commercial)\b/.test(t)) return "energetic";
  if (/\b(calm|soft|slow|meditation|relax|story ?time|bedtime)\b/.test(t)) return "calm";
  if (/\b(deep|movie trailer|trailer|serious|documentary)\b/.test(t)) return "deep";
  if (/\b(kid|kids|child|children|cartoon|funny)\b/.test(t)) return "cartoon";
  return "narrator";
}

const STYLES = {
  narrator: { label: "Narrator", rate: 0.95, pitch: 1 },
  energetic: { label: "Energetic", rate: 1.15, pitch: 1.15 },
  calm: { label: "Calm", rate: 0.8, pitch: 0.95 },
  deep: { label: "Deep (trailer)", rate: 0.85, pitch: 0.6 },
  cartoon: { label: "Cartoon", rate: 1.1, pitch: 1.7 },
};

const cap = (t) => t.replace(/^\w/, (c) => c.toUpperCase());

// A spoken script about a topic: a welcome, the facts, and a sign-off
async function writeScript(topic) {
  const info = await researchTopic(topic).catch(() => null);
  if (!info || !info.intro.length) return null;
  const facts = info.intro.slice(0, 5);
  for (const sec of info.sections.slice(0, 2)) facts.push(sec.sentences[0]);
  const lines = [
    `Hello and welcome! Today, let's discover ${info.title}.`,
    ...facts,
    `And that's a quick look at ${info.title}. Thanks for listening, and keep learning with MK dot A I!`,
  ];
  return { title: info.title, script: lines.join("\n\n"), source: info.source };
}

export async function voiceoverAnswer(question) {
  if (!isVoiceoverRequest(question)) return null;
  const style = styleIn(question);
  let script = scriptIn(question);
  let title = "Your voiceover";
  let source = "";
  let wrote = false;
  if (!script) {
    const topic = topicIn(question);
    if (topic) {
      const made = await writeScript(topic);
      if (made) {
        ({ title, script, source } = made);
        wrote = true;
      } else title = cap(topic);
    }
  }
  const tamil = /[஀-௿]/.test(script);
  const plan = { title, script, style, lang: tamil ? "ta" : "en", source };
  const intro = wrote
    ? `🎙️ **Voiceover: ${title}** — I wrote a script for you${source ? ` (from ${source})` : ""} and it's ready to play.`
    : script
      ? "🎙️ **Your voiceover is ready.** Press ▶ Play to hear it."
      : `🎙️ **Voiceover studio** — type or paste your script in the box, then press ▶ Play.${title !== "Your voiceover" ? ` (I couldn't find information about “${title}” right now, so write the script yourself or try another topic.)` : ""}`;
  return [
    intro,
    "",
    `Choose a **voice**, a **style** (${Object.values(STYLES).map((s) => s.label).join(", ")}), and the **speed** and **pitch**. You can edit the script and play it again.`,
    "",
    "```mkai-voice\n" + JSON.stringify(plan) + "\n```",
    "",
    "ℹ️ The voices come from your device (Android, Windows and Chrome each have their own, including Tamil and Hindi on many phones). To save the audio as a file, use **🔴 Record** on a computer, or a screen recorder on your tablet.",
  ].join("\n");
}

// ---------- The voiceover studio in the chat ----------

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

const sentences = (text) =>
  text
    .replace(/\s+/g, " ")
    .match(/[^.!?।]+[.!?।]*\s*/g)
    ?.map((s) => s.trim())
    .filter(Boolean) || [];

export function mountVoiceover(container, text) {
  let plan;
  try {
    plan = JSON.parse(text);
  } catch {
    return;
  }
  const synth = window.speechSynthesis;
  const box = el("div", "office-box voice-box");
  const head = el("div", "office-head");
  head.append(el("span", "office-type", "AI voiceover"), el("span", "office-title", plan.title));
  box.append(head);

  const body = el("div", "voice-body");
  const script = el("textarea", "voice-script");
  script.value = plan.script || "";
  script.placeholder = "Type or paste what the voice should say…";
  script.rows = 7;
  body.append(script);

  const controls = el("div", "voice-controls");
  const voiceSel = el("select", "voice-select");
  voiceSel.setAttribute("aria-label", "Voice");
  const styleSel = el("select", "voice-select");
  styleSel.setAttribute("aria-label", "Style");
  for (const [k, s] of Object.entries(STYLES)) styleSel.add(new Option(s.label, k));
  styleSel.value = plan.style in STYLES ? plan.style : "narrator";
  const slider = (label, min, max, step, value) => {
    const wrap = el("label", "voice-slider");
    const out = el("span", null, "");
    const input = el("input");
    Object.assign(input, { type: "range", min, max, step, value });
    const show = () => (out.textContent = `${label} ${Number(input.value).toFixed(2).replace(/\.?0+$/, "")}${label === "Speed" ? "×" : ""}`);
    input.addEventListener("input", show);
    show();
    wrap.append(out, input);
    return { wrap, input, show };
  };
  const rate = slider("Speed", 0.5, 2, 0.05, STYLES[styleSel.value].rate);
  const pitch = slider("Pitch", 0, 2, 0.05, STYLES[styleSel.value].pitch);
  styleSel.addEventListener("change", () => {
    rate.input.value = STYLES[styleSel.value].rate;
    pitch.input.value = STYLES[styleSel.value].pitch;
    rate.show();
    pitch.show();
  });
  controls.append(voiceSel, styleSel, rate.wrap, pitch.wrap);
  body.append(controls);

  const now = el("p", "voice-now", "");
  body.append(now);
  box.append(body);

  const bar = el("div", "office-bar");
  const play = el("button", "office-download", "▶ Play");
  const pause = el("button", "voice-btn", "⏸ Pause");
  const stop = el("button", "voice-btn", "⏹ Stop");
  const save = el("button", "voice-btn", "⬇ Script");
  for (const b of [play, pause, stop, save]) b.type = "button";
  bar.append(play, pause, stop, save);
  const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && window.MediaRecorder) && !/Android|iPhone|iPad/i.test(navigator.userAgent);
  const rec = el("button", "voice-btn", "🔴 Record");
  rec.type = "button";
  rec.title = "Save the narration as an audio file (computer only): choose this tab and turn on “Share tab audio”.";
  if (canRecord) bar.append(rec);
  box.append(bar);
  container.append(box);

  if (!synth || !window.SpeechSynthesisUtterance) {
    now.textContent = "This browser can't speak. Try Chrome or Edge.";
    for (const b of [play, pause, stop, rec]) b.disabled = true;
  }

  // Voices load late on some browsers
  let voices = [];
  const wantLang = () => (/[஀-௿]/.test(script.value) ? "ta" : plan.lang || "en");
  const fillVoices = () => {
    if (!synth) return;
    voices = synth.getVoices();
    const keep = voiceSel.value;
    voiceSel.innerHTML = "";
    voiceSel.add(new Option("Default voice", ""));
    const lang = wantLang();
    const sorted = [...voices].sort((a, b) => (b.lang.startsWith(lang) - a.lang.startsWith(lang)) || (b.lang === "en-IN") - (a.lang === "en-IN") || a.name.localeCompare(b.name));
    for (const v of sorted) voiceSel.add(new Option(`${v.name} (${v.lang})`, v.name));
    if (keep && voices.some((v) => v.name === keep)) voiceSel.value = keep;
    else {
      const best = sorted.find((v) => v.lang.startsWith(lang));
      if (best) voiceSel.value = best.name;
    }
  };
  fillVoices();
  synth?.addEventListener?.("voiceschanged", fillVoices);

  let queue = [];
  let speaking = false;
  let recorder = null;
  const finish = (msg) => {
    speaking = false;
    play.textContent = "▶ Play";
    pause.textContent = "⏸ Pause";
    now.textContent = msg || "";
    if (recorder && recorder.state === "recording") setTimeout(() => recorder.state === "recording" && recorder.stop(), 600);
  };
  const speakNext = () => {
    if (!speaking) return;
    const part = queue.shift();
    if (!part) return finish("✓ Finished.");
    const u = new SpeechSynthesisUtterance(part);
    const v = voices.find((x) => x.name === voiceSel.value);
    try {
      if (v) u.voice = v;
    } catch {}
    u.lang = v?.lang || (wantLang() === "ta" ? "ta-IN" : "en-IN");
    u.rate = Number(rate.input.value);
    u.pitch = Number(pitch.input.value);
    u.onstart = () => (now.textContent = "🔊 " + part);
    u.onend = speakNext;
    u.onerror = (e) => (e.error === "interrupted" || e.error === "canceled" ? null : finish("Couldn't play that voice. Choose another voice and try again."));
    synth.speak(u);
  };
  const start = () => {
    const text = script.value.trim();
    if (!text) return (now.textContent = "Type a script first.");
    synth.cancel();
    // One sentence at a time: long text in one go gets cut off in Chrome
    queue = sentences(text);
    speaking = true;
    play.textContent = "↻ Restart";
    speakNext();
  };
  play.addEventListener("click", start);
  pause.addEventListener("click", () => {
    if (!speaking) return;
    if (synth.paused) {
      synth.resume();
      pause.textContent = "⏸ Pause";
    } else {
      synth.pause();
      pause.textContent = "▶ Resume";
    }
  });
  stop.addEventListener("click", () => {
    speaking = false;
    synth?.cancel();
    finish("Stopped.");
  });
  save.addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([script.value], { type: "text/plain" }));
    a.download = (plan.title || "voiceover").replace(/[^\w -]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() + "-script.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
  rec.addEventListener("click", async () => {
    if (recorder && recorder.state === "recording") return recorder.stop();
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, preferCurrentTab: true, selfBrowserSurface: "include", systemAudio: "include" });
    } catch {
      return (now.textContent = "Recording cancelled.");
    }
    const audio = stream.getAudioTracks();
    stream.getVideoTracks().forEach((t) => t.stop());
    if (!audio.length) {
      stream.getTracks().forEach((t) => t.stop());
      return (now.textContent = "No sound was shared. Press Record again, choose this tab, and turn on “Share tab audio”.");
    }
    const chunks = [];
    recorder = new MediaRecorder(new MediaStream(audio));
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      audio.forEach((t) => t.stop());
      rec.textContent = "🔴 Record";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
      a.download = (plan.title || "voiceover").replace(/[^\w -]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() + ".webm";
      a.click();
      now.textContent = "✓ Saved the audio file (.webm — plays in Chrome, VLC and most video editors).";
    };
    recorder.start();
    rec.textContent = "⏹ Stop recording";
    start();
  });
}
