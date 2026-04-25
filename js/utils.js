/* =========================
   Numbers & timing
========================= */
/* jshint esversion: 11 */

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function now() {
  return Date.now();
}

export function formatTimer(ms) {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/* =========================
   Arrays
========================= */

export function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickN(array, n) {
  return shuffle(array).slice(0, n);
}

/* =========================
   Strings & safety
========================= */

export function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[s]);
}

// Alias for existing imports
export const esc = escapeHTML;

export function normaliseWord(word) {
  return (word || "").trim().toLowerCase();
}

/* =========================
   Random helpers
========================= */

export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* =========================
   Speech (light wrapper)
========================= */

export function speakWord(word) {
  if (!("speechSynthesis" in window)) return false;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-GB";
  utterance.rate = 0.95;
  utterance.pitch = 1.0;

  window.speechSynthesis.speak(utterance);
  return true;
}