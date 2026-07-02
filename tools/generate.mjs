#!/usr/bin/env node
/* =========================
   Generate KS2 SATs content with Claude, in the app's existing JSON schemas.

   Requires ANTHROPIC_API_KEY in the environment and `npm install` in tools/.

   Usage:
     node tools/generate.mjs reading   --set C --count 2 [--genre Narrative] [--out out.json]
     node tools/generate.mjs reasoning --strand rounding --count 10 [--out out.json]

   Output is validated before it is written. Writes to --out, or stdout if omitted.
   Nothing is merged into live data files automatically — review, then use merge.mjs.
========================= */

import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { validateReading, validateReasoning, REASONING_STRANDS } from "./lib/validators.mjs";

const MODEL = "claude-opus-4-8";

/* ---------- tiny arg parser ---------- */
function parseArgs(argv) {
  const [kind, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith("--")) {
      const key = rest[i].slice(2);
      const val = (rest[i + 1] && !rest[i + 1].startsWith("--")) ? rest[++i] : "true";
      opts[key] = val;
    }
  }
  return { kind, opts };
}

/* ---------- Claude structured-output call ---------- */
async function generateJSON({ system, prompt, schema }) {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content: prompt }],
  });
  if (resp.stop_reason === "refusal") {
    throw new Error("Model refused this request: " + (resp.stop_details?.explanation || "no detail"));
  }
  const textBlock = resp.content.find(b => b.type === "text");
  if (!textBlock) throw new Error("No text block in response");
  return JSON.parse(textBlock.text);
}

/* ---------- reading ---------- */

const READING_QUESTION_SCHEMA = {
  anyOf: [
    {
      type: "object", additionalProperties: false,
      required: ["type", "marks", "stem", "accept", "solution"],
      properties: {
        type: { const: "short" }, marks: { type: "integer" },
        stem: { type: "string" },
        accept: { type: "array", items: { type: "string" } },
        solution: { type: "string" },
      },
    },
    {
      type: "object", additionalProperties: false,
      required: ["type", "marks", "stem", "choices", "answer", "solution"],
      properties: {
        type: { const: "mcq" }, marks: { type: "integer" },
        stem: { type: "string" },
        choices: { type: "array", items: { type: "string" } },
        answer: { type: "string" },
        solution: { type: "string" },
      },
    },
    {
      type: "object", additionalProperties: false,
      required: ["type", "marks", "stem", "choices", "answers", "solution"],
      properties: {
        type: { const: "tick2" }, marks: { type: "integer" },
        stem: { type: "string" },
        choices: { type: "array", items: { type: "string" } },
        answers: { type: "array", items: { type: "string" } },
        solution: { type: "string" },
      },
    },
    {
      type: "object", additionalProperties: false,
      required: ["type", "marks", "stem", "statements", "solution"],
      properties: {
        type: { const: "truefalse" }, marks: { type: "integer" },
        stem: { type: "string" },
        statements: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            required: ["text", "answer"],
            properties: { text: { type: "string" }, answer: { type: "boolean" } },
          },
        },
        solution: { type: "string" },
      },
    },
  ],
};

const READING_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["title", "genre", "minutes", "totalMarks", "passage", "questions"],
  properties: {
    title: { type: "string" },
    genre: { type: "string" },
    minutes: { type: "integer" },
    totalMarks: { type: "integer" },
    passage: { type: "string" },
    questions: { type: "array", items: READING_QUESTION_SCHEMA },
  },
};

async function genReadingTest({ set, genre }) {
  const system =
    "You are a KS2 (Year 6, UK) SATs reading comprehension author. " +
    "Write age-appropriate content (ages 10–11) that matches the tone and difficulty of the official English reading paper.";
  const prompt =
    `Create ONE reading comprehension test.\n` +
    `- Genre: ${genre || "your choice (Narrative, Information, Argument, Biography, or Poetry)"}.\n` +
    `- passage: 300–450 words of engaging, original prose as an HTML string using <p> paragraphs (no <html>/<body>).\n` +
    `- 6 questions total, worth 8 marks total. Mix question types: use "short" (1 mark, with an "accept" list of acceptable answers), ` +
    `"mcq" (1 mark, "answer" must be one of "choices"), "tick2" (2 marks, exactly 2 correct "answers" chosen from >=4 "choices"), ` +
    `and "truefalse" (statements each with a boolean "answer").\n` +
    `- Every question's stem is an HTML string. Every question has a "solution" (the mark scheme / model answer).\n` +
    `- Questions must be answerable purely from the passage.`;
  return generateJSON({ system, prompt, schema: READING_SCHEMA });
}

async function runReading(opts) {
  const set = (opts.set || "").toUpperCase();
  const count = parseInt(opts.count || "1", 10);
  if (!set) throw new Error("reading requires --set <letter> (e.g. --set C)");

  const tests = [];
  for (let i = 0; i < count; i++) {
    process.stderr.write(`Generating reading test ${i + 1}/${count} (set ${set})…\n`);
    const t = await genReadingTest({ set, genre: opts.genre });
    // Assign stable ids/numbers ourselves (the model doesn't need to).
    const num = i + 1;
    const testId = `${set.toLowerCase()}${num}`;
    t.id = testId;
    t.set = set;
    t.testNumber = num;
    t.questions.forEach((q, qi) => { q.id = `${testId}q${qi + 1}`; q.num = qi + 1; });
    tests.push(t);
  }

  const out = { tests };
  const { errors, warnings } = validateReading(out);
  warnings.forEach(w => process.stderr.write(`  ⚠ ${w}\n`));
  if (errors.length) {
    errors.forEach(e => process.stderr.write(`  ✗ ${e}\n`));
    throw new Error(`Generated reading failed validation (${errors.length} error(s)); not writing.`);
  }
  return out;
}

/* ---------- reasoning ---------- */

const REASONING_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["stem", "answer", "solution"],
        properties: {
          stem: { type: "string" },
          answer: { type: "string" },
          solution: { type: "string" },
        },
      },
    },
  },
};

const STRAND_HINTS = {
  large_numbers: "reading, writing and comparing numbers up to 10,000,000",
  place_value: "the value of each digit in large numbers",
  ordering: "ordering and comparing large numbers",
  rounding: "rounding to the nearest 10, 100, 1000, 10000, 100000",
  negative: "negative numbers and intervals across zero",
  roman: "Roman numerals up to 1000 (M)",
};

async function runReasoning(opts) {
  const strand = opts.strand;
  const count = parseInt(opts.count || "10", 10);
  if (!strand || !REASONING_STRANDS.includes(strand))
    throw new Error(`reasoning requires --strand <${REASONING_STRANDS.join("|")}>`);

  process.stderr.write(`Generating ${count} reasoning questions (strand ${strand})…\n`);
  const system =
    "You are a KS2 (Year 6, UK) SATs maths reasoning author. Questions target ages 10–11 and match the official arithmetic/reasoning papers.";
  const prompt =
    `Create ${count} short-answer maths questions on the strand "${strand}" (${STRAND_HINTS[strand]}).\n` +
    `- stem: an HTML string (a single clear question).\n` +
    `- answer: the exact expected answer as a string (no working).\n` +
    `- solution: a one-line explanation of how to reach the answer.\n` +
    `Vary difficulty and phrasing; do not repeat questions.`;
  const raw = await generateJSON({ system, prompt, schema: REASONING_SCHEMA });

  // Attach ids/strand/type ourselves.
  const stamp = Date.now().toString(36);
  raw.questions.forEach((q, i) => {
    q.id = `gen_${strand}_${stamp}_${i + 1}`;
    q.strand = strand;
    q.type = "short";
  });

  const { errors, warnings } = validateReasoning(raw);
  warnings.forEach(w => process.stderr.write(`  ⚠ ${w}\n`));
  if (errors.length) {
    errors.forEach(e => process.stderr.write(`  ✗ ${e}\n`));
    throw new Error(`Generated reasoning failed validation (${errors.length} error(s)); not writing.`);
  }
  return raw;
}

/* ---------- main ---------- */

async function main() {
  const { kind, opts } = parseArgs(process.argv.slice(2));
  let result;
  if (kind === "reading") result = await runReading(opts);
  else if (kind === "reasoning") result = await runReasoning(opts);
  else {
    console.error("Usage: node tools/generate.mjs <reading|reasoning> [--options]");
    process.exit(2);
  }

  const json = JSON.stringify(result, null, 2);
  if (opts.out) {
    fs.writeFileSync(opts.out, json + "\n");
    process.stderr.write(`Wrote ${opts.out}\n`);
  } else {
    process.stdout.write(json + "\n");
  }
}

main().catch(err => { console.error("Error:", err.message); process.exit(1); });
