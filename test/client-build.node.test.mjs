// The scripts students load (public/shared/personality.js, public/shared/guide-app.js) are built from the
// readable sources in client/ by `npm run build:client` (which also runs before every deploy). If someone
// edits client/ and forgets to rebuild, the site would keep serving stale code. This fails until they do.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const esbuild = join(root, "node_modules/.bin/esbuild");

// Must match the flags in package.json's build:client script.
const TARGETS = [
  { src: "client/personality.js", out: "public/shared/personality.js", flags: ["--format=esm", "--target=es2022"] },
  { src: "client/guide-app.js", out: "public/shared/guide-app.js", flags: ["--target=es2020"] },
];

for (const t of TARGETS) {
  test(`${t.out} is up to date with ${t.src} (run: npm run build:client)`, () => {
    const dir = mkdtempSync(join(tmpdir(), "client-build-"));
    try {
      const built = join(dir, "out.js");
      execFileSync(esbuild, [t.src, "--minify", ...t.flags, "--legal-comments=none", "--tsconfig-raw={}", `--outfile=${built}`, "--log-level=error"], { cwd: root });
      assert.equal(readFileSync(join(root, t.out), "utf8"), readFileSync(built, "utf8"), `${t.out} is stale: run npm run build:client and commit the result`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test("the built guide script keeps top-level function names that inline onclick handlers call", () => {
  const built = readFileSync(join(root, "public/shared/guide-app.js"), "utf8");
  for (const name of ["switchTab", "rateFC", "ssToggleDyslexia", "ssToggleFocusMode", "jumpToUnit", "ssOpenVoiceDialog", "toggleFcMode"]) {
    assert.ok(new RegExp(`function ${name}\\(`).test(built), `${name} was renamed or dropped by the minifier`);
  }
  assert.ok(!built.startsWith('"use strict"'), "the build must not force strict mode (it would change how the original code runs)");
});
