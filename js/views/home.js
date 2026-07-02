/* Child home: subject entry points. "Today's practice" assembler arrives in Phase 6. */

import { getData } from "../core/loader.js";
import { getStore } from "../core/store.js";
import { esc } from "../core/utils.js";

export function renderHome(el) {
  const { papers } = getData();
  const attempts = getStore().attempts.filter(a => !a.legacy);
  const recent = attempts.filter(a => Date.now() - a.ts < 7 * 24 * 3600 * 1000).length;

  const cards = papers.map(p => `
    <a class="subject-card" href="#/papers/${p.id}" data-subject="${p.subject}">
      <div class="subject-card-band"></div>
      <div class="subject-card-body">
        <strong>${esc(p.label)}</strong>
        <span>${p.minutes} minutes · ${p.totalMarks} marks</span>
      </div>
    </a>`).join("");

  el.innerHTML = `
    <div class="card" style="margin-bottom:var(--sp-4);">
      <h2 style="margin-top:0;">Hello!</h2>
      <p class="muted">
        ${recent > 0
          ? `You've practised ${recent} time${recent === 1 ? "" : "s"} this week.`
          : "Ready to start? Today's practice takes about 10–15 minutes."}
      </p>
      <p style="margin-bottom:0;">
        <a class="btn primary" href="#/practice/today">Start today's practice</a>
        <a class="btn" href="#/practice">Practise one topic</a>
      </p>
    </div>
    <h3 style="margin:var(--sp-5) 0 var(--sp-3);">Full practice papers</h3>
    <div class="subject-grid">${cards}</div>
  `;
}
