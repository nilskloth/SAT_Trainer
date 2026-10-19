/* =========================================================
   Import secondary vocabulary lists ("Wörter" / "Vocabulaire"
   chapter sheets) from Word .doc files into
   data/content/secondary/<lang>.json.

   Usage (macOS — uses the built-in textutil):
     node tools/import-vocab.mjs de "German" ~/Downloads/folder-with-ChN-docs

   Sheet layout (one .doc per chapter, "ChN ….doc"):
     line 1          title<TAB>(Seiten 24–25)
     blank line      starts a new section; its first line is the
                     section heading: target<TAB>English
     target<TAB>English   one entry per line
     <TAB>…          English wrapped onto the next line
     footer          chapter title, then page/copyright junk
   Section headings that are questions ("Wo wohnst du?") are
   also kept as entries — they are real phrases to learn.
   Rows split mid-sentence are joined; repeated rows dropped.
   ========================================================= */

import { execFileSync } from "node:child_process";
import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const [lang, label, dir] = process.argv.slice(2);
if (!lang || !label || !dir) {
  console.error('Usage: node tools/import-vocab.mjs <lang> "<Label>" <folder>');
  process.exit(1);
}

const clean = s => s.replace(/\s+/g, " ").trim();
const slug = s => s.toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/* Typos in the source sheets, fixed on import: [target or English as printed, corrected]. */
const CORRECTIONS = {
  de: [
    ["on 3 Februray", "on 3 February"],
    ["A m Dienstag habe ich …", "Am Dienstag habe ich …"],
    ["Ich chatte mit FreundenIauf Facebook.", "Ich chatte mit Freunden auf Facebook."]
  ]
};

/* Entries whose form only makes sense after an opener on the sheet
   ("Ich habe …" → einen Computer, accusative). Chosen by reading every
   topic — only where case or endings depend on the opener. The trainer
   shows the opener with these entries. [chapter, section title, opener, English] */
const CONTEXT = {
  de: [
    [1, "Hast du einen Computer?", "Ich habe …", "I have …"],
    [1, "Wo wohnst du?", "Ich wohne in …", "I live in …"],
    [2, "Haustiere", "Ich habe …", "I have …"],
    [2, "Haare und Augen", "Er/Sie hat …", "He/She has …"]
  ]
};
const ENDS_SENTENCE = /[.?!]$/;
const ENDS_GAP = /(…|\.\.\.)$/;
const fix = s => (CORRECTIONS[lang] || []).reduce((t, [from, to]) => (t === from ? to : t), s);
const unbalanced = s => (s.match(/\(/g) || []).length > (s.match(/\)/g) || []).length;

const FOOTER_JUNK = /^(PAGE\b|©|Unit no|KAPITEL\b|CHAPITRE\b|MODULE\b)/i;

function parseChapter(text, number) {
  const lines = text.replace(/\f/g, "\n").split("\n");
  const pages = (lines[0].match(/\(([^)]*)\)/) || [])[1]?.replace(/^(Seiten|Seite|pages?)\s*/i, "") || "";
  const chapter = { id: `k${number}`, number, title: "", pages, sections: [] };
  const used = new Set();
  const itemId = target => {
    const base = `${lang}-k${number}-${slug(target) || "item"}`;
    let id = base, n = 2;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id);
    return id;
  };

  let newBlock = true;
  let section = null;
  let last = null;           // object whose English a continuation line extends

  for (const raw of lines.slice(1)) {
    if (!raw.trim()) { newBlock = true; continue; }
    const cols = raw.split("\t").map(clean).filter(Boolean);

    if (cols.length === 1 && FOOTER_JUNK.test(cols[0])) continue;
    if (/^\s/.test(raw) && cols.length === 1) {            // wrapped English
      if (last) last.en = clean(`${last.en} ${cols[0]}`);
      continue;
    }
    if (cols.length === 1) {                                // footer area
      if (!chapter.title && !FOOTER_JUNK.test(cols[0])) chapter.title = cols[0];
      continue;
    }

    const [target, en] = [fix(cols[0]), fix(cols.slice(1).join(" "))];

    /* A row whose target wrapped mid-bracket or mid-sentence continues
       on the next row ("Es gibt … Personen in" + "meiner Familie."). */
    const wrapsBracket = last?.[lang] && unbalanced(last[lang]);
    const wrapsSentence = last?.[lang] && !ENDS_SENTENCE.test(last[lang]) && !ENDS_GAP.test(last[lang])
      && /^\p{Ll}/u.test(target) && ENDS_SENTENCE.test(target);
    if (!newBlock && (wrapsBracket || wrapsSentence)) {
      const join = (a, b) => clean(a.endsWith("/") ? a + b : `${a} ${b}`);
      last[lang] = join(last[lang], target);
      last.en = join(last.en, en);
      continue;
    }

    if (newBlock) {
      section = { id: `k${number}-s${chapter.sections.length + 1}`, title: target, en, items: [] };
      chapter.sections.push(section);
      last = section;
      newBlock = false;
      if (/\?$/.test(target)) {
        const item = { id: itemId(target), [lang]: target, en };
        section.items.push(item);
        last = { set en(v) { section.en = v; item.en = v; }, get en() { return item.en; } };
      }
      continue;
    }
    if (section.items.some(i => i[lang] === target && i.en === en)) continue;   // listed twice
    const item = { id: itemId(target), [lang]: target, en };
    section.items.push(item);
    last = item;
  }

  for (const [n, title, opener, openerEn] of CONTEXT[lang] || []) {
    if (n !== number) continue;
    const sec = chapter.sections.find(s => s.title === title);
    if (!sec) throw new Error(`CONTEXT: no section "${title}" in chapter ${n}`);
    sec.items
      .filter(i => !ENDS_SENTENCE.test(i[lang]) && !ENDS_GAP.test(i[lang]))
      .forEach(i => { i.context = { [lang]: opener, en: openerEn }; });
  }
  return chapter;
}

const files = readdirSync(dir)
  .map(f => ({ f, n: Number((f.match(/^Ch(\d+)/i) || [])[1]) }))
  .filter(x => x.n && /\.docx?$/i.test(x.f))
  .sort((a, b) => a.n - b.n);
if (!files.length) {
  console.error(`No "ChN ….doc" files found in ${dir}`);
  process.exit(1);
}

const chapters = files.map(({ f, n }) => {
  const text = execFileSync("textutil", ["-convert", "txt", "-stdout", join(dir, f)], { encoding: "utf8" });
  return parseChapter(text, n);
});

const out = {
  language: lang,
  label,
  imported: new Date().toISOString().slice(0, 10),
  chapters
};

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(ROOT, "data", "content", "secondary", `${lang}.json`);
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");

chapters.forEach(c => {
  const items = c.sections.reduce((s, x) => s + x.items.length, 0);
  console.log(`Chapter ${c.number} "${c.title}" (pp. ${c.pages}): ${c.sections.length} sections, ${items} entries`);
});
console.log(`→ ${dest}`);
