/* training/grammar.js */
/* jshint esversion: 11 */

let grammarTopics = [];
let currentTopic = null;
let currentQuestionIndex = 0;
let activeTest = null;

/* =========================
   Init
========================= */

export function initGrammar() {
  const data = window.DATA?.banks?.grammar?.grammar?.topics;

  if (!Array.isArray(data)) {
    console.warn("Grammar data not loaded or malformed");
    return;
  }

  grammarTopics = data;

  buildTopicTabs();

  if (grammarTopics.length) {
    loadTopic(grammarTopics[0].id);
    setActiveTab(grammarTopics[0].id);
  }

  const checkBtn = document.getElementById("grammarCheckBtn");
  const nextBtn = document.getElementById("grammarNextBtn");

  if (checkBtn) {
    checkBtn.addEventListener("click", () => {
      if (activeTest && !activeTest.checked) {
        activeTest.check();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (!activeTest || !activeTest.checked) return;
      currentQuestionIndex += 1;
      renderQuestion();
    });
  }
}

/* =========================
   Topic tabs
========================= */

const TENSE_IDS = new Set([
  'simple-present', 'simple-past', 'present-progressive',
  'past-progressive', 'present-perfect', 'past-perfect', 'simple-future'
]);

function buildTopicTabs() {
  const wrap = document.getElementById("grammarTopicTabs");
  if (!wrap) return;

  wrap.innerHTML = "";

  let tenseLabelAdded = false;

  grammarTopics.forEach(topic => {
    if (TENSE_IDS.has(topic.id) && !tenseLabelAdded) {
      const label = document.createElement("span");
      label.className = "grammar-group-label";
      label.textContent = "Tenses";
      wrap.appendChild(label);
      tenseLabelAdded = true;
    }

    const btn = document.createElement("button");
    btn.textContent = topic.label;
    btn.className = "grammar-tab";
    btn.dataset.topicId = topic.id;

    btn.addEventListener("click", () => {
      setActiveTab(topic.id);
      loadTopic(topic.id);
    });

    wrap.appendChild(btn);
  });
}

function setActiveTab(topicId) {
  document
    .querySelectorAll(".grammar-tab")
    .forEach(b =>
      b.classList.toggle("active", b.dataset.topicId === topicId)
    );
}

/* =========================
   Topic loading
========================= */

function loadTopic(topicId) {
  currentTopic = grammarTopics.find(t => t.id === topicId);
  currentQuestionIndex = 0;

  if (!currentTopic) return;

  renderDefinition();
  renderExample();
  renderQuestion();
}

/* =========================
   Helpers
========================= */

function tokenize(sentence) {
  return sentence.split(" ").map((word, index) => ({
    word,
    index
  }));
}

/* =========================
   Meaning + Example
========================= */

function renderDefinition() {
  const el = document.getElementById("grammarDefinition");
  if (!el || !currentTopic) return;

  el.innerHTML = `
    <h4 class="grammar-subtitle">Meaning</h4>
    <p class="grammar-meaning-text">${currentTopic.definition}</p>
  `;
}

function renderExample() {
  const el = document.getElementById("grammarExample");
  if (!el || !currentTopic) return;

  const ex = currentTopic.examples?.[0];
  if (!ex) {
    el.innerHTML = "";
    return;
  }

  const tokens = tokenize(ex.sentence);
  const highlight = new Set(ex.highlight || []);

  const html = tokens
    .map(t =>
      highlight.has(t.index) ?
        `<span class="grammar-highlight">${t.word}</span>`
        : t.word
    )
    .join(" ");

  el.innerHTML = `
    <h4 class="grammar-subtitle">Example</h4>
    <p class="grammar-example-sentence">${html}</p>
    ${ex.explanation ? `<p class="grammar-example-note muted">${ex.explanation}</p>` : ""}
  `;
}

/* =========================
   Test rendering
========================= */

function renderQuestion() {
  const sentenceEl =
    document.querySelector(".grammar-test .grammar-sentence");
  const feedbackEl =
    document.getElementById("grammarFeedback");
  const checkBtn =
    document.getElementById("grammarCheckBtn");
  const nextBtn =
    document.getElementById("grammarNextBtn");
  const counterEl =
    document.getElementById("grammarCounter");
  const taskEl =
    document.querySelector(".grammar-test .grammar-task");

  if (!sentenceEl || !feedbackEl || !checkBtn || !nextBtn) return;

  sentenceEl.innerHTML = "";
  feedbackEl.textContent = "";
  feedbackEl.className = "";
  checkBtn.disabled = true;
  nextBtn.disabled = true;
  activeTest = null;

  const questions = currentTopic.questions || [];
  const q = questions[currentQuestionIndex];

  if (counterEl) {
    counterEl.textContent =
      `Question ${currentQuestionIndex + 1} of ${questions.length}`;
  }

  nextBtn.style.display =
    questions.length > 1 ? "" : "none";

  if (!q) {
    sentenceEl.innerHTML = `<span class="ok">✓ Topic complete</span>`;
    if (taskEl) taskEl.textContent = "";
    return;
  }

  if (q.type === "roles") {
    renderRolesQuestion(sentenceEl, q);
  } else {
    if (taskEl) {
      taskEl.textContent =
        q.task || "Select the correct part of the sentence.";
    }
    renderSelectableSentence(sentenceEl, q);
  }
}

/* =========================
   Select-in-sentence test
========================= */

function renderSelectableSentence(container, question) {
  const tokens = tokenize(question.sentence);
  const selected = new Set();
  const correct = new Set(question.answer.map(Number));
  const checkBtn = document.getElementById("grammarCheckBtn");

  container.innerHTML = "";

  tokens.forEach(t => {
    const span = document.createElement("span");
    span.textContent = t.word;
    span.className = "grammar-token";
    span.dataset.index = t.index;

    span.addEventListener("click", () => {
      if (span.classList.contains("locked")) return;

      if (selected.has(t.index)) {
        selected.delete(t.index);
        span.classList.remove("selected");
      } else {
        selected.add(t.index);
        span.classList.add("selected");
      }

      checkBtn.disabled = selected.size === 0;
    });

    container.appendChild(span);
    container.append(" ");
  });

  activeTest = {
    checked: false,

    check() {
      this.checked = true;

      lockTokens(container);
      revealAnswer(container, selected, correct);

      const isCorrect =
        selected.size === correct.size &&
        [...selected].every(i => correct.has(i));

        const feedback =
          document.getElementById("grammarFeedback");
        const checkBtn =
          document.getElementById("grammarCheckBtn");
        const nextBtn =
          document.getElementById("grammarNextBtn");

        feedback.textContent = isCorrect ?
          "✓ Correct"
          : "✗ Incorrect";

        feedback.className = isCorrect ? "correct" : "wrong";

        if (checkBtn) {
          checkBtn.disabled = true;   // ← ✅ THIS IS THE LINE YOU NEED
        }

        if (nextBtn) {
          nextBtn.disabled = false;
        }
    }
  };
}

/* =========================
   Roles question (subject / verb / object / agent)
========================= */

function renderRolesQuestion(container, question) {
  const parts   = question.parts;
  const tokens  = tokenize(question.sentence);
  let currentPartIdx = 0;
  let selected       = new Set();
  let partConfirmed  = false;
  const confirmedRoles = new Map(); // tokenIndex → role string

  const checkBtn   = document.getElementById("grammarCheckBtn");
  const nextBtn    = document.getElementById("grammarNextBtn");
  const feedbackEl = document.getElementById("grammarFeedback");
  const taskEl     = document.querySelector(".grammar-test .grammar-task");

  container.innerHTML = "";
  const spans = [];

  tokens.forEach(t => {
    const span = document.createElement("span");
    span.textContent    = t.word;
    span.className      = "grammar-token";
    span.dataset.index  = String(t.index);
    span.addEventListener("click", function () {
      if (this.classList.contains("locked")) return;
      const i = Number(this.dataset.index);
      if (selected.has(i)) {
        selected.delete(i);
        this.classList.remove("selected");
      } else {
        selected.add(i);
        this.classList.add("selected");
      }
      if (checkBtn) checkBtn.disabled = selected.size === 0;
    });
    container.appendChild(span);
    container.append(" ");
    spans.push(span);
  });

  function setTask() {
    if (!taskEl) return;
    if (currentPartIdx < parts.length) {
      const p = parts[currentPartIdx];
      taskEl.textContent =
        "Step " + (currentPartIdx + 1) + " of " + parts.length +
        ": Select the " + p.label + " — " + p.hint + ".";
    } else {
      taskEl.textContent = "All parts identified!";
    }
  }

  function resetForNextPart() {
    selected      = new Set();
    partConfirmed = false;
    spans.forEach((span, i) => {
      span.classList.remove("selected", "wrong-answer");
      if (!confirmedRoles.has(i)) span.classList.remove("locked");
    });
    if (feedbackEl) { feedbackEl.textContent = ""; feedbackEl.className = ""; }
    if (checkBtn)   { checkBtn.textContent = "Check"; checkBtn.disabled = true; }
    setTask();
  }

  activeTest = {
    checked: false,

    check() {
      if (partConfirmed) {
        resetForNextPart();
        return;
      }

      const part    = parts[currentPartIdx];
      const correct = new Set(part.answer.map(Number));
      const isCorrect = selected.size === correct.size &&
        [...selected].every(i => correct.has(i));

      spans.forEach(span => span.classList.add("locked"));
      spans.forEach((span, i) => {
        span.classList.remove("selected");
        if (correct.has(i)) {
          span.classList.add("grammar-role-" + part.role);
          confirmedRoles.set(i, part.role);
        } else if (selected.has(i)) {
          span.classList.add("wrong-answer");
        }
      });

      if (feedbackEl) {
        feedbackEl.textContent = isCorrect ? "✓ Correct" : "✗ Not quite — correct answer shown";
        feedbackEl.className   = isCorrect ? "correct" : "wrong";
      }
      if (checkBtn) checkBtn.disabled = true;

      currentPartIdx++;

      if (currentPartIdx < parts.length) {
        partConfirmed = true;
        if (checkBtn) {
          checkBtn.textContent = "Next step →";
          checkBtn.disabled    = false;
        }
      } else {
        this.checked = true;
        if (checkBtn) checkBtn.textContent = "Check";
        if (nextBtn)  nextBtn.disabled = false;
        setTask();
        if (feedbackEl) {
          feedbackEl.textContent = "✓ All parts found!";
          feedbackEl.className   = "correct";
        }
      }
    }
  };

  if (checkBtn) { checkBtn.textContent = "Check"; checkBtn.disabled = true; }
  if (nextBtn)  nextBtn.disabled = true;
  setTask();
}

/* =========================
   Reveal logic
========================= */

function lockTokens(container) {
  container
    .querySelectorAll(".grammar-token")
    .forEach(t => t.classList.add("locked"));
}

function revealAnswer(container, selected, correct) {
  container
    .querySelectorAll(".grammar-token")
    .forEach(tok => {
      const i = Number(tok.dataset.index);

      if (correct.has(i)) {
        tok.classList.add("correct-answer");
      } else if (selected.has(i)) {
        tok.classList.add("wrong-answer");
      }
    });
}