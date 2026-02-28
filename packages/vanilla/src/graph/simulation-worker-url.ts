/**
 * Creates a Web Worker running the force simulation.
 *
 * Uses the `new URL` + `import.meta.url` pattern recognized by Vite, Webpack 5,
 * Parcel, and esbuild. The bundler resolves the worker file path at build time
 * and handles the asset accordingly.
 *
 * - Vite dev (Ladle): resolves src/graph/simulation-worker.ts directly, serves
 *   it as a native ES module worker with on-the-fly TypeScript transform.
 * - Production (tsup + bun build): dist/simulation-worker.js is a self-contained
 *   IIFE produced by `bun build`. The consuming app's bundler copies it as an
 *   asset and rewrites the URL.
 *
 * Usage:
 *   import { createSimulationWorker } from '@openchart/vanilla';
 *   const worker = createSimulationWorker();
 *   worker.postMessage({ type: 'init', nodes, links, width: 800, height: 600 });
 *   worker.onmessage = (e) => console.log(e.data);
 */

/**
 * Path that resolves in Vite dev (workspace source) to the .ts file.
 * In production dist/, the consuming bundler resolves to simulation-worker.js
 * which sits alongside index.js in the dist folder.
 */
const workerUrl = new URL('./simulation-worker.ts', import.meta.url);

export function createSimulationWorker(): Worker {
  return new Worker(workerUrl, { type: 'module' });
}
