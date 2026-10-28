import path from 'node:path';
import { expect, test } from '@playwright/test';
import type { ChartInstance } from '../../packages/vanilla/src/mount';

const moduleUrl = `/@fs${path.resolve(__dirname, '../../packages/vanilla/src/mount.ts')}`;
type ObservationWindow = Window & {
  mixedTrend: ChartInstance;
  focusedObservations: Array<{ value: unknown; note: unknown; markId: string | null }>;
};

for (const variant of ['line', 'area', 'interval-area', 'interval-single', 'interval-isolated'] as const) {
  const mark = variant === 'line' ? 'line' : 'area';
  const interval = variant.startsWith('interval-');
  const isolatedOnly = variant === 'interval-single' || variant === 'interval-isolated';
  const values = variant === 'interval-single' ? [0.6] : variant === 'interval-isolated' ? [0.6, null, 0.6, null, 0.6] : [1, 2, null, 5, null, 7, 8];
  test(`${variant}: isolated hover and connected keyboard observations share the overlay`, async ({ page }) => {
    await page.goto('/?story=testing--library-contracts--lifecycle&mode=preview');
    await expect(page.getByTestId('library-host').locator('svg').first()).toBeVisible();
    await page.evaluate(async ({ moduleUrl, mark, interval, values }) => {
      const { createChart } = await import(moduleUrl);
      const host = document.createElement('div');
      host.id = 'mixed-trend';
      host.style.cssText = 'width:600px;height:400px;margin:24px;background:white';
      document.body.replaceChildren(host);
      const state = window as ObservationWindow;
      state.focusedObservations = [];
      state.mixedTrend = createChart(host, {
        mark,
        animation: false,
        a11y: { table: false },
        data: values.map((value, index) => ({ date: `2026-01-0${index + 1}`, value, upper: value === null ? null : value + 0.3, note: `observation-${index + 1}` })),
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          ...(interval ? { y2: { field: 'upper' } } : {}),
          description: { field: 'note', type: 'nominal' },
          tooltip: [{ field: 'note', type: 'nominal' }, { field: 'value', type: 'quantitative' }, ...(interval ? [{ field: 'upper', type: 'quantitative' }] : [])],
        },
      }, {
        autoResize: false,
        onMarkFocus(event) {
          state.focusedObservations.push({ value: event.datum.value, note: event.datum.note, markId: event.element.getAttribute('data-mark-id') });
        },
      });
    }, { moduleUrl, mark, interval, values });
    const host = page.locator('#mixed-trend');
    // Isolated observations retain their point or interval geometry while the
    // overlay owns pointer inspection.
    const note = isolatedOnly ? 'observation-1' : 'observation-4';
    const point = host.locator(`${interval ? 'line' : 'circle'}[aria-label="${note}"]`);
    if (interval) await expect(point).toBeAttached();
    else await expect(point).toBeVisible();
    const box = await point.boundingBox();
    if (!box) throw new Error('Expected the isolated observation shape');
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    if (isolatedOnly) expect(await point.evaluate((element, {x,y}) => document.elementFromPoint(x,y) === element, {x,y})).toBe(true);
    if (!isolatedOnly) expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.hasAttribute('data-voronoi-overlay'), { x, y })).toBe(true);
    await page.mouse.move(x, y);
    await expect(host.locator('.oc-tooltip')).toBeVisible();
    await expect(host.locator('.oc-tooltip')).toContainText(note);
    if (interval) await expect(host.locator('.oc-tooltip')).toContainText('upper');
    await host.focus();
    const valid = values.filter(value => value !== null);
    for (let i = 1; i < valid.length; i++) await host.press('ArrowRight');
    await host.press('Enter');
    const focused = await page.evaluate(() => (window as ObservationWindow).focusedObservations);
    expect(focused.map(observation => observation.value)).toEqual(valid);
    expect(focused[isolatedOnly ? 0 : 2].markId).toBe(await point.getAttribute('data-mark-id'));
    await expect(host.locator('.oc-tooltip')).toContainText(`observation-${values.length}`);
    await page.evaluate(() => (window as ObservationWindow).mixedTrend.destroy());
  });
}
