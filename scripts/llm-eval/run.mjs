#!/usr/bin/env node
/**
 * LLM one-shot spec-generation eval for openchart (plan 20, deliverable 4).
 *
 * For each fixture in `fixtures.json`, this asks a reference model to produce an
 * openchart ChartSpec (or TableSpec) for a natural-language charting request,
 * constraining the output with the published JSON Schema as a tool
 * `input_schema`. It then measures two rates against the SHIPPED library code:
 *
 *   - valid-spec rate:   the generated spec passes `validateSpec` from the
 *                        built engine (the real validator an app would run).
 *   - render rate:       the valid spec also compiles to a ChartLayout via
 *                        `compileChart` (a pure, DOM-free proxy for "renders"),
 *                        AND matches the fixture's render-correctness hints
 *                        (chose an acceptable mark / referenced the right field).
 *
 * This is run MANUALLY per release (it hits the paid Anthropic API and is not
 * part of CI). Results are always printed; passing `--write-baseline` also
 * persists them to `baseline.json` so the roadmap's ">=95% one-shot validity"
 * target is measurable and regression-guarded.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... node scripts/llm-eval/run.mjs
 *   node scripts/llm-eval/run.mjs --model claude-opus-4-8 --limit 10
 *   node scripts/llm-eval/run.mjs --write-baseline
 *
 * Requires `@anthropic-ai/sdk` (not a monorepo dependency — CI never runs this).
 * If it is missing, this prints an install hint and exits without failing a
 * build.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');
const engineDist = join(repoRoot, 'packages', 'engine', 'dist', 'index.js');
const chartSchemaPath = join(repoRoot, 'packages', 'core', 'schema', 'chart.schema.json');
const tableSchemaPath = join(repoRoot, 'packages', 'core', 'schema', 'table.schema.json');
const fixturesPath = join(__dirname, 'fixtures.json');
const baselinePath = join(__dirname, 'baseline.json');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { model: 'claude-opus-4-8', limit: Number.POSITIVE_INFINITY, writeBaseline: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--model') args.model = argv[++i];
    else if (arg === '--limit') args.limit = Number.parseInt(argv[++i], 10);
    else if (arg === '--write-baseline') args.writeBaseline = true;
  }
  return args;
}

// ---------------------------------------------------------------------------
// Render-correctness scoring (heuristic, from fixture hints)
// ---------------------------------------------------------------------------

/** Extract the mark type string from a spec's `mark` field (string or object). */
function markOf(spec) {
  const mark = spec?.mark;
  if (typeof mark === 'string') return mark;
  if (mark && typeof mark === 'object' && typeof mark.type === 'string') return mark.type;
  return undefined;
}

/** Collect every `field` referenced anywhere in an encoding block. */
function encodedFields(spec) {
  const fields = new Set();
  const enc = spec?.encoding;
  if (enc && typeof enc === 'object') {
    for (const channel of Object.values(enc)) {
      if (channel && typeof channel === 'object' && typeof channel.field === 'string') {
        fields.add(channel.field);
      }
    }
  }
  for (const col of spec?.columns ?? []) {
    if (col && typeof col.key === 'string') fields.add(col.key);
  }
  return fields;
}

/**
 * Does the spec match the fixture's render-correctness hints? A spec "renders
 * correctly" when it chose an acceptable mark (or the table type) and referenced
 * the expected data field somewhere in its encoding/columns.
 */
function matchesExpectation(spec, expect) {
  if (expect.type === 'table') {
    if (spec?.type !== 'table') return false;
  } else if (expect.marks) {
    const mark = markOf(spec);
    if (!mark || !expect.marks.includes(mark)) return false;
  }
  if (expect.field) {
    if (!encodedFields(spec).has(expect.field)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!existsSync(engineDist)) {
    console.error(`Built engine not found at ${engineDist}. Run: bun run build`);
    process.exit(1);
  }

  let Anthropic;
  try {
    ({ default: Anthropic } = await import('@anthropic-ai/sdk'));
  } catch {
    console.error(
      'The eval runner needs @anthropic-ai/sdk (not a monorepo dependency).\n' +
        'Install it just to run the eval:\n\n' +
        '  bun add -d @anthropic-ai/sdk\n\n' +
        'Then re-run with ANTHROPIC_API_KEY set.',
    );
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Set ANTHROPIC_API_KEY to run the eval.');
    process.exit(1);
  }

  const { validateSpec, compileChart } = await import(pathToFileURL(engineDist).href);
  const chartSchema = JSON.parse(readFileSync(chartSchemaPath, 'utf8'));
  const tableSchema = JSON.parse(readFileSync(tableSchemaPath, 'utf8'));
  const { tasks } = JSON.parse(readFileSync(fixturesPath, 'utf8'));

  const client = new Anthropic();
  const selected = tasks.slice(0, args.limit);

  const results = [];
  for (const task of selected) {
    const wantsTable = task.expect?.type === 'table';
    const schema = wantsTable ? tableSchema : chartSchema;
    const toolName = wantsTable ? 'emit_table_spec' : 'emit_chart_spec';

    let spec;
    let apiError;
    try {
      const message = await client.messages.create({
        model: args.model,
        max_tokens: 4096,
        thinking: { type: 'adaptive' },
        tools: [
          {
            name: toolName,
            description:
              'Emit an openchart visualization spec that answers the charting request for the provided data. Reference only fields that exist in the data.',
            input_schema: schema,
          },
        ],
        tool_choice: { type: 'tool', name: toolName },
        messages: [
          {
            role: 'user',
            content: `Charting request: ${task.prompt}\n\nData (JSON rows):\n${JSON.stringify(task.data)}`,
          },
        ],
      });
      const toolUse = message.content.find((block) => block.type === 'tool_use');
      spec = toolUse?.input;
    } catch (err) {
      apiError = err instanceof Error ? err.message : String(err);
    }

    let valid = false;
    let rendered = false;
    let matched = false;
    let detail = apiError ?? '';

    if (spec) {
      // The tool constrains ChartSpec/TableSpec shape; the fixture data is the
      // source of truth for field references, so attach it before validating.
      const specWithData = { ...spec, data: task.data };
      const result = validateSpec(specWithData);
      valid = result.valid;
      if (!valid) detail = result.errors.map((e) => e.message).join('; ');
      if (valid && !wantsTable) {
        try {
          compileChart(specWithData, { width: 600, height: 400 });
          rendered = true;
        } catch (err) {
          detail = err instanceof Error ? err.message : String(err);
        }
      } else if (valid) {
        // Tables have no chart compile path; validity is the render proxy.
        rendered = true;
      }
      matched = valid && matchesExpectation(specWithData, task.expect ?? {});
    }

    results.push({ id: task.id, valid, rendered, matched, detail });
    const flag = matched ? 'OK ' : valid ? '~~ ' : 'XX ';
    console.log(`${flag}${task.id}${detail ? ` — ${detail.slice(0, 120)}` : ''}`);
  }

  const n = results.length;
  const validRate = results.filter((r) => r.valid).length / n;
  const renderRate = results.filter((r) => r.rendered).length / n;
  const matchRate = results.filter((r) => r.matched).length / n;

  const summary = {
    model: args.model,
    tasks: n,
    validRate: Number(validRate.toFixed(3)),
    renderRate: Number(renderRate.toFixed(3)),
    matchRate: Number(matchRate.toFixed(3)),
    ranAt: new Date().toISOString(),
  };

  console.log('\n=== Summary ===');
  console.log(`model:       ${summary.model}`);
  console.log(`tasks:       ${summary.tasks}`);
  console.log(`valid-spec:  ${(validRate * 100).toFixed(1)}%  (passes validateSpec)`);
  console.log(`render:      ${(renderRate * 100).toFixed(1)}%  (also compiles / valid table)`);
  console.log(`render-correct: ${(matchRate * 100).toFixed(1)}%  (correct mark + field)`);

  if (args.writeBaseline) {
    writeFileSync(baselinePath, `${JSON.stringify({ ...summary, results }, null, 2)}\n`);
    console.log(`\nWrote ${baselinePath}`);
  }
}

main();
