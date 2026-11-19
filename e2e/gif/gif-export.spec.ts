/**
 * GIF export correctness gate.
 *
 * happy-dom can't rasterize a canvas, so the real "does it actually animate"
 * check has to run in a browser. The `testing-gif-export--gif-correctness`
 * story mounts an animated bar chart, exports a GIF via `chart.export('gif')`,
 * decodes its frame structure, and writes the result to `#gif-result`. This
 * spec reads that and asserts:
 *   1. the GIF has more than one frame (animated, not a static still), and
 *   2. an early frame's compressed bytes differ from the final frame's.
 *
 * That second assertion is the one the rejected "serialize the live CSS
 * animation" approach would have failed silently (identical frames every time).
 *
 * Run: bunx playwright test --project=gif
 */

import { expect, type Page, test } from '@playwright/test';

test('exportGIF produces a multi-frame GIF whose frames differ', async ({ page }) => {
  await page.goto('/?mode=preview&story=testing--gif-export--gif-correctness');

  const resultEl = page.locator('#gif-result');
  await resultEl.waitFor({ state: 'visible', timeout: 15_000 });

  // Poll until the async export completes (data-result stops being "pending").
  await expect
    .poll(async () => (await resultEl.getAttribute('data-result')) ?? 'pending', {
      timeout: 20_000,
    })
    .not.toBe('pending');

  const raw = (await resultEl.getAttribute('data-result')) ?? '';
  // eslint-disable-next-line no-console
  console.log('GIF correctness:', raw);
  expect(raw, `export failed: ${raw}`).not.toContain('error');

  const result = JSON.parse(raw) as {
    byteLength: number;
    frames: number;
    earlyDiffersFromLast: boolean;
  };
  expect(result.byteLength).toBeGreaterThan(100);
  expect(result.frames).toBeGreaterThan(1);
  expect(result.earlyDiffersFromLast).toBe(true);
});

test('exportSpecSequence produces a multi-frame GIF via the real encode primitives', async ({
  page,
}) => {
  // The unit suite mocks gif-encode wholesale; this is the only place
  // readCanvasSRGB and paletteFromCanvas run against a real rasterizer.
  await page.goto('/?mode=preview&story=testing--gif-export--sequence-correctness');

  const resultEl = page.locator('#gif-sequence-result');
  await resultEl.waitFor({ state: 'visible', timeout: 15_000 });

  await expect
    .poll(async () => (await resultEl.getAttribute('data-result')) ?? 'pending', {
      timeout: 30_000,
    })
    .not.toBe('pending');

  const raw = (await resultEl.getAttribute('data-result')) ?? '';
  expect(raw, `export failed: ${raw}`).not.toContain('error');

  const result = JSON.parse(raw) as {
    byteLength: number;
    frames: number;
    earlyDiffersFromLast: boolean;
  };
  expect(result.byteLength).toBeGreaterThan(100);
  // Two held keyframes plus tween frames between them.
  expect(result.frames).toBeGreaterThan(2);
  expect(result.earlyDiffersFromLast).toBe(true);
});

// ---------------------------------------------------------------------------
// Beyond charts: bar list, tile map, sankey and map (`gif-export-mounts.stories.tsx`)
// ---------------------------------------------------------------------------

interface MountEvidence {
  frames: number;
  sameSize: boolean;
  /** Mean absolute RGB difference, 0-255. */
  firstVsLast: number;
  lastVsPng: number;
  fillBetween?: boolean;
  slideBetween?: boolean;
  fadeBetween?: boolean;
  dimmedMax?: number;
  dimmedAtEnd?: [number, number];
  dimmedSettled?: [number, number];
}

async function mountEvidence(page: Page, story: string): Promise<MountEvidence> {
  await page.goto(`/?mode=preview&story=testing--gif-export-mounts--${story}`);
  const resultEl = page.locator('#gif-mount-result');
  await resultEl.waitFor({ state: 'visible', timeout: 15_000 });
  await expect
    .poll(async () => (await resultEl.getAttribute('data-result')) ?? 'pending', {
      timeout: 60_000,
    })
    .not.toBe('pending');
  const raw = (await resultEl.getAttribute('data-result')) ?? '';
  expect(raw, `export failed: ${raw}`).not.toContain('error');
  const evidence = JSON.parse(raw) as MountEvidence;
  // The entrance animates and settles on the PNG export. The residual is GIF
  // palette quantization (hatched no-data maps run highest, about 1.6); a
  // black background or a missing layer lands well above 100.
  expect(evidence.frames).toBeGreaterThan(2);
  expect(evidence.sameSize).toBe(true);
  expect(evidence.firstVsLast).toBeGreaterThan(2);
  expect(evidence.lastVsPng).toBeLessThan(3);
  return evidence;
}

// The dim a focused map rests unfocused features at (`FOCUS_DIM_OPACITY`).
const FOCUS_DIM = 0.25;

test.describe('GIF export beyond charts', () => {
  test('bar list: rows slide partway between 4px and rest', async ({ page }) => {
    const evidence = await mountEvidence(page, 'bar-list');
    expect(evidence.slideBetween).toBe(true);
  });

  test('tile map: tiles fade in', async ({ page }) => {
    const evidence = await mountEvidence(page, 'tile-map');
    expect(evidence.fadeBetween).toBe(true);
  });

  test('sankey: nodes and links fade in', async ({ page }) => {
    const evidence = await mountEvidence(page, 'sankey');
    expect(evidence.fadeBetween).toBe(true);
  });

  test('map: a feature fill passes strictly between the neutral and its color', async ({
    page,
  }) => {
    const evidence = await mountEvidence(page, 'geo-map');
    expect(evidence.fillBetween).toBe(true);
  });

  test('map with a focus: dimmed features end at the dim opacity', async ({ page }) => {
    const evidence = await mountEvidence(page, 'geo-map-focus');
    expect(evidence.dimmedMax).toBeLessThanOrEqual(FOCUS_DIM + 1e-6);
    for (const range of [evidence.dimmedAtEnd, evidence.dimmedSettled]) {
      expect(range?.[0]).toBeCloseTo(FOCUS_DIM, 6);
      expect(range?.[1]).toBeCloseTo(FOCUS_DIM, 6);
    }
  });
});
