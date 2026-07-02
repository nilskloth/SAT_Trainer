/* =========================================================
   Short division (bus stop) walkthrough — step engine
   ported from v1 training/division.js, compact v2 UI.
   Route: #/practice/division
   ========================================================= */

import { randInt } from "../core/utils.js";

function calcSteps(dividend, divisor) {
  const digits = String(dividend).split("").map(Number);
  const steps = [];
  let remainder = 0;
  digits.forEach((d, i) => {
    const working = remainder * 10 + d;
    steps.push({
      working,
      prevRemainder: remainder,
      digit: Math.floor(working / divisor),
      remainder: working % divisor,
      index: i
    });
    remainder = working % divisor;
  });
  return { steps, remainder };
}

function makeProblem(level) {
  const divisor = level === "easy" ? randInt(2, 6) : randInt(3, 12);
  const quotient = level === "easy" ? randInt(11, 99) : randInt(101, 999);
  const rem = level === "hard" ? randInt(0, divisor - 1) : 0;
  return { dividend: quotient * divisor + rem, divisor };
}

export function renderDivision(el) {
  el.dataset.subject = "maths";
  el.innerHTML = `
    <div class="run-bar"><h2>Short division</h2><a class="btn quiet" href="#/practice">Back</a></div>
    <div class="card" style="margin-bottom:var(--sp-4);display:flex;gap:var(--sp-3);align-items:center;flex-wrap:wrap;">
      <label>Level: <select data-level style="font:inherit;">
        <option value="easy">Easier (2-digit ÷ 1-digit, no remainder)</option>
        <option value="mid">Year 6 (3-digit ÷ up to 12)</option>
        <option value="hard">Challenge (with remainders)</option>
      </select></label>
      <button class="primary" data-new>New question</button>
    </div>
    <div class="paper-sheet" data-subject="maths" style="font-family:var(--font-mono);font-size:var(--fs-3);">
      <div data-busstop style="text-align:center;padding:var(--sp-5);"></div>
      <p data-caption class="muted" style="font-family:var(--font-ui);font-size:var(--fs-1);text-align:center;min-height:3em;"></p>
      <div style="display:flex;gap:var(--sp-3);justify-content:center;">
        <button class="primary" data-step>Show next step</button>
      </div>
    </div>
  `;

  let state = null;

  function draw() {
    const { dividend, divisor, steps, shown, remainder } = state;
    const digits = String(dividend).split("");
    const quotientRow = digits.map((_, i) =>
      i < shown ? String(steps[i].digit) : "&nbsp;").join(" ");
    const carryRow = digits.map((d, i) => {
      const carry = i < shown ? steps[i].prevRemainder : (i < shown + 1 ? steps[i]?.prevRemainder : 0);
      return (i <= shown - 1 || i === shown) && steps[i] && steps[i].prevRemainder > 0
        ? `<sup style="color:var(--c-maths);">${steps[i].prevRemainder}</sup>${d}`
        : d;
    }).join(" ");

    el.querySelector("[data-busstop]").innerHTML = `
      <div style="display:inline-block;text-align:left;">
        <div style="padding-left:2.2em;letter-spacing:0.4em;">${quotientRow}${shown === steps.length && remainder > 0 ? ` <span style="font-size:0.7em;">r ${remainder}</span>` : ""}</div>
        <div style="border-top:3px solid var(--ink);">
          <span style="padding-right:0.6em;border-right:3px solid var(--ink);">${divisor}</span>
          <span style="padding-left:0.6em;letter-spacing:0.4em;">${carryRow}</span>
        </div>
      </div>`;

    const cap = el.querySelector("[data-caption]");
    const btn = el.querySelector("[data-step]");
    if (shown === 0) {
      cap.textContent = `We share ${dividend} between ${divisor}, one digit at a time, starting from the left.`;
      btn.disabled = false;
      btn.textContent = "Show next step";
    } else if (shown < steps.length) {
      const s = steps[shown - 1];
      cap.textContent = `${s.working} ÷ ${divisor} = ${s.digit}` +
        (s.remainder > 0 ? `, remainder ${s.remainder} — carry it to the next digit.` : `, no remainder.`);
    } else {
      const s = steps[steps.length - 1];
      cap.textContent = `${s.working} ÷ ${divisor} = ${s.digit}${remainder > 0 ? `, remainder ${remainder}` : ""}. ` +
        `So ${dividend} ÷ ${divisor} = ${steps.map(x => x.digit).join("").replace(/^0+(?=\d)/, "")}${remainder > 0 ? ` r ${remainder}` : ""}.`;
      btn.disabled = true;
      btn.textContent = "Done!";
    }
  }

  function fresh() {
    const { dividend, divisor } = makeProblem(el.querySelector("[data-level]").value);
    const { steps, remainder } = calcSteps(dividend, divisor);
    state = { dividend, divisor, steps, remainder, shown: 0 };
    draw();
  }

  el.querySelector("[data-new]").addEventListener("click", fresh);
  el.querySelector("[data-level]").addEventListener("change", fresh);
  el.querySelector("[data-step]").addEventListener("click", () => {
    if (state.shown < state.steps.length) state.shown++;
    draw();
  });

  fresh();
}
