/* =========================================================
   Paper-style question rendering.

   renderQuestion(q, num)      → element (data-qid set)
   collectAnswer(q, el)        → answer in marking.js conventions
   showResult(q, el, result)   → marking classes + notes
   ========================================================= */

import { esc } from "../core/utils.js";

export function renderQuestion(q, num) {
  const el = document.createElement("div");
  el.className = "paper-q";
  el.dataset.qid = q.id;

  const marksLabel = q.marks === 1 ? "1 mark" : `${q.marks} marks`;
  el.innerHTML = `
    <div><div class="paper-q-num">${num}</div></div>
    <div class="paper-q-body">
      <div class="paper-q-head">
        <div class="paper-q-stem">${q.stem || ""}</div>
        <span class="paper-q-marks">${marksLabel}</span>
      </div>
      <div class="paper-q-input"></div>
      <div class="paper-q-result"></div>
    </div>
  `;

  const input = el.querySelector(".paper-q-input");
  const build = BUILDERS[q.type];
  if (build) build(q, input);
  else input.innerHTML = `<p class="muted">Unsupported question type: ${esc(q.type)}</p>`;
  return el;
}

/* =========================
   Builders
========================= */

function choiceList(q, input, { name, type, choices }) {
  const wrap = document.createElement("div");
  wrap.className = "choice-list";
  choices.forEach(c => {
    const label = document.createElement("label");
    label.className = "choice";
    label.innerHTML = `<input type="${type}" name="${name}" value="${esc(c)}"><span>${esc(c)}</span>`;
    wrap.appendChild(label);
  });
  input.appendChild(wrap);
}

const BUILDERS = {
  mcq(q, input) {
    choiceList(q, input, { name: `q-${q.id}`, type: "radio", choices: q.choices });
  },

  tick2(q, input) {
    input.insertAdjacentHTML("beforeend", `<p class="muted" style="font-size:var(--fs-0);">Tick <strong>two</strong>.</p>`);
    choiceList(q, input, { name: `q-${q.id}`, type: "checkbox", choices: q.choices });
    input.addEventListener("change", () => {
      const boxes = [...input.querySelectorAll("input[type=checkbox]")];
      const ticked = boxes.filter(b => b.checked);
      boxes.forEach(b => { b.disabled = !b.checked && ticked.length >= 2; });
    });
  },

  truefalse(q, input) {
    const grid = document.createElement("div");
    grid.className = "stmt-grid";
    q.statements.forEach((s, i) => {
      grid.insertAdjacentHTML("beforeend", `
        <div class="stmt-row">
          <span>${esc(s.text)}</span>
          <span class="stmt-opts">
            <label><input type="radio" name="q-${q.id}-${i}" value="true"> True</label>
            <label><input type="radio" name="q-${q.id}-${i}" value="false"> False</label>
          </span>
        </div>`);
    });
    input.appendChild(grid);
  },

  factopin(q, input) {
    const grid = document.createElement("div");
    grid.className = "stmt-grid";
    q.statements.forEach((s, i) => {
      grid.insertAdjacentHTML("beforeend", `
        <div class="stmt-row">
          <span>${esc(s.text)}</span>
          <span class="stmt-opts">
            <label><input type="radio" name="q-${q.id}-${i}" value="fact"> Fact</label>
            <label><input type="radio" name="q-${q.id}-${i}" value="opinion"> Opinion</label>
          </span>
        </div>`);
    });
    input.appendChild(grid);
  },

  match(q, input) {
    const grid = document.createElement("div");
    grid.className = "stmt-grid";
    q.lefts.forEach((left, i) => {
      const opts = q.rights.map((r, j) => `<option value="${j}">${esc(r)}</option>`).join("");
      grid.insertAdjacentHTML("beforeend", `
        <div class="stmt-row">
          <span><strong>${esc(left)}</strong></span>
          <select data-left="${i}" style="font:inherit;max-width:340px;">
            <option value="">Choose…</option>${opts}
          </select>
        </div>`);
    });
    input.appendChild(grid);
  },

  order(q, input) {
    input.insertAdjacentHTML("beforeend", `<p class="muted" style="font-size:var(--fs-0);">Number these 1 to ${q.items.length}.</p>`);
    q.items.forEach((item, i) => {
      const fixed = q.fixed === i;
      input.insertAdjacentHTML("beforeend", `
        <div class="order-row">
          <input type="text" inputmode="numeric" data-item="${i}"
            ${fixed ? `value="${q.order[i]}" disabled` : ""}>
          <span>${esc(item)}</span>
        </div>`);
    });
  },

  circle2(q, input) {
    q.groups.forEach((g, i) => {
      const wrap = document.createElement("div");
      wrap.style.marginTop = "var(--sp-3)";
      wrap.innerHTML = `<p style="margin:0 0 var(--sp-1);"><em>${esc(g.prefix || "")}</em></p>`;
      const list = document.createElement("div");
      list.className = "choice-list";
      g.choices.forEach(c => {
        list.insertAdjacentHTML("beforeend", `
          <label class="choice"><input type="radio" name="q-${q.id}-g${i}" value="${esc(c)}"><span>${esc(c)}</span></label>`);
      });
      wrap.appendChild(list);
      input.appendChild(wrap);
    });
  },

  "short-closed"(q, input) {
    input.innerHTML = `<div class="answer-line"><input type="text" autocomplete="off" ${q.label ? `aria-label="${esc(q.label)}"` : ""}></div>`;
    if (q.label) input.insertAdjacentHTML("afterbegin", `<span style="margin-right:var(--sp-2);">${esc(q.label)}</span>`);
  },

  numeric(q, input) {
    input.innerHTML = `<div class="answer-box"><input type="text" inputmode="numeric" autocomplete="off"></div>`;
  },

  multi(q, input) {
    input.innerHTML = `
      ${q.label ? `<span style="margin-right:var(--sp-2);">${esc(q.label)}</span>` : ""}
      <div class="answer-line"><input type="text" autocomplete="off" placeholder="Separate answers with commas"></div>`;
  },

  pairs(q, input) {
    input.innerHTML = q.labels.map(l => `
      <span style="margin-right:var(--sp-4);white-space:nowrap;">
        ${esc(l)} = <span class="answer-box"><input type="text" inputmode="numeric" data-pair="${esc(l)}" style="width:90px;"></span>
      </span>`).join("");
  },

  tokens(q, input) {
    const wrap = document.createElement("p");
    wrap.className = "token-sentence";
    q.sentence.split(" ").forEach((word, i) => {
      const t = document.createElement("span");
      t.className = "token";
      t.dataset.index = i;
      t.textContent = word;
      t.addEventListener("click", () => t.classList.toggle("selected"));
      wrap.appendChild(t);
      wrap.appendChild(document.createTextNode(" "));
    });
    input.appendChild(wrap);
  },

  roles(q, input) {
    q.parts.forEach((part, pi) => {
      const section = document.createElement("div");
      section.style.marginTop = "var(--sp-3)";
      section.innerHTML = `<p style="margin:0;"><strong>${esc(part.label || part.role)}</strong>
        <span class="muted" style="font-size:var(--fs-0);">(${esc(part.hint || "")})</span></p>`;
      const wrap = document.createElement("p");
      wrap.className = "token-sentence";
      wrap.dataset.part = pi;
      q.sentence.split(" ").forEach((word, i) => {
        const t = document.createElement("span");
        t.className = "token";
        t.dataset.index = i;
        t.textContent = word;
        t.addEventListener("click", () => t.classList.toggle("selected"));
        wrap.appendChild(t);
        wrap.appendChild(document.createTextNode(" "));
      });
      section.appendChild(wrap);
      input.appendChild(section);
    });
  },

  /* Free-text (AI-marked) — ruled lines like the booklets */
  short(q, input) {
    input.innerHTML = `<div class="answer-line"><textarea rows="2"></textarea></div>`;
  },

  multishort(q, input) {
    input.innerHTML = `<div class="answer-line"><textarea rows="3"></textarea></div>`;
  },

  open(q, input) {
    input.innerHTML = `<div class="answer-line"><textarea rows="5"></textarea></div>`;
  }
};

/* =========================
   Answer collection
========================= */

export function collectAnswer(q, el) {
  const input = el.querySelector(".paper-q-input");
  switch (q.type) {
    case "mcq":
      return input.querySelector("input:checked")?.value ?? null;
    case "tick2":
      return [...input.querySelectorAll("input:checked")].map(b => b.value);
    case "truefalse":
      return q.statements.map((_, i) => {
        const v = input.querySelector(`input[name="q-${q.id}-${i}"]:checked`)?.value;
        return v == null ? null : v === "true";
      });
    case "factopin":
      return q.statements.map((_, i) =>
        input.querySelector(`input[name="q-${q.id}-${i}"]:checked`)?.value ?? null);
    case "match":
      return q.lefts.map((_, i) => {
        const v = input.querySelector(`select[data-left="${i}"]`)?.value;
        return v === "" || v == null ? null : Number(v);
      });
    case "order":
      return q.items.map((_, i) => input.querySelector(`input[data-item="${i}"]`)?.value ?? "");
    case "circle2":
      return q.groups.map((_, i) =>
        input.querySelector(`input[name="q-${q.id}-g${i}"]:checked`)?.value ?? null);
    case "pairs":
      return q.labels.map(l => input.querySelector(`input[data-pair="${CSS.escape(l)}"]`)?.value ?? "");
    case "tokens":
      return [...input.querySelectorAll(".token.selected")].map(t => Number(t.dataset.index));
    case "roles":
      return q.parts.map((_, pi) =>
        [...input.querySelectorAll(`[data-part="${pi}"] .token.selected`)].map(t => Number(t.dataset.index)));
    default:
      return input.querySelector("input, textarea")?.value ?? "";
  }
}

export function hasAnswer(q, answer) {
  if (answer == null) return false;
  if (typeof answer === "string") return answer.trim() !== "";
  if (Array.isArray(answer)) {
    return answer.some(a => a != null && String(a).trim?.() !== "" &&
      (!Array.isArray(a) || a.length > 0));
  }
  return true;
}

/* =========================
   Result display
========================= */

export function showResult(q, el, result, opts = {}) {
  const { earned, possible } = result;
  const cls = earned >= possible ? "is-correct" : earned > 0 ? "is-partial" : "is-wrong";
  el.classList.remove("is-correct", "is-partial", "is-wrong");
  el.classList.add(cls);

  const noteCls = earned >= possible ? "correct" : earned > 0 ? "partial" : "wrong";
  const box = el.querySelector(".paper-q-result");
  const model = q.markScheme?.modelAnswer;
  const feedback = opts.feedback ? `<p style="margin:var(--sp-1) 0 0;">${esc(opts.feedback)}</p>` : "";
  const marker = opts.marking === "ai" ? " · marked by AI" : opts.marking === "self" ? " · self-marked" : "";
  box.innerHTML = `
    <div class="mark-note ${noteCls}">
      <strong>${earned} / ${possible}${marker}</strong>
      ${feedback}
      ${model && earned < possible ? `<p style="margin:var(--sp-1) 0 0;" class="muted">Answer: ${model}</p>` : ""}
    </div>`;

  el.querySelectorAll("input, textarea, select").forEach(i => { i.disabled = true; });
  el.querySelectorAll(".token").forEach(t => { t.style.pointerEvents = "none"; });
}

export function showPending(el, text) {
  el.querySelector(".paper-q-result").innerHTML =
    `<div class="mark-note info">${esc(text)}</div>`;
}
