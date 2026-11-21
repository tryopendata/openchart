---
title: "JSON Schema and llms.txt"
description: "The published JSON Schema, runtime validation with validateSpec, the llms.txt and Markdown exports, and the OpenChart skill for coding agents."
section: machine-readable
order: 1
---

# JSON Schema and llms.txt

OpenChart publishes its spec grammar as a JSON Schema generated from the TypeScript types. This page also covers runtime validation, the Markdown exports of these docs and the agent skill.

See it: [Generating specs](../generating-specs.md) uses the schema as a tool definition, covers which schema to give a model and strict-mode tool use, and validates the result.

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

Without a local install, fetch the file from `https://unpkg.com/@opendata-ai/openchart-core/schema/vizspec.schema.json`. The schema checks shape only; it can't know which fields your data has, so validate with `validateSpec` before rendering.

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

The OpenChart docs site, https://openchart.steamfield.io, serves its pages as plain Markdown for agents and other tools:

| URL | Contents |
| --- | --- |
| `https://openchart.steamfield.io/llms.txt` | Every docs page by area and section, each with its description and the URL of its Markdown copy. |
| `https://openchart.steamfield.io/llms-full.txt` | Every page's Markdown copy, concatenated in sidebar order. |
| `https://openchart.steamfield.io/docs/<page>.md` | One page as Markdown: the title, the description, then the body. A live demo on the page becomes its spec in a `json` fence. This page is `https://openchart.steamfield.io/docs/machine-readable/json-schema.md`. |

The repository has its own [`llms.txt`](../../llms.txt) and [`llms-full.txt`](../../llms-full.txt) at its root, generated from the library types by `scripts/generate-llms.mjs`. They cover the spec grammar, install lines and the reference pages, for an agent working from a clone of the repository instead of the site.

## OpenChart skill

The OpenChart skill gives Claude Code the spec grammar, the encoding rules and editorial guidance for writing specs from your data. Install it from the [tryopendata/skills](https://github.com/tryopendata/skills) marketplace:

```shell
/plugin marketplace add tryopendata/skills
/plugin install openchart@openchart
/openchart
```

In Claude Code rules and prompts, reference it as `Skill(openchart:openchart)`.
