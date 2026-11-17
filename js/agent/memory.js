// User-controlled memory. Facts are kept on this device only, per account, and
// the person can see, add, delete, clear or switch off memory at any time.
// Nothing here is ever shared with other people.

const key = (uid) => `mkai-memory-${uid || "guest"}`;
const MAX = 200;

export function createMemory(storage = globalThis.localStorage, uid = "guest") {
  const load = () => {
    try {
      const d = JSON.parse(storage.getItem(key(uid)) || "{}");
      return { enabled: d.enabled !== false, facts: Array.isArray(d.facts) ? d.facts : [] };
    } catch {
      return { enabled: true, facts: [] };
    }
  };
  const save = (d) => {
    try {
      storage.setItem(key(uid), JSON.stringify(d));
    } catch {}
  };
  return {
    get enabled() {
      return load().enabled;
    },
    setEnabled(on) {
      const d = load();
      d.enabled = !!on;
      save(d);
    },
    list: () => load().facts,
    add(text, source = "you") {
      const t = String(text || "").trim().slice(0, 300);
      if (!t) throw new Error("Nothing to remember.");
      const d = load();
      if (d.facts.some((f) => f.text.toLowerCase() === t.toLowerCase())) return d.facts.find((f) => f.text.toLowerCase() === t.toLowerCase());
      const fact = { id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, text: t, source, at: Date.now() };
      d.facts.unshift(fact);
      d.facts = d.facts.slice(0, MAX);
      save(d);
      return fact;
    },
    remove(id) {
      const d = load();
      d.facts = d.facts.filter((f) => f.id !== id);
      save(d);
    },
    clear() {
      save({ enabled: load().enabled, facts: [] });
    },
    // Facts that share words with the request (limited-memory mode); none when memory is off.
    relevant(text, max = 5) {
      const d = load();
      if (!d.enabled) return [];
      const words = new Set(String(text).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []);
      return d.facts
        .map((f) => ({ f, s: (f.text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter((w) => words.has(w)).length }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, max)
        .map((x) => x.f);
    },
  };
}
