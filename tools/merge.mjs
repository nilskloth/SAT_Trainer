#!/usr/bin/env node
/* =========================
   Safely merge generated content into a live data file.

   Usage:
     node tools/merge.mjs reading   generated.json data/training/reading.json [--dry-run]
     node tools/merge.mjs reasoning generated.json data/training/reasoning.json [--dry-run]

   Refuses to write on id collisions or validation errors. Backs up the target
   to <target>.bak before writing.
========================= */

import fs from "node:fs";
import { validateReading, validateReasoning } from "./lib/validators.mjs";

function readJSON(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }

function main() {
  const [kind, srcPath, targetPath, ...flags] = process.argv.slice(2);
  const dryRun = flags.includes("--dry-run");
  if (!kind || !srcPath || !targetPath) {
    console.error("Usage: node tools/merge.mjs <reading|reasoning> <generated.json> <targetFile> [--dry-run]");
    process.exit(2);
  }

  const listKey = kind === "reading" ? "tests" : kind === "reasoning" ? "questions" : null;
  const validate = kind === "reading" ? validateReading : kind === "reasoning" ? validateReasoning : null;
  if (!listKey) { console.error(`Unknown kind "${kind}" (reading|reasoning)`); process.exit(2); }

  const src = readJSON(srcPath);
  const target = readJSON(targetPath);
  const srcItems = src[listKey] || (Array.isArray(src) ? src : []);
  if (!Array.isArray(target[listKey])) { console.error(`Target has no "${listKey}" array`); process.exit(1); }

  const existingIds = new Set(target[listKey].map(x => x.id));
  const collisions = srcItems.filter(x => existingIds.has(x.id)).map(x => x.id);
  if (collisions.length) {
    console.error(`✗ id collision(s): ${collisions.join(", ")}. Rename generated items and retry.`);
    process.exit(1);
  }

  const merged = { ...target, [listKey]: [...target[listKey], ...srcItems] };
  const { errors, warnings } = validate(merged);
  warnings.forEach(w => console.warn(`  ⚠ ${w}`));
  if (errors.length) {
    errors.forEach(e => console.error(`  ✗ ${e}`));
    console.error(`✗ merged result failed validation (${errors.length} error(s)); not writing.`);
    process.exit(1);
  }

  console.log(`Adding ${srcItems.length} ${listKey} → ${target[listKey].length} + ${srcItems.length} = ${merged[listKey].length}`);
  if (dryRun) { console.log("--dry-run: nothing written."); return; }

  fs.copyFileSync(targetPath, targetPath + ".bak");
  fs.writeFileSync(targetPath, JSON.stringify(merged, null, 2) + "\n");
  console.log(`✓ wrote ${targetPath} (backup at ${targetPath}.bak)`);
}

main();
