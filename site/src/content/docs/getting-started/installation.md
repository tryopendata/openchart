---
title: Installation
description: Install Acme with npm, bun or Homebrew and check that it runs.
group: getting-started
order: 1
---

Acme runs on macOS, Linux and Windows. Pick one package manager below.

## Install

```sh title="Terminal"
npm install -g acme
```

Homebrew users can run `brew install acme` instead.

> [!NOTE]
> Acme stores its index next to your notes, in `.acme/`. Add that folder to `.gitignore` if your notes live in a git repository.

## Check the install

```sh
acme --version
```

The command prints the installed version. Next, read [how indexing works](/docs/concepts/how-it-works/) or go straight to [your first index](/docs/guides/first-index/).
