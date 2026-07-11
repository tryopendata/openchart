/**
 * Concrete (non-generic) type aliases used as JSON Schema generation roots.
 *
 * `ts-json-schema-generator` cannot instantiate generic type parameters, so the
 * schema generator (`scripts/generate-schema.mjs`) points at these fixed
 * aliases instead of the generic `ChartSpec<TData>` / `TableSpec` directly.
 * They resolve every generic to its `DataRow` default, which is the shape an
 * LLM actually emits (untyped rows).
 *
 * These aliases exist only to shape schema output. They are not re-exported
 * from the package barrel and add no runtime surface.
 */

import type { ChartSpec, TableSpec, VizSpec } from './spec';

/**
 * Root for the full published schema (`vizspec.schema.json`). The complete
 * discriminated union of every openchart spec kind.
 */
export type VizSpecSchema = VizSpec;

/**
 * Root for the ChartSpec subset schema (`chart.schema.json`). Covers all 16
 * mark types. This is the LLM chart workhorse and the primary tool-use surface.
 */
export type ChartSpecSchema = ChartSpec;

/**
 * Root for the TableSpec subset schema (`table.schema.json`). The data-table
 * visualization spec.
 */
export type TableSpecSchema = TableSpec;
