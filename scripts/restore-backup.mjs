#!/usr/bin/env node
// Turns a downloaded backup day into files `wrangler kv bulk put` can load.
//
//   1. Download the day's objects:   npx wrangler r2 object get <bucket>/backups/2026-10-04/progress-00000.ndjson --file backup/progress-00000.ndjson   (repeat per object)
//   2. Convert:                      node scripts/restore-backup.mjs backup/ out/ [--only prefix]
//   3. Load one namespace:           npx wrangler kv bulk put out/progress-0.json --namespace-id <PROGRESS id>
//
// Nothing is written to KV by this script. --only keeps just keys with that prefix (restore one student: --only progress:kid@example.com).
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const [inDir, outDir, ...rest] = process.argv.slice(2);
if (!inDir || !outDir) { console.error("usage: restore-backup.mjs <dir with .ndjson files> <output dir> [--only <key prefix>]"); process.exit(1); }
const only = rest[0] === "--only" ? rest[1] : "";
mkdirSync(outDir, { recursive: true });

const PER_FILE = 10000; // wrangler's bulk limit
const byNs = {};
for (const f of readdirSync(inDir).filter(n => n.endsWith(".ndjson")).sort()) {
  const ns = f.split("-")[0];
  for (const line of readFileSync(join(inDir, f), "utf8").split("\n")) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    if (only && !row.key.startsWith(only)) continue;
    (byNs[ns] ||= []).push(row.base64 !== undefined ? { key: row.key, value: row.base64, base64: true } : { key: row.key, value: row.value });
  }
}
let files = 0;
for (const [ns, rows] of Object.entries(byNs)) {
  for (let i = 0; i < rows.length; i += PER_FILE) {
    writeFileSync(join(outDir, `${ns}-${i / PER_FILE}.json`), JSON.stringify(rows.slice(i, i + PER_FILE)));
    files++;
  }
  console.log(`${ns}: ${rows.length} keys`);
}
console.log(`wrote ${files} file(s) to ${outDir}`);
