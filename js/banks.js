/* =========================
   Question Banks tab
========================= */
/* jshint esversion: 11 */

import { BANKS_OVERRIDE_KEY } from "./loader.js";

const BANK_KEYS = ["reading", "spag", "grammar", "reasoning"];

export function initBanks() {
  const summaryEl = document.getElementById("bankSummary");
  const importEl  = document.getElementById("bankImport");
  const importBtn = document.getElementById("importBanksBtn");
  const resetBtn  = document.getElementById("resetBanksBtn");
  const exportBtn = document.getElementById("exportBanksBtn");
  const exportOut = document.getElementById("exportOut");

  if (!summaryEl) return;

  renderSummary(summaryEl);

  if (importEl) {
    importEl.setAttribute("spellcheck", "false");
    if (!importEl.placeholder) {
      importEl.placeholder =
        'Paste bank JSON, e.g. { "reading": [ … ], "spag": [ … ] }';
    }
  }

  exportBtn?.addEventListener("click", () => {
    if (!exportOut) return;
    exportOut.textContent = JSON.stringify(currentBanks(), null, 2);
    exportOut.classList.remove("hidden");
  });

  importBtn?.addEventListener("click", () => {
    const raw = (importEl?.value || "").trim();
    if (!raw) { flash(summaryEl, "Nothing to import — paste JSON first.", false); return; }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      flash(summaryEl, "Invalid JSON: " + err.message, false);
      return;
    }

    const override = {};
    let count = 0;
    BANK_KEYS.forEach(key => {
      if (Array.isArray(parsed[key])) { override[key] = parsed[key]; count++; }
    });

    if (!count) {
      flash(summaryEl,
        "No recognised banks found. Expected arrays named: " + BANK_KEYS.join(", "),
        false);
      return;
    }

    localStorage.setItem(BANKS_OVERRIDE_KEY, JSON.stringify(override));
    BANK_KEYS.forEach(key => {
      if (Array.isArray(override[key])) window.DATA.banks[key] = override[key];
    });

    renderSummary(summaryEl);
    flash(summaryEl, `Imported ${count} bank${count > 1 ? "s" : ""}. Reload to use them in a Practice Run.`, true);
  });

  resetBtn?.addEventListener("click", () => {
    localStorage.removeItem(BANKS_OVERRIDE_KEY);
    if (window.DATA_BANKS_ORIGINAL) {
      window.DATA.banks = JSON.parse(JSON.stringify(window.DATA_BANKS_ORIGINAL));
    }
    if (exportOut) { exportOut.classList.add("hidden"); exportOut.textContent = ""; }
    renderSummary(summaryEl);
    flash(summaryEl, "Banks reset to the built-in content.", true);
  });
}

function currentBanks() {
  const banks = (window.DATA && window.DATA.banks) || {};
  const out = {};
  BANK_KEYS.forEach(key => { out[key] = banks[key] || []; });
  return out;
}

function renderSummary(el) {
  const banks = currentBanks();
  const overridden = !!localStorage.getItem(BANKS_OVERRIDE_KEY);
  const parts = BANK_KEYS.map(key =>
    `<span class="pill">${key}: ${banks[key].length}</span>`
  );
  el.innerHTML =
    parts.join(" ") +
    (overridden ? ' <span class="pill" style="background:#fde68a;">custom override active</span>' : "");
}

function flash(anchorEl, message, ok) {
  let note = document.getElementById("bankFlash");
  if (!note) {
    note = document.createElement("div");
    note.id = "bankFlash";
    note.style.marginTop = "8px";
    note.style.fontSize = "13px";
    anchorEl.parentNode.insertBefore(note, anchorEl.nextSibling);
  }
  note.textContent = message;
  note.style.color = ok ? "#15803d" : "#b00020";
}
