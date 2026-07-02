/* =========================
   Content validators for the KS2 SATs data files.
   Pure Node, no dependencies. Encodes the guardrails from CLAUDE.md so
   generated (or hand-edited) content can't ship with structural mistakes.
   Each validator returns { errors: [], warnings: [] }.
========================= */

import fs from "node:fs";

export const REASONING_STRANDS = [
  "large_numbers", "place_value", "ordering", "rounding", "negative", "roman"
];

const READING_TYPES = new Set([
  "short", "multishort", "mcq", "tick2", "open",
  "order", "truefalse", "factopin", "match", "circle2"
]);
const AUTO_MARKABLE = new Set([
  "short", "multishort", "mcq", "tick2", "truefalse", "factopin", "order", "match", "circle2"
]);

function newResult() { return { errors: [], warnings: [] }; }
const isStr = v => typeof v === "string" && v.length > 0;
const isArr = Array.isArray;

/* ---------- reading ---------- */

export function validateReading(data) {
  const r = newResult();
  if (!data || !isArr(data.tests)) {
    r.errors.push("reading: expected { tests: [...] }");
    return r;
  }

  const ids = new Set();
  data.tests.forEach((t, ti) => {
    const where = `tests[${ti}]${t && t.id ? ` (${t.id})` : ""}`;
    if (!t || typeof t !== "object") { r.errors.push(`${where}: not an object`); return; }
    ["id", "set", "title", "genre", "passage"].forEach(k => {
      if (!isStr(t[k])) r.errors.push(`${where}: missing/empty "${k}"`);
    });
    if (typeof t.testNumber !== "number") r.errors.push(`${where}: testNumber must be a number`);
    if (typeof t.minutes !== "number") r.errors.push(`${where}: minutes must be a number`);
    if (t.id) {
      if (ids.has(t.id)) r.errors.push(`${where}: duplicate test id "${t.id}"`);
      ids.add(t.id);
    }
    if (!isArr(t.questions) || !t.questions.length) {
      r.errors.push(`${where}: needs a non-empty questions array`);
      return;
    }

    let marksSum = 0;
    const qids = new Set();
    t.questions.forEach((q, qi) => {
      const qw = `${where}.questions[${qi}]${q && q.id ? ` (${q.id})` : ""}`;
      if (!q || typeof q !== "object") { r.errors.push(`${qw}: not an object`); return; }
      if (!READING_TYPES.has(q.type)) { r.errors.push(`${qw}: unknown type "${q.type}"`); return; }
      if (typeof q.marks !== "number" || q.marks < 1) r.errors.push(`${qw}: marks must be a positive number`);
      else marksSum += q.marks;
      if (!isStr(q.stem)) r.errors.push(`${qw}: missing/empty stem`);
      if (q.id) {
        if (qids.has(q.id)) r.errors.push(`${qw}: duplicate question id "${q.id}"`);
        qids.add(q.id);
      }
      if (!AUTO_MARKABLE.has(q.type)) {
        r.warnings.push(`${qw}: type "${q.type}" cannot be auto-marked (needs AI/manual marking)`);
      }
      validateReadingQuestion(q, qw, r);
    });

    if (typeof t.totalMarks === "number" && t.totalMarks !== marksSum) {
      r.warnings.push(`${where}: totalMarks (${t.totalMarks}) != sum of question marks (${marksSum})`);
    }
  });
  return r;
}

function validateReadingQuestion(q, qw, r) {
  switch (q.type) {
    case "short":
      if (!isArr(q.accept) || !q.accept.length) r.errors.push(`${qw}: short needs a non-empty "accept" array`);
      break;
    case "multishort":
      if (!isArr(q.accept) || !q.accept.length) r.errors.push(`${qw}: multishort needs a non-empty "accept" array`);
      break;
    case "mcq":
      if (!isArr(q.choices) || q.choices.length < 2) r.errors.push(`${qw}: mcq needs >=2 choices`);
      else if (!q.choices.includes(q.answer)) r.errors.push(`${qw}: mcq answer not among choices`);
      break;
    case "tick2":
      if (!isArr(q.choices) || q.choices.length < 3) r.errors.push(`${qw}: tick2 needs >=3 choices`);
      if (!isArr(q.answers) || q.answers.length !== 2) r.errors.push(`${qw}: tick2 needs exactly 2 answers`);
      else if (isArr(q.choices) && !q.answers.every(a => q.choices.includes(a)))
        r.errors.push(`${qw}: tick2 answers must all be among choices`);
      break;
    case "truefalse":
      if (!isArr(q.statements) || !q.statements.length) r.errors.push(`${qw}: truefalse needs statements`);
      else q.statements.forEach((s, i) => {
        if (!isStr(s.text)) r.errors.push(`${qw}.statements[${i}]: missing text`);
        if (typeof s.answer !== "boolean") r.errors.push(`${qw}.statements[${i}]: answer must be true/false`);
      });
      break;
    case "factopin":
      if (!isArr(q.statements) || !q.statements.length) r.errors.push(`${qw}: factopin needs statements`);
      else q.statements.forEach((s, i) => {
        if (!isStr(s.text)) r.errors.push(`${qw}.statements[${i}]: missing text`);
        if (typeof s.fact !== "boolean") r.errors.push(`${qw}.statements[${i}]: fact must be true/false`);
      });
      break;
    // order / match / circle2: structural checks left light — hand-authored, rarely generated
  }
}

/* ---------- reasoning ---------- */

export function validateReasoning(data) {
  const r = newResult();
  const list = isArr(data) ? data : (data && data.questions);
  if (!isArr(list)) { r.errors.push("reasoning: expected { questions: [...] }"); return r; }

  const ids = new Set();
  list.forEach((q, i) => {
    const w = `questions[${i}]${q && q.id ? ` (${q.id})` : ""}`;
    if (!q || typeof q !== "object") { r.errors.push(`${w}: not an object`); return; }
    if (!isStr(q.id)) r.errors.push(`${w}: missing id`);
    else { if (ids.has(q.id)) r.errors.push(`${w}: duplicate id`); ids.add(q.id); }
    if (!REASONING_STRANDS.includes(q.strand))
      r.errors.push(`${w}: strand "${q.strand}" not in ${REASONING_STRANDS.join("|")}`);
    if (q.type !== "short") r.warnings.push(`${w}: type "${q.type}" (only "short" is supported by the runner)`);
    if (!isStr(q.stem)) r.errors.push(`${w}: missing stem`);
    if (q.answer === undefined || q.answer === null || String(q.answer).trim() === "")
      r.errors.push(`${w}: missing answer`);
    if (!isStr(q.solution)) r.warnings.push(`${w}: missing solution (shown after Check)`);
  });
  return r;
}

/* ---------- grammar (token-index guardrail) ---------- */

export function validateGrammar(data) {
  const r = newResult();
  const g = data && data.grammar ? data.grammar : data;
  const topics = g && isArr(g.topics) ? g.topics : (isArr(g) ? g : null);
  if (!isArr(topics)) { r.errors.push("grammar: expected { grammar: { topics: [...] } }"); return r; }

  const inRange = (words, idx) => Number.isInteger(idx) && idx >= 0 && idx < words.length;

  topics.forEach((t, ti) => {
    const tw = `topics[${ti}]${t && t.id ? ` (${t.id})` : ""}`;
    if (!isStr(t.id)) r.errors.push(`${tw}: missing id`);
    if (!isStr(t.label)) r.errors.push(`${tw}: missing label`);

    (isArr(t.examples) ? t.examples : []).forEach((ex, ei) => {
      const ew = `${tw}.examples[${ei}]`;
      if (!isStr(ex.sentence)) { r.errors.push(`${ew}: missing sentence`); return; }
      const words = ex.sentence.split(" ");
      (isArr(ex.highlight) ? ex.highlight : []).forEach(idx => {
        if (!inRange(words, idx)) r.errors.push(`${ew}: highlight index ${idx} out of range (0..${words.length - 1})`);
      });
    });

    if (!isArr(t.questions) || !t.questions.length) { r.errors.push(`${tw}: no questions`); return; }
    t.questions.forEach((q, qi) => {
      const qw = `${tw}.questions[${qi}]`;
      if (!isStr(q.sentence)) { r.errors.push(`${qw}: missing sentence`); return; }
      const words = q.sentence.split(" ");

      // "roles" questions (active/passive voice) carry a parts[] list instead
      // of a single task + answer index array.
      if (q.type === "roles") {
        if (!isArr(q.parts) || !q.parts.length) { r.errors.push(`${qw}: roles question needs a non-empty parts array`); return; }
        q.parts.forEach((p, pi) => {
          const pw = `${qw}.parts[${pi}]`;
          if (!isStr(p.label)) r.errors.push(`${pw}: missing label`);
          if (!isArr(p.answer) || !p.answer.length) { r.errors.push(`${pw}: answer must be a non-empty index array`); return; }
          p.answer.forEach(idx => {
            if (!inRange(words, idx))
              r.errors.push(`${pw}: answer index ${idx} out of range (0..${words.length - 1}) for "${q.sentence}"`);
          });
        });
        return;
      }

      if (!isStr(q.task)) r.errors.push(`${qw}: missing task`);
      if (!isArr(q.answer) || !q.answer.length) { r.errors.push(`${qw}: answer must be a non-empty index array`); return; }
      q.answer.forEach(idx => {
        if (!inRange(words, idx))
          r.errors.push(`${qw}: answer index ${idx} out of range (0..${words.length - 1}) for "${q.sentence}"`);
      });
    });
  });
  return r;
}

/* ---------- prefixes (distractor guardrail) ---------- */

let DICT = null;
function loadDict() {
  if (DICT !== null) return DICT;
  DICT = new Set();
  for (const p of ["/usr/share/dict/words", "/usr/dict/words"]) {
    try {
      const words = fs.readFileSync(p, "utf8").split("\n");
      for (const w of words) if (w) DICT.add(w.trim().toLowerCase());
      break;
    } catch { /* not present */ }
  }
  return DICT;
}

export function validatePrefixes(data) {
  const r = newResult();
  if (!data || (!isArr(data.wordPairs) && !isArr(data.sentences))) {
    r.errors.push("prefixes: expected { wordPairs: [...], sentences: [...] }");
    return r;
  }
  const dict = loadDict();
  const haveDict = dict.size > 0;
  if (!haveDict) r.warnings.push("no system dictionary found — distractor word-check skipped (verify prefixes manually)");

  const checkOptions = (item, w) => {
    if (!isStr(item.root)) r.errors.push(`${w}: missing root`);
    if (!isStr(item.prefix)) r.errors.push(`${w}: missing prefix`);
    if (!isArr(item.options) || item.options.length < 2) { r.errors.push(`${w}: needs >=2 options`); return; }
    if (!item.options.includes(item.prefix)) r.errors.push(`${w}: correct prefix "${item.prefix}" not in options`);
    if (new Set(item.options).size !== item.options.length) r.errors.push(`${w}: duplicate options`);
    if (haveDict && isStr(item.root)) {
      // The system dictionary over-reports archaic forms (e.g. "unbuild",
      // "prevision"), so this is advisory: a human decides whether the flagged
      // word is common enough at KS2 to be an invalid distractor.
      item.options.forEach(opt => {
        if (opt === item.prefix) return;
        if (dict.has((opt + item.root).toLowerCase()))
          r.warnings.push(`${w}: distractor "${opt}"+"${item.root}" = "${opt + item.root}" is in the dictionary — verify it isn't a common word`);
      });
    }
  };

  (isArr(data.wordPairs) ? data.wordPairs : []).forEach((p, i) => checkOptions(p, `wordPairs[${i}]`));
  (isArr(data.sentences) ? data.sentences : []).forEach((s, i) => {
    checkOptions(s, `sentences[${i}]`);
    if (!isStr(s.before) && !isStr(s.after)) r.warnings.push(`sentences[${i}]: no before/after context`);
  });
  return r;
}

export const VALIDATORS = {
  reading: validateReading,
  reasoning: validateReasoning,
  grammar: validateGrammar,
  prefixes: validatePrefixes,
};
