/* =========================================================
   Typed-answer matching for vocabulary (secondary languages).
   DOM-free; exercised by tools/test-vocab.mjs.

   A printed answer such as "(Julia) is … years old." or
   "der Tisch(-e)" or "Hello!/Hi!" expands into every
   acceptable form:
     (…)        optional — with or without the bracket content;
                after a number it's the number in words: either form
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

/* A number followed by its reading in words — "am 1. (ersten) Januar",
   "Um 8:30 Uhr (acht Uhr dreißig)." — means either form, not both. */
const NUMBER_BEFORE = /(\d+(?:[.:]\d+)?\.?(?:\s+Uhr)?)\s*$/;

function parenVariants(s) {
  const m = s.match(/\([^()]*\)/);
  if (!m) return [s];
  const before = s.slice(0, m.index);
  const after = s.slice(m.index + m[0].length);
  const inner = m[0].slice(1, -1);
  const num = before.match(NUMBER_BEFORE);
  if (num && /\p{L}/u.test(inner) && !/\d/.test(inner)) {
    const lead = before.slice(0, num.index);
    return [...parenVariants(before + " " + after), ...parenVariants(lead + inner + after)];
  }
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
    out = out.map(w => (w === WILD ? w : w.split("/").map(x => UK[x] || x.replace(/^(\d+)(st|nd|rd|th)$/, "$1")).join("/")))
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
const asPrinted = s => String(s ?? "").replace(/[’‘`´]/g, "'").replace(/\.{3}/g, "…")
  .replace(/\s+/g, " ").trim().replace(/[.!?]$/, "");

export function checkAnswer(expected, answer, { lang, prompt = "" } = {}) {
  let got = tokens(answer, lang);
  if (!got.length) return { ok: false };
  /* copied exactly as printed, brackets and all */
  if (asPrinted(answer) && asPrinted(answer) === asPrinted(expected)) return { ok: true };
  let vs = variants(expected, lang, prompt);

  /* Starting a phrase with a capital ("Am 1. Januar") is fine; a single
     word keeps its case ("essen" ≠ "Essen"). */
  if (lang !== "en" && got.length > 1) {
    const cap = w => w.charAt(0).toUpperCase() + w.slice(1);
    vs = vs.flatMap(v => (v.length > 1 && typeof v[0] === "string" && v[0] !== cap(v[0]) ? [v, [cap(v[0]), ...v.slice(1)]] : [v]));
  }

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

/* Articles and possessives: German endings carry the case, French
   ones the gender and number. */
const DETERMINERS = {
  de: new Set(("ein eine einen einem einer eines kein keine keinen keinem keiner keines " +
    "der die das den dem des mein meine meinen meinem meiner meines dein deine deinen deinem deiner deines").split(" ")),
  fr: new Set("le la les un une des du de mon ma mes ton ta tes son sa ses".split(" "))
};
const isDeterminer = (w, lang) => !!DETERMINERS[lang]?.has(String(w).toLowerCase());

/*
 * If the answer is right except for one article ("ein Gitarre" for
 * "eine Gitarre"), return the article that was needed; otherwise null.
 */
export function articleSlip(expected, answer, lang = "de") {
  const got = tokens(answer, lang).map(w => String(w).toLowerCase());
  for (let v of variants(expected, lang)) {
    if (v[0] === WILD) v = v.slice(1);            // "…der Schweiz": the gap is the opener's
    if (v.length !== got.length || v.includes(WILD)) continue;
    const diffs = v.map((w, i) => (w.toLowerCase() === got[i] ? -1 : i)).filter(i => i >= 0);
    if (diffs.length === 1 && isDeterminer(v[diffs[0]], lang) && isDeterminer(got[diffs[0]], lang)) {
      return v[diffs[0]];
    }
  }
  return null;
}

/*
 * If the answer is the entry without its leading article ("pizzas"
 * for "les pizzas"), return the article that was left out; otherwise null.
 */
export function missingArticle(expected, answer, lang = "de") {
  const got = tokens(answer, lang).map(w => String(w).toLowerCase());
  for (const v of variants(expected, lang)) {
    if (v.length !== got.length + 1 || v.includes(WILD) || !isDeterminer(v[0], lang)) continue;
    if (v.slice(1).every((w, i) => bare(w) === bare(got[i]))) return v[0];
  }
  return null;
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

/* Put an entry into its opener's gap: ("Ich habe …", "einen iPod")
   → "Ich habe einen iPod"; ("Ich wohne in …", "…der Schweiz")
   → "Ich wohne in der Schweiz". */
export function fillGap(opener, piece) {
  const head = String(opener ?? "").replace(/\s*(…|\.\.\.)\s*$/, "");
  const tail = String(piece ?? "").replace(/^(…|\.\.\.)\s*/, "");
  return `${head} ${tail}`.trim();
}

/* ---------- verb tables ---------- */

/* The pronoun shown before a form: "je" elides before a vowel (j'ai). */
export function verbPronoun(persons, verb, i) {
  return i === 0 && verb.elide ? "j'" : persons[i];
}

/* Pronoun + form as one phrase: "du bist", "j'ai", "je m'appelle". */
export function verbPhrase(persons, verb, i) {
  const p = verbPronoun(persons, verb, i);
  return p.endsWith("'") ? p + verb.forms[i] : `${p} ${verb.forms[i]}`;
}

/*
 * Mark one cell of a verb table. The form alone or with its pronoun
 * both count; capitals never matter (a form can start a sentence),
 * accents and umlauts give "nearly".
 */
export function checkVerbForm(persons, verb, i, answer, lang) {
  const phrase = verbPhrase(persons, verb, i);
  if (checkAnswer(phrase, answer, { lang }).ok) return { ok: true };       // as printed: "sie/Sie sind"
  const typed = lang === "de" ? String(answer ?? "").toLowerCase() : answer;
  const alone = checkAnswer(verb.forms[i], typed, { lang });
  if (alone.ok) return alone;
  const whole = checkAnswer(phrase, typed, { lang });
  return whole.ok || (whole.near && !alone.near) ? whole : alone;
}
