---
title: How indexing works
description: What Acme reads, what it stores, and when it rebuilds the index.
group: concepts
sidebarLabel: How it works
---

Acme reads every Markdown file under the folder you give it and stores a search index in `.acme/` beside them.

## What gets indexed

Headings, paragraphs and code blocks are indexed. Front matter fields are indexed as filters.

### Files it skips

Hidden folders and anything matched by `.gitignore` stay out of the index.

## When the index rebuilds

> [!TIP]
> Run `acme index --watch` while you write, and the index updates as files change.

Without `--watch`, run `acme index` again after editing notes. See [the configuration reference](/docs/reference/configuration/#index-settings) for the settings that control this.
