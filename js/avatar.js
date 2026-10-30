// Talk to Nova: a full-screen talking avatar. It listens (speech recognition),
// asks Nova AI through the normal chat (so history, limits, safety and Stop all
// apply), then speaks the answer sentence by sentence with a moving mouth,
// blinking eyes and a face that matches the mood of the answer. It can also
// drive a physical robot body through js/robot.js.

import * as voice from "./voice.js";
import * as robot from "./robot.js";

const SETTINGS_KEY = "mkai-avatar";
const loadSettings = () => {
  try {
    return { rate: 1, voiceName: "", handsFree: true, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return { rate: 1, voiceName: "", handsFree: true };
  }
};
const saveSettings = (s) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {}
};

// ---------- the face ----------
const FACE = `
<svg class="av-face" viewBox="0 0 200 200" role="img" aria-label="Nova, the Nova AI avatar">
  <defs>
    <linearGradient id="avRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#6366f1"/></linearGradient>
    <linearGradient id="avHead" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#12285a"/><stop offset="1" stop-color="#0a1a3a"/></linearGradient>
  </defs>
  <g class="av-halo"><circle cx="100" cy="100" r="93" fill="none" stroke="url(#avRing)" stroke-width="3" stroke-dasharray="40 14" stroke-linecap="round"/></g>
  <rect x="32" y="30" width="136" height="142" rx="56" fill="url(#avHead)" stroke="#2563eb" stroke-width="2.5"/>
  <circle cx="100" cy="44" r="4" fill="#22d3ee" class="av-light"/>
  <g class="av-cheeks" opacity="0"><ellipse cx="64" cy="122" rx="10" ry="6" fill="#f472b6" opacity=".35"/><ellipse cx="136" cy="122" rx="10" ry="6" fill="#f472b6" opacity=".35"/></g>
  <path class="av-brow av-brow-l" d="M64 70 Q78 63 92 70" fill="none" stroke="#93c5fd" stroke-width="4" stroke-linecap="round"/>
  <path class="av-brow av-brow-r" d="M108 70 Q122 63 136 70" fill="none" stroke="#93c5fd" stroke-width="4" stroke-linecap="round"/>
  <g class="av-eye av-eye-l" transform="translate(78 94)"><ellipse rx="14" ry="16" fill="#e0f2fe"/><g class="av-pupil"><circle r="7" fill="#0ea5e9"/><circle r="3" fill="#082f49"/><circle cx="2.5" cy="-2.5" r="1.8" fill="#fff"/></g></g>
  <g class="av-eye av-eye-r" transform="translate(122 94)"><ellipse rx="14" ry="16" fill="#e0f2fe"/><g class="av-pupil"><circle r="7" fill="#0ea5e9"/><circle r="3" fill="#082f49"/><circle cx="2.5" cy="-2.5" r="1.8" fill="#fff"/></g></g>
  <path class="av-smile" d="M84 132 Q100 142 116 132" fill="none" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
  <ellipse class="av-mouth" cx="100" cy="134" rx="14" ry="2" fill="#020617" stroke="#38bdf8" stroke-width="3"/>
</svg>`;

// How the face looks for each mood: brow tilt, smile curve, cheeks
const MOODS = {
  calm: { brow: 0, smile: 8, cheeks: 0 },
  happy: { brow: -3, smile: 14, cheeks: 1 },
  caring: { brow: 5, smile: 4, cheeks: 0.4 },
  thinking: { brow: -5, smile: 2, cheeks: 0 },
  curious: { brow: -6, smile: 7, cheeks: 0 },
  sorry: { brow: 7, smile: -4, cheeks: 0 },
};

// The mood of an answer, from its words
export function moodOf(answer = "") {
  const a = answer.toLowerCase();
  if (/14416|\b112\b|helpline|you matter|you're not alone|you are not alone|that sounds (really )?(hard|tough|painful|difficult)|i'?m (so |really )?sorry (you|to hear)/.test(a)) return "caring";
  if (/something went wrong|couldn'?t|can'?t answer|try again|stopped/.test(a)) return "sorry";
  if (/\b(great|awesome|congrat\w*|well done|amazing|yay|glad|wonderful|fantastic)\b|!/.test(a)) return "happy";
  if (/\?\s*$/.test(answer.trim())) return "curious";
  return "calm";
}

// Long answers are spoken a sentence (or two) at a time
export function sentencesOf(text, max = 220) {
  const clean = voice.speakable(text);
  const parts = clean.match(/[^.!?।\n]+[.!?।]*\s*/g) || [clean];
  const out = [];
  let cur = "";
  for (const p of parts) {
    if ((cur + p).length > max && cur) {
      out.push(cur.trim());
      cur = "";
    }
    if (p.length > max) {
      for (let i = 0; i < p.length; i += max) out.push(p.slice(i, i + max).trim());
    } else cur += p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter((s) => /[\p{L}\p{N}]/u.test(s));
}

let ui = null; // the open avatar, if any

// opts: { ask(text) → bool, stop(), isBusy(), personas: [{key,label}], getPersona(), setPersona(key) }
export function openAvatar(opts) {
  if (ui) return ui;
  ui = createAvatar(opts);
  return ui;
}
export const avatarOpen = () => !!ui;

function createAvatar(opts) {
  const settings = loadSettings();
  const root = document.createElement("div");
  root.className = "avatar-overlay";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Talk to Nova");
  root.innerHTML = `
    <div class="av-top">
      <label class="av-mode"><span>Mode</span><select class="av-mode-select" aria-label="Mode"></select></label>
      <span class="av-robot-chip hidden"></span>
      <button type="button" class="av-icon av-settings-btn" aria-label="Voice and robot settings" title="Voice and robot settings">⚙</button>
      <button type="button" class="av-icon av-close" aria-label="Close" title="Close (Esc)">✕</button>
    </div>
    <div class="av-stage">
      <button type="button" class="av-face-btn" aria-label="Tap to talk or to stop">${FACE}</button>
      <p class="av-state" aria-live="polite">Hi!</p>
      <div class="av-captions" aria-live="polite">
        <p class="av-you hidden"></p>
        <p class="av-says"></p>
      </div>
    </div>
    <form class="av-bar">
      <button type="button" class="av-mic" aria-label="Talk" title="Talk">🎤</button>
      <input class="av-input" placeholder="Or type to Nova…" autocomplete="off" maxlength="2000" aria-label="Type a message to Nova" />
      <button type="submit" class="av-send">Send</button>
      <button type="button" class="av-stop hidden">Stop</button>
    </form>
    <p class="av-note">Your conversation is also saved in the chat. Nova AI can make mistakes and isn't a doctor, therapist or financial adviser.</p>
    <div class="av-panel hidden" role="group" aria-label="Settings">
      <p class="av-panel-title">Voice</p>
      <label>Voice <select class="av-voice"></select></label>
      <label>Speed <input type="range" class="av-rate" min="0.7" max="1.4" step="0.05" /></label>
      <label class="av-check"><input type="checkbox" class="av-hands" /> Hands-free: listen again after each answer</label>
      <p class="av-panel-title">Robot body</p>
      <p class="av-robot-status">No robot connected.</p>
      <div class="av-robot-btns">
        <button type="button" data-kind="bluetooth">Bluetooth</button>
        <button type="button" data-kind="usb">USB cable</button>
        <button type="button" data-kind="wifi">Wi-Fi</button>
        <button type="button" class="av-robot-off hidden">Disconnect</button>
      </div>
      <input class="av-robot-url hidden" value="ws://localhost:8765" aria-label="Robot Wi-Fi address" />
      <p class="av-robot-help">The robot moves its mouth, face and head as Nova talks. How to build one: <a href="https://github.com/rsmohnishkumar-design/MK.AI/tree/main/robot" target="_blank" rel="noopener">robot guide</a>.</p>
    </div>`;
  document.body.append(root);
  document.body.classList.add("avatar-on");

  const q = (s) => root.querySelector(s);
  const face = q(".av-face"), stateEl = q(".av-state"), youEl = q(".av-you"), saysEl = q(".av-says");
  const mic = q(".av-mic"), input = q(".av-input"), sendBtn = q(".av-send"), stopBtn = q(".av-stop");
  const eyes = [...root.querySelectorAll(".av-eye")], pupils = [...root.querySelectorAll(".av-pupil")];
  const mouthEl = q(".av-mouth"), smileEl = q(".av-smile"), browL = q(".av-brow-l"), browR = q(".av-brow-r"), cheeks = q(".av-cheeks"), halo = q(".av-halo");

  // ---------- state ----------
  let state = "idle"; // idle | listening | thinking | speaking
  let mood = "calm";
  let mouthOpen = 0, mouthTarget = 0, pulse = 0;
  let look = { x: 0, y: 0 }, lookTarget = { x: 0, y: 0 };
  let blinkUntil = 0, nextBlink = performance.now() + 2000;
  let stopListening = null;
  let speakToken = 0;
  let waiting = null; // resolves when the chat finishes an answer
  let closed = false;

  const STATE_TEXT = { idle: voice.canListen ? "Tap me or the mic to talk" : "Type a message to talk", listening: "Listening…", thinking: "Thinking…", speaking: "Speaking… (tap me to interrupt)" };
  function setState(s) {
    state = s;
    root.dataset.state = s;
    stateEl.textContent = STATE_TEXT[s];
    mic.classList.toggle("on", s === "listening");
    mic.setAttribute("aria-pressed", String(s === "listening"));
    const busy = s === "thinking" || s === "speaking";
    stopBtn.classList.toggle("hidden", !busy);
    sendBtn.classList.toggle("hidden", busy);
    robot.send({ t: "state", v: s });
    if (s === "thinking") {
      setMood("thinking");
      robot.send({ t: "gesture", v: "think" });
    }
    if (s !== "speaking") robot.mouth(0);
  }
  function setMood(m) {
    mood = MOODS[m] ? m : "calm";
    root.dataset.mood = mood;
    robot.send({ t: "emotion", v: mood });
  }

  // ---------- animation ----------
  function onPointer(e) {
    const r = face.getBoundingClientRect();
    lookTarget = { x: Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 1.5))), y: Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height * 1.5))) };
  }
  root.addEventListener("pointermove", onPointer);
  let raf = 0;
  function frame(now) {
    if (closed) return;
    // mouth: open and close in a speech-like rhythm while speaking, with a kick on each word
    if (state === "speaking") {
      const wave = Math.abs(Math.sin(now / 55)) * (0.55 + 0.45 * Math.sin(now / 170));
      mouthTarget = Math.min(1, 0.15 + 0.6 * wave + pulse);
      pulse *= 0.86;
    } else mouthTarget = 0;
    mouthOpen += (mouthTarget - mouthOpen) * 0.45;
    robot.mouth(mouthOpen);
    const m = MOODS[mood];
    mouthEl.setAttribute("ry", (2 + mouthOpen * 13).toFixed(2));
    mouthEl.setAttribute("rx", (14 - mouthOpen * 3).toFixed(2));
    mouthEl.style.opacity = mouthOpen > 0.06 ? "1" : "0";
    smileEl.style.opacity = mouthOpen > 0.06 ? "0" : "1";
    smileEl.setAttribute("d", `M84 132 Q100 ${132 + m.smile} 116 132`);
    browL.setAttribute("transform", `rotate(${m.brow} 78 70)`);
    browR.setAttribute("transform", `rotate(${-m.brow} 122 70)`);
    cheeks.setAttribute("opacity", String(m.cheeks));
    // eyes: look at the pointer; up and aside while thinking; blink now and then
    if (state === "thinking") lookTarget = { x: -0.6 + 0.3 * Math.sin(now / 600), y: -0.7 };
    else if (state === "listening") lookTarget = { x: 0, y: 0 };
    look.x += (lookTarget.x - look.x) * 0.12;
    look.y += (lookTarget.y - look.y) * 0.12;
    for (const p of pupils) p.setAttribute("transform", `translate(${(look.x * 5).toFixed(2)} ${(look.y * 5).toFixed(2)})`);
    if (now > nextBlink) {
      blinkUntil = now + 140;
      nextBlink = now + 2200 + Math.random() * 3200;
    }
    const lid = now < blinkUntil ? 0.1 : state === "listening" ? 1.08 : 1;
    for (const e of eyes) e.firstElementChild.setAttribute("ry", (16 * lid).toFixed(2));
    // the ring spins while thinking and pulses while listening
    const spin = state === "thinking" ? (now / 8) % 360 : 0;
    const grow = state === "listening" ? 1 + 0.03 * Math.sin(now / 160) : 1;
    halo.setAttribute("transform", `rotate(${spin.toFixed(1)} 100 100) translate(100 100) scale(${grow.toFixed(3)}) translate(-100 -100)`);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // ---------- speaking ----------
  function voiceFor(lang) {
    if (!voice.canSpeak) return null;
    const voices = speechSynthesis.getVoices();
    return (
      (settings.voiceName && voices.find((v) => v.name === settings.voiceName && v.lang.slice(0, 2) === lang.slice(0, 2))) ||
      voices.find((v) => v.lang === lang) ||
      voices.find((v) => v.lang?.startsWith(lang.slice(0, 2))) ||
      null
    );
  }
  function sayOne(sentence, token) {
    return new Promise((resolve) => {
      if (token !== speakToken) return resolve();
      saysEl.textContent = sentence;
      robot.send({ t: "say", text: sentence });
      // Without speech (or a silent browser), the mouth still moves for about as long as it'd take
      const words = sentence.split(/\s+/).length;
      const estimate = Math.max(900, (words * 330) / settings.rate);
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(fallback);
        resolve();
      };
      let fallback = setTimeout(finish, estimate + 4000);
      if (!voice.canSpeak) {
        clearTimeout(fallback);
        fallback = setTimeout(finish, estimate);
        return;
      }
      const u = new SpeechSynthesisUtterance(sentence);
      u.lang = voice.languageOf(sentence);
      const v = voiceFor(u.lang);
      try {
        if (v) u.voice = v;
      } catch {}
      u.rate = settings.rate;
      let started = false;
      u.onstart = () => (started = true);
      u.onboundary = () => (pulse = 0.45);
      u.onend = finish;
      u.onerror = finish;
      speechSynthesis.speak(u);
      // Some browsers never start (no voices): fall back to the timed mouth
      setTimeout(() => {
        if (!started && !done) {
          speechSynthesis.cancel();
          clearTimeout(fallback);
          fallback = setTimeout(finish, estimate);
        }
      }, 1500);
    });
  }
  async function speak(text) {
    const token = ++speakToken;
    const parts = sentencesOf(text);
    if (!parts.length) return;
    setState("speaking");
    for (const s of parts) {
      if (token !== speakToken || closed) return;
      await sayOne(s, token);
    }
    if (token !== speakToken || closed) return;
    setState("idle");
    if (mood === "happy" || mood === "calm") robot.send({ t: "gesture", v: "nod" });
    if (settings.handsFree && voice.canListen) setTimeout(() => !closed && state === "idle" && listen(), 450);
  }
  function stopSpeaking() {
    speakToken++;
    if (voice.canSpeak) speechSynthesis.cancel();
  }

  // ---------- listening ----------
  let lastText = "";
  function listen() {
    if (!voice.canListen || closed) return;
    stopSpeaking();
    stopListening?.();
    setState("listening");
    youEl.classList.add("hidden");
    try {
      stopListening = voice.listen({
        lang: voice.languageOf(lastText),
        onText: (t) => {
          youEl.textContent = t;
          youEl.classList.toggle("hidden", !t);
        },
        onEnd: (t) => {
          stopListening = null;
          if (closed) return;
          if (t) ask(t);
          else setState("idle");
        },
        onError: (code) => {
          stopListening = null;
          if (closed) return;
          setState("idle");
          if (code !== "aborted" && code !== "no-speech") saysEl.textContent = voice.listenErrorMessage(code);
        },
      });
    } catch (err) {
      stopListening = null;
      setState("idle");
      saysEl.textContent = voice.listenErrorMessage(err?.name);
    }
  }

  // ---------- asking Nova AI ----------
  function waitForAnswer() {
    return new Promise((resolve) => {
      const done = (e) => {
        document.removeEventListener("mkai-answer", done);
        waiting = null;
        resolve(e.detail || {});
      };
      waiting = { cancel: () => done({ detail: { answer: "", cancelled: true } }) };
      document.addEventListener("mkai-answer", done);
    });
  }
  async function ask(text) {
    text = String(text || "").trim();
    if (!text || closed) return;
    stopSpeaking();
    stopListening?.();
    stopListening = null;
    if (opts.isBusy?.()) {
      saysEl.textContent = "I'm still answering. Tap Stop first.";
      return;
    }
    lastText = text;
    youEl.textContent = text;
    youEl.classList.remove("hidden");
    saysEl.textContent = "";
    setState("thinking");
    const answered = waitForAnswer();
    if (!opts.ask(text)) {
      waiting?.cancel();
      setState("idle");
      saysEl.textContent = "I can't answer right now. Check the chat screen.";
      return;
    }
    const { answer, cancelled, blocked } = await answered;
    if (closed || cancelled) return;
    if (blocked || !answer) {
      setMood("sorry");
      setState("idle");
      saysEl.textContent = blocked ? "You've reached your free limit for now. The chat screen shows when it resets." : "Sorry, I couldn't answer that. Try again.";
      return;
    }
    setMood(moodOf(answer));
    await speak(answer);
  }
  function stopAll() {
    stopSpeaking();
    stopListening?.();
    stopListening = null;
    if (state === "thinking") opts.stop?.();
    waiting?.cancel();
    setState("idle");
  }

  // ---------- controls ----------
  q(".av-face-btn").addEventListener("click", () => {
    if (state === "speaking" || state === "thinking") {
      stopAll();
      if (voice.canListen) listen();
    } else if (state === "listening") {
      stopListening?.();
    } else if (voice.canListen) listen();
    else input.focus();
  });
  mic.classList.toggle("hidden", !voice.canListen);
  mic.addEventListener("click", () => (state === "listening" ? stopListening?.() : listen()));
  q(".av-bar").addEventListener("submit", (e) => {
    e.preventDefault();
    const t = input.value;
    input.value = "";
    input.focus(); // keep typing here (the Send button hides while Nova answers)
    ask(t);
  });
  stopBtn.addEventListener("click", stopAll);
  q(".av-close").addEventListener("click", close);
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  });

  // Mode (personality): Assistant, Friend, Wellbeing support, Money help…
  const modeSel = q(".av-mode-select");
  for (const p of opts.personas || []) modeSel.append(new Option(p.label, p.key));
  modeSel.value = opts.getPersona?.() || "assistant";
  modeSel.addEventListener("change", () => {
    opts.setPersona?.(modeSel.value);
    const intro = {
      wellbeing: "I'm here to listen. How are you feeling today?",
      money: "Let's sort out your money worries together. What's on your mind?",
      friend: "Hey! What's up?",
      tutor: "What shall we learn today?",
    }[modeSel.value];
    if (intro) {
      setMood(modeSel.value === "wellbeing" ? "caring" : "happy");
      speak(intro);
    }
  });

  // Settings: voice, speed, hands-free, robot
  const panel = q(".av-panel");
  q(".av-settings-btn").addEventListener("click", () => panel.classList.toggle("hidden"));
  const voiceSel = q(".av-voice");
  function fillVoices() {
    if (!voice.canSpeak) {
      voiceSel.replaceChildren(new Option("Not available in this browser", ""));
      voiceSel.disabled = true;
      return;
    }
    const voices = speechSynthesis.getVoices().filter((v) => /^(en|ta|hi)/i.test(v.lang));
    voiceSel.replaceChildren(new Option("Automatic", ""), ...voices.map((v) => new Option(`${v.name} (${v.lang})`, v.name)));
    voiceSel.value = settings.voiceName;
  }
  fillVoices();
  if (voice.canSpeak) speechSynthesis.addEventListener?.("voiceschanged", fillVoices);
  voiceSel.addEventListener("change", () => {
    settings.voiceName = voiceSel.value;
    saveSettings(settings);
    speak("Hi, this is my new voice.");
  });
  const rate = q(".av-rate");
  rate.value = settings.rate;
  rate.addEventListener("change", () => {
    settings.rate = Number(rate.value) || 1;
    saveSettings(settings);
  });
  const hands = q(".av-hands");
  hands.checked = settings.handsFree;
  hands.addEventListener("change", () => {
    settings.handsFree = hands.checked;
    saveSettings(settings);
  });

  const chip = q(".av-robot-chip"), robotStatus = q(".av-robot-status"), robotOff = q(".av-robot-off"), robotUrl = q(".av-robot-url");
  function showRobot(s) {
    chip.classList.toggle("hidden", !s.connected);
    chip.textContent = s.connected ? `🤖 ${s.name}` : "";
    robotStatus.textContent = s.connected ? `Connected: ${s.name} (${s.kind}).` : "No robot connected.";
    robotOff.classList.toggle("hidden", !s.connected);
  }
  const offStatus = robot.onStatus(showRobot);
  showRobot(robot.status());
  for (const b of root.querySelectorAll(".av-robot-btns [data-kind]")) {
    const kind = b.dataset.kind;
    if ((kind === "bluetooth" && !robot.canBluetooth) || (kind === "usb" && !robot.canSerial)) b.disabled = true;
    b.addEventListener("click", async () => {
      if (kind === "wifi" && robotUrl.classList.contains("hidden")) {
        robotUrl.classList.remove("hidden");
        robotUrl.focus();
        robotStatus.textContent = "Type the robot's address, then tap Wi-Fi again.";
        return;
      }
      robotStatus.textContent = "Connecting…";
      try {
        await robot.connect(kind, { url: robotUrl.value.trim() });
        robot.send({ t: "gesture", v: "wave" });
        robot.send({ t: "emotion", v: mood });
      } catch (err) {
        robotStatus.textContent = err?.name === "NotFoundError" ? "No robot was chosen." : `Couldn't connect: ${err?.message || err}`;
      }
    });
  }
  robotOff.addEventListener("click", () => robot.disconnect());
  // The robot can talk to Nova too: its own mic, or a "talk" button
  const offMsg = robot.onMessage((m) => {
    if (closed) return;
    if (m.t === "heard" && typeof m.text === "string") ask(m.text.slice(0, 2000));
    else if (m.t === "button" && m.v === "talk") listen();
  });

  function close() {
    if (closed) return;
    stopAll();
    closed = true;
    cancelAnimationFrame(raf);
    robot.send({ t: "state", v: "idle" });
    offStatus();
    offMsg();
    if (voice.canSpeak) speechSynthesis.removeEventListener?.("voiceschanged", fillVoices);
    root.remove();
    document.body.classList.remove("avatar-on");
    ui = null;
    opts.onClose?.();
  }

  // Say hello, then listen
  setState("idle");
  setMood("happy");
  robot.send({ t: "gesture", v: "wave" });
  q(".av-face-btn").focus();
  speak("Hi! I'm Nova. What would you like to talk about?");

  return { close, ask, listen, speak, get state() { return state; }, get mood() { return mood; } };
}
