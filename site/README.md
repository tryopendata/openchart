# openchart

The documentation site for OpenChart, a library that renders charts, tables and maps from a JSON spec, served at https://openchart.steamfield.io.

The site is static, built with [Astro](https://astro.build), and has four parts:

- **Landing** at `/`.
- **Docs** under `/docs/`: the chart, table and map catalog with live demos, plus the guides from the repository's `docs/`. Every docs page is also served as Markdown, and `/llms.txt` lists them for coding agents.
- **Examples** at `/examples/`: a filterable wall of finished graphics, each with a page holding the live chart, its JSON spec and a link to the docs page.
- **Blog** at `/blog/`, with posts, tag pages and an RSS feed at `/blog/rss.xml`.

Search covers docs, examples and posts. It is a [Pagefind](https://pagefind.app) index that every `astro build` writes to `dist/pagefind/`; press Cmd+K or Ctrl+K (or `/`) to open it. The dev server has no index, so try search with `make build` then `make preview`.

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

## Adding a gallery entry

A gallery entry is one item in the list in `src/lib/gallery.ts`: a slug, a registered demo id, the docs section it is filed under, a title and a description. The wall, the entry page, its social card, the sitemap and the search index pick it up on the next build. Its demo draws tier-1 data only. See Gallery in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Adding a blog post

A post is one `.md` or `.mdx` file in `src/content/blog/`, and the file name is its URL slug. Its frontmatter sets the title, description, publish date, author, tags and related docs pages, and its charts are `<Demo>` figures or `json demo` fences. The index, tag pages, RSS feed, social card and search index pick it up on the next build. See Blog in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

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
| `make deploy-check`                 | Build, then check headers, redirects, the RSS feed, the search index and URLs under `wrangler pages dev` |
| `make deploy-preview BRANCH=<name>` | Upload a Cloudflare Pages preview (needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; `main` is refused, use `make deploy`) |
| `make deploy`                       | Upload to production (needs the same two variables)                  |

Cloudflare's Git integration deploys `main` to production and every other branch to a preview; the Site workflow (`.github/workflows/site.yml`) only runs the checks. The two upload targets are for manual uploads. See Deploy in [AGENTS.md](AGENTS.md).

## License

Copyright (c) 2026 Riley Hilliard
