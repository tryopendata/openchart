/**
 * Shared DOM helpers for vanilla package tests.
 *
 * Provides container creation with mocked getBoundingClientRect (needed because
 * happy-dom has no layout engine) and mouse event construction.
 */

/**
 * Create an HTMLDivElement with mocked dimensions, appended to document.body.
 * happy-dom returns zero for getBoundingClientRect by default, so we provide
 * realistic values for the chart/table compilation pipeline to work with.
 */
export function createContainer(width = 600, height = 400): HTMLDivElement {
  const container = document.createElement('div');
  Object.defineProperty(container, 'getBoundingClientRect', {
    value: () => ({
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
  document.body.appendChild(container);
  return container;
}

/**
 * Create an auto-height container: its measured height is 0 until a chart
 * SVG is mounted, then tracks the SVG's own style.height — mimicking a real
 * DOM container with no explicit height that wraps its content.
 */
export function createAutoHeightContainer(width = 390): HTMLDivElement {
  const container = document.createElement('div');
  Object.defineProperty(container, 'getBoundingClientRect', {
    value: () => {
      const svg = container.querySelector('svg');
      const height = svg ? Number.parseFloat((svg as SVGElement).style.height) || 0 : 0;
      return {
        width,
        height,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    },
  });
  document.body.appendChild(container);
  return container;
}

/**
 * Create a MouseEvent with clientX/clientY coordinates.
 * happy-dom supports basic MouseEvent construction.
 */
export function createMouseEvent(type: string, x = 100, y = 100): MouseEvent {
  return new MouseEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
  });
}
