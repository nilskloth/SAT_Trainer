/* Shared helpers (ported from v1 utils + marking normalisers). */

export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickN(arr, n) {
  return shuffle(arr).slice(0, n);
}

export function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Lowercase, strip punctuation, collapse whitespace — for text answers. */
export function normaliseText(str) {
  return String(str ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* Strip commas/spaces, unify unicode minus — for numeric answers. */
export function normaliseNumeric(str) {
  return String(str ?? "")
    .replace(/,/g, "")
    .replace(/−/g, "-")
    .replace(/\s+/g, "")
    .trim();
}

export function tokenise(str) {
  return normaliseText(str).split(" ").filter(Boolean);
}
