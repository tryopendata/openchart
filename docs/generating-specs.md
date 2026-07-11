# Generating openchart specs with an LLM

openchart specs are plain JSON, and the library publishes a JSON Schema for them.
That makes LLM generation reliable in a way code generation is not: constrain the
model's output to the schema, validate the result against the *provided data*, and
feed repair-friendly errors back for a self-correcting loop. This page covers how
to wire that up.

## Contents

- [The published schema](#the-published-schema)
- [Which schema to use](#which-schema-to-use)
- [Plain tool use (Anthropic)](#plain-tool-use-anthropic)
- [Strict modes and the transform pass](#strict-modes-and-the-transform-pass)
- [The validate-and-repair loop](#the-validate-and-repair-loop)
- [Fetching the schema without a local install](#fetching-the-schema-without-a-local-install)

## The published schema

`@opendata-ai/openchart-core` ships three schema files under the `schema` subpath
export (not the main barrel, so a large JSON never lands in a consumer bundle):

| Import | Covers | Use for |
|--------|--------|---------|
| `@opendata-ai/openchart-core/schema` | Full `VizSpec` union (every spec kind) | Plain, non-strict tool `input_schema` |
| `@opendata-ai/openchart-core/schema/chart.schema.json` | `ChartSpec` (all 16 marks) | The LLM chart workhorse; strict-mode subset |
| `@opendata-ai/openchart-core/schema/table.schema.json` | `TableSpec` | Data tables; strict-mode subset |

The schemas are draft-07 and generated directly from the TypeScript spec types,
so they never drift from what the library actually accepts (CI fails a PR that
changes the spec without regenerating them).

```js
import chartSchema from '@opendata-ai/openchart-core/schema/chart.schema.json' with { type: 'json' };
```

## Which schema to use

- **Charts** (bar, line, area, point, arc, and the rest of the 16 marks): use
  `chart.schema.json`. It is the primary generation surface.
- **Tables**: use `table.schema.json`.
- **Anything, or "let the model pick the visualization"**: use the full VizSpec
  schema (`@opendata-ai/openchart-core/schema`). Note it is only usable as a
  *plain* (non-strict) tool input — see below.

## Plain tool use (Anthropic)

The full VizSpec schema and the per-type subsets all work directly as a plain
(non-strict) Anthropic tool `input_schema`. Give the model the charting request
and the data, and force the tool call:

```js
import Anthropic from '@anthropic-ai/sdk';
import chartSchema from '@opendata-ai/openchart-core/schema/chart.schema.json' with { type: 'json' };

const client = new Anthropic();

const message = await client.messages.create({
  model: 'claude-opus-4-8',
  max_tokens: 4096,
  thinking: { type: 'adaptive' },
  tools: [
    {
      name: 'emit_chart_spec',
      description:
        'Emit an openchart ChartSpec that answers the charting request for the provided data. Reference only fields that exist in the data.',
      input_schema: chartSchema,
    },
  ],
  tool_choice: { type: 'tool', name: 'emit_chart_spec' },
  messages: [
    {
      role: 'user',
      content: `Chart the monthly revenue.\n\nData:\n${JSON.stringify(rows)}`,
    },
  ],
});

const spec = message.content.find((b) => b.type === 'tool_use')?.input;
```

Then attach the data and validate before rendering (the schema constrains the
spec *shape*, but only the data tells you whether a referenced field exists):

```js
import { validateSpec } from '@opendata-ai/openchart-engine';

const withData = { ...spec, data: rows };
const { valid, errors } = validateSpec(withData);
```

## Strict modes and the transform pass

Structured-output "strict" modes are **not** direct-use with the full schema:

- **Anthropic strict mode** forbids recursion and requires every property to be
  listed in `required`.
- **OpenAI structured outputs** cap a schema at 100 total properties and 5 nesting
  levels, which the full VizSpec union exceeds structurally.

For strict modes, use a per-type **subset** schema (`chart.schema.json` or
`table.schema.json`) and apply this mechanical transform first:

1. Make every property `required` and wrap optional properties in a null union
   (`"type": ["string", "null"]` or `anyOf` with `{ "type": "null" }`).
2. Set `additionalProperties: false` on every object (the generated schemas
   already do this).
3. Strip keywords the target API does not support (`$comment`, format
   annotations it rejects, etc.).

Never claim strict-mode compatibility for the full VizSpec schema — ship the
subset. Measure the serialized token size of the subset against your API's limit
before shipping; the ChartSpec subset is the tightest surface the library offers.

## The validate-and-repair loop

Field-level validation against the provided data is what kills the dominant
failure mode (a spec that references a hallucinated column and renders an empty
chart). `validateSpec` returns machine-readable errors: each carries a `code`, the
offending `path`, and a repair-friendly `suggestion`. Misspelled field names get a
nearest-column "did you mean" hint.

```js
const { valid, errors } = validateSpec(withData);
if (!valid) {
  // Feed the errors back to the model for a one-shot repair.
  const repair = errors.map((e) => `${e.path}: ${e.message} ${e.suggestion}`).join('\n');
  // ...send `repair` back as a follow-up user turn, then re-validate.
}
```

A single repair round trip closes most remaining failures. Cap the loop (e.g. 2
attempts) so a fundamentally impossible request fails fast rather than looping.

## Fetching the schema without a local install

Fetch-capable agents with no local install can pull the schema from two stable
URLs (both serve the same file that ships in the package):

- unpkg: `https://unpkg.com/@opendata-ai/openchart-core/schema/vizspec.schema.json`
- GitHub raw, pinned to a release tag:
  `https://raw.githubusercontent.com/tryopendata/openchart/core-v<version>/packages/core/schema/vizspec.schema.json`

Swap `vizspec.schema.json` for `chart.schema.json` or `table.schema.json` as
needed. Pin to a release tag rather than `main` so the schema matches a published
library version.

For an MCP-only agent (no filesystem, no web fetch), the MCP server that exposes
openchart is the only channel: it should surface the current schema (or a compact
grammar digest) and return the library's validation errors through the tool result
so the agent can self-correct in-conversation.
