import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { MARK_CONTRACT_TYPES, MARK_OPTION_CASES } from '../../__test-fixtures__/mark-options';
import { compileChart, compileLayer } from '../../compile';
import { expandSpecSugar } from '../../compile/spec-sugar';
import { collectMarkOptionErrors } from '../mark-options';
import { validateSpec } from '../validate';

describe('mark option applicability (v9 errors)', () => {
  it.each(MARK_CONTRACT_TYPES)('checks every specialized option on %s', (type) => {
    for (const [option, { value, marks: allowed }] of Object.entries(MARK_OPTION_CASES)) {
      const errors = collectMarkOptionErrors({ mark: { type, [option]: value } });
      expect(errors.length, `${type}.${option}`).toBe(
        (allowed as readonly string[]).includes(type) ? 0 : 1,
      );
      if (errors.length) {
        expect(errors[0].path).toBe(`/mark/${option}`);
        expect(errors[0].suggestion).toContain('Remove');
      }
    }
  });
  it('rejects nested authored paths before density sugar strips options', () => {
    const spec = {
      layer: [
        {
          layer: [
            {
              mark: { type: 'density', binCount: 8, bandwidth: 2 },
              data: [{ x: 1 }, { x: 2 }, { x: 3 }],
              encoding: { x: { field: 'x', type: 'quantitative' } },
            },
          ],
        },
      ],
    };
    const result = validateSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: '/layer/0/layer/0/mark/binCount',
        code: 'INVALID_VALUE',
      }),
    );
    expect(result.errors.some((e) => e.path?.endsWith('/bandwidth'))).toBe(false);
    expect(() => expandSpecSugar(spec)).toThrow('/layer/0/layer/0/mark/binCount');
    expect(() => compileLayer(spec as never, { width: 600, height: 400 })).toThrow(
      '/layer/0/layer/0/mark/binCount',
    );
  });

  it('rejects an unsupported option at the public chart boundary', () => {
    expect(() =>
      compileChart(
        {
          mark: { type: 'bar', bandwidth: 2 },
          data: [{ x: 1 }],
          encoding: { x: { field: 'x', type: 'quantitative' } },
        },
        { width: 600, height: 400 },
      ),
    ).toThrow('/mark/bandwidth');
  });

  it.each(['histogram', 'density'])('accepts valid authored %s sugar', (type) => {
    const mark =
      type === 'histogram'
        ? { type, binCount: 5, normalize: true }
        : { type, bandwidth: 2, cumulative: true, steps: 25 };
    const layout = compileChart(
      {
        mark,
        data: [{ x: 1 }, { x: 2 }, { x: 4 }],
        encoding: { x: { field: 'x', type: 'quantitative' } },
      },
      { width: 600, height: 400 },
    );
    expect(layout.marks.length).toBeGreaterThan(0);
  });
});

// Validate the mark schemas actually shipped within ChartSpec. Retain definitions
// so gradient and trendline refs resolve through the same artifact as consumers.
interface Schema {
  [key: string]: unknown;
  anyOf?: Schema[];
  oneOf?: Schema[];
  allOf?: Schema[];
  definitions?: Record<string, Schema>;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
}
const chartSchema: Schema = JSON.parse(
  readFileSync(new URL('../../../../core/schema/chart.schema.json', import.meta.url), 'utf8'),
);
const authoredMark = {
  anyOf: chartSchema.definitions!.ChartSpec.anyOf!.map(
    (branch) => branch.allOf![1].properties!.mark,
  ),
};
const ajv = new Ajv({ strict: false, allowUnionTypes: true });
const validateMark = ajv.compile({ ...authoredMark, definitions: chartSchema.definitions });

/** The documented mechanical transform, applied recursively inside every anyOf.
 * No branch merging: that would erase the mark-specific contract. */
function strictTransform(schema: Schema): Schema {
  const result = structuredClone(schema);
  for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
    if (Array.isArray(result[key])) result[key] = result[key].map(strictTransform);
  }
  if (result.definitions)
    result.definitions = Object.fromEntries(
      Object.entries(result.definitions).map(([key, value]) => [
        key,
        strictTransform(value as Schema),
      ]),
    );
  if (result.properties) {
    const required = new Set(result.required ?? []);
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, value]) => {
        const property = strictTransform(value as Schema);
        return [key, required.has(key) ? property : { anyOf: [property, { type: 'null' }] }];
      }),
    );
    result.required = Object.keys(result.properties);
    result.additionalProperties = false;
  }
  if (result.items && typeof result.items === 'object')
    result.items = strictTransform(result.items);
  return result;
}
const strictMark = strictTransform({ ...authoredMark, definitions: chartSchema.definitions });
const validateStrictMark = ajv.compile(strictMark);

function withNullOptionals(type: string, option: string, value: unknown): Record<string, unknown> {
  const branch = authoredMark.anyOf.find((entry) => entry.anyOf![0].const === type)!.anyOf![1];
  const mark: Record<string, unknown> = Object.fromEntries(
    Object.keys(branch.properties!).map((key) => [key, null]),
  );
  return { ...mark, type, [option]: value };
}

describe('published mark contract parity', () => {
  it.each(
    MARK_CONTRACT_TYPES,
  )('agrees across schema and runtime for every option on %s', (type) => {
    for (const [option, { value, marks }] of Object.entries(MARK_OPTION_CASES)) {
      const expected = (marks as readonly string[]).includes(type);
      const mark = { type, [option]: value };
      expect(validateMark(mark), `${type}.${option}: published schema`).toBe(expected);
      expect(
        validateStrictMark(withNullOptionals(type, option, value)),
        `${type}.${option}: strict transform`,
      ).toBe(expected);
      expect(collectMarkOptionErrors({ mark }).length === 0, `${type}.${option}: runtime`).toBe(
        expected,
      );
    }
  });
});
