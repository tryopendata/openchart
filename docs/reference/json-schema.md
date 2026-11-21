---
title: "JSON Schema and llms.txt"
description: "Validate a spec with validateSpec, and read the error codes and JSON Pointer paths it returns."
section: machine-readable
order: 1
---
<!-- phase-4-stub -->

# JSON Schema and llms.txt

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
