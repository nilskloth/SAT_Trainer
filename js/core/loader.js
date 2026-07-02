/* =========================================================
   Fetches v2 content from data/content/ in parallel and
   merges any generated bank additions from localStorage
   (additive by id — shipped content always loads first).
   ========================================================= */

import { getStore } from "./store.js";
import { checkBank } from "./schema.js";

let DATA = null;

async function fetchJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

function mergeById(shipped, extra) {
  const seen = new Set(shipped.map(x => x.id));
  extra.forEach(x => {
    if (x && x.id && !seen.has(x.id)) {
      shipped.push(x);
      seen.add(x.id);
    }
  });
}

export async function loadContent() {
  const [reading, gps, maths, spelling, papers] = await Promise.all([
    fetchJSON("data/content/reading.json"),
    fetchJSON("data/content/gps.json"),
    fetchJSON("data/content/maths.json"),
    fetchJSON("data/content/spelling.json"),
    fetchJSON("data/content/papers.json")
  ]);

  const banks = getStore()?.generatedBanks;
  if (banks) {
    if (banks.reading) {
      mergeById(reading.passages, banks.reading.passages || []);
      mergeById(reading.questions, banks.reading.questions || []);
    }
    if (Array.isArray(banks.gps)) mergeById(gps.questions, banks.gps);
    if (Array.isArray(banks.maths)) mergeById(maths.questions, banks.maths);
  }

  ["reading", "gps", "maths"].forEach((name, i) => {
    const problems = checkBank(name, [reading, gps, maths][i]);
    if (problems.length) console.warn(`Content check (${name}):`, problems);
  });

  DATA = { reading, gps, maths, spelling, papers: papers.papers };
  return DATA;
}

export function getData() {
  if (!DATA) throw new Error("Content not loaded yet");
  return DATA;
}
