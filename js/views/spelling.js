/* =========================================================
   Adaptive spelling trainer — v1 engine (core/adaptive.js),
   en-GB speech with example sentences. Per-word stats live in the v2 store and were
   imported from v1 on first boot.
   Modes: Spoken (hear it), Flash (see it briefly).
   ========================================================= */

import { getData } from "../core/loader.js";
import { getStore, saveStore } from "../core/store.js";
import { esc, normaliseText } from "../core/utils.js";
import { speakWord } from "../core/speech.js";
import { newStat, weightedPick, applyResult } from "../core/adaptive.js";

/* --- per-word stats (v1 shape, keyed by word) --- */

function ensureStat(word) {
  const words = getStore().spelling.wordsByWord;
  if (!words[word]) words[word] = { word, ...newStat(word) };
  return words[word];
}

function recordResult(stat, ok) {
  applyResult(stat, ok);
  saveStore();
}

function speakItem(item) {
  const sentences = item.sentences || [];
  speakWord(item.word, sentences[Math.floor(Math.random() * sentences.length)]);
}

/* Paper 2 feeds its results into the same adaptive history. */
export function recordSpellingResult(word, ok) {
  recordResult(ensureStat(String(word).toLowerCase()), ok);
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
      speakItem(item);
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
    if (session.current) speakItem(session.current.item);
  });
  el.querySelector("[data-mode]").addEventListener("change", next);
  el.querySelector("[data-list]").addEventListener("change", next);

  next();
}
