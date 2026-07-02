/* =========================================================
   v2 content schema — single source of truth (Node side).
   js/core/schema.js mirrors the structural checks for the
   browser (fetched banks + AI-generated content).
   ========================================================= */

export const SUBJECTS = ["reading", "gps", "maths", "spelling"];

export const DOMAINS = {
  reading: ["2a", "2b", "2c", "2d", "2e", "2f", "2g", "2h"],
  gps: ["G1", "G2", "G3", "G4", "G5", "G6", "G7"],
  // Coarse STA-style codes; strand carries the reporting group.
  maths: /^[3-6][NCFAMGSR]\d*[a-z]?$/,
  spelling: ["S"]
};

export const MATHS_STRANDS = ["number", "calculation", "fractions", "ratio", "algebra", "measure", "geometry", "stats"];

export const AUTO_TYPES = [
  "mcq", "tick2", "truefalse", "factopin", "match", "order", "circle2",
  "short-closed", "numeric", "multi", "pairs", "tokens", "roles", "spelling", "prefix"
];
export const AI_TYPES = ["short", "multishort", "open"];

const tokensOf = s => String(s || "").split(" ").filter(Boolean);

function checkIndices(indices, sentence, path, errors) {
  const n = tokensOf(sentence).length;
  if (!Array.isArray(indices) || indices.length === 0) {
    errors.push(`${path}: missing/empty token indices`);
    return;
  }
  indices.forEach(i => {
    if (!Number.isInteger(i) || i < 0 || i >= n) {
      errors.push(`${path}: token index ${i} out of range 0..${n - 1}`);
    }
  });
}

export function validateQuestion(q, ctx = {}) {
  const errors = [];
  const warnings = [];
  const p = q?.id || "(no id)";

  if (!q || typeof q !== "object") return { errors: ["question is not an object"], warnings };
  if (!q.id) errors.push(`${p}: missing id`);
  if (!SUBJECTS.includes(q.subject)) errors.push(`${p}: bad subject "${q.subject}"`);

  const dom = DOMAINS[q.subject];
  if (dom) {
    const ok = dom instanceof RegExp ? dom.test(q.domain) : dom.includes(q.domain);
    if (!ok) errors.push(`${p}: bad domain "${q.domain}" for ${q.subject}`);
  }
  if (q.subject === "maths" && q.strand && !MATHS_STRANDS.includes(q.strand)) {
    errors.push(`${p}: bad maths strand "${q.strand}"`);
  }

  if (!Number.isInteger(q.marks) || q.marks < 1) errors.push(`${p}: marks must be a positive integer`);
  if (!q.stem && !q.sentence && q.type !== "spelling") errors.push(`${p}: missing stem`);

  const isAuto = AUTO_TYPES.includes(q.type);
  const isAI = AI_TYPES.includes(q.type);
  if (!isAuto && !isAI) errors.push(`${p}: unknown type "${q.type}"`);
  if (isAuto && q.marking !== "auto") errors.push(`${p}: type ${q.type} must have marking "auto"`);
  if (isAI && q.marking !== "ai") errors.push(`${p}: type ${q.type} must have marking "ai"`);

  /* Type-specific answer fields */
  switch (q.type) {
    case "mcq":
      if (!Array.isArray(q.choices) || q.choices.length < 2) errors.push(`${p}: mcq needs >=2 choices`);
      else if (!q.choices.includes(q.answer)) errors.push(`${p}: mcq answer not in choices`);
      break;
    case "tick2":
      if (!Array.isArray(q.choices) || q.choices.length < 3) errors.push(`${p}: tick2 needs >=3 choices`);
      if (!Array.isArray(q.answers) || q.answers.length !== 2) errors.push(`${p}: tick2 needs exactly 2 answers`);
      else if (Array.isArray(q.choices)) {
        q.answers.forEach(a => { if (!q.choices.includes(a)) errors.push(`${p}: tick2 answer "${a}" not in choices`); });
      }
      break;
    case "truefalse":
      if (!Array.isArray(q.statements) || !q.statements.length ||
          q.statements.some(s => !s.text || typeof s.answer !== "boolean")) {
        errors.push(`${p}: truefalse needs statements [{text, answer:boolean}]`);
      }
      break;
    case "factopin":
      if (!Array.isArray(q.statements) || !q.statements.length ||
          q.statements.some(s => !s.text || typeof s.fact !== "boolean")) {
        errors.push(`${p}: factopin needs statements [{text, fact:boolean}]`);
      }
      break;
    case "match":
      if (!Array.isArray(q.lefts) || !Array.isArray(q.rights) || !Array.isArray(q.correct) ||
          q.lefts.length !== q.correct.length) {
        errors.push(`${p}: match needs lefts/rights/correct with matching lengths`);
      } else if (q.correct.some(i => !Number.isInteger(i) || i < 0 || i >= q.rights.length)) {
        errors.push(`${p}: match correct index out of range`);
      }
      break;
    case "order":
      if (!Array.isArray(q.items) || !Array.isArray(q.order) || q.items.length !== q.order.length) {
        errors.push(`${p}: order needs items/order with matching lengths`);
      }
      break;
    case "circle2":
      if (!Array.isArray(q.groups) || !q.groups.length ||
          q.groups.some(g => !Array.isArray(g.choices) || !g.choices.includes(g.answer))) {
        errors.push(`${p}: circle2 groups need choices containing answer`);
      }
      break;
    case "short-closed":
      if (!Array.isArray(q.accept) || !q.accept.length) errors.push(`${p}: short-closed needs accept[]`);
      break;
    case "numeric":
      if (q.answer == null || String(q.answer).trim() === "") errors.push(`${p}: numeric needs answer`);
      break;
    case "multi":
      if (!Array.isArray(q.answers) || !q.answers.length) errors.push(`${p}: multi needs answers[]`);
      break;
    case "pairs":
      if (!Array.isArray(q.labels) || q.labels.length !== 2) errors.push(`${p}: pairs needs 2 labels`);
      if (!q.validator) errors.push(`${p}: pairs needs validator name`);
      break;
    case "tokens":
      checkIndices(q.tokenIndices, q.sentence, p, errors);
      break;
    case "roles":
      if (!Array.isArray(q.parts) || !q.parts.length) errors.push(`${p}: roles needs parts[]`);
      else q.parts.forEach((part, i) => checkIndices(part.answer, q.sentence, `${p}.parts[${i}]`, errors));
      break;
    case "spelling":
      if (!q.word) errors.push(`${p}: spelling needs word`);
      break;
    case "prefix":
      if (!q.root || !q.prefix || !Array.isArray(q.options)) errors.push(`${p}: prefix needs root/prefix/options`);
      break;
  }

  /* markScheme */
  const ms = q.markScheme;
  if (isAI) {
    if (!ms || typeof ms !== "object") {
      errors.push(`${p}: ai-marked question needs markScheme`);
    } else {
      if (!Array.isArray(ms.acceptablePoints) && !ms.modelAnswer) {
        errors.push(`${p}: markScheme needs acceptablePoints[] or modelAnswer`);
      }
      if (!ms.award || typeof ms.award !== "object") {
        errors.push(`${p}: markScheme needs award rules`);
      } else {
        const keys = Object.keys(ms.award).map(Number);
        if (Math.max(...keys) !== q.marks) {
          errors.push(`${p}: award max key ${Math.max(...keys)} != marks ${q.marks}`);
        }
      }
    }
  } else if (isAuto && (!ms || !ms.modelAnswer)) {
    warnings.push(`${p}: auto question has no markScheme.modelAnswer (solution display)`);
  }

  if (ctx.passageIds && q.passageId && !ctx.passageIds.has(q.passageId)) {
    errors.push(`${p}: unknown passageId "${q.passageId}"`);
  }
  if (q.subject === "reading" && ctx.requirePassage && !q.passageId) {
    warnings.push(`${p}: reading question without passageId`);
  }

  return { errors, warnings };
}

function checkUniqueIds(items, label, errors) {
  const seen = new Set();
  items.forEach(it => {
    if (seen.has(it.id)) errors.push(`${label}: duplicate id "${it.id}"`);
    seen.add(it.id);
  });
}

export function validateReadingBank(bank) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(bank?.passages) || !Array.isArray(bank?.questions)) {
    return { errors: ["reading bank needs {passages[], questions[]}"], warnings };
  }
  bank.passages.forEach(pg => {
    if (!pg.id || !pg.title || !pg.text) errors.push(`passage ${pg.id || "?"}: needs id/title/text`);
    if (!["fiction", "non-fiction", "poetry", "play"].includes(pg.category)) {
      warnings.push(`passage ${pg.id}: category "${pg.category}" not in fiction/non-fiction/poetry/play`);
    }
  });
  checkUniqueIds(bank.passages, "passages", errors);
  checkUniqueIds(bank.questions, "reading questions", errors);
  const passageIds = new Set(bank.passages.map(pg => pg.id));
  bank.questions.forEach(q => {
    const r = validateQuestion(q, { passageIds, requirePassage: false });
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  });
  return { errors, warnings };
}

export function validateGpsBank(bank) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(bank?.questions)) return { errors: ["gps bank needs {questions[]}"], warnings };
  if (bank.topics && !Array.isArray(bank.topics)) errors.push("gps topics must be an array");
  (bank.topics || []).forEach(t => {
    if (!t.id || !t.label) errors.push(`gps topic ${t.id || "?"}: needs id/label`);
  });
  checkUniqueIds(bank.questions, "gps questions", errors);
  bank.questions.forEach(q => {
    const r = validateQuestion(q);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  });
  return { errors, warnings };
}

export function validateMathsBank(bank) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(bank?.questions)) return { errors: ["maths bank needs {questions[]}"], warnings };
  checkUniqueIds(bank.questions, "maths questions", errors);
  bank.questions.forEach(q => {
    const r = validateQuestion(q);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
    if (!q.strand) warnings.push(`${q.id}: maths question without strand`);
  });
  return { errors, warnings };
}

export function validateSpellingBank(bank) {
  const errors = [];
  const warnings = [];
  if (!bank?.lists || typeof bank.lists !== "object") errors.push("spelling bank needs lists{}");
  Object.entries(bank?.lists || {}).forEach(([key, list]) => {
    if (!Array.isArray(list.words) || !list.words.length) errors.push(`spelling list ${key}: needs words[]`);
  });
  if (bank?.prefixes) {
    const px = bank.prefixes;
    if (!Array.isArray(px.wordPairs) || !Array.isArray(px.sentences)) {
      errors.push("spelling.prefixes needs wordPairs[] and sentences[]");
    }
  }
  return { errors, warnings };
}

export function validatePapers(papers) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(papers?.papers)) return { errors: ["papers.json needs {papers[]}"], warnings };
  checkUniqueIds(papers.papers, "papers", errors);
  papers.papers.forEach(pp => {
    if (!pp.id || !pp.label || !pp.subject) errors.push(`paper ${pp.id || "?"}: needs id/label/subject`);
    if (!Number.isInteger(pp.minutes) || !Number.isInteger(pp.totalMarks)) {
      errors.push(`paper ${pp.id}: needs integer minutes/totalMarks`);
    }
    if (pp.domainQuotas) {
      const sum = Object.values(pp.domainQuotas).reduce((a, b) => a + b, 0);
      if (sum !== pp.totalMarks) {
        warnings.push(`paper ${pp.id}: domain quotas sum to ${sum}, totalMarks is ${pp.totalMarks}`);
      }
    }
  });
  return { errors, warnings };
}
