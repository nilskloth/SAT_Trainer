/* =========================================================
   Arithmetic Paper 1 generator — ported from v1
   training/arithmetic.js and shaped to the real paper:
   36 questions / 40 marks (long multiplication and long
   division are worth 2), Y6 coverage across the 6C/6F codes.
   ========================================================= */

import { randInt, pickN } from "../core/utils.js";

function q(stem, answer, domain, marks = 1) {
  return {
    id: `ar-${Math.random().toString(36).slice(2, 9)}`,
    subject: "maths", strand: "calculation", domain,
    type: "numeric", marking: "auto", marks,
    stem: `<strong>${stem}</strong>`,
    answer: String(answer),
    markScheme: { modelAnswer: String(answer) }
  };
}

const MAKERS = [
  () => { const a = randInt(1000, 99999), b = randInt(100, 9999); return q(`${a.toLocaleString("en-GB")} + ${b.toLocaleString("en-GB")} =`, a + b, "6C1"); },
  () => { const b = randInt(100, 9999), a = randInt(b, 99999); return q(`${a.toLocaleString("en-GB")} − ${b.toLocaleString("en-GB")} =`, a - b, "6C1"); },
  () => { const a = randInt(2, 12), b = randInt(2, 12); return q(`${a} × ${b} =`, a * b, "6C6"); },
  () => { const b = randInt(2, 12), ans = randInt(2, 12); return q(`${b * ans} ÷ ${b} =`, ans, "6C6"); },
  () => { const a = randInt(11, 99), b = randInt(11, 99); return q(`${a} × ${b} =`, a * b, "6C7a"); },
  () => { const a = randInt(100, 999), b = randInt(11, 99); return q(`${a} × ${b} =`, a * b, "6C7a", 2); },
  () => { const b = randInt(11, 19), ans = randInt(12, 89); return q(`${b * ans} ÷ ${b} =`, ans, "6C7b", 2); },
  () => { const a = randInt(2, 9), p = pickN([10, 100, 1000], 1)[0]; return q(`${a} × ${p.toLocaleString("en-GB")} =`, a * p, "6C6"); },
  () => { const ans = randInt(2, 99), p = pickN([10, 100], 1)[0]; return q(`${ans * p} ÷ ${p} =`, ans, "6C6"); },
  () => { const a = randInt(10, 99) / 100, b = randInt(10, 99) / 100; return q(`${a} + ${b} =`, Math.round((a + b) * 100) / 100, "6F9a"); },
  () => { const b = randInt(10, 89) / 100, a = Math.round((b + randInt(10, 99) / 100) * 100) / 100; return q(`${a} − ${b} =`, Math.round((a - b) * 100) / 100, "6F9a"); },
  () => { const d = pickN([2, 4, 5, 10], 1)[0], n = randInt(1, d - 1), w = randInt(2, 9) * d; return q(`${n}/${d} of ${w} =`, (w / d) * n, "6F5b"); },
  () => { const p = pickN([10, 25, 50], 1)[0], w = randInt(2, 9) * 4; return q(`${p}% of ${w} =`, (w * p) / 100, "6R2"); },
  () => { const a = randInt(2, 9); return q(`${a}² =`, a * a, "6C5"); },
  () => { const a = randInt(2, 30), b = randInt(2, 30), c = randInt(2, 12); return q(`${a} + ${b} × ${c} =`, a + b * c, "6C9"); }
];

export function generateArithmeticPaper() {
  const questions = [];
  let marks = 0;
  let i = 0;
  while (marks < 40 && questions.length < 36) {
    const make = MAKERS[i % MAKERS.length];
    const item = make();
    if (marks + item.marks > 40) { i++; continue; }
    questions.push(item);
    marks += item.marks;
    i++;
  }
  return questions;
}
