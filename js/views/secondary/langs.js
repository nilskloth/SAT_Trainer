/* =========================================================
   Secondary languages. A language appears once it has word
   lists: built in (tools/import-vocab.mjs) or uploaded by the
   parent in Grown-ups → Word lists.
   ========================================================= */

import { getStore } from "../../core/store.js";

export const LANGS = {
  de: {
    code: "de", label: "German", native: "Deutsch", voice: "de-DE",
    chapterWord: "Kapitel", strategyWord: "Strategie", subject: "german",
    keys: ["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"]
  },
  fr: {
    code: "fr", label: "French", native: "Français", voice: "fr-FR",
    chapterWord: "Module", strategyWord: "Stratégie", subject: "french",
    keys: ["é", "è", "ê", "à", "â", "ç", "ô", "î", "ï", "ù", "û", "ë", "œ"]
  }
};

const banks = {};

/* A language's bank = its built-in lists (data/content/secondary/<code>.json)
   plus chapters the parent uploaded (data/uploads/<code>.json, written by
   the proxy). An uploaded chapter replaces a built-in one with the same
   number. Either file may be missing; with neither, loading fails. */
export async function loadBank(code) {
  if (!banks[code]) banks[code] = fetchBank(code).catch(err => { delete banks[code]; throw err; });
  return banks[code];
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

async function fetchBank(code) {
  const [built, uploaded] = await Promise.all([
    fetchJson(`data/content/secondary/${code}.json`),
    fetchJson(`data/uploads/${code}.json`).catch(() => null)
  ]);
  const byNumber = new Map();
  for (const ch of built?.chapters || []) byNumber.set(ch.number, ch);
  for (const ch of uploaded?.chapters || []) byNumber.set(ch.number, ch);
  const chapters = [...byNumber.values()].sort((a, b) => a.number - b.number);
  if (!chapters.length) throw new Error(`No ${LANGS[code].label} word lists yet`);
  return { language: code, label: LANGS[code].label, chapters };
}

/* After publishing or removing an upload. */
export function forgetBank(code) {
  delete banks[code];
}

/* Languages with at least one chapter, built-in or uploaded. */
export async function availableLangs() {
  const out = [];
  for (const lang of Object.values(LANGS)) {
    try { await loadBank(lang.code); out.push(lang); } catch { /* none yet */ }
  }
  return out;
}

/* Per-language progress: { stats: { "<itemId>|<dir>": adaptive stat }, prefs: {…} } */
export function vocabState(code) {
  const v = getStore().vocab;
  if (!v[code]) v[code] = { stats: {}, prefs: {} };
  return v[code];
}

/* An item counts as "known" once either direction reaches 80 % mastery. */
export function isKnown(code, itemId) {
  const s = vocabState(code).stats;
  return ["to-en", "to-target", "listen", "listen-en", "listen-target"].some(d => (s[`${itemId}|${d}`]?.mastery || 0) >= 0.8);
}
