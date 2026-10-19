/* =========================================================
   Grown-ups view: per-domain mastery, run-up to the SATs,
   AI usage/spend, settings (proxy token), data management.
   ========================================================= */

import { getStore, saveStore, resetStore } from "../core/store.js";
import { loadContent } from "../core/loader.js";
import { ping, usage } from "../core/ai.js";
import { generateReadingTest } from "../gen/generate.js";
import { esc } from "../core/utils.js";
import { domainLabel } from "./paper.js";
import { renderWordLists } from "./wordlists.js";

const SUBJECT_LABELS = { reading: "Reading", gps: "Grammar & punctuation", maths: "Maths", spelling: "Spelling",
  german: "German vocabulary", french: "French vocabulary" };

/* Sonnet 5 pricing (per MTok): in $3 / out $15 — rough spend estimate. */
function estimateSpend(log) {
  let inTok = 0;
  let outTok = 0;
  log.forEach(r => { inTok += r.in_tokens || 0; outTok += r.out_tokens || 0; });
  return { inTok, outTok, usd: (inTok * 3 + outTok * 15) / 1e6 };
}

/* Failed sign-ins on the server (wrong shared key / upload password). */
function securityHtml(sec, uploads) {
  if (!sec) return "";
  const kind = k => (k === "upload-password" ? "wrong upload password" : "wrong shared key");
  const alerts = uploads?.alerts ? "You're emailed about these (at most once an hour)." : "Email alerts are off — set alert_email in api/config.php.";
  if (!sec.fails?.length) return `<p class="muted">No failed sign-in attempts. ${alerts}</p>`;
  return `
    <div class="mark-note ${sec.locked ? "wrong" : "partial"}" style="margin-top:var(--sp-3);">
      <strong>${sec.total} failed sign-in attempt${sec.total === 1 ? "" : "s"}</strong>${sec.locked ? " — uploading is locked for now" : ""}.
      <span class="muted">${alerts}</span>
      <ul style="margin:var(--sp-2) 0 0;padding-left:1.2em;">
        ${sec.fails.map(f => `<li>${esc(new Date(f.ts).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }))} — ${kind(f.kind)} from ${esc(f.ip)}</li>`).join("")}
      </ul>
    </div>`;
}

export function renderProgress(el, params = []) {
  if (params[0] === "word-lists") return renderWordLists(el);
  const store = getStore();
  const stats = store.domainStats;

  /* Domain mastery grouped by subject */
  const bySubject = {};
  Object.entries(stats).forEach(([key, d]) => {
    const [subject, domain] = key.split(".");
    (bySubject[subject] = bySubject[subject] || []).push({ domain, ...d });
  });

  const masteryHtml = Object.entries(bySubject).map(([subject, rows]) => {
    rows.sort((a, b) => (a.ewma ?? 0) - (b.ewma ?? 0));
    const bars = rows.map(r => {
      const pct = Math.round((r.ewma ?? 0) * 100);
      return `
        <div class="domain-bar" data-subject="${subject}">
          <span>${esc(domainLabel(r.domain))}</span>
          <span class="track"><span class="fill" style="width:${pct}%"></span></span>
          <span>${pct}%</span>
        </div>`;
    }).join("");
    return `<h3 style="margin-bottom:var(--sp-2);">${esc(SUBJECT_LABELS[subject] || subject)}</h3>
      <div class="domain-bars" style="margin-top:0;margin-bottom:var(--sp-4);">${bars}</div>`;
  }).join("") || `<p class="muted">No practice recorded yet — mastery by topic appears here.</p>`;

  /* Timeline */
  const examDate = new Date(store.settings.examDate || "2027-05-11");
  const weeks = Math.max(0, Math.round((examDate - Date.now()) / (7 * 24 * 3600 * 1000)));
  const attempts = store.attempts.filter(a => !a.legacy);
  const recentPapers = attempts.filter(a => a.mode === "paper").slice(-6);
  const trend = recentPapers.map(a => {
    const earned = a.items.reduce((s, i) => s + i.earned, 0);
    const marks = a.items.reduce((s, i) => s + i.marks, 0);
    return `<span class="muted">${a.paperId}: <strong>${earned}/${marks}</strong></span>`;
  }).join(" · ") || `<span class="muted">No papers completed yet.</span>`;

  el.innerHTML = `
    <div class="card" style="margin-bottom:var(--sp-4);">
      <h2 style="margin-top:0;">Run-up to the SATs</h2>
      <p><strong>${weeks} weeks</strong> until ${examDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
        ${attempts.length} practice ${attempts.length === 1 ? "session" : "sessions"} recorded.</p>
      <p style="margin-bottom:0;">Recent papers: ${trend}</p>
    </div>

    <div class="card" style="margin-bottom:var(--sp-4);">
      <h2 style="margin-top:0;">Mastery by topic</h2>
      ${masteryHtml}
      <p class="muted" style="margin-bottom:0;">Bars show a recency-weighted average of marks earned. Self-marked answers count too.</p>
    </div>

    <div class="card" style="margin-bottom:var(--sp-4);">
      <h2 style="margin-top:0;">AI marking</h2>
      <p class="muted">Written answers are marked by Claude through your own server. Enter the shared key from <code>api/config.php</code> once; without it (or offline) the app falls back to self-marking checklists.</p>
      <p style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
        <input data-token type="password" placeholder="Shared key" value="${esc(store.settings.proxyToken || "")}"
          style="font:inherit;padding:var(--sp-2);border:1px solid var(--line);border-radius:6px;width:min(320px,60vw);">
        <button data-save-token class="primary">Save &amp; test</button>
      </p>
      <p data-ai-status class="muted"></p>
      <div data-usage></div>
      <hr style="border:none;border-top:1px solid var(--line-soft);margin:var(--sp-4) 0;">
      <p style="display:flex;gap:var(--sp-2);flex-wrap:wrap;align-items:center;">
        <select data-gen-category style="font:inherit;">
          <option value="fiction">Fiction</option>
          <option value="non-fiction">Non-fiction</option>
          <option value="poetry">Poetry</option>
        </select>
        <input data-gen-theme type="text" placeholder="Theme (optional), e.g. volcanoes"
          style="font:inherit;padding:var(--sp-2);border:1px solid var(--line);border-radius:6px;width:min(240px,50vw);">
        <button data-generate>Generate a new reading test</button>
      </p>
      <p data-gen-status class="muted"></p>
    </div>

    <div class="card" style="margin-bottom:var(--sp-4);">
      <h2 style="margin-top:0;">Word lists</h2>
      <p>Add a chapter to the language trainer (German, French) by uploading photos or a PDF of the vocabulary sheet — Claude reads it, you check it, then publish.
        Needs the shared key above and the upload password.</p>
      <p style="margin-bottom:0;"><a class="btn" href="#/grown-ups/word-lists">Word lists…</a></p>
    </div>

    <div class="card">
      <h2 style="margin-top:0;">Data</h2>
      <p>
        <button data-export>Export progress</button>
        <button data-reset style="color:var(--wrong);">Reset all progress…</button>
      </p>
      <p class="muted" style="margin-bottom:0;">Progress lives in this browser only. Export before switching devices.</p>
    </div>
  `;

  const statusEl = el.querySelector("[data-ai-status]");
  const usageEl = el.querySelector("[data-usage]");

  async function refreshUsage() {
    if (!getStore().settings.proxyToken) {
      statusEl.textContent = "No key saved — self-marking checklists will be used.";
      return;
    }
    statusEl.textContent = "Checking connection…";
    try {
      const data = await ping();
      statusEl.innerHTML = `Connected ✓ — today's allowance left: <strong>${data.remaining.mark}</strong> markings, <strong>${data.remaining.generate}</strong> generations`
        + (data.remaining.import !== undefined ? `, <strong>${data.remaining.import}</strong> word-list uploads.` : ".");
      const u = await usage();
      let html = "";
      if (u.log?.length) {
        const s = estimateSpend(u.log);
        html += `<p class="muted">Recent AI use: ${u.log.length} requests, ~${s.inTok.toLocaleString()} tokens in / ${s.outTok.toLocaleString()} out (≈ $${s.usd.toFixed(3)}).</p>`;
      }
      html += securityHtml(u.security, data.uploads);
      usageEl.innerHTML = html;
    } catch (err) {
      statusEl.textContent = err.code === "unauthorized"
        ? "That key was not accepted — check it matches api/config.php on the server."
        : "Couldn't reach the marking server — the app will use self-marking checklists.";
    }
  }

  el.querySelector("[data-save-token]").addEventListener("click", () => {
    getStore().settings.proxyToken = el.querySelector("[data-token]").value.trim();
    saveStore();
    refreshUsage();
  });

  el.querySelector("[data-generate]").addEventListener("click", async () => {
    const btn = el.querySelector("[data-generate]");
    const genStatus = el.querySelector("[data-gen-status]");
    btn.disabled = true;
    try {
      await generateReadingTest({
        category: el.querySelector("[data-gen-category]").value,
        theme: el.querySelector("[data-gen-theme]").value.trim()
      }, text => { genStatus.textContent = text; });
      await loadContent();
      genStatus.innerHTML += ` <a href="#/papers/reading">Try the reading paper</a> — new tests join the pool.`;
    } catch (err) {
      genStatus.textContent = `Couldn't generate a test: ${err.message}`;
    } finally {
      btn.disabled = false;
    }
  });

  el.querySelector("[data-export]").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(getStore(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sats-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  el.querySelector("[data-reset]").addEventListener("click", () => {
    if (window.confirm("Really delete all practice history and settings on this device?")) {
      resetStore();
      renderProgress(el);
    }
  });

  refreshUsage();
}
