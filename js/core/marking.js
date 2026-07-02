/* =========================================================
   Marking engine. DOM-free by design so tools/test-marking.mjs
   can exercise it in Node.

   mark(question, answer) — synchronous, deterministic:
     → { status: "marked", earned, possible }
     → { status: "needs-ai", possible }   (free-text types)

   Answer input conventions (what the UI collects):
     mcq            string (chosen choice)
     tick2          string[2]
     truefalse      boolean[] (per statement)
     factopin       ("fact"|"opinion")[] (per statement)
     match          number[] (right-index per left)
     order          number[] (position entered per item)
     circle2        string[] (chosen option per group)
     short-closed   string
     numeric        string
     multi          string ("a, b, c") or string[]
     pairs          [number, number]
     tokens         number[] (selected word indices)
     roles          number[][] (selected indices per part)
     spelling       string
     prefix         string (chosen prefix)
   ========================================================= */

import { normaliseText, normaliseNumeric } from "./utils.js";

/* Ported from v1 algebra.js — named constraint checks for two-unknown answers. */
const okInt = v => Number.isInteger(v) && v > 0;

export const PAIR_VALIDATORS = {
  "sum10_agtb":    (a, b) => okInt(a) && okInt(b) && a + b === 10 && a > b,
  "diff6_xlt20":   (x, y) => okInt(x) && okInt(y) && x - y === 6 && x < 20,
  "2a_plus_b_11":  (a, b) => okInt(a) && okInt(b) && 2 * a + b === 11,
  "prod12_pos":    (m, n) => okInt(m) && okInt(n) && m * n === 12,
  "3a_plus_2b_16": (a, b) => okInt(a) && okInt(b) && 3 * a + 2 * b === 16,
  "sum15_plt_q":   (p, q) => okInt(p) && okInt(q) && p + q === 15 && p < q
};

/* Algebra-style normalisation: lowercase, no spaces, unified operators.
   Lets "3n + 2" match "3n+2" and "×" match "*". */
function normaliseExpr(str) {
  return String(str ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/−/g, "-")
    .replace(/×/g, "*")
    .replace(/÷/g, "/");
}

function textEquals(given, target) {
  return normaliseText(given) === normaliseText(target) ||
         normaliseExpr(given) === normaliseExpr(target);
}

function numericEquals(given, target) {
  const g = normaliseNumeric(given);
  const t = normaliseNumeric(target);
  if (g === t) return true;
  const gn = Number(g);
  const tn = Number(t);
  return Number.isFinite(gn) && Number.isFinite(tn) && gn === tn;
}

const all = n => Array.from({ length: n });

const MARKERS = {
  mcq: (q, a) => a === q.answer,

  tick2: (q, a) => {
    if (!Array.isArray(a) || a.length !== 2) return false;
    const want = q.answers.slice().sort();
    const got = a.slice().sort();
    return want.every((w, i) => w === got[i]);
  },

  truefalse: (q, a) =>
    Array.isArray(a) && q.statements.every((s, i) => a[i] === s.answer),

  factopin: (q, a) =>
    Array.isArray(a) && q.statements.every((s, i) => a[i] === (s.fact ? "fact" : "opinion")),

  match: (q, a) =>
    Array.isArray(a) && q.correct.every((c, i) => a[i] === c),

  order: (q, a) =>
    Array.isArray(a) && q.order.every((o, i) => Number(a?.[i]) === o),

  "short-closed": (q, a) => q.accept.some(acc => textEquals(a, acc)),

  numeric: (q, a) => numericEquals(a, q.answer),

  multi: (q, a) => {
    const parts = Array.isArray(a)
      ? a.map(String)
      : String(a ?? "").split(",");
    if (parts.length !== q.answers.length) return false;
    return q.answers.every((ans, i) => numericEquals(parts[i], ans) || textEquals(parts[i], ans));
  },

  pairs: (q, a) => {
    const fn = PAIR_VALIDATORS[q.validator];
    if (!fn || !Array.isArray(a)) return false;
    const nums = a.map(v => Number(normaliseNumeric(v)));
    return fn(...nums);
  },

  tokens: (q, a) => {
    if (!Array.isArray(a)) return false;
    const want = new Set(q.tokenIndices.map(Number));
    const got = new Set(a.map(Number));
    return want.size === got.size && [...want].every(i => got.has(i));
  },

  spelling: (q, a) =>
    normaliseText(a) === normaliseText(q.word),

  prefix: (q, a) => a === q.prefix
};

/* Types with per-part credit rather than all-or-nothing. */
const PARTIAL = {
  circle2(q, a) {
    const hits = q.groups.filter((g, i) => Array.isArray(a) && a[i] === g.answer).length;
    return Math.round(q.marks * (hits / q.groups.length));
  },

  roles(q, a) {
    const hits = q.parts.filter((part, i) => {
      const want = new Set(part.answer.map(Number));
      const got = new Set((Array.isArray(a) && Array.isArray(a[i]) ? a[i] : []).map(Number));
      return want.size === got.size && [...want].every(x => got.has(x));
    }).length;
    return Math.round(q.marks * (hits / q.parts.length));
  }
};

const AI_TYPES = new Set(["short", "multishort", "open"]);

export function mark(q, answer) {
  const possible = q.marks;

  if (AI_TYPES.has(q.type)) return { status: "needs-ai", possible };

  if (PARTIAL[q.type]) {
    const earned = PARTIAL[q.type](q, answer);
    return { status: "marked", earned, possible };
  }

  const fn = MARKERS[q.type];
  if (!fn) throw new Error(`No marker for question type "${q.type}"`);
  return { status: "marked", earned: fn(q, answer) ? possible : 0, possible };
}

/* Marks from a self-marking checklist: the child ticked `tickedCount`
   acceptable points; award per the scheme, capped at question marks. */
export function marksFromSelfTicks(q, tickedCount) {
  return Math.min(q.marks, Math.max(0, Math.floor(tickedCount)));
}
