/* training/prefixes.js */
/* jshint esversion: 11 */

const PAIR_COUNT = 7;
const SENTENCE_COUNT = 4;

let allPairs = [];
let allSentences = [];
let allDefs = [];
let currentPairs = [];
let currentSentences = [];
let checked = false;

/* =========================
   Init
========================= */

export function initPrefixes() {
  const data = window.DATA?.prefixes;

  if (!data) {
    console.warn("Prefix data not loaded");
    return;
  }

  allPairs     = data.wordPairs   || [];
  allSentences = data.sentences   || [];
  allDefs      = data.prefixDefs  || [];

  wirePrefixSubTabs();
  renderMeaning();

  document.getElementById("prefixNewSetBtn")
    ?.addEventListener("click", generateSet);

  document.getElementById("prefixCheckBtn")
    ?.addEventListener("click", checkAnswers);

  generateSet();
}

/* =========================
   Sub-tab wiring
========================= */

function wirePrefixSubTabs() {
  const subTabs   = document.querySelectorAll("[data-prefix-tab]");
  const subPanels = document.querySelectorAll(".prefix-sub");

  subTabs.forEach(btn => {
    btn.addEventListener("click", () => {
      activatePrefixSub(btn.dataset.prefixTab, subTabs, subPanels);
    });
  });

  activatePrefixSub("practice", subTabs, subPanels);
}

function activatePrefixSub(target, subTabs, subPanels) {
  subTabs.forEach(b =>
    b.classList.toggle("active", b.dataset.prefixTab === target)
  );
  subPanels.forEach(p =>
    p.classList.toggle("hidden", p.id !== `prefix-sub-${target}`)
  );
}

/* =========================
   Render — meaning panel
========================= */

function renderMeaning() {
  const container = document.getElementById("prefixMeaningArea");
  if (!container || !allDefs.length) return;

  container.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "prefix-def-grid";

  allDefs.forEach(def => {
    const card = document.createElement("div");
    card.className = "prefix-def-card";

    const prefixEl = document.createElement("div");
    prefixEl.className = "prefix-def-prefix";
    prefixEl.textContent = def.prefix + "–";
    card.appendChild(prefixEl);

    const meaningEl = document.createElement("div");
    meaningEl.className = "prefix-def-meaning";
    meaningEl.textContent = def.meaning;
    card.appendChild(meaningEl);

    const exDiv = document.createElement("div");
    exDiv.className = "prefix-def-examples";

    def.examples.forEach(word => {
      const pill = document.createElement("span");
      pill.className = "pill";
      pill.innerHTML =
        `<span class="grammar-highlight">${def.prefix}</span>${word.slice(def.prefix.length)}`;
      exDiv.appendChild(pill);
    });

    card.appendChild(exDiv);
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

/* =========================
   Helpers
========================= */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildSelect(options, id, placeholder) {
  const sel = document.createElement("select");
  sel.className = "prefix-select";
  if (id) sel.id = id;

  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = placeholder || "— prefix —";
  sel.appendChild(blank);

  shuffle(options).forEach(opt => {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt + "–";
    sel.appendChild(o);
  });

  return sel;
}

/* =========================
   Generate
========================= */

function generateSet() {
  checked = false;
  currentPairs = shuffle(allPairs).slice(0, PAIR_COUNT);
  currentSentences = shuffle(allSentences).slice(0, SENTENCE_COUNT);

  renderPairs();
  renderSentences();

  const scoreEl = document.getElementById("prefixScore");
  if (scoreEl) { scoreEl.textContent = ""; scoreEl.className = ""; }

  const checkBtn = document.getElementById("prefixCheckBtn");
  if (checkBtn) checkBtn.disabled = false;
}

/* =========================
   Render — word pairs
========================= */

function renderPairs() {
  const container = document.getElementById("prefixPairsArea");
  if (!container) return;

  container.innerHTML = "";

  currentPairs.forEach((pair, i) => {
    const row = document.createElement("div");
    row.className = "prefix-row";

    const sel = buildSelect(pair.options, `prefixPair_${i}`, "prefix");
    sel.dataset.answer = pair.prefix;

    const root = document.createElement("span");
    root.className = "prefix-root";
    root.textContent = pair.root;

    row.appendChild(sel);
    row.appendChild(root);
    container.appendChild(row);
  });
}

/* =========================
   Render — sentences
========================= */

function renderSentences() {
  const container = document.getElementById("prefixSentencesArea");
  if (!container) return;

  container.innerHTML = "";

  currentSentences.forEach((s, i) => {
    const block = document.createElement("div");
    block.className = "prefix-sentence-block";

    const sentence = document.createElement("p");
    sentence.className = "prefix-sentence";

    if (s.before) {
      sentence.appendChild(document.createTextNode(s.before + " "));
    }

    const sel = buildSelect(s.options, `prefixSent_${i}`, "___");
    sel.className = "prefix-select prefix-select--inline";
    sel.dataset.answer = s.prefix;

    sentence.appendChild(sel);

    const rootSpan = document.createElement("span");
    rootSpan.className = "prefix-inline-root";
    rootSpan.textContent = s.root;
    sentence.appendChild(rootSpan);

    if (s.after) {
      const afterText = s.after.startsWith(".") || s.after.startsWith(",")
        ? s.after
        : " " + s.after;
      sentence.appendChild(document.createTextNode(afterText));
    }

    block.appendChild(sentence);
    container.appendChild(block);
  });
}

/* =========================
   Check answers
========================= */

function checkAnswers() {
  if (checked) return;
  checked = true;

  let correct = 0;
  const total = currentPairs.length + currentSentences.length;

  /* --- pairs --- */
  currentPairs.forEach((pair, i) => {
    const sel = document.getElementById(`prefixPair_${i}`);
    if (!sel) return;

    const row = sel.closest(".prefix-row");
    const isCorrect = sel.value === pair.prefix;
    if (isCorrect) correct++;

    sel.disabled = true;
    row.classList.add(isCorrect ? "prefix-correct" : "prefix-wrong");

    const badge = document.createElement("span");
    badge.className = "prefix-badge";
    badge.textContent = isCorrect ? "✓" : `✗  ${pair.prefix}–${pair.root}`;
    badge.classList.add(isCorrect ? "ok" : "bad");
    row.appendChild(badge);
  });

  /* --- sentences --- */
  currentSentences.forEach((s, i) => {
    const sel = document.getElementById(`prefixSent_${i}`);
    if (!sel) return;

    const block = sel.closest(".prefix-sentence-block");
    const isCorrect = sel.value === s.prefix;
    if (isCorrect) correct++;

    sel.disabled = true;
    block.classList.add(isCorrect ? "prefix-correct" : "prefix-wrong");

    if (!isCorrect) {
      const hint = document.createElement("p");
      hint.className = "prefix-hint muted";
      hint.textContent = `Answer: ${s.prefix}${s.root}`;
      block.appendChild(hint);
    }
  });

  /* --- score --- */
  const scoreEl = document.getElementById("prefixScore");
  if (scoreEl) {
    const pct = Math.round((correct / total) * 100);
    scoreEl.textContent = `Score: ${correct} / ${total} (${pct}%)`;
    scoreEl.className = correct === total ? "ok" : correct >= Math.ceil(total * 0.7) ? "correct" : "bad";
  }

  document.getElementById("prefixCheckBtn").disabled = true;
}
