---
paths:
  - "src/content/**"
  - "src/lib/docs.ts"
  - "src/lib/markdown.ts"
  - "src/lib/repo-markdown.ts"
  - "src/lib/repo-link-targets.ts"
  - "src/layouts/DocsLayout.astro"
  - "src/pages/docs/**"
---

Read "Docs pages", "Repository docs" and "Markdown processing" in [the development guide](../../../docs/DEVELOPMENT.md) before changing docs content or the docs pipeline.

- A new page is one file with `title`, `description` and `section` (a section id from `docsAreas`). Don't list pages anywhere else; navigation, exports and the sitemap derive from the collections.
- An MDX page may use Markdown plus `<Demo id="…" />` and nothing else; the Markdown export understands only `<Demo>`. Otherwise use the plain Markdown conventions (`> [!NOTE]` callouts, `title="..."` on fences).
- Repository docs live in `../docs/` and `../docs/reference/` and keep relative `.md` links. Links to files the site replaces go through the aliases, and Ladle gallery links through the story map, both in `src/lib/repo-link-targets.ts`.
- Link with the full route and trailing slash. Link to another lane's page without an anchor unless that heading already exists there. `make build` fails on a broken link or anchor.
