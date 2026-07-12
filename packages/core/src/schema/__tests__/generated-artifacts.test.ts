/**
 * Smoke test that the generated LLM-facing artifacts cover every mark type.
 *
 * `scripts/generate-schema.mjs` and `scripts/generate-llms.mjs` emit the
 * committed `packages/core/schema/*.json` and root `llms.txt`. This test
 * asserts the two artifacts reference all 16 declared mark types, so adding a
 * mark to MARK_TYPES without regenerating (or a generator regression that drops
 * a mark) is caught here rather than shipping a schema/doc that silently omits
 * it. CI's `check:generated` step guarantees the artifacts are fresh; this test
 * guarantees they are complete.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MARK_TYPES } from '../../types/spec';

const coreRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const repoRoot = join(coreRoot, '..', '..');

const chartSchema = readFileSync(join(coreRoot, 'schema', 'chart.schema.json'), 'utf8');
const llmsTxt = readFileSync(join(repoRoot, 'llms.txt'), 'utf8');

describe('generated artifacts cover every mark type', () => {
  it('chart.schema.json references all 16 mark types', () => {
    for (const mark of MARK_TYPES) {
      expect(chartSchema, `chart.schema.json is missing mark "${mark}"`).toContain(`"${mark}"`);
    }
  });

  it('llms.txt documents all 16 mark types in the grammar table', () => {
    for (const mark of MARK_TYPES) {
      // The generated mark table renders each mark as an inline-code cell.
      expect(llmsTxt, `llms.txt is missing mark "${mark}"`).toContain(`\`${mark}\``);
    }
  });

  it('MARK_TYPES has exactly 16 entries (the surface this plan targets)', () => {
    expect(MARK_TYPES.size).toBe(16);
  });
});
