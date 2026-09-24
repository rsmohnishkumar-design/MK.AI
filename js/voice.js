// Voice: speak a question (speech recognition) and hear answers (speech
// synthesis), using the browser's built-in speech features. English and
// Tamil are recognised from what the person last wrote or said.

import { readableMath } from "./format.js";

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = !!Recognition;
export const canSpeak = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

const TAMIL = /[஀-௿]/;
export const languageOf = (text) => (TAMIL.test(text || "") ? "ta-IN" : "en-IN");

// Starts listening. onText(textSoFar, isFinal) is called as words arrive;
// onEnd(finalText) when the person stops talking. Returns a stop function.
export function listen({ lang = "en-IN", onText, onEnd, onError }) {
  const rec = new Recognition();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let finalText = "";
  let failed = false;
  rec.onresult = (e) => {
    let interim = "";
    finalText = "";
    for (const result of e.results) {
      if (result.isFinal) finalText += result[0].transcript;
      else interim += result[0].transcript;
    }
    onText?.((finalText + interim).trim(), !interim);
  };
  rec.onerror = (e) => {
    failed = true;
    onError?.(e.error);
  };
  rec.onend = () => {
    if (!failed) onEnd?.(finalText.trim());
  };
  rec.start();
  return () => {
    try {
      rec.stop();
    } catch {}
  };
}

export function listenErrorMessage(code) {
  if (code === "not-allowed" || code === "service-not-allowed") {
    return "MK.ai can't use the microphone. Allow microphone access for this site in your browser settings, then try again.";
  }
  if (code === "no-speech") return "I didn't hear anything. Tap the mic and speak again.";
  if (code === "network") return "Voice typing needs the internet. Check your connection and try again.";
  if (code === "audio-capture") return "No microphone was found on this device.";
  return "Voice typing stopped. Tap the mic to try again.";
}

// What's worth reading aloud: code and links are described, not spelled out.
export function speakable(text) {
  return readableMath(text)
    .replace(/```[\s\S]*?(```|$)/g, " (the code is shown on screen) ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_#>]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function voiceFor(lang) {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === lang) ||
    voices.find((v) => v.lang?.startsWith(lang.slice(0, 2))) ||
    null
  );
}

// Reads text aloud; onEnd runs when it finishes or is stopped.
export function speak(text, { onEnd } = {}) {
  stopSpeaking();
  const lang = languageOf(text);
  const utterance = new SpeechSynthesisUtterance(speakable(text));
  utterance.lang = lang;
  const voice = voiceFor(lang);
  try {
    if (voice) utterance.voice = voice;
  } catch {} // some browsers only accept their own voice objects
  utterance.rate = 1;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (canSpeak) window.speechSynthesis.cancel();
}
