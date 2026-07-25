/**
 * Exported prop types for Svelte components.
 *
 * These mirror the inline types used in each component's $props() destructuring
 * and provide named exports for downstream typing.
 */

import type {
  Annotation,
  AnnotationOffset,
  BarListSpec,
  ChartSpec,
  DarkMode,
  ElementEdit,
  GraphSpec,
  LayerSpec,
  MapSpec,
  MarkEvent,
  SankeySpec,
  SortState,
  TableSpec,
  TextAnnotation,
  ThemeConfig,
  TileMapSpec,
  VizSpec,
} from '@opendata-ai/openchart-core';
import type { Snippet } from 'svelte';

export interface ChartProps {
  spec: ChartSpec | LayerSpec | GraphSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  /** Rendering backend for point marks; see the vanilla `MountOptions.renderer`. */
  renderer?: 'auto' | 'svg' | 'canvas';
  onmarkclick?: (event: MarkEvent) => void;
  onmarkhover?: (event: MarkEvent) => void;
  onmarkleave?: () => void;
  onlegendtoggle?: (series: string, visible: boolean) => void;
  onannotationclick?: (annotation: Annotation, event: MouseEvent) => void;
  onannotationedit?: (annotation: TextAnnotation, offset: AnnotationOffset) => void;
  onedit?: (edit: ElementEdit) => void;
  ondatapointclick?: (data: Record<string, unknown>) => void;
  class?: string;
  style?: string;
}

export interface DataTableProps {
  spec: TableSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  onrowclick?: (row: Record<string, unknown>) => void;
  onsortchange?: (sort: SortState | null) => void;
  onsearchchange?: (query: string) => void;
  onpagechange?: (page: number) => void;
  sort?: SortState | null;
  search?: string;
  page?: number;
  class?: string;
  style?: string;
}

export interface GraphProps {
  spec: GraphSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  onnodeclick?: (node: Record<string, unknown>) => void;
  onnodedoubleclick?: (node: Record<string, unknown>) => void;
  onselectionchange?: (nodeIds: string[]) => void;
  class?: string;
  style?: string;
}

export interface SankeyProps {
  spec: SankeySpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  onnodeclick?: (node: Record<string, unknown>) => void;
  onlinkclick?: (link: Record<string, unknown>) => void;
  onnodehover?: (node: Record<string, unknown> | null) => void;
  onlinkhover?: (link: Record<string, unknown> | null) => void;
  class?: string;
  style?: string;
}

export interface MapFeatureEvent {
  id: string | number;
  name?: string;
  data: Record<string, unknown> | null;
}

export interface MapProps {
  spec: MapSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  onmarkclick?: (event: MapFeatureEvent) => void;
  onmarkhover?: (event: MapFeatureEvent) => void;
  class?: string;
  style?: string;
}

export interface TileMapProps {
  spec: TileMapSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  ontileclick?: (tile: {
    stateCode: string;
    stateName: string;
    value: number | null;
    data: Record<string, unknown>;
  }) => void;
  ontilehover?: (
    tile: {
      stateCode: string;
      stateName: string;
      value: number | null;
      data: Record<string, unknown>;
    } | null,
  ) => void;
  class?: string;
  style?: string;
}

export interface BarListProps {
  spec: BarListSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  onrowclick?: (row: { label: string; value: number; data: Record<string, unknown> }) => void;
  onrowhover?: (
    row: {
      label: string;
      value: number;
      data: Record<string, unknown>;
    } | null,
  ) => void;
  class?: string;
  style?: string;
}

export interface VisualizationProps {
  spec: VizSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  class?: string;
  style?: string;
}

export interface VizThemeProviderProps {
  theme: ThemeConfig | undefined;
  darkMode?: DarkMode;
  children: Snippet;
}
