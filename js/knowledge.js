// Nova AI's built-in coding teacher: answers "what is a variable?", "explain
// loops", "what is git?" and similar instantly, with a small example and a
// link to the matching Code School lesson (learn.html).

// A word like "function" or "branch" means something else outside coding,
// so those topics only answer when the question mentions coding.
const CODING_CONTEXT = /\b(cod(e|ing)|program(ming)?|javascript|js|python|java|html|css|git|github|developer|software|computer)\b/;

const lesson = (id, name) => `\n\n📘 Learn more: [Code School: ${name}](learn.html#${id})`;

const TOPICS = [
  {
    words: ["coding", "programming", "code", "computer programming"],
    answer:
      "Coding (programming) is writing exact instructions for a computer in a language it understands, like JavaScript or Python. A computer does exactly what the code says, in order.\n\n" +
      "Every program does three things:\n- Input: it receives something (your message)\n- Processing: it follows its instructions\n- Output: it shows a result (the reply)" +
      lesson("what", "What code is"),
  },
  {
    words: ["html"],
    answer:
      "HTML decides what is on a web page: headings, text, buttons, boxes. It's the walls and rooms of a website.\n\n" +
      "```html\n<button id=\"sendBtn\">Send</button>\n```\n\nNova AI's chat box and send button are written in HTML (index.html)." +
      lesson("trio", "HTML, CSS and JavaScript"),
  },
  {
    words: ["css"],
    answer:
      "CSS decides how a web page looks: colours, sizes, fonts, spacing, rounded corners. It's the paint and furniture.\n\n" +
      "```css\n#sendBtn {\n  background: gold;\n  border-radius: 10px;\n}\n```\n\nNova AI's dark colours and gold logo are CSS (style.css)." +
      lesson("trio", "HTML, CSS and JavaScript"),
  },
  {
    words: ["javascript", "js"],
    answer:
      "JavaScript makes a web page do things: react to clicks, send messages, fetch answers. Every web browser can run it, and Nova AI is written in it.\n\n" +
      "```javascript\nsendBtn.addEventListener(\"click\", () => {\n  sendMessage();\n});\n```" +
      lesson("trio", "HTML, CSS and JavaScript"),
  },
  {
    words: ["variable", "variables"],
    answer:
      "A variable is a labelled box that holds a piece of information. You create it, give it a name, and put a value in it.\n\n" +
      "```javascript\nlet name = \"Mohnishkumar\";\nlet age = 20;\nconsole.log(\"Hello \" + name);\n```\n\nYou can change what's in the box later: name = \"Priya\";" +
      lesson("vars", "Variables and data"),
  },
  {
    words: ["data type", "data types", "datatype", "datatypes", "types of data"],
    answer:
      "Data types are the kinds of information a program works with:\n- String (text): \"hello\"\n- Number: 42, 3.14\n- Boolean (yes/no): true, false\n- Array (list): [\"hi\", \"hello\"]\n- Object (labelled facts): { name: \"MK\", age: 1 }" +
      lesson("vars", "Variables and data"),
  },
  {
    words: ["boolean", "booleans"],
    answer:
      "A boolean is a yes/no value: true or false. Programs use booleans to make decisions.\n\n" +
      "```javascript\nlet isCreator = true;\nif (isCreator) {\n  console.log(\"Welcome back, boss!\");\n}\n```" +
      lesson("vars", "Variables and data"),
  },
  {
    words: ["array", "arrays"],
    answer:
      "An array is a list of values kept in order. Counting starts at 0, so the first item is [0].\n\n" +
      "```javascript\nlet chats = [\"maths help\", \"python game\", \"hello\"];\nconsole.log(chats[0]);      // maths help\nconsole.log(chats.length);  // 3\n```" +
      lesson("vars", "Variables and data"),
  },
  {
    words: ["string", "strings"],
    needsContext: true,
    answer:
      "A string is a piece of text, written inside quotes. You can join strings with +.\n\n" +
      "```javascript\nlet greeting = \"Hello\";\nconsole.log(greeting + \", world!\");  // Hello, world!\n```" +
      lesson("vars", "Variables and data"),
  },
  {
    words: ["object", "objects"],
    needsContext: true,
    answer:
      "An object groups labelled facts about one thing, as name: value pairs.\n\n" +
      "```javascript\nlet message = { role: \"user\", text: \"hi\" };\nconsole.log(message.text);  // hi\n```\n\nEvery chat message in Nova AI is stored as an object like this." +
      lesson("vars", "Variables and data"),
  },
  {
    words: ["if statement", "if statements", "if else", "if-else", "conditional", "conditionals", "condition", "conditions"],
    answer:
      "An if statement lets a program make a decision: if something is true, run this; otherwise, run that.\n\n" +
      "```javascript\nif (message === \"hi\") {\n  reply(\"Hello! 👋\");\n} else if (message === \"bye\") {\n  reply(\"Goodbye!\");\n} else {\n  reply(\"I don't know that yet 🤔\");\n}\n```\n\n=== means \"is exactly equal to\"; a single = puts a value into a variable." +
      lesson("if", "If / else"),
  },
  {
    words: ["loop", "loops", "for loop", "for loops", "while loop", "while loops", "iteration"],
    answer:
      "A loop repeats a block of code. Instead of writing the same line 10 times, you write it once and loop.\n\n" +
      "```javascript\nfor (let i = 1; i <= 5; i++) {\n  console.log(\"7 × \" + i + \" = \" + 7 * i);\n}\n```\n\nRead it as: start i at 1, keep going while i is at most 5, add 1 after each round." +
      lesson("loops", "Loops"),
  },
  {
    words: ["function", "functions"],
    needsContext: true,
    answer:
      "A function is a reusable recipe: inputs go in, it runs, and it returns a result. Write it once, use it many times.\n\n" +
      "```javascript\nfunction square(n) {\n  return n * n;\n}\nconsole.log(square(9));  // 81\n```\n\nNova AI's own brain is a function: localAnswer(question)." +
      lesson("functions", "Functions"),
  },
  {
    words: ["event", "events", "event listener", "event listeners"],
    needsContext: true,
    answer:
      "An event is something that happens on a page: a click, a key press, the page loading. An event listener runs a function when it happens.\n\n" +
      "```javascript\nbutton.addEventListener(\"click\", () => {\n  console.log(\"You clicked!\");\n});\n```" +
      lesson("events", "Events"),
  },
  {
    words: ["front end", "frontend", "front-end", "back end", "backend", "back-end"],
    answer:
      "The front end is the part that runs in your browser: HTML, CSS and JavaScript you can see and click. The back end runs on servers: it stores data and does work the browser shouldn't.\n\n" +
      "Nova AI's front end is on GitHub Pages; its back end is Firebase (login and the Firestore database)." +
      lesson("stack", "Front end and database"),
  },
  {
    words: ["database", "databases"],
    answer:
      "A database stores information permanently so it survives refreshes and can be shared between devices and people.\n\n" +
      "Nova AI uses Firestore to store users, chats and everything it learns. Security rules decide who can read or change what." +
      lesson("stack", "Front end and database"),
  },
  {
    words: ["api", "apis"],
    answer:
      "An API is a way for one program to ask another for something, using agreed messages. When Nova AI asks Gemini or Groq a question, it sends a request to their API and gets the answer back.\n\n" +
      "```javascript\nconst res = await fetch(\"https://api.example.com/answer?q=hi\");\nconst data = await res.json();\n```" +
      lesson("stack", "Front end and database"),
  },
  {
    words: ["git"],
    answer:
      "Git saves snapshots of your code called commits, so every change has a history and can be undone. GitHub stores that history online so you can share it and work together." +
      lesson("git", "Git and GitHub"),
  },
  {
    words: ["github"],
    answer:
      "GitHub is a website that stores Git projects (repositories) online. You can review changes as pull requests, and GitHub Pages can host a website for free, which is how Nova AI is online." +
      lesson("git", "Git and GitHub"),
  },
  {
    words: ["commit", "commits"],
    needsContext: true,
    answer:
      "A commit is one saved snapshot of your code, with a message describing the change. You can always go back to an earlier commit." +
      lesson("git", "Git and GitHub"),
  },
  {
    words: ["branch", "branches"],
    needsContext: true,
    answer:
      "A branch is a separate draft copy of your code. You work there without touching the live version (main), then merge it back when it's ready." +
      lesson("git", "Git and GitHub"),
  },
  {
    words: ["pull request", "pull requests", "pr"],
    answer:
      "A pull request (PR) is a proposal to merge a branch into main. People can review the changes first. Every Nova AI feature, like chat sync (#22) and creator mode (#25), went in as a PR." +
      lesson("git", "Git and GitHub"),
  },
  {
    words: ["repository", "repositories", "repo", "repos"],
    answer:
      "A repository (repo) is a project folder together with its whole history of changes. Nova AI lives in the repo rsmohnishkumar-design/MK.AI on GitHub." +
      lesson("git", "Git and GitHub"),
  },
];

const LEARN =
  "I can teach you! 🎓 Open the Code School: 11 short lessons with code you can run, demos and quizzes, all explained using how I work.\n\n" +
  "👉 [Open Code School](learn.html)\n\nYou can also ask me things like \"what is a variable?\" or \"explain loops\" anytime.";

function normalize(text) {
  return text.toLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{M}\p{N}\s'+#-]/gu, " ").replace(/\s+/g, " ").trim();
}

const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ASK = String.raw`(what(?:'s| is| are| does| do)?|whats|explain|define|describe|meaning of|tell me about|teach me|how (?:do|does)|what do you mean by)`;

export function codingAnswer(question) {
  const q = normalize(question);
  if (!q) return null;
  if (/^(teach me (to )?(code|coding|programming)|how (do i|to|can i) (learn|start) (to )?(code|coding|programming)|i want to learn (to )?(code|coding|programming)|learn (to )?(code|coding|programming)|code school)\b/.test(q)) {
    return LEARN;
  }
  // Another language named ("loops in python"): the knowledge base has examples in that language.
  if (/\b(python|java(?!script)|c\+\+|cpp|c#|php|sql|kotlin|swift|ruby|rust|golang|dart|typescript)\b|\bin c\b/.test(q)) return null;
  const hasContext = CODING_CONTEXT.test(q);
  for (const topic of TOPICS) {
    if (topic.needsContext && !hasContext) continue;
    const words = topic.words.map(esc).join("|");
    // "what is a variable", "explain loops in javascript", "variables?", "how do loops work"
    const re = new RegExp(
      String.raw`^(?:${ASK}\s+)?(?:an?\s+|the\s+)?(?:${words})(?:\s+(?:in|for|mean|means|work|works|used for)\b.*)?$`
    );
    if (re.test(q)) return topic.answer;
  }
  return null;
}
