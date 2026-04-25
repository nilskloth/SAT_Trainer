/* =========================
   Rendering helpers
   (stateless, DOM-only)
========================= */
/* jshint esversion: 11 */

/**
 * Render a list of questions.
 */
export function renderQuestionList(questions, answers, options) {
  const wrap = document.createElement("div");
  const showChoices = !!(options && options.showChoices);

  for (let i = 0; i < (questions || []).length; i += 1) {
    const q = questions[i];
    const card = document.createElement("div");
    card.className = "q";

    const qid = q.id || ("q" + (i + 1));
    card.id = "runner-q-" + qid;

    const stem = document.createElement("div");
    stem.className = "stem";
    stem.textContent = (i + 1) + ". " + (q.stem || "");
    card.appendChild(stem);

    if (q.type === "mcq" && showChoices && Array.isArray(q.choices)) {
      card.appendChild(renderMCQ(qid, q.choices, answers));
    } else {
      card.appendChild(renderShortAnswer(qid, answers));
    }

    wrap.appendChild(card);
  }

  return wrap;
}

/* =========================
   MCQ rendering
========================= */

function renderMCQ(qid, choices, answers) {
  const cwrap = document.createElement("div");
  cwrap.className = "choices";

  for (let i = 0; i < choices.length; i += 1) {
    const label = document.createElement("label");

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = qid;
    radio.value = choices[i];
    radio.checked = answers[qid] === choices[i];

    // no closure-in-loop lint warning
    radio.addEventListener("change", makeMCQHandler(answers, qid, choices[i]));

    const text = document.createElement("div");
    text.textContent = choices[i];

    label.appendChild(radio);
    label.appendChild(text);
    cwrap.appendChild(label);
  }

  return cwrap;
}

function makeMCQHandler(answers, qid, value) {
  return function () {
    answers[qid] = value;
  };
}

/* =========================
   Short answer rendering
========================= */

function renderShortAnswer(qid, answers) {
  const input = document.createElement("input");
  input.type = "text";
  input.id = "runner-input-" + qid;
  input.placeholder = "Type your answer…";
  input.value = answers[qid] || "";

  input.addEventListener("input", makeShortAnswerHandler(answers, qid));
  return input;
}

function makeShortAnswerHandler(answers, qid) {
  return function (e) {
    answers[qid] = e.target.value;
  };
}

/* =========================
   Reading passage
========================= */

export function renderPassage(passage) {
  const wrap = document.createElement("div");
  wrap.className = "q";

  const title = document.createElement("div");
  title.className = "stem";
  title.textContent = passage.title || "";
  wrap.appendChild(title);

  const text = document.createElement("div");
  text.style.whiteSpace = "pre-wrap";
  text.style.marginTop = "8px";
  text.textContent = passage.text || "";
  wrap.appendChild(text);

  return wrap;
}