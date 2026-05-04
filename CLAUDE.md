# KS2 SATs Practice Runner — CLAUDE.md

## What this project is
A fully client-side web app for Year 6 (KS2) SATs preparation. No backend — all data is JSON files fetched at startup, all state stored in `localStorage`. Live at **https://6oclock.net/sats-trainer/**.

Hosted on Strato shared hosting via SFTP. Deploy by uploading changed files — no build step.

---

## Tech stack
- Vanilla JS (ES modules), HTML5, CSS3
- No framework, no bundler
- `localStorage` key: `ks2_sats_runner_v1`
- Web Speech API for spoken spelling mode
- Must be served via HTTP(S) — ES modules block on `file://`

---

## File structure

```
sats-trainer/
├── index.html                  # Single-page app, all UI defined here
├── css/styles.css              # All styles
├── js/
│   ├── app.js                  # Bootstrap: loads data, inits all modules
│   ├── loader.js               # Fetches all JSON in parallel, validates
│   ├── store.js                # localStorage state management
│   ├── tabs.js                 # Top-level tab switching
│   ├── utils.js                # randInt, pickN helpers
│   ├── runner/
│   │   ├── runner.js           # Exam state machine, timer, scoring
│   │   ├── papers.js           # Paper metadata
│   │   └── render.js          # DOM factories for MCQ/short-answer questions
│   ├── training/
│   │   ├── arithmetic.js       # Random arithmetic drill generation
│   │   ├── spelling.js         # Adaptive spelling trainer, speech synthesis
│   │   ├── grammar.js          # SPaG topic tabs, token-selection tests
│   │   ├── prefixes.js         # Prefix word-pair + sentence exercises
│   │   ├── algebra.js          # Algebra question sets, pairs validator
│   │   ├── reading.js          # Reading comprehension test runner
│   │   └── reasoning.js        # Maths reasoning drill (strand filter)
│   └── stats/
│       └── stats.js            # Progress display
└── data/
    ├── papers.json             # Exam paper definitions
    ├── banks/
    │   ├── reading.json
    │   ├── spag.json
    │   ├── reasoning.json
    │   └── grammar.json        # Grammar topic data (token-based)
    └── training/
        ├── spelling.json       # Word lists with sentences
        ├── prefixes.json       # Word pairs + sentences for prefix trainer
        ├── algebra.json        # 4 sets × 10 questions
        ├── reading.json        # Reading comprehension tests (passage + questions)
        └── reasoning.json      # Maths reasoning questions by strand
```

---

## Adding a new training module — checklist

1. Create `data/training/<name>.json`
2. Create `js/training/<name>.js` — export `init<Name>()`
3. Add a `<button data-training="<name>">` to `.training-tabs` in `index.html`
4. Add a `<div class="training-panel hidden" id="training-<name>">` panel in `index.html`
5. Add the JSON fetch to `loader.js` (in the `Promise.all` array and the returned `data` object)
6. Import and call `init<Name>()` in `app.js`

The training tab switching in `app.js` is automatic — it picks up any element matching `[data-training]` and `[id^="training-"]`.

---

## Training modules

### Maths — Arithmetic (`training/arithmetic.js`)
- Generates 10 random questions per set (add/sub/mul/div)
- Difficulties: easy, y6 mix, hard
- Scoring: normalises commas (so "12,345" matches "12345")

### Maths — Algebra (`training/algebra.js`)
- 4 sets × 10 questions loaded from `algebra.json`
- Dropdown auto-loads set on change (no Load button)
- Maths sub-tabs (Arithmetic / Algebra) wired inside `initAlgebra()` via `[data-maths-tab]`
- Question types:
  - `short` — text input, normalised string match
  - `multi` — comma-separated values (sequences)
  - `mcq` — radio buttons
  - `pairs` — two number inputs, validated by named function in `PAIR_VALIDATORS`
  - `reveal` — no input, solution auto-shown when Check is pressed
- Solutions revealed for ALL questions when "Check answers" is pressed
- `PAIR_VALIDATORS` map in `algebra.js` — add new validators here for new two-unknown questions

### English — Spelling (`training/spelling.js`)
- Adaptive word selection weighted by mastery, recency, streak
- Modes: Hidden (flash), Visible, Spoken (Web Speech API)
- Progress saved per-word in `localStorage`

### English — Grammar (`training/grammar.js`)
- Data from `data/banks/grammar.json`
- Topic tabs built dynamically from JSON
- Token-based sentence selection (click words to identify parts of speech)
- Indices in `answer` arrays are zero-based word positions after `split(" ")`

### English — Prefixes (`training/prefixes.js`)
- Data from `data/training/prefixes.json`
- Two sections per round: word pairs (dropdown + root) and sentence fill-ins
- 7 word pairs + 4 sentences per round, randomly sampled
- All distractor options verified to not form valid English words with the root

### English — Reading (`training/reading.js`)
- Data from `data/training/reading.json`
- Tests grouped by set (A, B, …); selection grid shows title, genre, time, and total marks
- Each test has a full HTML passage and a list of questions
- Question types: `short`, `mcq`, `tick2` (tick two correct answers)
- Timed: timer runs while the test is active; shown in the UI
- Back button returns to the test selection grid without losing test state

### Maths — Reasoning (`training/reasoning.js`)
- Data from `data/training/reasoning.json`
- 10 random questions per set, optionally filtered by strand via dropdown
- Strands: `large_numbers`, `place_value`, `ordering`, `rounding`, `negative`, `roman`
- Question type: `short` — text input, answer matched as trimmed string
- "New set" button picks a fresh random selection; "Check answers" reveals all solutions

---

## Key data formats

### algebra.json — question object
```json
{
  "id": "s1q1",
  "type": "short | multi | mcq | pairs | reveal",
  "strand": "missing_value | substitution | sequence | formula | express | two_unknowns",
  "stem": "HTML string",
  "label": "n =",          // short only
  "answer": "17",           // short/mcq
  "answers": ["23","28"],   // multi only
  "choices": ["..."],       // mcq only
  "labels": ["a","b"],      // pairs only
  "validator": "sum10_agtb",// pairs only — key into PAIR_VALIDATORS
  "solution": "HTML string shown after Check"
}
```

### prefixes.json — word pair object
```json
{ "root": "happy", "prefix": "un", "options": ["un","dis","mis","re"] }
```
**Important:** verify that no option other than `prefix` forms a valid English word with `root` before adding.

### grammar.json — question object
```json
{
  "sentence": "The cat slept on the sofa.",
  "task": "Select all the nouns.",
  "answer": [1, 5]
}
```
Indices are zero-based positions in `sentence.split(" ")`. Punctuation stays attached to its token (e.g. "sofa." is index 5).

### reading.json — test object
```json
{
  "id": "b5",
  "set": "B",
  "testNumber": 5,
  "title": "Should We Use Tablet Computers in the Classroom?",
  "genre": "Argument",
  "minutes": 10,
  "totalMarks": 8,
  "passage": "<p>HTML passage…</p>",
  "questions": [
    {
      "id": "b5q1", "num": 1, "type": "short", "marks": 1,
      "stem": "HTML string",
      "accept": ["tablet computers"],   // short: array of accepted strings
      "solution": "tablet computers"
    },
    {
      "id": "b5q2", "num": 2, "type": "tick2", "marks": 2,
      "stem": "HTML string",
      "choices": ["option A", "option B", "option C"],
      "answers": ["option A", "option B"],  // tick2: correct choices
      "solution": "option A; option B"
    },
    {
      "id": "b5q4", "num": 4, "type": "mcq", "marks": 1,
      "stem": "HTML string",
      "choices": ["option A", "option B"],
      "answer": "option A",             // mcq: single correct choice
      "solution": "option A"
    }
  ]
}
```

### reasoning.json — question object
```json
{
  "id": "rq01",
  "strand": "large_numbers",
  "type": "short",
  "stem": "HTML string",
  "answer": "999900",
  "solution": "1,000,000 − 100 = 999,900"
}
```
Valid strands: `large_numbers`, `place_value`, `ordering`, `rounding`, `negative`, `roman`.

---

## Version control

- GitHub: `git@github.com:nilskloth/SAT_Trainer.git`
- Branch: `main`
- SSH key: `~/.ssh/id_ed25519` (ed25519, added to GitHub as Authentication Key)

```bash
git add -A && git commit -m "message" && git push origin main
```

---

## Deployment

SFTP to Strato hosting:
- Server: `5186167.ssh.w1.strato.hosting`
- User: `stu698771234`
- Remote root: `/` (home directory contains the `sats-trainer/` folder directly)

Upload individual files with `lftp`:
```bash
lftp -u stu698771234,PASSWORD sftp://5186167.ssh.w1.strato.hosting <<'EOF'
set sftp:auto-confirm yes
put ./local/file.js -o sats-trainer/remote/file.js
EOF
```

**Change the SFTP password after each session where it was shared in chat.**

---

## Known design decisions

- **No eval for validators** — pair constraints use named functions in `PAIR_VALIDATORS`, not `eval()`
- **Grammar token indices** — always recount after editing a sentence; punctuation is part of the token
- **Prefix distractors** — every distractor option must be checked: does `option + root` form a real English word? If yes, it cannot be used as a distractor
- **Arithmetic normalisation** — commas stripped before comparison so "12,345" matches "12345"
- **"whole numbers" vs "positive whole numbers"** — always use "positive whole numbers" in algebra stems to avoid 0 being a valid answer where unintended
- **Maths sub-tabs** — wired in `algebra.js` not `app.js`; initial state set programmatically to ensure Arithmetic is active on load
