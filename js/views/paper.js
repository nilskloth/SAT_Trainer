/* =========================================================
   Paper runner: blueprint covers → timed paper → marking
   → results. Free-text questions self-mark in Phase 2;
   Phase 3 tries the AI marker first and falls back here.
   ========================================================= */

import { getData } from "../core/loader.js";
import { recordAttempt } from "../core/store.js";
import { mark } from "../core/marking.js";
import { markAI } from "../core/ai.js";
import { pickN, esc } from "../core/utils.js";
import { renderQuestion, collectAnswer, hasAnswer, showResult, showPending } from "../render/question.js";
import { renderSelfMark } from "../render/selfmark.js";
import { generateArithmeticPaper } from "../gen/arithmetic.js";

const DOMAIN_LABELS = {
  "2a": "Word meanings", "2b": "Finding information", "2c": "Summarising",
  "2d": "Inference", "2e": "Predicting", "2f": "Text structure",
  "2g": "Language choices", "2h": "Comparing",
  G1: "Word classes", G2: "Sentence types", G3: "Clauses & phrases",
  G4: "Verbs & tenses", G5: "Punctuation", G6: "Vocabulary", G7: "Standard English"
};

export function domainLabel(domain) {
  return DOMAIN_LABELS[domain] || domain;
}

/* =========================
   Paper selection (covers)
========================= */

export function renderPapers(el, params = []) {
  if (params.length) return startPaper(el, params[0]);

  const { papers } = getData();
  el.innerHTML = `<div class="subject-grid"></div>`;
  const grid = el.querySelector(".subject-grid");

  papers.forEach(p => {
    const a = document.createElement("a");
    a.className = "subject-card";
    a.href = `#/papers/${p.id}`;
    a.dataset.subject = p.subject;
    a.innerHTML = `
      <div class="subject-card-band"></div>
      <div class="subject-card-body">
        <strong>${esc(p.label)}</strong>
        <span>${p.minutes} minutes · ${p.totalMarks} marks</span>
      </div>`;
    grid.appendChild(a);
  });
}

/* =========================
   Question assembly
========================= */

function assemble(paper) {
  const data = getData();

  if (paper.id === "reading") {
    const withQs = data.reading.passages.filter(pg =>
      data.reading.questions.some(q => q.passageId === pg.id));
    const passage = pickN(withQs, 1)[0];
    if (!passage) return null;
    const questions = data.reading.questions.filter(q => q.passageId === passage.id);
    return { passage, questions };
  }

  if (paper.id === "gps1") {
    const byDomain = {};
    data.gps.questions.forEach(q => (byDomain[q.domain] = byDomain[q.domain] || []).push(q));
    const questions = [];
    Object.entries(paper.domainQuotas || {}).forEach(([dom, quota]) => {
      questions.push(...pickN(byDomain[dom] || [], quota));
    });
    return { questions: pickN(questions, questions.length) };
  }

  if (paper.kind === "arithmetic") {
    return { questions: generateArithmeticPaper() };
  }

  if (paper.kind === "reasoning") {
    const pool = data.maths.questions.filter(q => q.domain?.[1] !== "A" || Math.random() < 0.3);
    const nra = pool.filter(q => ["number", "calculation", "fractions", "ratio", "algebra"].includes(q.strand));
    const rest = pool.filter(q => !["number", "calculation", "fractions", "ratio", "algebra"].includes(q.strand));
    const questions = [...pickN(nra, 28), ...pickN(rest, 7)];
    return { questions: pickN(questions, questions.length) };
  }

  return null;
}

/* =========================
   Running a paper
========================= */

let timerHandle = null;

function stopTimer() {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
}

function startPaper(el, paperId) {
  stopTimer();
  const paper = getData().papers.find(p => p.id === paperId);
  if (!paper) { location.hash = "#/papers"; return; }

  if (paper.subject === "spelling") {
    el.innerHTML = `<div class="card"><h2 style="margin-top:0;">${esc(paper.label)}</h2>
      <p class="muted">The spoken spelling paper arrives with the practice tools (Phase 4).</p>
      <a class="btn" href="#/papers">Back to papers</a></div>`;
    return;
  }

  const set = assemble(paper);
  if (!set || !set.questions.length) {
    el.innerHTML = `<div class="card"><p>No questions available for this paper yet.</p>
      <a class="btn" href="#/papers">Back to papers</a></div>`;
    return;
  }

  el.dataset.subject = paper.subject;
  el.innerHTML = `
    <div class="paper-cover" data-subject="${paper.subject}" style="margin-bottom:var(--sp-4);">
      <div class="paper-cover-band">Key stage 2 practice</div>
      <div class="paper-cover-body">
        <h2>${esc(paper.label)}</h2>
        <p class="paper-cover-meta">${paper.minutes} minutes · ${set.questions.reduce((s, q) => s + q.marks, 0)} marks${set.passage ? ` · ${esc(set.passage.title)}` : ""}</p>
        <p>${esc(paper.instructions || "")}</p>
        <button class="primary" data-start>Start</button>
        <a class="btn quiet" href="#/papers">Back</a>
      </div>
    </div>
    <div data-run class="hidden"></div>
  `;

  el.querySelector("[data-start]").addEventListener("click", () => {
    el.querySelector(".paper-cover").classList.add("hidden");
    runPaper(el.querySelector("[data-run]"), paper, set);
  });
}

function runPaper(root, paper, set) {
  root.classList.remove("hidden");
  root.dataset.subject = paper.subject;

  root.innerHTML = `
    <div class="run-bar">
      <h2>${esc(paper.label)}</h2>
      <span class="timer-pill" data-timer></span>
    </div>
    ${set.passage ? `
      <div class="passage-split" data-subject="${paper.subject}">
        <div class="passage-pane">
          <div class="passage-title">${esc(set.passage.genre || "")}</div>
          <h3 style="margin-top:0;font-family:var(--font-passage);">${esc(set.passage.title)}</h3>
          <div class="passage-text">${set.passage.text}</div>
        </div>
        <div class="paper-sheet" data-questions></div>
      </div>` : `
      <div class="paper-sheet" data-subject="${paper.subject}" data-questions></div>`}
    <div style="margin-top:var(--sp-4);display:flex;gap:var(--sp-3);align-items:center;">
      <button class="primary" data-check>Check my answers</button>
      <span class="muted" data-status></span>
    </div>
    <div data-summary style="margin-top:var(--sp-4);"></div>
  `;

  const sheet = root.querySelector("[data-questions]");
  const els = new Map();
  set.questions.forEach((q, i) => {
    const qEl = renderQuestion(q, i + 1);
    els.set(q.id, qEl);
    sheet.appendChild(qEl);
  });

  /* Quiet countdown */
  const timerEl = root.querySelector("[data-timer]");
  const startedAt = Date.now();
  let remaining = paper.minutes * 60;
  const tick = () => {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    timerEl.textContent = `${m}:${String(s).padStart(2, "0")}`;
    if (remaining === 300) timerEl.classList.add("closing");
    if (remaining <= 0) {
      stopTimer();
      timerEl.textContent = "Time's up — finish your sentence and check";
    }
    remaining--;
  };
  tick();
  stopTimer();
  timerHandle = setInterval(tick, 1000);

  root.querySelector("[data-check]").addEventListener("click", () => {
    stopTimer();
    checkAnswers(root, paper, set, els, Math.round((Date.now() - startedAt) / 1000));
  });
}

/* =========================
   Marking flow
========================= */

async function checkAnswers(root, paper, set, els, seconds) {
  root.querySelector("[data-check]").disabled = true;
  const status = root.querySelector("[data-status]");
  const results = new Map();      // qid -> {earned, possible, marking, feedback?}
  const freeText = [];            // [{q, qEl, answer}] needing AI/self marking
  let pendingSelf = 0;

  const maybeFinish = () => {
    if (pendingSelf === 0) finish(root, paper, set, results, seconds);
  };

  set.questions.forEach(q => {
    const qEl = els.get(q.id);
    const answer = collectAnswer(q, qEl);
    const r = mark(q, answer);

    if (r.status === "marked") {
      results.set(q.id, { earned: r.earned, possible: r.possible, marking: "auto" });
      showResult(q, qEl, r);
      return;
    }

    if (!hasAnswer(q, answer)) {
      results.set(q.id, { earned: 0, possible: q.marks, marking: "auto" });
      showResult(q, qEl, { earned: 0, possible: q.marks });
      return;
    }

    freeText.push({ q, qEl, answer });
  });

  /* Free-text answers: try the AI marker, fall back to self-marking. */
  const excerpt = set.passage ? set.passage.text.replace(/<[^>]+>/g, " ").slice(0, 6000) : null;
  for (let i = 0; i < freeText.length; i++) {
    const { q, qEl, answer } = freeText[i];
    status.textContent = `Marking your written answers… ${i + 1} of ${freeText.length}`;
    showPending(qEl, "Being marked…");
    try {
      const res = await markAI(q, answer, excerpt);
      results.set(q.id, { earned: res.earned, possible: res.possible, marking: "ai", feedback: res.feedback });
      showResult(q, qEl, res, { marking: "ai", feedback: res.feedback });
    } catch (err) {
      /* Offline, no token, rate-limited, or bad response → mark-scheme checklist */
      pendingSelf++;
      renderSelfMark(q, qEl, res => {
        results.set(q.id, { ...res, marking: "self" });
        showResult(q, qEl, res, { marking: "self" });
        pendingSelf--;
        maybeFinish();
      });
    }
  }

  status.textContent = pendingSelf > 0
    ? `Mark your ${pendingSelf} written answer${pendingSelf > 1 ? "s" : ""} using the checklists.`
    : "";
  maybeFinish();
}

function finish(root, paper, set, results, seconds) {
  root.querySelector("[data-status]").textContent = "";

  let earned = 0;
  let possible = 0;
  const items = set.questions.map(q => {
    const r = results.get(q.id);
    earned += r.earned;
    possible += r.possible;
    return { qid: q.id, domain: q.domain, subject: q.subject, marks: r.possible, earned: r.earned, marking: r.marking };
  });

  recordAttempt({ mode: "paper", paperId: paper.id, seconds, items });

  /* Per-domain bars */
  const byDomain = {};
  items.forEach(it => {
    const d = byDomain[it.domain] || (byDomain[it.domain] = { earned: 0, marks: 0 });
    d.earned += it.earned;
    d.marks += it.marks;
  });

  const bars = Object.entries(byDomain)
    .sort((a, b) => (a[1].earned / a[1].marks) - (b[1].earned / b[1].marks))
    .map(([dom, d]) => `
      <div class="domain-bar" data-subject="${paper.subject}">
        <span>${esc(domainLabel(dom))}</span>
        <span class="track"><span class="fill" style="width:${Math.round((d.earned / d.marks) * 100)}%"></span></span>
        <span>${d.earned}/${d.marks}</span>
      </div>`).join("");

  const weakest = Object.entries(byDomain)
    .filter(([, d]) => d.earned < d.marks)
    .sort((a, b) => (a[1].earned / a[1].marks) - (b[1].earned / b[1].marks))[0];

  const mins = Math.floor(seconds / 60);
  root.querySelector("[data-summary]").innerHTML = `
    <div class="card">
      <p class="muted" style="margin:0;">Your score</p>
      <div class="result-score">${earned} / ${possible}</div>
      <p class="muted">Finished in ${mins} minute${mins === 1 ? "" : "s"}.</p>
      <div class="domain-bars">${bars}</div>
      ${weakest ? `<p style="margin-bottom:0;">Next step: a bit more practice on <strong>${esc(domainLabel(weakest[0]))}</strong> would help most.</p>` : `<p style="margin-bottom:0;">Full marks in every area — brilliant.</p>`}
      <p style="margin-bottom:0;margin-top:var(--sp-3);"><a class="btn" href="#/papers">Another paper</a></p>
    </div>`;
  root.querySelector("[data-summary]").scrollIntoView({ behavior: "smooth", block: "start" });
}
