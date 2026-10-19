/* =========================================================
   Writes a deploy copy of index.html in which every JS module
   is requested as "<file>?v=<version>", via an import map.
   A browser can then never combine a new module with an old
   cached copy of another one (Safari kept July's files and
   failed with "Importing binding name … is not found").
   The repo's index.html stays unversioned for local work.

   Usage: node tools/build-index.mjs <version> <out-file>
   ========================================================= */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [version, out] = process.argv.slice(2);
if (!version || !out) {
  console.error("Usage: node tools/build-index.mjs <version> <out-file>");
  process.exit(1);
}

const jsFiles = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith(".js")) jsFiles.push(relative(ROOT, p).split("\\").join("/"));
  }
})(join(ROOT, "js"));

const imports = Object.fromEntries(jsFiles.sort().map(f => [`./${f}`, `./${f}?v=${version}`]));
const map = `<script type="importmap">\n${JSON.stringify({ imports }, null, 2)}\n  </script>\n  `;

let html = readFileSync(join(ROOT, "index.html"), "utf8");
const entry = '<script type="module" src="js/core/app.js"></script>';
if (!html.includes(entry)) throw new Error("index.html: module entry script not found");
html = html
  .replace(entry, `${map}<script type="module" src="js/core/app.js?v=${version}"></script>`)
  .replace(/href="(css\/[^"]+\.css)"/g, `href="$1?v=${version}"`);

writeFileSync(out, html);
console.log(`index.html → ${out} (${jsFiles.length} modules, v=${version})`);
