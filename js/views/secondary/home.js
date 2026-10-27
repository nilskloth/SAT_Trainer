/* =========================================================
   Secondary home + routing.
     #/secondary                       language cards
     #/secondary/<lang>                vocabulary trainer setup
     #/secondary/<lang>/list/<secId>   word list for one topic
     #/secondary/<lang>/verbs[/<id>]   verb tables: setup, or one table
   ========================================================= */

import { esc } from "../../core/utils.js";
import { LANGS, loadBank, isKnown } from "./langs.js";
import { renderVocab } from "./vocab.js";
import { renderVerbs } from "./verbs.js";

export function renderSecondary(el, params = []) {
  if (params[0] && LANGS[params[0]] && params[1] === "verbs") return renderVerbs(el, params[0], params.slice(2));
  if (params[0] && LANGS[params[0]]) return renderVocab(el, params[0], params.slice(1));
  renderHub(el);
}

async function renderHub(el) {
  el.innerHTML = `
    <div class="card" style="margin-bottom:var(--sp-4);">
      <h2 style="margin-top:0;">Languages</h2>
      <p class="muted" style="margin-bottom:0;">Learn the words and phrases from each chapter, then test yourself.</p>
    </div>
    <div class="subject-grid" data-cards></div>`;
  const grid = el.querySelector("[data-cards]");

  for (const lang of Object.values(LANGS)) {
    let bank = null;
    try { bank = await loadBank(lang.code); } catch { /* no lists yet */ }
    let detail = "Coming soon";
    if (bank) {
      const items = bank.chapters.flatMap(c => c.sections.flatMap(s => s.items));
      const known = items.filter(i => isKnown(lang.code, i.id)).length;
      detail = `${bank.chapters.length} chapter${bank.chapters.length === 1 ? "" : "s"} · ${known} of ${items.length} words known`;
    }
    const card = document.createElement(bank ? "a" : "div");
    card.className = `subject-card${bank ? "" : " disabled"}`;
    card.dataset.subject = lang.subject;
    if (bank) card.href = `#/secondary/${lang.code}`;
    card.innerHTML = `
      <div class="subject-card-band"></div>
      <div class="subject-card-body">
        <strong>${esc(lang.label)} vocabulary</strong>
        <span>${esc(detail)}</span>
      </div>`;
    grid.appendChild(card);
  }
}
