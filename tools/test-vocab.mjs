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
import { checkAnswer, speakable, fillGap, articleSlip, missingArticle, checkVerbForm, verbPhrase } from "../js/core/vocab-match.js";

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

/* 1b. Verb tables: every form, alone and with its pronoun */
const VERB_DIR = join(DIR, "verbs");
const verbBanks = {};
for (const f of readdirSync(VERB_DIR).filter(f => f.endsWith(".json"))) {
  const vb = JSON.parse(readFileSync(join(VERB_DIR, f), "utf8"));
  verbBanks[vb.language] = vb;
  const ids = new Set();
  for (const v of vb.verbs) {
    ok(!ids.has(v.id) && v.forms.length === 6 && v.formsEn.length === 6, `verbs/${f} ${v.inf}: id and 6 forms`);
    ids.add(v.id);
    v.forms.forEach((form, i) => {
      ok(checkVerbForm(vb.persons, v, i, form, vb.language).ok, `verbs/${f} ${v.inf} form ${i}: ${form}`);
      const phrase = verbPhrase(vb.persons, v, i);
      ok(checkVerbForm(vb.persons, v, i, phrase, vb.language).ok, `verbs/${f} ${v.inf} phrase: ${phrase}`);
    });
  }
}
{
  const verb = id => Object.values(verbBanks).flatMap(b => b.verbs).find(v => v.id === id);
  const vc = (lang, id, i, ans) => checkVerbForm(verbBanks[lang].persons, verb(id), i, ans, lang);
  ok(vc("de", "de-v-sein", 0, "Bin").ok, "German form with a capital");
  ok(vc("de", "de-v-sein", 2, "sie ist").ok, "er/sie/es: sie ist");
  ok(vc("de", "de-v-sein", 5, "Sie sind").ok, "polite Sie sind");
  ok(vc("de", "de-v-fahren", 1, "fahrst").near === "accents", "fahrst → check umlaut");
  ok(vc("de", "de-v-fahren", 2, "faehrt").ok, "faehrt accepted");
  ok(!vc("de", "de-v-sein", 1, "bin").ok, "wrong person");
  ok(vc("fr", "fr-v-avoir", 0, "j'ai").ok, "j'ai");
  ok(vc("fr", "fr-v-avoir", 0, "ai").ok, "ai alone");
  ok(!vc("fr", "fr-v-avoir", 0, "je ai").ok, "je ai is wrong");
  ok(vc("fr", "fr-v-etre", 4, "etes").near === "accents", "etes → check accents");
  ok(vc("fr", "fr-v-s-appeler", 0, "je m'appelle").ok, "je m'appelle");
  ok(vc("fr", "fr-v-s-appeler", 3, "nous nous appelons").ok, "nous nous appelons");
  ok(!vc("fr", "fr-v-aimer", 5, "aime").ok, "ils aime is wrong");
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

  ["am 1. (ersten) Januar", "Am 1. Januar", "de", "", true],
  ["am 1. (ersten) Januar", "am ersten Januar", "de", "", true],
  ["am 1. (ersten) Januar", "am 1 Januar", "de", "", true],
  ["am 1. (ersten) Januar", "am 1. ersten Januar", "de", "", false],
  ["am 29. (neunundzwanzigsten) Juni", "am neunundzwanzigsten Juni", "de", "", true],
  ["am 3. (dritten) Februar", "am dritte Februar", "de", "", false],
  ["Um 8:30 Uhr (acht Uhr dreißig).", "Um acht Uhr dreißig", "de", "", true],
  ["Um 8:30 Uhr (acht Uhr dreißig).", "Um 8:30 Uhr", "de", "", true],
  ["Es ist 9:50 Uhr (neun Uhr fünfzig).", "Es ist neun Uhr fünfzig.", "de", "", true],
  ["(Julia) ist … Jahre alt.", "Julia ist 11 Jahre alt.", "de", "", true],
  ["am 1. (ersten) Januar", "am 1. (ersten) Januar", "de", "", true],
  ["der Tisch(-e)", "Der Tisch", "de", "", true],
  ["schwarz", "Schwarz", "de", "", false, "case"],
  ["einen Fußball", "Einen fußball", "de", "", false, "case"],
  ["on 1 January", "on 1st January", "en", "", true],
  ["on 3 February", "on the 3rd February", "en", "", true],
  ["Je m'appelle …", "je m'appelle Lucie", "fr", "", true],
  ["le collège", "le college", "fr", "", false, "accents"],
  ["le collège", "Le collège", "fr", "", true],
  ["J’aime …", "j'aime le sport", "fr", "", true],
  ["Je n’aime pas …", "Je n'aime pas les serpents", "fr", "", true],
  ["Quel âge as-tu ?", "quel age as-tu?", "fr", "", false, "accents"],
  ["Quel âge as-tu ?", "Quel âge as tu", "fr", "", true],
  ["J’ai onze ans.", "J'ai onze ans", "fr", "", true],
  ["des élèves", "des eleves", "fr", "", false, "accents"],
  ["(some) students", "students", "en", "des élèves", true],
  ["I am very friendly./I am very nice.", "I'm very nice", "en", "", true],
  ["I also like sport./I like sport too.", "I like sport too", "en", "", true],
  ["I don’t like …", "I do not like snakes", "en", "", true]
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
ok(articleSlip("la musique", "le musique", "fr") === "la", "French article slip la");
ok(articleSlip("les pizzas", "des pizzas", "fr") === "les", "French article slip les");
ok(missingArticle("les pizzas", "pizzas", "fr") === "les", "French missing article");
ok(missingArticle("le poisson", "poisson", "fr") === "le", "French missing article le");
ok(missingArticle("der Tisch(-e)", "Tisch", "de") === "der", "German missing article");
ok(missingArticle("très", "tres", "fr") === null, "no article to miss");
ok(missingArticle("pas très", "très", "fr") === null, "pas is not an article");

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
