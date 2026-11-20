---
title: Build your first index
description: Index a folder of notes and ask Acme a question about them.
group: guides
---

This guide assumes Acme is [installed](/docs/getting-started/installation/).

## Index a folder

```sh title="Terminal"
acme index ~/notes
```

## Ask a question

```sh
acme ask "where did we decide on the cache size?"
```

Acme prints the matching file and the line that answers the question.

> [!WARNING]
> Questions only see notes that were indexed. Re-run `acme index` after large edits.
