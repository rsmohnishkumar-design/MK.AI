// Attachments: a photo, a video, a PDF, a Word, PowerPoint or Excel file, or a
// text/code file sent with a question.
// Photos are shrunk on the device before sending. Photos and PDFs are read by
// Gemini (it can see images and documents); text files are added to the
// question itself, so every AI service can use them.

import { readOfficeFile, OFFICE_FILE, OLD_OFFICE_FILE } from "./officeread.js";
import { MAX_VIDEO_MB, VIDEO_FILE } from "./videoedit.js";

export const MAX_FILE_MB = 8;
const MAX_TEXT_CHARS = 12000;
const MAX_IMAGE_SIDE = 1600;
const TEXT_TYPES = /\.(txt|md|csv|json|js|mjs|ts|py|java|c|cpp|h|cs|html|css|xml|yml|yaml|sql|sh|log)$/i;

export const ACCEPT = "image/*,video/*,application/pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.json,.js,.ts,.py,.java,.c,.cpp,.html,.css,.xml,.yml,.yaml,.sql,.log";
export const TEXT_ACCEPT = ".txt,.md,.csv,.json,.js,.ts,.py,.java,.c,.cpp,.html,.css,.xml,.yml,.yaml,.sql,.log,text/plain";

function fail(message) {
  const err = new Error(message);
  err.friendly = true;
  return err;
}

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(fail("That file couldn't be read."));
    reader.readAsDataURL(blob);
  });
}

async function shrinkImage(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw fail("That photo format can't be opened here. Try a JPG or PNG (on iPhone, a screenshot works).");
  }
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const g = canvas.getContext("2d");
  g.fillStyle = "#fff"; // transparent PNGs get a white background
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw fail("That photo couldn't be prepared.");
  return blob;
}

// Resolves { name, kind: "image" | "pdf" | "text" | "video", mimeType, data | text, previewUrl }.
// Word, PowerPoint and Excel files become text (with office: their structure).
export async function readAttachment(file) {
  const name = (file.name || "pasted image").slice(0, 80);
  // Videos stay on the device (they're edited here, never uploaded)
  if (file.type.startsWith("video/") || VIDEO_FILE.test(name)) {
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) throw fail(`That video is too big. The limit is ${MAX_VIDEO_MB} MB.`);
    return { name, kind: "video", mimeType: file.type || "video/mp4", file, previewUrl: null };
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw fail(`That file is too big. The limit is ${MAX_FILE_MB} MB.`);
  if (OFFICE_FILE.test(name)) {
    let office;
    try {
      office = await readOfficeFile(file);
    } catch (err) {
      throw fail(`That file couldn't be opened: ${err.message || "it may be damaged"}.`);
    }
    return { name, kind: "text", mimeType: "text/plain", text: office.text, office };
  }
  if (OLD_OFFICE_FILE.test(name)) throw fail("That's an old Office format (.doc, .ppt or .xls). Save it as .docx, .pptx or .xlsx and attach it again.");

  if (file.type.startsWith("image/")) {
    const blob = await shrinkImage(file);
    return { name, kind: "image", mimeType: "image/jpeg", data: await toBase64(blob), previewUrl: URL.createObjectURL(blob) };
  }
  if (file.type === "application/pdf" || /\.pdf$/i.test(name)) {
    return { name, kind: "pdf", mimeType: "application/pdf", data: await toBase64(file) };
  }
  if (file.type.startsWith("text/") || file.type === "application/json" || TEXT_TYPES.test(name)) {
    const text = await file.text();
    if (text.includes("\u0000")) throw fail("That doesn't look like a text file.");
    return { name, kind: "text", mimeType: "text/plain", text };
  }
  throw fail("That file type isn't supported yet. Try a photo, a video, a PDF, a Word, PowerPoint or Excel file, or a text or code file.");
}

// Photos and PDFs need an AI that can see them.
export const needsVision = (att) => att && (att.kind === "image" || att.kind === "pdf");

// A text file's content, added in front of the question.
export function withFileText(att, question) {
  const text = att.text.length > MAX_TEXT_CHARS ? `${att.text.slice(0, MAX_TEXT_CHARS)}\n…(the rest of the file was cut to fit)` : att.text;
  return `The user attached a file named "${att.name}":\n\`\`\`\n${text}\n\`\`\`\n\n${question}`;
}

export function defaultQuestion(att) {
  if (att.kind === "image") return "What's in this picture? Explain it.";
  if (att.kind === "video") return "What can you do with this video?";
  return "Summarise this file.";
}

export const label = (att) => `📎 ${att.name}`;
