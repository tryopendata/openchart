import { expect, test } from '@playwright/test';
import path from 'node:path';
import type { ChartInstance } from '../../packages/vanilla/src/mount';

type ReviewWindow = Window & { releaseChart: ChartInstance };
const rendererModule = `/@fs${path.resolve(__dirname, '../../packages/vanilla/src/mount.ts')}`;

const fixture = '/?story=testing--library-contracts--lifecycle&mode=preview';
const renderers = [
  ['Bar list', '.oc-barlist-row'], ['Map', '.oc-map-feature'], ['Tile map', '.oc-tilemap-tile'], ['Sankey', '.oc-sankey-node'],
] as const;

for (const [name, selector] of renderers) {
  test(`${name}: keyboard evidence, native Tab exit, resize, rejected edit and settled export`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(fixture);
    await page.getByRole('combobox', { name: 'Renderer', exact: true }).selectOption(name);
    const host = page.getByTestId('library-host');
    const first = host.locator(selector).first();
    await expect(first).toBeVisible();
    await expect(host.locator('svg').first()).not.toHaveClass(/oc-animate/);
    await first.focus();
    await page.keyboard.press('ArrowRight');
    const focused = host.locator('[data-navigation-key]:focus');
    await expect(focused).toHaveCount(1);
    const key = await focused.getAttribute('data-navigation-key');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('selected-evidence')).not.toHaveText('No selection');
    if (name !== 'Map' || await focused.getAttribute('data-nodata') !== 'true') {
      await expect(host.locator('.oc-tooltip')).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await expect(host.locator('.oc-tooltip')).toBeHidden();
    await page.keyboard.press('Tab');
    if (name === 'Map') {
      // Zoom controls are legitimate extra stops, but map marks must not trap Tab.
      await expect(focused).toHaveCount(0);
    } else {
      await expect(focused).toHaveCount(0);
      // Attribution links remain ordinary page navigation stops.
      if (await host.locator('a:focus').count()) await page.keyboard.press('Tab');
      await expect(host.locator('[data-navigation-key]:focus')).toHaveCount(0);
    }
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => host.locator('[data-navigation-key]:focus').getAttribute('data-navigation-key')).toBe(key);
    await expect.poll(async () => Number((await host.locator('svg').first().getAttribute('viewBox'))!.split(' ')[2])).toBeLessThan(391);
    await page.getByRole('button', { name: 'Reject invalid update', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Invalid data rejected; previous view preserved');
    await expect(first).toBeVisible();
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(host).toContainText(`${name}: revision 1`);
    const textFits = await host.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return [...element.querySelectorAll('.oc-title,.oc-subtitle')].every((text) => {
        const box = text.getBoundingClientRect();
        return box.left >= bounds.left - 1 && box.right <= bounds.right + 1;
      });
    });
    expect(textFits).toBe(true);
    await expect(host.locator('svg').first()).not.toHaveClass(/oc-animate/);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.svg$/);
    expect(await download.failure()).toBeNull();
    expect(errors).toEqual([]);
  });
}

test('table: Escape wins over pending search, sort retains focus and priority cells stay navigable', async ({ page }) => {
  await page.goto(fixture);
  await page.getByRole('combobox', { name: 'Renderer', exact: true }).selectOption('Table');
  const host = page.getByTestId('library-host');
  const search = host.locator('input');
  await search.fill('California');
  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(host.locator('tbody')).toBeFocused();
  // Prove the stale query never returns. The pending search is a 200ms
  // setTimeout in table-mount.ts (handleSearchInput), scheduled before Escape.
  // A page-side timer of the same delay scheduled now runs after it (equal
  // delays run in scheduling order), so if the stale search were going to
  // fire it has already re-rendered by the time this resolves.
  await expect(host.locator('tbody tr')).toHaveCount(10);
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 200)));
  await expect(host.locator('tbody tr')).toHaveCount(10);
  const header = host.locator('th[data-column="state"]');
  await header.focus();
  await page.keyboard.press('Enter');
  await expect(header).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(host.locator('.oc-table-cell-focus')).toHaveText('California');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('selected-evidence')).toContainText('California');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(host.locator('.oc-table--priority')).toBeVisible();
  await expect(host.locator('tbody')).toBeFocused();
  await page.keyboard.press('End');
  await expect(host.locator('.oc-table-cell-focus')).toBeVisible();
  await expect(host.locator('.oc-table-cell-focus')).toContainText('More');
  const summary = host.locator('summary').first();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(host.locator('details').first()).toHaveAttribute('open', '');
  await page.keyboard.press('Space');
  await expect(host.locator('details').first()).not.toHaveAttribute('open');
});

test('graph: the canvas releases both Tab directions', async ({ page }) => {
  await page.goto('/?story=graphs--graphs&mode=preview');
  const canvas = page.locator('.oc-graph-canvas').first();
  await expect(canvas).toBeVisible();
  await canvas.focus();
  await page.keyboard.press('Tab');
  await expect(canvas).not.toBeFocused();
  await canvas.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(canvas).not.toBeFocused();
});

test('canvas updates and resizes retain visible, interactive SVG chrome above the paint layer', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await page.goto(fixture);
  await expect(page.getByTestId('library-host').locator('svg').first()).toBeVisible();
  await page.evaluate(async (moduleUrl) => {
    const { createChart } = await import(moduleUrl);
    const host = document.createElement('div');
    host.id = 'release-review-chart';
    host.style.cssText = 'width:600px;height:400px;margin:24px;background:white';
    document.body.replaceChildren(host);
    const spec = {
      mark: 'point',
      animation: { enter: false, update: true },
      chrome: { title: 'Canvas scatter after update', subtitle: 'Axes and chrome stay above the canvas surface' },
      data: Array.from({ length: 60 }, (_, i) => ({ id: i, x: i % 10, y: (i * 17) % 100 })),
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
        key: { field: 'id', type: 'nominal' },
      },
    };
    const chart: ChartInstance = createChart(host, spec, { renderer: 'canvas', responsive: false });
    (window as ReviewWindow).releaseChart = chart;
    chart.update({ ...spec, data: spec.data.map((row) => ({ ...row, y: 100 - row.y })) });
  }, rendererModule);
  const host = page.locator('#release-review-chart');
  await expect(host.locator('svg')).not.toHaveClass(/oc-transitioning/);
  const chromeAboveCanvas = () => host.evaluate((element) => {
    const canvas = element.querySelector('canvas')!;
    const svg = element.querySelector('svg')!;
    const title = element.querySelector('.oc-title')!;
    const bounds = title.getBoundingClientRect();
    const top = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    return !!(canvas.compareDocumentPosition(svg) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      !!top && (top === title || title.contains(top));
  });
  expect(await chromeAboveCanvas()).toBe(true);
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('#release-review-chart')!.style.width = '800px';
    (window as ReviewWindow).releaseChart.resize();
  });
  await expect(host.locator('svg')).not.toHaveClass(/oc-transitioning/);
  expect(await chromeAboveCanvas()).toBe(true);
  const screenshot = testInfo.outputPath('canvas-after-update-and-resize.png');
  await host.screenshot({ path: screenshot });
  await testInfo.attach('canvas-after-update-and-resize', { path: screenshot, contentType: 'image/png' });
});

test('donut labels remain attached to their slices while a resized center is in motion', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await page.goto(fixture);
  await expect(page.getByTestId('library-host').locator('svg').first()).toBeVisible();
  const frames = await page.evaluate(async (moduleUrl) => {
    const { createChart } = await import(moduleUrl);
    const host = document.createElement('div');
    host.id = 'release-review-chart';
    host.style.cssText = 'width:600px;height:400px;margin:24px;background:white';
    document.body.replaceChildren(host);
    const spec = {
      mark: { type: 'arc', innerRadius: 55 },
      animation: { preset: 'fluid', enter: false },
      chrome: { title: 'Donut resized with attached labels' },
      data: [{ status: 'Healthy', value: 24 }, { status: 'Degraded', value: 4 }, { status: 'Down', value: 2 }],
      encoding: {
        theta: { field: 'value', type: 'quantitative' },
        color: { field: 'status', type: 'nominal' },
      },
      labels: { density: 'all' }, legend: { show: false },
    };
    const chart: ChartInstance = createChart(host, spec, { responsive: false });
    (window as ReviewWindow).releaseChart = chart;
    const original = chart.layout;
    host.style.width = '800px';
    host.style.height = '500px';
    const handle = chart.beginManualUpdate(spec)!;
    if (!handle) throw new Error('Expected a resize transition');
    const positions = (layout: typeof chart.layout, progress: number) => layout.marks.flatMap((mark) => {
      if (mark.type !== 'arc' || !mark.label?.visible) return [];
      const before = original.marks.find((item) => item.key === mark.key);
      const after = chart.layout.marks.find((item) => item.key === mark.key);
      if (before?.type !== 'arc' || after?.type !== 'arc' || !before.label || !after.label)
        throw new Error('Missing label endpoints');
      const group = [...host.querySelectorAll<SVGGElement>('.oc-mark-arc')].find((element) => element.getAttribute('data-key') === mark.key)!;
      const text = group.querySelector<SVGTextElement>('.oc-mark-label')!;
      const transform = group.transform.baseVal.consolidate()!.matrix;
      return [{ expectedX: before.label.x + (after.label.x - before.label.x) * progress,
        expectedY: before.label.y + (after.label.y - before.label.y) * progress,
        expectedCenterX: mark.center.x, expectedCenterY: mark.center.y,
        actualCenterX: transform.e, actualCenterY: transform.f,
        actualX: text.x.baseVal.getItem(0).value + transform.e,
        actualY: text.y.baseVal.getItem(0).value + transform.f }];
    });
    const initial = positions(original, 0);
    handle.step(150);
    const sampled = chart.sampleLayout();
    const moving = sampled.marks.find((mark) => mark.type === 'arc' && mark.label?.visible);
    const before = original.marks.find((mark) => mark.key === moving?.key);
    const after = chart.layout.marks.find((mark) => mark.key === moving?.key);
    if (moving?.type !== 'arc' || before?.type !== 'arc' || after?.type !== 'arc' ||
      before.center.x === after.center.x) throw new Error('Expected a moving arc center');
    // sampleLayout samples centers, while label metadata describes the destination.
    // Derive the label's expected progress from the current center, not that metadata.
    const progress = (moving.center.x - before.center.x) / (after.center.x - before.center.x);
    const midpoint = positions(sampled, progress);
    // Keep the manual frame visible for screenshot inspection; destroy owns cancellation.
    return { initial, midpoint, progress };
  }, rendererModule);
  expect(frames.progress).toBeGreaterThan(0);
  expect(frames.progress).toBeLessThan(1);
  expect(frames.initial.length).toBeGreaterThan(0);
  expect(frames.midpoint).toHaveLength(frames.initial.length);
  for (const positions of [frames.initial, frames.midpoint]) {
    for (const position of positions) {
      expect(position.actualCenterX).toBeCloseTo(position.expectedCenterX, 3);
      expect(position.actualCenterY).toBeCloseTo(position.expectedCenterY, 3);
      expect(position.actualX).toBeCloseTo(position.expectedX, 3);
      expect(position.actualY).toBeCloseTo(position.expectedY, 3);
    }
  }
  const screenshot = testInfo.outputPath('donut-during-resize.png');
  await page.locator('#release-review-chart').screenshot({ path: screenshot });
  await testInfo.attach('donut-during-resize', { path: screenshot, contentType: 'image/png' });
});
