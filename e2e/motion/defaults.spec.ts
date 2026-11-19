import { expect, type Page, test } from '@playwright/test';
import { settleEntrances } from '../settle';

/**
 * Motion on by default, for every visualization type.
 *
 * Fixtures live in examples/src/testing/motion-parity.stories.tsx; their specs
 * omit `animation`. Nothing here waits on the wall clock: entrances are
 * observed through the CSS animations they start, and update tweens are
 * sampled once per animation frame until they land on a fresh static render
 * of the next spec.
 */

const url = (name: string) => `/?story=testing--motion-parity--${name}&mode=preview`;
const host = '[data-testid="parity-host"]';

/** What each fixture publishes (see the stories file). */
type ParityWindow = Window & {
  __parity: { instance: unknown; update(): void; reference(): HTMLElement };
};

/** CSS animations running on elements inside the fixture host. */
async function runningInHost(page: Page): Promise<number> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)!;
    return document
      .getAnimations()
      .filter((a) => a.playState === 'running')
      .filter((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target;
        return !!target && el.contains(target);
      }).length;
  }, host);
}

for (const [name, root] of [
  ['chart', 'svg.oc-chart'],
  ['table', '.oc-table-wrapper'],
  ['sankey', 'svg.oc-sankey'],
  ['tile-map', 'svg.oc-tilemap'],
  ['geo-map', 'svg.oc-map'],
  ['bar-list', 'svg.oc-barlist'],
] as const) {
  test(`${name} animates its entrance with no animation config`, async ({ page }) => {
    await page.goto(url(name));
    const rootEl = page.locator(`${host} ${root}`).first();
    await expect(rootEl).toHaveClass(/oc-animate/);
    // The fixture sits at the top of the page, so it is seen at once.
    await expect.poll(() => runningInHost(page)).toBeGreaterThan(0);
    await expect(rootEl).not.toHaveClass(/oc-animate/);
    expect(await runningInHost(page)).toBe(0);
  });
}

test('graph waits below the fold, then reveals with no animation config', async ({ page }) => {
  await page.goto(url('graph'));
  await page.locator(`${host} canvas`).first().waitFor();
  // The entrance pulls the camera back and flies it to the fit while the
  // nodes fade in. Scroll the graph in, then sample the camera every frame
  // until it holds still.
  const zooms = await page.evaluate(async (sel) => {
    const graph = (window as unknown as ParityWindow).__parity.instance as unknown as {
      entrancePlayed: boolean;
      getCamera(): { k: number };
    };
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    for (let i = 0; i < 30; i++) await frame();
    if (graph.entrancePlayed) throw new Error('the graph entrance played before it was seen');
    document.querySelector(sel)!.scrollIntoView({ block: 'center' });
    while (!graph.entrancePlayed) await frame();
    const ks: number[] = [graph.getCamera().k];
    let still = 0;
    for (let i = 0; i < 600 && still < 10; i++) {
      await frame();
      const k = graph.getCamera().k;
      still = ks.length > 0 && ks[ks.length - 1] === k ? still + 1 : 0;
      ks.push(k);
    }
    return ks;
  }, host);
  const distinct = [...new Set(zooms)];
  expect(distinct.length).toBeGreaterThan(3);
  // Flies in: the zoom only grows, and it rests at the fit.
  for (let i = 1; i < distinct.length; i++) expect(distinct[i]).toBeGreaterThan(distinct[i - 1]);
});

test('a chart below the fold waits to be scrolled to before its entrance plays', async ({ page }) => {
  await page.goto(url('below-fold'));
  const svg = page.locator(`${host} svg.oc-chart`);
  await expect(svg).toHaveClass(/oc-animate/);
  // Let 30 frames pass: still held, nothing running.
  const held = await page.evaluate(async (sel) => {
    for (let i = 0; i < 30; i++) await new Promise((r) => requestAnimationFrame(r));
    const root = document.querySelector(sel) as SVGSVGElement;
    return {
      animating: root.classList.contains('oc-animate'),
      playState: root.style.getPropertyValue('--oc-play-state'),
      running: document.getAnimations().filter((a) => a.playState === 'running').length,
    };
  }, `${host} svg.oc-chart`);
  expect(held).toEqual({ animating: true, playState: 'paused', running: 0 });

  await svg.scrollIntoViewIfNeeded();
  await expect.poll(() => runningInHost(page)).toBeGreaterThan(0);
  await expect(svg).not.toHaveClass(/oc-animate/);
});

test('animation: false renders every type static', async ({ page }) => {
  await page.goto(url('animation-false'));
  for (const kind of ['chart', 'table', 'sankey', 'tilemap', 'map', 'barlist']) {
    await expect(page.getByTestId(`static-${kind}`).locator('svg, table').first()).toBeVisible();
  }
  await page.getByTestId('static-graph').locator('canvas').first().waitFor();
  const result = await page.evaluate(async () => {
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    // Scroll through the page so a held entrance, if any, would play.
    for (const el of document.querySelectorAll('[data-testid^="static-"]')) {
      el.scrollIntoView({ block: 'center' });
      await frame();
      await frame();
    }
    const graph = (
      document.querySelector('[data-testid="static-graph"]') as HTMLElement & {
        __instance: { entrancePlayed: boolean; getCamera(): { k: number } };
      }
    ).__instance;
    const ks: number[] = [];
    for (let i = 0; i < 10; i++) {
      await frame();
      ks.push(graph.getCamera().k);
    }
    return {
      animateRoots: document.querySelectorAll('.oc-animate').length,
      animations: document.getAnimations().length,
      graphPlayed: graph.entrancePlayed,
      graphZooms: new Set(ks).size,
    };
  });
  expect(result).toEqual({ animateRoots: 0, animations: 0, graphPlayed: true, graphZooms: 1 });
});

test('mounting empty then updating plays the entrance on the real data', async ({ page }) => {
  await page.goto(url('empty-then-update'));
  // The fixture updates 200ms after mount; the entrance waits for real marks.
  const marks = page.locator(`${host} .oc-mark-rect`);
  await expect(marks).toHaveCount(4);
  const markAnimations = await page.evaluate(
    (sel) =>
      document.getAnimations().filter((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target;
        return !!target && !!target.closest(sel);
      }).length,
    `${host} .oc-marks`,
  );
  expect(markAnimations).toBeGreaterThan(0);
  await expect(page.locator(`${host} svg.oc-chart`)).not.toHaveClass(/oc-animate/);
});

// ---------------------------------------------------------------------------
// Update tweens
// ---------------------------------------------------------------------------

interface Probe {
  story: string;
  /** Element inside a host whose attribute tweens. */
  target: { selector: string; text?: string };
  attr: string;
  color?: boolean;
}

const probes: Probe[] = [
  {
    story: 'bar-list',
    target: { selector: '.oc-barlist-row:not(.oc-ghost)', text: 'Beta' },
    attr: 'width',
  },
  // The tile map's sequential scale shades one hue through fill-opacity.
  { story: 'tile-map', target: { selector: '.oc-tilemap-tile[data-state="CA"] rect' }, attr: 'fill-opacity' },
  {
    story: 'tile-map-categorical',
    target: { selector: '.oc-tilemap-tile[data-state="CA"] rect' },
    attr: 'fill',
    color: true,
  },
  { story: 'sankey', target: { selector: '.oc-sankey-node[data-node-id="Homes"] rect' }, attr: 'y' },
  { story: 'geo-map', target: { selector: 'circle.oc-map-point[data-point-key="LA"]' }, attr: 'r' },
];

for (const probe of probes) {
  test(`${probe.story} update tweens ${probe.attr} from the old value to the new one`, async ({
    page,
  }) => {
    await page.goto(url(probe.story));
    await page.locator(`${host} svg`).first().waitFor();
    // An update during the entrance snaps, so let it finish first.
    await settleEntrances(page);

    const { from, to, samples } = await page.evaluate(async ({ target, attr, color }) => {
      const read = (scope: Element): number[] => {
        let el = [...scope.querySelectorAll(target.selector)].find(
          (e) => !target.text || e.textContent?.includes(target.text),
        );
        if (el && target.text) el = el.querySelector('.oc-barlist-bar') ?? undefined;
        if (!el) throw new Error(`no ${target.selector} ${target.text ?? ''}`);
        const value = el.getAttribute(attr)!;
        if (!color) return [Number(value)];
        const ctx = new OffscreenCanvas(1, 1).getContext('2d')!;
        ctx.fillStyle = value;
        ctx.fillRect(0, 0, 1, 1);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
      };
      const parity = (window as unknown as ParityWindow).__parity;
      const live = document.querySelector('[data-testid="parity-host"]')!;
      const from = read(live);
      // A fresh render of the next spec with animation off: where it must land.
      const to = read(parity.reference());
      const same = (a: number[], b: number[]) => a.every((v, i) => v === b[i]);

      parity.update();
      // From-states are written before the first frame.
      const samples = [read(live)];
      let landed = 0;
      for (let i = 0; i < 600 && landed < 3; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        const value = read(live);
        samples.push(value);
        landed = same(value, to) ? landed + 1 : 0;
      }
      return { from, to, samples };
    }, probe);

    expect(from).not.toEqual(to);
    expect(samples[0]).toEqual(from);
    expect(samples[samples.length - 1]).toEqual(to);

    // Project each sample onto the from→to line: 0 at from, 1 at to.
    const span = to.map((v, i) => v - from[i]);
    const len2 = span.reduce((s, d) => s + d * d, 0);
    const progress = samples.map((s) => s.reduce((acc, v, i) => acc + (v - from[i]) * span[i], 0) / len2);
    // Every channel stays inside the from/to box.
    for (const s of samples) {
      s.forEach((v, i) => {
        expect(v).toBeGreaterThanOrEqual(Math.min(from[i], to[i]));
        expect(v).toBeLessThanOrEqual(Math.max(from[i], to[i]));
      });
    }
    // The in-between frames: strictly between, never going back.
    const between = progress.filter((p) => p > 0 && p < 1);
    expect(between.length).toBeGreaterThan(3);
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1]);
    }
    const firstTo = progress.findIndex((p) => p === 1);
    expect(progress.slice(0, firstTo).every((p) => p < 1)).toBe(true);
    expect(progress.slice(firstTo).every((p) => p === 1)).toBe(true);
  });
}
