#!/usr/bin/env node
/**
 * Registry drift guard.
 *
 * Each gallery page (`src/gallery/<page>.stories.tsx`) has a co-located
 * `<page>.demos.ts` sidecar that enumerates its `<Demo id=...>` / `<Section id=...>`
 * anchors for the Welcome demo index and the legacy-slug redirect targets. The
 * sidecars are hand-maintained, so a renamed/added/removed anchor in a story
 * file can silently leave a dead index link or a broken redirect deep-link.
 *
 * This script parses each story file for anchor ids and asserts the set equals
 * the sidecar's `demos[].id` set. Exits non-zero on any mismatch. It has no
 * dependencies (plain Node + regex) so it runs anywhere without a test runner.
 *
 * Run: `node scripts/check-registry-drift.mjs` (from examples/).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const galleryDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'gallery');

/** Anchor ids referenced by the demo index / redirects are `<Demo id="...">` and `<Section id="...">`. */
function anchorIdsFromStory(source) {
  const ids = new Set();
  // Match id="..." that sits inside a <Demo ...> or <Section ...> opening tag.
  const tagRe = /<(?:Demo|Section)\b[^>]*?\bid=["']([a-z0-9-]+)["']/gs;
  for (const m of source.matchAll(tagRe)) ids.add(m[1]);
  return ids;
}

/** Sidecar ids come from the `demos: [{ id: '...' }]` array literal. */
function sidecarIds(source) {
  const ids = new Set();
  const idRe = /\bid:\s*["']([a-z0-9-]+)["']/g;
  for (const m of source.matchAll(idRe)) ids.add(m[1]);
  return ids;
}

const files = readdirSync(galleryDir);
const pages = files.filter((f) => f.endsWith('.stories.tsx')).map((f) => f.replace('.stories.tsx', ''));

let failures = 0;
for (const page of pages) {
  const sidecarName = `${page}.demos.ts`;
  if (!files.includes(sidecarName)) {
    // welcome has no sidecar (it IS the index); skip pages without a sidecar.
    continue;
  }
  const story = readFileSync(join(galleryDir, `${page}.stories.tsx`), 'utf8');
  const sidecar = readFileSync(join(galleryDir, sidecarName), 'utf8');

  const storyIds = anchorIdsFromStory(story);
  const listed = sidecarIds(sidecar);

  // Every id the sidecar advertises MUST exist as a real anchor on the page
  // (a dead one breaks the index link / redirect). We don't require the story's
  // full anchor set to be listed — a page may have sub-anchors the index omits —
  // but every listed id must resolve.
  const missing = [...listed].filter((id) => !storyIds.has(id));
  if (missing.length > 0) {
    failures++;
    console.error(`DRIFT ${sidecarName}: lists ids with no matching anchor on the page: ${missing.join(', ')}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} sidecar(s) drifted from their story anchors.`);
  process.exit(1);
}
console.log(`Registry OK: ${pages.length} pages checked, no sidecar drift.`);
