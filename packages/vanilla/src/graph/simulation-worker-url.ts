/**
 * Creates a Web Worker running the force simulation.
 *
 * References the built .js file via `new URL` + `import.meta.url`.
 * The consuming app's bundler resolves the worker path at build time.
 *
 * Note: SimulationManager handles .js/.ts fallback internally. This
 * helper is exported for consumers who want to manage the worker directly.
 */
export function createSimulationWorker(): Worker {
  return new Worker(new URL('./simulation-worker.js', import.meta.url), { type: 'module' });
}
