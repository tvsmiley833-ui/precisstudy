import { defineConfig } from "vitest/config";
import { cloudflarePool } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  test: {
    pool: cloudflarePool({
      main: "src/worker.js",
      wrangler: { configPath: "./wrangler.jsonc" }
    })
  }
});
