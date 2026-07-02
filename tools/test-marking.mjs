/* =========================================================
   Fixture tests for js/core/marking.js (must stay DOM-free).
   Usage: node tools/test-marking.mjs
   ========================================================= */

import { mark, marksFromSelfTicks } from "../js/core/marking.js";

let passed = 0;
let failed = 0;

function expect(label, q, answer, earned) {
  const r = mark(q, answer);
  const got = r.status === "needs-ai" ? "needs-ai" : r.earned;
  if (got === earned) {
    passed++;
  } else {
    failed++;
    console.error(`✗ ${label}: expected ${earned}, got ${got}`);
  }
}

/* mcq */
const mcq = { type: "mcq", marks: 1, choices: ["a", "b"], answer: "b" };
expect("mcq right", mcq, "b", 1);
expect("mcq wrong", mcq, "a", 0);

/* tick2 — order-independent */
const tick2 = { type: "tick2", marks: 2, choices: ["x", "y", "z"], answers: ["x", "z"] };
expect("tick2 right order", tick2, ["x", "z"], 2);
expect("tick2 reversed", tick2, ["z", "x"], 2);
expect("tick2 one wrong", tick2, ["x", "y"], 0);
expect("tick2 too few", tick2, ["x"], 0);

/* truefalse */
const tf = { type: "truefalse", marks: 1, statements: [{ text: "s1", answer: true }, { text: "s2", answer: false }] };
expect("truefalse right", tf, [true, false], 1);
expect("truefalse wrong", tf, [true, true], 0);

/* factopin */
const fo = { type: "factopin", marks: 1, statements: [{ text: "s1", fact: true }, { text: "s2", fact: false }] };
expect("factopin right", fo, ["fact", "opinion"], 1);
expect("factopin wrong", fo, ["opinion", "opinion"], 0);

/* match */
const match = { type: "match", marks: 1, lefts: ["1892", "1896"], rights: ["shop", "gliders"], correct: [0, 1] };
expect("match right", match, [0, 1], 1);
expect("match swapped", match, [1, 0], 0);

/* order */
const order = { type: "order", marks: 1, items: ["a", "b", "c"], order: [2, 1, 3] };
expect("order right", order, [2, 1, 3], 1);
expect("order strings", order, ["2", "1", "3"], 1);
expect("order wrong", order, [1, 2, 3], 0);

/* short-closed — text + expression normalisation */
const sc = { type: "short-closed", marks: 1, accept: ["She ran towards the gate."] };
expect("short-closed exact", sc, "She ran towards the gate.", 1);
expect("short-closed no punct/case", sc, "she ran towards the gate", 1);
expect("short-closed wrong", sc, "She runs towards the gate.", 0);
const expr = { type: "short-closed", marks: 1, accept: ["3n+2"] };
expect("expr spaces", expr, "3n + 2", 1);
expect("expr unicode times", { type: "short-closed", marks: 1, accept: ["3*n"] }, "3×n", 1);

/* numeric — commas, spaces, unicode minus */
const num = { type: "numeric", marks: 1, answer: "999900" };
expect("numeric plain", num, "999900", 1);
expect("numeric commas", num, "999,900", 1);
expect("numeric spaced", num, "999 900", 1);
expect("numeric wrong", num, "99900", 0);
expect("numeric negative unicode", { type: "numeric", marks: 1, answer: "-7" }, "−7", 1);
expect("numeric decimal eq", { type: "numeric", marks: 1, answer: "0.5" }, ".5", 1);

/* multi */
const multi = { type: "multi", marks: 1, answers: ["23", "28"] };
expect("multi right", multi, "23, 28", 1);
expect("multi array", multi, ["23", "28"], 1);
expect("multi wrong order", multi, "28, 23", 0);
expect("multi missing", multi, "23", 0);

/* pairs */
const pairs = { type: "pairs", marks: 1, labels: ["a", "b"], validator: "sum10_agtb" };
expect("pairs valid", pairs, ["7", "3"], 1);
expect("pairs sum wrong", pairs, ["5", "4"], 0);
expect("pairs a not > b", pairs, ["5", "5"], 0);
expect("pairs non-integer", pairs, ["7.5", "2.5"], 0);

/* tokens */
const tokens = { type: "tokens", marks: 1, sentence: "The cat slept on the sofa.", tokenIndices: [1, 5] };
expect("tokens right", tokens, [1, 5], 1);
expect("tokens reversed", tokens, [5, 1], 1);
expect("tokens extra", tokens, [1, 5, 2], 0);
expect("tokens missing", tokens, [1], 0);

/* roles — per-part credit */
const roles = {
  type: "roles", marks: 3, sentence: "The dog bit the postman.",
  parts: [
    { role: "subject", answer: [0, 1] },
    { role: "verb", answer: [2] },
    { role: "object", answer: [3, 4] }
  ]
};
expect("roles all right", roles, [[0, 1], [2], [3, 4]], 3);
expect("roles two of three", roles, [[0, 1], [2], [4]], 2);
expect("roles none", roles, [[], [], []], 0);

/* circle2 — per-group credit */
const c2 = {
  type: "circle2", marks: 2,
  groups: [
    { choices: ["in a tunnel.", "in a park."], answer: "in a tunnel." },
    { choices: ["long distances.", "nowhere."], answer: "long distances." }
  ]
};
expect("circle2 both", c2, ["in a tunnel.", "long distances."], 2);
expect("circle2 one", c2, ["in a tunnel.", "nowhere."], 1);

/* spelling + prefix */
expect("spelling right", { type: "spelling", marks: 1, word: "necessary" }, "Necessary", 1);
expect("spelling wrong", { type: "spelling", marks: 1, word: "necessary" }, "neccessary", 0);
expect("prefix right", { type: "prefix", marks: 1, root: "happy", prefix: "un", options: ["un", "dis"] }, "un", 1);

/* AI types defer */
expect("short needs ai", { type: "short", marks: 1, markScheme: {} }, "anything", "needs-ai");
expect("open needs ai", { type: "open", marks: 2, markScheme: {} }, "anything", "needs-ai");

/* self-mark ticks */
if (marksFromSelfTicks({ marks: 2 }, 3) !== 2) { failed++; console.error("✗ selfticks cap"); } else passed++;
if (marksFromSelfTicks({ marks: 2 }, 1) !== 1) { failed++; console.error("✗ selfticks one"); } else passed++;

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
