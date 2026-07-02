/* =========================
   Data loader (ES module)
========================= */
/* jshint esversion: 11 */

/* =========================
   JSON loader helper
========================= */

async function loadJSON(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path} (${response.status})`);
  }
  return response.json();
}

/* =========================
   Validation
========================= */

function validateData(data) {
  if (!data.papers || !data.papers.runs) {
    throw new Error("papers.json missing or malformed");
  }

  if (!Array.isArray(data.banks.reading)) {
    throw new Error("reading bank missing or invalid");
  }

  if (!Array.isArray(data.banks.spag)) {
    throw new Error("spag bank missing or invalid");
  }

  if (!Array.isArray(data.banks.reasoning)) {
    throw new Error("reasoning bank missing or invalid");
  }

  // spelling validation
  if (!data.spelling || !data.spelling.lists) {
    throw new Error("spelling.json missing or malformed");
  }

  if (!data.spelling.lists.statutory) {
    throw new Error("statutory spelling list missing");
  }

  if (!data.spelling.lists.supplementary) {
    throw new Error("supplementary spelling list missing");
  }

  Object.values(data.spelling.lists).forEach(list => {
    if (!Array.isArray(list.words)) {
      throw new Error(`Invalid spelling list: ${list.id}`);
    }

    list.words.forEach(w => {
      if (!w.word || typeof w.word !== "string") {
        throw new Error(`Invalid spelling word entry in ${list.id}`);
      }
      if (w.sentences && !Array.isArray(w.sentences)) {
        throw new Error(`Invalid sentences for word: ${w.word}`);
      }
    });
  });
}

/* =========================
   Load all app data
========================= */


export async function loadAllData() {
  const [
    papers,
    reading,
    spag,
    grammar,
    bankReasoning,
    spellingRaw,
    prefixes,
    algebra,
    reasoning,
    readingTraining
  ] = await Promise.all([
    loadJSON("data/papers.json"),
    loadJSON("data/banks/reading.json"),
    loadJSON("data/banks/spag.json"),
    loadJSON("data/banks/grammar.json"),
    loadJSON("data/banks/reasoning.json"),
    loadJSON("data/training/spelling.json"),
    loadJSON("data/training/prefixes.json"),
    loadJSON("data/training/algebra.json"),
    loadJSON("data/training/reasoning.json"),
    loadJSON("data/training/reading.json")
  ]);

  // 🔑 UNWRAP HERE
  const spelling =
    spellingRaw && spellingRaw.spelling ?
      spellingRaw.spelling
      : spellingRaw;

  const banks = {
    reading,
    spag,
    grammar,
    reasoning: bankReasoning
  };

  // Keep a pristine copy so the Banks tab can offer a clean "Reset".
  window.DATA_BANKS_ORIGINAL = JSON.parse(JSON.stringify(banks));
  applyBanksOverride(banks);

  const data = {
    papers,
    banks,
    spelling,
    prefixes,
    algebra,
    reasoning,
    reading: readingTraining
  };

  validateData(data);
  return data;
}

/* =========================
   Banks override (from the Question Banks tab)
========================= */

export const BANKS_OVERRIDE_KEY = "ks2_banks_override_v1";

function applyBanksOverride(banks) {
  let override;
  try {
    override = JSON.parse(localStorage.getItem(BANKS_OVERRIDE_KEY) || "null");
  } catch (err) {
    console.warn("Ignoring malformed banks override:", err);
    return;
  }
  if (!override || typeof override !== "object") return;

  // Only replace a bank when the override supplies a valid array for it.
  ["reading", "spag", "grammar", "reasoning"].forEach(key => {
    if (Array.isArray(override[key])) banks[key] = override[key];
  });
}