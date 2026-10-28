/* =========================================================
   Usage monitor — the child's side. Counts active time per
   activity (the screen in use) and tallies answers, then sends
   small records to the proxy (op activity-log) for Grown-ups →
   Activity. Only timings, activity names and scores leave the
   device — never typed answers or words.

   Three measures of time per session:
     length  first to last activity (start → end), breaks included
     open    the page is on screen (visible), until 15 min without input
     active  learning time: on screen and touched, typed or scrolled
             in the last 90 s
   A gap of 15 min starts a new session. Grown-ups and the start
   screen don't count.
   Records wait in localStorage (ks2_activity) until the shared
   key is set and the server answers; a session is re-sent as it
   grows (the server keeps the newest copy).
   ========================================================= */

import { getStore } from "./store.js";

const KEY = "ks2_activity";
const TICK_MS = 5000;
const IDLE_MS = 90 * 1000;
const SESSION_GAP_MS = 15 * 60 * 1000;
const SEND_EVERY_MS = 60 * 1000;
const MAX_OUTBOX = 2000;
const PROXY_URL = "api/proxy.php";

/* Areas, in the fixed order the dashboard colours them. */
export const AREAS = {
  reading: "Reading", gps: "Grammar & punctuation", maths: "Maths", spelling: "Spelling",
  german: "German", french: "French", menus: "Menus"
};

const PAPERS = {
  reading: ["reading", "Reading paper"], gps1: ["gps", "Grammar paper"], gps2: ["spelling", "Spelling paper"],
  maths1: ["maths", "Arithmetic paper"], maths2: ["maths", "Reasoning paper 2"], maths3: ["maths", "Reasoning paper 3"]
};
const LANG_AREA = { de: ["german", "German"], fr: ["french", "French"] };

/* Route → [area, activity label], or null when it shouldn't count. */
export function activityFor(hash) {
  const [path, ...p] = String(hash).replace(/^#\/?/, "").split("/").filter(Boolean);
  if (!path || path === "start" || path === "grown-ups") return null;
  if (path === "home") return ["menus", "SATs home"];
  if (path === "papers") {
    if (!p[0]) return ["menus", "Papers menu"];
    const [area, label] = PAPERS[p[0]] || ["menus", "Paper"];
    return [area, label];
  }
  if (path === "practice") {
    if (!p[0]) return ["menus", "Practice menu"];
    if (p[0] === "today") return ["menus", "Today's practice"];
    if (p[0] === "spelling") return ["spelling", "Spelling trainer"];
    if (p[0] === "division") return ["maths", "Short division"];
    if (p[0] === "prefixes") return ["gps", "Prefixes"];
    if (p[0] === "gps") return ["gps", "Grammar practice"];
    if (p[0] === "maths" && p[1] === "arithmetic") return ["maths", "Arithmetic drill"];
    if (AREAS[p[0]]) return [p[0], `${AREAS[p[0]]} practice`];
    return ["menus", "Practice"];
  }
  if (path === "secondary") {
    const lang = LANG_AREA[p[0]];
    if (!lang) return ["menus", "Languages menu"];
    if (p[1] === "verbs") return [lang[0], `${lang[1]} verbs`];
    if (p[1] === "list") return [lang[0], `${lang[1]} word lists`];
    return [lang[0], `${lang[1]} vocabulary`];
  }
  return null;
}

/* Area of a recorded run, from its items' subject. */
const areaOfSubject = s => (AREAS[s] ? s : "menus");

let state = null;          // { dev, session, outbox: { id: record } }
let lastInput = 0;
let lastSent = 0;
let sending = false;

function load() {
  try { state = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { state = null; }
  if (!state || typeof state !== "object") state = {};
  if (!state.dev) state.dev = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  if (!state.outbox) state.outbox = {};
}

function save() {
  const ids = Object.keys(state.outbox);
  if (ids.length > MAX_OUTBOX) ids.slice(0, ids.length - MAX_OUTBOX).forEach(id => delete state.outbox[id]);
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* full or blocked: keep counting in memory */ }
}

function deviceName() {
  const ua = navigator.userAgent;
  if (/iPad|Macintosh.*Mobile/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPad";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "Android phone" : "Android tablet";
  if (/CrOS/.test(ua)) return "Chromebook";
  if (/Windows/.test(ua)) return "Windows";
  if (/Macintosh/.test(ua)) return "Mac";
  return "Browser";
}

/* The open session, starting a new one after a long gap. */
function currentSession(now) {
  let s = state.session;
  if (!s || now - s.end > SESSION_GAP_MS) {
    s = state.session = {
      kind: "session", id: `s-${state.dev}-${now.toString(36)}`, dev: deviceName(),
      start: now, end: now, active: 0, open: 0, parts: {}, tally: {}
    };
  }
  return s;
}

function queue(record) {
  state.outbox[record.id] = { ...record, parts: record.parts && { ...record.parts }, tally: record.tally && { ...record.tally } };
}

function tick() {
  const now = Date.now();
  if (now - lastSent > SEND_EVERY_MS) send();
  const act = activityFor(location.hash);
  if (document.visibilityState !== "visible" || !act) return;
  const secs = TICK_MS / 1000;
  if (now - lastInput > IDLE_MS) {
    /* on screen but idle: open time only, within the session */
    const s = state.session;
    if (!s || now - lastInput > SESSION_GAP_MS || now - s.end > SESSION_GAP_MS) return;
    s.open = (s.open || 0) + secs;
    queue(s);
    save();
    return;
  }
  const s = currentSession(now);
  const key = `${act[0]}|${act[1]}`;
  s.parts[key] = (s.parts[key] || 0) + secs;
  s.active += secs;
  s.open = (s.open || 0) + secs;
  s.end = now;
  queue(s);
  save();
}

/* Post the outbox; on success drop what was sent (unless it changed since). */
async function send({ leaving = false } = {}) {
  const token = getStore()?.settings?.proxyToken;
  const records = Object.values(state.outbox).slice(0, 200);
  if (!token || !records.length || (sending && !leaving)) return;
  sending = true;
  lastSent = Date.now();
  const sent = JSON.stringify(records);
  try {
    const res = await fetch(PROXY_URL, {
      method: "POST", keepalive: leaving,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, op: "activity-log", payload: { records } })
    });
    const body = await res.json();
    if (body.ok) {
      const before = JSON.parse(sent);
      before.forEach(r => {
        if (JSON.stringify(state.outbox[r.id]) === JSON.stringify(r)) delete state.outbox[r.id];
      });
      save();
    }
  } catch { /* offline — try again later */ } finally {
    sending = false;
  }
}

/* A finished run (recordAttempt): tally its marks and log it by name. */
export function noteAttempt({ mode, paperId, items }) {
  if (!state || !items?.length) return;
  const now = Date.now();
  const s = currentSession(now);
  const byArea = {};
  items.forEach(it => {
    const a = areaOfSubject(it.subject);
    const t = byArea[a] || (byArea[a] = [0, 0]);
    t[0] += it.marks || 0;
    t[1] += it.earned || 0;
  });
  Object.entries(byArea).forEach(([a, [n, ok]]) => {
    const t = s.tally[a] || [0, 0];
    s.tally[a] = [t[0] + n, t[1] + ok];
  });
  queue(s);
  const area = Object.keys(byArea)[0];
  const act = activityFor(location.hash);
  queue({
    kind: "result", id: `r-${state.dev}-${now.toString(36)}`, ts: now, area,
    mode: String(mode || ""), label: resultLabel(mode, paperId, area, act),
    earned: Object.values(byArea).reduce((x, t) => x + t[1], 0),
    marks: Object.values(byArea).reduce((x, t) => x + t[0], 0)
  });
  save();
}

function resultLabel(mode, paperId, area, act) {
  if (mode === "paper") return PAPERS[paperId]?.[1] || "Paper";
  if (mode === "vocab-test") return `${AREAS[area]} vocabulary test`;
  if (mode === "vocab-practise") return `${AREAS[area]} vocabulary practice`;
  if (mode === "verbs") return `${AREAS[area]} verbs`;
  return act && act[0] === area ? act[1] : `${AREAS[area]} practice`;
}

/* One answer outside a recorded run (the spelling trainer). */
export function noteAnswer(area, ok) {
  if (!state) return;
  const s = currentSession(Date.now());
  const t = s.tally[area] || [0, 0];
  s.tally[area] = [t[0] + 1, t[1] + (ok ? 1 : 0)];
  queue(s);
  save();
}

/* Pending records on this device (for Grown-ups). */
export function pendingCount() {
  return state ? Object.keys(state.outbox).length : 0;
}

export function startActivity() {
  load();
  lastInput = Date.now();
  const touch = () => { lastInput = Date.now(); };
  ["pointerdown", "keydown", "scroll", "touchstart", "input"].forEach(ev =>
    window.addEventListener(ev, touch, { passive: true, capture: true }));
  setInterval(tick, TICK_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") send({ leaving: true });
    else touch();
  });
  window.addEventListener("pagehide", () => send({ leaving: true }));
  send();
}
