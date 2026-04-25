/* stats/stats.js */
/* jshint esversion: 11 */

import { getStore, resetAllProgress } from "../store.js";
import { escapeHTML as esc } from "../utils.js";

/* =========================
   Init
========================= */

export function initStats() {
  const toggleBtn = document.getElementById("toggleStatsBtn");
  const statsWrap = document.getElementById("statsWrap");
  const resetBtn = document.getElementById("resetAllProgressBtn");

  if (!toggleBtn || !statsWrap) return;

  toggleBtn.addEventListener("click", function () {
    const hidden = statsWrap.classList.toggle("hidden");
    toggleBtn.textContent = hidden ? "Show details" : "Hide details";
    if (!hidden) refreshStats();
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      if (!confirm("Reset ALL progress (scores + spelling mastery)?")) return;
      resetAllProgress();
      refreshStats();
      alert("Progress reset.");
    });
  }

  refreshStats();
}

/* =========================
   Refresh
========================= */

function refreshStats() {
  const store = getStore();
  if (!store || !window.DATA) return;

  renderPaperAttempts(store);
  renderSpellingStats(store);
}

/* =========================
   Paper Attempts
========================= */

function renderPaperAttempts(store) {
  const out = document.getElementById("paperAttemptsOut");
  const top = document.getElementById("statsTopLine");
  if (!out || !top) return;

  const attempts = store.progress?.paperAttempts || [];
  const recent = attempts.slice(-10);

  top.textContent =
    `Total attempts recorded: ${attempts.length}. Showing last ${recent.length}.`;

  if (!recent.length) {
    out.textContent = "—";
    return;
  }

  out.innerHTML = recent.map(function (a) {
    const def = findPaperDef(a.paperId);
    const label = def ? def.label : a.paperId;
    const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
    const time = new Date(a.timestamp || Date.now()).toLocaleString();

    return `${time} — <b>${esc(label)}</b>: ${a.score}/${a.total} (${pct}%)`;
  }).join("<br>");
}

/* =========================
   Spelling Stats
========================= */

function renderSpellingStats(store) {
  const body = document.getElementById("spellStatsBody");
  if (!body) return;

  const pools = window.DATA?.spellingPools;
  const spelling = store.progress?.spelling;

  if (!pools || !spelling) return;

  const words = getActiveWords(pools, spelling.poolChoice || "both");

  // Ensure word stats exist for anything we're about to render
  ensureSpellingWordsInStore(spelling, words);

  const stats = words
    .map(function (w) { return spelling.wordsByWord[w]; })
    .filter(Boolean);

  stats.sort(compareSpellingStats);

  body.innerHTML = "";

  stats.slice(0, 60).forEach(function (stat) {
    const tr = document.createElement("tr");

    tr.innerHTML =
      `<td>${esc(stat.word)}</td>` +
      `<td>${poolLabel(stat.word, pools)}</td>` +
      `<td>${promptLabel(spelling.mode)}</td>` +
      `<td class="right">${Math.round((stat.mastery || 0) * 100)}%</td>` +
      `<td class="right">${stat.attempts || 0}</td>` +
      `<td class="right">${stat.wrong || 0}</td>` +
      `<td class="right">${esc(stat.lastResult || "—")}</td>`;

    body.appendChild(tr);
  });
}

/* =========================
   Helpers
========================= */

function findPaperDef(paperId) {
  const papers = window.DATA?.papers;
  const subjects = ["maths", "english"];

  for (let i = 0; i < subjects.length; i += 1) {
    const list = papers?.[subjects[i]]?.papers || [];
    for (let j = 0; j < list.length; j += 1) {
      if (list[j].id === paperId) return list[j];
    }
  }
  return null;
}

function compareSpellingStats(a, b) {
  if ((a.mastery || 0) !== (b.mastery || 0)) return (a.mastery || 0) - (b.mastery || 0);
  if ((a.wrongStreak || 0) !== (b.wrongStreak || 0)) return (b.wrongStreak || 0) - (a.wrongStreak || 0);

  const ra = a.attempts ? (a.wrong / a.attempts) : 0;
  const rb = b.attempts ? (b.wrong / b.attempts) : 0;
  return rb - ra;
}

function getActiveWords(spellingPools, poolChoice) {
  if (!spellingPools) return [];

  if (poolChoice === "both") {
    const all = [];
    Object.values(spellingPools).forEach(function (pool) {
      if (pool && Array.isArray(pool.words)) all.push.apply(all, pool.words);
    });
    return uniqueLower(all);
  }

  const pool = spellingPools[poolChoice];
  if (!pool || !Array.isArray(pool.words)) return [];

  return uniqueLower(pool.words);
}

function uniqueLower(words) {
  const out = [];
  const seen = new Set();

  for (let i = 0; i < (words || []).length; i += 1) {
    const w = String(words[i] || "").toLowerCase();
    if (!w) continue;
    if (!seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}

function ensureSpellingWordsInStore(spelling, words) {
  if (!spelling.wordsByWord) spelling.wordsByWord = {};

  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    if (!spelling.wordsByWord[w]) {
      spelling.wordsByWord[w] = {
        word: w,
        attempts: 0,
        correct: 0,
        wrong: 0,
        mastery: 0.25,
        wrongStreak: 0,
        lastSeenAt: 0,
        lastResult: "—"
      };
    }
  }
}

function poolLabel(word, spellingPools) {
  const labels = [];

  Object.values(spellingPools).forEach(function (pool) {
    if (pool && Array.isArray(pool.words) && pool.words.includes(word)) {
      labels.push(pool.label || "—");
    }
  });

  return labels.length ? labels.join(" + ") : "—";
}

function promptLabel(mode) {
  // support both old and new naming
  if (mode === "hidden" || mode === "flash") return "Hidden";
  if (mode === "show") return "Visible";
  if (mode === "speak") return "Spoken";
  return "—";
}