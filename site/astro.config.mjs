import { fileURLToPath } from "node:url";
import { satteri, satteriHeadingIdsPlugin } from "@astrojs/markdown-satteri";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwind from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { site } from "./src/config.ts";
import { pagefindIntegration } from "./src/integrations/pagefind.ts";
import { shikiThemes } from "./src/lib/code-themes.ts";
import { docsHastPlugins, docsShikiTransformers } from "./src/lib/markdown.ts";

export default defineConfig({
  site: site.url,
  output: "static",
  // Directory output with trailing slashes: /docs/install/ is served from
  // docs/install/index.html, so canonicals, links and the sitemap agree as-is.
  trailingSlash: "always",
  build: { format: "directory" },
  // Per-checkout caches: worktrees share node_modules through a symlink, and
  // the default cache directories live inside it.
  cacheDir: "./.astro-cache",
  integrations: [
    react(),
    mdx(),
    // Pages only: the error page and endpoints (.md, .txt, .png, .xml) stay out,
    // and so do blog tag pages, which are `noindex, follow`.
    sitemap({
      filter: (page) =>
        page.endsWith("/") &&
        !page.includes("/404") &&
        !page.includes("/fixtures/") &&
        !page.includes("/blog/tags/"),
    }),
    // Last, so it indexes the finished output.
    pagefindIntegration(),
  ],
  markdown: {
    // Sätteri is Astro's default processor; heading ids come first so the
    // anchor plugin can read them.
    processor: satteri({ hastPlugins: [satteriHeadingIdsPlugin(), ...docsHastPlugins] }),
    shikiConfig: {
      themes: shikiThemes,
      // Both themes as CSS variables; global.css picks one per theme.
      defaultColor: false,
      transformers: docsShikiTransformers,
    },
  },
  vite: {
    cacheDir: "./.vite-cache",
    plugins: [tailwind()],
    resolve: {
      // Demo data comes from the gallery's dataset pool, one module per import.
      alias: { "@datasets": fileURLToPath(new URL("../examples/src/data", import.meta.url)) },
    },
  },
});
