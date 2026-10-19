/* =========================================================
   Secondary languages. Adding one = import its word lists
   (tools/import-vocab.mjs) and set available: true here.
   ========================================================= */

import { getStore } from "../../core/store.js";

export const LANGS = {
  de: {
    code: "de", label: "German", native: "Deutsch", voice: "de-DE",
    chapterWord: "Kapitel", strategyWord: "Strategie", subject: "german",
    keys: ["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"],
    available: true
  },
  fr: {
    code: "fr", label: "French", native: "Français", voice: "fr-FR",
    chapterWord: "Module", strategyWord: "Stratégie", subject: "french",
    keys: ["é", "è", "ê", "à", "â", "ç", "ô", "î", "ï", "ù", "û", "ë", "œ"],
    available: false
  }
};

const banks = {};

export async function loadBank(code) {
  if (!banks[code]) {
    const res = await fetch(`data/content/secondary/${code}.json`, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${code}.json: HTTP ${res.status}`);
    banks[code] = await res.json();
  }
  return banks[code];
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
