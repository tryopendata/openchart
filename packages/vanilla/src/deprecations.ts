const emitted = new WeakMap<typeof console.warn, Set<string>>();

/** Runtime compatibility warnings are emitted once per process and console sink. */
export function warnDeprecated(message: string): void {
  const sink = console.warn;
  let seen = emitted.get(sink);
  if (!seen) {
    seen = new Set();
    emitted.set(sink, seen);
  }
  if (seen.has(message)) return;
  seen.add(message);
  sink(`[openchart] ${message}`);
}
