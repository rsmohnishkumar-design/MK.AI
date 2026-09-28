// Runs Python and JavaScript code blocks right in the chat.
// Python: Pyodide (the real Python, compiled for the browser), loaded the first
// time it's needed. JavaScript: a sealed-off frame whose console output is shown.

const PYODIDE = [
  "https://cdn.jsdelivr.net/pyodide/v0.27.8/full/",
  "https://cdn.jsdelivr.net/npm/pyodide@0.27.8/",
];

let pyodideReady = null;
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Couldn't load ${src}`));
    document.head.append(s);
  });
}
function pyodide() {
  if (!pyodideReady) {
    pyodideReady = (async () => {
      let last;
      for (const base of PYODIDE) {
        try {
          if (!window.loadPyodide) await loadScript(`${base}pyodide.js`);
          return await window.loadPyodide({ indexURL: base });
        } catch (err) {
          last = err;
        }
      }
      throw last;
    })().catch((err) => {
      pyodideReady = null;
      throw err;
    });
  }
  return pyodideReady;
}

// Resolves { output, error }. print() output and errors arrive through onOutput(text).
export async function runPython(code, onOutput, onStatus = () => {}) {
  onStatus("Starting Python (the first run takes a few seconds)…");
  const py = await pyodide();
  onStatus("Running…");
  let output = "";
  const write = (text) => {
    output += text;
    onOutput(output);
  };
  py.setStdout({ batched: (t) => write(t + "\n") });
  py.setStderr({ batched: (t) => write(t + "\n") });
  py.setStdin({ stdin: () => window.prompt("Your program is asking for input:") ?? "" });
  try {
    await py.loadPackagesFromImports(code).catch(() => {});
    const result = await py.runPythonAsync(code);
    if (result !== undefined && result !== null && !output) write(String(result) + "\n");
    return { output, error: null };
  } catch (err) {
    // Only the useful end of the traceback
    const lines = String(err.message || err).trim().split("\n");
    const error = lines.slice(-6).join("\n");
    write(error + "\n");
    return { output, error: lines[lines.length - 1] };
  }
}

// Runs JavaScript in a sealed frame and collects console output.
export function runJavaScript(code, onOutput, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts allow-modals");
    frame.style.display = "none";
    const id = Math.random().toString(36).slice(2);
    let output = "";
    let error = null;
    const finish = () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      frame.remove();
      resolve({ output, error });
    };
    const onMessage = (e) => {
      if (e.source !== frame.contentWindow || e.data?.id !== id) return;
      if (e.data.type === "log") {
        output += e.data.text + "\n";
        onOutput(output);
      } else if (e.data.type === "error") {
        error = e.data.text;
        output += e.data.text + "\n";
        onOutput(output);
      } else if (e.data.type === "done") finish();
    };
    window.addEventListener("message", onMessage);
    const timer = setTimeout(() => {
      output += "(Stopped after 8 seconds.)\n";
      onOutput(output);
      finish();
    }, timeoutMs);
    const safe = JSON.stringify(code).replace(/</g, "\\u003c");
    frame.srcdoc = `<!DOCTYPE html><script>
const ID=${JSON.stringify(id)};
const show=(v)=>{try{return typeof v==="string"?v:JSON.stringify(v,null,2)??String(v)}catch{return String(v)}};
const send=(type,text)=>parent.postMessage({id:ID,type,text},"*");
for(const k of ["log","info","warn","error","table"])console[k]=(...a)=>send(k==="error"?"error":"log",a.map(show).join(" "));
addEventListener("error",(e)=>send("error",(e.message||"Error")+(e.lineno?" (line "+e.lineno+")":"")));
addEventListener("unhandledrejection",(e)=>send("error","Unhandled: "+(e.reason&&e.reason.message||e.reason)));
(async()=>{try{await (0,eval)("(async()=>{\\n"+${safe}+"\\n})()")}catch(e){send("error",e.name+": "+e.message)}finally{setTimeout(()=>send("done"),50)}})();
<\/script>`;
    document.body.append(frame);
  });
}
