/* =========================================================
   Verb tables for one secondary language (present tense).
     #/secondary/<lang>/verbs        pick verbs + format, then run
     #/secondary/<lang>/verbs/<id>   look at one table

   Formats: Table — fill all six persons of one verb, then
            check them together; One at a time — a single
            pronoun + verb ("du · haben"), feedback each time.
   Both are adaptive per verb + person (store.vocab[lang].verbs,
   keyed "<verbId>|<0–5>"); a run is recorded as an attempt
   (mode "verbs", domain "Verbs") so Grown-ups sees it.
   Marking: checkVerbForm in core/vocab-match.js.
   ========================================================= */

import { saveStore, recordAttempt } from "../../core/store.js";
import { esc } from "../../core/utils.js";
import { newStat, weightedPick, applyResult } from "../../core/adaptive.js";
import { checkVerbForm, verbPronoun, verbPhrase, speakable } from "../../core/vocab-match.js";
import { canSpeak, speak } from "../../core/speech.js";
import { LANGS, loadVerbs, vocabState } from "./langs.js";
import { hearBtn, seg } from "./vocab.js";

const PERSONS = [0, 1, 2, 3, 4, 5];
const isMastered = s => (s?.mastery || 0) >= 0.8;

export async function renderVerbs(el, code, params = []) {
  const lang = LANGS[code];
  el.dataset.subject = lang.subject;
  el.innerHTML = `<div class="card"><p class="muted">Loading ${esc(lang.label)} verbs…</p></div>`;
  let data;
  try {
    data = await loadVerbs(code);
  } catch (err) {
    el.innerHTML = `<div class="card"><p>The ${esc(lang.label)} verb tables couldn't load. Check your connection and refresh.</p>
      <p class="muted">${esc(err.message)}</p></div>`;
    return;
  }
  if (!data) { location.hash = `#/secondary/${code}`; return; }
  const ctx = { el, lang, code, data, stats: vocabState(code).verbs };
  if (params[0]) return renderTable(ctx, params[0]);
  renderSetup(ctx);
}

const say = (lang, text, opts) => speak(speakable(text), lang.voice, opts);
const knownIn = (stats, verb) => PERSONS.filter(i => isMastered(stats[`${verb.id}|${i}`])).length;

/* =========================
   One table (study it)
========================= */

function renderTable(ctx, verbId) {
  const { el, lang, code, data, stats } = ctx;
  const verb = data.verbs.find(v => v.id === verbId);
  if (!verb) { location.hash = `#/secondary/${code}/verbs`; return; }

  el.innerHTML = `
    <div class="run-bar">
      <h2><span lang="${code}">${esc(verb.inf)}</span> <span class="muted" style="font-weight:400;">· ${esc(verb.en)}</span></h2>
      <a class="btn quiet" href="#/secondary/${code}/verbs">Back</a>
    </div>
    <div class="paper-sheet" data-subject="${lang.subject}">
      <p class="muted" style="margin-top:0;">${esc(data.tenseEn)}${verb.from ? ` · ${esc(verb.from)}` : ""}${verb.extra ? " · extra practice, not on the sheet" : ""}${canSpeak() ? " · tap 🔊 to hear each one" : ""}</p>
      <table class="word-list">
        <tbody>
          ${PERSONS.map(i => `
            <tr>
              <td lang="${code}"><span class="vocab-opener">${esc(verbPronoun(data.persons, verb, i))}</span>${verbPronoun(data.persons, verb, i).endsWith("'") ? "" : " "}${esc(verb.forms[i])}</td>
              <td>${esc(verb.formsEn[i])}</td>
              <td>${canSpeak() ? `<button type="button" class="quiet hear" data-say="${esc(verbPhrase(data.persons, verb, i))}" aria-label="Hear it">🔊</button>` : ""}</td>
              <td class="known">${isMastered(stats[`${verb.id}|${i}`]) ? "✓" : ""}</td>
            </tr>`).join("")}
        </tbody>
      </table>
      ${verb.note ? `<p class="muted vocab-note">💡 ${esc(verb.note)}</p>` : ""}
      <p style="margin-bottom:0;"><button class="primary" data-practise>Practise this verb</button></p>
    </div>`;

  el.querySelectorAll("[data-say]").forEach(b => b.addEventListener("click", () => say(lang, b.dataset.say)));
  el.querySelector("[data-practise]").addEventListener("click", () => startRun(ctx, { verbs: [verb], format: "table" }));
}

/* =========================
   Setup
========================= */

function renderSetup(ctx) {
  const { el, lang, code, data, stats } = ctx;
  const state = vocabState(code);
  const prefs = state.prefs.verbs || (state.prefs.verbs = {});
  const valid = new Set(data.verbs.map(v => v.id));
  let selected = new Set((prefs.selected || []).filter(id => valid.has(id)));
  if (!selected.size) data.verbs.filter(v => !v.extra).slice(0, 4).forEach(v => selected.add(v.id));
  const hasExtra = data.verbs.some(v => v.extra);

  el.innerHTML = `<div data-setup>
    <div class="run-bar">
      <h2>${esc(lang.label)} verbs <span class="muted" style="font-weight:400;">· ${esc(data.tenseEn)}</span></h2>
      <a class="btn quiet" href="#/secondary/${code}">Back</a>
    </div>

    <div class="card setup-card">
      <h3>1. Choose your verbs</h3>
      <div class="section-grid" style="margin-left:0;">
        ${data.verbs.map((v, i) => `
          ${v.extra && !data.verbs[i - 1]?.extra ? `<p class="section-group muted">Extra practice — not on the sheet</p>` : ""}
          <div class="section-row">
            <label class="section-pick">
              <input type="checkbox" data-verb="${v.id}" ${selected.has(v.id) ? "checked" : ""}>
              <span><strong lang="${code}">${esc(v.inf)}</strong><span class="muted"> · ${esc(v.en)}</span></span>
            </label>
            <span class="muted section-meta">${knownIn(stats, v)}/6 known</span>
            <a class="section-look" href="#/secondary/${code}/verbs/${v.id}">Look at the table</a>
          </div>`).join("")}
      </div>
      <p style="margin-bottom:0;">
        <button type="button" class="quiet" data-all>Select everything</button>
        ${hasExtra ? `<button type="button" class="quiet" data-sheet>Just the sheet</button>` : ""}
        <button type="button" class="quiet" data-none>Clear</button>
      </p>
    </div>

    <div class="card setup-card">
      <h3>2. How do you want to practise?</h3>
      <div class="seg-group">
        <span class="seg-label">Format</span>
        <div class="seg" role="radiogroup">
          ${seg("format", "table", "Fill the whole table", prefs.format || "table")}
          ${seg("format", "single", "One at a time", prefs.format || "table")}
        </div>
      </div>
      <p class="muted" data-explain style="margin:var(--sp-3) 0 0;"></p>
    </div>

    <div class="start-bar">
      <button class="primary" data-start>Start</button>
      <span class="muted" data-count></span>
    </div>
  </div>`;

  const val = () => el.querySelector('input[name="format"]:checked')?.value || "table";

  function refresh() {
    const n = selected.size;
    el.querySelector("[data-count]").textContent = n ? `${n} verb${n === 1 ? "" : "s"} selected` : "Choose at least one verb";
    el.querySelector("[data-start]").disabled = !n;
    el.querySelector("[data-explain]").textContent = val() === "table"
      ? `You'll see a verb and write all six forms (${data.persons.join(", ")}), then check them together.`
      : `You'll see one person and a verb — like “${data.persons[1]} · ${data.verbs[0].inf}” — and write that form.`;
    Object.assign(prefs, { selected: [...selected], format: val() });
    saveStore();
  }
  const setAll = ids => {
    selected = new Set(ids);
    el.querySelectorAll("[data-verb]").forEach(b => { b.checked = selected.has(b.dataset.verb); });
    refresh();
  };

  el.querySelector("[data-setup]").addEventListener("change", e => {
    const id = e.target.dataset.verb;
    if (id) e.target.checked ? selected.add(id) : selected.delete(id);
    refresh();
  });
  el.querySelector("[data-all]").addEventListener("click", () => setAll(data.verbs.map(v => v.id)));
  el.querySelector("[data-sheet]")?.addEventListener("click", () => setAll(data.verbs.filter(v => !v.extra).map(v => v.id)));
  el.querySelector("[data-none]").addEventListener("click", () => setAll([]));
  el.querySelector("[data-start]").addEventListener("click", () => {
    const verbs = data.verbs.filter(v => selected.has(v.id));
    if (verbs.length) startRun(ctx, { verbs, format: val() });
  });
  refresh();
}

/* =========================
   Running
========================= */

function startRun(ctx, cfg) {
  const { el, lang, code, data, stats } = ctx;
  const fresh = new Map();
  const statFor = (verb, i) => {
    const key = `${verb.id}|${i}`;
    if (stats[key]) return stats[key];
    if (!fresh.has(key)) fresh.set(key, newStat(key));
    return fresh.get(key);
  };
  const keep = (verb, i) => (stats[`${verb.id}|${i}`] = statFor(verb, i));
  const cells = cfg.verbs.flatMap(verb => PERSONS.map(i => ({ verb, i })));

  const run = { results: [], last: null, committed: false, startedAt: Date.now() };

  el.innerHTML = `
    <div class="run-bar">
      <h2>Verbs <span class="muted" style="font-weight:400;">· ${cfg.format === "table" ? "whole table" : "one at a time"}</span></h2>
      <span class="timer-pill" data-progress></span>
      <button type="button" class="quiet" data-finish>Finish</button>
    </div>
    <div class="paper-sheet vocab-card" data-subject="${lang.subject}">
      <p class="vocab-instruction muted" data-instruction></p>
      <div class="vocab-prompt" data-prompt></div>
      <p class="vocab-context muted" data-context></p>
      <div data-answer></div>
      <div class="vocab-feedback" data-feedback aria-live="polite"></div>
    </div>
    <div data-summary></div>`;
  const $ = s => el.querySelector(s);

  const onLeave = () => commit();
  window.addEventListener("hashchange", onLeave, { once: true });
  window.addEventListener("pagehide", onLeave, { once: true });

  function progress() {
    const right = run.results.filter(r => r.ok).length;
    $("[data-progress]").textContent = `${right} right of ${run.results.length}`;
  }

  /* Pick a weak cell; avoid repeating the last verb (table) or cell (single). */
  function pickCell() {
    let pool = cells;
    if (cfg.format === "table" && cfg.verbs.length > 1) pool = cells.filter(c => c.verb !== run.last);
    if (cfg.format === "single" && cells.length > 1) pool = cells.filter(c => `${c.verb.id}|${c.i}` !== run.last);
    const picked = weightedPick(pool.map(c => statFor(c.verb, c.i)));
    return pool.find(c => statFor(c.verb, c.i) === picked);
  }

  const promptHtml = verb => `
    <span lang="${code}">${esc(verb.inf)}</span> ${hearBtn()}
    <div class="muted" style="font-size:var(--fs-1);font-weight:400;">${esc(verb.en)}</div>`;

  const keysHtml = () => `<div class="char-keys">${lang.keys.map(k => `<button type="button" class="quiet" data-key="${k}">${k}</button>`).join("")}</div>`;

  /* The accent buttons type into whichever box was used last. */
  function wireKeys(getInput) {
    $("[data-answer]").querySelectorAll("[data-key]").forEach(b => b.addEventListener("click", () => {
      const input = getInput();
      if (!input || input.disabled) return;
      const { selectionStart: a, selectionEnd: z, value } = input;
      input.value = value.slice(0, a) + b.dataset.key + value.slice(z);
      input.setSelectionRange(a + 1, a + 1);
      input.focus();
    }));
  }

  function record(verb, i, answer, r) {
    run.results.push({ verb, i, answer, ok: r.ok, near: r.near });
    applyResult(keep(verb, i), r.ok);
  }

  function ask() {
    $("[data-feedback]").innerHTML = "";
    const { verb, i } = pickCell();
    $("[data-context]").textContent = verb.extra ? "Extra practice" : verb.from || "";
    if (cfg.format === "table") askTable(verb);
    else askSingle(verb, i);
    $("[data-prompt] [data-hear]")?.addEventListener("click", () => say(lang, verb.inf));
    progress();
  }

  /* --- whole table --- */

  function askTable(verb) {
    run.last = verb;
    $("[data-instruction]").textContent = `Write the ${data.tenseEn} of this verb.`;
    $("[data-prompt]").innerHTML = promptHtml(verb);
    $("[data-answer]").innerHTML = `
      <table class="verb-table">
        <tbody>
          ${PERSONS.map(i => `
            <tr data-row="${i}">
              <td class="pronoun" lang="${code}">${esc(verbPronoun(data.persons, verb, i))}</td>
              <td><input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" lang="${code}" data-cell="${i}" aria-label="${esc(data.persons[i])}"></td>
              <td data-fix></td>
            </tr>`).join("")}
        </tbody>
      </table>
      ${keysHtml()}
      <div class="vocab-actions">
        <button class="primary" data-check>Check</button>
      </div>`;
    const inputs = [...$("[data-answer]").querySelectorAll("[data-cell]")];
    let lastInput = inputs[0];
    inputs.forEach((inp, k) => {
      inp.addEventListener("focus", () => { lastInput = inp; });
      inp.addEventListener("keydown", e => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (inputs[k + 1]) inputs[k + 1].focus();
        else check();
      });
    });
    inputs[0].focus();
    wireKeys(() => lastInput);

    function check() {
      if (run.last !== verb || inputs[0].disabled) return;
      let tip = null;
      inputs.forEach((inp, i) => {
        const r = inp.value.trim() ? checkVerbForm(data.persons, verb, i, inp.value, code) : { ok: false };
        record(verb, i, inp.value.trim(), r);
        inp.disabled = true;
        const row = inp.closest("tr");
        row.classList.add(r.ok ? "is-correct" : r.near ? "is-partial" : "is-wrong");
        row.querySelector("[data-fix]").innerHTML = r.ok
          ? (canSpeak() ? `<button type="button" class="quiet hear" data-say="${esc(verbPhrase(data.persons, verb, i))}" aria-label="Hear it">🔊</button>` : "✓")
          : `<span class="fix" lang="${code}">${esc(verb.forms[i])}</span>`;
        if (!r.ok && r.tip && !tip) tip = r.tip;
      });
      $("[data-answer]").querySelectorAll("[data-key], [data-check]").forEach(b => { b.disabled = true; });
      saveStore();
      const right = run.results.slice(-6).filter(r => r.ok).length;
      $("[data-feedback]").innerHTML = `
        <div class="mark-note ${right === 6 ? "correct" : right >= 4 ? "partial" : "wrong"}">
          <strong>${right === 6 ? "All six right!" : `${right} of 6 right.`}</strong>
          ${tip ? `<p style="margin:var(--sp-1) 0 0;">${esc(tip)}</p>` : ""}
          ${verb.note ? `<p class="muted vocab-note" style="margin:var(--sp-1) 0 0;">💡 ${esc(verb.note)}</p>` : ""}
        </div>
        <div class="vocab-actions">
          <button class="primary" data-next>Next verb</button>
          ${canSpeak() ? `<button type="button" class="quiet" data-hear-all>Hear the table</button>` : ""}
        </div>`;
      $("[data-answer]").querySelectorAll("[data-say]").forEach(b => b.addEventListener("click", () => say(lang, b.dataset.say)));
      $("[data-hear-all]")?.addEventListener("click", () =>
        say(lang, PERSONS.map(i => verbPhrase(data.persons, verb, i)).join(". "), { slow: true }));
      $("[data-next]").addEventListener("click", ask);
      $("[data-next]").focus();
      progress();
    }
    $("[data-check]").addEventListener("click", check);
  }

  /* --- one at a time --- */

  function askSingle(verb, i) {
    run.last = `${verb.id}|${i}`;
    const pronoun = verbPronoun(data.persons, verb, i);
    $("[data-instruction]").textContent = `Write the right form of the verb.`;
    $("[data-prompt]").innerHTML = promptHtml(verb);
    $("[data-answer]").innerHTML = `
      <div class="answer-line vocab-input">
        <span class="input-lead" lang="${code}">${esc(pronoun)}</span>
        <input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" lang="${code}" aria-label="Your answer">
      </div>
      ${keysHtml()}
      <div class="vocab-actions">
        <button class="primary" data-check>Check</button>
        <button type="button" class="quiet" data-dontknow>I don't know</button>
      </div>`;
    const input = $("[data-answer] input");
    input.focus();
    wireKeys(() => input);

    const submit = answer => {
      if (run.last !== `${verb.id}|${i}` || input.disabled) return;
      const r = answer.trim() ? checkVerbForm(data.persons, verb, i, answer, code) : { ok: false };
      record(verb, i, answer.trim(), r);
      saveStore();
      input.disabled = true;
      $("[data-answer]").querySelectorAll("button").forEach(b => { b.disabled = true; });
      const phrase = verbPhrase(data.persons, verb, i);
      const cls = r.ok ? "correct" : r.near ? "partial" : "wrong";
      $("[data-feedback]").innerHTML = `
        <div class="mark-note ${cls}">
          <strong>${r.ok ? "Correct!" : r.near ? "Nearly!" : answer.trim() ? "Not quite." : "Here's the answer."}</strong>
          ${r.ok && !r.tip ? "" : `<p style="margin:var(--sp-1) 0 0;"><span lang="${code}" class="vocab-answer">${esc(phrase)}</span> ${hearBtn()}</p>`}
          ${r.tip ? `<p style="margin:var(--sp-1) 0 0;">${esc(r.tip)}</p>` : ""}
          <p class="muted" style="margin:var(--sp-1) 0 0;">= ${esc(verb.formsEn[i])}</p>
          ${!r.ok && verb.note ? `<p class="muted vocab-note" style="margin:var(--sp-1) 0 0;">💡 ${esc(verb.note)}</p>` : ""}
        </div>
        <div class="vocab-actions"><button class="primary" data-next>Next</button></div>`;
      $("[data-feedback] [data-hear]")?.addEventListener("click", () => say(lang, phrase));
      if (!r.ok) say(lang, phrase);
      const next = $("[data-next]");
      next.focus();
      next.addEventListener("click", ask);
      if (r.ok && !r.tip) setTimeout(() => { if (document.activeElement === next) ask(); }, 1100);
      progress();
    };
    $("[data-check]").addEventListener("click", () => input.value.trim() && submit(input.value));
    $("[data-dontknow]").addEventListener("click", () => submit(""));
    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && input.value.trim()) { e.preventDefault(); submit(input.value); }
    });
  }

  /* --- end --- */

  function commit() {
    if (run.committed || !run.results.length) return;
    run.committed = true;
    window.removeEventListener("hashchange", onLeave);
    window.removeEventListener("pagehide", onLeave);
    recordAttempt({
      mode: "verbs",
      paperId: `${code}:verbs-${cfg.format}`,
      seconds: Math.round((Date.now() - run.startedAt) / 1000),
      items: run.results.map(r => ({
        qid: `${r.verb.id}|${r.i}`, domain: "Verbs", subject: lang.subject,
        marks: 1, earned: r.ok ? 1 : 0, marking: "auto"
      }))
    });
  }

  function goHome() {
    commit();
    const home = `#/secondary/${code}/verbs`;
    if (location.hash === home) renderSetup(ctx);
    else location.hash = home;
  }

  $("[data-finish]").addEventListener("click", () => {
    commit();
    run.last = null;
    $(".vocab-card").classList.add("hidden");
    $("[data-finish]").classList.add("hidden");
    $("[data-progress]").classList.add("hidden");
    const right = run.results.filter(r => r.ok).length;
    const missed = [...new Map(run.results.filter(r => !r.ok).map(r => [`${r.verb.id}|${r.i}`, r])).values()];
    $("[data-summary]").innerHTML = `
      <div class="card">
        <p class="muted" style="margin:0;">This session</p>
        <div class="result-score">${right} / ${run.results.length}</div>
        ${missed.length ? `
          <p>Forms to keep working on:</p>
          <table class="word-list"><tbody>
            ${missed.map(r => `<tr><td lang="${code}">${esc(verbPhrase(data.persons, r.verb, r.i))}</td><td>${esc(r.verb.formsEn[r.i])}</td></tr>`).join("")}
          </tbody></table>` : run.results.length ? `<p>No mistakes this time — well done!</p>` : ""}
        <p style="margin-bottom:0;"><button class="primary" data-home>Back to the verbs</button></p>
      </div>`;
    $("[data-home]").addEventListener("click", goHome);
  });

  ask();
}
