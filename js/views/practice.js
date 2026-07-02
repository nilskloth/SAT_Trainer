/* =========================================================
   Practice: focused training by topic/domain.
   Generic engine — the unified schema means most trainers
   are "filter bank → render → mark". Bespoke views:
   spelling (adaptive, speech) lives in spelling.js.
   Routes:
     #/practice                     hub
     #/practice/gps/<topicId>      grammar topic (definition + questions)
     #/practice/<subject>/d/<dom>  domain drill
     #/practice/maths/arithmetic   arithmetic drill
     #/practice/prefixes           prefix round
     #/practice/spelling           adaptive spelling
   ========================================================= */

import { getData } from "../core/loader.js";
import { recordAttempt } from "../core/store.js";
import { getStore } from "../core/store.js";
import { mark } from "../core/marking.js";
import { pickN, esc, shuffle } from "../core/utils.js";
import { renderQuestion, collectAnswer, showResult } from "../render/question.js";
import { generateArithmeticPaper } from "../gen/arithmetic.js";
import { renderSpelling } from "./spelling.js";
import { renderDivision } from "./division.js";
import { domainLabel } from "./paper.js";

const SET_SIZE = 10;

export function renderPractice(el, params = []) {
  if (params[0] === "spelling") return renderSpelling(el);
  if (params[0] === "division") return renderDivision(el);
  if (params[0] === "prefixes") return runPrefixes(el);
  if (params[0] === "maths" && params[1] === "arithmetic") {
    return runSet(el, "maths", "Arithmetic drill", () => pickN(generateArithmeticPaper(), SET_SIZE));
  }
  if (params[0] === "gps" && params[1] && params[1] !== "d") return runTopic(el, params[1]);
  if (params.length >= 3 && params[1] === "d") return runDomain(el, params[0], params[2]);
  renderHub(el);
}

/* =========================
   Hub
========================= */

function domainsOf(questions) {
  const map = {};
  questions.forEach(q => {
    map[q.domain] = (map[q.domain] || 0) + 1;
  });
  return Object.entries(map).sort();
}

function renderHub(el) {
  const data = getData();

  const gpsTopics = (data.gps.topics || []).map(t =>
    `<a class="btn" href="#/practice/gps/${t.id}">${esc(t.label)}</a>`).join(" ");

  const gpsDomains = domainsOf(data.gps.questions).map(([d, n]) =>
    `<a class="btn" href="#/practice/gps/d/${d}">${esc(domainLabel(d))} <span class="muted">(${n})</span></a>`).join(" ");

  const strands = {};
  data.maths.questions.forEach(q => {
    strands[q.strand || "number"] = (strands[q.strand || "number"] || 0) + 1;
  });
  const mathsLinks = Object.entries(strands).sort().map(([s, n]) =>
    `<a class="btn" href="#/practice/maths/d/${s}">${esc(s[0].toUpperCase() + s.slice(1))} <span class="muted">(${n})</span></a>`).join(" ");

  const readingPool = data.reading.questions.filter(q => !q.passageId);
  const readingLinks = domainsOf(readingPool).map(([d, n]) =>
    `<a class="btn" href="#/practice/reading/d/${d}">${esc(domainLabel(d))} <span class="muted">(${n})</span></a>`).join(" ");

  el.innerHTML = `
    <div class="card" data-subject="spelling" style="margin-bottom:var(--sp-4);">
      <h2 style="margin-top:0;">Spelling</h2>
      <p><a class="btn primary" href="#/practice/spelling">Practise spellings</a>
         <a class="btn" href="#/practice/prefixes">Prefixes</a></p>
    </div>
    <div class="card" data-subject="gps" style="margin-bottom:var(--sp-4);">
      <h2 style="margin-top:0;">Grammar &amp; punctuation</h2>
      <p class="muted">By topic:</p>
      <p style="line-height:2.4;">${gpsTopics}</p>
      <p class="muted">Mixed practice by area:</p>
      <p style="line-height:2.4;">${gpsDomains}</p>
    </div>
    <div class="card" data-subject="maths" style="margin-bottom:var(--sp-4);">
      <h2 style="margin-top:0;">Maths</h2>
      <p style="line-height:2.4;">
        <a class="btn primary" href="#/practice/maths/arithmetic">Arithmetic drill</a>
        <a class="btn" href="#/practice/division">Short division walkthrough</a>
        ${mathsLinks}
      </p>
    </div>
    ${readingLinks ? `
    <div class="card" data-subject="reading">
      <h2 style="margin-top:0;">Reading warm-ups</h2>
      <p style="line-height:2.4;">${readingLinks}</p>
    </div>` : ""}
  `;
}

/* =========================
   Generic question set
========================= */

function runDomain(el, subject, dom) {
  const data = getData();
  const pool = subject === "maths"
    ? data.maths.questions.filter(q => (q.strand || "number") === dom || q.domain === dom)
    : (data[subject]?.questions || []).filter(q => q.domain === dom && !q.passageId);
  const label = subject === "maths" ? dom[0].toUpperCase() + dom.slice(1) : domainLabel(dom);
  runSet(el, subject, label, () => pickN(pool.filter(q => q.marking === "auto"), SET_SIZE));
}

function runTopic(el, topicId) {
  const data = getData();
  const topic = (data.gps.topics || []).find(t => t.id === topicId);
  const pool = data.gps.questions.filter(q => q.topicId === topicId);
  if (!topic) { location.hash = "#/practice"; return; }

  const examples = (topic.examples || []).slice(0, 2).map(ex => {
    const words = ex.sentence.split(" ");
    const hi = new Set((ex.highlight || []).map(Number));
    const sentence = words.map((w, i) =>
      hi.has(i) ? `<strong style="color:var(--c-gps);">${esc(w)}</strong>` : esc(w)).join(" ");
    return `<p>${sentence}<br><span class="muted" style="font-size:var(--fs-0);">${esc(ex.explanation || "")}</span></p>`;
  }).join("");

  runSet(el, "gps", topic.label, () => pickN(pool, SET_SIZE), `
    <div class="card" style="margin-bottom:var(--sp-4);">
      <h3 style="margin-top:0;">${esc(topic.label)}</h3>
      <div>${topic.definition || ""}</div>
      ${examples}
    </div>`);
}

function runSet(el, subject, label, pickQuestions, introHtml = "") {
  const questions = pickQuestions();
  if (!questions.length) {
    el.innerHTML = `<div class="card"><p>No questions here yet.</p><a class="btn" href="#/practice">Back</a></div>`;
    return;
  }

  el.dataset.subject = subject;
  el.innerHTML = `
    <div class="run-bar">
      <h2>${esc(label)}</h2>
      <a class="btn quiet" href="#/practice">Back</a>
    </div>
    ${introHtml}
    <div class="paper-sheet" data-subject="${subject}" data-questions></div>
    <div style="margin-top:var(--sp-4);display:flex;gap:var(--sp-3);align-items:center;">
      <button class="primary" data-check>Check my answers</button>
      <button data-again class="hidden">Another set</button>
      <span class="muted" data-score></span>
    </div>
  `;

  const sheet = el.querySelector("[data-questions]");
  const els = new Map();
  questions.forEach((q, i) => {
    const qEl = renderQuestion(q, i + 1);
    els.set(q.id, qEl);
    sheet.appendChild(qEl);
  });

  el.querySelector("[data-check]").addEventListener("click", () => {
    let earned = 0;
    let possible = 0;
    const items = questions.map(q => {
      const qEl = els.get(q.id);
      const r = mark(q, collectAnswer(q, qEl));
      showResult(q, qEl, r);
      earned += r.earned;
      possible += r.possible;
      return { qid: q.id, domain: q.domain, subject: q.subject, marks: r.possible, earned: r.earned, marking: "auto" };
    });
    recordAttempt({ mode: "practice", seconds: 0, items });
    el.querySelector("[data-score]").textContent = `${earned} / ${possible}`;
    el.querySelector("[data-check]").disabled = true;
    el.querySelector("[data-again]").classList.remove("hidden");
  });

  el.querySelector("[data-again]").addEventListener("click", () => {
    runSet(el, subject, label, pickQuestions, introHtml);
  });
}

/* =========================
   Prefixes round (7 pairs + 4 sentences, from v1)
========================= */

function runPrefixes(el) {
  const px = getData().spelling.prefixes;
  const pairs = pickN(px.wordPairs, 7);
  const sentences = pickN(px.sentences, 4);

  el.dataset.subject = "spelling";
  const options = opts => shuffle(opts).map(o => `<option value="${esc(o)}">${esc(o)}-</option>`).join("");

  el.innerHTML = `
    <div class="run-bar"><h2>Prefixes</h2><a class="btn quiet" href="#/practice">Back</a></div>
    <div class="paper-sheet" data-subject="spelling">
      <p><strong>Choose the prefix that makes a real word.</strong></p>
      ${pairs.map((p, i) => `
        <div class="order-row" data-pair="${i}">
          <select style="font:inherit;width:80px;"><option value="">…</option>${options(p.options)}</select>
          <span>${esc(p.root)}</span>
        </div>`).join("")}
      <p style="margin-top:var(--sp-5);"><strong>Complete each sentence.</strong></p>
      ${sentences.map((s, i) => `
        <p data-sentence="${i}">${esc(s.before)}
          <select style="font:inherit;width:80px;"><option value="">…</option>${options(s.options)}</select><strong>${esc(s.root)}</strong>
          ${esc(s.after)}</p>`).join("")}
    </div>
    <div style="margin-top:var(--sp-4);display:flex;gap:var(--sp-3);align-items:center;">
      <button class="primary" data-check>Check my answers</button>
      <button data-again class="hidden">Another round</button>
      <span class="muted" data-score></span>
    </div>
  `;

  el.querySelector("[data-check]").addEventListener("click", () => {
    let earned = 0;
    const grade = (sel, want, container) => {
      const ok = sel.value === want;
      if (ok) earned++;
      container.style.background = ok ? "var(--correct-soft)" : "var(--wrong-soft)";
      if (!ok) container.insertAdjacentHTML("beforeend",
        ` <span class="muted" style="font-size:var(--fs-0);">(${esc(want)}-)</span>`);
      sel.disabled = true;
    };
    pairs.forEach((p, i) => {
      const row = el.querySelector(`[data-pair="${i}"]`);
      grade(row.querySelector("select"), p.prefix, row);
    });
    sentences.forEach((s, i) => {
      const row = el.querySelector(`[data-sentence="${i}"]`);
      grade(row.querySelector("select"), s.prefix, row);
    });
    const total = pairs.length + sentences.length;
    recordAttempt({
      mode: "practice", seconds: 0,
      items: [{ qid: "prefix-round", domain: "G6", subject: "gps", marks: total, earned, marking: "auto" }]
    });
    el.querySelector("[data-score]").textContent = `${earned} / ${total}`;
    el.querySelector("[data-check]").disabled = true;
    el.querySelector("[data-again]").classList.remove("hidden");
  });

  el.querySelector("[data-again]").addEventListener("click", () => runPrefixes(el));
}
