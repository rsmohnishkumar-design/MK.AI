// Free plan limits, counted in tokens like other AI assistants: the question
// plus the answer, split into tokens by MK.ai's tokenizer (js/tokenizer.js):
// - 10,000 tokens per 5-hour window, which starts with the first message;
// - 100,000 tokens per week, which starts with the first use.
// Usage is kept in the account's profile, so it follows the person across devices.

import { countTokens } from "./tokenizer.js";

export const LIMITS = {
  windowTokens: 10000,
  windowMs: 5 * 3600000,
  weekTokens: 100000,
  weekMs: 7 * 86400000,
};

// The admin can change the free limits from the vault
export function setLimits({ windowTokens, weekTokens } = {}) {
  if (Number(windowTokens) >= 1000) LIMITS.windowTokens = Number(windowTokens);
  if (Number(weekTokens) >= 10000) LIMITS.weekTokens = Number(weekTokens);
}

export const tokensFor = (question = "", answer = "") => Math.max(1, countTokens(question) + countTokens(answer));

// Usage with any finished window or week cleared.
export function currentUsage(usage = {}, now = Date.now()) {
  const u = { windowStart: 0, windowTokens: 0, weekStart: 0, weekTokens: 0, ...(usage || {}) };
  if (!u.windowStart || now - u.windowStart >= LIMITS.windowMs) Object.assign(u, { windowStart: 0, windowTokens: 0 });
  if (!u.weekStart || now - u.weekStart >= LIMITS.weekMs) Object.assign(u, { weekStart: 0, weekTokens: 0 });
  return u;
}

export function addUsage(usage, tokens, now = Date.now()) {
  const u = currentUsage(usage, now);
  if (!u.windowStart) u.windowStart = now;
  if (!u.weekStart) u.weekStart = now;
  u.windowTokens += tokens;
  u.weekTokens += tokens;
  return u;
}

// Percentages used and when each limit resets.
export function usageSummary(usage, now = Date.now()) {
  const u = currentUsage(usage, now);
  return {
    windowPct: Math.min(100, Math.round((u.windowTokens / LIMITS.windowTokens) * 100)),
    weekPct: Math.min(100, Math.round((u.weekTokens / LIMITS.weekTokens) * 100)),
    windowReset: u.windowStart ? u.windowStart + LIMITS.windowMs : null,
    weekReset: u.weekStart ? u.weekStart + LIMITS.weekMs : null,
    windowTokens: u.windowTokens,
    weekTokens: u.weekTokens,
  };
}

// null while there's room; otherwise which limit was reached and when it resets.
export function limitReached(usage, now = Date.now()) {
  const s = usageSummary(usage, now);
  if (s.weekTokens >= LIMITS.weekTokens) return { which: "week", resetAt: s.weekReset };
  if (s.windowTokens >= LIMITS.windowTokens) return { which: "window", resetAt: s.windowReset };
  return null;
}

// "in 2 hr 14 min" / "Mon 8:30 AM"
export function resetText(at, now = Date.now()) {
  if (!at) return "";
  const ms = at - now;
  if (ms < 24 * 3600000) {
    const h = Math.floor(ms / 3600000);
    const m = Math.max(1, Math.ceil((ms % 3600000) / 60000));
    return `in ${h ? `${h} hr ` : ""}${m} min`;
  }
  return new Date(at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
}
