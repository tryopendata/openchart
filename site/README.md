# openchart

The documentation site for OpenChart, a library that renders charts, tables and maps from a JSON spec, served at https://openchart.steamfield.io.

The site is static: a landing page at `/` and documentation under `/docs/`, built with [Astro](https://astro.build). Every docs page is also served as Markdown, and `/llms.txt` lists them for coding agents.

## Quickstart

Requires [bun](https://bun.sh), Node and make. The site lives in the openchart monorepo and renders its charts with the library packages, so install and build those at the repository root first:

```bash
bun install            # at the repository root
bun run build          # at the repository root: builds packages/*/dist
cd site
make install
make dev               # http://localhost:4321
```

## Adding a docs page

Catalog pages are `.mdx` files under `src/content/docs/<section>/` with `title`, `description` and `section` in their frontmatter (optional `order` and `sidebarLabel`). A Markdown file in the repository's `docs/` becomes a page when its frontmatter declares `section`. The sidebar, pager, docs home, sitemap, social card, Markdown export and `llms.txt` pick it up on the next build.

## Commands

Run from `site/`.

| Command                             | What it does                                                         |
| ----------------------------------- | -------------------------------------------------------------------- |
| `make dev`                          | Dev server                                                           |
| `make lint`                         | Biome and Prettier checks                                            |
| `make format`                       | Apply formatting and safe fixes                                      |
| `make check`                        | Type-check pages, components and content                             |
| `make test`                         | Unit and component tests                                             |
| `bunx vitest run <file>`            | One test file                                                        |
| `make build`                        | Production build into `dist/`, then its acceptance tests             |
| `make e2e`                          | Browser and accessibility tests                                      |
| `make preview`                      | Serve the production build                                           |
| `make deploy-check`                 | Build, then check headers and URLs under `wrangler pages dev`        |
| `make deploy-preview BRANCH=<name>` | Upload a Cloudflare Pages preview (needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`) |
| `make deploy`                       | Upload to production (needs the same two variables)                  |

The Site workflow (`.github/workflows/site.yml`) runs the checks on every change to the site and deploys `main` to Cloudflare Pages; see Deploy in [AGENTS.md](AGENTS.md).

## License

Copyright (c) 2026 Riley Hilliard
