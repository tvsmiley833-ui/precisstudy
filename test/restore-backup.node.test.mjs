import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

test("restore script turns NDJSON backups into wrangler bulk files, optionally for one student", () => {
  const dir = mkdtempSync(join(tmpdir(), "bk-")), out = join(dir, "out");
  writeFileSync(join(dir, "progress-00000.ndjson"), [
    JSON.stringify({ key: "progress:a@x.com", value: '{"streak":1}', metadata: null }),
    JSON.stringify({ key: "progress:b@x.com", value: "{}", metadata: null }),
    JSON.stringify({ key: "reqfile:1:0", base64: "AAEC", metadata: { filename: "a.pdf" } }),
  ].join("\n") + "\n");
  execFileSync("node", ["scripts/restore-backup.mjs", dir, out, "--only", "progress:a@x.com"]);
  const files = readdirSync(out);
  assert.deepEqual(files, ["progress-0.json"]);
  assert.deepEqual(JSON.parse(readFileSync(join(out, files[0]), "utf8")), [{ key: "progress:a@x.com", value: '{"streak":1}' }]);
  execFileSync("node", ["scripts/restore-backup.mjs", dir, join(dir, "all")]);
  assert.equal(JSON.parse(readFileSync(join(dir, "all", "progress-0.json"), "utf8")).length, 3);
});
