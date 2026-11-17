// Independent mode in a real browser: Nova must answer with its own engines and
// NOVA Mini, and must not contact ANY outside AI service (any such request fails the test).
//   node tests/independent.e2e.cjs <folder with node_modules/firebase> [chromium path]
// Needs the Firebase emulators and http://localhost:8000/MK.AI (see workspace.e2e.cjs).
const { chromium } = require("playwright");
const path = require("path");
const nm = process.argv[2];
const exe = process.argv[3];
const AI_HOSTS = /(generativelanguage\.googleapis\.com|firebasevertexai\.googleapis\.com|firebaseappcheck|recaptcha|groq\.com|cerebras\.ai|openrouter\.ai|models\.github\.ai|pollinations\.ai|aihorde\.net)/;

(async () => {
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  let fails = 0;
  const check = (name, ok, info = "") => { if (!ok) fails++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : info); };
  const pg = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [], aiCalls = [];
  pg.on("pageerror", (e) => errors.push(e.message));
  pg.on("request", (r) => { if (AI_HOSTS.test(r.url())) aiCalls.push(r.url()); });
  await pg.route(/gstatic\.com\/firebasejs\/[\d.]+\/([\w-]+\.js)/, (r) => r.fulfill({ path: path.join(nm, "node_modules/firebase", r.request().url().split("/").pop()), contentType: "text/javascript" }));
  await pg.route(/^https:\/\/[^/]*(google\.com|googleapis\.com|groq\.com|cerebras\.ai|openrouter\.ai|github\.ai|pollinations\.ai|aihorde\.net|wikipedia\.org|jsdelivr\.net)\//, (r) => r.abort());
  await pg.addInitScript(() => {
    window.MKAI_EMULATORS = { auth: "127.0.0.1:9099", firestore: "127.0.0.1:8080" };
    localStorage.setItem("mkai-independent", "1");
  });
  await pg.goto("http://localhost:8000/MK.AI/index.html");
  await pg.click("#tabSignup");
  await pg.fill("#authEmail", `ind${Date.now()}@test.com`);
  await pg.fill("#authPassword", "secret123");
  await pg.click("#authSubmit");
  await pg.waitForSelector("#composer textarea:not([disabled])", { timeout: 20000 });

  // Nova's own solver still answers exactly
  await pg.fill("#composer textarea", "what is 12 * 7");
  await pg.keyboard.press("Enter");
  await pg.waitForTimeout(4000);
  check("own maths engine answers (84)", /84/.test(await pg.innerText("#thread")));

  // An open question goes to NOVA Mini, with its honest label
  await pg.fill("#composer textarea", "Explain why the sky looks blue to people on a sunny afternoon");
  await pg.keyboard.press("Enter");
  await pg.waitForFunction(() => /NOVA Mini \(experimental\)/.test(document.querySelector("#thread").innerText), null, { timeout: 120000 }).catch(() => {});
  const thread = await pg.innerText("#thread");
  check("open question answered by NOVA Mini, clearly labelled", /NOVA Mini \(experimental\)/.test(thread), thread.slice(-300));

  // Workspace: status shows it, outside image AI is refused, agents still work
  await pg.fill("#composer textarea", "/images");
  await pg.waitForTimeout(300);
  await pg.keyboard.press("Enter");
  await pg.waitForSelector(".nw-overlay");
  await pg.fill(".nw-input", "a red bicycle");
  await pg.click(".nw-form .nw-btn[type=submit]");
  await pg.waitForTimeout(1500);
  check("image studio says no NOVA image model yet (no outside AI)", /no trained image model/i.test(await pg.textContent(".nw-body")));
  await pg.click('.nw-tab[data-tab="agent"]');
  await pg.fill(".nw-input", "Forecast these monthly sales: 100, 110, 125, 130, 145, 160");
  await pg.click(".nw-form .nw-btn[type=submit]");
  await pg.waitForSelector(".nw-state.s-completed, .nw-state.s-failed", { timeout: 60000 });
  check("agents complete with built-in planner and exact tools", (await pg.textContent(".nw-task .nw-state")) === "Completed");
  await pg.click('.nw-tab[data-tab="status"]');
  check("status shows Independent mode ON", /Independent mode: ON/.test(await pg.textContent(".nw-body")));

  check("no request reached any outside AI service", aiCalls.length === 0, aiCalls.slice(0, 3).join(" "));
  check("no page errors", !errors.length, errors.join(" | ").slice(0, 300));
  console.log(`\n${fails} failure(s)`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
