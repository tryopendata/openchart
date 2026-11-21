# Developing the site

## Where things live

| Path | Owns |
| --- | --- |
| `src/config.ts` | Product name, tagline, URL, install commands, demo lines, features, logos, links, license, the header `nav` and `footer` columns, the docs areas and sections (`docsAreas`), the blog's tags (`blogTags`) and the `islands` list |
| `src/content/docs/` | Site docs pages, one MDX or Markdown file each, validated by `src/content/schema.ts` |
| `../docs/` | The repository's docs; a file with a `section` in its frontmatter is a page (see "Repository docs") |
| `src/lib/repo-link-targets.ts` | Where links in repository docs go when the target is not a published page: aliases and the Ladle story map |
| `src/lib/docs.ts` | Pure docs rules: sidebar order, pager, URLs, the Markdown export and both llms files |
| `src/lib/collection.ts` | The only `astro:content` import outside routes: `allPages()` and `allPosts()` |
| `src/lib/gallery.ts`, `src/lib/gallery-types.ts` | The examples gallery's entries and their contract |
| `src/content/blog/`, `src/content/blog-schema.ts`, `src/lib/blog-types.ts` | Blog posts, their frontmatter schema and the `BlogPost` contract |
| `src/lib/search-index.ts`, `src/integrations/pagefind.ts` | What search indexes and under which area, and the build step that writes the index |
| `src/components/shared/tiles/` | Tile specimens shared by the landing wall, the gallery and the blog index |
| `src/lib/markdown.ts` | Docs Markdown conventions as Sätteri hast plugins plus one Shiki transformer |
| `src/lib/og.ts` | The social card layout and its fonts |
| `src/components/landing/` | The ten landing sections, one directory per section with its islands |
| `src/landing/` | Landing copy (`copy.ts`, the headline and every section heading) and each section's data |
| `src/scripts/motion/` | `withMotion`, the landing page's only way into GSAP |
| `src/scripts/site.ts` | Theme toggle, code copy buttons, copy page and the TOC highlight |
| `src/layouts/` | `BaseLayout` (head, header, footer), `DocsLayout` (sidebar, TOC, pager) and `BlogLayout` (a post) |

## Docs pages

Frontmatter: `title`, `description` (at most 160 characters), `section` (a section id from `docsAreas`, which also decides the area), optional `order` (default 100, ties sort by title) and `sidebarLabel`. A file at `src/content/docs/recipes/deploy.mdx` is served at `/docs/recipes/deploy/`, exported at `/docs/recipes/deploy.md` and drawn at `/og/docs/recipes/deploy.png`. Nothing else lists pages by hand.

An MDX page may contain Markdown plus `<Demo id="…" />` (after a leading import of `Demo.astro`) and nothing else: the Markdown export understands only `<Demo>`, so any other component would leak into `/docs/<id>.md`.

Markdown conventions, all plain Markdown so pages read the same on GitHub and to agents:

- Callouts: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`.
- Titled code blocks: `title="file.ts"` after the fence's language.
- `##` and `###` headings feed the table of contents and get anchor links.
- Tables scroll sideways inside their own region.

Link between pages with the full route and its trailing slash (`/docs/the-spec/anatomy/`). The build test fails on a link or `#anchor` that doesn't resolve. Link to another lane's page without an anchor unless that heading already exists there: a heading added later may be renamed before it lands.

`tests/docs-pages.ts` lists the Guides, Building blocks and Reference pages with their demo minimums, and `catalogReference` names the reference page each Visualizations page must link to. The build test applies every content rule to every page in that list. The `phase-4-stub` marker that exempted unfinished pages is gone, and the build test fails if any file under `../docs/` or `src/content/` contains it.

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

Landing sections are Astro components, each `<section id aria-labelledby data-landing-section>` with one h2 from `src/landing/copy.ts`; a section hydrates a React island only for interaction a demo figure can't do. Only components named in `site.islands` may take a `client:` directive, and only on the landing page; the build test compares the hydrated islands with that list and fails on an island on any other page. Prefer `client:visible`. Interactive behaviour shared by every page (theme, copy buttons, TOC) goes in `src/scripts/site.ts` as plain DOM code that does nothing when its markup is absent.

## Theme

The inline head script adds `dark` or `light` to `<html>` before paint, from `localStorage.theme` or the system preference. Without JavaScript neither class is set and a `prefers-color-scheme` media query supplies the dark tokens. Components use the token utilities (`bg-canvas`, `text-ink`, `text-muted`, `border-line`, `bg-panel`, `text-accent`), so both paths style the same markup. New colors become tokens in both theme blocks of `global.css`; the browser step runs axe against both themes.

## Social cards

`/og/[...slug].png` renders `ogCard` with satori and converts it with sharp, one card per docs page (`/og/docs/<id>.png`), gallery entry (`/og/examples/<slug>.png`) and blog post (`/og/blog/<slug>.png`). Other pages use `/og-image.png`. Fonts come from the installed `@fontsource/inter` package as WOFF; satori can't read WOFF2 and lays out flexbox only. To use one static image instead, put a 1200x630 PNG in `public/`, delete the route and `og.ts`, point the layouts' `image` at it and update the build test.

## Header and layout

The header lists Docs, then `site.nav` (Examples, Blog), then `site.social` (GitHub), then the search trigger and the theme toggle. Every entry in `site.nav` renders, so add one only when its page exists. The link whose path the current route starts with gets `aria-current="page"`. To fit a 360px screen, the social links hide under 640px (the footer keeps them) and the wordmark text is visually hidden under 480px; the home link keeps its name, "OpenChart home". The search trigger and the theme toggle keep their boxes while hidden (`visibility: hidden` until their scripts set `data-search-ready` and `data-theme-ready`), so wiring them never moves the links.

`BaseLayout` takes `ogType` (`"article"` for a post), `robots` (`"noindex, follow"` for a thin page whose links should still count; `noindex` is shorthand for `"noindex, nofollow"`) and a named `head` slot for JSON-LD and article meta. Every page links the RSS feed as an alternate.

## Gallery

`/examples/` is a wall of tiles, one per entry in `galleryEntries` (`src/lib/gallery.ts`), and each entry has a page at `/examples/<slug>/` with its live demo, its code and a link to its docs page. An entry is a `GalleryEntry` (`src/lib/gallery-types.ts`): a unique `slug`, a registered `demo` id, the Visualizations section it is filed under (`kind`), a `title`, a `description` of at most 160 characters, the docs page it links to, and optionally `size: "wide"` and the Ladle story it ports. The tile shows the demo spec's `chrome.title`, so that title states a finding. A Visualizations section with no entry goes in `GALLERY_GAPS` with the reason. Adding an entry is one item in the list: the wall, the entry page, its social card, the sitemap and the search index pick it up.

Gallery demos draw tier-1 data only (the build test reads each figure's Source against the tier-1 datasets). Tiles come from `src/components/shared/tiles/`: `tileChartHtml(demoId, pageShared, { size: GALLERY_TILE_SIZE, domPrefix })` writes the stage, `observeTileScale(root, GALLERY_TILE_SIZE)` keeps live tiles the same picture as the static ones, `tile-filter.ts` reads and writes the filter under `#kind=` (`GALLERY_HASH_KEY`), and `tile-motion.ts` refiles the tiles. The gallery's script is plain DOM code loaded only by the two gallery pages; the gallery takes no island.

## Search

Search is static. `src/integrations/pagefind.ts` runs Pagefind at the end of every `astro build` (it is registered last in `astro.config.mjs`), so every build writes `dist/pagefind/`: CI, Pages, the probe build and the browser tests. A Pagefind error fails the build.

Pagefind indexes only elements that carry `searchBodyAttrs(area)` from `src/lib/search-index.ts`, and the `area` meta files each result under one of `SEARCH_AREAS`: Guides, Visualizations, Building blocks and Reference (from `docsAreas`), then Examples and Blog. Docs articles, gallery entry pages and blog posts carry it; the landing page, `/examples/`, `/blog/`, tag pages, the 404 page and fixtures do not. Inside an indexed page, `data-pagefind-ignore` keeps out what isn't content: demo stages, controls, spec and shared-value scripts and code panels (all written by `src/lib/demo/`), and the docs breadcrumb, page actions and pager.

The header's `<Search />` (`src/components/search/Search.astro`) holds the trigger, `button[data-search-trigger]` with `aria-controls="site-search"`, and an empty `dialog#site-search[data-search]`. `src/scripts/search.ts` is the eager part every page loads: it wires the trigger and the shortcuts and imports the dialog code on first use, and the build test holds it, with its static imports, to 2 KB gzipped. No page loads Pagefind or the dialog code up front. The dev server has no index, so the dialog shows `SEARCH_UNAVAILABLE` there; run `make build`, then `make preview`.

## Blog

A post is one `.md` or `.mdx` file in `src/content/blog/`; the file name is the slug, so `how-to-chart-a-temperature-anomaly.mdx` is served at `/blog/how-to-chart-a-temperature-anomaly/`. Frontmatter, checked by `src/content/blog-schema.ts`: `title` (at most 70 characters), `description` (at most 160), `published` (a date), optional `updated` (not before `published`), `author`, `tags` (one to four ids from `blogTags` in `src/config.ts`; add a tag there first), `related` (one to four docs page ids, which `allPosts()` checks exist and fails on with `UnknownRelatedPageError`), optional `lead` (the demo id the index shows) and `draft` (default false; drafts build in dev only).

`allPosts()` in `src/lib/collection.ts` returns the posts newest first as `{ post, body, render() }`, with `post` a `BlogPost` (`src/lib/blog-types.ts`). The index, each post's page (in `BlogLayout`), the tag pages at `/blog/tags/<tag>/`, the RSS feed at `/blog/rss.xml` and the social cards all derive from it. Tag pages are `noindex, follow` and stay out of the sitemap and the search index.

A post may contain Markdown, `<Demo id="…" />` (after importing `Demo.astro`) and `json demo` fences, nothing else, so a Markdown export stays possible. In MDX a fence's figure goes through Astro's `<Fragment set:html>`, since JSX has no raw HTML node. Every chart cites tier-1 data. The post's last paragraph is its call to action: one sentence and one link, written in the post. The layout gives each post a byline, `[data-byline]` holding the author, a `<time datetime="YYYY-MM-DD">` and "n min read" in that order, plus BlogPosting JSON-LD in the `head` slot; the build test checks both.

## Phase 5 stubs

While a phase 5 lane is unfinished its stub carries the `phase-5-stub` marker: `src/lib/gallery.ts` (gallery), `src/components/search/Search.astro` (search) and `src/content/blog/how-to-chart-a-temperature-anomaly.mdx` (blog). The build test skips a lane's content cases while its marker is present, and once every marker is gone it fails on any source file that still contains one.

## Running servers

Dev and preview pass `--ignore-lock` so they stay in the foreground under an agent. Stop an Astro-managed background instance with `bunx astro dev stop` or `bunx astro preview stop`. The browser tests serve `dist/` with `astro preview` on `PORT_E2E`.
