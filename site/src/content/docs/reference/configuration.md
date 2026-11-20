---
title: Configuration
description: Every setting in acme.toml, with its default.
group: reference
---

Acme reads `acme.toml` from the indexed folder. Every setting is optional.

## Index settings

| Setting   | Default | What it does                                   |
| --------- | ------- | ---------------------------------------------- |
| `include` | `**/*.md` | Glob of files to index                       |
| `exclude` | `[]`    | Globs to skip, on top of `.gitignore`          |
| `watch`   | `false` | Rebuild the index when files change            |

## Example

```toml title="acme.toml"
include = "notes/**/*.md"
exclude = ["archive/**"]
watch = true
```

> [!IMPORTANT]
> Paths are relative to the folder that holds `acme.toml`.
