// Robot link: lets Nova AI drive a physical robot body (an ESP32, Arduino or
// Raspberry Pi with a speaker, servos and lights) while the avatar talks.
//
// Three ways to connect, all from the browser:
//   - Bluetooth (BLE, "Nordic UART" service): Chrome on Android, Windows, Mac
//   - USB cable (Web Serial): Chrome / Edge on a computer
//   - Wi-Fi (WebSocket): a bridge on this computer, e.g. ws://localhost:8765
//
// Messages are one JSON object per line ("\n"). Nova AI → robot:
//   {"t":"state","v":"idle|listening|thinking|speaking"}
//   {"t":"emotion","v":"calm|happy|caring|thinking|curious|sorry"}
//   {"t":"mouth","v":0.6}            how open the mouth is, 0 to 1 (about 10 a second)
//   {"t":"say","text":"Hello!"}      the sentence being spoken now
//   {"t":"gesture","v":"wave|nod|think"}
// Robot → Nova AI:
//   {"t":"hello","name":"Nova Bot"}  shows the robot's name
//   {"t":"heard","text":"…"}         the robot's own mic heard a question
//   {"t":"button","v":"talk"}        a button on the robot: start listening
// Full guide and an ESP32 example: robot/README.md

const UART_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // we write here
const UART_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // robot notifies here

export const canBluetooth = typeof navigator !== "undefined" && !!navigator.bluetooth;
export const canSerial = typeof navigator !== "undefined" && !!navigator.serial;
export const canWebSocket = typeof WebSocket === "function";

const enc = new TextEncoder();
const dec = new TextDecoder();

let link = null; // { kind, name, write(text), close() }
const messageListeners = new Set();
const statusListeners = new Set();
let lastMouth = -1;
let lastMouthAt = 0;

function setStatus() {
  const s = status();
  for (const fn of statusListeners) fn(s);
}
export function status() {
  return link ? { connected: true, kind: link.kind, name: link.name } : { connected: false };
}
export function onStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}
export function onMessage(fn) {
  messageListeners.add(fn);
  return () => messageListeners.delete(fn);
}

// Incoming bytes → lines → JSON messages
function lineReader() {
  let buf = "";
  return (chunk) => {
    buf += typeof chunk === "string" ? chunk : dec.decode(chunk, { stream: true });
    if (buf.length > 8000) buf = buf.slice(-2000);
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("{")) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (!msg || typeof msg.t !== "string") continue;
      if (msg.t === "hello" && link && typeof msg.name === "string") {
        link.name = msg.name.slice(0, 40);
        setStatus();
      }
      for (const fn of messageListeners) fn(msg);
    }
  };
}

// Writes go out one at a time, in order (BLE can't take overlapping writes)
function serialQueue(writeChunk) {
  let chain = Promise.resolve();
  return (text) => {
    chain = chain.then(() => writeChunk(text)).catch(() => {});
    return chain;
  };
}

async function connectBluetooth() {
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [UART_SERVICE] }],
    optionalServices: [UART_SERVICE],
  });
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(UART_SERVICE);
  const rx = await service.getCharacteristic(UART_RX);
  const tx = await service.getCharacteristic(UART_TX).catch(() => null);
  const read = lineReader();
  if (tx) {
    await tx.startNotifications();
    tx.addEventListener("characteristicvaluechanged", (e) => read(new Uint8Array(e.target.value.buffer)));
  }
  const write = serialQueue(async (text) => {
    const bytes = enc.encode(text);
    for (let i = 0; i < bytes.length; i += 20) {
      const part = bytes.slice(i, i + 20);
      if (rx.writeValueWithoutResponse) await rx.writeValueWithoutResponse(part);
      else await rx.writeValue(part);
    }
  });
  device.addEventListener("gattserverdisconnected", () => {
    if (link?.device === device) disconnect();
  });
  return { kind: "Bluetooth", name: device.name || "Robot", device, write, close: () => device.gatt.connected && device.gatt.disconnect() };
}

async function connectSerial() {
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 115200 });
  const writer = port.writable.getWriter();
  const reader = port.readable.getReader();
  const read = lineReader();
  let open = true;
  (async () => {
    try {
      while (open) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) read(value);
      }
    } catch {}
    if (open && link?.port === port) disconnect();
  })();
  const write = serialQueue((text) => writer.write(enc.encode(text)));
  return {
    kind: "USB",
    name: "Robot (USB)",
    port,
    write,
    close: async () => {
      open = false;
      try { await reader.cancel(); } catch {}
      try { reader.releaseLock(); writer.releaseLock(); } catch {}
      try { await port.close(); } catch {}
    },
  };
}

function connectWebSocket(url) {
  return new Promise((resolve, reject) => {
    if (!/^wss?:\/\//i.test(url || "")) return reject(new Error("The address must start with ws:// or wss://"));
    let ws;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      return reject(err);
    }
    const read = lineReader();
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("The robot didn't answer at " + url));
    }, 6000);
    ws.onopen = () => {
      clearTimeout(timer);
      resolve({ kind: "Wi-Fi", name: "Robot (Wi-Fi)", ws, write: (text) => ws.readyState === 1 && ws.send(text), close: () => ws.close() });
    };
    ws.onmessage = (e) => read(typeof e.data === "string" ? (e.data.endsWith("\n") ? e.data : e.data + "\n") : "");
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Couldn't connect to " + url));
    };
    ws.onclose = () => {
      if (link?.ws === ws) disconnect();
    };
  });
}

// kind: "bluetooth" | "usb" | "wifi"; for Wi-Fi, opts.url
export async function connect(kind, opts = {}) {
  await disconnect();
  if (kind === "bluetooth") {
    if (!canBluetooth) throw new Error("This browser can't use Bluetooth. Use Chrome on Android, Windows or Mac.");
    link = await connectBluetooth();
  } else if (kind === "usb") {
    if (!canSerial) throw new Error("This browser can't use USB devices. Use Chrome or Edge on a computer.");
    link = await connectSerial();
  } else if (kind === "wifi") {
    link = await connectWebSocket(opts.url);
  } else {
    throw new Error("Unknown connection type");
  }
  lastMouth = -1;
  setStatus();
  send({ t: "hello", app: "Nova AI" });
  return status();
}

export async function disconnect() {
  const old = link;
  link = null;
  if (old) {
    try { await old.close(); } catch {}
    setStatus();
  }
}

export function send(msg) {
  if (!link) return false;
  try {
    link.write(JSON.stringify(msg) + "\n");
    return true;
  } catch {
    return false;
  }
}

// Mouth movement is sent at most 10 times a second, and only when it changes
export function mouth(v) {
  if (!link) return;
  const level = Math.round(Math.max(0, Math.min(1, v)) * 10) / 10;
  const now = Date.now();
  if (level === lastMouth || (now - lastMouthAt < 100 && level !== 0)) return;
  lastMouth = level;
  lastMouthAt = now;
  send({ t: "mouth", v: level });
}

// For tests: pretend a robot is connected, collecting what it receives
export function _fake(name = "Test robot") {
  const sent = [];
  link = { kind: "Test", name, write: (text) => sent.push(JSON.parse(text)), close() {} };
  setStatus();
  return { sent, receive: (msg) => lineReader()(JSON.stringify(msg) + "\n") };
}
