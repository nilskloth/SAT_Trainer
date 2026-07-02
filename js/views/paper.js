/* Full mock paper runner (timed, paper-style rendering). Built in Phase 2. */

export function renderPapers(el) {
  el.innerHTML = `
    <div class="card">
      <h2 style="margin-top:0;">Practice papers</h2>
      <p class="muted">Full timed SATs papers — coming in Phase 2.</p>
    </div>
  `;
}
