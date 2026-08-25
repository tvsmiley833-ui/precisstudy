import { defineConfig } from 'vitest/config';
import { cloudflare } from 'vite-plugin-cloudflare';

export default defineConfig({
  plugins: [cloudflare()],
  test: {
    pool: 'workers',
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc' },
      },
    },
    environment: 'miniflare',
    globals: true,
    include: ['test/**/*.test.js'],
  },
});