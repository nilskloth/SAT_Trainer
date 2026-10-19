/* =========================================================
   Tests for js/core/vocab-match.js.
   Usage: node tools/test-vocab.mjs
   1. Every entry in data/content/secondary/*.json accepts its
      own printed answer, in both directions.
   2. Hand-written cases for each matching rule.
   ========================================================= */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkAnswer, speakable, fillGap, articleSlip } from "../js/core/vocab-match.js";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "content", "secondary");
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log("✗", msg); } };

/* 1. Self-acceptance across all imported lists */
for (const f of readdirSync(DIR).filter(f => f.endsWith(".json"))) {
  const bank = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  const lang = bank.language;
  for (const ch of bank.chapters) for (const s of ch.sections) for (const it of s.items) {
    ok(checkAnswer(it.en, it.en, { lang: "en", prompt: it[lang] }).ok, `${f} en self: ${it.en}`);
    ok(checkAnswer(it[lang], it[lang], { lang, prompt: it.en }).ok, `${f} ${lang} self: ${it[lang]}`);
    if (it.context) {
      const full = fillGap(it.context[lang], it[lang]);
      const fullEn = fillGap(it.context.en, it.en);
      ok(checkAnswer(full, full, { lang }).ok, `${f} ${lang} full sentence: ${full}`);
      ok(checkAnswer(fullEn, fullEn, { lang: "en" }).ok, `${f} en full sentence: ${fullEn}`);
    }
  }
}

/* 2. Rules */
const cases = [
  // [expected, answer, lang, prompt, wantOk, wantNear?]
  ["Hello!/Hi!", "hi", "en", "Hallo!", true],
  ["Hello!/Hi!", "hello", "en", "Hallo!", true],
  ["What’s your name?", "what is your name", "en", "Wie heißt du?", true],
  ["What’s your name?", "Whats your name?", "en", "Wie heißt du?", true],
  ["I am ... years old.", "I am 12 years old", "en", "", true],
  ["I am ... years old.", "I am years old", "en", "", true],
  ["I am ... years old.", "I am old", "en", "", false],
  ["(Julia) is … years old.", "Julia is 11 years old", "en", "", true],
  ["(and) also", "also", "en", "(und) auch", true],
  ["(and) also", "and also", "en", "(und) auch", true],
  ["fairly, quite", "quite", "en", "ziemlich", true],
  ["Fine, thanks. And you?", "fine", "en", "Gut, danke. Und dir?", false],
  ["My favourite sport is …", "my favorite sport is football", "en", "", true],
  ["a computer", "computer", "en", "einen Computer", true],
  ["run (fast)", "to run fast", "en", "(schnell) laufen", true],
  ["He/She/It lives in ...", "she lives in London", "en", "", true],
  ["Not me!/That’s not what I think!", "that is not what I think", "en", "", true],
  ["my stepbrother/ half-brother", "my half brother", "en", "", true],
  ["teacher(s) (female)", "teacher", "en", "", true],
  ["teacher(s) (female)", "teachers", "en", "", true],
  ["friendly", "freindly", "en", "", true],
  ["lazy", "lady", "en", "", false],
  ["There is .../There are ...", "there are", "en", "", true],
  ["At 8.30.", "at 8:30", "en", "", true],
  ["1", "1", "en", "eins", true],

  ["Wie heißt du?", "wie heißt du", "de", "", true],
  ["Wie heißt du?", "Wie heisst du?", "de", "", true],
  ["Tschüs!", "Tschues", "de", "", true],
  ["Tschüs!", "Tschus", "de", "", false, "accents"],
  ["einen Fußball", "einen fussball", "de", "", false, "case"],
  ["einen Fußball", "einen Fußball", "de", "", true],
  ["der Tisch(-e)", "der Tisch", "de", "", true],
  ["der Tisch(-e)", "die Tisch", "de", "", false],
  ["Er/Sie/Es wohnt in …", "Sie wohnt in Berlin", "de", "", true],
  ["…England", "England", "de", "", true],
  ["Montag (Mo.)", "Montag", "de", "", true],
  ["(und) auch", "und auch", "de", "", true],
  ["Wie geht’s?", "Wie gehts", "de", "", true],
  ["Wie geht’s?", "Wie geht's?", "de", "", true],
  ["zwölf", "zwolf", "de", "", false, "accents"],
  ["Ich bin (sehr/ziemlich/nicht sehr) sportlich.", "Ich bin nicht sehr sportlich", "de", "", true],
  ["Ich bin (sehr/ziemlich/nicht sehr) sportlich.", "Ich bin sportlich", "de", "", true],
  ["Ich habe (heute) Geburtstag.", "Ich habe Geburtstag", "de", "", true],
  ["", "x", "de", "", false],
  ["Hallo!", "", "de", "", false],

  ["Je m'appelle …", "je m'appelle Lucie", "fr", "", true],
  ["le collège", "le college", "fr", "", false, "accents"],
  ["le collège", "Le collège", "fr", "", true]
];

for (const [exp, ans, lang, prompt, wantOk, wantNear] of cases) {
  const r = checkAnswer(exp, ans, { lang, prompt });
  ok(r.ok === wantOk && (wantNear === undefined || r.near === wantNear),
    `${lang} "${ans}" vs "${exp}" → ${JSON.stringify(r)}`);
}

/* 3. Openers */
[
  [["Ich habe …", "einen iPod"], "Ich habe einen iPod"],
  [["Ich wohne in …", "…der Schweiz"], "Ich wohne in der Schweiz"],
  [["I live in ...", "Switzerland"], "I live in Switzerland"],
  [["Er/Sie hat …", "blaue/braune/grüne/graue Augen"], "Er/Sie hat blaue/braune/grüne/graue Augen"]
].forEach(([[a, b], want]) => ok(fillGap(a, b) === want, `fillGap("${a}", "${b}") → "${fillGap(a, b)}"`));
ok(checkAnswer(fillGap("Er/Sie hat …", "blaue/braune/grüne/graue Augen"), "Sie hat grüne Augen", { lang: "de" }).ok, "full hair sentence");
ok(!checkAnswer("einen iPod", "ein iPod", { lang: "de" }).ok, "ein iPod is wrong after Ich habe");
ok(articleSlip("einen iPod", "ein iPod") === "einen", "article slip einen");
ok(articleSlip("eine Gitarre", "ein Gitarre") === "eine", "article slip eine");
ok(articleSlip("Ich wohne in …", "Ich wohne in") === null, "no slip with gap");
ok(articleSlip("…der Schweiz", "die Schweiz") === "der", "article slip der (dative)");
ok(articleSlip("eine Gitarre", "eine Geige") === null, "different noun is not a slip");
ok(articleSlip("einen Hund", "einen Hund") === null, "identical is not a slip");

/* 4. Speech text */
[
  ["der Tisch(-e)", "der Tisch"],
  ["der Stuhl(-¨e)", "der Stuhl"],
  ["das Poster(–)", "das Poster"],
  ["am 1. (ersten) Januar", "am ersten Januar"],
  ["Um 8:30 Uhr (acht Uhr dreißig).", "Um acht Uhr dreißig."],
  ["Er/Sie/Es wohnt in …", "Er, Sie, Es wohnt in"],
  ["Montag (Mo.)", "Montag"],
  ["(und) auch", "und auch"]
].forEach(([t, want]) => ok(speakable(t) === want, `speakable("${t}") → "${speakable(t)}"`));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
