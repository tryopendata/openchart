import type { ChartLayout, ResolvedAnnotation } from '@opendata-ai/openchart-core';
import { expect, test } from '@playwright/test';

for (const width of [320, 390, 768, 1280]) for (const colorScheme of ['light', 'dark'] as const) {
  for (const story of ['reference-labels', 'crowded-callouts', 'notes-sizing']) {
    test(`${width} ${colorScheme}: ${story} layout and export`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.goto(`/?story=features--annotation-${story}&mode=preview`);
      const charts = page.getByTestId('annotation-layout');
      await expect(charts.first().locator('svg')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      for (const chart of await charts.all()) {
        await chart.dispatchEvent('fixture-layout');
        const layout: ChartLayout = JSON.parse((await chart.getAttribute('data-layout'))!);
        expect(layout.theme.isDark).toBe(colorScheme === 'dark');
        const groups = layout.facet?.panels.map(p => p.annotations) ?? [layout.annotations];
        for (const annotations of groups) {
          const visible = annotations.filter(a => a.label?.visible && !a.footnoteIndex);
          for (const annotation of visible) {
            const box = annotation.bounds ?? annotation.label!.bounds;
            if (!box) continue;
            expect(box.x, annotation.id).toBeGreaterThanOrEqual(-1);
            expect(box.y, annotation.id).toBeGreaterThanOrEqual(-1);
            expect(box.x + box.width, annotation.id).toBeLessThanOrEqual(layout.dimensions.width + 1);
            expect(box.y + box.height, annotation.id).toBeLessThanOrEqual(layout.dimensions.height + 1);
          }
          const unpinned = visible.filter(a => !a.id?.match(/^crowded-1[23]$/));
          for (let i = 0; i < unpinned.length; i++) for (let j = i + 1; j < unpinned.length; j++) {
            const a = unpinned[i].bounds, b = unpinned[j].bounds;
            if (!a || !b) continue;
            const overlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;
            expect(overlap, `${unpinned[i].id}/${unpinned[j].id}`).toBe(false);
          }
          if (story === 'crowded-callouts') {
            expect(visible.filter(a => a.id?.match(/^crowded-1[23]$/))).toHaveLength(2);
            expect(visible.length + (layout.chrome.footnotes?.length ?? 0)).toBe(14);
          }
          if (story === 'notes-sizing') expect(visible.length + (layout.chrome.footnotes?.length ?? 0)).toBe(2);
          for (const a of visible) assertConnector(a);
        }
        expect(await chart.locator('svg').first().evaluate(svg => svg.getBoundingClientRect().height)).toBeCloseTo(layout.dimensions.height, 1);
        await chart.dispatchEvent('fixture-export');
        const exported = (await chart.getAttribute('data-export'))!;
        expect(exported).not.toMatch(/oc-edit-handle|oc-selection-handle/);
        for (const note of layout.chrome.footnotes ?? []) {
          // Plain-text notes remain intentional in Track A, including literal bold markers.
          expect(exported).toContain((note.lines?.[0] ?? `${note.index}. ${note.text}`).replaceAll('&', '&amp;').replaceAll('<', '&lt;'));
        }
      }
      if (story === 'notes-sizing') {
        const canvas = page.getByTestId('annotation-canvas');
        await expect(canvas.locator('canvas.oc-mark-canvas')).toBeAttached();
        await canvas.dispatchEvent('fixture-layout');
        await canvas.dispatchEvent('fixture-export');
        const canvasLayout: ChartLayout = JSON.parse((await canvas.getAttribute('data-layout'))!);
        for (const note of canvasLayout.chrome.footnotes ?? []) expect((await canvas.getAttribute('data-export'))!).toContain(note.text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').split(' ').slice(0, 2).join(' '));
        // Canvas changes only the mark renderer; annotation geometry and the
        // figure-owned note band must match the equivalent SVG fixture.
        const svgLayout: ChartLayout = JSON.parse((await charts.nth(4).getAttribute('data-layout'))!);
        expect(canvasLayout.annotations).toEqual(svgLayout.annotations);
        expect(canvasLayout.chrome.footnotes).toEqual(svgLayout.chrome.footnotes);
        expect(canvasLayout.dimensions).toEqual(svgLayout.dimensions);
        await canvas.dispatchEvent('fixture-png');
        await expect(canvas).toHaveAttribute('data-png', /width/);
        const png = JSON.parse((await canvas.getAttribute('data-png'))!);
        expect(png.width).toBe(Math.floor(canvasLayout.dimensions.width));
        expect(png.height).toBe(Math.floor(canvasLayout.dimensions.height));
        const auto = page.getByTestId('annotation-auto-height');
        await auto.dispatchEvent('fixture-layout');
        const first: ChartLayout = JSON.parse((await auto.getAttribute('data-layout'))!);
        expect(first.dimensions.height).toBeCloseTo(400 + (first.chrome.grownHeight ?? 0), 1);
        await auto.dispatchEvent('fixture-png');
        await expect(auto).toHaveAttribute('data-png', /width/);
        expect(JSON.parse((await auto.getAttribute('data-png'))!).height).toBe(Math.floor(first.dimensions.height));
        await page.waitForTimeout(250);
        await auto.dispatchEvent('fixture-layout');
        expect(JSON.parse((await auto.getAttribute('data-layout'))!).dimensions.height).toBe(first.dimensions.height);
      }
    });
  }
}

function assertConnector(annotation: ResolvedAnnotation) {
  const connector = annotation.label?.connector;
  const bounds = annotation.bounds;
  if (!connector?.endpoint || !bounds || connector.style === 'drop-line') return;
  const cx = bounds.x + bounds.width / 2, cy = bounds.y + bounds.height / 2;
  const dx = connector.endpoint.x - cx, dy = connector.endpoint.y - cy;
  const t = Math.min((bounds.width / 2 + 2) / Math.abs(dx), (bounds.height / 2 + 2) / Math.abs(dy));
  if (connector.labelAttachment === 'left-center') {
    expect(connector.from.x).toBeCloseTo(bounds.x - 8, 1);
    expect(connector.from.y).toBeCloseTo(cy, 1);
  } else {
    expect(Math.hypot(connector.from.x - (cx + dx * t), connector.from.y - (cy + dy * t))).toBeCloseTo(6, 1);
  }
  const radius = annotation.dot ? annotation.dot.radius + annotation.dot.strokeWidth / 2 : 0;
  expect(Math.hypot(connector.to.x - connector.endpoint.x, connector.to.y - connector.endpoint.y)).toBeCloseTo(connector.arrow ? Math.max(radius + 2, 2) : Math.max(radius + 3, 4), 1);
}
