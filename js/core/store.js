/* =========================================================
   v2 state — localStorage key ks2_sats_v2.
   On first boot, imports what it can from the v1 keys
   (ks2_sats_runner_v1) without touching them, so the old
   site keeps working until switchover.
   ========================================================= */

const KEY = "ks2_sats_v2";
const V1_KEY = "ks2_sats_runner_v1";

let store = null;

function defaultStore() {
  return {
    version: 2,
    settings: {
      proxyToken: "",
      dailyMinutes: 15,
      examDate: "2027-05-11"
    },
    attempts: [],        // { id, ts, mode, paperId?, seconds, items:[{qid, domain, subject, marks, earned, marking}] }
    domainStats: {},     // "reading.2d" -> { attempts, marksSeen, marksEarned, ewma, lastSeen }
    spelling: { wordsByWord: {} },
    generatedBanks: { reading: { passages: [], questions: [] }, gps: [], maths: [] }
  };
}

function importFromV1(fresh) {
  let v1;
  try {
    v1 = JSON.parse(localStorage.getItem(V1_KEY) || "null");
  } catch {
    return fresh;
  }
  if (!v1 || typeof v1 !== "object") return fresh;

  const words = v1.progress?.spelling?.wordsByWord;
  if (words && typeof words === "object") {
    fresh.spelling.wordsByWord = words; // adaptive history carries over verbatim
  }

  const paperAttempts = v1.progress?.paperAttempts;
  if (Array.isArray(paperAttempts)) {
    fresh.attempts = paperAttempts.map((a, i) => ({
      id: `v1-${i}`,
      ts: a.timestamp || 0,
      mode: "paper",
      paperId: a.paperId,
      seconds: a.seconds || 0,
      legacy: true,        // no per-domain detail available from v1
      score: a.score,
      total: a.total,
      items: []
    }));
  }
  return fresh;
}

export function initStore() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    raw = null;
  }
  if (raw && raw.version === 2) {
    store = raw;
  } else {
    store = importFromV1(defaultStore());
    saveStore();
  }
  return store;
}

export function getStore() {
  return store;
}

export function saveStore() {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function resetStore() {
  store = defaultStore();
  saveStore();
  return store;
}

/* Record a finished run and fold each item into per-domain stats.
   items: [{ qid, domain, subject, marks, earned, marking }] */
const EWMA_ALPHA = 0.3;

export function recordAttempt({ mode, paperId, seconds, items }) {
  const attempt = {
    id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    mode, paperId, seconds, items
  };
  store.attempts.push(attempt);

  items.forEach(it => {
    const key = `${it.subject}.${it.domain}`;
    const d = store.domainStats[key] ||
      (store.domainStats[key] = { attempts: 0, marksSeen: 0, marksEarned: 0, ewma: null, lastSeen: 0 });
    d.attempts += 1;
    d.marksSeen += it.marks;
    d.marksEarned += it.earned;
    const score = it.marks ? it.earned / it.marks : 0;
    d.ewma = d.ewma == null ? score : EWMA_ALPHA * score + (1 - EWMA_ALPHA) * d.ewma;
    d.lastSeen = attempt.ts;
  });

  saveStore();
  return attempt;
}
