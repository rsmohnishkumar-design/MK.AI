// Team Training Room in a real browser, against the Firebase emulators.
// The emulator rules use the test team code "TRAINER-TEST" and admin "admin@test.com".
//   node tests/training.e2e.cjs <folder with node_modules/firebase> [chromium path]
const { chromium } = require("playwright");
const path = require("path");
const nm = process.argv[2];
const exe = process.argv[3];

async function page(browser, errors) {
  // Service workers fetch the Firebase library themselves (not through page.route), so block them in tests
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, acceptDownloads: true, serviceWorkers: "block" });
  const pg = await ctx.newPage();
  pg.on("pageerror", (e) => errors.push(e.message));
  await pg.route(/gstatic\.com\/firebasejs\/[\d.]+\/([\w-]+\.js)/, (r) => r.fulfill({ path: path.join(nm, "node_modules/firebase", r.request().url().split("/").pop()), contentType: "text/javascript" }));
  await pg.route(/^https:\/\/[^/]*(google\.com|googleapis\.com)\//, (r) => r.abort());
  await pg.addInitScript(() => { window.MKAI_EMULATORS = { auth: "127.0.0.1:9099", firestore: "127.0.0.1:8080" }; });
  return pg;
}
async function signUp(pg, email) {
  await pg.goto("http://localhost:8000/MK.AI/index.html");
  await pg.click("#tabSignup");
  await pg.fill("#authEmail", email);
  await pg.fill("#authPassword", "secret123");
  await pg.click("#authSubmit");
  await pg.waitForSelector("#composer textarea:not([disabled])", { timeout: 20000 });
  await pg.waitForTimeout(1500);
}

(async () => {
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  let fails = 0;
  const check = (name, ok, info = "") => { if (!ok) fails++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : info); };
  const errors = [];
  const pg = await page(browser, errors);
  await signUp(pg, `team${Date.now()}@test.com`);

  await pg.keyboard.press("Alt+n");
  await pg.waitForURL(/training\.html/, { timeout: 10000 }).catch(() => {});
  check("Alt+N opens the Team Training Room", /training\.html/.test(pg.url()), pg.url());
  await pg.waitForSelector("#trJoin:not([hidden])", { timeout: 15000 });
  check("a new user must enter the team code", await pg.isVisible("#trJoin"));

  await pg.fill("#trCode", "6655");
  await pg.click("#trJoinForm button");
  await pg.waitForTimeout(1500);
  check("wrong code is refused", /isn't right/.test(await pg.textContent("#trJoinMsg")) && !(await pg.isVisible("#trRoom")));

  await pg.fill("#trCode", "TRAINER-TEST");
  await pg.click("#trJoinForm button");
  await pg.waitForSelector("#trRoom:not([hidden])", { timeout: 15000 });
  check("right code opens the room", await pg.isVisible("#trRoom"));

  await pg.fill("#fQ", "What is the capital of Kerala?");
  await pg.fill("#fA", "Thiruvananthapuram is the capital of Kerala.");
  await pg.fill("#fT", "geography");
  await pg.click("#fSave");
  await pg.waitForTimeout(1500);
  check("example added and listed as pending", /capital of Kerala/.test(await pg.textContent("#trList")) && /pending/.test(await pg.textContent("#trList")));

  await pg.fill("#fQ", "Who are you?");
  await pg.fill("#fA", "As an AI language model, I am here to help.");
  await pg.click("#fSave");
  await pg.waitForTimeout(800);
  check("AI-copied text is blocked", /copied from an AI/.test(await pg.textContent("#trFormMsg")));

  await pg.fill("#trBulk", '{"question":"Largest planet?","answer":"Jupiter is the largest planet in the Solar System.","topic":"science","source":"written for Nova","licence":"own"}\n{"question":"bad"}');
  await pg.click("#trBulkBtn");
  await pg.waitForTimeout(2000);
  const bulk = await pg.textContent("#trBulkMsg");
  check("bulk add adds good lines and reports bad ones", /Added 1/.test(bulk) && /line 2/.test(bulk), bulk);

  const [dl] = await Promise.all([pg.waitForEvent("download", { timeout: 5000 }).catch(() => null), pg.click("#trExport")]);
  check("trainer can export their examples (.jsonl)", !!dl && /\.jsonl$/.test(dl.suggestedFilename()));

  // The team code must not open the vault
  await pg.goto("http://localhost:8000/MK.AI/vault.html");
  await pg.waitForTimeout(4000);
  check("trainer cannot see the vault contents", !(await pg.isVisible("#vaultScreen")));

  // Admin: sees everything, approves
  const pa = await page(browser, errors);
  await signUp(pa, "admin@test.com").catch(async () => {
    await pa.click("#tabSignin").catch(() => {});
  });
  await pa.goto("http://localhost:8000/MK.AI/training.html");
  await pa.waitForSelector("#trRoom:not([hidden])", { timeout: 15000 }).catch(() => {});
  check("admin enters the room without the team code", await pa.isVisible("#trRoom"));
  await pa.selectOption("#trFilter", "pending");
  await pa.waitForTimeout(500);
  const approve = pa.locator("#trList button", { hasText: "Approve" }).first();
  check("admin sees an Approve button", (await approve.count()) > 0);
  if (await approve.count()) {
    await approve.click();
    await pa.waitForTimeout(1500);
    await pa.selectOption("#trFilter", "approved");
    check("admin approved an example", /approved/.test(await pa.textContent("#trList")));
  }
  check("no page errors", !errors.length, errors.join(" | ").slice(0, 300));
  console.log(`\n${fails} failure(s)`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
