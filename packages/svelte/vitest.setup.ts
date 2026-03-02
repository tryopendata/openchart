import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';
import { afterEach } from 'vitest';

// Ensure all chart renderers are registered (side-effect imports)
import '@opendata-ai/engine';

afterEach(() => {
  cleanup();
});

// happy-dom doesn't do layout, so getBoundingClientRect returns zeros.
// Mock it globally so chart components can compute dimensions.
HTMLElement.prototype.getBoundingClientRect = function () {
  return {
    width: 600,
    height: 400,
    top: 0,
    left: 0,
    right: 600,
    bottom: 400,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  };
};

// happy-dom doesn't implement Canvas 2D context. The Graph component's
// canvas renderer calls ctx.save(), ctx.setTransform(), etc. in its
// animation loop. Provide a no-op stub so those calls don't throw.
const noop = () => { };
const noopCtx: Record<string, unknown> = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === 'canvas') return { width: 600, height: 400 };
      if (prop === 'measureText') return () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 });
      return noop;
    },
  },
);
const origCreateElement = document.createElement.bind(document);
document.createElement = ((tag: string, options?: ElementCreationOptions) => {
  const el = origCreateElement(tag, options);
  if (tag === 'canvas') {
    (el as HTMLCanvasElement).getContext = () => noopCtx as unknown as CanvasRenderingContext2D;
  }
  return el;
}) as typeof document.createElement;
