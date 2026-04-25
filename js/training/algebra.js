/* training/algebra.js */
/* jshint esversion: 11 */

let algebraSets = [];
let currentSet = null;
let answers = {};
let checked = false;

/* =========================
   Pair validators — named constraints for two-unknown questions
========================= */

const PAIR_VALIDATORS = {
  "sum10_agtb":    (a, b) => ok(a) && ok(b) && a + b === 10 && a > b,
  "diff6_xlt20":   (x, y) => ok(x) && ok(y) && x - y === 6 && x < 20,
  "2a_plus_b_11":  (a, b) => ok(a) && ok(b) && 2 * a + b === 11,
  "prod12_pos":    (m, n) => ok(m) && ok(n) && m * n === 12,
  "3a_plus_2b_16": (a, b) => ok(a) && ok(b) && 3 * a + 2 * b === 16,
  "sum15_plt_q":   (p, q) => ok(p) && ok(q) && p + q === 15 && p < q,
};

function ok(v) {
  return Number.isInteger(v) && v > 0;
}

/* =========================
   Init
========================= */

export function initAlgebra() {
  wireMathsSubTabs();

  const data = window.DATA?.algebra;
  if (!data || !Array.isArray(data.sets)) {
    console.warn("Algebra data not loaded");
    return;
  }

  algebraSets = data.sets;

  populateSetSelect();

  document.getElementById("algebraSetSelect")
    ?.addEventListener("change", loadSelectedSet);

  document.getElementById("algebraCheckBtn")
    ?.addEventListener("click", checkAnswers);

  loadSelectedSet();
}

/* =========================
   Maths sub-tab wiring
========================= */

function wireMathsSubTabs() {
  const subTabs = document.querySelectorAll("[data-maths-tab]");
  const subPanels = document.querySelectorAll(".maths-sub");

  subTabs.forEach(btn => {
    btn.addEventListener("click", () => {
      activateMathsSub(btn.dataset.mathsTab, subTabs, subPanels);
    });
  });

  activateMathsSub("arithmetic", subTabs, subPanels);
}

function activateMathsSub(target, subTabs, subPanels) {
  subTabs.forEach(b =>
    b.classList.toggle("active", b.dataset.mathsTab === target)
  );
  subPanels.forEach(p =>
    p.classList.toggle("hidden", p.id !== `maths-sub-${target}`)
  );
}

/* =========================
   Set select
========================= */

function populateSetSelect() {
  const sel = document.getElementById("algebraSetSelect");
  if (!sel) return;

  sel.innerHTML = "";
  algebraSets.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.label;
    sel.appendChild(opt);
  });
}

function loadSelectedSet() {
  const sel = document.getElementById("algebraSetSelect");
  const setId = sel?.value || algebraSets[0]?.id;
  currentSet = algebraSets.find(s => s.id === setId) || null;

  answers = {};
  checked = false;

  renderSet();

  const checkBtn = document.getElementById("algebraCheckBtn");
  if (checkBtn) checkBtn.disabled = false;

  const scoreEl = document.getElementById("algebraScore");
  if (scoreEl) { scoreEl.textContent = ""; scoreEl.className = ""; }
}

/* =========================
   Render questions
========================= */

function renderSet() {
  const area = document.getElementById("algebraArea");
  if (!area || !currentSet) return;

  area.innerHTML = "";

  currentSet.questions.forEach((q, i) => {
    area.appendChild(renderQuestion(q, i + 1));
  });
}

function renderQuestion(q, num) {
  const wrap = document.createElement("div");
  wrap.className = "q algebra-q";
  wrap.id = `algebra-q-${q.id}`;

  const label = document.createElement("div");
  label.className = "algebra-q-num";
  label.textContent = `Q${num}`;
  wrap.appendChild(label);

  const stem = document.createElement("div");
  stem.className = "stem";
  stem.innerHTML = q.stem;
  wrap.appendChild(stem);

  if (q.type === "short")   wrap.appendChild(makeShortInput(q));
  else if (q.type === "multi")  wrap.appendChild(makeMultiInput(q));
  else if (q.type === "mcq")    wrap.appendChild(makeMcq(q));
  else if (q.type === "pairs")  wrap.appendChild(makePairsInput(q));
  else if (q.type === "reveal") wrap.appendChild(makeRevealPlaceholder());

  /* solution — hidden until Check answers is pressed */
  const sol = document.createElement("div");
  sol.className = "algebra-solution hidden";
  sol.id = `algebra-sol-${q.id}`;
  sol.innerHTML = `<span class="muted">Solution:</span> ${q.solution}`;
  wrap.appendChild(sol);

  return wrap;
}

/* --- input builders --- */

function makeShortInput(q) {
  const row = document.createElement("div");
  row.className = "row";
  row.style.marginTop = "8px";

  if (q.label) {
    const lbl = document.createElement("label");
    lbl.className = "muted";
    lbl.textContent = q.label;
    row.appendChild(lbl);
  }

  const input = document.createElement("input");
  input.type = "text";
  input.className = "algebra-input";
  input.id = `algebra-input-${q.id}`;
  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocorrect", "off");
  input.setAttribute("spellcheck", "false");
  input.addEventListener("input", () => { answers[q.id] = input.value.trim(); });

  row.appendChild(input);
  return row;
}

function makeMultiInput(q) {
  const row = document.createElement("div");
  row.className = "row";
  row.style.marginTop = "8px";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "algebra-input algebra-input--wide";
  input.id = `algebra-input-${q.id}`;
  input.placeholder = q.placeholder || "";
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
    radio.name = `algebra-mcq-${q.id}`;
    radio.value = choice;
    radio.addEventListener("change", () => { answers[q.id] = choice; });
    lbl.appendChild(radio);
    lbl.append(" " + choice);
    wrap.appendChild(lbl);
  });

  return wrap;
}

function makePairsInput(q) {
  const row = document.createElement("div");
  row.className = "row";
  row.style.marginTop = "8px";

  q.labels.forEach((label, i) => {
    const lbl = document.createElement("label");
    lbl.className = "muted";
    lbl.textContent = label + " =";

    const input = document.createElement("input");
    input.type = "number";
    input.className = "algebra-input";
    input.id = `algebra-pair-${q.id}-${i}`;
    input.setAttribute("min", "1");

    row.appendChild(lbl);
    row.appendChild(input);
  });

  return row;
}

function makeRevealPlaceholder() {
  const p = document.createElement("p");
  p.className = "muted";
  p.style.marginTop = "8px";
  p.textContent = 'Press "Check answers" to see the solution.';
  return p;
}

/* =========================
   Check answers
========================= */

function checkAnswers() {
  if (!currentSet || checked) return;
  checked = true;

  let correct = 0;
  let scorable = 0;

  currentSet.questions.forEach(q => {
    const qEl  = document.getElementById(`algebra-q-${q.id}`);
    const solEl = document.getElementById(`algebra-sol-${q.id}`);

    /* reveal — just show solution, not scored */
    if (q.type === "reveal") {
      if (solEl) solEl.classList.remove("hidden");
      return;
    }

    scorable++;

    const isCorrect = checkQuestion(q);
    if (isCorrect) correct++;

    if (qEl) qEl.classList.add(isCorrect ? "algebra-correct" : "algebra-wrong");

    const badge = document.createElement("span");
    badge.className = "algebra-badge " + (isCorrect ? "ok" : "bad");
    badge.textContent = isCorrect ? "✓" : "✗";
    if (qEl) qEl.appendChild(badge);

    if (solEl) solEl.classList.remove("hidden");

    /* disable inputs */
    const inputEl = document.getElementById(`algebra-input-${q.id}`);
    if (inputEl) inputEl.disabled = true;

    if (q.type === "mcq") {
      document.querySelectorAll(`[name="algebra-mcq-${q.id}"]`)
        .forEach(r => r.disabled = true);
    }

    if (q.type === "pairs") {
      q.labels.forEach((_, i) => {
        const el = document.getElementById(`algebra-pair-${q.id}-${i}`);
        if (el) el.disabled = true;
      });
    }
  });

  const scoreEl = document.getElementById("algebraScore");
  if (scoreEl && scorable > 0) {
    const pct = Math.round((correct / scorable) * 100);
    scoreEl.textContent = `Score: ${correct} / ${scorable} (${pct}%)`;
    scoreEl.className = correct === scorable ? "ok" : correct >= Math.ceil(scorable * 0.7) ? "correct" : "bad";
  }

  document.getElementById("algebraCheckBtn").disabled = true;
}

function checkQuestion(q) {
  if (q.type === "short") {
    const given = (answers[q.id] || "").trim();
    return normalise(given) === normalise(q.answer);
  }

  if (q.type === "mcq") {
    return (answers[q.id] || "") === q.answer;
  }

  if (q.type === "multi") {
    const given = (answers[q.id] || "").trim();
    const givenParts = given.split(",").map(s => normalise(s.trim()));
    const correct = q.answers.map(a => normalise(a));
    return (
      givenParts.length === correct.length &&
      givenParts.every((v, i) => v === correct[i])
    );
  }

  if (q.type === "pairs") {
    const vals = q.labels.map((_, i) => {
      const el = document.getElementById(`algebra-pair-${q.id}-${i}`);
      const n = Number(el?.value);
      return Number.isInteger(n) ? n : NaN;
    });
    if (vals.some(isNaN)) return false;
    const validator = PAIR_VALIDATORS[q.validator];
    return validator ? validator(...vals) : false;
  }

  return false;
}

function normalise(str) {
  return str
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/−/g, "-")
    .replace(/×/g, "*")
    .replace(/÷/g, "/");
}
