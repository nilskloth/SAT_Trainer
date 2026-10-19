/* Start screen: choose Primary (KS2 SATs) or Secondary (languages). Remembered in settings.level. */

import { getStore, setLevel } from "../core/store.js";

const LEVELS = [
  {
    id: "primary", href: "#/home", label: "Primary",
    sub: "Year 6 SATs — reading, grammar, spelling and maths",
    subject: "maths"
  },
  {
    id: "secondary", href: "#/secondary", label: "Secondary",
    sub: "Languages — German vocabulary (French coming next)",
    subject: "german"
  }
];

export function renderStart(el) {
  const current = getStore().settings.level;
  el.innerHTML = `
    <div class="start">
      <h2>Which school are you practising for?</h2>
      <p class="muted">You can switch at any time from the top of the page.</p>
      <div class="level-grid">
        ${LEVELS.map(l => `
          <a class="level-card${l.id === current ? " current" : ""}" href="${l.href}" data-level="${l.id}" data-subject="${l.subject}">
            <span class="level-card-band"></span>
            <span class="level-card-body">
              <strong>${l.label}</strong>
              <span>${l.sub}</span>
            </span>
          </a>`).join("")}
      </div>
    </div>`;

  el.querySelectorAll("[data-level]").forEach(a => {
    a.addEventListener("click", () => setLevel(a.dataset.level));
  });
}
