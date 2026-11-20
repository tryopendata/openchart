# openchart

<!-- stacks:fill One sentence on the product this site presents. -->

The product's static site: a landing page at `/` and documentation under `/docs/`, built with [Astro](https://astro.build). Every docs page is also served as Markdown, and `/llms.txt` lists them for coding agents.

## Quickstart

Requires [bun](https://bun.sh), Node and make.

```bash
make install
make dev        # http://localhost:4321
```

## Adding a docs page

Create a Markdown file under `src/content/docs/<group>/` with `title`, `description` and `group` in its frontmatter. The sidebar, pager, docs home, sitemap, social card, Markdown export and `llms.txt` pick it up on the next build.

## Commands

| Command         | What it does                                       |
| --------------- | -------------------------------------------------- |
| `make dev`      | Dev server                                         |
| `make lint`     | Biome and Prettier checks                          |
| `make format`   | Apply formatting and safe fixes                    |
| `make check`    | Type-check pages, components and content           |
| `make test`     | Unit and component tests                           |
| `make build`    | Production build into `dist/`, then its acceptance tests |
| `make e2e`      | Browser and accessibility tests                    |
| `make preview`  | Serve the production build                         |

## License

Copyright (c) 2026 Riley Hilliard
