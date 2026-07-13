/**
 * Static gallery registry — the single source of truth for the Welcome demo index.
 *
 * Each gallery page owns a co-located sidecar (`<page>.demos.ts`) that exports a
 * `page: PageEntry` with the page's Ladle slug, sidebar group, and every demo
 * anchor in visual order. The sidecars live outside `*.stories.tsx` on purpose:
 * Ladle turns every named export in a story file into a story, so a shared
 * `export const demos` would collide across same-group pages (e.g. all five
 * Charts pages -> a duplicate `charts--demos` id) and fail the build. Keeping
 * the registry in sidecars keeps each page's list co-located and drift-proof
 * while staying invisible to Ladle's story scanner.
 *
 * Slugs are Ladle's `<group>--<export>` form, verified against
 * `examples/build/meta.json`. Note `&` collapses to a triple dash:
 * "Sankey & Tile Maps" -> `sankey---tile-maps`.
 *
 * Playground has no page yet; Phase 06 adds it plus its entry.
 */

import { page as barColumn } from './charts-bar-column.demos';
import { page as buildingBlocks } from './charts-building-blocks.demos';
import { page as lineArea } from './charts-line-area.demos';
import { page as pieDonut } from './charts-pie-donut.demos';
import { page as scatterDistribution } from './charts-scatter-distribution.demos';
import { page as dashboards } from './dashboards.demos';
import { page as animation } from './features-animation.demos';
import { page as annotations } from './features-annotations.demos';
import { page as dataEncoding } from './features-data-encoding.demos';
import { page as editMode } from './features-edit-mode.demos';
import { page as responsive } from './features-responsive.demos';
import { page as theming } from './features-theming.demos';
import { page as graphs } from './graphs.demos';
import { page as maps } from './maps.demos';
import { page as playground } from './playground.demos';
import { page as sankeyTileMaps } from './sankey-tilemaps.demos';
import { page as scrollytelling } from './scrollytelling.demos';
import { page as showcase } from './showcase.demos';
import { page as tables } from './tables.demos';
import { page as youDrawIt } from './you-draw-it.demos';

export type Demo = { id: string; title: string };

export type PageEntry = {
  /** Sidebar group the page lives under. */
  group: string;
  /** Real Ladle slug, e.g. `charts--bar-and-column`. */
  slug: string;
  /** Human-readable page name (the folder title within its group). */
  export: string;
  demos: Demo[];
};

/** Every gallery page, in sidebar order. */
export const GALLERY: PageEntry[] = [
  barColumn,
  lineArea,
  pieDonut,
  scatterDistribution,
  buildingBlocks,
  tables,
  graphs,
  sankeyTileMaps,
  maps,
  dashboards,
  annotations,
  editMode,
  animation,
  theming,
  responsive,
  dataEncoding,
  youDrawIt,
  scrollytelling,
  showcase,
  playground,
];
