/* =========================================================
   Self-marking fallback for AI-marked questions.
   Renders the mark scheme as a checklist (like a real
   marker's "acceptable points"); the child ticks the
   points their answer makes and marks follow the award
   rules. Used whenever the proxy is unavailable — and in
   Phase 2, before the proxy exists at all.
   ========================================================= */

import { esc } from "../core/utils.js";
import { marksFromSelfTicks } from "../core/marking.js";

/* Renders the checklist into the question's result area.
   Calls onMarked({earned, possible}) when the child confirms. */
export function renderSelfMark(q, el, onMarked) {
  const box = el.querySelector(".paper-q-result");
  const ms = q.markScheme || {};
  const points = ms.acceptablePoints || [];

  const pointsHtml = points.length
    ? points.map((pt, i) => `
        <label><input type="checkbox" data-point="${i}">
          <span>${esc(pt.point)}${pt.evidence?.length ? ` <span class="muted">(e.g. ${esc(pt.evidence[0])})</span>` : ""}</span>
        </label>`).join("")
    : `<label><input type="checkbox" data-point="0"><span>My answer matches the model answer</span></label>`;

  const award = ms.award
    ? `<p class="muted" style="margin:var(--sp-2) 0 0;">${Object.entries(ms.award)
        .map(([m, rule]) => `<strong>${m} mark${m > 1 ? "s" : ""}:</strong> ${esc(rule)}`).join(" · ")}</p>`
    : "";

  box.innerHTML = `
    <div class="selfmark">
      <h4>Mark it yourself</h4>
      <p class="muted" style="margin:0 0 var(--sp-2);">Tick each point your answer makes:</p>
      ${pointsHtml}
      ${ms.modelAnswer ? `<p class="muted" style="margin:var(--sp-2) 0 0;"><strong>Model answer:</strong> ${ms.modelAnswer}</p>` : ""}
      ${award}
      <button class="primary" style="margin-top:var(--sp-3);" data-confirm>Award my marks</button>
    </div>`;

  box.querySelector("[data-confirm]").addEventListener("click", () => {
    const ticked = box.querySelectorAll("input:checked").length;
    const earned = marksFromSelfTicks(q, ticked);
    onMarked({ earned, possible: q.marks });
  });
}
