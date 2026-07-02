/* =========================================================
   Adaptive spelling trainer — engine ported from v1
   (weighting, mastery curve, en-GB speech with example
   sentences). Per-word stats live in the v2 store and were
   imported from v1 on first boot.
   Modes: Spoken (hear it), Flash (see it briefly).
   ========================================================= */

import { getData } from "../core/loader.js";
import { getStore, saveStore } from "../core/store.js";
import { esc, normaliseText } from "../core/utils.js";

/* --- v1 adaptive engine, ported verbatim in behaviour --- */

const now = () => Date.now();

function ensureStat(word) {
  const words = getStore().spelling.wordsByWord;
  if (!words[word]) {
    words[word] = {
      word, attempts: 0, correct: 0, wrong: 0,
      mastery: 0, wrongStreak: 0, lastSeenAt: 0, lastResult: null
    };
  }
  return words[word];
}

function computeWeight(stat) {
  let weight = 0.2 + 1.2 * (1 - stat.mastery);
  weight += 0.35 * Math.min(stat.wrongStreak, 6);
  if (stat.attempts > 0) weight += 0.8 * (stat.wrong / stat.attempts);

  const age = now() - stat.lastSeenAt;
  if (age < 6000) weight *= 0.15;
  else if (age < 15000) weight *= 0.45;

  if (stat.mastery > 0.9) weight *= 0.15;
  else if (stat.mastery > 0.8) weight *= 0.35;

  return Math.max(0.02, weight);
}

function weightedPick(stats) {
  let total = 0;
  stats.forEach(s => { total += computeWeight(s); });
  let r = Math.random() * total;
  for (const s of stats) {
    r -= computeWeight(s);
    if (r <= 0) return s;
  }
  return stats[stats.length - 1];
}

function recordResult(stat, ok) {
  stat.attempts++;
  stat.lastSeenAt = now();
  stat.lastResult = ok;
  if (ok) {
    stat.correct++;
    stat.wrongStreak = 0;
    stat.mastery = Math.min(1, stat.mastery + (stat.mastery < 0.6 ? 0.22 : stat.mastery < 0.8 ? 0.14 : 0.08));
  } else {
    stat.wrong++;
    stat.wrongStreak++;
    stat.mastery = Math.max(0, stat.mastery - (stat.mastery > 0.6 ? 0.18 : 0.12));
  }
  saveStore();
}

/* --- speech (en-GB, word + example sentence + word) --- */

function speak(text, delayMs = 0) {
  if (!("speechSynthesis" in window)) return;
  setTimeout(() => {
    const u = new SpeechSynthesisUtterance(String(text || ""));
    u.lang = "en-GB";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }, delayMs);
}

function speakWord(item) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  speak(item.word, 0);
  const sentences = item.sentences || [];
  if (sentences.length) {
    speak(sentences[Math.floor(Math.random() * sentences.length)], 700);
    speak(item.word, 1400);
  }
}

/* --- view --- */

let session = null; // { pool, current, score: {right, total} }

function wordPool(listKey) {
  const lists = getData().spelling.lists;
  const keys = listKey === "all" ? Object.keys(lists) : [listKey];
  const pool = [];
  keys.forEach(k => (lists[k]?.words || []).forEach(w => pool.push(w)));
  return pool;
}

export function renderSpelling(el) {
  const lists = getData().spelling.lists;
  const listOptions = Object.entries(lists).map(([k, l]) =>
    `<option value="${k}">${esc(l.label || k)}</option>`).join("");

  el.dataset.subject = "spelling";
  el.innerHTML = `
    <div class="run-bar"><h2>Spelling</h2><a class="btn quiet" href="#/practice">Back</a></div>
    <div class="card" style="margin-bottom:var(--sp-4);display:flex;gap:var(--sp-3);flex-wrap:wrap;align-items:center;">
      <label>Words: <select data-list style="font:inherit;">${listOptions}<option value="all">All lists</option></select></label>
      <label>Mode: <select data-mode style="font:inherit;">
        <option value="spoken">Spoken — listen and type</option>
        <option value="flash">Flash — see it, then type</option>
      </select></label>
      <span class="muted" data-score></span>
    </div>
    <div class="paper-sheet" data-subject="spelling">
      <div data-stage style="min-height:70px;font-size:var(--fs-4);font-weight:700;text-align:center;padding:var(--sp-4);"></div>
      <div style="display:flex;gap:var(--sp-3);justify-content:center;flex-wrap:wrap;">
        <input data-answer type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
          style="font:inherit;font-size:var(--fs-3);padding:var(--sp-3);border:2px solid var(--ink);border-radius:6px;width:min(320px,80vw);text-align:center;">
      </div>
      <div style="display:flex;gap:var(--sp-3);justify-content:center;margin-top:var(--sp-4);">
        <button class="primary" data-submit>Check</button>
        <button data-repeat>Hear it again</button>
      </div>
      <div data-result style="text-align:center;margin-top:var(--sp-3);min-height:2em;"></div>
    </div>
  `;

  const stage = el.querySelector("[data-stage]");
  const input = el.querySelector("[data-answer]");
  const result = el.querySelector("[data-result]");
  const scoreEl = el.querySelector("[data-score]");

  session = { score: { right: 0, total: 0 }, current: null };

  const currentMode = () => el.querySelector("[data-mode]").value;

  function next() {
    const pool = wordPool(el.querySelector("[data-list]").value);
    if (!pool.length) { stage.textContent = "No words in this list."; return; }
    const stats = pool.map(w => ensureStat(w.word.toLowerCase()));
    const stat = weightedPick(stats);
    const item = pool.find(w => w.word.toLowerCase() === stat.word) || pool[0];
    session.current = { item, stat };
    input.value = "";
    result.textContent = "";
    input.focus();

    if (currentMode() === "spoken") {
      stage.textContent = "🔊 Listen…";
      speakWord(item);
    } else {
      stage.textContent = item.word;
      setTimeout(() => {
        if (session.current?.item === item) stage.textContent = "•••";
      }, 2000);
    }
  }

  function submit() {
    const cur = session.current;
    if (!cur || !input.value.trim()) return;
    const ok = normaliseText(input.value) === normaliseText(cur.item.word);
    recordResult(cur.stat, ok);
    session.score.total++;
    if (ok) session.score.right++;
    scoreEl.textContent = `${session.score.right} / ${session.score.total} this session`;
    result.innerHTML = ok
      ? `<span style="color:var(--correct);font-weight:650;">Correct — ${esc(cur.item.word)}</span>`
      : `<span style="color:var(--wrong);font-weight:650;">It's spelled: ${esc(cur.item.word)}</span>`;
    setTimeout(next, ok ? 900 : 2200);
  }

  el.querySelector("[data-submit]").addEventListener("click", submit);
  input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
  el.querySelector("[data-repeat]").addEventListener("click", () => {
    if (session.current) speakWord(session.current.item);
  });
  el.querySelector("[data-mode]").addEventListener("change", next);
  el.querySelector("[data-list]").addEventListener("change", next);

  next();
}
