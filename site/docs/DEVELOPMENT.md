# Developing the site

## Where things live

| Path | Owns |
| --- | --- |
| `src/config.ts` | Product name, tagline, URL, install commands, demo lines, features, logos, links, license, the docs groups and the `islands` list |
| `src/content/docs/` | Docs pages, one Markdown file each, validated by `src/content/schema.ts` |
| `src/lib/docs.ts` | Pure docs rules: sidebar order, pager, URLs, the Markdown export and both llms files |
| `src/lib/collection.ts` | The only `astro:content` import outside routes |
| `src/lib/markdown.ts` | Docs Markdown conventions as Sätteri hast plugins plus one Shiki transformer |
| `src/lib/og.ts` | The social card layout and its fonts |
| `src/components/landing/` | Landing sections (static React) and `InstallTabs`, the one island |
| `src/scripts/site.ts` | Theme toggle, code copy buttons, copy page and the TOC highlight |
| `src/layouts/` | `BaseLayout` (head, header, footer) and `DocsLayout` (sidebar, TOC, pager) |

## Docs pages

Frontmatter: `title`, `description` (at most 160 characters), `group` (an id from `docsGroups`), optional `order` (default 100, ties sort by title) and `sidebarLabel`. A file at `src/content/docs/guides/deploy.md` is served at `/docs/guides/deploy/`, exported at `/docs/guides/deploy.md` and drawn at `/og/docs/guides/deploy.png`. Nothing else lists pages by hand.

Markdown conventions, all plain Markdown so pages read the same on GitHub and to agents:

- Callouts: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`.
- Titled code blocks: `title="file.ts"` after the fence's language.
- `##` and `###` headings feed the table of contents and get anchor links.
- Tables scroll sideways inside their own region.

Link between pages with the full route and its trailing slash (`/docs/concepts/how-it-works/`). The build test fails on a link or `#anchor` that doesn't resolve.

## Markdown processing

Astro's default processor is Sätteri, which doesn't run remark or rehype plugins. The plugins in `src/lib/markdown.ts` use Sätteri's own API (`@astrojs/markdown-satteri`): objects with a tag `filter` and a `visit(node, ctx)` function. Shiki highlights code before hast plugins run and drops the fence's info string, so `codeTitle` (a Shiki transformer) copies `title="..."` onto the `<pre>` as `data-title`, and `codeFrames` turns it into a caption. `markdown.test.ts` renders through the same processor.

## Islands and scripts

Landing sections are React components rendered to HTML at build time. Only components named in `site.islands` may take a `client:` directive, and only on the landing page; the build test compares the hydrated islands with that list and fails on any island in `/docs/`. Prefer `client:visible`. Interactive behaviour shared by every page (theme, copy buttons, TOC) goes in `src/scripts/site.ts` as plain DOM code that does nothing when its markup is absent.

## Theme

The inline head script adds `dark` or `light` to `<html>` before paint, from `localStorage.theme` or the system preference. Without JavaScript neither class is set and a `prefers-color-scheme` media query supplies the dark tokens. Components use the token utilities (`bg-canvas`, `text-ink`, `text-muted`, `border-line`, `bg-panel`, `text-accent`), so both paths style the same markup. New colors become tokens in both theme blocks of `global.css`; the browser step runs axe against both themes.

## Social cards

`/og/[...slug].png` renders `ogCard` with satori and converts it with sharp. Fonts come from the installed `@fontsource/inter` package as WOFF; satori can't read WOFF2 and lays out flexbox only. To use one static image instead, put a 1200x630 PNG in `public/`, delete the route and `og.ts`, point the layouts' `image` at it and update the build test.

## Search

Search isn't part of this site yet. `BaseLayout` has an empty `search` slot in the header for a search component, and docs content sits in `<article>` inside `<main>` so a static indexer can scope to it.

## Running servers

Dev and preview pass `--ignore-lock` so they stay in the foreground under an agent. Stop an Astro-managed background instance with `bunx astro dev stop` or `bunx astro preview stop`. The browser tests serve `dist/` with `astro preview` on `PORT_E2E`.
