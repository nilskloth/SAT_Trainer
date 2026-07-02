/* =========================================================
   Browser-side structural checks — a light mirror of
   tools/lib/schema-v2.mjs. Run on fetched banks (warn only)
   and on AI-generated content before it is accepted (strict).
   ========================================================= */

const AUTO_TYPES = new Set([
  "mcq", "tick2", "truefalse", "factopin", "match", "order", "circle2",
  "short-closed", "numeric", "multi", "pairs", "tokens", "roles", "spelling", "prefix"
]);
const AI_TYPES = new Set(["short", "multishort", "open"]);

export function checkQuestion(q, passageIds) {
  const errs = [];
  const p = q?.id || "(no id)";
  if (!q || typeof q !== "object") return ["not an object"];
  if (!q.id) errs.push(`${p}: missing id`);
  if (!AUTO_TYPES.has(q.type) && !AI_TYPES.has(q.type)) errs.push(`${p}: unknown type "${q.type}"`);
  if (!Number.isInteger(q.marks) || q.marks < 1) errs.push(`${p}: bad marks`);
  if (AI_TYPES.has(q.type)) {
    const ms = q.markScheme;
    if (!ms || (!Array.isArray(ms.acceptablePoints) && !ms.modelAnswer) || !ms.award) {
      errs.push(`${p}: ai question needs markScheme with acceptablePoints/modelAnswer + award`);
    }
  }
  if (q.type === "mcq" && (!Array.isArray(q.choices) || !q.choices.includes(q.answer))) {
    errs.push(`${p}: mcq answer not in choices`);
  }
  if (q.type === "tick2" && (!Array.isArray(q.answers) || q.answers.length !== 2 ||
      !q.answers.every(a => q.choices?.includes(a)))) {
    errs.push(`${p}: tick2 answers must be 2 of choices`);
  }
  if (q.type === "tokens") {
    const n = String(q.sentence || "").split(" ").filter(Boolean).length;
    if (!Array.isArray(q.tokenIndices) || q.tokenIndices.some(i => !Number.isInteger(i) || i < 0 || i >= n)) {
      errs.push(`${p}: token indices out of range`);
    }
  }
  if (passageIds && q.passageId && !passageIds.has(q.passageId)) {
    errs.push(`${p}: unknown passageId`);
  }
  return errs;
}

export function checkBank(name, bank) {
  const errs = [];
  if (name === "reading") {
    const passageIds = new Set((bank.passages || []).map(pg => pg.id));
    (bank.passages || []).forEach(pg => {
      if (!pg.id || !pg.title || !pg.text) errs.push(`passage ${pg.id || "?"}: incomplete`);
    });
    (bank.questions || []).forEach(q => errs.push(...checkQuestion(q, passageIds)));
  } else {
    (bank.questions || []).forEach(q => errs.push(...checkQuestion(q)));
  }
  return errs;
}
