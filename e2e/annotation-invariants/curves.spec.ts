import type { ChartLayout } from '@opendata-ai/openchart-core';
import { expect, test } from '@playwright/test';
import { CONNECTOR_STANDOFF } from '../../packages/engine/src/annotations/constants';

for (const width of [320, 390, 768, 1280])
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${width} ${colorScheme}: bend and arrow matrix stays within the figure`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.goto('/?story=features--annotation-curves&mode=preview');
      const charts = page.getByTestId('annotation-curve');
      await expect(charts).toHaveCount(10);
      for (const chart of await charts.all()) {
        await expect(chart.locator('.oc-annotation-label')).toBeVisible();
        await chart.dispatchEvent('fixture-layout');
        const layout: ChartLayout = JSON.parse((await chart.getAttribute('data-layout'))!);
        const annotation = layout.annotations[0];
        const bounds = annotation.bounds!;
        const connector = annotation.label!.connector!;
        // Existing geometry uses a 2px inflated box, then advances along the ray.
        // Standoff is not the shortest Euclidean distance to the unpadded box.
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;
        const dx = connector.endpoint!.x - cx;
        const dy = connector.endpoint!.y - cy;
        const rayExit = Math.min(
          (bounds.width / 2 + 2) / Math.abs(dx),
          (bounds.height / 2 + 2) / Math.abs(dy),
        );
        const standoff = Math.hypot(
          connector.from.x - (cx + dx * rayExit),
          connector.from.y - (cy + dy * rayExit),
        );
        expect(Math.abs(standoff - CONNECTOR_STANDOFF)).toBeLessThanOrEqual(1);
        const gapToPoint = Math.hypot(
          connector.to.x - connector.endpoint!.x,
          connector.to.y - connector.endpoint!.y,
        );
        const markerRadius = annotation.dot
          ? annotation.dot.radius + annotation.dot.strokeWidth / 2
          : 0;
        const expectedGap = connector.arrow
          ? Math.max(markerRadius + 2, 2)
          : Math.max(markerRadius + 3, 4);
        expect(gapToPoint).toBeCloseTo(expectedGap, 7);
        expect(bounds.x).toBeGreaterThanOrEqual(-1);
        expect(bounds.y).toBeGreaterThanOrEqual(-1);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(layout.dimensions.width + 1);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(layout.dimensions.height + 1);
        const geometry = await chart.evaluate((host) => {
          const svg = host.querySelector('svg')!;
          return {
            height: svg.getBoundingClientRect().height,
            path: host.querySelector('path.oc-annotation-connector')?.getAttribute('d'),
            inline: host.querySelectorAll('.oc-annotation-label').length,
            notes: host.querySelectorAll('.oc-annotation-footnote-marker').length,
          };
        });
        expect(geometry.height).toBeCloseTo(layout.dimensions.height, 1);
        expect(geometry.path).toContain(' Q ');
        expect(geometry.path).not.toMatch(/NaN|Infinity/);
        // One eligible callout per matrix panel; no possible pairwise overlap.
        expect(geometry.inline + geometry.notes).toBe(1);
        await chart.dispatchEvent('fixture-export');
        expect(
          await chart.evaluate((host) => {
            const exported = new DOMParser().parseFromString(host.dataset.export!, 'image/svg+xml');
            return [
              '.oc-annotation-connector',
              '.oc-annotation-arrowhead',
              '.oc-annotation-dot',
            ].every((selector) => {
              const attrs = (el: Element | null) =>
                el && [...el.attributes].map((a) => [a.name, a.value]).sort();
              return (
                JSON.stringify(attrs(host.querySelector(selector))) ===
                JSON.stringify(attrs(exported.querySelector(selector)))
              );
            });
          }),
        ).toBe(true);
      }
    });
  }
