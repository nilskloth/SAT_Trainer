/* =========================================================
   Vocabulary trainer for one secondary language, built on
   the primary spelling trainer's adaptive engine.

   Setup  → pick chapters/topics, direction, answer style, mode
   Run    → Practise: adaptive, feedback after every word
            Test:     fixed set, no feedback until the end,
                      then a review where answers can be
                      overruled ("I was right")
   Directions: to-en (target → English), to-target
   (English → target), listen (hear it, write it), listen-en
   (hear it, write the English), listen-target (hear the English,
   write the target).
   Entries with an opener (item.context, e.g. "Ich habe …" before
   "einen iPod") are always shown inside it, and typing the piece or
   the whole sentence both count.
   Stats per item+direction in store.vocab[lang].stats; a
   finished run is also recorded as an attempt so Grown-ups
   sees it under the language, by chapter.
   ========================================================= */

import { saveStore, recordAttempt } from "../../core/store.js";
import { esc, pickN, shuffle } from "../../core/utils.js";
import { newStat, weightedPick, applyResult } from "../../core/adaptive.js";
import { checkAnswer, speakable, listenable, fillGap, articleSlip } from "../../core/vocab-match.js";
import { canSpeak, speak } from "../../core/speech.js";
import { LANGS, loadBank, vocabState, isKnown } from "./langs.js";

const TEST_LENGTHS = [10, 20, 30];

/* Which way round each direction goes. */
const answersInEnglish = dir => dir === "to-en" || dir === "listen-en";
const isHeard = dir => dir === "listen" || dir === "listen-en" || dir === "listen-target";
/* The language a heard direction reads aloud. */
const heardInEnglish = dir => dir === "listen-target";

/* =========================
   Entry
========================= */

export async function renderVocab(el, code, params = []) {
  const lang = LANGS[code];
  el.dataset.subject = lang.subject;
  el.innerHTML = `<div class="card"><p class="muted">Loading ${esc(lang.label)} words…</p></div>`;
  let bank;
  try {
    bank = await loadBank(code);
  } catch (err) {
    el.innerHTML = `<div class="card"><p>The ${esc(lang.label)} word lists couldn't load. Check your connection and refresh.</p>
      <p class="muted">${esc(err.message)}</p></div>`;
    return;
  }
  const ctx = { el, lang, bank, code };
  if (params[0] === "list" && params[1]) return renderList(ctx, params[1]);
  renderSetup(ctx);
}

function allSections(bank) {
  return bank.chapters.flatMap(c => c.sections.map(s => ({ ...s, chapter: c })));
}

function sectionById(bank, id) {
  return allSections(bank).find(s => s.id === id);
}

function speakTarget(lang, text, opts) {
  speak(speakable(text), lang.voice, opts);
}

/* "Ich habe …" → "Ich habe", for the start of an answer line. */
const openerLead = text => fillGap(text, "");

const hearBtn = (label = "🔊") =>
  canSpeak() ? `<button type="button" class="quiet hear" data-hear aria-label="Hear it">${label}</button>` : "";

/* The chapter's learning strategy (from the sheet's "Strategie" box). */
function strategyHtml(lang, code, strategy, open = false) {
  if (!strategy) return "";
  return `
    <details class="strategy"${open ? " open" : ""}>
      <summary>💡 <strong>${esc(lang.strategyWord)} ${strategy.number}</strong> · ${esc(strategy.title)}</summary>
      ${strategy.parts.map(p => `
        <div class="strategy-part">
          ${p.heading ? `<h4>${esc(p.heading)}</h4>` : ""}
          ${p.text ? `<p>${esc(p.text)}</p>` : ""}
          ${p.steps ? `<ol>${p.steps.map(t => `<li>${esc(t)}</li>`).join("")}</ol>` : ""}
          ${p.words ? `<p class="strategy-words">${p.words.map(w => canSpeak()
            ? `<button type="button" class="chip" lang="${code}" data-say="${esc(w)}">${esc(w)} 🔊</button>`
            : `<span class="chip" lang="${code}">${esc(w)}</span>`).join("")}</p>` : ""}
        </div>`).join("")}
    </details>`;
}

/* =========================
   Word list (study a topic)
========================= */

function renderList({ el, lang, bank, code }, sectionId) {
  const sec = sectionById(bank, sectionId);
  if (!sec) { location.hash = `#/secondary/${code}`; return; }

  el.innerHTML = `
    <div class="run-bar">
      <h2>${esc(sec.title)} <span class="muted" style="font-weight:400;">· ${esc(sec.en)}</span></h2>
      <a class="btn quiet" href="#/secondary/${code}">Back</a>
    </div>
    <div class="paper-sheet" data-subject="${lang.subject}">
      <p class="muted" style="margin-top:0;">${esc(lang.chapterWord)} ${sec.chapter.number} · ${esc(sec.chapter.title)}${canSpeak() ? " · tap 🔊 to hear each one" : ""}</p>
      <table class="word-list">
        <thead><tr><th>${esc(lang.label)}</th><th>English</th><th></th><th></th></tr></thead>
        <tbody>
          ${sec.items.map(it => `
            <tr>
              <td lang="${code}">${it.context ? `<span class="vocab-opener">${esc(it.context[code])}</span> ` : ""}${esc(it[code])}</td>
              <td>${it.context ? `<span class="vocab-opener">${esc(it.context.en)}</span> ` : ""}${esc(it.en)}</td>
              <td>${canSpeak() ? `<button type="button" class="quiet hear" data-say="${esc(it.context ? fillGap(it.context[code], it[code]) : it[code])}" aria-label="Hear ${esc(it[code])}">🔊</button>` : ""}</td>
              <td class="known">${isKnown(code, it.id) ? "✓" : ""}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
    ${strategyHtml(lang, code, sec.chapter.strategy)}`;

  el.querySelectorAll("[data-say]").forEach(b =>
    b.addEventListener("click", () => speakTarget(lang, b.dataset.say)));
}

/* =========================
   Setup
========================= */

function renderSetup(ctx) {
  const { el, lang, bank, code } = ctx;
  const state = vocabState(code);
  const prefs = state.prefs;
  const sections = allSections(bank);
  const valid = new Set(sections.map(s => s.id));
  let selected = new Set((prefs.sections || []).filter(id => valid.has(id)));
  if (!selected.size) bank.chapters[0].sections.forEach(s => selected.add(s.id));

  const knownIn = sec => sec.items.filter(i => isKnown(code, i.id)).length;

  el.innerHTML = `<div data-setup>
    <div class="run-bar"><h2>${esc(lang.label)} vocabulary</h2></div>

    <div class="card setup-card">
      <h3>1. Choose your words</h3>
      <div class="chapter-list">
        ${bank.chapters.map(ch => `
          <div class="chapter">
            <label class="chapter-head">
              <input type="checkbox" data-chapter="${ch.id}">
              <span><strong>${esc(lang.chapterWord)} ${ch.number}</strong> · <span lang="${code}">${esc(ch.title)}</span></span>
              <span class="muted chapter-known" data-chapter-known="${ch.id}"></span>
            </label>
            <details class="chapter-topics"${ch.sections.some(s => selected.has(s.id)) ? " open" : ""}>
              <summary>${ch.sections.length} topics</summary>
              <div class="section-grid">
              ${ch.sections.map(s => `
                <div class="section-row">
                  <label class="section-pick">
                    <input type="checkbox" data-section="${s.id}" ${selected.has(s.id) ? "checked" : ""}>
                    <span>
                      <span lang="${code}">${esc(s.title)}</span>
                      <span class="muted"> · ${esc(s.en)}</span>
                    </span>
                  </label>
                  <span class="muted section-meta">${knownIn(s)}/${s.items.length} known</span>
                  <a class="section-look" href="#/secondary/${code}/list/${s.id}">Look at the words</a>
                </div>`).join("")}
              </div>
            </details>
            ${strategyHtml(lang, code, ch.strategy)}
          </div>`).join("")}
      </div>
      <p style="margin-bottom:0;">
        <button type="button" class="quiet" data-all>Select everything</button>
        <button type="button" class="quiet" data-none>Clear</button>
      </p>
    </div>

    <div class="card setup-card">
      <h3>2. How do you want to practise?</h3>
      <div class="seg-group">
        <span class="seg-label">Read it</span>
        <div class="seg" role="radiogroup">
          ${seg("dir", "to-en", `${lang.label} → English`, prefs.dir)}
          ${seg("dir", "to-target", `English → ${lang.label}`, prefs.dir)}
        </div>
      </div>
      ${canSpeak() ? `
      <div class="seg-group">
        <span class="seg-label">Hear it</span>
        <div class="seg" role="radiogroup">
          ${seg("dir", "listen-en", `${lang.label} → write English`, prefs.dir)}
          ${seg("dir", "listen-target", `English → write ${lang.label}`, prefs.dir)}
          ${seg("dir", "listen", `${lang.label} → write ${lang.label}`, prefs.dir)}
        </div>
      </div>` : ""}
      <div class="seg-group">
        <span class="seg-label">Answer</span>
        <div class="seg" role="radiogroup">
          ${seg("style", "type", "Type it", prefs.style)}
          ${seg("style", "choose", "Pick from 4", prefs.style)}
        </div>
      </div>
      <div class="seg-group">
        <span class="seg-label">Mode</span>
        <div class="seg" role="radiogroup">
          ${seg("mode", "practise", "Practise", prefs.mode)}
          ${TEST_LENGTHS.map(n => seg("mode", `test-${n}`, `Test · ${n}`, prefs.mode)).join("")}
        </div>
      </div>
      <p class="muted" data-explain style="margin:var(--sp-3) 0 0;"></p>
    </div>

    <div class="start-bar">
      <button class="primary" data-start>Start</button>
      <span class="muted" data-count></span>
    </div>
  </div>`;

  /* defaults for first visit */
  ["dir:to-en", "style:type", "mode:practise"].forEach(d => {
    const [name, value] = d.split(":");
    if (!el.querySelector(`input[name="${name}"]:checked`)) {
      const inp = el.querySelector(`input[name="${name}"][value="${value}"]`);
      if (inp) inp.checked = true;
    }
  });

  const val = name => el.querySelector(`input[name="${name}"]:checked`)?.value;

  function refresh() {
    bank.chapters.forEach(ch => {
      const box = el.querySelector(`[data-chapter="${ch.id}"]`);
      const n = ch.sections.filter(s => selected.has(s.id)).length;
      box.checked = n === ch.sections.length;
      box.indeterminate = n > 0 && n < ch.sections.length;
      const items = ch.sections.flatMap(s => s.items);
      el.querySelector(`[data-chapter-known="${ch.id}"]`).textContent =
        `${items.filter(i => isKnown(code, i.id)).length}/${items.length} known`;
    });

    const pool = buildPool(bank, selected, val("dir"), code);
    const mode = val("mode");
    const n = mode.startsWith("test") ? Math.min(Number(mode.split("-")[1]), pool.length) : null;
    el.querySelector("[data-count]").textContent = pool.length
      ? `${pool.length} word${pool.length === 1 ? "" : "s"} selected${n ? ` · test of ${n}` : ""}`
      : "Choose at least one topic";
    el.querySelector("[data-start]").disabled = !pool.length;

    const dirText = {
      "to-en": `You'll see the ${lang.label} and write the English.`,
      "to-target": `You'll see the English and write the ${lang.label} — capitals and ${code === "de" ? "umlauts" : "accents"} count.`,
      listen: `You'll hear the ${lang.label} and write it down. Phrases with gaps (…) or choices (/) are left out.`,
      "listen-en": `You'll hear the ${lang.label} and write what it means in English. Phrases with gaps (…) or choices (/) are left out.`,
      "listen-target": `You'll hear the English and write it in ${lang.label} — capitals and ${code === "de" ? "umlauts" : "accents"} count. Phrases with gaps (…) or choices (/) are left out.`
    }[val("dir")];
    const modeText = mode === "practise"
      ? "Practise: you see the answer after each word, and words you find hard come back more often."
      : "Test: no help until the end — then you see your score and every answer.";
    el.querySelector("[data-explain]").textContent = `${dirText} ${modeText}`;

    Object.assign(prefs, { sections: [...selected], dir: val("dir"), style: val("style"), mode });
    saveStore();
  }

  el.querySelector("[data-setup]").addEventListener("change", e => {
    const t = e.target;
    if (t.dataset.section) {
      t.checked ? selected.add(t.dataset.section) : selected.delete(t.dataset.section);
    } else if (t.dataset.chapter) {
      const ch = bank.chapters.find(c => c.id === t.dataset.chapter);
      ch.sections.forEach(s => {
        t.checked ? selected.add(s.id) : selected.delete(s.id);
        el.querySelector(`[data-section="${s.id}"]`).checked = t.checked;
      });
      if (t.checked) t.closest(".chapter").querySelector("details").open = true;
    }
    refresh();
  });

  el.querySelector("[data-setup]").addEventListener("click", e => {
    const b = e.target.closest("[data-say]");
    if (b) speakTarget(lang, b.dataset.say);
  });

  el.querySelector("[data-all]").addEventListener("click", () => {
    sections.forEach(s => selected.add(s.id));
    el.querySelectorAll("[data-section]").forEach(b => { b.checked = true; });
    refresh();
  });
  el.querySelector("[data-none]").addEventListener("click", () => {
    selected = new Set();
    el.querySelectorAll("[data-section]").forEach(b => { b.checked = false; });
    refresh();
  });

  el.querySelector("[data-start]").addEventListener("click", () => {
    const mode = val("mode");
    const pool = buildPool(bank, selected, val("dir"), code);
    if (!pool.length) return;
    startRun(ctx, {
      pool,
      dir: val("dir"),
      style: val("style"),
      test: mode.startsWith("test") ? Math.min(Number(mode.split("-")[1]), pool.length) : 0
    });
  });

  refresh();
}

function seg(name, value, label, current) {
  return `<label class="seg-opt"><input type="radio" name="${name}" value="${value}"${current === value ? " checked" : ""}><span>${esc(label)}</span></label>`;
}

function buildPool(bank, selected, dir, code) {
  return allSections(bank)
    .filter(s => selected.has(s.id))
    .flatMap(s => s.items.map(it => ({ ...it, section: s })))
    .filter(it => !isHeard(dir) || listenable(heardInEnglish(dir) ? it.en : it[code]));
}

/* =========================
   Running
========================= */

function startRun(ctx, cfg) {
  const { el, lang, code } = ctx;
  /* Unseen words get a fresh stat in memory; it's only stored once answered. */
  const stats = vocabState(code).stats;
  const fresh = new Map();
  const statFor = it => {
    const key = `${it.id}|${cfg.dir}`;
    if (stats[key]) return stats[key];
    if (!fresh.has(key)) fresh.set(key, newStat(key));
    return fresh.get(key);
  };
  const keep = it => {
    const s = statFor(it);
    stats[s.key] = s;
    return s;
  };

  const run = {
    results: [],          // { item, answer, ok, near, tip, marking }
    queue: cfg.test ? pickN(cfg.pool, cfg.test) : null,
    current: null,
    lastId: null,
    committed: false,
    startedAt: Date.now()
  };

  const dirLabel = {
    "to-en": `${lang.label} → English`, "to-target": `English → ${lang.label}`,
    listen: `Hear ${lang.label} → write ${lang.label}`, "listen-en": `Hear ${lang.label} → write English`,
    "listen-target": `Hear English → write ${lang.label}`
  }[cfg.dir];
  const toEn = answersInEnglish(cfg.dir);

  el.innerHTML = `
    <div class="run-bar">
      <h2>${cfg.test ? "Test" : "Practise"} <span class="muted" style="font-weight:400;">· ${esc(dirLabel)}</span></h2>
      <span class="timer-pill" data-progress></span>
      <button type="button" class="quiet" data-finish>${cfg.test ? "Stop test" : "Finish"}</button>
    </div>
    <div class="paper-sheet vocab-card" data-subject="${lang.subject}">
      <p class="vocab-instruction muted" data-instruction></p>
      <div class="vocab-prompt" data-prompt></div>
      <p class="vocab-context muted" data-context></p>
      <div data-answer></div>
      <div class="vocab-feedback" data-feedback aria-live="polite"></div>
    </div>
    <div data-summary></div>
  `;

  const $ = s => el.querySelector(s);

  /* Leaving mid-run still saves what was answered. */
  const onLeave = () => commit();
  window.addEventListener("hashchange", onLeave, { once: true });
  window.addEventListener("pagehide", onLeave, { once: true });

  function progress() {
    const right = run.results.filter(r => r.ok).length;
    $("[data-progress]").textContent = cfg.test
      ? `${Math.min(run.results.length + 1, cfg.test)} / ${cfg.test}`
      : `${right} right of ${run.results.length}`;
  }

  function nextItem() {
    if (cfg.test) return run.queue[run.results.length] || null;
    let candidates = cfg.pool;
    if (candidates.length > 1) candidates = candidates.filter(it => it.id !== run.lastId);
    const picked = weightedPick(candidates.map(statFor));
    return candidates.find(it => statFor(it) === picked);
  }

  function ask() {
    const item = nextItem();
    if (!item) return showTestReview();
    run.current = item;
    run.lastId = item.id;
    progress();

    const target = item[code];
    const promptText = toEn ? target : item.en;
    const expected = toEn ? item.en : target;
    const answerLang = toEn ? "en" : code;
    const opener = item.context || null;
    const promptOpener = opener ? (toEn ? opener[code] : opener.en) : "";
    const answerOpener = opener ? (answerLang === "en" ? opener.en : opener[code]) : "";
    const spoken = opener ? fillGap(opener[code], target) : target;
    const spokenEn = opener ? fillGap(opener.en, item.en) : item.en;
    item._q = { promptText, expected, answerLang, promptOpener, answerOpener, spoken };
    /* what the 🔊 prompt plays */
    const playPrompt = opts => heardInEnglish(cfg.dir)
      ? speak(speakable(spokenEn), "en-GB", opts)
      : speakTarget(lang, spoken, opts);

    $("[data-instruction]").textContent = {
      "to-en": "What does this mean in English?",
      "to-target": `How do you say this in ${lang.label}?`,
      listen: `Listen and write the ${lang.label}.`,
      "listen-en": "Listen — what does it mean in English?",
      "listen-target": `Listen — how do you say it in ${lang.label}?`
    }[cfg.dir];

    if (isHeard(cfg.dir)) {
      $("[data-prompt]").innerHTML = `
        <button type="button" class="listen-big" data-hear aria-label="Play again">🔊</button>
        <button type="button" class="quiet" data-slow>Slower</button>`;
      $("[data-slow]").addEventListener("click", () => playPrompt({ slow: true }));
      setTimeout(() => playPrompt(), 250);
    } else {
      $("[data-prompt]").innerHTML = `
        <span ${cfg.dir === "to-en" ? `lang="${code}"` : ""}>${promptOpener ? `<span class="vocab-opener">${esc(promptOpener)}</span> ` : ""}<span data-prompt-text>${esc(promptText)}</span></span>
        ${cfg.dir === "to-en" ? hearBtn() : ""}`;
    }
    $("[data-prompt] [data-hear]")?.addEventListener("click", () => playPrompt());

    $("[data-context]").textContent = `${lang.chapterWord} ${item.section.chapter.number} · ${item.section.en}`;
    $("[data-feedback]").innerHTML = "";

    if (cfg.style === "choose") renderChoices(item);
    else renderTyping(item);
  }

  /* --- typed answers --- */

  function renderTyping(item) {
    const typingTarget = item._q.answerLang !== "en";
    $("[data-answer]").innerHTML = `
      <div class="answer-line vocab-input">
        ${item._q.answerOpener ? `<span class="input-lead" ${typingTarget ? `lang="${code}"` : ""}>${esc(openerLead(item._q.answerOpener))}</span>` : ""}
        <input type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
          ${typingTarget ? `lang="${code}"` : ""} aria-label="Your answer">
      </div>
      ${typingTarget ? `<div class="char-keys">${lang.keys.map(k => `<button type="button" class="quiet" data-key="${k}">${k}</button>`).join("")}</div>` : ""}
      <div class="vocab-actions">
        <button class="primary" data-check>Check</button>
        ${cfg.test ? "" : `<button type="button" class="quiet" data-dontknow>I don't know</button>`}
      </div>`;
    const input = $("[data-answer] input");
    input.focus();

    $("[data-answer]").querySelectorAll("[data-key]").forEach(b => b.addEventListener("click", () => {
      const { selectionStart: a, selectionEnd: z, value } = input;
      input.value = value.slice(0, a) + b.dataset.key + value.slice(z);
      input.setSelectionRange(a + 1, a + 1);
      input.focus();
    }));

    const submit = answer => {
      if (run.current !== item) return;
      const r = judge(item, answer);
      input.disabled = true;
      $("[data-answer]").querySelectorAll("button").forEach(b => { b.disabled = true; });
      answered(item, answer, r);
    };
    $("[data-check]").addEventListener("click", () => input.value.trim() && submit(input.value));
    $("[data-dontknow]")?.addEventListener("click", () => submit(""));
    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && input.value.trim()) { e.preventDefault(); submit(input.value); }
    });
  }

  /* Accept another listed item with the same prompt ("Hello!" → Hallo! or Guten Tag!). */
  function judge(item, answer) {
    const { expected, answerLang, promptText, answerOpener } = item._q;
    let r = checkAnswer(expected, answer, { lang: answerLang, prompt: promptText });
    if (!r.ok && answerOpener) {
      const whole = checkAnswer(fillGap(answerOpener, expected), answer, { lang: answerLang, prompt: promptText });
      if (whole.ok || (whole.near && !r.near)) r = whole;
    }
    if (!r.ok && !r.near && answerLang !== "en") {
      const needed = articleSlip(expected, answer, answerLang);
      if (needed) {
        const after = answerOpener ? ` after “${openerLead(answerOpener)}”` : "";
        r = { ok: false, near: "article", tip: `Check the article — it's “${needed}” here${after}.` };
      }
    }
    if (r.ok || cfg.dir !== "to-target") return r;
    const twins = cfg.pool.filter(o => o.id !== item.id && sameText(o.en, item.en));
    for (const t of twins) {
      const r2 = checkAnswer(t[code], answer, { lang: code, prompt: promptText });
      if (r2.ok) return { ...r2, tip: `That's right too — the sheet also lists “${item[code]}”.` };
    }
    return r;
  }

  /* --- multiple choice --- */

  function renderChoices(item) {
    const field = item._q.answerLang === "en" ? "en" : code;
    const options = shuffle([item, ...distractors(item, field)]);
    $("[data-answer]").innerHTML = `
      <div class="choice-grid">
        ${options.map((o, i) => `
          <button type="button" class="choice-btn" data-opt="${i}" ${field !== "en" ? `lang="${code}"` : ""}>${esc(o[field])}</button>`).join("")}
      </div>`;
    $("[data-answer]").querySelectorAll("[data-opt]").forEach(b => b.addEventListener("click", () => {
      if (run.current !== item) return;
      const picked = options[Number(b.dataset.opt)];
      const ok = picked === item || sameText(picked[field], item[field]);
      $("[data-answer]").querySelectorAll("[data-opt]").forEach(x => {
        x.disabled = true;
        if (!cfg.test) {
          const o = options[Number(x.dataset.opt)];
          if (o === item) x.classList.add("is-correct");
          else if (x === b) x.classList.add("is-wrong");
        } else if (x === b) x.classList.add("picked");
      });
      answered(item, picked[field], { ok });
    }));
  }

  function distractors(item, field) {
    const avoid = o => o.id === item.id || sameText(o[field], item[field]) || sameText(o.en, item.en);
    const fromSection = item.section.items.filter(o => !avoid(o));
    const fromChapter = item.section.chapter.sections.flatMap(s => s.items).filter(o => !avoid(o));
    const fromAll = ctx.bank.chapters.flatMap(c => c.sections.flatMap(s => s.items)).filter(o => !avoid(o));
    const out = [];
    for (const src of [fromSection, fromChapter, fromAll]) {
      for (const o of shuffle(src)) {
        if (out.length >= 3) break;
        if (!out.some(x => sameText(x[field], o[field]))) out.push(o);
      }
    }
    return out;
  }

  /* --- after an answer --- */

  function answered(item, answer, r) {
    const result = { item, answer, ok: r.ok, near: r.near, tip: r.tip, marking: "auto" };
    run.results.push(result);
    progress();
    if (cfg.test) {
      setTimeout(ask, cfg.style === "choose" ? 350 : 0);
      return;
    }
    applyResult(keep(item), r.ok);
    saveStore();
    showFeedback(result);
  }

  function showFeedback(result) {
    const { item } = result;
    const target = item[code];
    const { spoken } = item._q;
    const wholeDe = item.context ? fillGap(item.context[code], target) : target;
    const wholeEn = item.context ? fillGap(item.context.en, item.en) : item.en;
    const shown = toEn ? wholeEn : wholeDe;
    const cls = result.ok ? "correct" : result.near ? "partial" : "wrong";
    const head = result.ok ? "Correct!" : result.near ? "Nearly!" : result.answer ? "Not quite." : "Here's the answer.";
    $("[data-feedback]").innerHTML = `
      <div class="mark-note ${cls}">
        <strong>${head}</strong>
        ${result.ok && !result.tip ? "" : `<p style="margin:var(--sp-1) 0 0;"><span ${toEn ? "" : `lang="${code}"`} class="vocab-answer">${esc(shown)}</span>
          ${toEn ? "" : hearBtn()}</p>`}
        ${result.tip ? `<p style="margin:var(--sp-1) 0 0;">${esc(result.tip)}</p>` : ""}
        ${toEn ? `<p class="muted" style="margin:var(--sp-1) 0 0;"><span lang="${code}">${esc(wholeDe)}</span> = ${esc(wholeEn)} ${cfg.dir === "listen-en" ? hearBtn() : ""}</p>`
          : item.context || heardInEnglish(cfg.dir) ? `<p class="muted" style="margin:var(--sp-1) 0 0;">= ${esc(wholeEn)}</p>` : ""}
      </div>
      <div class="vocab-actions">
        <button class="primary" data-next>Next</button>
        ${!result.ok && result.answer && cfg.style === "type" ? `<button type="button" class="quiet" data-overrule>I was right</button>` : ""}
      </div>`;

    $("[data-feedback] [data-hear]")?.addEventListener("click", () => speakTarget(lang, spoken));
    if (cfg.dir !== "to-en" && !result.ok) speakTarget(lang, spoken);

    const next = $("[data-next]");
    next.focus();
    next.addEventListener("click", ask);
    $("[data-overrule]")?.addEventListener("click", () => {
      overrule(result);
      showFeedback(result);
    });
    if (result.ok && !result.tip) setTimeout(() => { if (run.current === item && document.activeElement === next) ask(); }, 1100);
  }

  /* Count a typed answer as right. In practise mode the stat was
     already updated as wrong: undo that by re-applying as right. */
  function overrule(result) {
    result.ok = true;
    result.near = null;
    result.tip = null;
    result.marking = "self";
    if (!cfg.test) {
      const s = keep(result.item);
      s.wrong = Math.max(0, s.wrong - 1);
      s.wrongStreak = 0;
      s.attempts = Math.max(0, s.attempts - 1);
      applyResult(s, true);
      saveStore();
    }
    progress();
  }

  /* --- end of a test: review, then save --- */

  function showTestReview() {
    run.current = null;
    $(".vocab-card").classList.add("hidden");
    $("[data-finish]").classList.add("hidden");
    $("[data-progress]").classList.add("hidden");

    const draw = () => {
      const right = run.results.filter(r => r.ok).length;
      $("[data-summary]").innerHTML = `
        <div class="card">
          <p class="muted" style="margin:0;">Your score</p>
          <div class="result-score">${right} / ${run.results.length}</div>
          <p class="muted">${verdict(right, run.results.length)}</p>
          <table class="word-list review">
            <thead><tr><th></th><th>Question</th><th>Your answer</th><th>Answer</th><th></th></tr></thead>
            <tbody>
              ${run.results.map((r, i) => `
                <tr class="${r.ok ? "is-correct" : r.near ? "is-partial" : "is-wrong"}">
                  <td class="mark">${r.ok ? "✓" : r.near ? "~" : "✗"}</td>
                  <td ${toEn ? `lang="${code}"` : ""}>${cfg.dir === "listen" ? "🔊" : `${isHeard(cfg.dir) ? "🔊 " : ""}${r.item._q.promptOpener ? `<span class="vocab-opener">${esc(r.item._q.promptOpener)}</span> ` : ""}${esc(r.item._q.promptText)}`}</td>
                  <td>${r.answer ? esc(r.answer) : `<span class="muted">—</span>`}${r.tip && !r.ok ? `<br><span class="muted">${esc(r.tip)}</span>` : ""}</td>
                  <td ${r.item._q.answerLang !== "en" ? `lang="${code}"` : ""}>${r.item._q.answerOpener ? `<span class="vocab-opener">${esc(openerLead(r.item._q.answerOpener))}</span> ` : ""}${esc(r.item._q.expected)}</td>
                  <td>${!r.ok && r.answer && cfg.style === "type" ? `<button type="button" class="quiet" data-overrule="${i}">I was right</button>` : ""}</td>
                </tr>`).join("")}
            </tbody>
          </table>
          <p style="margin-bottom:0;">
            <button class="primary" data-again>Practise the ones I missed</button>
            <button type="button" data-home>Done</button>
          </p>
        </div>`;

      $("[data-summary]").querySelectorAll("[data-overrule]").forEach(b => b.addEventListener("click", () => {
        overrule(run.results[Number(b.dataset.overrule)]);
        draw();
      }));
      $("[data-home]").addEventListener("click", goHome);
      const missed = run.results.filter(r => !r.ok).map(r => r.item);
      const again = $("[data-again]");
      if (!missed.length) again.classList.add("hidden");
      again.addEventListener("click", () => {
        commit();
        startRun(ctx, { ...cfg, pool: missed, test: 0 });
      });
    };
    draw();
  }

  function verdict(right, total) {
    const p = total ? right / total : 0;
    if (p === 1) return "Every one right — brilliant!";
    if (p >= 0.8) return "Really strong. Look at the ones you missed, then try again.";
    if (p >= 0.5) return "Good effort. Practise the missed words and test yourself again.";
    return "These need more practice — try Practise mode, then test again.";
  }

  /* Save the run once: test stats are applied here (after any
     overrules); every run becomes an attempt for Grown-ups. */
  function commit() {
    if (run.committed || !run.results.length) return;
    run.committed = true;
    window.removeEventListener("hashchange", onLeave);
    window.removeEventListener("pagehide", onLeave);
    if (cfg.test) run.results.forEach(r => applyResult(keep(r.item), r.ok));
    recordAttempt({
      mode: cfg.test ? "vocab-test" : "vocab-practise",
      paperId: `${code}:${cfg.dir}`,
      seconds: Math.round((Date.now() - run.startedAt) / 1000),
      items: run.results.map(r => ({
        qid: r.item.id,
        domain: `${lang.chapterWord} ${r.item.section.chapter.number}`,
        subject: lang.subject,
        marks: 1,
        earned: r.ok ? 1 : 0,
        marking: r.marking
      }))
    });
  }

  /* The run lives on the setup's own address, so a link there would do
     nothing — save, then redraw the setup in place. */
  function goHome() {
    commit();
    const home = `#/secondary/${code}`;
    if (location.hash === home) renderSetup(ctx);
    else location.hash = home;
  }

  $("[data-finish]").addEventListener("click", () => {
    if (cfg.test) {
      /* stopping early: review what was answered so far */
      run.queue = run.queue.slice(0, run.results.length);
      if (!run.results.length) { goHome(); return; }
      showTestReview();
      return;
    }
    commit();
    showPractiseSummary();
  });

  function showPractiseSummary() {
    run.current = null;
    $(".vocab-card").classList.add("hidden");
    $("[data-finish]").classList.add("hidden");
    $("[data-progress]").classList.add("hidden");
    const right = run.results.filter(r => r.ok).length;
    const missed = [...new Map(run.results.filter(r => !r.ok).map(r => [r.item.id, r.item])).values()];
    $("[data-summary]").innerHTML = `
      <div class="card">
        <p class="muted" style="margin:0;">This session</p>
        <div class="result-score">${right} / ${run.results.length}</div>
        ${missed.length ? `
          <p>Words to keep working on:</p>
          <table class="word-list"><tbody>
            ${missed.map(it => `<tr><td lang="${code}">${esc(it[code])}</td><td>${esc(it.en)}</td></tr>`).join("")}
          </tbody></table>` : `<p>No mistakes this time — well done!</p>`}
        <p style="margin-bottom:0;"><button class="primary" data-home>Back to the word lists</button></p>
      </div>`;
    $("[data-home]").addEventListener("click", goHome);
  }

  ask();
}

function sameText(a, b) {
  const n = s => String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  return n(a) === n(b);
}
