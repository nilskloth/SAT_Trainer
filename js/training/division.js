/* training/division.js */
/* jshint esversion: 11 */

/* =========================
   Helpers
========================= */

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

const INT_PLACE_LABELS = [
  'ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands'
];
const DEC_PLACE_LABELS = [
  'tenths', 'hundredths', 'thousandths', 'ten-thousandths',
  'hundred-thousandths', 'millionths', 'ten-millionths', 'hundred-millionths'
];

function intPlaceLabel(pos, numIntegerDigits) {
  return INT_PLACE_LABELS[numIntegerDigits - 1 - pos] || `position ${numIntegerDigits - pos}`;
}

function decPlaceLabel(d) {
  return DEC_PLACE_LABELS[d - 1] || `decimal place ${d}`;
}

/* =========================
   Calculation
========================= */

function calcSteps(dividend, divisor) {
  const MAX_DECIMAL = 8;
  const dividendStr  = String(dividend);
  const numIntegerDigits = dividendStr.length;
  const digits = dividendStr.split('').map(Number);

  const steps = [];
  let remainder = 0;

  for (let i = 0; i < numIntegerDigits; i++) {
    const workingNumber = remainder * 10 + digits[i];
    const digit        = Math.floor(workingNumber / divisor);
    const newRemainder = workingNumber % divisor;
    steps.push({
      stepIndex: i, isDecimal: false, decimalPlace: null,
      workingNumber, prevRemainder: remainder,
      digit, remainder: newRemainder, caption: ''
    });
    remainder = newRemainder;
  }

  if (remainder === 0) {
    return { steps, numIntegerDigits, isRecurring: false };
  }

  const seenRemainders = new Set();
  let isRecurring = false;

  for (let d = 1; d <= MAX_DECIMAL; d++) {
    const workingNumber = remainder * 10;
    const digit        = Math.floor(workingNumber / divisor);
    const newRemainder = workingNumber % divisor;

    steps.push({
      stepIndex: numIntegerDigits + d - 1,
      isDecimal: true, decimalPlace: d,
      workingNumber, prevRemainder: remainder,
      digit, remainder: newRemainder, caption: ''
    });

    remainder = newRemainder;

    if (newRemainder === 0) break;

    if (seenRemainders.has(newRemainder)) { isRecurring = true; break; }
    seenRemainders.add(newRemainder);

    if (d === MAX_DECIMAL) isRecurring = true;
  }

  return { steps, numIntegerDigits, isRecurring };
}

/* =========================
   Captions
========================= */

function makeCaption(step, numIntegerDigits, divisor) {
  const { stepIndex, isDecimal, decimalPlace, workingNumber, prevRemainder, digit, remainder } = step;
  const parts = [];

  if (!isDecimal) {
    const place = intPlaceLabel(stepIndex, numIntegerDigits);
    if (prevRemainder > 0) {
      parts.push(`Carry the ${prevRemainder} into the ${place} column, giving ${workingNumber}.`);
    } else {
      parts.push(`Start in the ${place} column: ${workingNumber}.`);
    }
  } else if (decimalPlace === 1) {
    parts.push(`There is a remainder of ${prevRemainder}. Add a decimal point and carry ${prevRemainder} into the tenths column, giving ${workingNumber}.`);
  } else {
    parts.push(`Carry the ${prevRemainder} into the ${decPlaceLabel(decimalPlace)} column, giving ${workingNumber}.`);
  }

  if (digit === 0) {
    parts.push(`How many ${divisor}s in ${workingNumber}? None — ${workingNumber} is less than ${divisor}. Write 0.`);
    if (remainder > 0) parts.push(`Carry the ${remainder}.`);
  } else if (digit === 1) {
    parts.push(`How many ${divisor}s in ${workingNumber}? One — 1 × ${divisor} = ${divisor}. Write 1.`);
    if (remainder > 0) parts.push(`Remainder: ${remainder}.`);
    else parts.push('Remainder: 0 — done!');
  } else {
    parts.push(`How many ${divisor}s in ${workingNumber}? ${digit} — ${digit} × ${divisor} = ${digit * divisor}. Write ${digit}.`);
    if (remainder > 0) parts.push(`Remainder: ${remainder}.`);
    else parts.push('Remainder: 0 — done!');
  }

  return parts.join(' ');
}

/* =========================
   Rendering
========================= */

function buildBusStop(dividend, divisor, steps, numIntegerDigits) {
  const decSteps  = steps.filter(s => s.isDecimal);
  const numDec    = decSteps.length;
  const hasDecimal = numDec > 0;
  const dDigits   = String(dividend).split('');

  let qCells = '';
  for (let i = 0; i < numIntegerDigits; i++) {
    qCells += `<span class="bs-cell" id="bsd-q-${i}"></span>`;
  }
  if (hasDecimal) {
    qCells += `<span class="bs-dot bs-dot--q">.</span>`;
    for (let i = 0; i < numDec; i++) {
      qCells += `<span class="bs-cell" id="bsd-q-${numIntegerDigits + i}"></span>`;
    }
  }

  let dCells = '';
  for (let i = 0; i < numIntegerDigits; i++) {
    const cls = i === 0 ? 'bs-cell bs-cell--first' : 'bs-cell';
    dCells += `<span class="${cls}" id="bsd-d-${i}">` +
      `<span class="bs-carry hidden" id="bsd-carry-${i}"></span>${dDigits[i]}</span>`;
  }
  if (hasDecimal) {
    dCells += `<span class="bs-dot bs-dot--d">.</span>`;
    for (let i = 0; i < numDec; i++) {
      const si = numIntegerDigits + i;
      dCells += `<span class="bs-cell" id="bsd-d-${si}">` +
        `<span class="bs-carry hidden" id="bsd-carry-${si}"></span>0</span>`;
    }
  }

  return `<div class="bs-layout" role="img" aria-label="${dividend} ÷ ${divisor} — bus stop division">` +
    `<div class="bs-divisor">${divisor}</div>` +
    `<div class="bs-rows">` +
    `<div class="bs-row-q">${qCells}</div>` +
    `<div class="bs-row-d">${dCells}</div>` +
    `</div></div>`;
}

function updateBusStop(steps, currentStep) {
  steps.forEach((step, i) => {
    const qEl     = document.getElementById(`bsd-q-${i}`);
    const carryEl = document.getElementById(`bsd-carry-${i}`);

    if (i < currentStep) {
      if (qEl) { qEl.textContent = step.digit; qEl.className = 'bs-cell bs-done'; }
      if (carryEl) {
        if (step.prevRemainder > 0) {
          carryEl.textContent = step.prevRemainder;
          carryEl.className = 'bs-carry bs-done';
        } else {
          carryEl.className = 'bs-carry hidden';
        }
      }
    } else if (i === currentStep) {
      if (qEl) { qEl.textContent = step.digit; qEl.className = 'bs-cell bs-active'; }
      if (carryEl) {
        if (step.prevRemainder > 0) {
          carryEl.textContent = step.prevRemainder;
          carryEl.className = 'bs-carry bs-active';
        } else {
          carryEl.className = 'bs-carry hidden';
        }
      }
    } else {
      if (qEl) { qEl.textContent = ''; qEl.className = 'bs-cell'; }
      if (carryEl) { carryEl.textContent = ''; carryEl.className = 'bs-carry hidden'; }
    }
  });
}

/* =========================
   Init
========================= */

export function initDivision() {
  const panel = document.getElementById('maths-sub-division');
  if (!panel) return;

  let calc        = null;
  let currentStep = -1;

  const dividendInput = document.getElementById('divDividend');
  const divisorInput  = document.getElementById('divDivisor');
  const calcBtn       = document.getElementById('divCalcBtn');
  const walkthroughEl = document.getElementById('divWalkthrough');
  const busStopWrap   = document.getElementById('divBusStop');
  const captionEl     = document.getElementById('divCaption');
  const prevBtn       = document.getElementById('divPrevBtn');
  const nextBtn       = document.getElementById('divNextBtn');
  const counterEl     = document.getElementById('divStepCounter');
  const senseCheckEl  = document.getElementById('divSenseCheck');
  const validationEl  = document.getElementById('divValidation');

  calcBtn?.addEventListener('click', runCalc);

  prevBtn?.addEventListener('click', () => {
    if (currentStep >= 0) { currentStep--; refresh(); }
  });

  nextBtn?.addEventListener('click', () => {
    if (calc && currentStep < calc.steps.length - 1) { currentStep++; refresh(); }
  });

  function runCalc() {
    const dividend = parseInt(dividendInput?.value, 10);
    const divisor  = parseInt(divisorInput?.value, 10);

    if (!Number.isInteger(dividend) || dividend < 1 || dividend > 9999) {
      return showErr('Dividend must be a positive whole number up to 9,999.');
    }
    if (!Number.isInteger(divisor) || divisor < 1 || divisor > 999) {
      return showErr('Divisor must be a positive whole number up to 999.');
    }
    clearErr();

    const result = calcSteps(dividend, divisor);
    result.steps.forEach(s => {
      s.caption = makeCaption(s, result.numIntegerDigits, divisor);
    });

    calc = { ...result, dividend, divisor };
    currentStep = -1;

    if (busStopWrap) {
      busStopWrap.innerHTML = buildBusStop(dividend, divisor, calc.steps, calc.numIntegerDigits);
    }
    walkthroughEl?.classList.remove('hidden');
    senseCheckEl?.classList.add('hidden');
    refresh();
  }

  function refresh() {
    if (!calc) return;
    const { steps, isRecurring, dividend, divisor } = calc;
    const max = steps.length - 1;

    updateBusStop(steps, currentStep);

    if (captionEl) {
      captionEl.textContent = currentStep < 0
        ? "Press ‘Next’ to start stepping through."
        : steps[currentStep].caption;
    }

    if (prevBtn) prevBtn.disabled = currentStep < 0;
    if (nextBtn) nextBtn.disabled = currentStep >= max;
    if (counterEl) {
      counterEl.textContent = currentStep < 0
        ? `0 / ${steps.length}`
        : `${currentStep + 1} / ${steps.length}`;
    }

    if (currentStep === max) showSenseCheck(dividend, divisor, steps, isRecurring);
    else senseCheckEl?.classList.add('hidden');
  }

  function showSenseCheck(dividend, divisor, steps, isRecurring) {
    if (!senseCheckEl) return;

    const intDigits  = steps.filter(s => !s.isDecimal).map(s => s.digit).join('');
    const decDigits  = steps.filter(s =>  s.isDecimal).map(s => s.digit).join('');
    const intDisplay = String(parseInt(intDigits, 10));
    const decimalAns = decDigits ? `${intDisplay}.${decDigits}` : intDisplay;

    const g       = gcd(dividend, divisor);
    const fracNum = dividend / g;
    const fracDen = divisor  / g;
    const fracStr = fracDen === 1 ? `${fracNum}` : `${fracNum}/${fracDen}`;
    const rounded = (dividend / divisor).toFixed(2);

    const decEl   = document.getElementById('divAnsDecimal');
    const fracEl  = document.getElementById('divAnsFraction');
    const roundEl = document.getElementById('divAnsRounded');
    const recurEl = document.getElementById('divRecurringNote');

    if (decEl)   decEl.textContent   = isRecurring ? `${decimalAns}… (recurring)` : decimalAns;
    if (fracEl)  fracEl.textContent  = fracStr;
    if (roundEl) roundEl.textContent = rounded;
    if (recurEl) recurEl.classList.toggle('hidden', !isRecurring);

    senseCheckEl.classList.remove('hidden');
  }

  function showErr(msg) {
    if (validationEl) { validationEl.textContent = msg; validationEl.classList.remove('hidden'); }
  }

  function clearErr() {
    validationEl?.classList.add('hidden');
  }
}
