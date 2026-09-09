import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/.claude/worktrees/**"]
  },
  plugins: [
    cloudflareTest({
      main: "src/worker.ts",
      wrangler: { configPath: "./wrangler.test.jsonc" }
    })
  ]
});
