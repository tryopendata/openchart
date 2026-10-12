# OpenChart Studio

A private, client-side visualization authoring app. OpenChart remains a separate framework-independent library. Studio owns its React/Motion UI, data import, local projects, datasets, fonts and build tooling; it consumes only public OpenChart package exports.

## Develop here

From the repository root, run `bun install --frozen-lockfile` and `bun run build`. Then, from this directory:

```sh
bun run dev       # http://127.0.0.1:6007/
bun run typecheck
bun run lint
bun run test
bun run test:e2e   # builds and tests the production artifact
bun run build     # dist/
```

## Move or deploy independently

From the repository root, `bun run extract:studio /tmp/my-studio-checkout` creates an independent checkout with packed public library builds. It verifies package identity, typechecks, tests and builds outside the monorepo. Commit the generated lockfile in the new repository. Replace packed dependencies with pinned registry releases once a compatible version is published.

In that checkout, `STUDIO_TEST_BASE_PATH=/tools/studio/ bun run test:e2e` verifies nested hosting, including fonts, charts, maps, image downloads and project recovery. Serve `dist/` on a static HTTPS host at an origin or trailing-slash path. Cache hashed assets immutably and revalidate HTML. Development, preview and QA servers are not production servers.

## Documents and hosting

Chart documents are ordinary `VizSpec`. Download Studio project preserves source rows, preparation and chart together; the JSON drawer exposes the chart alone. Plain CSV/TSV/JSON accepts 5 MB and 20,000 rows; project backups accept 20 MB. Files stay in the browser. Local drafts belong to the current origin and browser; download a project before moving hosts.

The app supports data correction/filtering/summaries, composition changes, axis/color/annotation controls, table and map controls, undo, drafts, recommendations, design checks, responsive preview and exports. It does not provide accounts, cloud persistence, collaboration, publish/revoke or an embed service. A future host should adapt project load/save around the app boundary. See the source repository's `docs/workbench.md` for the capability matrix and library contracts.
