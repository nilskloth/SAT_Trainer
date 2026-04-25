/* =========================
   Store configuration
========================= */
/* jshint esversion: 11 */

const STORE_KEY = "ks2_sats_runner_v1";
let STORE = null;

/* =========================
   Defaults
========================= */

function defaultStore() {
  return {
    settings: {
      defaultTiming: "untimed"
    },

    progress: {
      overallAttempts: 0,
      paperAttempts: [],
      spelling: {
        poolChoice: "both",
        mode: "flash",
        flashSeconds: 3,
        dictation: {
          enabled: false,
          lastSentenceIndexByWord: {}
        },
        wordsByWord: {}
      }
    }
  };
}

/* =========================
   Load / Save
========================= */

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultStore();

    const parsed = JSON.parse(raw);

    // forward compatibility
    if (!parsed.progress.spelling.dictation) {
      parsed.progress.spelling.dictation = {
        enabled: false,
        lastSentenceIndexByWord: {}
      };
    }

    return parsed;
  } catch (err) {
    console.warn("Failed to load store, resetting:", err);
    return defaultStore();
  }
}

export function saveStore() {
  if (!STORE) return;
  localStorage.setItem(STORE_KEY, JSON.stringify(STORE));
}

/* =========================
   Init
========================= */

export function initStore() {
  STORE = loadStore();
  saveStore();
}

/* =========================
   Getters
========================= */

export function getStore() {
  return STORE;
}

export function getSettings() {
  return STORE.settings;
}

export function getProgress() {
  return STORE.progress;
}

/* =========================
   Mutators
========================= */

function incrementOverallAttempts() {
  STORE.progress.overallAttempts += 1;
}

export function addPaperAttempt({ paperId, score, total, seconds }) {
  STORE.progress.paperAttempts.push({
    paperId,
    score,
    total,
    seconds,
    timestamp: Date.now()
  });

  incrementOverallAttempts();
  saveStore();
}

export function resetAllProgress() {
  STORE.progress = defaultStore().progress;
  saveStore();
}

/* =========================
   Spelling helpers
========================= */



export function getSpellingState() {
  return STORE.progress.spelling;
}

export function ensureSpellingWord(word) {
  const map = STORE.progress.spelling.wordsByWord;
  if (!map[word]) {
    map[word] = {
      word,
      attempts: 0,
      correct: 0,
      wrong: 0,
      mastery: 0.25,
      wrongStreak: 0,
      lastResult: "—",
      lastSeenAt: 0
    };
  }
  return map[word];
}

export function ensureSpellingWords(words) {
  const spelling = STORE.progress.spelling;
  const map = spelling.wordsByWord;

  words.forEach(word => {
    if (!map[word]) {
      map[word] = {
        word,
        attempts: 0,
        correct: 0,
        wrong: 0,
        mastery: 0.25,
        wrongStreak: 0,
        lastSeenAt: 0,
        lastResult: "—"
      };
    }
  });
}
/* =========================
   Dictation helpers
========================= */

export function getDictationState() {
  return STORE.progress.spelling.dictation;
}

export function getNextDictationSentenceIndex(word, max) {
  const dictation = STORE.progress.spelling.dictation;
  const current = dictation.lastSentenceIndexByWord[word] || 0;
  const next = (current + 1) % max;
  dictation.lastSentenceIndexByWord[word] = next;
  saveStore();
  return next;
}