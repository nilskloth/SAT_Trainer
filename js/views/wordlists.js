/* =========================================================
   Grown-ups → Word lists (#/grown-ups/word-lists).
   1. Unlock with the upload password (server-checked; wrong
      tries are logged, alerted and lock uploading for an hour)
   2. Upload photos / a PDF of a vocabulary sheet (or paste its
      text) → the proxy's import-vocab op → Claude returns a draft
   3. Check and correct the draft here (kept in this browser
      until published or discarded)
   4. Publish → data/uploads/<lang>.json on the server; the
      trainer merges it with the built-in lists
   5. History: the server backs up the uploads before every
      change; any backup can be restored (and that undone)
   The password is kept in memory only, for this visit.
   ========================================================= */

import { proxyCall, ping } from "../core/ai.js";
import { getStore } from "../core/store.js";
import { esc } from "../core/utils.js";
import { LANGS, loadBank, forgetBank } from "./secondary/langs.js";

const DRAFT_KEY = "ks2_vocab_draft";
const IMPORT_TIMEOUT_MS = 300000;
const MAX_FILES = 8;

let password = "";

const slug = s => s.toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; }
}
function saveDraft(d) {
  try { d ? localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) : localStorage.removeItem(DRAFT_KEY); } catch { /* storage full or blocked */ }
}

const ERRORS = {
  bad_password: "That password isn't right.",
  locked: null,             // server message says for how long
  no_password: "No upload password is set on the server yet — see the note below.",
  unauthorized: "The shared key on this device wasn't accepted — check it in Grown-ups → AI marking.",
  rate_limited: "Today's upload allowance is used up — try again tomorrow.",
  too_large: "Those files were too large for the server — try fewer pages or photos instead of a PDF."
};
const errText = err => ERRORS[err.code] || err.message || "Something went wrong.";

export function renderWordLists(el) {
  const hasToken = !!getStore().settings.proxyToken;
  el.innerHTML = `
    <div class="run-bar">
      <h2>Word lists</h2>
      <a class="btn quiet" href="#/grown-ups">Back</a>
    </div>
    <div class="card wl-card">
      <p style="margin-top:0;">Add a chapter to the language trainer from the school's vocabulary sheet. Claude reads the pages and
        sets out the topics, words and strategy box; you check everything before it goes live.</p>
      ${hasToken ? `
        <div data-locked>
          <p class="wl-row">
            <input type="password" data-password placeholder="Upload password" autocomplete="current-password" class="wl-input" style="width:min(280px,60vw);">
            <button class="primary" data-unlock>Unlock</button>
          </p>
          <p class="muted" data-unlock-status style="margin-bottom:0;"></p>
        </div>`
      : `<p class="muted" style="margin-bottom:0;">First save the shared key in <a href="#/grown-ups">Grown-ups → AI marking</a>.</p>`}
    </div>
    <div data-unlocked class="hidden"></div>
    <div class="card wl-card" data-published-card>
      <h3 style="margin-top:0;">Uploaded chapters</h3>
      <div data-published><p class="muted">Loading…</p></div>
      <div data-history></div>
    </div>`;

  const unlocked = el.querySelector("[data-unlocked]");
  showPublished(el);

  if (!hasToken) return;

  const status = el.querySelector("[data-unlock-status]");
  const tryUnlock = async () => {
    const pw = el.querySelector("[data-password]").value;
    if (!pw) return;
    status.textContent = "Checking…";
    try {
      await proxyCall("vocab-unlock", { password: pw });
      password = pw;
      el.querySelector("[data-locked]").innerHTML = `<p class="muted" style="margin-bottom:0;">Unlocked ✓ for this visit.</p>`;
      unlocked.classList.remove("hidden");
      renderWork(el, unlocked);
      showPublished(el);
    } catch (err) {
      status.textContent = errText(err);
      if (err.code === "no_password") status.textContent += " Run php tools/set-upload-password.php on the computer you deploy from, then deploy.";
    }
  };
  el.querySelector("[data-unlock]").addEventListener("click", tryUnlock);
  el.querySelector("[data-password]").addEventListener("keydown", e => { if (e.key === "Enter") tryUnlock(); });

  if (password) {
    el.querySelector("[data-locked]").innerHTML = `<p class="muted" style="margin-bottom:0;">Unlocked ✓ for this visit.</p>`;
    unlocked.classList.remove("hidden");
    renderWork(el, unlocked);
  }
}

/* =========================
   Upload, then the draft editor
========================= */

function renderWork(root, box) {
  const draft = loadDraft();
  if (draft) return renderEditor(root, box, draft);

  const langOptions = Object.values(LANGS).map(l => `<option value="${l.code}">${esc(l.label)}</option>`).join("");
  box.innerHTML = `
    <div class="card wl-card">
      <h3 style="margin-top:0;">Add a chapter</h3>
      <p class="wl-row">
        <label>Language <select data-lang class="wl-input">${langOptions}</select></label>
        <label>Chapter number <input type="number" min="1" max="99" data-number class="wl-input" style="width:5em;" placeholder="auto"></label>
      </p>
      <p>
        <label class="btn" style="display:inline-block;">Choose photos or a PDF
          <input type="file" data-files accept="image/*,application/pdf" multiple class="visually-hidden">
        </label>
        <span class="muted" data-file-list>Take a clear, straight photo of each page — up to ${MAX_FILES}. A Word file: save it as PDF first.</span>
      </p>
      <details>
        <summary class="muted">…or paste the sheet's text</summary>
        <textarea data-text rows="6" class="wl-input" style="width:100%;margin-top:var(--sp-2);" placeholder="Paste the word list here"></textarea>
      </details>
      <p style="margin-bottom:0;">
        <button class="primary" data-read>Read with Claude</button>
        <span class="muted" data-read-status></span>
      </p>
    </div>`;

  const filesIn = box.querySelector("[data-files]");
  filesIn.addEventListener("change", () => {
    const n = filesIn.files.length;
    box.querySelector("[data-file-list]").textContent = n
      ? [...filesIn.files].map(f => f.name).join(", ") + (n > MAX_FILES ? ` — only ${MAX_FILES} at a time, please` : "")
      : "";
  });

  box.querySelector("[data-read]").addEventListener("click", async () => {
    const btn = box.querySelector("[data-read]");
    const st = box.querySelector("[data-read-status]");
    const lang = box.querySelector("[data-lang]").value;
    const numberIn = Number(box.querySelector("[data-number]").value) || 0;
    const text = box.querySelector("[data-text]").value.trim();
    const files = [...filesIn.files];
    if (!files.length && !text) { st.textContent = "Choose a photo or PDF, or paste some text."; return; }
    if (files.length > MAX_FILES) { st.textContent = `Only ${MAX_FILES} files at a time.`; return; }

    btn.disabled = true;
    let timer = null;
    try {
      st.textContent = "Preparing the pages…";
      const info = await ping().catch(() => null);
      const budget = Math.min(parseSize(info?.uploads?.postMax) || 8e6, 13e6) * 0.85;
      const prepared = await prepareFiles(files, budget);

      const started = Date.now();
      const tick = () => { st.textContent = `Claude is reading the pages… ${Math.round((Date.now() - started) / 1000)} s (usually about a minute)`; };
      tick();
      timer = setInterval(tick, 1000);
      const data = await proxyCall("import-vocab", { password, lang, files: prepared, text }, IMPORT_TIMEOUT_MS);
      clearInterval(timer);

      const draft = fromClaude(lang, data, numberIn);
      if (!draft.sections.length) { st.textContent = "Claude didn't find a word list on those pages. Try clearer photos."; return; }
      saveDraft(draft);
      renderEditor(root, box, draft);
    } catch (err) {
      st.textContent = err.name === "AbortError" ? "That took too long — try fewer pages at a time." : errText(err);
    } finally {
      clearInterval(timer);
      btn.disabled = false;
    }
  });
}

function parseSize(s) {
  const m = String(s || "").trim().match(/^(\d+)\s*([KMG]?)/i);
  if (!m) return 0;
  return Number(m[1]) * ({ "": 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3 }[m[2].toUpperCase()]);
}

/* Photos are shrunk to JPEG; PDFs go as they are. Total base64 must fit the server's limit. */
async function prepareFiles(files, budget) {
  const pdfs = files.filter(f => f.type === "application/pdf");
  const images = files.filter(f => f.type !== "application/pdf");
  const pdfData = await Promise.all(pdfs.map(async f => ({ media_type: "application/pdf", data: await toBase64(f) })));
  const pdfSize = pdfData.reduce((s, f) => s + f.data.length, 0);
  if (pdfSize > budget) throw new Error("That PDF is too large for the server — take photos of the pages instead.");

  for (const [maxSide, quality] of [[2000, 0.85], [1600, 0.75], [1200, 0.7]]) {
    const imgData = [];
    for (const f of images) imgData.push({ media_type: "image/jpeg", data: await shrink(f, maxSide, quality) });
    const total = pdfSize + imgData.reduce((s, f) => s + f.data.length, 0);
    if (total <= budget) return [...pdfData, ...imgData];
  }
  throw new Error("Those pages are too large together — try fewer at a time.");
}

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(new Error(`Couldn't read ${blob.name || "a file"}`));
    r.readAsDataURL(blob);
  });
}

async function shrink(file, maxSide, quality) {
  const img = await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => { URL.revokeObjectURL(url); resolve(i); };
    i.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`${file.name} isn't a photo this browser can open — try JPEG or PDF.`)); };
    i.src = url;
  });
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const g = canvas.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality).split(",")[1];
}

/* Claude's answer → the editor's draft. */
function fromClaude(lang, d, numberIn) {
  return {
    lang,
    number: numberIn || d.chapterNumber || 0,
    title: d.chapterTitle || "",
    pages: d.pages || "",
    notes: d.notes || "",
    sections: (d.sections || []).map(s => ({
      title: s.title || "", en: s.en || "",
      items: (s.items || []).map(i => ({ target: i.target || "", en: i.en || "", opener: i.opener || "", openerEn: i.openerEn || "" }))
    })).filter(s => s.items.length),
    includeStrategy: !!(d.strategy?.title && d.strategy.parts?.length),
    strategy: {
      title: d.strategy?.title || "",
      parts: (d.strategy?.parts || []).map(p => ({ heading: p.heading || "", text: p.text || "", steps: p.steps || [], words: p.words || [] }))
    }
  };
}

/* The draft → a chapter in the trainer's shape (ids as tools/import-vocab.mjs makes them). */
function toChapter(d) {
  const n = d.number;
  const used = new Set();
  const itemId = target => {
    const base = `${d.lang}-k${n}-${slug(target) || "item"}`;
    let id = base, k = 2;
    while (used.has(id)) id = `${base}-${k++}`;
    used.add(id);
    return id;
  };
  const chapter = {
    number: n, title: d.title.trim(), pages: d.pages.trim(),
    sections: d.sections.map((s, i) => ({
      id: `k${n}-s${i + 1}`, title: s.title.trim(), en: s.en.trim(),
      items: s.items.filter(it => it.target.trim() && it.en.trim()).map(it => {
        const item = { id: itemId(it.target.trim()), [d.lang]: it.target.trim(), en: it.en.trim() };
        if (it.opener.trim() && it.openerEn.trim()) item.context = { [d.lang]: it.opener.trim(), en: it.openerEn.trim() };
        return item;
      })
    })).filter(s => s.items.length)
  };
  if (d.includeStrategy && d.strategy.title.trim()) {
    chapter.strategy = {
      title: d.strategy.title.trim(),
      parts: d.strategy.parts.map(p => ({
        heading: p.heading.trim(), text: p.text.trim(),
        steps: p.steps.map(s => s.trim()).filter(Boolean),
        words: p.words.map(s => s.trim()).filter(Boolean)
      }))
    };
  }
  return chapter;
}

function renderEditor(root, box, draft) {
  const lang = LANGS[draft.lang];
  const words = draft.sections.reduce((s, x) => s + x.items.length, 0);
  const field = (path, value, attrs = "") =>
    `<input class="wl-input" data-f="${path}" value="${esc(value)}" ${attrs}>`;

  box.innerHTML = `
    <div class="card wl-card">
      <h3 style="margin-top:0;">Check the ${esc(lang.label)} chapter</h3>
      ${draft.notes ? `<p class="mark-note partial" style="margin-top:0;"><strong>Claude's note:</strong> ${esc(draft.notes)}</p>` : ""}
      <p class="muted">Compare with the sheet and fix anything that's wrong — the trainer marks answers against exactly what's here.
        "Opener" is only for words that complete a phrase, like <em>Ich habe …</em> + <em>einen Hund</em>. Your changes are kept in this browser until you publish.</p>
      <p class="wl-row">
        <label>${esc(lang.chapterWord)} ${field("number", draft.number || "", 'type="number" min="1" max="99" style="width:5em;"')}</label>
        <label style="flex:1;">Title ${field("title", draft.title, 'style="width:100%;"')}</label>
        <label>Pages ${field("pages", draft.pages, 'style="width:7em;"')}</label>
      </p>
      <p class="muted" data-replace-note></p>

      ${draft.sections.map((s, si) => `
        <div class="wl-section">
          <div class="wl-row">
            <label style="flex:1;">Topic ${field(`s.${si}.title`, s.title, `lang="${draft.lang}" style="width:100%;"`)}</label>
            <label style="flex:1;">English ${field(`s.${si}.en`, s.en, 'style="width:100%;"')}</label>
            <button type="button" class="quiet" data-del-sec="${si}">Remove topic</button>
          </div>
          <table class="wl-table">
            <thead><tr><th>${esc(lang.label)}</th><th>English</th><th>Opener (${esc(lang.label)})</th><th>Opener (English)</th><th></th></tr></thead>
            <tbody>
              ${s.items.map((it, ii) => `
                <tr>
                  <td>${field(`s.${si}.i.${ii}.target`, it.target, `lang="${draft.lang}"`)}</td>
                  <td>${field(`s.${si}.i.${ii}.en`, it.en)}</td>
                  <td>${field(`s.${si}.i.${ii}.opener`, it.opener, `lang="${draft.lang}" placeholder="opener (optional)"`)}</td>
                  <td>${field(`s.${si}.i.${ii}.openerEn`, it.openerEn, 'placeholder="opener in English"')}</td>
                  <td><button type="button" class="quiet" data-del-item="${si}.${ii}" aria-label="Remove row">✕</button></td>
                </tr>`).join("")}
            </tbody>
          </table>
          <button type="button" class="quiet" data-add-item="${si}">+ Add a row</button>
        </div>`).join("")}
      <p><button type="button" class="quiet" data-add-sec>+ Add a topic</button></p>

      <div class="wl-section">
        <label class="wl-row"><input type="checkbox" data-include-strategy ${draft.includeStrategy ? "checked" : ""}>
          <strong>Include the strategy box</strong> <span class="muted">(retold by Claude in its own words)</span></label>
        ${draft.includeStrategy ? `
          <p><label>Title ${field("st.title", draft.strategy.title, 'style="width:100%;"')}</label></p>
          ${draft.strategy.parts.map((p, pi) => `
            <div class="wl-part">
              <p class="wl-row"><label style="flex:1;">Heading ${field(`st.${pi}.heading`, p.heading, 'style="width:100%;"')}</label>
                <button type="button" class="quiet" data-del-part="${pi}">Remove</button></p>
              <label>Text <textarea class="wl-input" data-f="st.${pi}.text" rows="3" style="width:100%;">${esc(p.text)}</textarea></label>
              <label>Steps, one per line <textarea class="wl-input" data-f="st.${pi}.steps" rows="${Math.max(2, p.steps.length)}" style="width:100%;">${esc(p.steps.join("\n"))}</textarea></label>
              <label>Example words, separated by commas ${field(`st.${pi}.words`, p.words.join(", "), `lang="${draft.lang}" style="width:100%;"`)}</label>
            </div>`).join("")}
          <button type="button" class="quiet" data-add-part>+ Add a part</button>` : ""}
      </div>

      <p style="margin-bottom:0;">
        <button class="primary" data-publish>Publish ${words} words</button>
        <button type="button" data-discard>Discard</button>
        <span class="muted" data-publish-status></span>
      </p>
    </div>`;

  const redraw = () => { saveDraft(draft); renderEditor(root, box, draft); };
  /* listeners go on the freshly drawn card, so redraws never stack them */
  const ed = box.firstElementChild;

  /* typing: update the draft in place, no redraw */
  ed.addEventListener("input", e => {
    const path = e.target.dataset.f;
    if (!path) return;
    const v = e.target.value;
    const p = path.split(".");
    if (path === "number") draft.number = Number(v) || 0;
    else if (path === "title" || path === "pages") draft[path] = v;
    else if (p[0] === "s" && p.length === 3) draft.sections[p[1]][p[2]] = v;
    else if (p[0] === "s") draft.sections[p[1]].items[p[3]][p[4]] = v;
    else if (path === "st.title") draft.strategy.title = v;
    else if (p[0] === "st") {
      const part = draft.strategy.parts[p[1]];
      if (p[2] === "steps") part.steps = v.split("\n");
      else if (p[2] === "words") part.words = v.split(",");
      else part[p[2]] = v;
    }
    saveDraft(draft);
    if (path === "number") replaceNote();
  });

  box.querySelector("[data-include-strategy]").addEventListener("change", e => {
    draft.includeStrategy = e.target.checked;
    if (draft.includeStrategy && !draft.strategy.parts.length) draft.strategy.parts.push({ heading: "", text: "", steps: [], words: [] });
    redraw();
  });
  ed.addEventListener("click", e => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.delItem) {
      const [si, ii] = t.dataset.delItem.split(".").map(Number);
      draft.sections[si].items.splice(ii, 1);
    } else if (t.dataset.addItem) {
      draft.sections[Number(t.dataset.addItem)].items.push({ target: "", en: "", opener: "", openerEn: "" });
    } else if (t.dataset.delSec) {
      draft.sections.splice(Number(t.dataset.delSec), 1);
    } else if (t.hasAttribute("data-add-sec")) {
      draft.sections.push({ title: "", en: "", items: [{ target: "", en: "", opener: "", openerEn: "" }] });
    } else if (t.dataset.delPart) {
      draft.strategy.parts.splice(Number(t.dataset.delPart), 1);
    } else if (t.hasAttribute("data-add-part")) {
      draft.strategy.parts.push({ heading: "", text: "", steps: [], words: [] });
    } else return;
    redraw();
  });

  /* Publishing over a built-in or earlier chapter replaces it — say so. */
  async function replaceNote() {
    const note = box.querySelector("[data-replace-note]");
    if (!note) return;
    let existing = null;
    try { existing = (await loadBank(draft.lang)).chapters.find(c => c.number === draft.number); } catch { /* none yet */ }
    note.textContent = existing
      ? `${lang.chapterWord} ${draft.number} already exists (“${existing.title}”). Publishing replaces it; progress on words that stay the same is kept.`
      : "";
  }
  replaceNote();

  box.querySelector("[data-discard]").addEventListener("click", e => {
    if (e.target.dataset.sure) { saveDraft(null); renderWork(root, box); return; }
    e.target.dataset.sure = "1";
    e.target.textContent = "Really discard?";
  });

  box.querySelector("[data-publish]").addEventListener("click", async () => {
    const st = box.querySelector("[data-publish-status]");
    if (!(draft.number >= 1 && draft.number <= 99)) { st.textContent = "Give the chapter a number (1–99)."; return; }
    const chapter = toChapter(draft);
    if (!chapter.sections.length) { st.textContent = "There are no complete rows to publish."; return; }
    const btn = box.querySelector("[data-publish]");
    btn.disabled = true;
    st.textContent = "Publishing…";
    try {
      await proxyCall("vocab-publish", { password, lang: draft.lang, chapter }, 30000);
      saveDraft(null);
      forgetBank(draft.lang);
      window.dispatchEvent(new Event("langs-changed"));
      renderWork(root, box);
      box.insertAdjacentHTML("afterbegin", `<p class="mark-note correct">Published ✓ — ${esc(lang.chapterWord)} ${chapter.number} is in the
        <a href="#/secondary/${draft.lang}">${esc(lang.label)} trainer</a>.</p>`);
      showPublished(root);
    } catch (err) {
      st.textContent = errText(err);
      btn.disabled = false;
    }
  });
}

/* =========================
   Uploaded chapters (with Remove once unlocked)
========================= */

async function showPublished(root) {
  const box = root.querySelector("[data-published]");
  if (!box) return;
  showHistory(root);
  const rows = [];
  for (const lang of Object.values(LANGS)) {
    try {
      const res = await fetch(`data/uploads/${lang.code}.json`, { cache: "no-cache" });
      if (!res.ok) continue;
      for (const ch of (await res.json()).chapters || []) rows.push({ lang, ch });
    } catch { /* none */ }
  }
  box.innerHTML = rows.length ? `
    <table class="word-list">
      <tbody>
        ${rows.map(({ lang, ch }) => `
          <tr>
            <td>${esc(lang.label)} · ${esc(lang.chapterWord)} ${ch.number}</td>
            <td lang="${lang.code}">${esc(ch.title)}</td>
            <td class="muted">${ch.sections.reduce((s, x) => s + x.items.length, 0)} words · ${esc(ch.uploaded || "")}</td>
            <td>${password ? `<button type="button" class="quiet" data-remove="${lang.code}.${ch.number}">Remove</button>` : ""}</td>
          </tr>`).join("")}
      </tbody>
    </table>
    ${password ? "" : `<p class="muted" style="margin-bottom:0;">Unlock to remove a chapter.</p>`}`
    : `<p class="muted" style="margin-bottom:0;">None yet — the built-in German chapters don't show here.</p>`;

  box.querySelectorAll("[data-remove]").forEach(b => b.addEventListener("click", async () => {
    if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Really remove?"; return; }
    const [code, number] = b.dataset.remove.split(".");
    b.disabled = true;
    try {
      await proxyCall("vocab-remove", { password, lang: code, number: Number(number) }, 30000);
      forgetBank(code);
      window.dispatchEvent(new Event("langs-changed"));
      showPublished(root);
    } catch (err) {
      b.textContent = errText(err);
    }
  }));
}

/* =========================
   History: server backups, newest first (unlocked only)
========================= */

async function showHistory(root) {
  const box = root.querySelector("[data-history]");
  if (!box || !password) return;
  let backups = [];
  try {
    backups = (await proxyCall("vocab-history", { password })).backups || [];
  } catch (err) {
    box.innerHTML = `<p class="muted">History couldn't load: ${esc(errText(err))}</p>`;
    return;
  }
  const when = ts => new Date(ts).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  const what = b => b.chapters.length
    ? b.chapters.map(c => `${LANGS[b.lang].chapterWord} ${c.number}${c.title ? ` “${esc(c.title)}”` : ""} (${c.words})`).join(", ")
    : "no uploaded chapters";
  box.innerHTML = `
    <details class="wl-history"${backups.length ? "" : " hidden"}>
      <summary><strong>History</strong> <span class="muted">· ${backups.length} backup${backups.length === 1 ? "" : "s"} — the uploads as they were before each change</span></summary>
      <table class="word-list">
        <tbody>
          ${backups.map(b => `
            <tr>
              <td class="muted" style="white-space:nowrap;">${esc(when(b.ts))}</td>
              <td>${esc(LANGS[b.lang].label)}: ${what(b)}</td>
              <td><button type="button" class="quiet" data-restore="${esc(b.file)}">Restore</button></td>
            </tr>`).join("")}
        </tbody>
      </table>
      <p class="muted" style="margin-bottom:0;">Restoring puts that language's uploaded chapters back exactly as they were then. What's there now is backed up first, so a restore can be undone too.</p>
    </details>`;

  box.querySelectorAll("[data-restore]").forEach(b => b.addEventListener("click", async () => {
    if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Really restore?"; return; }
    b.disabled = true;
    try {
      await proxyCall("vocab-restore", { password, file: b.dataset.restore }, 30000);
      Object.keys(LANGS).forEach(forgetBank);
      window.dispatchEvent(new Event("langs-changed"));
      await showPublished(root);
      root.querySelector("[data-history] details")?.setAttribute("open", "");
    } catch (err) {
      b.textContent = errText(err);
    }
  }));
}
