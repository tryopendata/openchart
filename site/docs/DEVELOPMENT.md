# Developing the site

## Where things live

| Path | Owns |
| --- | --- |
| `src/config.ts` | Product name, tagline, URL, install commands, demo lines, features, logos, links, license, the docs areas and sections (`docsAreas`) and the `islands` list |
| `src/content/docs/` | Site docs pages, one MDX or Markdown file each, validated by `src/content/schema.ts` |
| `../docs/` | The repository's docs; a file with a `section` in its frontmatter is a page (see "Repository docs") |
| `src/lib/repo-link-targets.ts` | Where links in repository docs go when the target is not a published page: aliases and the Ladle story map |
| `src/lib/docs.ts` | Pure docs rules: sidebar order, pager, URLs, the Markdown export and both llms files |
| `src/lib/collection.ts` | The only `astro:content` import outside routes |
| `src/lib/markdown.ts` | Docs Markdown conventions as Sätteri hast plugins plus one Shiki transformer |
| `src/lib/og.ts` | The social card layout and its fonts |
| `src/components/landing/` | The ten landing sections, one directory per section with its islands |
| `src/landing/` | Landing copy (`copy.ts`, the headline and every section heading) and each section's data |
| `src/scripts/motion/` | `withMotion`, the landing page's only way into GSAP |
| `src/scripts/site.ts` | Theme toggle, code copy buttons, copy page and the TOC highlight |
| `src/layouts/` | `BaseLayout` (head, header, footer) and `DocsLayout` (sidebar, TOC, pager) |

## Docs pages

Frontmatter: `title`, `description` (at most 160 characters), `section` (a section id from `docsAreas`, which also decides the area), optional `order` (default 100, ties sort by title) and `sidebarLabel`. A file at `src/content/docs/recipes/deploy.mdx` is served at `/docs/recipes/deploy/`, exported at `/docs/recipes/deploy.md` and drawn at `/og/docs/recipes/deploy.png`. Nothing else lists pages by hand.

An MDX page may contain Markdown plus `<Demo id="…" />` (after a leading import of `Demo.astro`) and nothing else: the Markdown export understands only `<Demo>`, so any other component would leak into `/docs/<id>.md`.

Markdown conventions, all plain Markdown so pages read the same on GitHub and to agents:

- Callouts: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`.
- Titled code blocks: `title="file.ts"` after the fence's language.
- `##` and `###` headings feed the table of contents and get anchor links.
- Tables scroll sideways inside their own region.

Link between pages with the full route and its trailing slash (`/docs/the-spec/anatomy/`). The build test fails on a link or `#anchor` that doesn't resolve. Link to another lane's page without an anchor unless that heading already exists there: a heading added later may be renamed before it lands.

## Repository docs

A Markdown file in `../docs/` or one folder down (`../docs/reference/`) becomes a page when its frontmatter declares `section`; `slug` replaces the file's base name in the URL. Two files that resolve to the same page id fail the build, naming both. The reference pages live in `../docs/reference/`, and `spec-reference.md` is their index.

Links in these files stay relative `.md` links, so they work on GitHub. At build time `src/lib/repo-markdown.ts` resolves each one against the linking file's own folder and rewrites it:

- a link to a published file goes to its page, keeping the anchor;
- a link to a file the site replaces with its own page (an alias in `repoDocAliases`, such as `tables.md`) goes to that page, with the anchor dropped;
- a link to any other repository file goes to the file on GitHub;
- a Ladle gallery link (`https://tryopendata.github.io/openchart/?story=<id>#<anchor>`) goes to the catalog page `ladleStoryPages` maps it to, looked up as `id#anchor` first, then `id`. An unmapped story fails the build with `UnmappedLadleLinkError`, naming the file and the URL; add the story to the map.

Both maps are in `src/lib/repo-link-targets.ts`.

## Markdown processing

Astro's default processor is Sätteri, which doesn't run remark or rehype plugins. The plugins in `src/lib/markdown.ts` use Sätteri's own API (`@astrojs/markdown-satteri`): objects with a tag `filter` and a `visit(node, ctx)` function. Shiki highlights code before hast plugins run and drops the fence's info string, so `codeTitle` (a Shiki transformer) copies `title="..."` onto the `<pre>` as `data-title`, and `codeFrames` turns it into a caption. `markdown.test.ts` renders through the same processor.

## Islands and scripts

Landing sections are Astro components, each `<section id aria-labelledby data-landing-section>` with one h2 from `src/landing/copy.ts`; a section hydrates a React island only for interaction a demo figure can't do. Only components named in `site.islands` may take a `client:` directive, and only on the landing page; the build test compares the hydrated islands with that list and fails on any island in `/docs/`. Prefer `client:visible`. Interactive behaviour shared by every page (theme, copy buttons, TOC) goes in `src/scripts/site.ts` as plain DOM code that does nothing when its markup is absent.

## Theme

The inline head script adds `dark` or `light` to `<html>` before paint, from `localStorage.theme` or the system preference. Without JavaScript neither class is set and a `prefers-color-scheme` media query supplies the dark tokens. Components use the token utilities (`bg-canvas`, `text-ink`, `text-muted`, `border-line`, `bg-panel`, `text-accent`), so both paths style the same markup. New colors become tokens in both theme blocks of `global.css`; the browser step runs axe against both themes.

## Social cards

`/og/[...slug].png` renders `ogCard` with satori and converts it with sharp. Fonts come from the installed `@fontsource/inter` package as WOFF; satori can't read WOFF2 and lays out flexbox only. To use one static image instead, put a 1200x630 PNG in `public/`, delete the route and `og.ts`, point the layouts' `image` at it and update the build test.

## Search

Search isn't part of this site yet. `BaseLayout` has an empty `search` slot in the header for a search component, and docs content sits in `<article>` inside `<main>` so a static indexer can scope to it.

## Running servers

Dev and preview pass `--ignore-lock` so they stay in the foreground under an agent. Stop an Astro-managed background instance with `bunx astro dev stop` or `bunx astro preview stop`. The browser tests serve `dist/` with `astro preview` on `PORT_E2E`.
