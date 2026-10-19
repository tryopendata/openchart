import type { Rect } from './layout';
export interface GeoColorKeyLayout {
  kind: 'binned' | 'gradient' | 'categorical';
  field: string;
  format?: string;
  activeValue: boolean;
  distribution: boolean;
  /** Exact existing classes. Counts are finite joined observations, never area. */
  classes: Array<{
    index: number;
    color: string;
    lower?: number;
    upper?: number;
    count: number;
    x: number;
    width: number;
    y?: number;
    height?: number;
  }>;
  categories: Array<{ value: string; color: string; count: number; bounds: Rect }>;
  missing: number;
  bar?: Rect;
  domain?: [number, number];
  clampDomain?: [number, number];
  /** Measured exact-value lines keyed by tagged raw value; A prefix is replaced by the slot. */
  activeLabels?: Record<string, string[]>;
  activeRows: Rect[];
  distributionBounds?: Rect;
}
export interface GeoColorKeyDescriptor {
  features?: GeoColorKeyLayout;
  points?: GeoColorKeyLayout;
}
