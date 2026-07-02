/* =========================
   App bootstrap (ES module)
========================= */
/* jshint esversion: 11 */

import { initStore, getStore, getSettings, saveStore } from "./store.js";
import { loadAllData } from "./loader.js";
import { initTabs } from "./tabs.js";

import { initPapers } from "./runner/papers.js";
import { initRunner } from "./runner/runner.js";
import { initArithmetic } from "./training/arithmetic.js";
import { initSpelling } from "./training/spelling.js";
import { initGrammar } from "./training/grammar.js";
import { initPrefixes } from "./training/prefixes.js";
import { initAlgebra } from "./training/algebra.js";
import { initReasoning } from "./training/reasoning.js";
import { initDivision } from "./training/division.js";
import { initReading, checkReadingAnswers, refreshReadingGrid } from "./training/reading.js";
import { initWarmup } from "./training/warmup.js";
import { initStats } from "./stats/stats.js";
import { initBanks } from "./banks.js";

(async function initApp() {
  try {
    /* =========================
       Load external JSON data
    ========================= */

    const data = await loadAllData();
    window.DATA = data;

    /* =========================
       Initialise core systems
    ========================= */

    initStore();
    initTabs();

    /* =========================
       Initialise feature modules
    ========================= */

    initPapers();
    initRunner();
    initArithmetic();
    initSpelling();
    initGrammar();
    initPrefixes();
    initAlgebra();
    initReasoning();
    initDivision();
    initReading();
    initWarmup();

    /* =========================
       Training sub-tabs (Maths / Spelling / Grammar)
    ========================= */

    const trainingTabButtons = document.querySelectorAll(".training-tabs button[data-training]");
    const trainingPanels = document.querySelectorAll(".training-panel");

    if (trainingTabButtons.length && trainingPanels.length) {

      const activateTraining = function (target) {
        trainingTabButtons.forEach(b => {
          b.classList.toggle("active", b.dataset.training === target);
        });

        trainingPanels.forEach(panel => {
          panel.classList.toggle(
            "hidden",
            panel.id !== `training-${target}`
          );
        });

        if (target === "reading") refreshReadingGrid();
      };

      trainingTabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
          activateTraining(btn.dataset.training);
        });
      });

      // Ensure default state is Maths
      activateTraining("maths");
    }
    
    document.getElementById("readingCheckBtn")
      ?.addEventListener("click", checkReadingAnswers);

    // ✅ FIX: pass required dependencies explicitly
    initStats(
      getStore(),
      DATA.spelling,
      DATA.papers
    );

    initSettings();
    initBanks();

    console.log("KS2 SATs Practice Runner ready");

  } catch (err) {
    console.error("Failed to initialise app:", err);
    handleInitError(err);
  }
})();

/* =========================
   Settings wiring
========================= */

function initSettings() {
  const settings = getSettings();
  const defaultTimingEl = document.getElementById("defaultTiming");
  const timingSelectEl = document.getElementById("timingSelect");

  if (!defaultTimingEl) return;

  // Reflect the stored default into both the Settings control and the
  // Practice-Run timing select on load.
  defaultTimingEl.value = settings.defaultTiming || "untimed";
  if (timingSelectEl) timingSelectEl.value = defaultTimingEl.value;

  defaultTimingEl.addEventListener("change", () => {
    settings.defaultTiming = defaultTimingEl.value;
    saveStore();
    if (timingSelectEl) timingSelectEl.value = defaultTimingEl.value;
  });
}

function handleInitError(err) {

    document.body.innerHTML = `
      <div style="
        max-width: 600px;
        margin: 60px auto;
        padding: 20px;
        font-family: system-ui, sans-serif;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 12px;
      ">
        <h2>Something went wrong</h2>
        <p>The SATs Practice Runner could not start.</p>
        <pre style="white-space:pre-wrap; font-size:12px; color:#b00020;">
${err.message}
        </pre>
        <p style="font-size:12px; color:#666;">
          Tip: if you are running this locally, make sure you are using a local web server
          (e.g. <code>python3 -m http.server</code>) and not opening the file directly.
        </p>
      </div>
    `;
}