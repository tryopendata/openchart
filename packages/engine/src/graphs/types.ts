/**
 * Graph compilation types.
 *
 * These types represent the engine output for graph specs. Unlike GraphLayout
 * (which includes x/y positions for adapter rendering), GraphCompilation
 * contains resolved visual properties WITHOUT positional layout. The force
 * simulation in the adapter sets node positions at runtime.
 */

import type {
  A11yMetadata,
  LegendEntry,
  LegendLayout,
  ResolvedChrome,
  ResolvedTheme,
  TooltipContent,
} from '@opendata-ai/openchart-core';
import type { ResolvedGraphAnimation } from './animation';
import type { ResolvedGraphInteraction } from './interaction';

/** A compiled graph node with resolved visual properties (no x/y position). */
export interface CompiledGraphNode {
  /** Node identifier from the spec. */
  id: string;
  /** Computed radius from nodeSize encoding (3-20px range, default 5px). */
  radius: number;
  /** Computed fill color from nodeColor encoding or community assignment. */
  fill: string;
  /** Stroke color, slightly darker than fill. */
  stroke: string;
  /** Stroke width in pixels. Default 1. */
  strokeWidth: number;
  /** Label text from nodeLabel encoding or node id. */
  label: string | undefined;
  /** Label priority for level-of-detail rendering (0-1, degree/maxDegree). */
  labelPriority: number;
  /** Community/cluster assignment from the clustering field. */
  community: string | undefined;
  /** Opacity from the nodeOpacity encoding (default 1). Renderer multiplies into fill/stroke alpha. */
  opacity: number;
  /** Original node data (all fields from the spec node). */
  data: Record<string, unknown>;
}

/** A compiled graph edge with resolved visual properties (no positional endpoints). */
export interface CompiledGraphEdge {
  /** Source node id. */
  source: string;
  /** Target node id. */
  target: string;
  /** Stroke color from edgeColor encoding or theme default. */
  stroke: string;
  /** Stroke width from edgeWidth encoding (0.5-4px range, default 1px). */
  strokeWidth: number;
  /** Line style. */
  style: 'solid' | 'dashed' | 'dotted';
  /** Original edge data (all fields from the spec edge). */
  data: Record<string, unknown>;
}

/** Configuration for the force simulation, derived from the spec layout. */
export interface SimulationConfig {
  /** Repulsion strength between nodes. Negative = repulsion. */
  chargeStrength: number;
  /** Target distance between linked nodes. */
  linkDistance: number;
  /** Clustering configuration, or null if no clustering. */
  clustering: { field: string; strength: number } | null;
  /** How quickly the simulation cools. Default 0.0228. */
  alphaDecay: number;
  /** Velocity damping. Default 0.4. */
  velocityDecay: number;
  /** Collision radius: max node radius + padding. */
  collisionRadius: number;
  /** Extra px added to node radius for collision (default 2). */
  collisionPadding?: number;
  /** Link force strength override. */
  linkStrength?: number;
  /** Whether to apply center force (default true). */
  centerForce?: boolean;
  /** Deterministic layout seed (hashes into initial node positions). */
  seed?: number;
  /** Headless settle ticks run before first paint. 0/undefined disables warmup. */
  warmupTicks?: number;
  /** Wall-clock budget (ms) that caps warmup at scale. Default 250. */
  warmupBudgetMs?: number;
  /** Initial alpha for the simulation (update reheat / entrance). Default d3's 1. */
  initialAlpha?: number;
}

/**
 * The complete engine output for graph specs.
 *
 * Contains resolved visual properties for nodes and edges, but does NOT
 * include x/y positions. The adapter's force simulation assigns positions
 * at runtime using the simulationConfig.
 */
export interface GraphCompilation {
  /** Compiled nodes with visual properties. */
  nodes: CompiledGraphNode[];
  /** Compiled edges with visual properties. */
  edges: CompiledGraphEdge[];
  /** Legend layout (community colors or nodeColor categories). */
  legend: LegendLayout;
  /** Resolved chrome text elements. */
  chrome: ResolvedChrome;
  /** Tooltip descriptors keyed by node id. */
  tooltipDescriptors: Map<string, TooltipContent>;
  /** Accessibility metadata. */
  a11y: A11yMetadata;
  /** Resolved theme used for rendering. */
  theme: ResolvedTheme;
  /** Total available dimensions. */
  dimensions: { width: number; height: number };
  /** Force simulation configuration. */
  simulationConfig: SimulationConfig;
  /** Whether to show the brand watermark. */
  watermark: boolean;
  /** Resolved motion config, or undefined when `animation: false`. */
  animation?: ResolvedGraphAnimation;
  /** Resolved interaction config (always present, defaulted). */
  interaction: ResolvedGraphInteraction;
  /** The nodeColor field backing the legend/category emphasis, or null. */
  legendField: string | null;
  /** Categories to emphasize on load, captured from nodeColor.highlight. */
  initialHighlight?: { field: string; values: string[] };
  /** Edge legend entries (nominal edgeColor with >1 category), or undefined. */
  edgeLegend?: LegendEntry[];
}
