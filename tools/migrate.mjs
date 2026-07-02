/* =========================================================
   v1 → v2 content migration. One-shot, idempotent:
   reads v1 data files (never mutates them) and writes
   data/content/*.json plus a review CSV of guessed
   domain codes (tools/migration-review.csv).

   Usage: node tools/migrate.mjs
   ========================================================= */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateReadingBank, validateGpsBank, validateMathsBank, validateSpellingBank
} from "./lib/schema-v2.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "content");
const TODAY = new Date().toISOString().slice(0, 10);

const readJSON = p => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const review = []; // { id, subject, domain, basis, stem }

function guess(id, subject, domain, basis, stem) {
  review.push({ id, subject, domain, basis, stem: String(stem || "").replace(/<[^>]+>/g, "").slice(0, 80) });
  return domain;
}

function meta(source) {
  return { source, author: "v1", added: TODAY };
}

function awardFor(marks) {
  const rules = {
    1: { 1: "any one acceptable point" },
    2: { 1: "one acceptable point", 2: "two acceptable points, or one point with supporting evidence" },
    3: { 1: "one acceptable point", 2: "two acceptable points", 3: "three acceptable points, or two points with supporting evidence" }
  };
  return rules[marks] || rules[1];
}

const stripTags = s => String(s || "").replace(/<[^>]+>/g, " ");
const wordCount = s => stripTags(s).split(/\s+/).filter(Boolean).length;
const isNumericAnswer = a => /^-?[\d,.\s]+$/.test(String(a).trim());

/* =========================
   READING
========================= */

function readingDomainFromStem(q) {
  const stem = stripTags(q.stem).toLowerCase();
  if (["order"].includes(q.type)) return ["2c", "type:order → sequencing/summary"];
  if (["factopin"].includes(q.type)) return ["2d", "type:factopin"];
  if (["truefalse", "match", "circle2", "tick2"].includes(q.type)) return ["2b", `type:${q.type}`];
  if (/short for|closest in meaning|what does the (word|phrase)|meaning of|means the same/.test(stem)) return ["2a", "stem:word-meaning"];
  if (/summaris/.test(stem)) return ["2c", "stem:summarise"];
  if (/predict|might happen next|what do you think will|happen next/.test(stem)) return ["2e", "stem:predict"];
  if (/find and copy one word|find and copy a word/.test(stem) && /shows|suggests/.test(stem)) return ["2g", "stem:find-copy-shows"];
  if (/find and copy/.test(stem)) return ["2b", "stem:find-copy"];
  if (/why|how (do|can) you know|suggest|impression|think|feel|evidence|effect/.test(stem)) return ["2d", "stem:inference"];
  return ["2b", "default"];
}

const READING_SKILL_DOMAIN = {
  retrieval: "2b", vocabulary: "2a", inference: "2d", language: "2g", explanation: "2d"
};

function migrateReadingQuestion(q, passageId, sourceFile) {
  const base = {
    id: `rd-${q.id}`,
    subject: "reading",
    passageId,
    marks: q.marks ?? 1,
    stem: q.stem,
    meta: meta(`migrated:${sourceFile}/${q.id}`)
  };

  let domain;
  if (q.skill && READING_SKILL_DOMAIN[q.skill]) {
    domain = q.skill === "retrieval" || q.skill === "vocabulary"
      ? READING_SKILL_DOMAIN[q.skill]
      : guess(base.id, "reading", READING_SKILL_DOMAIN[q.skill], `skill:${q.skill}`, q.stem);
  } else {
    const [d, basis] = readingDomainFromStem(q);
    domain = guess(base.id, "reading", d, basis, q.stem);
  }
  base.domain = domain;

  const solution = q.solution || "";

  switch (q.type) {
    case "short": {
      const accept = q.accept || (q.answer != null ? [q.answer] : []);
      return {
        ...base, type: "short", marking: "ai",
        markScheme: {
          acceptablePoints: accept.map(a => ({ point: a })),
          award: awardFor(base.marks),
          modelAnswer: solution || accept[0]
        }
      };
    }
    case "multishort":
      return {
        ...base, type: "multishort", marking: "ai",
        markScheme: {
          acceptablePoints: (q.accept || []).map(group => ({
            point: group[0],
            alternatives: group.slice(1)
          })),
          award: awardFor(base.marks),
          modelAnswer: solution
        }
      };
    case "open":
      return {
        ...base, type: "open", marking: "ai",
        markScheme: { award: awardFor(base.marks), modelAnswer: solution }
      };
    case "mcq":
      return { ...base, type: "mcq", marking: "auto", choices: q.choices, answer: q.answer, markScheme: { modelAnswer: solution || q.answer } };
    case "tick2":
      return { ...base, type: "tick2", marking: "auto", choices: q.choices, answers: q.answers, markScheme: { modelAnswer: solution } };
    case "order":
      return { ...base, type: "order", marking: "auto", items: q.items, order: q.order, fixed: q.fixed, markScheme: { modelAnswer: solution } };
    case "truefalse":
      return { ...base, type: "truefalse", marking: "auto", statements: q.statements, markScheme: { modelAnswer: solution } };
    case "factopin":
      return { ...base, type: "factopin", marking: "auto", statements: q.statements, markScheme: { modelAnswer: solution } };
    case "match":
      return { ...base, type: "match", marking: "auto", lefts: q.lefts, rights: q.rights, correct: q.correct, markScheme: { modelAnswer: solution } };
    case "circle2":
      return { ...base, type: "circle2", marking: "auto", groups: q.groups, markScheme: { modelAnswer: solution } };
    default:
      throw new Error(`Unknown reading question type "${q.type}" (${q.id})`);
  }
}

function migrateReading() {
  const passages = [];
  const questions = [];

  const CATEGORY = {
    Narrative: "fiction", Fable: "fiction", Play: "play", Poetry: "poetry",
    Biography: "non-fiction", Information: "non-fiction", Argument: "non-fiction"
  };

  const training = readJSON("data/training/reading.json").tests;
  training.forEach(t => {
    const pid = `p-${t.id}`;
    passages.push({
      id: pid, title: t.title, genre: t.genre,
      category: CATEGORY[t.genre] || "non-fiction",
      wordCount: wordCount(t.passage),
      minutes: t.minutes, source: "authored", text: t.passage,
      meta: meta(`migrated:training/reading.json/${t.id}`)
    });
    t.questions.forEach(q => questions.push(migrateReadingQuestion(q, pid, "training/reading.json")));
  });

  const bank = readJSON("data/banks/reading.json");
  bank.forEach(pg => {
    const pid = `p-${pg.id}`;
    passages.push({
      id: pid, title: pg.title, genre: pg.genre,
      category: CATEGORY[pg.genre] || (/story|narrative/i.test(pg.genre) ? "fiction" : "non-fiction"),
      wordCount: pg.wordCount || wordCount(pg.text),
      source: "authored", text: pg.text,
      meta: meta(`migrated:banks/reading.json/${pg.id}`)
    });
    pg.questions.forEach(q => questions.push(migrateReadingQuestion(q, pid, "banks/reading.json")));
  });

  return { passages, questions };
}

/* =========================
   GPS
========================= */

const SPAG_SKILL_DOMAIN = {
  word_class: "G1", adverbs: "G1", pronouns: "G1", verbs: "G1", plural_nouns: "G1",
  modal_verbs: "G1", expanded_noun_phrase: "G1", conjunctions: "G1", determiners: "G1",
  relative_pronouns: "G1", prepositions: "G1", fronted_adverbials: "G1",
  sentence_types: "G2", question_tags: "G2",
  clauses: "G3", relative_clauses: "G3",
  tense: "G4", active_passive: "G4", passive_voice: "G4", present_perfect: "G4", verb_forms: "G4",
  punctuation: "G5", apostrophes: "G5", semi_colons: "G5", hyphens: "G5", commas_clarity: "G5",
  capitalisation: "G5", capital_letters: "G5", ellipsis: "G5", contractions: "G5", plural_possession: "G5",
  synonyms: "G6", antonyms: "G6", prefixes: "G6", suffixes: "G6", word_families: "G6", homophones: "G6",
  standard_english: "G7", formal_language: "G7", subjunctive: "G7"
};

const GRAMMAR_TOPIC_DOMAIN = {
  nouns: "G1", verbs: "G1", adjectives: "G1", adverbs: "G1", determiners: "G1",
  prepositions: "G1", pronouns: "G1", conjunctions: "G1",
  "subordinate-clauses": "G3",
  "active-voice": "G4", "passive-voice": "G4",
  "simple-present": "G4", "simple-past": "G4", "present-progressive": "G4",
  "past-progressive": "G4", "present-perfect": "G4", "past-perfect": "G4", "simple-future": "G4"
};

function migrateGps() {
  const questions = [];

  const spag = readJSON("data/banks/spag.json");
  spag.forEach(q => {
    const id = `gps-${q.id}`;
    const domain = SPAG_SKILL_DOMAIN[q.skill] ||
      guess(id, "gps", "G1", `skill:${q.skill} (unmapped)`, q.stem);
    const base = {
      id, subject: "gps", domain, marks: 1, stem: q.stem,
      meta: meta(`migrated:banks/spag.json/${q.id}`)
    };
    if (q.type === "mcq") {
      questions.push({ ...base, type: "mcq", marking: "auto", choices: q.choices, answer: q.answer, markScheme: { modelAnswer: q.answer } });
    } else {
      questions.push({ ...base, type: "short-closed", marking: "auto", accept: [q.answer], markScheme: { modelAnswer: q.answer } });
    }
  });

  const grammar = readJSON("data/banks/grammar.json").grammar;
  const topics = grammar.topics.map(t => ({
    id: t.id, label: t.label, domain: GRAMMAR_TOPIC_DOMAIN[t.id] || "G1",
    definition: t.definition, examples: t.examples
  }));

  grammar.topics.forEach(t => {
    const domain = GRAMMAR_TOPIC_DOMAIN[t.id] || "G1";
    t.questions.forEach((q, i) => {
      const id = `gps-${t.id}-${i + 1}`;
      const base = {
        id, subject: "gps", domain, topicId: t.id, marks: 1,
        meta: meta(`migrated:banks/grammar.json/${t.id}[${i}]`)
      };
      if (q.parts) {
        questions.push({
          ...base, type: "roles", marking: "auto",
          stem: `Identify each part of the sentence.`,
          sentence: q.sentence, parts: q.parts,
          markScheme: { modelAnswer: q.parts.map(pt => `${pt.label}: ${pt.answer.map(ix => q.sentence.split(" ")[ix]).join(" ")}`).join("; ") }
        });
      } else {
        questions.push({
          ...base, type: "tokens", marking: "auto",
          stem: q.task, sentence: q.sentence, tokenIndices: q.answer,
          markScheme: { modelAnswer: q.answer.map(ix => q.sentence.split(" ")[ix]).join(", ") }
        });
      }
    });
  });

  return { topics, questions };
}

/* =========================
   MATHS
========================= */

const REASONING_STRAND_MAP = {
  large_numbers: { strand: "number", domain: "6N2" },
  place_value: { strand: "number", domain: "6N2" },
  ordering: { strand: "number", domain: "6N2" },
  rounding: { strand: "number", domain: "6N3" },
  negative: { strand: "number", domain: "6N4" },
  roman: { strand: "number", domain: "5N3a" }
};

const BANK_DOMAIN_MAP = {
  number: { strand: "calculation", domain: "6C8" },
  calculation: { strand: "calculation", domain: "6C8" },
  fractions: { strand: "fractions", domain: "6F4" },
  ratio: { strand: "ratio", domain: "6R1" },
  algebra: { strand: "algebra", domain: "6A3" },
  measure: { strand: "measure", domain: "6M5" },
  geometry: { strand: "geometry", domain: "6G2" },
  stats: { strand: "stats", domain: "6S1" }
};

const ALGEBRA_STRAND_MAP = {
  formula: "6A1", substitution: "6A1", sequence: "6A2",
  missing_value: "6A3", express: "6A3", two_unknowns: "6A4"
};

function mathsShort(base, q) {
  if (isNumericAnswer(q.answer)) {
    return { ...base, type: "numeric", marking: "auto", answer: String(q.answer), markScheme: { modelAnswer: q.solution || String(q.answer) } };
  }
  return { ...base, type: "short-closed", marking: "auto", accept: [String(q.answer)], markScheme: { modelAnswer: q.solution || String(q.answer) } };
}

function migrateMaths() {
  const questions = [];

  const training = readJSON("data/training/reasoning.json").questions;
  training.forEach(q => {
    const map = REASONING_STRAND_MAP[q.strand] || { strand: "number", domain: "6N2" };
    const id = `m-${q.id}`;
    const base = {
      id, subject: "maths", strand: map.strand,
      domain: guess(id, "maths", map.domain, `strand:${q.strand}`, q.stem),
      marks: 1, stem: q.stem, meta: meta(`migrated:training/reasoning.json/${q.id}`)
    };
    if (q.type === "mcq") {
      questions.push({ ...base, type: "mcq", marking: "auto", choices: q.choices, answer: q.answer, markScheme: { modelAnswer: q.solution || q.answer } });
    } else {
      questions.push(mathsShort(base, q));
    }
  });

  const bank = readJSON("data/banks/reasoning.json");
  bank.forEach(q => {
    const map = BANK_DOMAIN_MAP[q.domain] || BANK_DOMAIN_MAP.number;
    const id = `m-bank-${q.id}`;
    const base = {
      id, subject: "maths", strand: map.strand,
      domain: guess(id, "maths", map.domain, `bank-domain:${q.domain}`, q.stem),
      paper: q.paper, marks: 1, stem: q.stem,
      meta: meta(`migrated:banks/reasoning.json/${q.id}`)
    };
    questions.push(mathsShort(base, q));
  });

  const algebra = readJSON("data/training/algebra.json").sets;
  algebra.forEach(set => {
    set.questions.forEach(q => {
      const id = `m-${q.id}`;
      const base = {
        id, subject: "maths", strand: "algebra",
        domain: ALGEBRA_STRAND_MAP[q.strand] || "6A3",
        set: set.id, marks: 1, stem: q.stem,
        meta: meta(`migrated:training/algebra.json/${q.id}`)
      };
      if (q.type === "mcq") {
        questions.push({ ...base, type: "mcq", marking: "auto", choices: q.choices, answer: q.answer, markScheme: { modelAnswer: q.solution || q.answer } });
      } else if (q.type === "multi") {
        questions.push({ ...base, type: "multi", marking: "auto", answers: q.answers, label: q.label, markScheme: { modelAnswer: q.solution || q.answers.join(", ") } });
      } else if (q.type === "pairs") {
        questions.push({ ...base, type: "pairs", marking: "auto", labels: q.labels, validator: q.validator, markScheme: { modelAnswer: q.solution || "" } });
      } else {
        questions.push(mathsShort(base, { ...q, answer: q.answer }));
      }
    });
  });

  return { questions };
}

/* =========================
   WARM UP (embedded DAYS array in js/training/warmup.js)
========================= */

function extractWarmupDays() {
  const src = readFileSync(join(ROOT, "js/training/warmup.js"), "utf8");
  const start = src.indexOf("const DAYS = [");
  if (start === -1) throw new Error("DAYS array not found in warmup.js");
  const open = src.indexOf("[", start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end === -1) throw new Error("DAYS array not terminated");
  return new Function(`return ${src.slice(open, end)};`)();
}

function migrateWarmup(banks) {
  const days = extractWarmupDays();
  let counts = { gps: 0, reading: 0, maths: 0 };

  days.forEach((day, di) => {
    const subject = day.subject === "SPaG" ? "gps" : day.subject === "Reading" ? "reading" : "maths";
    (day.sets || []).forEach((set, si) => {
      (set.questions || []).forEach((q, qi) => {
        const id = `wu-d${di}s${si}q${qi}`;
        const domain = subject === "gps"
          ? guess(id, "gps", "G1", "warmup default", q.q)
          : subject === "reading"
            ? guess(id, "reading", "2b", "warmup default", q.q)
            : guess(id, "maths", "6N2", "warmup default", q.q);
        const item = {
          id, subject, domain, marks: 1, type: "mcq", marking: "auto",
          stem: q.q, choices: q.opts, answer: q.opts[q.ans],
          markScheme: { modelAnswer: q.opts[q.ans], explanation: q.hint },
          meta: meta(`migrated:warmup.js/${day.label}/${set.label}/q${qi + 1}`)
        };
        if (subject === "maths") item.strand = "number";
        if (subject === "gps") banks.gps.questions.push(item);
        else if (subject === "reading") banks.reading.questions.push(item);
        else banks.maths.questions.push(item);
        counts[subject]++;
      });
    });
  });
  return counts;
}

/* =========================
   SPELLING (near-verbatim)
========================= */

function migrateSpelling() {
  const sp = readJSON("data/training/spelling.json").spelling;
  const px = readJSON("data/training/prefixes.json");
  return {
    meta: { ...sp.meta, migrated: TODAY },
    lists: sp.lists,
    prefixes: { prefixDefs: px.prefixDefs, wordPairs: px.wordPairs, sentences: px.sentences }
  };
}

/* =========================
   PAPER BLUEPRINTS (authored, not migrated)
========================= */

const PAPERS = {
  papers: [
    {
      id: "reading", subject: "reading", label: "English reading", minutes: 60, totalMarks: 50,
      texts: { count: 3, minFiction: 1, minNonFiction: 1, totalWords: [1800, 2300] },
      domainQuotas: { "2a": 4, "2b": 12, "2c": 3, "2d": 22, "2e": 2, "2f": 2, "2g": 3, "2h": 2 },
      instructions: "You have one hour to read the texts and answer the questions."
    },
    {
      id: "gps1", subject: "gps", label: "Grammar, punctuation and vocabulary (Paper 1)", minutes: 45, totalMarks: 50,
      domainQuotas: { G1: 12, G2: 3, G3: 6, G4: 7, G5: 16, G6: 3, G7: 3 },
      instructions: "Answer every question. You have 45 minutes."
    },
    {
      id: "gps2", subject: "spelling", label: "Spelling (Paper 2)", minutes: 15, totalMarks: 20,
      words: 20,
      instructions: "Listen to each sentence and write the missing word."
    },
    {
      id: "maths1", subject: "maths", label: "Arithmetic (Paper 1)", minutes: 30, totalMarks: 40,
      kind: "arithmetic",
      instructions: "Work out each calculation. Show your method where it helps."
    },
    {
      id: "maths2", subject: "maths", label: "Reasoning (Paper 2)", minutes: 40, totalMarks: 35,
      kind: "reasoning", strandShare: { numberRatioAlgebra: [0.75, 0.85] },
      instructions: "Answer every question. You have 40 minutes."
    },
    {
      id: "maths3", subject: "maths", label: "Reasoning (Paper 3)", minutes: 40, totalMarks: 35,
      kind: "reasoning", strandShare: { numberRatioAlgebra: [0.75, 0.85] },
      instructions: "Answer every question. You have 40 minutes."
    }
  ]
};

/* =========================
   Main
========================= */

mkdirSync(OUT, { recursive: true });

const reading = migrateReading();
const gps = migrateGps();
const maths = migrateMaths();
const wuCounts = migrateWarmup({ reading, gps, maths });
const spelling = migrateSpelling();

const banks = [
  ["reading.json", reading, validateReadingBank],
  ["gps.json", gps, validateGpsBank],
  ["maths.json", maths, validateMathsBank],
  ["spelling.json", spelling, validateSpellingBank]
];

let failed = false;
const manifest = { version: 2, generated: TODAY, banks: {} };

for (const [file, bank, validate] of banks) {
  const { errors, warnings } = validate(bank);
  warnings.slice(0, 10).forEach(w => console.warn(`  warn: ${w}`));
  if (warnings.length > 10) console.warn(`  …and ${warnings.length - 10} more warnings`);
  if (errors.length) {
    failed = true;
    console.error(`\n✗ ${file}: ${errors.length} errors`);
    errors.slice(0, 20).forEach(e => console.error(`  ${e}`));
  } else {
    writeFileSync(join(OUT, file), JSON.stringify(bank, null, 2));
    const counts = file === "reading.json"
      ? { passages: bank.passages.length, questions: bank.questions.length }
      : file === "spelling.json"
        ? { lists: Object.keys(bank.lists).length, wordPairs: bank.prefixes.wordPairs.length }
        : { questions: bank.questions.length, ...(bank.topics ? { topics: bank.topics.length } : {}) };
    manifest.banks[file.replace(".json", "")] = counts;
    console.log(`✓ ${file}`, JSON.stringify(counts));
  }
}

writeFileSync(join(OUT, "papers.json"), JSON.stringify(PAPERS, null, 2));
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`✓ papers.json (${PAPERS.papers.length} blueprints) + manifest.json`);
console.log(`  warm-up questions folded in:`, JSON.stringify(wuCounts));

const csv = ["id,subject,domain,basis,stem"].concat(
  review.map(r => [r.id, r.subject, r.domain, r.basis, `"${r.stem.replace(/"/g, "'")}"`].join(","))
).join("\n");
writeFileSync(join(ROOT, "tools", "migration-review.csv"), csv);
console.log(`  ${review.length} guessed domain codes → tools/migration-review.csv (review these)`);

if (failed) process.exit(1);
