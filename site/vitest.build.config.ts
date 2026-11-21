import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The acceptance tests read dist/ after `astro build`; `make build` runs them.
// They import the landing data modules, which read datasets through the same
// `@datasets` alias astro.config.mjs sets.
export default defineConfig({
  resolve: {
    alias: { "@datasets": fileURLToPath(new URL("../examples/src/data", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/build.test.ts"],
    testTimeout: 180_000,
  },
});
