/**
 * The visual vocabulary wall's tiles: about 24 existing demos filed by intent,
 * covering every Visualizations section. Lane 2/b fills it; the scaffold fixes
 * the shape.
 */
import type { SectionId } from "../config";

/** One tile on the wall. */
export type VocabularyTile = {
  /** An existing demo id, rendered through the demo system. */
  demo: string;
  /** The Visualizations section the chart is filed under; the wall's filter uses it. */
  intent: SectionId;
  /** The chart's name, shown in mono under the tile. */
  label: string;
  /** An existing docs page under `/docs/<intent>/`: the chart's own page or the nearest one in its section. */
  href: string;
};

/** The tiles in wall order. */
export const vocabularyTiles: VocabularyTile[] = [];
