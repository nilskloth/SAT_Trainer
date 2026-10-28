/* =========================================================
   Grown-ups → Activity (#/grown-ups/activity): how much the
   trainer is used, when, on what, and how well — from every
   device (records sent by core/activity.js to api/track.php,
   read back there with the upload password). All children's
   use counts as one learner for now.
   ========================================================= */

import { getStore, saveStore } from "../core/store.js";
import { esc } from "../core/utils.js";
import { AREAS, pendingCount } from "../core/activity.js";

const PERIODS = [7, 30, 90];
const AREA_ORDER = Object.keys(AREAS);            // fixed colour order: --viz-1 … , menus grey
const DAY_MS = 86400000;

let password = "";                                 // this visit only

const ERRORS = {
  bad_password: "That password isn't right.",
  no_password: "No upload password is set on the server yet — run php tools/set-upload-password.php, then deploy."
};

/* The report, from api/track.php; throws {code, message} like the proxy client. */
async function fetchReport(password, days, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("api/track.php", {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "report", password, days })
    });
    const body = await res.json().catch(() => ({ ok: false, error: { message: `The server answered HTTP ${res.status}` } }));
    if (!body.ok) throw Object.assign(new Error(body.error?.message || "Something went wrong."), { code: body.error?.code });
    return body.data;
  } finally {
    clearTimeout(timer);
  }
}
const errText = err => ERRORS[err.code] || err.message || "Something went wrong.";

/* 75 → "1 min", 3900 → "1 h 05 min" */
function fmt(secs) {
  const m = Math.round(secs / 60);
  if (secs > 0 && m === 0) return "<1 min";
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`;
}
const pct = (ok, n) => (n ? `${Math.round((100 * ok) / n)}%` : "—");
const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const startOfDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const dateLabel = (ts, opts) => new Date(ts).toLocaleDateString("en-GB", opts);
const timeLabel = ts => new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function renderActivity(el) {
  const store = getStore();
  const pending = pendingCount();
  el.innerHTML = `
    <div class="run-bar">
      <h2>Activity</h2>
      <a class="btn quiet" href="#/grown-ups">Back</a>
    </div>
    <div class="card" data-locked>
      <p style="margin-top:0;">How long and how often the trainer is used, on what, and how well — from every device that opens the site.</p>
      <p class="wl-row">
        <input type="password" data-password placeholder="Upload password" autocomplete="current-password" class="wl-input" style="width:min(280px,60vw);">
        <button class="primary" data-unlock>Show activity</button>
      </p>
      <p class="muted" data-status style="margin-bottom:0;"></p>
    </div>
    <div data-report></div>
    <p class="muted act-foot">This device: ${pending ? `${pending} record${pending === 1 ? "" : "s"} waiting to send` : "everything sent"}.
      Only timings, activity names and scores are sent — never what is typed.</p>`;

  const status = el.querySelector("[data-status]");
  const report = el.querySelector("[data-report]");
  const prefs = store.settings.activity || (store.settings.activity = { days: 30 });

  async function show(days) {
    status.textContent = "Loading…";
    try {
      const data = await fetchReport(password, days);
      el.querySelector("[data-locked]").classList.add("hidden");
      prefs.days = days;
      saveStore();
      drawReport(report, data, days, show, () => fetchReport(password, 400, 30000));
    } catch (err) {
      el.querySelector("[data-locked]").classList.remove("hidden");
      status.textContent = errText(err);
      if (err.code === "bad_password" || err.code === "locked") password = "";
    }
  }
  const unlock = () => {
    const pw = el.querySelector("[data-password]").value;
    if (!pw) return;
    password = pw;
    show(prefs.days || 30);
  };
  el.querySelector("[data-unlock]").addEventListener("click", unlock);
  el.querySelector("[data-password]").addEventListener("keydown", e => { if (e.key === "Enter") unlock(); });
  if (password) show(prefs.days || 30);
}

/* =========================
   Report
========================= */

/* Seconds from first to last activity, and on screen (older records have no "open"). */
const sessionLength = s => Math.max(s.active, Math.round((s.end - s.start) / 1000));
const openTime = s => Math.max(s.active, s.open || 0);

function summarise(data, days) {
  const today = startOfDay(data.now);
  const firstDay = today - (days - 1) * DAY_MS;
  const sessions = data.sessions.filter(s => s.end >= firstDay).sort((a, b) => a.start - b.start);
  const results = data.results.filter(r => r.ts >= firstDay).sort((a, b) => a.ts - b.ts);

  const dayList = Array.from({ length: days }, (_, i) => {
    const d = new Date(firstDay); d.setDate(d.getDate() + i); return d.getTime();
  });
  const byDay = new Map(dayList.map(d => [dayKey(d), { ts: d, total: 0, open: 0, areas: {} }]));
  const byActivity = {};                  // "area|label" → secs
  const tally = {};                       // area → [n, ok]
  const hours = [0, 0, 0, 0];             // before 9, 9–15, 15–18, after 18
  let active = 0;
  let open = 0;
  let length = 0;
  let longest = 0;

  for (const s of sessions) {
    const day = byDay.get(dayKey(s.start));
    const len = sessionLength(s);
    open += openTime(s);
    length += len;
    longest = Math.max(longest, len);
    if (day) day.open += openTime(s);
    for (const [key, secs] of Object.entries(s.parts || {})) {
      const area = key.split("|")[0];
      byActivity[key] = (byActivity[key] || 0) + secs;
      if (day) { day.total += secs; day.areas[area] = (day.areas[area] || 0) + secs; }
      active += secs;
    }
    for (const [area, [n, ok]] of Object.entries(s.tally || {})) {
      const t = tally[area] || (tally[area] = [0, 0]);
      t[0] += n; t[1] += ok;
    }
    const h = new Date(s.start).getHours();
    hours[h < 9 ? 0 : h < 15 ? 1 : h < 18 ? 2 : 3] += s.active;
  }

  const daysUsed = [...byDay.values()].filter(d => d.total >= 60);
  let streak = 0;
  for (let i = dayList.length - 1; i >= 0; i--) {
    const d = byDay.get(dayKey(dayList[i]));
    if (d.total >= 60) streak++;
    else if (i < dayList.length - 1) break;           // today not done yet doesn't break it
  }
  const answered = Object.values(tally).reduce((x, t) => x + t[0], 0);
  const right = Object.values(tally).reduce((x, t) => x + t[1], 0);
  return { sessions, results, days: [...byDay.values()], byActivity, tally, hours, active, open, length, longest,
    daysUsed, streak, answered, right };
}

function drawReport(box, data, days, reload, fetchAll) {
  const s = summarise(data, days);
  const devices = [...new Set(s.sessions.map(x => x.dev).filter(Boolean))];

  box.innerHTML = `
    <div class="act-period">
      <div class="seg" role="radiogroup" aria-label="Period">
        ${PERIODS.map(p => `<label class="seg-opt"><input type="radio" name="act-days" value="${p}"${p === days ? " checked" : ""}><span>${p} days</span></label>`).join("")}
      </div>
      <button type="button" class="quiet" data-refresh>Refresh</button>
      <span class="act-downloads">
        <button type="button" class="quiet" data-download="csv">Download sessions (CSV)</button>
        <button type="button" class="quiet" data-download="json">Download all (JSON)</button>
      </span>
    </div>
    <p class="muted act-foot hidden" data-download-status></p>

    <div class="act-tiles">
      ${tile("Learning time", fmt(s.active), s.open ? `${fmt(s.open)} on screen · ${pct(s.active, s.open)} of it active` : "")}
      ${tile("Sessions", String(s.sessions.length), s.sessions.length ? `average ${fmt(s.length / s.sessions.length)} long · longest ${fmt(s.longest)}` : "")}
      ${tile("Days used", `${s.daysUsed.length} of ${days}`, s.streak > 1 ? `${s.streak}-day streak` : s.streak === 1 ? "used today or yesterday" : "no current streak")}
      ${tile("Per day used", s.daysUsed.length ? fmt(s.active / s.daysUsed.length) : "—", s.daysUsed.length ? `learning · ${fmt(s.open / s.daysUsed.length)} on screen` : "")}
      ${tile("Answers", String(s.answered), s.answered ? `${pct(s.right, s.answered)} right` : "none yet")}
    </div>

    ${s.active ? `
    <div class="card act-card">
      <h3>Learning minutes each day</h3>
      ${dayChart(s.days, days)}
    </div>

    <div class="card act-card">
      <h3>What was practised</h3>
      ${activityTable(s)}
    </div>

    <div class="card act-card">
      <h3>When</h3>
      ${whenBars(s.hours)}
    </div>

    <div class="card act-card">
      <h3>Recent sessions</h3>
      ${sessionList(s)}
    </div>` : `
    <div class="card act-card"><p class="muted" style="margin:0;">Nothing recorded in the last ${days} days yet.</p></div>`}

    <p class="muted act-foot">${devices.length ? `Devices: ${esc(devices.join(", "))}. ` : ""}<strong>Learning</strong> counts only while the page is in use (touched, typed or scrolled in the last 1½ minutes). <strong>On screen</strong> is time the page was in front, up to 15 minutes without input. <strong>Length</strong> is the clock time from a session's first to last activity, short breaks included. A day counts as used from 1 minute of learning.</p>`;

  box.querySelectorAll('input[name="act-days"]').forEach(r => r.addEventListener("change", () => reload(Number(r.value))));
  box.querySelector("[data-refresh]").addEventListener("click", () => reload(days));
  box.querySelectorAll("[data-download]").forEach(b => b.addEventListener("click", async () => {
    const st = box.querySelector("[data-download-status]");
    st.classList.remove("hidden");
    st.textContent = "Preparing the download…";
    try {
      const all = await fetchAll();
      const stamp = new Date().toISOString().slice(0, 10);
      if (b.dataset.download === "csv") saveFile(`activity-sessions-${stamp}.csv`, sessionsCsv(all), "text/csv");
      else saveFile(`activity-all-${stamp}.json`, JSON.stringify(all, null, 2), "application/json");
      st.textContent = `Downloaded everything from the last ${all.days} days.`;
    } catch (err) {
      st.textContent = errText(err);
    }
  }));
  wireTooltips(box);
}

const tile = (label, value, sub) => `
  <div class="act-tile">
    <span class="muted">${esc(label)}</span>
    <strong>${esc(value)}</strong>
    <span class="muted">${esc(sub || "")}</span>
  </div>`;

const areaVar = a => (a === "menus" ? "var(--viz-other)" : `var(--viz-${AREA_ORDER.indexOf(a) + 1})`);

function legend(areas) {
  return `<div class="act-legend">${areas.map(a => `<span><i style="background:${areaVar(a)}"></i>${esc(AREAS[a] || a)}</span>`).join("")}</div>`;
}

/* Stacked bars, one per day, areas in fixed order bottom-up. */
function dayChart(dayRows, days) {
  const used = AREA_ORDER.filter(a => dayRows.some(d => d.areas[a]));
  const maxMin = Math.max(5, ...dayRows.map(d => d.total / 60));
  const top = maxMin <= 10 ? Math.ceil(maxMin) : Math.ceil(maxMin / 10) * 10;
  const labelEvery = days <= 7 ? 1 : days <= 30 ? 7 : 14;
  return `
    ${legend(used)}
    <div class="act-chart" style="--top:${top};">
      <span class="act-axis act-axis-top">${top} min</span>
      <span class="act-grid"></span>
      <div class="act-bars">
        ${dayRows.map((d, i) => `
          <div class="act-day" tabindex="0" data-tip="${esc(tipFor(d))}">
            <div class="act-stack" style="height:${(100 * d.total) / 60 / top}%;">
              ${used.filter(a => d.areas[a]).map(a => `<span style="flex:${d.areas[a]};background:${areaVar(a)}"></span>`).join("")}
            </div>
            <span class="act-x">${(dayRows.length - 1 - i) % labelEvery === 0 ? esc(dateLabel(d.ts, days <= 7 ? { weekday: "short" } : { day: "numeric", month: "short" })) : ""}</span>
          </div>`).join("")}
      </div>
      <div class="act-tip hidden" role="status"></div>
    </div>
    <details class="act-table-toggle">
      <summary>Show as a table</summary>
      <table class="word-list">
        <thead><tr><th>Day</th><th>On screen</th><th>Learning</th>${used.map(a => `<th>${esc(AREAS[a])}</th>`).join("")}</tr></thead>
        <tbody>${dayRows.filter(d => d.total).reverse().map(d => `
          <tr><td>${esc(dateLabel(d.ts, { weekday: "short", day: "numeric", month: "short" }))}</td><td>${fmt(d.open)}</td><td>${fmt(d.total)}</td>
            ${used.map(a => `<td>${d.areas[a] ? fmt(d.areas[a]) : ""}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </details>`;
}

function tipFor(d) {
  const head = dateLabel(d.ts, { weekday: "long", day: "numeric", month: "short" });
  if (!d.total) return `${head}\nNot used`;
  return [`${head} — ${fmt(d.total)} learning, ${fmt(d.open)} on screen`, ...AREA_ORDER.filter(a => d.areas[a]).map(a => `${AREAS[a]}: ${fmt(d.areas[a])}`)].join("\n");
}

function wireTooltips(box) {
  const chart = box.querySelector(".act-chart");
  if (!chart) return;
  const tip = chart.querySelector(".act-tip");
  const showTip = day => {
    tip.textContent = day.dataset.tip;
    tip.classList.remove("hidden");
    const c = chart.getBoundingClientRect();
    const r = day.getBoundingClientRect();
    const x = Math.min(Math.max(r.left - c.left + r.width / 2, 70), c.width - 70);
    tip.style.left = `${x}px`;
    day.classList.add("is-hover");
  };
  const hide = day => { tip.classList.add("hidden"); day.classList.remove("is-hover"); };
  chart.querySelectorAll(".act-day").forEach(day => {
    day.addEventListener("pointerenter", () => showTip(day));
    day.addEventListener("pointerleave", () => hide(day));
    day.addEventListener("focus", () => showTip(day));
    day.addEventListener("blur", () => hide(day));
  });
}

/* Time per area, then its activities; answers and accuracy per area. */
function activityTable(s) {
  const rows = AREA_ORDER.map(a => {
    const acts = Object.entries(s.byActivity).filter(([k]) => k.split("|")[0] === a)
      .map(([k, secs]) => [k.split("|")[1], secs]).sort((x, y) => y[1] - x[1]);
    const secs = acts.reduce((x, [, v]) => x + v, 0);
    return { a, acts, secs, t: s.tally[a] || [0, 0] };
  }).filter(r => r.secs || r.t[0]).sort((x, y) => y.secs - x.secs);
  return `
    <table class="word-list act-table">
      <thead><tr><th>Activity</th><th>Time</th><th>Share</th><th>Answers</th><th>Right</th></tr></thead>
      <tbody>
        ${rows.map(r => `
          <tr class="act-area">
            <td><i class="act-key" style="background:${areaVar(r.a)}"></i>${esc(AREAS[r.a])}</td>
            <td>${fmt(r.secs)}</td><td>${s.active ? Math.round((100 * r.secs) / s.active) : 0}%</td>
            <td>${r.t[0] || ""}</td><td>${r.a === "menus" ? "" : pct(r.t[1], r.t[0])}</td>
          </tr>
          ${r.acts.map(([label, secs]) => `
          <tr class="act-sub"><td>${esc(label)}</td><td>${fmt(secs)}</td><td></td><td></td><td></td></tr>`).join("")}`).join("")}
      </tbody>
    </table>
    ${testsList(s.results)}`;
}

/* Scored runs worth naming: papers, tests and verb rounds. */
function testsList(results) {
  const named = results.filter(r => r.marks && /paper|test/.test(r.mode)).slice(-12).reverse();
  if (!named.length) return "";
  return `
    <h4>Papers and tests</h4>
    <table class="word-list">
      <tbody>${named.map(r => `
        <tr><td>${esc(dateLabel(r.ts, { day: "numeric", month: "short" }))} ${esc(timeLabel(r.ts))}</td>
          <td>${esc(r.label)}</td><td><strong>${r.earned}/${r.marks}</strong> <span class="muted">${pct(r.earned, r.marks)}</span></td></tr>`).join("")}
      </tbody>
    </table>`;
}

function whenBars(hours) {
  const names = ["Before 9 am", "9 am – 3 pm", "3 – 6 pm", "After 6 pm"];
  const max = Math.max(...hours, 1);
  return `
    <div class="domain-bars act-when">
      ${hours.map((h, i) => `
        <div class="domain-bar">
          <span>${names[i]}</span>
          <span class="track"><span class="fill" style="width:${(100 * h) / max}%"></span></span>
          <span>${fmt(h)}</span>
        </div>`).join("")}
    </div>
    <p class="muted" style="margin-bottom:0;">By the time each session started.</p>`;
}

function sessionList(s) {
  const recent = s.sessions.slice(-15).reverse();
  /* each scored run belongs to the latest session that had started by then */
  const runsOf = new Map();
  s.results.filter(r => r.marks).forEach(r => {
    const owner = s.sessions.filter(x => x.start <= r.ts + 60000).pop();
    if (owner && r.ts <= owner.end + 15 * 60000) runsOf.set(owner, [...(runsOf.get(owner) || []), r]);
  });
  return `
    <table class="word-list act-sessions">
      <thead><tr><th>When</th><th>Length</th><th>On screen</th><th>Learning</th><th>What</th></tr></thead>
      <tbody>${recent.map(x => {
        const acts = Object.entries(x.parts || {}).sort((a, b) => b[1] - a[1])
          .map(([k, secs]) => `${esc(k.split("|")[1])} <span class="muted">${fmt(secs)}</span>`).join(" · ");
        const runs = (runsOf.get(x) || [])
          .map(r => `${esc(r.label)} <strong>${r.earned}/${r.marks}</strong>`).join(" · ");
        return `
        <tr>
          <td>${esc(dateLabel(x.start, { weekday: "short", day: "numeric", month: "short" }))}<br><span class="muted">${esc(timeLabel(x.start))}–${esc(timeLabel(x.end))}</span></td>
          <td>${fmt(sessionLength(x))}</td>
          <td>${fmt(openTime(x))}</td>
          <td><strong>${fmt(x.active)}</strong></td>
          <td>${acts}${runs ? `<br><span class="muted">Scores:</span> ${runs}` : ""}</td>
        </tr>`;
      }).join("")}</tbody>
    </table>`;
}

/* =========================
   Downloads
========================= */

function saveFile(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* One row per session, minutes rounded to 0.1; opens straight in Numbers/Excel. */
function sessionsCsv(data) {
  const cell = v => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const min = secs => (secs / 60).toFixed(1);
  const iso = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const results = [...data.results].sort((a, b) => a.ts - b.ts);
  const rows = [...data.sessions].sort((a, b) => a.start - b.start).map(x => {
    const tally = Object.values(x.tally || {});
    const scores = results.filter(r => r.marks && r.ts >= x.start - 60000 && r.ts <= x.end + 15 * 60000)
      .map(r => `${r.label} ${r.earned}/${r.marks}`).join("; ");
    return [iso(x.start), timeLabel(x.start), timeLabel(x.end), min(sessionLength(x)), min(openTime(x)), min(x.active),
      x.dev || "",
      Object.entries(x.parts || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.split("|")[1]} ${min(v)}`).join("; "),
      tally.reduce((n, t) => n + t[0], 0), tally.reduce((n, t) => n + t[1], 0), scores];
  });
  const head = ["date", "start", "end", "length_min", "on_screen_min", "learning_min", "device", "activities_min", "answers", "right", "scores"];
  return [head, ...rows].map(r => r.map(cell).join(",")).join("\n") + "\n";
}
