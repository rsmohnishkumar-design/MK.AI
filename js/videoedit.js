// Video editing, entirely on the device: trim, speed up or slow down, mute,
// colour filters, rotate or flip, add a caption, or take a still photo from
// a moment. The video plays into a canvas that is recorded as a new .webm file
// (so an edit takes about as long as the edited clip). Nothing is uploaded.

export const MAX_VIDEO_MB = 100;
export const VIDEO_FILE = /\.(mp4|webm|mov|m4v|ogv)$/i;

const num = "(\\d+(?:\\.\\d+)?)";
const unit = "\\s*(?:s|sec|secs|seconds?)?";
// mm:ss or plain seconds
const time = (v) => (v.includes(":") ? v.split(":").reduce((t, x) => t * 60 + Number(x), 0) : Number(v));
const T = "(\\d+:\\d{1,2}|\\d+(?:\\.\\d+)?)";

export function videoEdits(instruction) {
  const q = instruction.toLowerCase();
  const e = { trim: null, speed: 1, mute: false, filters: [], rotate: 0, flip: false, caption: "", frameAt: null };
  let m;
  if ((m = q.match(new RegExp(`(?:from|between|keep)\\s*${T}${unit}\\s*(?:to|and|-|till|until)\\s*${T}`)))) e.trim = { from: time(m[1]), to: time(m[2]) };
  else if ((m = q.match(new RegExp(`(?:cut|remove|delete|skip|trim)\\s*(?:off\\s*)?(?:the\\s*)?first\\s*${num}${unit}`)))) e.trim = { from: Number(m[1]), to: null };
  else if ((m = q.match(new RegExp(`(?:cut|remove|delete|trim)\\s*(?:off\\s*)?(?:the\\s*)?last\\s*${num}${unit}`)))) e.trim = { from: 0, to: -Number(m[1]) };
  else if ((m = q.match(new RegExp(`(?:only\\s*|just\\s*|keep\\s*)?(?:the\\s*)?first\\s*${num}${unit}`)))) e.trim = { from: 0, to: Number(m[1]) };
  else if ((m = q.match(new RegExp(`(?:only\\s*|just\\s*|keep\\s*)?(?:the\\s*)?last\\s*${num}${unit}`)))) e.trim = { from: -Number(m[1]), to: null };
  if ((m = q.match(/(\d+(?:\.\d+)?)\s*x\b/))) e.speed = Math.min(4, Math.max(0.25, Number(m[1])));
  else if (/\b(slow ?mo(tion)?|slower|slow it down|half speed)\b/.test(q)) e.speed = 0.5;
  else if (/\b(speed (it )?up|faster|fast forward|double speed)\b/.test(q)) e.speed = 2;
  if (/\b(mute|no sound|silent|without (the )?(sound|audio)|remove (the )?(sound|audio|music))\b/.test(q)) e.mute = true;
  for (const [re, f] of [
    [/\b(black and white|black & white|b&w|gr[ae]y ?scale|monochrome)\b/, "grayscale(1)"],
    [/\b(sepia|vintage|retro|old film)\b/, "sepia(0.85)"],
    [/\b(brighter|brighten|lighter)\b/, "brightness(1.25)"],
    [/\b(darker|darken)\b/, "brightness(0.8)"],
    [/\b(more contrast|contrast)\b/, "contrast(1.3)"],
    [/\b(vivid|more colou?rful|saturat\w*|vibrant)\b/, "saturate(1.5)"],
    [/\b(invert|negative)\b/, "invert(1)"],
    [/\b(blur|blurry)\b/, "blur(4px)"],
    [/\b(warmer|warm)\b/, "sepia(0.25) saturate(1.2)"],
    [/\b(cooler|cool|cold)\b/, "hue-rotate(-12deg) saturate(1.1)"],
  ]) if (re.test(q)) e.filters.push(f);
  if (/\b(rotate|turn)\b.*\b(left|anti-?clockwise|counter-?clockwise)\b/.test(q)) e.rotate = -90;
  else if (/\b(rotate|turn)\b.*\b180\b|upside down/.test(q)) e.rotate = 180;
  else if (/\b(rotate|turn)\b/.test(q)) e.rotate = 90;
  if (/\b(flip|mirror)\b/.test(q)) e.flip = true;
  if ((m = instruction.match(/(?:add|put|write)\s+(?:a\s+|the\s+)?(?:text|caption|title|subtitle)\s*(?:saying|that says|:)?\s*["“'‘]?([^"”'’]{1,80})["”'’]?\s*$/i))) e.caption = m[1].trim();
  if ((m = q.match(new RegExp(`(?:screenshot|still|frame|photo|picture|thumbnail|snapshot)\\b.*?(?:at|from)\\s*${T}`)))) e.frameAt = time(m[1]);
  return e;
}

export const wantsVideoEdit = (e) => !!(e.trim || e.speed !== 1 || e.mute || e.filters.length || e.rotate || e.flip || e.caption || e.frameAt != null);

export function describe(e, duration) {
  const parts = [];
  if (e.trim) parts.push(`kept ${fmt(e.range[0])}–${fmt(e.range[1])}`);
  if (e.speed !== 1) parts.push(e.speed > 1 ? `${e.speed}× faster` : `${e.speed}× speed (slow motion)`);
  if (e.mute) parts.push("sound removed");
  if (e.filters.length) parts.push("colour filter");
  if (e.rotate) parts.push(`rotated ${e.rotate === 180 ? "180°" : e.rotate > 0 ? "right" : "left"}`);
  if (e.flip) parts.push("mirrored");
  if (e.caption) parts.push(`caption “${e.caption}”`);
  return parts.join(", ") || `full ${fmt(duration)} clip`;
}
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

function loadVideo(url) {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "auto";
    v.playsInline = true;
    v.muted = false;
    v.crossOrigin = "anonymous";
    v.onloadedmetadata = async () => {
      // Videos recorded in browsers often don't store their length: find it by seeking to the end
      if (!Number.isFinite(v.duration)) {
        await new Promise((done) => {
          const t = setTimeout(done, 4000);
          v.addEventListener("durationchange", function check() {
            if (Number.isFinite(v.duration)) {
              v.removeEventListener("durationchange", check);
              clearTimeout(t);
              done();
            }
          });
          v.currentTime = 1e101;
        });
        await new Promise((done) => {
          v.addEventListener("seeked", done, { once: true });
          v.currentTime = 0;
          setTimeout(done, 1500);
        });
      }
      resolve(v);
    };
    v.onerror = () => reject(new Error("This video format can't be opened in your browser. Try an MP4 or WebM file."));
    v.src = url;
  });
}
const seek = (v, t) =>
  new Promise((resolve) => {
    if (Math.abs(v.currentTime - t) < 0.01) return resolve();
    v.addEventListener("seeked", () => resolve(), { once: true });
    v.currentTime = t;
  });

function drawFrame(g, v, e, W, H) {
  g.save();
  g.clearRect(0, 0, W, H);
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  g.translate(W / 2, H / 2);
  if (e.rotate) g.rotate((e.rotate * Math.PI) / 180);
  if (e.flip) g.scale(-1, 1);
  g.filter = e.filters.join(" ") || "none";
  g.drawImage(v, -v.videoWidth / 2, -v.videoHeight / 2, v.videoWidth, v.videoHeight);
  g.restore();
  if (e.caption) {
    const size = Math.round(Math.max(18, H / 14));
    g.font = `700 ${size}px Inter, system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "bottom";
    g.lineWidth = Math.max(3, size / 7);
    g.strokeStyle = "rgba(0,0,0,0.75)";
    g.strokeText(e.caption, W / 2, H - size * 0.8, W * 0.92);
    g.fillStyle = "#fff";
    g.fillText(e.caption, W / 2, H - size * 0.8, W * 0.92);
  }
}

// The edit itself. onProgress(0..1); signal stops it. Resolves { blob, kind }.
export async function renderVideo(file, e, { onProgress = () => {}, signal } = {}) {
  const url = URL.createObjectURL(file);
  try {
    const v = await loadVideo(url);
    const d = v.duration;
    if (!Number.isFinite(d) || d <= 0) throw new Error("This video's length couldn't be read.");
    let from = e.trim?.from ?? 0;
    let to = e.trim?.to ?? d;
    if (from < 0) from = d + from;
    if (to < 0) to = d + to;
    from = Math.max(0, Math.min(from, d));
    to = Math.max(from + 0.1, Math.min(to, d));
    e.range = [from, to];
    const quarter = Math.abs(e.rotate) === 90;
    const W = quarter ? v.videoHeight : v.videoWidth;
    const H = quarter ? v.videoWidth : v.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = W || 640;
    canvas.height = H || 360;
    const g = canvas.getContext("2d");

    // A still photo from one moment
    if (e.frameAt != null && !e.trim && e.speed === 1 && !e.caption && !e.mute) {
      await seek(v, Math.min(Math.max(0, e.frameAt), d - 0.05));
      drawFrame(g, v, e, canvas.width, canvas.height);
      const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
      return { blob, kind: "image", range: [e.frameAt, e.frameAt] };
    }

    if (typeof MediaRecorder === "undefined" || !canvas.captureStream) throw new Error("Your browser can't record video. Try Chrome, Edge or Firefox on a computer or Android.");
    const stream = canvas.captureStream(30);
    // The sound goes straight into the recording (it isn't played out loud)
    let audioCtx = null;
    if (!e.mute) {
      try {
        audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        audioCtx.createMediaElementSource(v).connect(dest);
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      } catch {
        audioCtx = null;
      }
    }
    v.muted = e.mute || !audioCtx;
    const type = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
    const rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 4_000_000 } : undefined);
    const chunks = [];
    rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
    await seek(v, from);
    v.playbackRate = e.speed;
    if ("preservesPitch" in v) v.preservesPitch = true;
    drawFrame(g, v, e, canvas.width, canvas.height);
    const done = new Promise((resolve) => (rec.onstop = resolve));
    rec.start(250);
    await v.play();
    await new Promise((resolve, reject) => {
      const tick = () => {
        if (signal?.aborted) {
          v.pause();
          return reject(Object.assign(new Error("stopped"), { stopped: true }));
        }
        drawFrame(g, v, e, canvas.width, canvas.height);
        onProgress(Math.min(1, (v.currentTime - from) / (to - from)));
        if (v.currentTime >= to || v.ended) {
          v.pause();
          return resolve();
        }
        if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(tick);
        else requestAnimationFrame(tick);
      };
      tick();
    }).finally(() => {
      if (rec.state !== "inactive") rec.stop();
    });
    await done;
    audioCtx?.close();
    return { blob: new Blob(chunks, { type: "video/webm" }), kind: "video", range: [from, to], muted: v.muted };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---- In the chat ----
const results = new Map();

export function videoHelp() {
  return (
    "I can edit this video right here on your device. Try:\n" +
    "- **trim from 0:05 to 0:20**, **keep the first 10 seconds**, **cut the last 3 seconds**\n" +
    "- **speed it up 2x** or **slow motion**\n" +
    "- **mute** (remove the sound)\n" +
    "- **black and white**, **vintage**, **brighter**, **more contrast**, **vivid**\n" +
    "- **rotate right**, **flip**\n" +
    '- **add caption "Happy birthday!"**\n' +
    "- **take a photo at 0:12**\n\n" +
    "I can't watch or understand what's in videos yet; I edit them by your instructions."
  );
}

// Starts the edit and returns the chat answer with a live "mkai-video" block
export function editVideo(att, instruction) {
  const e = videoEdits(instruction);
  if (!wantsVideoEdit(e)) return { answer: videoHelp(), edited: false };
  const id = `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const ctrl = new AbortController();
  const job = { name: att.name, e, ctrl, progress: 0, listeners: new Set(), result: null, error: null };
  job.promise = renderVideo(att.file, e, {
    signal: ctrl.signal,
    onProgress: (p) => {
      job.progress = p;
      job.listeners.forEach((fn) => fn());
    },
  })
    .then((r) => (job.result = r))
    .catch((err) => (job.error = err))
    .finally(() => job.listeners.forEach((fn) => fn()));
  results.set(id, job);
  return { answer: `Editing your video on this device…\n\n\`\`\`mkai-video\n${JSON.stringify({ id, name: att.name })}\n\`\`\``, edited: true };
}

export function renderVideoBlock(container, text) {
  let info = {};
  try {
    info = JSON.parse(text);
  } catch {}
  const job = results.get(info.id);
  const box = el("div", "video-edit");
  container.append(box);
  if (!job) {
    box.append(el("p", "photo-note", "This edited video was made earlier. Edited videos aren't kept after the page reloads, so download them right after editing."));
    return;
  }
  const status = el("p", "photo-note");
  const bar = el("div", "video-progress");
  const fill = el("span");
  bar.append(fill);
  const stop = el("button", "photo-btn", "Stop");
  stop.type = "button";
  stop.addEventListener("click", () => job.ctrl.abort());
  const render = () => {
    if (job.result) {
      box.replaceChildren();
      const r = job.result;
      const url = (job.url ||= URL.createObjectURL(r.blob));
      const media = r.kind === "image" ? el("img", "photo-img") : el("video", "video-out");
      media.src = url;
      if (r.kind === "video") {
        media.controls = true;
        media.playsInline = true;
      } else media.alt = `Still from ${job.name}`;
      const actions = el("div", "photo-bar");
      const dl = el("a", "photo-btn", "⬇ Download");
      dl.href = url;
      dl.download = `${job.name.replace(/\.[^.]+$/, "")}-edited.${r.kind === "image" ? "jpg" : "webm"}`;
      actions.append(dl);
      box.append(media, actions, el("p", "photo-note", r.kind === "image" ? `A still photo from ${fmt(r.range[0])}.` : `Edited on your device: ${describe(job.e, r.range[1])}. Saved as a WebM video${r.muted && !job.e.mute ? " without sound (your browser couldn't record the audio)" : ""}.`));
      return;
    }
    if (job.error) {
      box.replaceChildren(el("p", "photo-note", job.error.stopped ? "Stopped." : `The video couldn't be edited: ${job.error.message}`));
      return;
    }
    fill.style.width = `${Math.round(job.progress * 100)}%`;
    status.textContent = `Editing on your device… ${Math.round(job.progress * 100)}% (it plays through the clip once)`;
  };
  box.append(status, bar, stop);
  job.listeners.add(render);
  render();
}
