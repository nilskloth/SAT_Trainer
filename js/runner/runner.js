/* =========================
   Practice Runner
========================= */
/* jshint esversion: 11 */

import { now, pickN, formatTimer } from "../utils.js";
import { renderQuestionList, renderPassage } from "./render.js";
import { genArithmeticSet } from "../training/arithmetic.js";
import { addPaperAttempt } from "../store.js";

import {
  initPapers,
  getRunPaperIds,
  getPaperById,
  getPaperType,
  getPaperLabel,
  getPaperDuration,
  getPaperInstructions
} from "./papers.js";


let RUNNER_STATE = null;
let paperAreaEl   = null;

/* =========================
   Init
========================= */

export function initRunner() {
  /* initPapers() is already called by app.js before initRunner — do not call again */

  paperAreaEl = document.getElementById("paperArea")
             || document.querySelector("#paperArea");

  if (!paperAreaEl) {
    /* HTML was served from cache without the id — create the element */
    const tabRunner = document.getElementById("tab-runner");
    if (tabRunner) {
      paperAreaEl = document.createElement("div");
      paperAreaEl.id = "paperArea";
      paperAreaEl.style.marginTop = "12px";
      paperAreaEl.innerHTML =
        "<div class='q'><div class='stem'>Press \u201CStart run\u201D to begin.</div></div>";
      tabRunner.appendChild(paperAreaEl);
    } else {
      console.error("[runner] tab-runner not found — runner cannot initialize");
      return;
    }
  }

  document.getElementById("startRunBtn").addEventListener("click", startRun);
  document.getElementById("stopRunBtn").addEventListener("click", stopRun);
  document.getElementById("prevPaperBtn").addEventListener("click", gotoPrevPaper);
  document.getElementById("nextPaperBtn").addEventListener("click", gotoNextPaper);
  document.getElementById("submitPaperBtn").addEventListener("click", submitCurrentPaper);
  document.getElementById("resetPaperBtn").addEventListener("click", resetCurrentPaper);
  document.getElementById("toggleInstructionsBtn").addEventListener("click", toggleInstructions);
}

/* =========================
   Run lifecycle
========================= */

function startRun() {
  try {
    const runKey = document.getElementById("runSelect").value;
    const timing = document.getElementById("timingSelect").value;
    const paperIds = getRunPaperIds(runKey);

    if (!paperIds.length) {
      throw new Error('No papers found for run "' + runKey + '". Check papers.json.');
    }

    RUNNER_STATE = {
      runKey,
      timing,
      paperIds,
      index: 0,
      timerId: null,
      startedAt: 0,
      submitted: false,
      answers: {},
      currentQuestions: [],
      currentPaperType: ""
    };

    updateRunnerControls(true);
    loadPaper();

  } catch (err) {
    console.error("startRun failed:", err);
    if (paperAreaEl) paperAreaEl.innerHTML =
      "<div class='q'><div class='stem bad'>Could not start: " + err.message + "</div></div>";
  }
}

function stopRun() {
  clearTimer();
  RUNNER_STATE = null;
  resetRunnerUI();
  updateRunnerControls(false);
}

/* =========================
   Navigation
========================= */

function gotoPrevPaper() {
  if (!RUNNER_STATE || RUNNER_STATE.index === 0) return;
  RUNNER_STATE.index -= 1;
  loadPaper();
}

function gotoNextPaper() {
  if (!RUNNER_STATE) return;
  if (RUNNER_STATE.index >= RUNNER_STATE.paperIds.length - 1) return;
  RUNNER_STATE.index += 1;
  loadPaper();
}

function getCurrentPaperId() {
  return RUNNER_STATE.paperIds[RUNNER_STATE.index];
}

/* =========================
   Paper loading
========================= */

function loadPaper() {
  clearTimer();

  const paperId = getCurrentPaperId();
  const paper   = getPaperById(paperId);

  RUNNER_STATE.answers = {};
  RUNNER_STATE.currentQuestions = [];
  RUNNER_STATE.currentPaperType = getPaperType(paperId);
  RUNNER_STATE.submitted = false;

  updatePaperHeader(paperId);

  try {
    renderPaperContent(paperId);
  } catch (err) {
    console.error("renderPaperContent failed:", err);
    if (paperAreaEl) paperAreaEl.innerHTML =
      "<div class='q'><div class='stem bad'>Error loading paper: " + err.message + "</div></div>";
  }

  startTimerIfNeeded(paper);
  updateNavButtons();

  document.getElementById("paperScoreLine").textContent = "\u2014";
  document.getElementById("paperScoreLine").className = "muted";
  document.getElementById("submitPaperBtn").disabled = false;

  const timerEl = document.getElementById("paperTimer");
  timerEl.style.color = "";
}

/* =========================
   Rendering
========================= */

function renderPaperContent(paperId) {
  const area = paperAreaEl;
  if (!area) return;
  area.innerHTML = "";

  const type = getPaperType(paperId);

  if (type === "reading") {
    const passage = (window.DATA.banks.reading && window.DATA.banks.reading.length)
      ? window.DATA.banks.reading[0] : null;

    if (!passage) {
      area.innerHTML =
        "<div class='q'><div class='stem'>No reading passage loaded.</div>" +
        "<div class='muted'>Add passages to data/banks/reading.json</div></div>";
      RUNNER_STATE.currentQuestions = [];
      return;
    }

    RUNNER_STATE.currentQuestions = passage.questions || [];
    area.appendChild(renderPassage(passage));
    area.appendChild(
      renderQuestionList(RUNNER_STATE.currentQuestions, RUNNER_STATE.answers, { showChoices: true })
    );
    return;
  }

  if (type === "spag") {
    const picked = pickN(window.DATA.banks.spag || [], 8);
    RUNNER_STATE.currentQuestions = picked;
    area.appendChild(
      renderQuestionList(picked, RUNNER_STATE.answers, { showChoices: true })
    );
    return;
  }

  if (type === "reasoning") {
    const paperCode = (paperId === "M_R2") ? "P2" : "P3";
    const pool = (window.DATA.banks.reasoning || []).filter(function (q) {
      return q.paper === paperCode;
    });
    const picked = pickN(pool, 6);
    RUNNER_STATE.currentQuestions = picked;
    area.appendChild(
      renderQuestionList(picked, RUNNER_STATE.answers, { showChoices: true })
    );
    return;
  }

  if (type === "arithmetic") {
    const qs = genArithmeticSet(10, "y6");
    RUNNER_STATE.currentQuestions = qs;
    area.appendChild(
      renderQuestionList(qs, RUNNER_STATE.answers, { showChoices: false })
    );
    return;
  }

  if (type === "spelling") {
    area.innerHTML =
      "<div class='q'><div class='stem'>Spelling is practised in the Training tab.</div></div>";
    RUNNER_STATE.currentQuestions = [];
  }
}

/* =========================
   Submission
========================= */

function submitCurrentPaper() {
  if (!RUNNER_STATE || RUNNER_STATE.submitted) return;

  const paperId = getCurrentPaperId();
  const paperType = getPaperType(paperId);

  if (paperType === "spelling") {
    alert("Spelling is tracked via the Training tab.");
    return;
  }

  RUNNER_STATE.submitted = true;
  document.getElementById("submitPaperBtn").disabled = true;

  const result = scorePaper(paperType);

  addPaperAttempt({
    paperId,
    score: result.score,
    total: result.total,
    seconds: result.seconds
  });

  markQuestionsInDOM(paperType);

  const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
  const scoreClass = result.score === result.total ? "ok"
    : result.score >= Math.ceil(result.total * 0.7) ? "correct" : "bad";

  const scoreLine = document.getElementById("paperScoreLine");
  scoreLine.textContent = `Score: ${result.score} / ${result.total} (${pct}%)`;
  scoreLine.className = "muted " + scoreClass;
}

/* =========================
   Per-question result marking
========================= */

function markQuestionsInDOM(paperType) {
  const qs = RUNNER_STATE.currentQuestions || [];

  qs.forEach(function (q, i) {
    const qid = q.id || ("q" + (i + 1));
    const cardEl = document.getElementById("runner-q-" + qid);
    if (!cardEl) return;

    const userAnswer = RUNNER_STATE.answers[qid];
    const isCorrect = paperType === "spag"
      ? markSpag(q, userAnswer)
      : markGeneric(q, userAnswer, paperType);

    cardEl.classList.add(isCorrect ? "algebra-correct" : "algebra-wrong");

    const inputEl = document.getElementById("runner-input-" + qid);
    if (inputEl) inputEl.disabled = true;

    if (q.type === "mcq") {
      cardEl.querySelectorAll("input[type='radio']").forEach(function (r) {
        r.disabled = true;
      });
    }

    const badge = document.createElement("div");
    badge.className = "result-badge " + (isCorrect ? "ok" : "bad");

    if (isCorrect) {
      badge.textContent = "\u2713 Correct";
    } else {
      let ans = q.answer;
      if (!ans && Array.isArray(q.answers)) ans = q.answers.join(", ");
      if (!ans) ans = "\u2014";
      badge.textContent = paperType === "reading"
        ? "Model answer: " + ans
        : "\u2717  Answer: " + ans;
    }

    cardEl.appendChild(badge);
  });
}

/* =========================
   SPaG marking helpers
========================= */

function normalise(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[.,!?]$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function markSpag(q, userAnswer) {
  const input = normalise(userAnswer);

  if (q.type === "mcq") {
    return userAnswer === q.answer;
  }

  if (!q.marking) {
    if (typeof q.answer === "string") return normalise(q.answer) === input;
    if (Array.isArray(q.answers)) {
      return q.answers.some(function (a) { return normalise(a) === input; });
    }
    return false;
  }

  if (q.marking === "normalised") {
    return (q.answers || []).some(function (a) { return normalise(a) === input; });
  }

  if (q.marking === "set") {
    return (q.answers || []).indexOf(input) !== -1;
  }

  if (q.marking === "pattern") {
    return (q.patterns || []).some(function (p) {
      return new RegExp(p, "i").test(input);
    });
  }

  return false;
}

/* =========================
   Generic marking
========================= */

function normaliseNumericLike(str) {
  return String(str || "").replace(/,/g, "").replace(/\s+/g, "").trim();
}

function tryParseNumber(str) {
  const s = normaliseNumericLike(str);
  if (!s) return null;
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

function markGeneric(q, userAnswer, paperType) {
  const givenRaw = (userAnswer == null) ? "" : String(userAnswer);
  const ansRaw   = (q && q.answer != null) ? String(q.answer) : "";

  if (!ansRaw) return false;
  if (q.type === "mcq") return givenRaw === ansRaw;

  const given = normalise(givenRaw);
  const ans   = normalise(ansRaw);

  if (!given) return false;

  if (paperType === "reading") {
    return given.indexOf(ans) !== -1 || ans.indexOf(given) !== -1;
  }

  const gn = tryParseNumber(givenRaw);
  const an = tryParseNumber(ansRaw);
  if (gn != null && an != null) return gn === an;

  return given === ans;
}

/* =========================
   Scoring
========================= */

function scorePaper(type) {
  let score = 0;
  const qs = RUNNER_STATE.currentQuestions || [];

  qs.forEach(function (q, i) {
    const qid = q.id || ("q" + (i + 1));
    const userAnswer = RUNNER_STATE.answers[qid];
    const correct = type === "spag"
      ? markSpag(q, userAnswer)
      : markGeneric(q, userAnswer, type);
    if (correct) score += 1;
  });

  const seconds = RUNNER_STATE.startedAt
    ? Math.round((now() - RUNNER_STATE.startedAt) / 1000) : 0;

  return { score, total: qs.length, seconds };
}

/* =========================
   Reset
========================= */

function resetCurrentPaper() {
  if (!RUNNER_STATE) return;
  loadPaper();
}

/* =========================
   Timer
========================= */

function startTimerIfNeeded(paper) {
  const timerEl = document.getElementById("paperTimer");

  if (RUNNER_STATE.timing !== "timed" || !paper || !paper.minutes) {
    timerEl.textContent = "--:--";
    RUNNER_STATE.startedAt = 0;
    return;
  }

  RUNNER_STATE.startedAt = now();
  const endAt = RUNNER_STATE.startedAt + paper.minutes * 60000;

  updateTimer(endAt);
  RUNNER_STATE.timerId = setInterval(function () {
    updateTimer(endAt);
  }, 250);
}

function updateTimer(endAt) {
  const timerEl = document.getElementById("paperTimer");
  const remaining = endAt - now();

  if (remaining <= 0) {
    clearTimer();
    timerEl.textContent = "00:00";
    timerEl.style.color = "#b00020";
    return;
  }

  timerEl.textContent = formatTimer(remaining);
}

function clearTimer() {
  if (RUNNER_STATE && RUNNER_STATE.timerId) {
    clearInterval(RUNNER_STATE.timerId);
    RUNNER_STATE.timerId = null;
  }
}

/* =========================
   UI helpers
========================= */

function updatePaperHeader(paperId) {
  document.getElementById("paperTitle").textContent = getPaperLabel(paperId);

  const mins = getPaperDuration(paperId);
  document.getElementById("paperMeta").textContent = mins ? (mins + " minutes") : "Untimed";

  document.getElementById("paperInstructionsText").textContent =
    getPaperInstructions(paperId);
}

function toggleInstructions() {
  document.getElementById("paperInstructions").classList.toggle("hidden");
}

function updateNavButtons() {
  document.getElementById("prevPaperBtn").disabled = RUNNER_STATE.index === 0;
  document.getElementById("nextPaperBtn").disabled =
    RUNNER_STATE.index >= RUNNER_STATE.paperIds.length - 1;
}

function updateRunnerControls(running) {
  document.getElementById("startRunBtn").disabled = running;
  document.getElementById("stopRunBtn").disabled = !running;
  document.getElementById("submitPaperBtn").disabled = !running;
  document.getElementById("resetPaperBtn").disabled = !running;
  document.getElementById("toggleInstructionsBtn").disabled = !running;
}

function resetRunnerUI() {
  if (paperAreaEl) paperAreaEl.innerHTML =
    "<div class='q'><div class='stem'>Press \u201CStart run\u201D to begin.</div></div>";
  document.getElementById("paperTitle").textContent = "\u2014";
  document.getElementById("paperMeta").textContent = "\u2014";
  document.getElementById("paperTimer").textContent = "--:--";
  document.getElementById("paperTimer").style.color = "";
  document.getElementById("paperScoreLine").textContent = "\u2014";
  document.getElementById("paperScoreLine").className = "muted";
  document.getElementById("paperInstructions").classList.add("hidden");
}
