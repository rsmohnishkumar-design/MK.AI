// Nova AI app builder: understands requests like "make a library management
// system with book name, author and year" and writes a complete, working
// app for them: a form for the fields, a searchable and sortable table,
// edit and delete, totals for number fields, CSV export, and saving in the
// browser. The fields come from the request, or sensible ones for the
// subject (library, hospital, hotel, school…). No outside AI.

const BUILD = /\b(make|create|build|write|code|develop|design|generate|program|give me|i need|need|want)\b/;
const SYSTEM = /\b(management system|management app|management software|management|manager|managing system|record system|records? app|records|register|registry|database|crud|tracker|tracking system|crm|erp|booking system|reservation system|billing system|admin panel|information system|portal|system)\b/;

// Ready fields for common subjects. type: text, number, date, email, tel, select
const f = (label, type = "text", options) => ({ label, type, ...(options ? { options } : {}) });
const SUBJECTS = [
  [/librar|\bbooks?\b/, "Library", "Book", [f("Book title"), f("Author"), f("Year", "number"), f("ISBN"), f("Copies", "number"), f("Status", "select", ["Available", "Issued", "Lost"])]],
  [/hospital|patient|clinic|medical/, "Hospital", "Patient", [f("Patient name"), f("Age", "number"), f("Gender", "select", ["Male", "Female", "Other"]), f("Disease"), f("Doctor"), f("Admission date", "date"), f("Bill", "number")]],
  [/doctor/, "Doctor", "Doctor", [f("Doctor name"), f("Specialisation"), f("Phone", "tel"), f("Available days"), f("Fee", "number")]],
  [/hotel|room|lodge|resort/, "Hotel", "Booking", [f("Guest name"), f("Phone", "tel"), f("Room number"), f("Room type", "select", ["Single", "Double", "Suite"]), f("Check-in", "date"), f("Check-out", "date"), f("Amount", "number")]],
  [/student|school|college|class/, "Student", "Student", [f("Name"), f("Roll number"), f("Class"), f("Marks", "number"), f("Phone", "tel"), f("Email", "email")]],
  [/employee|staff|hr\b|payroll|worker/, "Employee", "Employee", [f("Name"), f("Employee ID"), f("Department", "select", ["Sales", "Accounts", "HR", "IT", "Operations"]), f("Salary", "number"), f("Joining date", "date"), f("Phone", "tel")]],
  [/inventory|stock|warehouse|shop|store|grocery|product/, "Inventory", "Product", [f("Product"), f("Category"), f("Quantity", "number"), f("Price", "number"), f("Supplier")]],
  [/bank|account/, "Bank", "Account", [f("Account holder"), f("Account number"), f("Type", "select", ["Savings", "Current"]), f("Balance", "number"), f("Opened on", "date")]],
  [/attendance/, "Attendance", "Entry", [f("Name"), f("Date", "date"), f("Status", "select", ["Present", "Absent", "Leave"])]],
  [/gym|fitness|member/, "Gym", "Member", [f("Member name"), f("Phone", "tel"), f("Plan", "select", ["Monthly", "Quarterly", "Yearly"]), f("Start date", "date"), f("Fee", "number")]],
  [/restaurant|food|canteen|cafe|order/, "Restaurant", "Order", [f("Customer"), f("Item"), f("Table number"), f("Quantity", "number"), f("Price", "number"), f("Status", "select", ["Ordered", "Served", "Paid"])]],
  [/movie|cinema|ticket|theatre|theater/, "Ticket Booking", "Booking", [f("Customer"), f("Movie"), f("Show date", "date"), f("Show time"), f("Seats", "number"), f("Amount", "number")]],
  [/bus|train|flight|travel|airline/, "Travel Booking", "Booking", [f("Passenger"), f("From"), f("To"), f("Travel date", "date"), f("Seat number"), f("Fare", "number")]],
  [/parking|vehicle|car\b/, "Parking", "Vehicle", [f("Vehicle number"), f("Owner"), f("Type", "select", ["Car", "Bike", "Truck"]), f("Entry date", "date"), f("Fee", "number")]],
  [/blood/, "Blood Bank", "Donor", [f("Donor name"), f("Blood group", "select", ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]), f("Phone", "tel"), f("City"), f("Last donation", "date")]],
  [/contact|phone ?book|address book/, "Contacts", "Contact", [f("Name"), f("Phone", "tel"), f("Email", "email"), f("City")]],
  [/event|wedding|function/, "Event", "Event", [f("Event name"), f("Date", "date"), f("Venue"), f("Guests", "number"), f("Budget", "number")]],
  [/customer|client|crm|sales|lead/, "Customer", "Customer", [f("Name"), f("Company"), f("Phone", "tel"), f("Email", "email"), f("Status", "select", ["New", "Contacted", "Won", "Lost"]), f("Deal value", "number")]],
  [/course|training|exam/, "Course", "Course", [f("Course name"), f("Teacher"), f("Duration"), f("Fee", "number"), f("Start date", "date")]],
  [/farm|crop|agri/, "Farm", "Crop", [f("Crop"), f("Field"), f("Sowing date", "date"), f("Area (acres)", "number"), f("Expected yield (kg)", "number")]],
  [/complaint|ticket|issue|support|helpdesk/, "Complaint", "Complaint", [f("Name"), f("Issue"), f("Date", "date"), f("Priority", "select", ["Low", "Medium", "High"]), f("Status", "select", ["Open", "In progress", "Closed"])]],
  [/rent|tenant|property|house/, "Rental", "Tenant", [f("Tenant name"), f("House"), f("Phone", "tel"), f("Rent", "number"), f("Due date", "date"), f("Paid", "select", ["Yes", "No"])]],
];

// Guess a field's input type from its name
function fieldFrom(raw) {
  const label = raw.replace(/\s+/g, " ").trim().replace(/^\w/, (c) => c.toUpperCase());
  const l = label.toLowerCase();
  if (/\b(email|e-mail|mail id)\b/.test(l)) return f(label, "email");
  if (/\b(phone|mobile|contact number|whatsapp)\b/.test(l)) return f(label, "tel");
  if (/\b(date|dob|birthday|check.?in|check.?out|joining|admission|due|deadline|issued on|return(ed)? on)\b/.test(l)) return f(label, "date");
  if (/\b(no|number|id|code)\b/.test(l) && !/\b(of|count)\b/.test(l)) return f(label);
  if (/\b(age|year|qty|quantity|price|amount|salary|marks?|score|fee|fees|cost|copies|stock|seats|balance|total|count|rent|budget|bill|weight|height|rate|discount|units|days|hours|nights|months|pages|rooms)\b/.test(l)) return f(label, "number");
  if (/\bgender\b/.test(l)) return f(label, "select", ["Male", "Female", "Other"]);
  if (/\bstatus\b/.test(l)) return f(label, "select", ["Active", "Pending", "Done"]);
  return f(label);
}

// "with book name, author and year" → ["book name", "author", "year"]
export function fieldsIn(q) {
  const m = q.match(/\b(?:with|having|fields?|columns?|details?|containing|include|including|that (?:has|stores|keeps))\s*(?:fields?|columns?|details?)?\s*(?:like|such as|of|:|-)?\s*(.+)$/i);
  if (!m) return [];
  return m[1]
    .replace(/[.?!]+$/, "")
    .replace(/\b(in (html|python|javascript|js)|please|pls|etc)\b.*$/i, "")
    .split(/\s*(?:,|;|\/|\band\b|&|\+)\s*/)
    .map((s) => s.replace(/^(the|a|an|its|their|his|her)\s+/i, "").trim())
    .filter((s) => s && s.length <= 30 && s.split(" ").length <= 4)
    .slice(0, 12);
}

// The subject: "library management system with…" → "library"
export function subjectIn(q) {
  const s = q
    .toLowerCase()
    .replace(/\b(?:with|having|fields?|columns?|containing|including|that (?:has|stores|keeps))\b.*$/, "")
    .replace(BUILD, " ")
    .replace(SYSTEM, " ")
    .replace(/\b(a|an|the|me|my|our|own|for|please|pls|simple|small|basic|new|full|complete|working|proper|online|web|html|javascript|js|python|app|application|software|website|project|program|mini|to|of|in|using|system)\b/g, " ")
    .replace(/[^a-z0-9 &-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

export function isManagementRequest(q) {
  const t = q.toLowerCase();
  if (!BUILD.test(t) || !SYSTEM.test(t)) return false;
  if (/^(what|who|why|when|where|which|is|are|does|explain|define|tell me about)\b/.test(t)) return false;
  // Office files, operating systems and solar systems aren't record-keeping apps
  if (/\b(ppt|powerpoint|presentation|slides?|excel|spreadsheet|word document|docx|essay|report on)\b/.test(t)) return false;
  if (/\b(solar system|operating system|nervous system|digestive system|number system|immune system|ecosystem|respiratory system|circulatory system|traffic|elevator|lift|atm|vending)\b/.test(t)) return false;
  return subjectIn(t).length > 0 || fieldsIn(t).length > 0;
}

const titleCase = (t) => t.replace(/\b[a-z]/g, (c) => c.toUpperCase());

export function planApp(question) {
  const q = question.toLowerCase();
  const subject = subjectIn(q);
  const known = SUBJECTS.find(([re]) => re.test(subject || q));
  const asked = fieldsIn(question);
  let fields = asked.length ? asked.map(fieldFrom) : known ? known[3] : [f("Name"), f("Details"), f("Date", "date"), f("Amount", "number"), f("Status", "select", ["Active", "Pending", "Done"])];
  // Make labels unique and give each a key
  const seen = new Set();
  fields = fields
    .filter((x) => !seen.has(x.label.toLowerCase()) && seen.add(x.label.toLowerCase()))
    .map((x, i) => ({ ...x, key: "f" + i }));
  const name = subject ? titleCase(subject) : known ? known[1] : "Records";
  const kind = /\b(tracker|tracking)\b/.test(q) ? "Tracker" : /\bbooking|reservation\b/.test(q) ? "Booking System" : /\bbilling\b/.test(q) ? "Billing System" : "Management System";
  return {
    title: `${name} ${kind}`.replace(/\s+/g, " ").slice(0, 60),
    item: known ? known[2] : "Record",
    fields,
    fromRequest: asked.length > 0,
  };
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function buildManagementApp(plan) {
  const config = JSON.stringify({ title: plan.title, item: plan.item, fields: plan.fields }).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(plan.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, sans-serif; background: #f1f5f9; color: #0f172a; }
  header { background: #0f172a; color: #fff; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
  header h1 { margin: 0; font-size: 20px; }
  header span { color: #fbbf24; font-size: 13px; }
  main { max-width: 1100px; margin: 0 auto; padding: 16px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 14px; }
  .stat { background: #fff; border-radius: 12px; padding: 12px 14px; box-shadow: 0 1px 3px #0001; }
  .stat small { color: #64748b; }
  .stat b { display: block; font-size: 22px; margin-top: 2px; }
  .card { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px #0001; margin-bottom: 14px; }
  .card h2 { margin: 0 0 12px; font-size: 16px; }
  form { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
  label { font-size: 13px; color: #475569; display: grid; gap: 4px; }
  input, select { padding: 9px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; width: 100%; background: #fff; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: end; }
  button { padding: 9px 14px; border: 0; border-radius: 8px; font-weight: 600; cursor: pointer; background: #0f172a; color: #fff; }
  button.light { background: #e2e8f0; color: #0f172a; }
  button.danger { background: #fee2e2; color: #b91c1c; }
  .toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
  .toolbar input { flex: 1; min-width: 180px; }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { padding: 9px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; white-space: nowrap; }
  th { background: #f8fafc; cursor: pointer; user-select: none; }
  th:hover { background: #eef2f7; }
  td.num { text-align: right; }
  .empty { text-align: center; color: #64748b; padding: 24px; }
  .row-actions button { padding: 5px 9px; font-size: 12px; margin-right: 4px; }
  .msg { font-size: 13px; color: #15803d; min-height: 18px; margin-top: 8px; }
</style>
</head>
<body>
<header><h1 id="title"></h1><span>Saved in this browser · made with Nova AI</span></header>
<main>
  <div class="stats" id="stats"></div>
  <div class="card">
    <h2 id="formTitle"></h2>
    <form id="form"></form>
    <div class="msg" id="msg"></div>
  </div>
  <div class="card">
    <div class="toolbar">
      <input id="search" placeholder="Search…">
      <button class="light" id="export">⬇ Export CSV</button>
      <button class="light" id="sample">Add sample data</button>
      <button class="danger" id="clear">Delete all</button>
    </div>
    <div class="table-wrap"><table><thead id="head"></thead><tbody id="body"></tbody></table></div>
  </div>
</main>
<script>
  // Change the fields here to change the whole app.
  const CONFIG = ${config};
  const KEY = "app-" + CONFIG.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let rows = [];
  try { rows = JSON.parse(localStorage.getItem(KEY)) || []; } catch { rows = []; }
  let editing = null, sortKey = null, sortDir = 1;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch {} };
  const say = (t) => { $("msg").textContent = t; setTimeout(() => { if ($("msg").textContent === t) $("msg").textContent = ""; }, 2500); };

  $("title").textContent = CONFIG.title;
  document.title = CONFIG.title;

  function buildForm() {
    const form = $("form");
    form.innerHTML = "";
    for (const fl of CONFIG.fields) {
      const l = document.createElement("label");
      l.textContent = fl.label;
      let input;
      if (fl.type === "select") {
        input = document.createElement("select");
        for (const o of fl.options) input.add(new Option(o, o));
      } else {
        input = document.createElement("input");
        input.type = fl.type;
        if (fl.type === "number") input.step = "any";
      }
      input.id = "in-" + fl.key;
      if (fl === CONFIG.fields[0]) input.required = true;
      l.append(input);
      form.append(l);
    }
    const a = document.createElement("div");
    a.className = "actions";
    a.innerHTML = '<button type="submit" id="saveBtn"></button><button type="button" class="light" id="cancel">Cancel</button>';
    form.append(a);
    $("cancel").onclick = resetForm;
    resetForm();
  }
  function resetForm() {
    editing = null;
    $("form").reset();
    $("formTitle").textContent = "Add " + CONFIG.item.toLowerCase();
    $("saveBtn").textContent = "+ Add " + CONFIG.item.toLowerCase();
    $("cancel").style.display = "none";
  }
  $("form").addEventListener("submit", (e) => {
    e.preventDefault();
    const rec = { id: editing || Date.now().toString(36) + Math.random().toString(36).slice(2, 6) };
    for (const fl of CONFIG.fields) {
      const v = $("in-" + fl.key).value.trim();
      rec[fl.key] = fl.type === "number" && v !== "" ? Number(v) : v;
    }
    if (editing) { rows = rows.map((r) => (r.id === editing ? rec : r)); say(CONFIG.item + " updated."); }
    else { rows.push(rec); say(CONFIG.item + " added."); }
    save(); resetForm(); render();
  });

  function edit(id) {
    const r = rows.find((x) => x.id === id);
    if (!r) return;
    editing = id;
    for (const fl of CONFIG.fields) $("in-" + fl.key).value = r[fl.key] ?? "";
    $("formTitle").textContent = "Edit " + CONFIG.item.toLowerCase();
    $("saveBtn").textContent = "Save changes";
    $("cancel").style.display = "";
    $("form").scrollIntoView({ behavior: "smooth" });
  }
  function remove(id) {
    if (!confirm("Delete this " + CONFIG.item.toLowerCase() + "?")) return;
    rows = rows.filter((x) => x.id !== id);
    save(); render(); say(CONFIG.item + " deleted.");
  }

  const plain = (fl) => /year|pin|code|\\bid\\b|\\bno\\b/i.test(fl.label);
  const fmt = (fl, v) => (fl.type === "number" && !plain(fl) && v !== "" && v != null ? Number(v).toLocaleString("en-IN") : v ?? "");
  function render() {
    const q = $("search").value.toLowerCase();
    let list = rows.filter((r) => !q || CONFIG.fields.some((fl) => String(r[fl.key] ?? "").toLowerCase().includes(q)));
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const x = a[sortKey], y = b[sortKey];
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true })) * sortDir;
      });
    }
    $("head").innerHTML = "<tr><th>#</th>" + CONFIG.fields.map((fl) => '<th data-k="' + fl.key + '">' + esc(fl.label) + (sortKey === fl.key ? (sortDir > 0 ? " ▲" : " ▼") : "") + "</th>").join("") + "<th>Actions</th></tr>";
    $("head").querySelectorAll("th[data-k]").forEach((th) => (th.onclick = () => { sortDir = sortKey === th.dataset.k ? -sortDir : 1; sortKey = th.dataset.k; render(); }));
    $("body").innerHTML = list.length
      ? list.map((r, i) => "<tr><td>" + (i + 1) + "</td>" + CONFIG.fields.map((fl) => '<td class="' + (fl.type === "number" ? "num" : "") + '">' + esc(fmt(fl, r[fl.key])) + "</td>").join("") + '<td class="row-actions"><button class="light" data-e="' + r.id + '">Edit</button><button class="danger" data-d="' + r.id + '">Delete</button></td></tr>').join("")
      : '<tr><td class="empty" colspan="' + (CONFIG.fields.length + 2) + '">' + (rows.length ? "Nothing matches your search." : "No " + CONFIG.item.toLowerCase() + "s yet. Add one above.") + "</td></tr>";
    $("body").querySelectorAll("[data-e]").forEach((b) => (b.onclick = () => edit(b.dataset.e)));
    $("body").querySelectorAll("[data-d]").forEach((b) => (b.onclick = () => remove(b.dataset.d)));
    // Totals
    const stats = ['<div class="stat"><small>Total ' + esc(CONFIG.item.toLowerCase()) + 's</small><b>' + rows.length + "</b></div>"];
    for (const fl of CONFIG.fields.filter((x) => x.type === "number" && !plain(x)).slice(0, 3)) {
      const nums = rows.map((r) => r[fl.key]).filter((v) => typeof v === "number");
      const sum = nums.reduce((a, b) => a + b, 0);
      const useAvg = /age|year|marks|score|rate/i.test(fl.label);
      stats.push('<div class="stat"><small>' + (useAvg ? "Average " : "Total ") + esc(fl.label.toLowerCase()) + "</small><b>" + (nums.length ? (useAvg ? Math.round((sum / nums.length) * 10) / 10 : sum).toLocaleString("en-IN") : "–") + "</b></div>");
    }
    const sel = CONFIG.fields.find((x) => x.type === "select");
    if (sel) stats.push('<div class="stat"><small>' + esc(sel.label) + ": " + esc(sel.options[0]) + "</small><b>" + rows.filter((r) => r[sel.key] === sel.options[0]).length + "</b></div>");
    $("stats").innerHTML = stats.join("");
  }
  $("search").oninput = render;

  $("export").onclick = () => {
    const cell = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const csv = [CONFIG.fields.map((fl) => cell(fl.label)).join(",")].concat(rows.map((r) => CONFIG.fields.map((fl) => cell(r[fl.key])).join(","))).join("\\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = KEY + ".csv";
    a.click();
  };
  $("clear").onclick = () => { if (rows.length && confirm("Delete all " + rows.length + " records?")) { rows = []; save(); render(); } };
  $("sample").onclick = () => {
    const today = new Date();
    for (let n = 1; n <= 3; n++) {
      const rec = { id: Date.now().toString(36) + n };
      for (const fl of CONFIG.fields) {
        const d = new Date(today.getTime() - n * 86400000 * 3);
        rec[fl.key] = fl.type === "number" ? (/year/i.test(fl.label) ? 2020 + n : /age/i.test(fl.label) ? 20 + n * 7 : n * 150) : fl.type === "date" ? d.toISOString().slice(0, 10) : fl.type === "select" ? fl.options[(n - 1) % fl.options.length] : fl.type === "email" ? "person" + n + "@example.com" : fl.type === "tel" ? "98765 4321" + n : fl.label + " " + n;
      }
      rows.push(rec);
    }
    save(); render(); say("Added 3 sample " + CONFIG.item.toLowerCase() + "s.");
  };

  buildForm();
  render();
</script>
</body>
</html>
`;
}

// The chat answer for a management-system request, or null.
export function managementAnswer(question) {
  if (!isManagementRequest(question)) return null;
  const plan = planApp(question);
  const code = buildManagementApp(plan);
  const fieldList = plan.fields.map((x) => `**${x.label}**${x.type !== "text" ? ` (${x.type === "select" ? x.options.join(" / ") : x.type})` : ""}`).join(", ");
  const python = /\bpython\b/i.test(question);
  const lines = [
    `**${plan.title}** — built for you from your request`,
    "",
    plan.fromRequest ? `I used the fields you asked for: ${fieldList}.` : `I chose the usual fields for this: ${fieldList}. Want different ones? Say, for example, “make a ${plan.title.toLowerCase()} with name, phone and date”.`,
    "",
    "**What it does:** add, edit and delete records · search · sort by any column (tap the heading) · totals at the top · export to CSV (opens in Excel) · everything is saved in the browser.",
    "",
  ];
  if (python) lines.push("I build these as web apps (they run on any phone, tablet or computer); the same idea works in Python with a list of dictionaries and a JSON file.", "");
  lines.push(
    "```html\n" + code + "```",
    "",
    "**How to use it:**",
    "- Tap **▶ run** to try it right here (press **Add sample data** to see it filled).",
    "- Tap **⬇ download** to save it as a .html file and open it in Chrome on any device.",
    "- To change the fields, edit the `CONFIG` list at the top of the <script>."
  );
  return lines.join("\n");
}
