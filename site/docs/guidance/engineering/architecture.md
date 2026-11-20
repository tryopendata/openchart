# Architecture

Give each module one responsibility and one reason to change. Start with the project's existing structure. Add a boundary when two areas change for different reasons or changes in one repeatedly break the other.

## Organize by domain

Keep a feature's rules, entry points and tests together. A payments folder should contain payment behavior; avoid scattering it across top-level controllers, services and models folders. Within a feature, separate orchestration, domain rules and I/O only as the code needs them. A small feature can stay in one file.

Keep domain rules independent of frameworks, storage and network clients. Entry points translate requests into application calls. Application code coordinates the work. Infrastructure implements the I/O contracts those calls need. Dependencies point toward the domain; shared packages never import application code.

## Make boundaries explicit

- Expose a small public interface for each module. Callers use that interface, without importing private files or reaching into another module's storage.
- Give independently changing domains their own models. Authentication and billing need different views of a user; avoid one object containing every field either could need.
- Define the input, output and failure contract before implementing an external API. Version contracts that cross service or team boundaries.
- Validate untrusted input where it enters: requests, files and third-party responses. Translate external data shapes there. Internal code works with the validated model; avoid repeating the same checks at every call.
- Pass dependencies explicitly where a module needs I/O. Define a narrow interface for the behavior the caller needs, keeping vendor-specific details in the adapter.

## Extract when the need is real

Split a file when it has separate reasons to change, when a dependency leaks across a boundary, or when its responsibility no longer fits a clear sentence. Extract shared code when multiple callers need the same concept and contract. Similar-looking code with different reasons to change can stay separate.

Avoid catch-all utils or shared folders. Put a helper with the concept that owns it; promote only stable, shared behavior. Keep shared modules small and give them names that describe their work.

Use direct calls for ordinary synchronous work. Introduce events for workflows that actually need asynchronous communication. Begin with modules in one application; extract a service when its boundary is proven and independent deployment is needed. A single implementation rarely needs a generic framework around it.

Use the standard library and existing dependencies first. Add a dependency for a current need, after checking its maintenance cost. Wrap a vendor SDK when replacement or isolation is realistic; don't wrap stable utilities by habit. Add caches only after measuring a bottleneck, with an explicit invalidation rule.

Read [code style](code-style.md) for file organization and architecture documentation.

Deeper: the `ce:architecting-systems` skill, when installed.
