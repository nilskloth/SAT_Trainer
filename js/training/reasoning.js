/* training/reasoning.js */
/* jshint esversion: 11 */

import { pickN } from "../utils.js";

const STRAND_LABELS = {
  large_numbers: "Large Numbers",
  place_value:   "Place Value",
  ordering:      "Ordering",
  rounding:      "Rounding",
  negative:      "Negative Numbers",
  roman:         "Roman Numerals"
};

const SET_SIZE = 10;

let allQuestions = [];
let currentQuestions = [];
let answers = {};
let checked = false;

/* =========================
   Init
========================= */

export function initReasoning() {
  const data = window.DATA?.reasoning;
  if (!data || !Array.isArray(data.questions)) {
    console.warn("Reasoning data not loaded");
    return;
  }

  allQuestions = data.questions;
  populateStrandSelect();

  document.getElementById("reasoningNewBtn")
    ?.addEventListener("click", newSet);

  document.getElementById("reasoningCheckBtn")
    ?.addEventListener("click", checkAnswers);

  newSet();
}

/* =========================
   Topic filter
========================= */

function populateStrandSelect() {
  const sel = document.getElementById("reasoningStrandSelect");
  if (!sel) return;

  const strands = [...new Set(allQuestions.map(q => q.strand))];
  sel.innerHTML = '<option value="all">All topics</option>';

  strands.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = STRAND_LABELS[s] || s;
    sel.appendChild(opt);
  });
}

/* =========================
   New set
========================= */

function newSet() {
  const strand = document.getElementById("reasoningStrandSelect")?.value || "all";
  const pool = strand === "all"
    ? allQuestions
    : allQuestions.filter(q => q.strand === strand);

  currentQuestions = pickN(pool, Math.min(SET_SIZE, pool.length));
  answers = {};
  checked = false;

  renderSet();

  const checkBtn = document.getElementById("reasoningCheckBtn");
  if (checkBtn) checkBtn.disabled = false;

  const scoreEl = document.getElementById("reasoningScore");
  if (scoreEl) { scoreEl.textContent = ""; scoreEl.className = ""; }
}

/* =========================
   Render questions
========================= */

function renderSet() {
  const area = document.getElementById("reasoningArea");
  if (!area) return;
  area.innerHTML = "";
  currentQuestions.forEach((q, i) => {
    area.appendChild(renderQuestion(q, i + 1));
  });
}

function renderQuestion(q, num) {
  const wrap = document.createElement("div");
  wrap.className = "q algebra-q";
  wrap.id = `reasoning-q-${q.id}`;

  const label = document.createElement("div");
  label.className = "algebra-q-num";
  label.textContent = `Q${num}`;
  wrap.appendChild(label);

  const stem = document.createElement("div");
  stem.className = "stem";
  stem.innerHTML = q.stem;
  wrap.appendChild(stem);

  if (q.type === "short") wrap.appendChild(makeShortInput(q));
  else if (q.type === "mcq") wrap.appendChild(makeMcq(q));

  const sol = document.createElement("div");
  sol.className = "algebra-solution hidden";
  sol.id = `reasoning-sol-${q.id}`;
  sol.innerHTML = `<span class="muted">Solution:</span> ${q.solution}`;
  wrap.appendChild(sol);

  return wrap;
}

function makeShortInput(q) {
  const row = document.createElement("div");
  row.className = "row";
  row.style.marginTop = "8px";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "algebra-input";
  input.id = `reasoning-input-${q.id}`;
  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocorrect", "off");
  input.setAttribute("spellcheck", "false");
  input.addEventListener("input", () => { answers[q.id] = input.value.trim(); });

  row.appendChild(input);
  return row;
}

function makeMcq(q) {
  const wrap = document.createElement("div");
  wrap.className = "choices";
  wrap.style.marginTop = "8px";

  q.choices.forEach(choice => {
    const lbl = document.createElement("label");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = `reasoning-mcq-${q.id}`;
    radio.value = choice;
    radio.addEventListener("change", () => { answers[q.id] = choice; });
    lbl.appendChild(radio);
    lbl.append(" " + choice);
    wrap.appendChild(lbl);
  });

  return wrap;
}

/* =========================
   Check answers
========================= */

function checkAnswers() {
  if (!currentQuestions.length || checked) return;
  checked = true;

  let correct = 0;
  const total = currentQuestions.length;

  currentQuestions.forEach(q => {
    const qEl  = document.getElementById(`reasoning-q-${q.id}`);
    const solEl = document.getElementById(`reasoning-sol-${q.id}`);

    const isCorrect = checkQuestion(q);
    if (isCorrect) correct++;

    if (qEl) qEl.classList.add(isCorrect ? "algebra-correct" : "algebra-wrong");

    const badge = document.createElement("span");
    badge.className = "algebra-badge " + (isCorrect ? "ok" : "bad");
    badge.textContent = isCorrect ? "✓" : "✗";
    if (qEl) qEl.appendChild(badge);

    if (solEl) solEl.classList.remove("hidden");

    const inputEl = document.getElementById(`reasoning-input-${q.id}`);
    if (inputEl) inputEl.disabled = true;

    if (q.type === "mcq") {
      document.querySelectorAll(`[name="reasoning-mcq-${q.id}"]`)
        .forEach(r => r.disabled = true);
    }
  });

  const scoreEl = document.getElementById("reasoningScore");
  if (scoreEl) {
    const pct = Math.round((correct / total) * 100);
    scoreEl.textContent = `Score: ${correct} / ${total} (${pct}%)`;
    scoreEl.className = correct === total ? "ok" : correct >= Math.ceil(total * 0.7) ? "correct" : "bad";
  }

  document.getElementById("reasoningCheckBtn").disabled = true;
}

function checkQuestion(q) {
  if (q.type === "short") {
    return normalise(answers[q.id] || "") === normalise(q.answer);
  }
  if (q.type === "mcq") {
    return (answers[q.id] || "") === q.answer;
  }
  return false;
}

/* Strips commas/spaces, normalises minus sign, uppercases (handles Roman numerals case-insensitively) */
function normalise(str) {
  return str
    .trim()
    .replace(/,/g, "")
    .replace(/−/g, "-")
    .replace(/\s+/g, "")
    .toUpperCase();
}
