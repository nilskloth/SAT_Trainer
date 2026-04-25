/* training/spelling.js */
/* jshint esversion: 11 */

import { now, clamp } from "../utils.js";
import { getSpellingState, saveStore } from "../store.js";

/* =========================
   Word stats (exported)
========================= */

export function ensureWordStats(storeMap, words) {
  for (let i = 0; i < (words || []).length; i += 1) {
    const w = String(words[i] || "").trim().toLowerCase();
    if (!w) continue;

    if (!storeMap[w]) {
      storeMap[w] = {
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

/* =========================
   Adaptive weighting
========================= */

function computeWeight(stat) {
  let weight = 0.2 + (1.2 * (1 - stat.mastery));
  weight += 0.35 * Math.min(stat.wrongStreak, 6);

  if (stat.attempts > 0) {
    weight += 0.8 * (stat.wrong / stat.attempts);
  }

  const age = now() - stat.lastSeenAt;
  if (age < 6000) weight *= 0.15;
  else if (age < 15000) weight *= 0.45;

  if (stat.mastery > 0.9) weight *= 0.15;
  else if (stat.mastery > 0.8) weight *= 0.35;

  return Math.max(0.02, weight);
}

function weightedPick(stats) {
  let total = 0;
  for (let i = 0; i < stats.length; i += 1) {
    total += computeWeight(stats[i]);
  }

  let r = Math.random() * total;
  for (let i = 0; i < stats.length; i += 1) {
    r -= computeWeight(stats[i]);
    if (r <= 0) return stats[i];
  }

  return stats[stats.length - 1];
}

/* =========================
   Mastery curve (used by score)
========================= */

function masteryGain(m) {
  if (m < 0.6) return 0.22;
  if (m < 0.8) return 0.14;
  return 0.08;
}

function masteryDrop(m) {
  if (m > 0.6) return 0.18;
  return 0.12;
}

/* =========================
   Speech
========================= */

function speakUtterance(text, delayMs) {
  if (!("speechSynthesis" in window)) return;

  setTimeout(function () {
    const u = new SpeechSynthesisUtterance(String(text || ""));
    u.lang = "en-GB";
    u.rate = 0.95;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  }, Math.max(0, delayMs || 0));
}

function pickSentenceForWord(wordLower) {
  const lists = window.DATA && window.DATA.spelling && window.DATA.spelling.lists;
  if (!lists || !wordLower) return [];

  const keys = Object.keys(lists);

  for (let i = 0; i < keys.length; i += 1) {
    const list = lists[keys[i]];
    const items = (list && Array.isArray(list.words)) ? list.words : [];

    // Manual search to satisfy JSHint W083
    for (let j = 0; j < items.length; j += 1) {
      const item = items[j];
      if (!item || !item.word) continue;

      if (item.word === wordLower) {
        return Array.isArray(item.sentences) ? item.sentences : [];
      }
    }
  }

  return [];
}

function speakWordWithSentence(word) {
  if (!("speechSynthesis" in window)) return;

  const w = String(word || "").trim();
  if (!w) return;

  const lower = w.toLowerCase();
  const sentences = pickSentenceForWord(lower);

  // Cancel ONCE before the sequence
  window.speechSynthesis.cancel();

  // Strategy:
  // - repeat button (or spoken-mode repeat) => word, short pause, sentence, short pause, word
  // - starting a new set should NOT auto-say the sentence; we handle that in showCurrent()
  speakUtterance(w, 0);

  if (sentences.length) {
    const sentence = sentences[Math.floor(Math.random() * sentences.length)];
    speakUtterance(sentence, 700);
    speakUtterance(w, 1400);
  }
}

function speakWord(word) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  speakUtterance(word, 0);
}

/* =========================
   Session model
========================= */

let session = null;

/* =========================
   UI Initialisation
========================= */

export function initSpelling() {
  
  const lists = window.DATA.spelling.lists;

  // Normalised pool map for UI + session logic
  const pools = Object.fromEntries(
    Object.entries(lists).map(([key, list]) => [
      key,
      {
        id: list.id,
        label: list.label,
        words: list.words.map(w => w.word)
      }
    ])
  );
  
  const poolSelect = document.getElementById("spellPoolSelect");
  const modeSelect = document.getElementById("spellModeSelect");
  const dictationSelect = document.getElementById("spellDictationSelect"); // may be removed from HTML; we tolerate missing
  const flashSelect = document.getElementById("spellFlashSelect");

  const newSetBtn = document.getElementById("spellNewSetBtn");
  const setSizeSelect = document.getElementById("spellSetSizeSelect");
  const counterEl = document.getElementById("spellCounter");

  const promptEl = document.getElementById("spellPrompt");
  const inputEl = document.getElementById("spellInput");
  const checkBtn = document.getElementById("spellCheckBtn");
  const repeatBtn = document.getElementById("spellRepeatBtn");
  const nextBtn = document.getElementById("spellNextBtn");
  const feedbackEl = document.getElementById("spellFeedback");
  const helpEl = document.getElementById("spellHelp");

  // Review UI (optional, but present in your HTML)
  const reviewWrap = document.getElementById("spellReviewWrap");
  const reviewBody = document.getElementById("spellReviewBody");
  const reviewSummary = document.getElementById("spellReviewSummary");

  if (!poolSelect || !modeSelect || !promptEl || !inputEl || !checkBtn) return;

  // ✅ New spelling JSON lives at window.DATA.spelling.lists
  if (!window.DATA || !window.DATA.spelling || !window.DATA.spelling.lists) {
    throw new Error("Spelling data not loaded");
  }

  const spellingState = getSpellingState();

  const UI = { flashTimer: null };

  /* -------------------------
     Pool population
  ------------------------- */

  function populatePoolSelect() {
    poolSelect.innerHTML = "";

    const both = document.createElement("option");
    both.value = "both";
    both.textContent = "All lists";
    poolSelect.appendChild(both);

    Object.entries(lists).forEach(function ([key, list]) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = (list && list.label) ? list.label : key;
      poolSelect.appendChild(opt);
    });

    const saved = spellingState.poolChoice || "both";
    poolSelect.value = poolSelect.querySelector(`option[value="${saved}"]`) ? saved : "both";
  }

  function restoreControls() {
    const savedMode = spellingState.mode || "hidden";
    if (modeSelect.querySelector(`option[value="${savedMode}"]`)) {
      modeSelect.value = savedMode;
    } else {
      modeSelect.value = "hidden";
    }

    if (flashSelect) {
      const savedFlash = String(spellingState.flashSeconds || 3);
      if (flashSelect.querySelector(`option[value="${savedFlash}"]`)) {
        flashSelect.value = savedFlash;
      }
    }

    // Dictation removed from UX; if element exists, keep it off
    if (dictationSelect) {
      dictationSelect.value = "off";
    }
  }

  populatePoolSelect();
  restoreControls();

  /* -------------------------
     Helpers
  ------------------------- */

  function hasActiveSession() {
    return !!session && !session.finishedAt;
  }

  function clearFlashTimer() {
    if (UI.flashTimer) {
      clearTimeout(UI.flashTimer);
      UI.flashTimer = null;
    }
  }

  function setPromptHidden() {
    promptEl.textContent = "—";
  }

  function setPromptWord(w) {
    promptEl.textContent = w || "—";
  }

  function updateCounter() {
    if (!counterEl) return;

    if (!session) {
      counterEl.textContent = "";
      return;
    }

    const total = session.words.length;
    const idx = session.finishedAt ? total : Math.min(session.index + 1, total);
    counterEl.textContent = `${idx} / ${total}`;
  }

  function uniqueLower(list) {
    const out = [];
    const seen = new Set();
    for (let i = 0; i < (list || []).length; i += 1) {
      const w = String(list[i] || "").trim().toLowerCase();
      if (!w) continue;
      if (seen.has(w)) continue;
      seen.add(w);
      out.push(w);
    }
    return out;
  }

  function getWordsForPool(id) {
    if (id === "both") {
      const merged = [];
      Object.values(lists).forEach(function (list) {
        const items = list && Array.isArray(list.words) ? list.words : [];
        items.forEach(function (obj) {
          if (obj && obj.word) merged.push(obj.word);
        });
      });
      return uniqueLower(merged);
    }

    const list = lists[id];
    const items = list && Array.isArray(list.words) ? list.words : [];
    return uniqueLower(items.map(w => w.word));
  }

  function resetReviewUI() {
    if (reviewWrap) reviewWrap.classList.add("hidden");
    if (reviewBody) reviewBody.innerHTML = "";
    if (reviewSummary) reviewSummary.textContent = "";
  }

  function renderReview() {
    if (!reviewWrap || !reviewBody || !reviewSummary) return;
    if (!session) return;

    reviewBody.innerHTML = "";

    (session.attempts || []).forEach(function (a) {
      const tr = document.createElement("tr");

      const resultClass = a.correct ? "correct" : "wrong";
      const typedClass = a.correct ? "" : "wrong-word";

      tr.innerHTML = `
        <td>${a.index}</td>
        <td class="${resultClass}">${a.correct ? "✓" : "✗"}</td>
        <td class="${typedClass}">${a.typed || "—"}</td>
        <td class="correct-word">${a.word}</td>
      `;

      reviewBody.appendChild(tr);
    });

    reviewSummary.textContent = `Score: ${session.correct} / ${session.words.length}`;
    reviewWrap.classList.remove("hidden");
  }

  function setIdleUI() {
    poolSelect.disabled = false;

    modeSelect.disabled = true;
    if (dictationSelect) dictationSelect.disabled = true; // legacy
    if (flashSelect) flashSelect.disabled = true;

    inputEl.disabled = true;
    checkBtn.disabled = true;
    repeatBtn.disabled = true;
    nextBtn.disabled = true;

    setPromptHidden();
    feedbackEl.textContent = "";
    if (counterEl) counterEl.textContent = "";

    if (helpEl) helpEl.textContent = "Click “New set” to begin.";

    resetReviewUI();
  }

  function updateControls() {
    const active = hasActiveSession();
    const mode = modeSelect.value;

    poolSelect.disabled = false;

    modeSelect.disabled = !active;
    if (dictationSelect) dictationSelect.disabled = true; // removed feature; keep inert

    if (flashSelect) flashSelect.disabled = !active || (mode !== "hidden");

    inputEl.disabled = !active;
    checkBtn.disabled = !active;

    nextBtn.disabled = !active;
    repeatBtn.disabled = !active || (mode === "show");

    if (helpEl) {
      if (!active) {
        helpEl.textContent = "Click “New set” to begin.";
      } else if (mode === "hidden") {
        helpEl.textContent = "Hidden mode: word flashes briefly.";
      } else if (mode === "speak") {
        helpEl.textContent = "Spoken mode: press Repeat for a sentence.";
      } else {
        helpEl.textContent = "";
      }
    }
  }

  /* -------------------------
     Session lifecycle
  ------------------------- */

  function makeSession() {
    const poolId = poolSelect.value;
    const words = getWordsForPool(poolId);

    ensureWordStats(spellingState.wordsByWord, words);

    const stats = words
      .map(w => spellingState.wordsByWord[w])
      .filter(Boolean);

    const size = setSizeSelect ? Number(setSizeSelect.value || 30) : 30;

    const picked = [];
    const available = stats.slice();

    while (picked.length < size && available.length) {
      const s = weightedPick(available);
      picked.push({ word: s.word });

      const idx = available.findIndex(x => x.word === s.word);
      if (idx >= 0) available.splice(idx, 1);
    }

    session = {
      words: picked,
      index: 0,
      correct: 0,
      wrong: 0,
      finishedAt: null,
      attempts: []
    };

    spellingState.poolChoice = poolId;
    spellingState.mode = modeSelect.value;
    spellingState.flashSeconds = flashSelect ? Number(flashSelect.value || 3) : 3;
    saveStore();
  }

  function showCurrent() {
    clearFlashTimer();
    updateControls();
    updateCounter();

    if (!hasActiveSession()) return;

    const entry = session.words[session.index];

    if (!entry) {
      session.finishedAt = Date.now();
      setPromptWord("✓ Done");
      renderReview();
      updateControls();
      updateCounter();
      return;
    }

    const word = entry.word;
    const mode = modeSelect.value;

    if (mode === "show") {
      setPromptWord(word);
    } else if (mode === "hidden") {
      setPromptWord(word);

      const secs = flashSelect ? Number(flashSelect.value || 3) : 3;
      UI.flashTimer = setTimeout(function () {
        if (modeSelect.value === "hidden") setPromptHidden();
      }, secs * 1000);
    } else {
      // Spoken mode: speak ONLY the word on advance/show.
      setPromptHidden();
      speakWord(word);
    }

    inputEl.focus();
  }

  function advance() {
    if (!hasActiveSession()) return;

    session.index += 1;
    feedbackEl.textContent = "";
    inputEl.value = "";

    showCurrent();
  }

  function score() {
    if (!hasActiveSession()) return;

    const entry = session.words[session.index];
    if (!entry) return;

    const word = String(entry.word || "").trim().toLowerCase();
    const typedRaw = inputEl.value.trim();
    const typed = typedRaw.toLowerCase();

    ensureWordStats(spellingState.wordsByWord, [word]);
    const stat = spellingState.wordsByWord[word];

    const correct = (typed === word);

    stat.attempts += 1;
    stat.lastSeenAt = now();

    if (correct) {
      stat.correct += 1;
      stat.wrongStreak = 0;
      stat.lastResult = "✓";
      stat.mastery = clamp(stat.mastery + masteryGain(stat.mastery), 0, 1);
    } else {
      stat.wrong += 1;
      stat.wrongStreak += 1;
      stat.lastResult = "✗";
      stat.mastery = clamp(stat.mastery - masteryDrop(stat.mastery), 0, 1);
    }

    session.attempts.push({
      index: session.index + 1,
      word,
      typed: typedRaw,
      correct
    });

    if (correct) session.correct += 1;
    else session.wrong += 1;

    feedbackEl.innerHTML = correct ?
      '<span class="ok">✓ Correct</span>' :
      `<span class="bad">✗ ${entry.word}</span>`;

    saveStore();

    setTimeout(function () {
      advance();
    }, 600);
  }

  /* -------------------------
     Events
  ------------------------- */

  modeSelect.addEventListener("change", function () {
    spellingState.mode = modeSelect.value;
    saveStore();

    if (hasActiveSession()) {
      showCurrent();
    } else {
      updateControls();
    }
  });

  if (flashSelect) {
    flashSelect.addEventListener("change", function () {
      spellingState.flashSeconds = Number(flashSelect.value || 3);
      saveStore();

      if (hasActiveSession() && modeSelect.value === "hidden") {
        showCurrent();
      } else {
        updateControls();
      }
    });
  }

  // Dictation dropdown removed from UX; if it still exists in HTML, keep it inert.
  if (dictationSelect) {
    dictationSelect.addEventListener("change", function () {
      dictationSelect.value = "off";
      dictationSelect.disabled = true;
    });
  }

  newSetBtn.addEventListener("click", function () {
    clearFlashTimer();
    resetReviewUI();

    makeSession();

    updateControls();
    showCurrent();
  });

  checkBtn.addEventListener("click", score);

  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      score();
    }
  });

  repeatBtn.addEventListener("click", function () {
    if (!hasActiveSession()) return;

    const entry = session.words[session.index];
    if (!entry) return;

    const mode = modeSelect.value;

    if (mode === "speak") {
      // Repeat button in spoken mode:
      // word + sentence + word (with pauses)
      speakWordWithSentence(entry.word);
    } else {
      showCurrent();
    }
  });

  nextBtn.addEventListener("click", advance);

  poolSelect.addEventListener("change", function () {
    spellingState.poolChoice = poolSelect.value;
    saveStore();
    session = null;
    setIdleUI();
  });

  if (setSizeSelect) {
    setSizeSelect.addEventListener("change", function () {
      session = null;
      setIdleUI();
    });
  }

  /* -------------------------
     Boot
  ------------------------- */

  setIdleUI();
}