# LLM spec-generation eval

A small, repeatable eval that measures how reliably a reference model produces a
valid, renderable openchart spec from a plain-language charting request. It backs
the roadmap's ">=95% one-shot validity" target with a real number.

This is a **manual, per-release** eval. It hits the paid Anthropic API and is
**not** part of CI or the build gate.

## What it measures

For each task in `fixtures.json` (50 "chart X from this data" prompts spanning all
16 mark types plus tables), the runner asks the model to emit a spec, constraining
the output with the published JSON Schema (`packages/core/schema/chart.schema.json`
or `table.schema.json`) as a tool `input_schema`. It then scores three rates
against the shipped library code:

- **valid-spec rate** — the generated spec passes `validateSpec` from the built
  engine (the same validator an application runs).
- **render rate** — the valid spec also compiles to a `ChartLayout` via
  `compileChart` (a pure, DOM-free proxy for "it renders"); tables count as
  rendered when valid.
- **render-correct rate** — the spec additionally chose an acceptable mark for the
  request and referenced the expected data field (from each fixture's `expect`
  hints).

The tool schema constrains the spec shape; the runner attaches the fixture data
before validating so field-reference checks run against the real columns.

## Running it

```bash
bun run build                 # the runner imports the built engine
bun add -d @anthropic-ai/sdk  # not a monorepo dependency; CI never runs this
ANTHROPIC_API_KEY=sk-... node scripts/llm-eval/run.mjs
```

Flags:

- `--model <id>` — reference model (default `claude-opus-4-8`).
- `--limit <n>` — run only the first N tasks (for a quick smoke).
- `--write-baseline` — write `baseline.json` (summary + per-task results).

Record the summary numbers in `baseline.json` (via `--write-baseline`) each
release so regressions are visible in the diff. `baseline.json` is produced by the
first manual run; it is intentionally not committed empty.

## Adding tasks

Append to `tasks[]` in `fixtures.json`:

```json
{
  "id": "unique-slug",
  "prompt": "Natural-language charting request.",
  "data": [{ "col": "value" }],
  "expect": { "marks": ["bar", "barlist"], "field": "col" }
}
```

- `expect.marks` — mark types that are a reasonable answer (render-correct scoring
  accepts any of them). Omit and set `expect.type: "table"` for table tasks.
- `expect.field` — a data column the spec should reference somewhere.
