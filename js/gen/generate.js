/* =========================================================
   Runtime generation: "New reading test" via the proxy.
   Response is converted into the v2 schema, validated with
   js/core/schema.js, and stored as a bank addition in the
   store (loader merges it over shipped content at boot).
   ========================================================= */

import { getStore, saveStore } from "../core/store.js";
import { checkQuestion } from "../core/schema.js";

const GEN_TIMEOUT_MS = 290000;

function awardFor(marks) {
  const rules = {
    1: { 1: "any one acceptable point" },
    2: { 1: "one acceptable point", 2: "two acceptable points, or one point with supporting evidence" },
    3: { 1: "one acceptable point", 2: "two acceptable points", 3: "three acceptable points, or two points with supporting evidence" }
  };
  return rules[marks] || rules[1];
}

/* Convert the model's output into v2 passage + questions. Throws on junk. */
function convert(data) {
  const stamp = Date.now().toString(36);
  const passageId = `p-gen-${stamp}`;
  const meta = { source: "generated:runtime", author: "generated", added: new Date().toISOString().slice(0, 10) };

  const passage = {
    id: passageId,
    title: String(data.title || "New test"),
    genre: String(data.genre || data.category),
    category: data.category,
    wordCount: String(data.text || "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length,
    source: "generated",
    text: data.text,
    meta
  };
  if (passage.wordCount < 350) throw new Error("Passage came back too short");

  const questions = (data.questions || []).map((q, i) => {
    const marks = Number.isInteger(q.marks) ? Math.max(1, Math.min(3, q.marks)) : 1;
    const base = {
      id: `rd-gen-${stamp}-q${i + 1}`,
      subject: "reading", domain: q.domain, passageId,
      marks, stem: q.stem, meta
    };
    if (q.type === "mcq") {
      return { ...base, type: "mcq", marking: "auto", choices: q.choices, answer: q.answer,
        markScheme: { modelAnswer: q.modelAnswer || q.answer } };
    }
    if (q.type === "tick2") {
      return { ...base, type: "tick2", marking: "auto", marks: 2, choices: q.choices, answers: q.answers,
        markScheme: { modelAnswer: q.modelAnswer } };
    }
    return {
      ...base, type: q.type === "open" ? "open" : "short", marking: "ai",
      markScheme: {
        acceptablePoints: (q.acceptablePoints || []).map(pt => ({ point: pt })),
        award: awardFor(marks),
        modelAnswer: q.modelAnswer
      }
    };
  });

  if (questions.length < 6) throw new Error("Too few questions came back");

  const passageIds = new Set([passageId]);
  const problems = [];
  questions.forEach(q => problems.push(...checkQuestion(q, passageIds)));
  if (problems.length) throw new Error("Generated questions failed checks: " + problems[0]);

  return { passage, questions };
}

async function callGenerate(payload) {
  const token = getStore().settings.proxyToken;
  if (!token) throw new Error("Enter the shared key first");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEN_TIMEOUT_MS);
  let res;
  try {
    res = await fetch("api/proxy.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, op: "generate-passage", payload }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json();
  if (!body.ok) {
    const err = new Error(body.error?.message || "Generation failed");
    err.code = body.error?.code;
    throw err;
  }
  return body.data;
}

/*
 * Generate, validate (one automatic retry), persist.
 * onStatus(text) keeps the UI honest during the 1-3 minute wait.
 */
export async function generateReadingTest({ category = "fiction", theme = "" } = {}, onStatus = () => {}) {
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    onStatus(attempt === 1
      ? "Writing your new test… this takes a minute or two."
      : "First draft didn't pass the checks — trying once more…");
    try {
      const data = await callGenerate({ category, theme });
      const { passage, questions } = convert(data);

      const banks = getStore().generatedBanks;
      banks.reading.passages.push(passage);
      banks.reading.questions.push(...questions);
      saveStore();

      onStatus(`Done — “${passage.title}” (${questions.length} questions) is ready.`);
      return passage;
    } catch (err) {
      lastErr = err;
      if (err.code === "rate_limited" || err.code === "unauthorized") break;
    }
  }
  throw lastErr;
}
