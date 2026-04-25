/* =========================
   Papers API
========================= */
/* jshint esversion: 11 */

let PAPERS = null;

/* =========================
   Init
========================= */

export function initPapers() {
  if (!window.DATA || !window.DATA.papers) {
    throw new Error("Papers data not loaded");
  }

  PAPERS = window.DATA.papers;

  // Optional: populate the Run dropdown automatically
  populateRunSelect();
}

/* =========================
   UI helpers
========================= */

export function populateRunSelect() {
  const sel = document.getElementById("runSelect");
  if (!sel || !PAPERS || !PAPERS.runs) return;

  // If already populated, don’t duplicate
  if (sel.options && sel.options.length > 1) return;

  // Keep first placeholder option if you have one
  const first = sel.querySelector("option[value='']");
  sel.innerHTML = "";
  if (first) sel.appendChild(first);

  Object.keys(PAPERS.runs).forEach(function (runKey) {
    const run = PAPERS.runs[runKey];
    const opt = document.createElement("option");
    opt.value = runKey;
    opt.textContent = run && run.label ? run.label : runKey;
    sel.appendChild(opt);
  });

  // Default to first real run if nothing selected
  if (!sel.value) {
    const firstReal = Array.from(sel.options).find(o => o.value);
    if (firstReal) sel.value = firstReal.value;
  }
}

/* =========================
   Accessors
========================= */

function getRun(runKey) {
  if (!PAPERS || !PAPERS.runs) return null;
  return PAPERS.runs[runKey] || null;
}

export function getRunPaperIds(runKey) {
  const run = getRun(runKey);
  return run && Array.isArray(run.papers) ? run.papers.slice() : [];
}

export function getPaperById(paperId) {
  if (!PAPERS || !PAPERS.papers) return null;
  return PAPERS.papers[paperId] || null;
}

export function getPaperLabel(paperId) {
  const paper = getPaperById(paperId);
  if (!paper) return "—";
  // If you have code/label, use them. Otherwise fall back cleanly.
  if (paper.code && paper.label) return `${paper.code}: ${paper.label}`;
  if (paper.label) return paper.label;
  return paperId;
}

export function getPaperDuration(paperId) {
  const paper = getPaperById(paperId);
  return paper && paper.minutes ? paper.minutes : 0;
}

export function getPaperInstructions(paperId) {
  const paper = getPaperById(paperId);
  return paper && paper.instructions ? paper.instructions : "";
}

export function getPaperType(paperId) {
  const paper = getPaperById(paperId);
  return paper ? paper.type : null;
}