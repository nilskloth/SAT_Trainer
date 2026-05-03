/* training/reading.js */
/* jshint esversion: 11 */

let allTests = [];
let currentTest = null;
let answers = {};
let checked = false;
let timerInterval = null;
let secondsElapsed = 0;

/* =========================
   Init
========================= */

export function initReading() {
  const data = window.DATA?.reading;
  if (!data || !Array.isArray(data.tests)) {
    console.warn("Reading data not loaded");
    return;
  }
  allTests = data.tests;
  renderTestGrid();

  document.getElementById("readingBackBtn")
    ?.addEventListener("click", showSelectView);
}

export function refreshReadingGrid() {
  const grid = document.getElementById("readingTestGrid");
  if (grid && grid.children.length === 0 && allTests.length > 0) {
    renderTestGrid();
  }
}

/* =========================
   Test selection grid
========================= */

function renderTestGrid() {
  const grid = document.getElementById("readingTestGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const sets = {};
  allTests.forEach(t => {
    if (!sets[t.set]) sets[t.set] = [];
    sets[t.set].push(t);
  });

  Object.entries(sets).forEach(([setName, tests]) => {
    const heading = document.createElement("h4");
    heading.textContent = `Set ${setName}`;
    heading.style.marginBottom = "8px";
    grid.appendChild(heading);

    const row = document.createElement("div");
    row.className = "reading-test-grid";
    grid.appendChild(row);

    tests.forEach(t => {
      const card = document.createElement("div");
      card.className = "reading-test-card";
      card.innerHTML = `
        <div class="reading-test-num">Test ${t.testNumber}</div>
        <div class="reading-test-title">${t.title}</div>
        <div class="muted">${t.genre} · ${t.minutes} min · /${t.totalMarks}</div>
      `;
      card.addEventListener("click", () => startTest(t));
      row.appendChild(card);
    });
  });
}

/* =========================
   Start / stop test
========================= */

function startTest(test) {
  currentTest = test;
  answers = {};
  checked = false;
  secondsElapsed = 0;

  document.getElementById("readingSelectView").classList.add("hidden");
  document.getElementById("readingRunView").classList.remove("hidden");

  document.getElementById("readingTestLabel").textContent =
    `Set ${test.set} · Test ${test.testNumber} · ${test.title}`;

  const checkBtn = document.getElementById("readingCheckBtn");
  if (checkBtn) { checkBtn.disabled = false; }
  const scoreEl = document.getElementById("readingScore");
  if (scoreEl) { scoreEl.textContent = ""; scoreEl.className = ""; }

  document.getElementById("readingPassage").innerHTML = test.passage;
  renderQuestions();
  startTimer();
}

function showSelectView() {
  stopTimer();
  document.getElementById("readingRunView").classList.add("hidden");
  document.getElementById("readingSelectView").classList.remove("hidden");
}

/* =========================
   Timer
========================= */

function startTimer() {
  stopTimer();
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    secondsElapsed++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimerDisplay() {
  const el = document.getElementById("readingTimerDisplay");
  if (!el) return;
  const target = (currentTest?.minutes || 10) * 60;
  const remaining = Math.max(0, target - secondsElapsed);
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  el.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  el.classList.toggle("timer-warn", remaining <= 60 && remaining > 0);
  el.classList.toggle("timer-up", remaining === 0);
}

/* =========================
   Question rendering
========================= */

function renderQuestions() {
  const area = document.getElementById("readingQuestions");
  if (!area || !currentTest) return;
  area.innerHTML = "";

  currentTest.questions.forEach((q, i) => {
    area.appendChild(renderQuestion(q, i + 1));
  });
}

function renderQuestion(q, num) {
  const wrap = document.createElement("div");
  wrap.className = "q reading-q";
  wrap.id = `rq-${q.id}`;

  const header = document.createElement("div");
  header.className = "reading-q-header";
  header.innerHTML = `<span class="reading-q-num">Q${num}</span><span class="muted reading-q-marks">${q.marks} mark${q.marks > 1 ? "s" : ""}</span>`;
  wrap.appendChild(header);

  const stem = document.createElement("div");
  stem.className = "stem";
  stem.innerHTML = q.stem;
  wrap.appendChild(stem);

  if      (q.type === "short")      wrap.appendChild(makeShortInput(q));
  else if (q.type === "multishort") wrap.appendChild(makeMultiShort(q));
  else if (q.type === "mcq")        wrap.appendChild(makeMcq(q));
  else if (q.type === "tick2")      wrap.appendChild(makeTick2(q));
  else if (q.type === "open")       wrap.appendChild(makeOpen(q));
  else if (q.type === "order")      wrap.appendChild(makeOrder(q));
  else if (q.type === "truefalse")  wrap.appendChild(makeTrueFalse(q));
  else if (q.type === "factopin")   wrap.appendChild(makeFactOpin(q));
  else if (q.type === "match")      wrap.appendChild(makeMatch(q));
  else if (q.type === "circle2")    wrap.appendChild(makeCircle2(q));

  const sol = document.createElement("div");
  sol.className = "reading-solution hidden";
  sol.id = `rsol-${q.id}`;
  sol.innerHTML = `<strong>Mark scheme:</strong> ${q.solution}`;
  wrap.appendChild(sol);

  return wrap;
}

/* --- input builders --- */

function makeShortInput(q) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "algebra-input reading-input";
  input.id = `ri-${q.id}`;
  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocorrect", "off");
  input.setAttribute("spellcheck", "false");
  input.addEventListener("input", () => { answers[q.id] = input.value; });
  return input;
}

function makeMcq(q) {
  const wrap = document.createElement("div");
  wrap.className = "choices";
  wrap.style.marginTop = "8px";
  q.choices.forEach(choice => {
    const lbl = document.createElement("label");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = `rmcq-${q.id}`;
    radio.value = choice;
    radio.addEventListener("change", () => { answers[q.id] = choice; });
    lbl.appendChild(radio);
    lbl.append(" " + choice);
    wrap.appendChild(lbl);
  });
  return wrap;
}

function makeTick2(q) {
  const wrap = document.createElement("div");
  wrap.className = "choices";
  wrap.style.marginTop = "8px";
  answers[q.id] = [];
  q.choices.forEach(choice => {
    const lbl = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = choice;
    cb.addEventListener("change", () => {
      const checked = Array.from(wrap.querySelectorAll("input:checked")).map(c => c.value);
      answers[q.id] = checked;
      wrap.querySelectorAll("input").forEach(c => {
        if (!c.checked) c.disabled = checked.length >= 2;
      });
    });
    lbl.appendChild(cb);
    lbl.append(" " + choice);
    wrap.appendChild(lbl);
  });
  return wrap;
}

function makeOpen(q) {
  const wrap = document.createElement("div");
  const ta = document.createElement("textarea");
  ta.className = "reading-open";
  ta.placeholder = "Write your answer here…";
  ta.rows = 4;
  ta.id = `ri-${q.id}`;
  ta.addEventListener("input", () => { answers[q.id] = ta.value; });
  wrap.appendChild(ta);
  return wrap;
}

function makeMultiShort(q) {
  const wrap = document.createElement("div");
  const hint = document.createElement("div");
  hint.className = "muted";
  hint.style.marginBottom = "6px";
  hint.style.fontSize = "12px";
  hint.textContent = `Write ${q.marks} answer${q.marks > 1 ? "s" : ""} — one per line or separated by full stops.`;
  wrap.appendChild(hint);
  const ta = document.createElement("textarea");
  ta.className = "reading-open";
  ta.placeholder = "Answer 1…\nAnswer 2…";
  ta.rows = 4;
  ta.id = `ri-${q.id}`;
  ta.setAttribute("autocorrect", "off");
  ta.setAttribute("spellcheck", "false");
  ta.addEventListener("input", () => { answers[q.id] = ta.value; });
  wrap.appendChild(ta);
  return wrap;
}

function makeOrder(q) {
  const wrap = document.createElement("div");
  wrap.style.marginTop = "8px";
  q.items.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "row reading-order-row";
    const num = document.createElement("input");
    num.type = "number";
    num.min = "1";
    num.max = String(q.items.length);
    num.className = "reading-order-input";
    num.id = `rord-${q.id}-${i}`;
    if (i === q.fixed) {
      num.value = q.order[i];
      num.disabled = true;
    }
    num.addEventListener("input", () => { recordOrder(q); });
    const label = document.createElement("span");
    label.textContent = item;
    row.appendChild(num);
    row.appendChild(label);
    wrap.appendChild(row);
  });
  return wrap;
}

function recordOrder(q) {
  const vals = q.items.map((_, i) => {
    const el = document.getElementById(`rord-${q.id}-${i}`);
    return el ? parseInt(el.value, 10) : NaN;
  });
  answers[q.id] = vals;
}

function makeTrueFalse(q) {
  const wrap = document.createElement("div");
  wrap.style.marginTop = "8px";
  answers[q.id] = {};
  q.statements.forEach((stmt, i) => {
    const row = document.createElement("div");
    row.className = "reading-tf-row";
    const text = document.createElement("span");
    text.textContent = stmt.text;
    const trueLabel = document.createElement("label");
    const trueRadio = document.createElement("input");
    trueRadio.type = "radio";
    trueRadio.name = `rtf-${q.id}-${i}`;
    trueRadio.value = "true";
    trueRadio.addEventListener("change", () => { answers[q.id][i] = true; });
    trueLabel.appendChild(trueRadio);
    trueLabel.append(" True");
    const falseLabel = document.createElement("label");
    const falseRadio = document.createElement("input");
    falseRadio.type = "radio";
    falseRadio.name = `rtf-${q.id}-${i}`;
    falseRadio.value = "false";
    falseRadio.addEventListener("change", () => { answers[q.id][i] = false; });
    falseLabel.appendChild(falseRadio);
    falseLabel.append(" False");
    row.appendChild(text);
    row.appendChild(trueLabel);
    row.appendChild(falseLabel);
    wrap.appendChild(row);
  });
  return wrap;
}

function makeFactOpin(q) {
  const wrap = document.createElement("div");
  wrap.style.marginTop = "8px";
  answers[q.id] = {};
  q.statements.forEach((stmt, i) => {
    const row = document.createElement("div");
    row.className = "reading-tf-row";
    const text = document.createElement("span");
    text.textContent = stmt.text;
    const factLabel = document.createElement("label");
    const factRadio = document.createElement("input");
    factRadio.type = "radio";
    factRadio.name = `rfo-${q.id}-${i}`;
    factRadio.value = "fact";
    factRadio.addEventListener("change", () => { answers[q.id][i] = "fact"; });
    factLabel.appendChild(factRadio);
    factLabel.append(" Fact");
    const opinLabel = document.createElement("label");
    const opinRadio = document.createElement("input");
    opinRadio.type = "radio";
    opinRadio.name = `rfo-${q.id}-${i}`;
    opinRadio.value = "opinion";
    opinRadio.addEventListener("change", () => { answers[q.id][i] = "opinion"; });
    opinLabel.appendChild(opinRadio);
    opinLabel.append(" Opinion");
    row.appendChild(text);
    row.appendChild(factLabel);
    row.appendChild(opinLabel);
    wrap.appendChild(row);
  });
  return wrap;
}

function makeMatch(q) {
  const wrap = document.createElement("div");
  wrap.style.marginTop = "8px";
  answers[q.id] = {};
  q.lefts.forEach((left, i) => {
    const row = document.createElement("div");
    row.className = "row reading-match-row";
    const leftEl = document.createElement("span");
    leftEl.className = "reading-match-left";
    leftEl.textContent = left;
    const sel = document.createElement("select");
    sel.className = "reading-match-select";
    sel.id = `rmatch-${q.id}-${i}`;
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "— select —";
    sel.appendChild(blank);
    q.rights.forEach((right, ri) => {
      const opt = document.createElement("option");
      opt.value = String(ri);
      opt.textContent = right;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", () => {
      answers[q.id][i] = parseInt(sel.value, 10);
    });
    row.appendChild(leftEl);
    row.appendChild(sel);
    wrap.appendChild(row);
  });
  return wrap;
}

function makeCircle2(q) {
  const wrap = document.createElement("div");
  answers[q.id] = {};
  q.groups.forEach((group, gi) => {
    const row = document.createElement("div");
    row.style.marginTop = "10px";
    const prefix = document.createElement("div");
    prefix.className = "muted";
    prefix.style.marginBottom = "4px";
    prefix.textContent = group.prefix;
    row.appendChild(prefix);
    const choices = document.createElement("div");
    choices.className = "choices";
    group.choices.forEach(choice => {
      const lbl = document.createElement("label");
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `rcircle-${q.id}-${gi}`;
      radio.value = choice;
      radio.addEventListener("change", () => { answers[q.id][gi] = choice; });
      lbl.appendChild(radio);
      lbl.append(" " + choice);
      choices.appendChild(lbl);
    });
    row.appendChild(choices);
    wrap.appendChild(row);
  });
  return wrap;
}

/* =========================
   Check answers
========================= */

export function checkReadingAnswers() {
  if (!currentTest || checked) return;
  checked = true;
  stopTimer();

  let earned = 0;
  let possible = 0;

  currentTest.questions.forEach(q => {
    const qEl  = document.getElementById(`rq-${q.id}`);
    const solEl = document.getElementById(`rsol-${q.id}`);
    if (solEl) solEl.classList.remove("hidden");

    const result = scoreQuestion(q);
    earned += result.earned;
    possible += result.possible;

    const isFullMark = result.earned === result.possible;
    const isPartial = result.earned > 0 && !isFullMark;

    if (qEl) {
      if (q.type === "open") {
        qEl.classList.add("reading-open-q");
      } else {
        qEl.classList.add(isFullMark ? "algebra-correct" : isPartial ? "reading-partial" : "algebra-wrong");
        const badge = document.createElement("span");
        badge.className = "algebra-badge " + (isFullMark ? "ok" : isPartial ? "warn" : "bad");
        badge.textContent = `${result.earned}/${result.possible}`;
        qEl.appendChild(badge);
      }
    }

    disableInputs(q);
  });

  const scoreEl = document.getElementById("readingScore");
  if (scoreEl) {
    const pct = Math.round((earned / possible) * 100);
    scoreEl.textContent = `Score: ${earned} / ${possible} (${pct}%)`;
    scoreEl.className = earned === possible ? "ok" : earned >= Math.ceil(possible * 0.7) ? "correct" : "bad";
  }

  document.getElementById("readingCheckBtn").disabled = true;
}

function scoreQuestion(q) {
  const possible = q.marks;

  if (q.type === "open") {
    return { earned: 0, possible };
  }

  if (q.type === "multishort") {
    return scoreMultiShort(q, possible);
  }

  if (q.type === "short") {
    const el = document.getElementById(`ri-${q.id}`);
    const raw = el ? el.value : (answers[q.id] || "");
    const given = normalise(raw);
    const givenTokens = tokenise(raw);
    const correct = given && q.accept.some(a => {
      const target = normalise(a);
      if (given.includes(target)) return true;
      return wordsMatch(givenTokens, tokenise(a));
    });
    return { earned: correct ? 1 : 0, possible };
  }

  if (q.type === "mcq") {
    return { earned: (answers[q.id] || "") === q.answer ? 1 : 0, possible };
  }

  if (q.type === "tick2") {
    const given = (answers[q.id] || []).slice().sort().join("|");
    const expected = q.answers.slice().sort().join("|");
    return { earned: given === expected ? 2 : 0, possible };
  }

  if (q.type === "order") {
    const given = answers[q.id] || [];
    const allMatch = q.order.every((pos, i) => given[i] === pos);
    return { earned: allMatch ? 1 : 0, possible };
  }

  if (q.type === "truefalse") {
    const given = answers[q.id] || {};
    const allMatch = q.statements.every((s, i) => given[i] === s.answer);
    return { earned: allMatch ? 1 : 0, possible };
  }

  if (q.type === "factopin") {
    const given = answers[q.id] || {};
    const allMatch = q.statements.every((s, i) => {
      const expected = s.fact ? "fact" : "opinion";
      return given[i] === expected;
    });
    return { earned: allMatch ? 1 : 0, possible };
  }

  if (q.type === "match") {
    const given = answers[q.id] || {};
    const allMatch = q.correct.every((rightIdx, i) => given[i] === rightIdx);
    return { earned: allMatch ? 1 : 0, possible };
  }

  if (q.type === "circle2") {
    let earned = 0;
    q.groups.forEach((group, gi) => {
      if ((answers[q.id] || {})[gi] === group.answer) earned++;
    });
    return { earned, possible };
  }

  return { earned: 0, possible };
}

function disableInputs(q) {
  const el = document.getElementById(`ri-${q.id}`);
  if (el) el.disabled = true;

  if (q.type === "mcq" || q.type === "tick2") {
    document.querySelectorAll(`[name^="rmcq-${q.id}"], [name^="rtf-${q.id}"], input[type=checkbox][value]`)
      .forEach(i => i.disabled = true);
  }
  if (q.type === "tick2") {
    document.querySelectorAll(`#rq-${q.id} input[type=checkbox]`)
      .forEach(i => i.disabled = true);
  }
  if (q.type === "mcq") {
    document.querySelectorAll(`[name="rmcq-${q.id}"]`)
      .forEach(i => i.disabled = true);
  }
  if (q.type === "order") {
    q.items.forEach((_, i) => {
      const n = document.getElementById(`rord-${q.id}-${i}`);
      if (n) n.disabled = true;
    });
  }
  if (q.type === "truefalse") {
    q.statements.forEach((_, i) => {
      document.querySelectorAll(`[name="rtf-${q.id}-${i}"]`)
        .forEach(r => r.disabled = true);
    });
  }
  if (q.type === "factopin") {
    q.statements.forEach((_, i) => {
      document.querySelectorAll(`[name="rfo-${q.id}-${i}"]`)
        .forEach(r => r.disabled = true);
    });
  }
  if (q.type === "match") {
    q.lefts.forEach((_, i) => {
      const s = document.getElementById(`rmatch-${q.id}-${i}`);
      if (s) s.disabled = true;
    });
  }
  if (q.type === "circle2") {
    q.groups.forEach((_, gi) => {
      document.querySelectorAll(`[name="rcircle-${q.id}-${gi}"]`)
        .forEach(r => r.disabled = true);
    });
  }
}

const STOPWORDS = new Set([
  "a","an","the","is","are","was","were","be","been","being",
  "have","has","had","do","does","did","will","would","could",
  "should","may","might","must","it","its","in","on","at","to",
  "of","and","or","but","so","for","by","as","with","from",
  "into","than","this","that","there","they","their","he","she",
  "we","you","i","my","his","her","our","your","them","us","me"
]);

function normalise(str) {
  return String(str)
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenise(str) {
  return normalise(str).split(" ").filter(Boolean);
}

/* Checks whether every SIGNIFICANT word in `target` appears in `given`,
   with simple plural tolerance. Stopwords in target are ignored so
   "no rain for months" can match "not been rain". */
function wordsMatch(givenTokens, targetTokens) {
  const sig = targetTokens.filter(w => !STOPWORDS.has(w));
  if (sig.length === 0) return false;
  return sig.every(tw =>
    givenTokens.some(gw =>
      gw === tw ||
      gw + "s" === tw ||
      tw + "s" === gw
    )
  );
}

/* Scores a multishort question.
   q.accept is an array of groups; each group is an array of synonymous phrases.
   The user writes multiple answers in one textarea (separated by newlines / full stops).
   Each group that matches any part of the user's answer earns 1 mark. */
function scoreMultiShort(q, possible) {
  const el = document.getElementById(`ri-${q.id}`);
  const raw = el ? el.value : (answers[q.id] || "");
  if (!raw.trim()) return { earned: 0, possible };

  const parts = raw
    .split(/[.?!\n;]+/)
    .map(s => s.trim())
    .filter(Boolean);
  const allParts = [...parts, raw];

  let earned = 0;
  q.accept.forEach(group => {
    const phrases = Array.isArray(group) ? group : [group];
    const matched = allParts.some(part => {
      const g = normalise(part);
      const gTokens = tokenise(part);
      return phrases.some(phrase => {
        const target = normalise(phrase);
        if (g.includes(target)) return true;
        return wordsMatch(gTokens, tokenise(phrase));
      });
    });
    if (matched) earned++;
  });

  return { earned: Math.min(earned, possible), possible };
}
