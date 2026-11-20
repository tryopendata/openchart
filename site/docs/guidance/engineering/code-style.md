# Code style

Write code a person can follow without reconstructing hidden assumptions. Follow the project's language and framework conventions, and use the existing formatter and linter. Keep each change focused on the requested behavior.

## Make the layout explain the system

Organize folders around features or domain concepts. Keep related behavior together so a reader can find a feature without hunting through folders named by file kind. Separate layers within a feature when that separation helps; don't create empty layers in anticipation of growth. [Architecture](architecture.md) describes responsibility and dependency direction.

Name files after what they contain. Prefer names such as invoice-totals or token-validation to helpers, manager or utils. Match the language's naming convention. Keep one responsibility per file, and put private helpers near the code that uses them. A file that needs several unrelated nouns to describe it probably needs splitting.

Give functions names that describe an action or result. A coordinating function should read as the steps of the operation, with the details in small named functions. Keep each function at one level of detail. Extract when a name makes the operation clearer or the logic has a separate responsibility; avoid a helper for every expression.

Prefer explicit data flow, early returns for invalid cases and ordinary control flow. Avoid nested conditionals, clever chains and flags whose meaning changes by context. Use domain names for values and types. A reader should know the units, ownership and meaning of a value without tracing every caller. Keep mutable state local and make side effects visible at the boundary.

## Explain each source file's role

Put a file-level doc comment at the top of every source file, after any required shebang, encoding declaration or build directive. State what the file does and how it fits the surrounding system. Keep it to a few useful sentences; don't list every symbol or copy the filename into a sentence.

Use the language's convention: `/** ... */` JSDoc for TypeScript and JavaScript, a module docstring for Python, a package comment for Go, and `//!` for Rust. For Java or Kotlin, use a doc comment describing the file's role above its main declaration where the language's tooling expects it. Keep required compiler directives in their valid positions. Update the header when the responsibility changes. Leave generated source to its generator.

## Give architectural folders a reading guide

Add a README.md to each folder that is a meaningful unit of the architecture. Explain what it owns, how it fits the system, what it depends on and where to start reading. Link to the public entry point or the file that coordinates the work. Describe the actual structure, and update it when that structure changes.

Use judgment: a fixtures folder, generated output or a folder with one obvious file may need no README. Write one when it helps a newcomer understand a boundary or choose an entry point. Avoid copies of a parent README.

Other comments explain why: a constraint, tradeoff, workaround or surprising edge case. Use names and types to explain ordinary mechanics. Remove comments your change makes stale, and record when a workaround can be removed.
