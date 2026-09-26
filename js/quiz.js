// "Quiz me": multiple-choice questions built from MK.ai's own knowledge packs
// (capitals, chemical symbols, full forms, important days). Wrong options
// come from other entries of the same kind, so every quiz is different.

const BASE = new URL("../data/kb/", import.meta.url);

// kind: [pack, question pattern, answer pattern, label]
const KINDS = {
  capitals: ["countries", /^What is the capital of (.+)\?$/, /is ([^.]+)\.$/, "capitals"],
  symbols: ["elements", /^What is the chemical symbol of (.+)\?$/, /is (\w+)\.$/, "chemical symbols"],
  fullforms: ["fullforms", /^What is the full form of (.+)\?$/, /stands for \*\*([^*]+)\*\*/, "full forms"],
  days: ["days", /^When is (.+)\?$/, /is on \*\*([^*]+)\*\*/, "important days"],
};

const cache = new Map();
async function items(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const [pack, qRe, aRe] = KINDS[kind];
  const data = await fetch(new URL(`${pack}.json`, BASE)).then((r) => r.json());
  const list = data.entries
    .filter(([q]) => qRe.test(q))
    .map(([q, a]) => ({ q, a: (a.match(aRe) || [])[1], explain: a.replace(/\*\*/g, "") }))
    .filter((x) => x.a && x.a.length < 80);
  cache.set(kind, list);
  return list;
}

const shuffle = (list) => list.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

export function wantsQuiz(question) {
  return /^(quiz me|give me a quiz|start a quiz|take a quiz|test me|test my knowledge|ask me a quiz|quiz|gk quiz|general knowledge quiz)\b/i.test(question.trim());
}

function kindFor(question) {
  const q = question.toLowerCase();
  if (/capital|countr|geograph|world/.test(q)) return "capitals";
  if (/element|chemi|symbol|science|periodic/.test(q)) return "symbols";
  if (/full ?form|abbreviat|acronym/.test(q)) return "fullforms";
  if (/\bdays?\b|dates?|celebrat/.test(q)) return "days";
  return shuffle(Object.keys(KINDS))[0];
}

// The answer for "quiz me …": text plus a quiz block the chat turns into buttons.
export async function quizAnswer(question) {
  const kind = kindFor(question);
  const list = await items(kind);
  if (list.length < 4) return null;
  const [item, ...rest] = shuffle(list);
  const wrong = [...new Set(rest.map((x) => x.a).filter((a) => a !== item.a))].slice(0, 3);
  const options = shuffle([item.a, ...wrong]);
  const block = { kind, label: KINDS[kind][3], q: item.q, options, answer: item.a, explain: item.explain };
  return `**Quiz · ${KINDS[kind][3]}**\n\n**${item.q}**\n\n\`\`\`mkai-quiz\n${JSON.stringify(block)}\n\`\`\``;
}

// Turns the quiz block into answer buttons. onNext(kind) asks for another question.
export function mountQuiz(container, text, onNext) {
  let quiz;
  try {
    quiz = JSON.parse(text);
  } catch {
    return;
  }
  const box = document.createElement("div");
  box.className = "quiz-box";
  const result = document.createElement("p");
  result.className = "quiz-result";
  const buttons = quiz.options.map((opt) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "quiz-option";
    b.textContent = opt;
    b.addEventListener("click", () => {
      const right = opt === quiz.answer;
      buttons.forEach((x) => {
        x.disabled = true;
        if (x.textContent === quiz.answer) x.classList.add("right");
      });
      if (!right) b.classList.add("wrong");
      result.textContent = `${right ? "Correct." : `Not quite. The answer is ${quiz.answer}.`} ${quiz.explain}`;
      next.hidden = false;
    });
    return b;
  });
  const next = document.createElement("button");
  next.type = "button";
  next.className = "quiz-next";
  next.textContent = "Next question →";
  next.hidden = true;
  next.addEventListener("click", () => {
    next.disabled = true;
    onNext?.(quiz.label);
  });
  box.append(...buttons, result, next);
  container.append(box);
}
