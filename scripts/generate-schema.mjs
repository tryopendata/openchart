#!/usr/bin/env node
/**
 * Generate JSON Schema files for the openchart spec surface.
 *
 * Reads the hand-written TypeScript types in
 * `packages/core/src/types/schema-roots.ts` (concrete, non-generic aliases over
 * `VizSpec` / `ChartSpec` / `TableSpec`) and emits three schema files into
 * `packages/core/schema/`:
 *
 *   - vizspec.schema.json  Full VizSpec union (every spec kind). Usable as a
 *                          plain, non-strict Anthropic tool `input_schema`.
 *   - chart.schema.json    ChartSpec subset (all 16 marks). The LLM workhorse.
 *   - table.schema.json    TableSpec subset.
 *
 * The generator applies one mechanical dedup pass: the ChartSpec union repeats
 * an identical block of shared chart properties across all 16 mark members
 * (only `mark` and `encoding` differ). That block is hoisted into a shared
 * `ChartSpecBase` `$def` and each member references it via `allOf`. This keeps
 * the emitted schema valid while removing ~15x repetition.
 *
 * Run `node scripts/generate-schema.mjs`. Pass `--check` to fail (exit 1) if
 * the committed files differ from a fresh generation (used by CI to guarantee
 * the schema never drifts from `spec.ts`).
 *
 * When the spec types change, re-run without `--check` and commit the result.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGenerator } from 'ts-json-schema-generator';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const corePath = join(repoRoot, 'packages', 'core');
const schemaDir = join(corePath, 'schema');
const rootsFile = join(corePath, 'src', 'types', 'schema-roots.ts');
const tsconfig = join(corePath, 'tsconfig.json');

/** Schema roots to emit: [output filename, root type name]. */
const ROOTS = [
  ['vizspec.schema.json', 'VizSpecSchema'],
  ['chart.schema.json', 'ChartSpecSchema'],
  ['table.schema.json', 'TableSpecSchema'],
];

/**
 * Hoist the repeated per-mark base into a shared `$def`.
 *
 * `ts-json-schema-generator` inlines the (generic) BaseChartSpec into all 16
 * ChartSpec union members. Every member carries an identical set of properties
 * except `mark` and `encoding`. This collapses that repetition: it extracts the
 * shared properties into `definitions.ChartSpecBase` and rewrites each member
 * to `allOf: [{ $ref: ChartSpecBase }, { mark, encoding }]`.
 *
 * No-op when the schema has no ChartSpec union (e.g. the table subset).
 */
function hoistChartBase(schema) {
  const defs = schema.definitions;
  if (!defs) return schema;
  // ChartSpec is emitted as its own def and referenced by the roots.
  const chart = defs.ChartSpec;
  if (!chart || !Array.isArray(chart.anyOf) || chart.anyOf.length === 0) return schema;

  const members = chart.anyOf;
  // Every member must be an object schema with `mark`/`encoding` plus a shared
  // block. Derive the shared block from the first member.
  const first = members[0];
  if (!first || first.type !== 'object' || !first.properties) return schema;

  const { mark: _m, encoding: _e, ...baseProps } = first.properties;
  const baseKeys = JSON.stringify(Object.keys(baseProps).sort());

  // Confirm every member shares the exact same base property set. If any member
  // diverges, skip the dedup rather than emit an incorrect schema.
  const uniform = members.every((member) => {
    if (member.type !== 'object' || !member.properties) return false;
    const { mark, encoding, ...rest } = member.properties;
    if (mark === undefined || encoding === undefined) return false;
    return JSON.stringify(Object.keys(rest).sort()) === baseKeys;
  });
  if (!uniform) return schema;

  // The shared base carries `mark`/`encoding` as permissive placeholders and
  // keeps `additionalProperties: false`. Each union member `allOf`-narrows
  // `mark`/`encoding` to its concrete mark. Placing them in the base is what
  // makes `additionalProperties: false` correct: JSON Schema's
  // `additionalProperties` only sees properties declared in the SAME subschema,
  // not sibling `allOf` branches, so mark/encoding must live alongside the base
  // props or a valid spec would be rejected as having "additional properties".
  defs.ChartSpecBase = {
    type: 'object',
    additionalProperties: false,
    properties: {
      mark: { description: 'Mark type (string shorthand or MarkDef object).' },
      encoding: { description: 'Encoding channel map.' },
      ...baseProps,
    },
  };

  chart.anyOf = members.map((member) => ({
    allOf: [
      { $ref: '#/definitions/ChartSpecBase' },
      {
        type: 'object',
        required: member.required,
        properties: {
          mark: member.properties.mark,
          encoding: member.properties.encoding,
        },
      },
    ],
  }));

  return schema;
}

function generateSchema(rootType) {
  const generator = createGenerator({
    path: rootsFile,
    tsconfig,
    type: rootType,
    // Types are validated by `bun run typecheck`; skip the redundant (slow)
    // type-check pass here.
    skipTypeCheck: true,
    expose: 'export',
    topRef: true,
    jsDoc: 'extended',
    additionalProperties: false,
  });
  return hoistChartBase(generator.createSchema(rootType));
}

/** Stable, human-readable serialization (sorted top-level, 2-space indent). */
function serialize(schema) {
  return `${JSON.stringify(schema, null, 2)}\n`;
}

function main() {
  const check = process.argv.includes('--check');

  if (!existsSync(schemaDir)) {
    if (check) {
      console.error(`Schema directory missing: ${schemaDir}. Run: node scripts/generate-schema.mjs`);
      process.exit(1);
    }
    mkdirSync(schemaDir, { recursive: true });
  }

  let drifted = false;

  for (const [filename, rootType] of ROOTS) {
    const outPath = join(schemaDir, filename);
    const next = serialize(generateSchema(rootType));

    if (check) {
      const current = existsSync(outPath) ? readFileSync(outPath, 'utf8') : '';
      if (current !== next) {
        drifted = true;
        console.error(
          `Schema drift: ${filename} is out of date. Run: node scripts/generate-schema.mjs`,
        );
      }
    } else {
      writeFileSync(outPath, next);
      const tokens = Math.round(next.length / 4);
      console.log(`Wrote ${filename} (${next.length} bytes, ~${tokens} tokens)`);
    }
  }

  if (check && drifted) process.exit(1);
  if (check) console.log('Schema is up to date.');
}

main();
