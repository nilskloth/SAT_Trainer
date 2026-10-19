/* =========================================================
   Typed-answer matching for vocabulary (secondary languages).
   DOM-free; exercised by tools/test-vocab.mjs.

   A printed answer such as "(Julia) is … years old." or
   "der Tisch(-e)" or "Hello!/Hi!" expands into every
   acceptable form:
     (…)        optional — with or without the bracket content
     a/b        alternatives (whole phrases, or single words)
     a, b       English alternatives when the prompt has no comma
     …  / ...   stands for any words ("I am 12 years old")
   English answers are lenient (case, punctuation, contractions,
   articles, UK/US spelling, one typo in longer words).
   German answers must get capitals and umlauts right — those
   come back as "nearly" with a tip, not as correct.
   ========================================================= */

const ELLIPSIS = "…";
const WILD = Symbol("wild");
const MAX_VARIANTS = 400;

/* ---------- expansion ---------- */

function parenVariants(s) {
  const m = s.match(/\([^()]*\)/);
  if (!m) return [s];
  const before = s.slice(0, m.index);
  const after = s.slice(m.index + m[0].length);
  const inner = m[0].slice(1, -1);
  const fills = [inner, ...(inner.includes("/") ? inner.split("/") : []), " "];
  return fills.flatMap(fill => parenVariants(before + fill + after));
}

function phraseAlternatives(s) {
  const parts = s.split("/");
  if (parts.length > 1 && /\s/.test(parts[0].trim()) && parts.slice(1).some(p => /\s/.test(p.trim()))) {
    return parts;
  }
  return [s];
}

const PRONOUN_IS = new Set(["what", "it", "that", "there", "he", "she", "who", "where", "how", "here"]);

const NO_APOSTROPHE = { whats: "what is", thats: "that is", theres: "there is", wheres: "where is",
  hows: "how is", hes: "he is", shes: "she is", im: "i am", ive: "i have", youre: "you are",
  dont: "do not", doesnt: "does not", isnt: "is not", arent: "are not", cant: "can not", didnt: "did not" };

function expandContractions(s) {
  return s
    .replace(/\b[a-z]+\b/g, w => NO_APOSTROPHE[w] || w)
    .replace(/\bcan't\b/g, "can not").replace(/\bcannot\b/g, "can not")
    .replace(/\bwon't\b/g, "will not")
    .replace(/n't\b/g, " not")
    .replace(/'re\b/g, " are").replace(/'m\b/g, " am")
    .replace(/'ve\b/g, " have").replace(/'ll\b/g, " will").replace(/'d\b/g, " would")
    .replace(/\b(\w+)'s\b/g, (all, w) => (PRONOUN_IS.has(w) ? `${w} is` : all));
}

const UK = { favorite: "favourite", favorites: "favourites", color: "colour", colors: "colours",
  gray: "grey", program: "programme", programs: "programmes", math: "maths", mom: "mum" };
const EN_SKIP = new Set(["a", "an", "the"]);

function tokens(s, lang) {
  let t = String(s ?? "")
    .replace(/\.{3}/g, ELLIPSIS)
    .replace(/[’‘`´]/g, "'")
    .replace(/\s*\/\s*/g, "/")
    .replace(/[-–—]/g, " ")
    .replace(new RegExp(ELLIPSIS, "g"), ` ${ELLIPSIS} `);
  if (lang === "en") t = expandContractions(t.toLowerCase());

  let out = t.split(/\s+/)
    .map(w => (w === ELLIPSIS ? WILD : w.replace(/[^\p{L}\p{N}/]/gu, "")))
    .filter(Boolean);

  if (lang === "en") {
    out = out.map(w => (w === WILD ? w : w.split("/").map(x => UK[x] || x).join("/")))
      .filter(w => !EN_SKIP.has(w));
    if (out[0] === "to") out = out.slice(1);
  }
  return out;
}

function expandSlashTokens(toks) {
  let seqs = [[]];
  for (const t of toks) {
    const alts = t === WILD ? [t] : t.split("/").filter(Boolean);
    const next = [];
    for (const s of seqs) for (const a of alts) next.push([...s, a]);
    seqs = next.slice(0, MAX_VARIANTS);
  }
  return seqs;
}

export function variants(expected, lang, prompt = "") {
  let forms = parenVariants(expected).flatMap(f => {
    const parts = phraseAlternatives(f);
    return parts.length > 1 ? [f, ...parts] : parts;
  });
  if (lang === "en" && !String(prompt).includes(",")) {
    forms = forms.flatMap(f => (f.includes(",") ? [f, ...f.split(",")] : [f]));
  }
  const seen = new Set();
  const out = [];
  for (const f of forms) {
    const toks = tokens(f, lang);
    for (const seq of [toks, ...expandSlashTokens(toks)]) {
      if (!seq.length) continue;
      const key = seq.map(x => (x === WILD ? "…" : x)).join(" ");
      if (!seen.has(key)) { seen.add(key); out.push(seq); }
    }
    if (out.length >= MAX_VARIANTS) break;
  }
  return out;
}

/* ---------- comparison ---------- */

function seqMatch(exp, got, eq) {
  const memo = new Map();
  const go = (i, j) => {
    const k = i * 1000 + j;
    if (memo.has(k)) return memo.get(k);
    let r;
    if (i === exp.length) r = j === got.length;
    else if (exp[i] === WILD) r = go(i + 1, j) || (j < got.length && go(i, j + 1));
    else r = j < got.length && eq(exp[i], got[j]) && go(i + 1, j + 1);
    memo.set(k, r);
    return r;
  };
  return go(0, 0);
}

function lev1(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else if (a[i + 1] === b[j] && a[i] === b[j + 1]) { i += 2; j += 2; }   // swapped letters
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

const translit = w => w.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
  .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss");
const bare = w => w.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").toLowerCase();

/*
 * checkAnswer(expected, answer, {lang, prompt})
 *   lang   language of the expected answer: "en" | "de" | "fr"
 *   prompt the text that was shown (decides comma alternatives)
 * → { ok, near?: "case"|"accents", tip? }
 */
export function checkAnswer(expected, answer, { lang, prompt = "" } = {}) {
  let got = tokens(answer, lang);
  if (!got.length) return { ok: false };
  let vs = variants(expected, lang, prompt);

  /* A sentence's first word is capitalised by position, not grammar —
     don't count "wie heißt du?" as a capitals mistake. */
  if (lang !== "en" && /[.?!]$/.test(String(expected).trim())) {
    const soften = seq => (seq.length && seq[0] !== WILD ? [seq[0].toLowerCase(), ...seq.slice(1)] : seq);
    got = soften(got);
    vs = vs.map(soften);
  }
  const any = eq => vs.some(v => seqMatch(v, got, eq));

  if (any((a, b) => a === b)) return { ok: true };

  if (lang === "en") {
    if (any((a, b) => a === b || (a.length >= 5 && lev1(a, b)))) {
      return { ok: true, tip: "Right — just watch the spelling." };
    }
    return { ok: false };
  }

  const lower = (a, b) => a.toLowerCase() === b.toLowerCase();
  if (lang === "de") {
    if (any((a, b) => a === translit(b) || translit(a) === b)) {
      return { ok: true, tip: "Correct — next time use the ä ö ü ß buttons." };
    }
    if (any(lower) || any((a, b) => lower(translit(a), translit(b)))) {
      return { ok: false, near: "case", tip: "Check your capital letters — German nouns always start with a capital." };
    }
    if (any((a, b) => bare(a) === bare(b))) {
      return { ok: false, near: "accents", tip: "Check the umlauts (ä ö ü) and ß." };
    }
    return { ok: false };
  }

  /* French and other languages: capitals don't count, accents do */
  if (any(lower)) return { ok: true };
  if (any((a, b) => bare(a) === bare(b))) {
    return { ok: false, near: "accents", tip: "Check the accents." };
  }
  return { ok: false };
}

/* Text to hand to speech synthesis: no brackets of plural endings,
   no "…", alternatives read as a list, "1. (ersten)" → "ersten". */
export function speakable(text) {
  return String(text ?? "")
    .replace(/\d+\.\s*\(([^)]+)\)/g, "$1")
    .replace(/\d+[:.]\d+\s*Uhr\s*\(([^)]+)\)/g, "$1")
    .replace(/\((?:[-–][^)]*|–)\)/g, "")
    .replace(/\(([^)]*\.)\)/g, "")
    .replace(/[()]/g, "")
    .replace(/\.{3}|…/g, " ")
    .replace(/\s*\/\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

/* Can this target-language answer be typed from listening alone? */
export function listenable(text) {
  return !/[/…]|\.\.\./.test(text);
}
