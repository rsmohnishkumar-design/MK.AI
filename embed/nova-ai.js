/* Nova AI helper — a chat bubble any website can add with one line before </body>:
     <script src="https://mkai-c042b.web.app/embed/nova-ai.js" data-app="Myhomely" defer></script>
   It's served from Nova AI's own site, so updates reach every site that uses it.
   data-app = the site's name (optional). The site's domain must be allowed in the
   reCAPTCHA key used by App Check, or the AI won't answer there.
   Nova reads the page the user is on, so it can answer questions about it.
   Made by Mohnishkumar. Runs the Alpaca model (Google Gemini via Firebase AI Logic). */
(() => {
  if (window.__novaAI) return;
  window.__novaAI = true;

  // ---------- settings (safe to publish: they only identify the project) ----------
  const me = document.currentScript;
  const APP_NAME = ((me && me.dataset.app) || "Myhomely").replace(/[<>&"`]/g, "").slice(0, 40);
  const FIREBASE = {
    apiKey: "AIzaSyAUJbM-8j7CclTFbsw6mTZIDL3NXoZ10Ec",
    authDomain: "mkai-c042b.firebaseapp.com",
    projectId: "mkai-c042b",
    storageBucket: "mkai-c042b.firebasestorage.app",
    messagingSenderId: "857947772189",
    appId: "1:857947772189:web:3c92efd564cb149d7b7df4",
  };
  const RECAPTCHA_SITE_KEY = "6Ld6B8stAAAAAFa5Ps3LqoSXw3G9P2_1Fpw74xTu";
  const MODELS = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-3.5-flash-lite", "gemini-flash-lite-latest"];
  const LOGO = "https://mkai-c042b.web.app/icons/logo.png";
  const NOVA_APP = "https://mkai-c042b.web.app/";
  const CHIPS = ["What can I do here?", "Help me plan my chores", "Quick cleaning tips", "Monthly home budget", "Easy dinner idea", "Fix a leaking tap"];
  const SYSTEM =
    `You are Nova AI, running the Alpaca model, made by Mohnishkumar in Tamil Nadu, India. You are the built-in helper inside ${APP_NAME}, a home app. ` +
    "Each question comes with the text of the page the user is looking at: use it to explain the app, find things on the page and guide them step by step. Never invent features that aren't on the page; if you're not sure, say so. " +
    "You also help with everything at home: cleaning, cooking and recipes, chores and routines, budgets and bills, repairs and DIY safety, organising, gardening, pets, family and moving house. " +
    "For gas leaks, electrical danger, fire or medical emergencies, tell them to get safe and call 112 first. " +
    "Keep answers short (under 130 words), friendly and practical, with numbered steps when useful. Use **bold** for key points; no tables or headings. " +
    "Reply in the user's language. If asked who you are, say you are Nova AI, built on models such as Google Gemini.";

  // ---------- styles ----------
  const css = `
  #nova-fab{position:fixed;right:18px;bottom:18px;z-index:2147483000;width:60px;height:60px;border-radius:50%;border:0;padding:0;cursor:pointer;
    background:#0b1020 url("${LOGO}") center/cover no-repeat;box-shadow:0 8px 24px rgba(0,0,0,.35),0 0 0 3px rgba(34,211,238,.55);transition:transform .15s}
  #nova-fab:hover{transform:scale(1.07)}
  #nova-fab:focus-visible{outline:3px solid #22d3ee;outline-offset:3px}
  #nova-panel{position:fixed;right:18px;bottom:90px;z-index:2147483001;width:min(380px,calc(100vw - 24px));height:min(560px,calc(100vh - 110px));
    display:none;flex-direction:column;background:#0f1422;color:#e7ebf5;border:1px solid #263049;border-radius:18px;overflow:hidden;
    box-shadow:0 18px 50px rgba(0,0,0,.45);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  #nova-panel.open{display:flex}
  #nova-panel *{box-sizing:border-box}
  .nova-head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(135deg,#111a33,#1b1240);border-bottom:1px solid #263049}
  .nova-head img{width:34px;height:34px;border-radius:10px}
  .nova-head b{display:block;font-size:16px}
  .nova-head small{color:#9aa5c0;font-size:12px}
  .nova-x{margin-left:auto;background:none;border:0;color:#9aa5c0;font-size:24px;line-height:1;cursor:pointer;padding:4px 8px;border-radius:8px}
  .nova-x:hover{background:#1d2540;color:#fff}
  .nova-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
  .nova-msg{max-width:88%;padding:9px 13px;border-radius:14px;white-space:pre-wrap;overflow-wrap:anywhere}
  .nova-msg.user{align-self:flex-end;background:#22d3ee;color:#04101f;border-bottom-right-radius:4px}
  .nova-msg.bot{align-self:flex-start;background:#18203a;border:1px solid #263049;border-bottom-left-radius:4px}
  .nova-msg.typing{color:#9aa5c0}
  .nova-msg a{color:#67e8f9}
  .nova-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 8px}
  .nova-chips button{background:#18203a;color:#cfd6e8;border:1px solid #2d3756;border-radius:999px;padding:5px 11px;font:inherit;font-size:13px;cursor:pointer}
  .nova-chips button:hover{border-color:#22d3ee;color:#fff}
  .nova-form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #263049;background:#0c111d}
  .nova-form input{flex:1;min-width:0;padding:11px 13px;border-radius:12px;border:1px solid #2d3756;background:#141b2e;color:#e7ebf5;font:inherit}
  .nova-form input:focus{outline:none;border-color:#22d3ee}
  .nova-form button{border:0;border-radius:12px;padding:0 14px;min-width:64px;background:#22d3ee;color:#04101f;font:inherit;font-weight:700;cursor:pointer}
  .nova-form button.stop{background:#f87171}
  .nova-form .nova-mic{min-width:44px;padding:0;background:#18203a;color:#cfd6e8;border:1px solid #2d3756}
  .nova-form .nova-mic.on{background:#f87171;color:#fff;border-color:#f87171}
  .nova-note{display:block;text-align:center;color:#6f7a96;font-size:11px;padding:0 10px 8px;background:#0c111d}
  @media (max-width:480px){#nova-panel{right:12px;left:12px;width:auto;bottom:84px;height:calc(100vh - 100px)}#nova-fab{right:14px;bottom:14px}}`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);

  // ---------- layout ----------
  const fab = document.createElement("button");
  fab.id = "nova-fab";
  fab.type = "button";
  fab.title = "Ask Nova AI";
  fab.setAttribute("aria-label", "Open Nova AI helper");
  const panel = document.createElement("section");
  panel.id = "nova-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Nova AI helper");
  panel.innerHTML = `
    <div class="nova-head"><img src="${LOGO}" alt=""><div><b>Nova AI</b><small>Your ${APP_NAME} helper</small></div>
      <button class="nova-x" type="button" aria-label="Close">×</button></div>
    <div class="nova-log" aria-live="polite"></div>
    <div class="nova-chips"></div>
    <form class="nova-form" autocomplete="off">
      <button class="nova-mic" type="button" aria-label="Speak" title="Speak">🎤</button>
      <input maxlength="500" placeholder="Ask Nova anything about your home…" aria-label="Message">
      <button class="nova-send" type="submit">Send</button>
    </form>
    <small class="nova-note">Nova AI can make mistakes. Check important things.</small>`;
  document.body.append(fab, panel);

  const $ = (s) => panel.querySelector(s);
  const log = $(".nova-log"), inp = $("input"), sendBtn = $(".nova-send"), chips = $(".nova-chips"), mic = $(".nova-mic");
  let busy = null, history = [];

  function setText(el, text) {
    el.replaceChildren();
    for (const part of String(text).split(/(\*\*[^*\n]+\*\*)/)) {
      if (/^\*\*[^*\n]+\*\*$/.test(part)) { const b = document.createElement("b"); b.textContent = part.slice(2, -2); el.append(b); }
      else if (part) el.append(part);
    }
  }
  function bubble(who, text) {
    const d = document.createElement("div");
    d.className = "nova-msg " + who;
    setText(d, text);
    log.append(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  bubble("bot", `Hi! I'm Nova AI 👋 Ask me about ${APP_NAME} or anything at home: chores, cleaning, recipes, budgets or repairs.`);
  for (const c of CHIPS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = c;
    b.onclick = () => ask(c);
    chips.append(b);
  }

  function open(on) {
    panel.classList.toggle("open", on);
    fab.setAttribute("aria-expanded", on);
    if (on) setTimeout(() => inp.focus(), 50);
  }
  fab.onclick = () => open(!panel.classList.contains("open"));
  $(".nova-x").onclick = () => { open(false); fab.focus(); };
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && panel.classList.contains("open")) open(false); });

  // ---------- what the user is looking at ----------
  function pageContext() {
    const root = document.querySelector("main") || document.body;
    const clone = root.cloneNode(true);
    clone.querySelectorAll("script,style,noscript,svg,#nova-panel,#nova-fab,input[type=password]").forEach((n) => n.remove());
    const text = (clone.innerText || clone.textContent || "").replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    return `Page title: ${document.title}\nPage address: ${location.pathname}\nPage text:\n${text.slice(0, 5000)}`;
  }

  // ---------- Nova AI's model ----------
  let aiReady = null;
  function backend() {
    if (window.NOVA_BACKEND) return Promise.resolve(window.NOVA_BACKEND); // for testing
    return (aiReady ??= (async () => {
      const V = "https://www.gstatic.com/firebasejs/12.19.0/";
      const [{ initializeApp }, { getAI, getGenerativeModel, GoogleAIBackend }, { initializeAppCheck, ReCaptchaEnterpriseProvider }] =
        await Promise.all(["firebase-app.js", "firebase-ai.js", "firebase-app-check.js"].map((f) => import(V + f)));
      const app = initializeApp(FIREBASE, "nova-homely");
      initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
      const ai = getAI(app, { backend: new GoogleAIBackend() });
      return {
        async generate({ system, contents, onText, signal }) {
          let lastErr;
          for (const model of MODELS) {
            if (signal.aborted) break;
            try {
              const m = getGenerativeModel(ai, { model, systemInstruction: system, generationConfig: { temperature: 0.6, maxOutputTokens: 800 } });
              const res = await m.generateContentStream({ contents }, { timeout: 30000 });
              res.response.catch(() => {});
              let text = "";
              for await (const chunk of res.stream) {
                if (signal.aborted) return text;
                try { text += chunk.text() || ""; } catch (e) {}
                if (text) onText(text);
              }
              if (text.trim()) return text;
            } catch (e) { lastErr = e; }
          }
          if (signal.aborted) return "";
          throw lastErr || new Error("No answer");
        },
      };
    })().catch((e) => { aiReady = null; throw e; }));
  }

  // ---------- chat ----------
  function setBusy(on) {
    sendBtn.textContent = on ? "Stop" : "Send";
    sendBtn.classList.toggle("stop", on);
    inp.disabled = on;
  }
  async function ask(raw) {
    const q = String(raw).trim().slice(0, 500);
    if (!q || busy) return;
    open(true);
    chips.style.display = "none";
    bubble("user", q);
    inp.value = "";
    const ctrl = new AbortController();
    busy = { stop: () => ctrl.abort() };
    setBusy(true);
    const out = bubble("bot typing", "…");
    try {
      const ai = await backend();
      const contents = [];
      for (const t of history.slice(-5)) contents.push({ role: "user", parts: [{ text: t.q }] }, { role: "model", parts: [{ text: t.a }] });
      contents.push({ role: "user", parts: [{ text: `${pageContext()}\n\nQuestion: ${q}` }] });
      const text = await ai.generate({ system: SYSTEM, contents, signal: ctrl.signal, onText: (t) => { setText(out, t); log.scrollTop = log.scrollHeight; } });
      if (ctrl.signal.aborted) { setText(out, (text || "").trim() ? text + "\n\n(Stopped)" : "Stopped."); return; }
      setText(out, text.trim());
      history.push({ q, a: text.trim() });
    } catch (e) {
      out.replaceChildren("Nova AI can't connect right now. Try again in a minute, or ");
      const a = document.createElement("a");
      a.href = NOVA_APP; a.target = "_blank"; a.rel = "noopener"; a.textContent = "open Nova AI";
      out.append(a, ".");
    } finally {
      out.classList.remove("typing");
      busy = null;
      setBusy(false);
      inp.focus();
    }
  }
  $(".nova-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy) busy.stop(); else ask(inp.value);
  });

  // ---------- voice: speak your question ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) mic.style.display = "none";
  else {
    let rec = null;
    mic.onclick = () => {
      if (rec) { rec.stop(); return; }
      rec = new SR();
      rec.lang = navigator.language || "en-IN";
      rec.interimResults = true;
      mic.classList.add("on");
      rec.onresult = (e) => {
        const r = e.results[e.results.length - 1];
        inp.value = r[0].transcript;
        if (r.isFinal) ask(inp.value);
      };
      rec.onend = rec.onerror = () => { mic.classList.remove("on"); rec = null; };
      rec.start();
    };
  }

  // Other code on the page can open Nova:  NovaAI.ask("How do I add a room?")
  window.NovaAI = { open: () => open(true), close: () => open(false), ask };
})();
