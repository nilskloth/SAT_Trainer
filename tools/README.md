# Content authoring pipeline (offline)

These scripts generate and validate KS2 SATs content **at author time** and write it into
the app's existing JSON schemas. They are **not** part of the deployed static site — the
live app stays vanilla JS with no build step. This folder is the only place Node is used.

## Setup (once)

```bash
cd tools
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # your key; used only locally, never shipped
```

## Validate existing (or edited) content

No API key needed. Encodes the guardrails from `CLAUDE.md`:

```bash
node validate.mjs all          # validate every data file
node validate.mjs grammar ../data/banks/grammar.json
node validate.mjs prefixes ../data/training/prefixes.json
```

- **grammar** — checks token-index answers are in range (`sentence.split(" ")`), for both the
  index-style topics and the `roles` (active/passive voice) topics.
- **prefixes** — structural checks are errors; distractor word-collisions are *warnings*
  (the system dictionary over-reports archaic words, so a human confirms each).
- **reading / reasoning** — schema, id uniqueness, mark totals, and flags question types the
  runner can't auto-mark.

## Generate new content (needs API key)

Uses Claude (`claude-opus-4-8`, structured outputs) and validates before writing. Output is a
standalone JSON file — nothing touches live data until you `merge`.

```bash
# 2 reading tests for set C, saved to a review file
node generate.mjs reading --set C --count 2 --out new-reading.json

# 10 rounding reasoning questions
node generate.mjs reasoning --strand rounding --count 10 --out new-reasoning.json
```

Reasoning strands: `large_numbers place_value ordering rounding negative roman`.

## Review, then merge

Open the generated file, sanity-check the content, then merge it in. Merge refuses on id
collisions or validation errors and backs up the target to `<file>.bak`:

```bash
node merge.mjs reading   new-reading.json   ../data/training/reading.json --dry-run
node merge.mjs reading   new-reading.json   ../data/training/reading.json
node merge.mjs reasoning new-reasoning.json ../data/training/reasoning.json
```

Then deploy the changed JSON via SFTP as usual.

## Notes

- Reading generation produces auto-markable types only (`short`, `mcq`, `tick2`, `truefalse`).
  Free-writing (`open`) questions are authored/marked separately (runtime AI-marking, Track 3).
- The generator assigns `id`/`num`/`set`/`testNumber` itself, so ids stay consistent.
