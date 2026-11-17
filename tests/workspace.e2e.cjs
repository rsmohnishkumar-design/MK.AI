// End-to-end test of the Nova Workspace in a real browser, against the Firebase emulators.
//   1) firebase emulators:start --project demo-mkai   (auth 9099, firestore 8080; rules with test codes)
//   2) serve the folder that CONTAINS MK.AI on http://localhost:8000
//   3) node tests/workspace.e2e.cjs <folder with node_modules/firebase> [chromium path]
// All AI services are blocked here on purpose: this checks the engine's real behaviour
// when models are unavailable (built-in planner + exact tools), and that failures are
// reported honestly. Pollinations is answered with a local PNG to test the image UI wiring only.
const { chromium } = require("playwright");
const path = require("path");
const nm = process.argv[2];
const exe = process.argv[3];
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGNgGAWjYBSMAggAAAQQAAFVN1rQAAAAAElFTkSuQmCC", "base64");

(async () => {
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  let fails = 0;
  const check = (name, ok, info = "") => { if (!ok) fails++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : info); };
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pg = await ctx.newPage();
  pg.on("pageerror", (e) => errors.push(e.message));
  await pg.route(/gstatic\.com\/firebasejs\/[\d.]+\/([\w-]+\.js)/, (r) => r.fulfill({ path: path.join(nm, "node_modules/firebase", r.request().url().split("/").pop()), contentType: "text/javascript" }));
  const imageRequests = [];
  await pg.route(/^https:\/\/image\.pollinations\.ai\//, (r) => { imageRequests.push(r.request().url()); return r.fulfill({ body: PNG, contentType: "image/png" }); });
  await pg.route(/^https:\/\/[^/]*(google\.com|googleapis\.com|groq\.com|cerebras\.ai|openrouter\.ai|github\.ai|wikipedia\.org|jsdelivr\.net)\//, (r) => r.abort());
  await pg.addInitScript(() => { window.MKAI_EMULATORS = { auth: "127.0.0.1:9099", firestore: "127.0.0.1:8080" }; });
  await pg.goto("http://localhost:8000/MK.AI/index.html");
  await pg.click("#tabSignup");
  await pg.fill("#authEmail", `agent${Date.now()}@test.com`);
  await pg.fill("#authPassword", "secret123");
  await pg.click("#authSubmit");
  await pg.waitForSelector("#composer textarea:not([disabled])", { timeout: 20000 });

  // Open through the slash command
  await pg.fill("#composer textarea", "/agent");
  await pg.waitForTimeout(300);
  await pg.keyboard.press("Enter");
  await pg.waitForSelector(".nw-overlay", { timeout: 10000 });
  check("workspace opens from /agent", await pg.isVisible(".nw-overlay"));
  check("six tabs present", (await pg.locator(".nw-tab").count()) === 6);

  // Agent task with no AI available: built-in planner + exact forecast tool
  await pg.fill(".nw-input", "Forecast my monthly savings for the next 3 months: 2000, 2500, 2300, 2800, 3000, 3300");
  await pg.click(".nw-form .nw-btn[type=submit]");
  await pg.waitForSelector(".nw-state.s-completed, .nw-state.s-failed", { timeout: 60000 });
  const state = await pg.textContent(".nw-task .nw-state");
  const steps = await pg.textContent(".nw-steps");
  const result = await pg.textContent(".nw-result").catch(() => "");
  check("forecast task completes without any AI model", state === "Completed", state);
  check("Forecast Agent used the forecast tool", /Forecast Agent/.test(steps) && /forecast/.test(steps), steps);
  check("result contains real forecast numbers and assumptions", /Holt/.test(result) && /assumptions/i.test(result), result.slice(0, 200));
  await pg.click(".nw-log summary");
  const log = await pg.textContent(".nw-log");
  check("execution log shows real state changes", /CREATED → PLANNING/.test(log) && /RUNNING → VERIFYING/.test(log), log.slice(0, 300));
  check("verification panel is shown", await pg.isVisible(".nw-verify"));

  // Research with every AI service blocked: must fail honestly, not invent an answer
  await pg.click('.nw-tab[data-tab="research"]');
  await pg.fill(".nw-input", "Research the latest ISRO launch with sources");
  await pg.click(".nw-form .nw-btn[type=submit]");
  await pg.waitForSelector(".nw-state.s-completed, .nw-state.s-failed", { timeout: 90000 });
  const rstate = await pg.textContent(".nw-task .nw-state");
  check("research without internet AI fails honestly (no fake answer)", rstate === "Failed" && !(await pg.isVisible(".nw-sources")), rstate);
  check("the failure is explained", (await pg.textContent(".nw-task")).length > 40);

  // Images: real-model wiring (Pollinations answered locally here)
  await pg.click('.nw-tab[data-tab="images"]');
  await pg.fill(".nw-input", "a Chennai street at sunset in the rain");
  await pg.selectOption(".nw-select >> nth=1", "2");
  await pg.click(".nw-form .nw-btn[type=submit]");
  await pg.waitForSelector(".nw-img", { timeout: 30000 });
  await pg.waitForTimeout(500);
  check("two variations shown with model name and download", (await pg.locator(".nw-grid >> nth=0 >> .nw-img").count()) === 2 && /FLUX/.test(await pg.textContent(".nw-img figcaption")) && (await pg.locator(".nw-img a[download]").count()) >= 2);
  const seeds = new Set(imageRequests.map((u) => new URL(u).searchParams.get("seed")));
  check("image requests carry the chosen size, a model and different seeds", imageRequests.length >= 2 && imageRequests.every((u) => /width=1024&height=1024/.test(u) && /model=flux/.test(u)) && seeds.size >= 2, imageRequests.join(" ").slice(0, 300));
  await pg.fill(".nw-input", "a gun pointed at someone");
  await pg.click(".nw-form .nw-btn[type=submit]");
  await pg.waitForTimeout(1500);
  check("unsafe picture request is refused", /No picture was made/.test(await pg.textContent(".nw-body p.nw-meta")));

  // Memory controls
  await pg.click('.nw-tab[data-tab="memory"]');
  await pg.fill(".nw-input.one", "I am in class 11 and study computer science");
  await pg.click(".nw-row .nw-btn[type=submit]");
  check("memory note saved and listed", /class 11/.test(await pg.textContent(".nw-list")));
  await pg.click(".nw-check.big input");
  check("memory can be switched off", /off/.test(await pg.textContent(".nw-check.big")));
  await pg.click(".nw-list li .nw-btn");
  check("memory note can be deleted", /Nothing saved yet/.test(await pg.textContent(".nw-list")));

  // Status is honest
  await pg.click('.nw-tab[data-tab="status"]');
  const status = await pg.textContent(".nw-table");
  check("status says video is not available", /Video generation\s*Not available/.test(status));
  check("status says the gateway is not set up", /Not set up/.test(status));

  // Task history survives a reload
  await pg.keyboard.press("Escape");
  await pg.reload();
  await pg.waitForSelector("#composer textarea:not([disabled])", { timeout: 20000 });
  await pg.waitForTimeout(4000);
  // (Clicks right after a reload are unreliable in this emulator setup, also on the
  // previous version, so the workspace is opened directly here.)
  const saved = await pg.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("mkai-tasks-")).map((k) => [k, JSON.parse(localStorage.getItem(k)).length]));
  check("tasks are saved per account in this browser", saved.length === 1 && saved[0][1] >= 2, JSON.stringify(saved));
  await pg.evaluate((key) => import("./js/agent/ui.js").then((m) => m.openWorkspace({ uid: key.replace("mkai-tasks-", ""), tab: "tasks" })), saved[0][0]);
  await pg.waitForSelector(".nw-list", { timeout: 10000 });
  const tasks = await pg.textContent(".nw-list");
  check("task history kept after reload", /Forecast my monthly savings/.test(tasks) && /Completed/.test(tasks) && /Failed/.test(tasks), tasks.slice(0, 200));

  // Phone size: no sideways scrolling
  await pg.setViewportSize({ width: 390, height: 800 });
  await pg.click('.nw-tab[data-tab="agent"]');
  const overflow = await pg.evaluate(() => document.querySelector(".nw-overlay").scrollWidth - window.innerWidth);
  check("fits a phone screen", overflow <= 1, `overflow ${overflow}px`);
  await pg.screenshot({ path: path.join(nm, "workspace-phone.png") });
  await pg.setViewportSize({ width: 1280, height: 900 });
  await pg.click('.nw-tab[data-tab="tasks"]');
  await pg.click(".nw-list li .nw-btn >> nth=0");
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: path.join(nm, "workspace-desktop.png") });

  check("no page errors", !errors.length, errors.join(" | ").slice(0, 400));
  console.log(`\n${fails} failure(s)`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
