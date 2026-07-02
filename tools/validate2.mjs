/* =========================================================
   Validate v2 content in data/content/ against the schema.
   Usage: node tools/validate2.mjs
   Exit code 1 on any error.
   ========================================================= */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateReadingBank, validateGpsBank, validateMathsBank,
  validateSpellingBank, validatePapers
} from "./lib/schema-v2.mjs";

const CONTENT = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "content");
const load = f => JSON.parse(readFileSync(join(CONTENT, f), "utf8"));

const checks = [
  ["reading.json", validateReadingBank],
  ["gps.json", validateGpsBank],
  ["maths.json", validateMathsBank],
  ["spelling.json", validateSpellingBank],
  ["papers.json", validatePapers]
];

let failed = false;
for (const [file, validate] of checks) {
  let bank;
  try {
    bank = load(file);
  } catch (err) {
    console.error(`✗ ${file}: ${err.message}`);
    failed = true;
    continue;
  }
  const { errors, warnings } = validate(bank);
  warnings.forEach(w => console.warn(`  warn ${file}: ${w}`));
  if (errors.length) {
    failed = true;
    console.error(`✗ ${file}: ${errors.length} errors`);
    errors.slice(0, 25).forEach(e => console.error(`    ${e}`));
  } else {
    console.log(`✓ ${file}${warnings.length ? ` (${warnings.length} warnings)` : ""}`);
  }
}

process.exit(failed ? 1 : 0);
