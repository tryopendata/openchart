---
title: "JSON Schema and llms.txt"
description: "The published JSON Schema, runtime validation with validateSpec, the llms.txt and Markdown exports, and the OpenChart skill for coding agents."
section: machine-readable
order: 1
---

# JSON Schema and llms.txt

OpenChart publishes its spec grammar in forms a program or a language model can read: a JSON Schema generated from the TypeScript types, a validator that returns repairable errors, and plain-text copies of these docs. Use them when an LLM writes specs, when specs arrive from outside your code, or when an agent needs the docs in its context.

See it: [Generating specs](/docs/agents/generating-specs/) uses the schema as a tool definition and validates the result.

## JSON Schema

`@opendata-ai/openchart-core` ships three draft-07 schemas under its `schema` subpath:

| Import | Covers |
| --- | --- |
| `@opendata-ai/openchart-core/schema` | The full `VizSpec` union, every spec kind (the file is `vizspec.schema.json`). |
| `@opendata-ai/openchart-core/schema/chart.schema.json` | `ChartSpec` only. |
| `@opendata-ai/openchart-core/schema/table.schema.json` | `TableSpec` only. |

```ts
import vizSchema from "@opendata-ai/openchart-core/schema" with { type: "json" };
```

Without a local install, fetch the file from `https://unpkg.com/@opendata-ai/openchart-core/schema/vizspec.schema.json`. The schema checks shape only; it can't know which fields your data has, so validate with `validateSpec` before rendering. [Generating specs](../generating-specs.md) covers which schema to give a model and strict-mode tool use.

## Validation

The engine validates specs at runtime. Source: `engine/src/compiler/validate.ts`.

```ts
import { validateSpec } from "@opendata-ai/openchart-engine";

const result = validateSpec(spec);
// result.valid: boolean
// result.errors: ValidationError[]
// result.normalized: VizSpec | null
```

### ValidationError

| Field        | Type                  | Description                                                                                                                     |
| ------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `message`    | `string`              | Human-readable error description.                                                                                               |
| `path`       | `string`              | Root-relative RFC 6901 JSON Pointer to the value that failed, e.g. `'/encoding/x/field'` or `'/layer/1/data/0/value'`. The root is `''`. |
| `code`       | `ValidationErrorCode` | Machine-readable error code.                                                                                                    |
| `suggestion` | `string`              | Actionable fix suggestion.                                                                                                      |

### ValidationErrorCode

| Code                 | Meaning                                                                         |
| -------------------- | ------------------------------------------------------------------------------- |
| `INVALID_TYPE`       | Wrong type (expected object, got array, etc.).                                  |
| `MISSING_FIELD`      | Required field is missing.                                                      |
| `INVALID_VALUE`      | Field has an invalid value (bad chart type, bad dark mode string, etc.).        |
| `EMPTY_DATA`         | Data array is empty.                                                            |
| `DATA_FIELD_MISSING` | Encoding references a field that doesn't exist in the data.                     |
| `ENCODING_MISMATCH`  | Encoding type doesn't match the channel requirements or the actual data values. |

## llms.txt and Markdown exports

This site serves its docs as plain Markdown for agents and other tools:

| URL | Contents |
| --- | --- |
| `/llms.txt` | Every docs page by area and section, each with its description and the URL of its Markdown copy. |
| `/llms-full.txt` | Every page's Markdown copy, concatenated in sidebar order. |
| `/docs/<page>.md` | One page as Markdown: the title, the description, then the body. A live demo on the page becomes its spec in a `json` fence. This page is `/docs/machine-readable/json-schema.md`. |

The repository has its own [`llms.txt`](../../llms.txt) and [`llms-full.txt`](../../llms-full.txt) at its root, generated from the library types by `scripts/generate-llms.mjs`. They cover the spec grammar, install lines and the reference pages, for an agent working from a clone or the npm package instead of this site.

## OpenChart skill

The OpenChart skill gives Claude Code the spec grammar, the encoding rules and editorial guidance for writing specs from your data. Install it from the [tryopendata/skills](https://github.com/tryopendata/skills) marketplace:

```shell
/plugin marketplace add tryopendata/skills
/plugin install openchart@openchart
/openchart
```

In Claude Code rules and prompts, reference it as `Skill(openchart:openchart)`.
