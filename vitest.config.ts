import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  test: {
    // *.node.test.mjs run under `npm run test:scripts` (plain Node) because they
    // exercise build scripts that use node:fs, unavailable in the Workers pool.
    exclude: ["**/node_modules/**", "**/.claude/worktrees/**", "**/*.node.test.mjs"]
  },
  plugins: [
    cloudflareTest({
      main: "src/worker.ts",
      wrangler: { configPath: "./wrangler.test.jsonc" }
    })
  ]
});
