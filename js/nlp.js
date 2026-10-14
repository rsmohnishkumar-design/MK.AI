// Natural language processing: reads a message before anything answers it.
// It works out the language and script, the kind of message (question,
// request, greeting, maths…), the key words, the sentences and things like
// numbers, links, emails and dates. The router and Alpaca use the result, so
// a Tamil question gets a Tamil answer and the right part of MK.ai replies.

import { tokenize } from "./tokenizer.js";
import { keywords, normalize } from "./words.js";

const SCRIPTS = [
  ["Tamil", /\p{Script=Tamil}/gu],
  ["Hindi", /\p{Script=Devanagari}/gu],
  ["Telugu", /\p{Script=Telugu}/gu],
  ["Kannada", /\p{Script=Kannada}/gu],
  ["Malayalam", /\p{Script=Malayalam}/gu],
  ["Bengali", /\p{Script=Bengali}/gu],
  ["Gujarati", /\p{Script=Gujarati}/gu],
  ["Punjabi", /\p{Script=Gurmukhi}/gu],
  ["Urdu", /\p{Script=Arabic}/gu],
  ["Chinese", /\p{Script=Han}/gu],
  ["Japanese", /[\p{Script=Hiragana}\p{Script=Katakana}]/gu],
  ["Korean", /\p{Script=Hangul}/gu],
  ["Russian", /\p{Script=Cyrillic}/gu],
];
// Tamil or Hindi written in English letters ("enna panra", "kya haal hai")
const TANGLISH = /\b(enna|epdi|eppadi|panra|panringa|irukka|iruken|irukeenga|sollu|sollunga|vanakkam|nandri|romba|illa|venum|enaku|unaku|seri|paaru|theriyuma)\b/i;
const HINGLISH = /\b(kya|kaise|kaisa|haan|nahi|nahin|accha|achha|bhai|kyun|kaun|kahan|matlab|samjha|batao|bolo|namaste|dhanyavad|shukriya)\b/i;

export function detectLanguage(text = "") {
  let best = null;
  let most = 0;
  for (const [name, re] of SCRIPTS) {
    const n = (text.match(re) || []).length;
    if (n > most) [best, most] = [name, n];
  }
  const latin = (text.match(/\p{Script=Latin}/gu) || []).length;
  if (best && most >= latin * 0.3) return { language: best, script: best === "Hindi" ? "Devanagari" : best };
  if (TANGLISH.test(text)) return { language: "Tamil", script: "Latin (Tanglish)" };
  if (HINGLISH.test(text)) return { language: "Hindi", script: "Latin (Hinglish)" };
  return { language: "English", script: "Latin" };
}

// What kind of message it is
export function intentOf(text = "") {
  const t = normalize(text);
  if (!t) return "empty";
  if (/^(hi+|hey+|hello+|vanakkam|namaste|good (morning|afternoon|evening|night))\b/.test(t)) return "greeting";
  if (/^(thanks?|thank you|thx|nandri|dhanyavad|shukriya)\b/.test(t)) return "thanks";
  if (/(^|\s)[\d.]+\s*[-+*/×÷^%]\s*[\d.]/.test(text) || /\d\s*%\s*of\s*\d/i.test(text) || /\b(solve|integrate|differentiate|simplify|factori[sz]e|calculate)\b/.test(t)) return "maths";
  if (/```|\b(code|program|function|python|javascript|java|html|css|sql|bug|error|debug)\b/.test(t)) return "code";
  if (/\b(draw|paint|picture|image|photo|poster|logo|wallpaper)\b/.test(t)) return "picture";
  if (/\b(translate|summari[sz]e|rewrite|paraphrase)\b/.test(t)) return "transform";
  if (/^(write|make|create|build|generate|design|give me|list|plan)\b/.test(t)) return "request";
  if (/\?\s*$/.test(text) || /^(what|who|whom|whose|which|when|where|why|how|is|are|can|could|should|do|does|did|will|explain|define|tell)\b/.test(t)) return "question";
  return "statement";
}

// Numbers, links, emails, dates and @mentions found in the text
export function entitiesOf(text = "") {
  return {
    numbers: text.match(/(?<![\p{L}])-?\d+(?:[.,]\d+)*(?:\.\d+)?%?/gu) || [],
    urls: text.match(/https?:\/\/[^\s)]+/g) || [],
    emails: text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || [],
    dates:
      text.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+\d{4})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{4})?|(?:19|20)\d{2})\b/gi) || [],
  };
}

export function sentencesOf(text = "") {
  return (text.match(/[^.!?।\n]+[.!?।]*/g) || []).map((s) => s.trim()).filter(Boolean);
}

// Everything at once
export function analyze(text = "") {
  const tokens = tokenize(text);
  return {
    ...detectLanguage(text),
    intent: intentOf(text),
    tokens: tokens.length,
    keywords: keywords(text).slice(0, 12),
    sentences: sentencesOf(text).length,
    entities: entitiesOf(text),
  };
}

// A short note for Alpaca built from the analysis (empty when nothing helps)
export function nlpNote(info) {
  if (!info) return "";
  const notes = [];
  if (info.language !== "English") {
    notes.push(
      info.script.startsWith("Latin")
        ? `The user wrote ${info.language} in English letters (${info.script.replace(/^Latin \(|\)$/g, "")}). Reply the same way, in ${info.language} written with English letters, unless they ask otherwise.`
        : `The user wrote in ${info.language}. Reply in ${info.language} (${info.script} script) unless they ask otherwise.`
    );
  }
  if (info.intent === "maths") notes.push("This is a maths problem: show the working step by step and give the final answer clearly.");
  if (info.entities.urls.length > 1) notes.push("The message has several links; cover each one.");
  return notes.join("\n");
}

// What to ask next: three suggestions picked from what the message was about.
// The topic is the question without its question words ("what is
// photosynthesis?" → "photosynthesis").
export function topicOf(text = "") {
  // "how does a rocket work in space" → "a rocket"
  const how = text.match(/^\s*how (?:does|do|did|is|are|can) (.+?) (?:work|works|happen|form|grow|move|fly|function)\b/i);
  if (how) return how[1].replace(/^(the|a|an) /i, "").trim();
  let t = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[?!.]+\s*$/, "")
    .replace(/^\s*(please\s+)?(can you\s+|could you\s+)?(tell me|explain( to me)?|describe|define|what('s| is| are| was| were)|who('s| is| was| were)|how (do|does|did|is|are|can)|why (do|does|did|is|are)|when (did|was|is)|where (is|are|was))\s+(about\s+)?(the |a |an )?/i, "")
    .trim();
  if (t.split(/\s+/).length > 6) t = t.split(/\s+(?:and|with|in|for|which|that|because)\s+/i)[0];
  if (t.split(/\s+/).length > 6) t = t.split(/\s+/).slice(0, 5).join(" ");
  if (!t) t = keywords(text).slice(0, 3).join(" ");
  return t.length > 60 ? t.slice(0, 60).replace(/\s\S*$/, "") : t;
}

export function nextSteps(question = "", answer = "") {
  const info = analyze(question);
  if (info.language !== "English" || answer.length < 80) return [];
  if (/```/.test(answer) || info.intent === "code") return ["Explain this code step by step", "Add error handling and comments to this code", "Write tests for this code"];
  if (info.intent === "maths") return ["Show another way to solve it", "Give me a practice question like this", "Explain the formula used in this"];
  if (info.intent === "request" || info.intent === "transform") return ["Make it shorter", "Make it more formal", "Translate it into Tamil"];
  if (!["question", "statement"].includes(info.intent)) return [];
  const topic = topicOf(question);
  if (!topic || topic.length < 3) return [];
  return [`Give a real-life example of ${topic}`, `Make a 5-question quiz on ${topic}`, `Make short notes on ${topic}`];
}
