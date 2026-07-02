# KS2 SATs Trainer v2 — Rebuild Plan

Decided 2026-07-02. v1 archived as git tag `v1-final` / branch `v1-archive`; live v1 will be
copied to `sats-trainer-old/` on the server at switchover.

## Why rebuild
1. **Marking**: static keyword matching mis-marks nuanced written answers; `open` questions
   always score 0. Complex answers must be judged properly.
2. **Content standards**: generated stories/questions must adhere to the official STA
   test frameworks (UK KS2 SATs).
3. **Design**: calm, exam-focused, paper-like aesthetic; a Year 6 child drives sessions
   independently; parent checks progress afterwards.

## Locked decisions
- Vanilla JS ES modules, **no framework, no build step** (hard constraint).
- Strato shared hosting; deploy = SFTP upload. PHP available.
- **AI access via a small PHP proxy** (`api/`), key server-side, never in the browser.
  Strict op whitelist — never a freeform prompt relay. Shared-secret token entered once
  in Settings by the parent.
- **Hybrid marking**: deterministic local marking for objective types; AI marking (via
  proxy) for free-text; graceful **self-marking fallback** (mark-scheme tick-list) when
  offline — the app must be fully usable without the API.
- localStorage persistence (`ks2_sats_v2`), one-time import from v1 keys.

## SATs standards to encode
- **Reading**: 1 paper, 60 min, 50 marks, 3 texts (1800–2300 words, ≥1 fiction + ≥1
  non-fiction). Domains 2a word meaning · 2b retrieve · 2c summarise · 2d inference
  (most marks, ~24) · 2e predict · 2f structure · 2g language choice · 2h compare.
  Mark schemes list "acceptable points"; 2–3-mark questions need multiple points or
  point + evidence.
- **GPS**: Paper 1 45 min / 50 marks, domains G1 word classes … G7 Standard English,
  G5 punctuation ≈⅓ of marks. Paper 2: 20-word spelling.
- **Maths**: Paper 1 arithmetic 30 min/40 marks; Papers 2+3 reasoning 40 min/35 marks
  each; 75–85 % of marks from Number/Ratio/Algebra.

## v2 layout

```
index.html            # v2 shell (index2.html until switchover)
css/theme.css         # tokens   css/paper.css  # SATs-paper rendering   css/app.css  # chrome
js/core/   app boot+hash router, store.js (v2+v1 import), loader.js, schema.js,
           marking.js (mark() dispatcher, DOM-free), ai.js (proxy client), utils.js
js/render/ question.js (per-type paper-style renderers), passage.js, selfmark.js
js/views/  home.js, paper.js, practice.js, spelling.js, division.js, progress.js
js/gen/    generate.js
data/content/  manifest.json, reading.json, gps.json, spelling.json, maths.json, papers.json
api/       proxy.php, prompts.php, ratelimit.php, config.example.php (real config.php NOT
           in git), .htaccess (deny config.php + state/), state/ (usage counters, log)
tools/     migrate.mjs (v1→v2), generate.mjs / validate.mjs / merge.mjs retargeted,
           lib/validators.mjs (v2 schema, single source of truth), test-marking.mjs
```

`tools/lib/validators.mjs` (Node) and `js/core/schema.js` (browser) implement the same
schema; the browser one validates fetched banks and AI-generated content before use.

## v2 question schema (unified)

```json
{
  "id": "rd-2d-0031", "subject": "reading|gps|maths|spelling",
  "domain": "2d | G5 | 6C7a | S", "strand": "number|ratio|algebra|measure|geometry|stats",
  "type": "see registry", "marks": 2, "marking": "auto|ai",
  "stem": "HTML", "passageId": "p-003",
  "...type-specific answer fields (accept[], answer, answers[], order[], statements[], tokenIndices[], validator)",
  "markScheme": {
    "acceptablePoints": [{ "point": "…", "evidence": ["'…'"] }],
    "award": { "1": "one acceptable point", "2": "two points, or one point plus evidence" },
    "doNotAccept": ["…"], "modelAnswer": "…"
  },
  "meta": { "source": "migrated:…", "author": "v1|generated", "added": "2026-07-02" }
}
```

**Type registry** — auto: `mcq tick2 truefalse factopin match order circle2 short-closed
numeric multi pairs tokens spelling prefix`; AI-marked (self-mark fallback): `short
multishort open`. Every question carries domain + marks + markScheme (auto types get
modelAnswer + award so solution display and self-mark are uniform).

Passages: `{id,title,genre,wordCount,source,text}`. Paper blueprints in papers.json:
domain quota tables per paper (marks-weighted), text rules, timings.

## Marking engine (js/core/marking.js)
- `mark(q, answer)` sync dispatcher → `{earned, possible}` or `{status:"needs-ai"}`.
- Deterministic markers ported from v1 (reading.js scoreQuestion branches, arithmetic
  comma normalisation, algebra PAIR_VALIDATORS, grammar token sets, spelling).
  v1 `wordsMatch` fuzzy overlap is **deleted** — anything fuzzy becomes `marking:"ai"`.
- `markAI` posts `{token, op:"mark", payload:{stem, marks, markScheme, answer,
  passageExcerpt?}}`; response schema-validated before marks recorded; batched with a
  progress indicator at Check time.
- Fallback chain: fetch fail / 8 s timeout / rate_limited → self-mark UI (acceptable
  points as checklist, marks computed from ticks per award rules, attempt flagged
  `marking:"self"`).

## PHP proxy (api/)
- Ops: `mark` (claude-sonnet-5, max_tokens 1024, structured output {marks, feedback,
  matchedPoints[]}), `generate-passage` / `generate-gps-set` / `generate-maths-set`
  (claude-opus-4-8, schema-constrained), `ping` (no upstream; returns quota remaining).
- Anti-abuse: hash_equals token, 32 KB payload cap, op whitelist, server-side prompts +
  max_tokens, daily caps in state/usage.json under flock (mark 150/day, generate 8/day,
  20 req/min), append-only state/log.jsonl {ts, op, in_tokens, out_tokens}.
- Raw curl to api.anthropic.com (x-api-key + anthropic-version), no SDK. Check
  stop_reason; set_time_limit(120). Uniform error shape
  `{ok:false, error:{code, message, retryAfter?}}`.

## Runtime generation
Generate → validate client-side (retry once) → store as bank addition in
`ks2_banks_v2`, merged over shipped JSON at boot (additive by ID). Export/import in
parent view; tools/merge.mjs promotes good content into shipped files.

## UI (calm exam-focused, child-first)
Hash-routed views: **Home** (Today's practice from weakest domains + subject cards,
one quiet status line) · **Paper runner** (paper-style: off-white sheet, numbered boxes,
marks badges, ruled answer lines, split passage pane, quiet timer) · **Practice**
(domains in child-friendly words, hosts all ported trainers) · **Results** (tick/partial/
cross, AI feedback sentence, self-mark cards) · **Progress** behind "Grown-ups" link
(domain mastery, timeline to May 2027, AI usage log, settings, bank import/export).
Design: cream paper on muted cool background, near-black ink, single accent, humanist
serif for passages + clean sans UI. Run frontend-design skill before writing theme.css.

## Store (ks2_sats_v2)
settings {proxyToken, dailyMinutes, examDate:"2027-05-11"} · attempts[] with per-item
{qid, domain, subject, marks, earned, marking} · domainStats EWMA per domain (drives
Today's practice) · spelling.wordsByWord imported verbatim from v1 · generatedBanks.

## Phases
| # | Scope | Size | Milestone |
|---|---|---|---|
| 0 | Archive, skeleton, router shell, store v2 | S | index2.html renders shell |
| 1 | v2 validators + migrate.mjs (all v1 content incl. warmup) | M | validate green, counts match v1 |
| 2 | marking.js + paper renderers + runner + self-mark UI + arithmetic gen | L | Reading/GPS/Arithmetic papers playable |
| 3 | PHP proxy + ai.js + AI marking live | M | curl suite green on Strato; offline → self-mark |
| 4 | All trainers ported + Today's practice | L | parity with v1 Training |
| 5 | Runtime generation + bank merge + tools retarget | M | "New reading test" playable |
| 6 | domainStats, progress view, v1 import | M | parent sees mastery + spend |
| 7 | Polish, live trial sats-trainer-new/, switchover | S | v2 live, v1 at /sats-trainer-old/ |

Self-mark fallback lands in Phase 2 *before* the proxy so AI is a pure enhancement.

## Verification
Local `python3 -m http.server` per phase; `node tools/validate.mjs` green on content
changes; Phase 1 migration diff report (counts + guessed-domain CSV for review);
Phase 2 `tools/test-marking.mjs` fixtures per type; Phase 3 curl suite (bad token,
unknown op, oversize, real mark, cap breach, config.php/state not servable) + DevTools
offline test; Phase 5 generate 3 passages + spot-read for STA fidelity; Phase 7 full
paper on child device + v1 import + archive reachable.

## Risks
Strato PHP execution limits vs Opus generation time (verify set_time_limit; fallback
sonnet) · config.php inside docroot (htaccess deny + pure-PHP + live curl check; move
above docroot if possible) · token burn (server caps + parent log + generation behind
Grown-ups) · AI leniency drift (parent spot-check flags) · migrated domain codes are
guesses (manual review pass in Phase 1) · never add a freeform-prompt op.
