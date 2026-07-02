#!/usr/bin/env node
/* =========================
   Validate a KS2 SATs data file against its schema/guardrails.

   Usage:
     node tools/validate.mjs reading   data/training/reading.json
     node tools/validate.mjs reasoning data/training/reasoning.json
     node tools/validate.mjs grammar   data/banks/grammar.json
     node tools/validate.mjs prefixes  data/training/prefixes.json
     node tools/validate.mjs all        # validate every known file at default paths

   Exit code is non-zero if any errors (not warnings) are found.
========================= */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VALIDATORS } from "./lib/validators.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_PATHS = {
  reading: "data/training/reading.json",
  reasoning: "data/training/reasoning.json",
  grammar: "data/banks/grammar.json",
  prefixes: "data/training/prefixes.json",
};

function validateOne(kind, file) {
  const validate = VALIDATORS[kind];
  if (!validate) { console.error(`Unknown kind "${kind}". Known: ${Object.keys(VALIDATORS).join(", ")}`); return 2; }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`✗ ${kind}: cannot read/parse ${file}: ${err.message}`);
    return 1;
  }

  const { errors, warnings } = validate(data);
  const rel = path.relative(ROOT, path.resolve(file)) || file;
  warnings.forEach(w => console.warn(`  ⚠ ${w}`));
  if (errors.length) {
    errors.forEach(e => console.error(`  ✗ ${e}`));
    console.error(`✗ ${kind} (${rel}): ${errors.length} error(s), ${warnings.length} warning(s)`);
    return 1;
  }
  console.log(`✓ ${kind} (${rel}): OK${warnings.length ? ` (${warnings.length} warning(s))` : ""}`);
  return 0;
}

function main() {
  const [kind, file] = process.argv.slice(2);
  if (!kind) {
    console.error("Usage: node tools/validate.mjs <reading|reasoning|grammar|prefixes|all> [file]");
    process.exit(2);
  }

  let code = 0;
  if (kind === "all") {
    for (const [k, p] of Object.entries(DEFAULT_PATHS)) {
      code = Math.max(code, validateOne(k, path.join(ROOT, p)));
    }
  } else {
    const target = file || path.join(ROOT, DEFAULT_PATHS[kind] || "");
    code = validateOne(kind, target);
  }
  process.exit(code);
}

main();
