/* =========================
   Arithmetic training (ES module)
========================= */
/* jshint esversion: 11 */

import { randInt, pickN } from "../utils.js";
import { renderQuestionList } from "../runner/render.js";

let ARITH_STATE = null;

export function genArithmeticSet(n, difficulty) {
  const qs = [];
  for (let i = 0; i < n; i += 1) {
    qs.push(makeQuestion("a" + (i + 1), difficulty));
  }
  return qs;
}

export function initArithmetic() {
  const newBtn = document.getElementById("arithNewBtn");
  const scoreBtn = document.getElementById("arithScoreBtn");

  if (!newBtn || !scoreBtn) return;

  newBtn.addEventListener("click", newSet);
  scoreBtn.addEventListener("click", scoreSet);
}

function newSet() {
  const difficulty = document.getElementById("arithDifficulty").value;
  const area = document.getElementById("arithArea");

  ARITH_STATE = {
    questions: genArithmeticSet(10, difficulty),
    answers: {}
  };

  area.innerHTML = "";
  area.appendChild(
    renderQuestionList(ARITH_STATE.questions, ARITH_STATE.answers, { showChoices: false })
  );

  document.getElementById("arithScoreBtn").disabled = false;

  const pad = document.getElementById("arithScratchpad");
  if (pad) pad.value = "";
  document.getElementById("arithScoreLine").textContent = "—";
}

function makeQuestion(id, difficulty) {
  const type = pickType(difficulty);
  let stem = "";
  let answer = "";

  if (type === "add") {
    const a = randInt(100, 9000);
    const b = randInt(100, 9000);
    stem = `${a} + ${b} =`;
    answer = String(a + b);
  } else if (type === "sub") {
    const a = randInt(100, 9000);
    const b = randInt(1, a);
    stem = `${a} − ${b} =`;
    answer = String(a - b);
  } else if (type === "mul") {
    const a = randInt(12, 999);
    const b = randInt(2, 12);
    stem = `${a} × ${b} =`;
    answer = String(a * b);
  } else if (type === "div") {
    const b = randInt(2, 12);
    const a = b * randInt(12, 99);
    stem = `${a} ÷ ${b} =`;
    answer = String(a / b);
  }

  return { id, type: "short", stem, answer };
}

function pickType(difficulty) {
  if (difficulty === "easy") return pickN(["add", "sub"], 1)[0];
  if (difficulty === "hard") return pickN(["mul", "div"], 1)[0];
  return pickN(["add", "sub", "mul", "div"], 1)[0];
}

function scoreSet() {
  if (!ARITH_STATE) return;

  let score = 0;
  const total = ARITH_STATE.questions.length;

  ARITH_STATE.questions.forEach(function (q) {
    const given = ARITH_STATE.answers[q.id];
    const normalised = String(given || "").trim().replace(/,/g, "").replace(/\s/g, "");
    if (normalised && normalised === q.answer) score += 1;
  });

  document.getElementById("arithScoreLine").textContent =
    `Score: ${score} / ${total} (${Math.round((score / total) * 100)}%)`;
}