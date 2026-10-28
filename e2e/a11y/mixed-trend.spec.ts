import path from 'node:path';
import { expect, test } from '@playwright/test';
import type { ChartInstance } from '../../packages/vanilla/src/mount';

const moduleUrl = `/@fs${path.resolve(__dirname, '../../packages/vanilla/src/mount.ts')}`;
type ObservationWindow = Window & {
  mixedTrend: ChartInstance;
  focusedObservations: Array<{ value: unknown; note: unknown; markId: string | null }>;
};

for (const mark of ['line', 'area'] as const) {
  test(`${mark}: isolated hover and connected keyboard observations share the overlay`, async ({ page }) => {
    await page.goto('/?story=testing--library-contracts--lifecycle&mode=preview');
    await expect(page.getByTestId('library-host').locator('svg').first()).toBeVisible();
    await page.evaluate(async ({ moduleUrl, mark }) => {
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
        data: [1, 2, null, 5, null, 7, 8].map((value, index) => ({ date: `2026-01-0${index + 1}`, value, note: `observation-${index + 1}` })),
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          description: { field: 'note', type: 'nominal' },
          tooltip: [{ field: 'note', type: 'nominal' }, { field: 'value', type: 'quantitative' }],
        },
      }, {
        autoResize: false,
        onMarkFocus(event) {
          state.focusedObservations.push({ value: event.datum.value, note: event.datum.note, markId: event.element.getAttribute('data-mark-id') });
        },
      });
    }, { moduleUrl, mark });
    const host = page.locator('#mixed-trend');
    // Live marks expose descriptions via aria-label; the isolated value is a
    // real circle even though its hover events are owned by the overlay.
    const point = host.locator('circle[aria-label="observation-4"]');
    await expect(point).toBeVisible();
    const box = await point.boundingBox();
    if (!box) throw new Error('Expected the isolated observation circle');
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.hasAttribute('data-voronoi-overlay'), { x, y })).toBe(true);
    await page.mouse.move(x, y);
    await expect(host.locator('.oc-tooltip')).toBeVisible();
    await expect(host.locator('.oc-tooltip')).toContainText('observation-4');
    await host.focus();
    for (let i = 0; i < 4; i++) await host.press('ArrowRight');
    const focused = await page.evaluate(() => (window as ObservationWindow).focusedObservations);
    expect(focused.map(observation => observation.value)).toEqual([1, 2, 5, 7, 8]);
    expect(focused[2].markId).toBe(await point.getAttribute('data-mark-id'));
    await expect(host.locator('.oc-tooltip')).toContainText('observation-7');
    await page.evaluate(() => (window as ObservationWindow).mixedTrend.destroy());
  });
}
