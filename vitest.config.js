import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "src/worker.js",
      wrangler: { configPath: "./wrangler.jsonc" }
    })
  ]
});
