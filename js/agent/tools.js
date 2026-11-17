// The tool registry. Every tool declares what it does and how much it may touch:
//   "read"          looks things up (web, Wikipedia, the attached file)
//   "compute"       works on the device only (maths, statistics, running code in a sandbox)
//   "generate"      creates new content (pictures)
//   "consequential" changes saved data → the person must approve each use
// Agents can only call tools on their own allow-list, and the engine checks both.

import { calculate, describe, outliers, correlation, compareGroups, forecast, decide, numbersIn, parseTable, column } from "./analytics.js";

export const PERMISSIONS = ["read", "compute", "generate", "consequential"];

// Web text and file text are data, never instructions: wrapped so the model knows.
export function untrusted(source, text, max = 6000) {
  const t = String(text || "").slice(0, max).replace(/<\/?untrusted[^>]*>/gi, "");
  return `<untrusted source="${String(source).replace(/"/g, "'").slice(0, 120)}">\n${t}\n</untrusted>`;
}

// deps: { research(q, signal), wiki(q), runPython(code), image({prompt,width,height,seed}), memory, file() }
export function createTools(deps = {}) {
  const tools = {
    calculate: {
      permission: "compute",
      describe: "Exact arithmetic: input = an expression like (12.5*4)^2/3 or sqrt(2)",
      run: async ({ input }) => ({ text: `${input} = ${calculate(input)}`, data: calculate(input) }),
    },
    analyze_data: {
      permission: "compute",
      describe: "Statistics on numbers or a CSV table: count, mean, median, spread, outliers; with two columns, correlation. input = the numbers or CSV",
      run: async ({ input }) => {
        const text = String(input || deps.file?.()?.text || "");
        const table = parseTable(text);
        const numericCols = table.headers.filter((h) => column(table, h).length >= Math.max(2, table.rows.length * 0.8));
        if (numericCols.length >= 2) {
          const [a, b] = numericCols;
          const out = { columns: Object.fromEntries(numericCols.map((h) => [h, describe(column(table, h))])), correlation: { between: [a, b], ...correlation(column(table, a), column(table, b)) } };
          return { text: JSON.stringify(out, null, 1), data: out };
        }
        const nums = numericCols.length ? column(table, numericCols[0]) : numbersIn(text);
        const out = { summary: describe(nums), outliers: outliers(nums) };
        return { text: JSON.stringify(out, null, 1), data: out };
      },
    },
    compare_groups: {
      permission: "compute",
      describe: "Compare two groups of numbers. input = {\"a\":[...],\"b\":[...]}",
      run: async ({ input }) => {
        const v = typeof input === "string" ? JSON.parse(input) : input;
        const out = compareGroups(v.a.map(Number), v.b.map(Number));
        return { text: JSON.stringify(out, null, 1), data: out };
      },
    },
    forecast: {
      permission: "compute",
      describe: "Forecast the next values of a series with uncertainty ranges. input = {\"values\":[...],\"horizon\":3}",
      run: async ({ input }) => {
        const v = typeof input === "string" ? (input.trim().startsWith("{") ? JSON.parse(input) : { values: numbersIn(input) }) : input;
        const out = forecast((v.values || []).map(Number), v.horizon || 3);
        return { text: JSON.stringify(out, null, 1), data: out };
      },
    },
    decide: {
      permission: "compute",
      describe: "Rank options against weighted criteria and constraints. input = {\"options\":[{\"name\":\"A\",\"scores\":{\"cost\":5}}],\"criteria\":[{\"name\":\"cost\",\"weight\":2,\"better\":\"lower\"}],\"constraints\":[]}",
      run: async ({ input }) => {
        const v = typeof input === "string" ? JSON.parse(input) : input;
        const out = decide(v.options, v.criteria, v.constraints || []);
        return { text: JSON.stringify(out, null, 1), data: out };
      },
    },
    web_research: {
      permission: "read",
      describe: "Search the web and return findings with source links. input = the research question",
      run: async ({ input, signal }) => {
        if (!deps.research) throw new Error("Web research isn't available here.");
        const out = await deps.research(String(input), signal);
        if (!out?.text) throw new Error("The search returned nothing.");
        return { text: untrusted("web search", out.text), data: out, sources: out.sources || [] };
      },
    },
    wikipedia: {
      permission: "read",
      describe: "Look up a topic on Wikipedia. input = the topic or question",
      run: async ({ input }) => {
        if (!deps.wiki) throw new Error("Wikipedia isn't available here.");
        const out = await deps.wiki(String(input));
        if (!out?.text) throw new Error("Wikipedia has no article on that.");
        return { text: untrusted(out.url || "wikipedia", out.text), data: out, sources: out.url ? [{ title: out.title || "Wikipedia", url: out.url }] : [] };
      },
    },
    read_file: {
      permission: "read",
      describe: "Read the file the person attached to this task. input = what to look for (optional)",
      run: async () => {
        const f = deps.file?.();
        if (!f?.text) throw new Error("No readable file is attached to this task.");
        return { text: untrusted(f.name || "file", f.text, 12000), data: { name: f.name, chars: f.text.length } };
      },
    },
    run_python: {
      permission: "compute",
      describe: "Run Python code in a sandbox on the device and return its printed output. input = the code",
      run: async ({ input }) => {
        if (!deps.runPython) throw new Error("Running code isn't available here.");
        const code = String(input).replace(/^```(?:python|py)?\n?|```$/g, "");
        const out = await deps.runPython(code);
        return { text: out.error ? `Error:\n${out.error}\nOutput:\n${out.output || ""}` : `Output:\n${out.output || "(nothing printed)"}`, data: out, ok: !out.error };
      },
    },
    generate_image: {
      permission: "generate",
      describe: "Create a picture with a real image AI model. input = {\"prompt\":\"...\",\"width\":1024,\"height\":1024}",
      run: async ({ input, signal }) => {
        if (!deps.image) throw new Error("Image generation isn't available here.");
        const v = typeof input === "string" ? (input.trim().startsWith("{") ? JSON.parse(input) : { prompt: input }) : input;
        const out = await deps.image({ prompt: v.prompt, width: v.width || 1024, height: v.height || 1024, seed: v.seed }, signal);
        return { text: `Picture created by ${out.by}.`, data: out, images: [out] };
      },
    },
    remember: {
      permission: "consequential",
      describe: "Save a fact about the person to their private memory (needs their approval). input = the fact",
      run: async ({ input }) => {
        if (!deps.memory) throw new Error("Memory isn't available.");
        if (!deps.memory.enabled) throw new Error("Memory is switched off in settings.");
        const f = deps.memory.add(String(input), "agent");
        return { text: `Saved to your memory: "${f.text}"`, data: f };
      },
    },
  };
  return tools;
}
