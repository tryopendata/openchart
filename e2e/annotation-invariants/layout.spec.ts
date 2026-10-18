import type { ChartLayout, ResolvedAnnotation } from '@opendata-ai/openchart-core';
import { expect, test, type Page } from '@playwright/test';
import { waitForResizeSettled } from '../settle';

for (const width of [320, 390, 768, 1280])
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const story of ['reference-labels', 'crowded-callouts', 'notes-sizing']) {
      test(`${width} ${colorScheme}: ${story} layout and export`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme });
        await page.goto(`/?story=features--annotation-${story}&mode=preview`);
        const charts = page.getByTestId('annotation-layout');
        await expect(charts.first().locator('svg')).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        for (const chart of await charts.all()) {
          await expect(chart).toHaveAttribute('data-oc-fonts-state', 'ready');
          if (colorScheme === 'dark') await expect(chart).toHaveClass(/oc-dark/);
          else await expect(chart).not.toHaveClass(/oc-dark/);
          await chart.dispatchEvent('fixture-layout');
          const layout: ChartLayout = JSON.parse((await chart.getAttribute('data-layout'))!);
          expect(layout.theme.isDark).toBe(colorScheme === 'dark');
          const groups = layout.facet?.panels.map((p) => p.annotations) ?? [layout.annotations];
          for (const annotations of groups) {
            const visible = annotations.filter((a) => a.label?.visible && !a.footnoteIndex);
            for (const annotation of visible) {
              const box = annotation.bounds ?? annotation.label!.bounds;
              if (!box) continue;
              expect(box.x, annotation.id).toBeGreaterThanOrEqual(-1);
              expect(box.y, annotation.id).toBeGreaterThanOrEqual(-1);
              expect(box.x + box.width, annotation.id).toBeLessThanOrEqual(
                layout.dimensions.width + 1,
              );
              expect(box.y + box.height, annotation.id).toBeLessThanOrEqual(
                layout.dimensions.height + 1,
              );
            }
            const unpinned = visible.filter((a) => !a.id?.match(/^crowded-1[23]$/));
            for (let i = 0; i < unpinned.length; i++)
              for (let j = i + 1; j < unpinned.length; j++) {
                const a = unpinned[i].bounds,
                  b = unpinned[j].bounds;
                if (!a || !b) continue;
                const overlap =
                  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 &&
                  Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;
                expect(overlap, `${unpinned[i].id}/${unpinned[j].id}`).toBe(false);
              }
            if (story === 'crowded-callouts') {
              expect(visible.filter((a) => a.id?.match(/^crowded-1[23]$/))).toHaveLength(2);
              expect(visible.length + (layout.chrome.footnotes?.length ?? 0)).toBe(14);
            }
            if (story === 'notes-sizing')
              expect(visible.length + (layout.chrome.footnotes?.length ?? 0)).toBe(2);
            for (const a of visible) assertConnector(a);
          }
          expect(
            await chart
              .locator('svg')
              .first()
              .evaluate((svg) => svg.getBoundingClientRect().height),
          ).toBeCloseTo(layout.dimensions.height, 1);
          await chart.dispatchEvent('fixture-export');
          const exported = (await chart.getAttribute('data-export'))!;
          expect(exported).not.toMatch(/oc-edit-handle|oc-selection-handle/);
          await assertExportNotes(page, exported, layout);
        }
        if (story === 'notes-sizing') {
          const canvas = page.getByTestId('annotation-canvas');
          await expect(canvas.locator('canvas.oc-mark-canvas')).toBeAttached();
          await canvas.dispatchEvent('fixture-layout');
          await canvas.dispatchEvent('fixture-export');
          const canvasLayout: ChartLayout = JSON.parse((await canvas.getAttribute('data-layout'))!);
          await assertExportNotes(page, (await canvas.getAttribute('data-export'))!, canvasLayout);
          // Canvas changes only the mark renderer; annotation geometry and the
          // figure-owned note band must match the equivalent SVG fixture.
          const svgLayout: ChartLayout = JSON.parse(
            (await charts.nth(4).getAttribute('data-layout'))!,
          );
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
          expect(JSON.parse((await auto.getAttribute('data-png'))!).height).toBe(
            Math.floor(first.dimensions.height),
          );
          // Auto-height grows the host, which re-fires the ResizeObserver. Wait
          // for the mount to handle that echo (and any echo of its own render);
          // a self-resize loop never settles, and a single re-render would show
          // up as a changed height below.
          await waitForResizeSettled(auto);
          await auto.dispatchEvent('fixture-layout');
          expect(JSON.parse((await auto.getAttribute('data-layout'))!).dimensions.height).toBe(
            first.dimensions.height,
          );
        }
      });
    }
  }

function assertConnector(annotation: ResolvedAnnotation) {
  const connector = annotation.label?.connector;
  const bounds = annotation.bounds;
  if (!connector?.endpoint || !bounds || connector.style === 'drop-line') return;
  const cx = bounds.x + bounds.width / 2,
    cy = bounds.y + bounds.height / 2;
  const dx = connector.endpoint.x - cx,
    dy = connector.endpoint.y - cy;
  const t = Math.min((bounds.width / 2 + 2) / Math.abs(dx), (bounds.height / 2 + 2) / Math.abs(dy));
  if (connector.labelAttachment === 'left-center') {
    expect(connector.from.x).toBeCloseTo(bounds.x - 8, 1);
    expect(connector.from.y).toBeCloseTo(cy, 1);
  } else {
    expect(
      Math.hypot(connector.from.x - (cx + dx * t), connector.from.y - (cy + dy * t)),
    ).toBeCloseTo(6, 1);
  }
  const radius = annotation.dot ? annotation.dot.radius + annotation.dot.strokeWidth / 2 : 0;
  expect(
    Math.hypot(connector.to.x - connector.endpoint.x, connector.to.y - connector.endpoint.y),
  ).toBeCloseTo(connector.arrow ? Math.max(radius + 2, 2) : Math.max(radius + 3, 4), 1);
}

async function assertExportNotes(page: Page, source: string, layout: ChartLayout) {
  const notes = await page.evaluate((svg) => {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    return {
      controls: doc.querySelectorAll(
        '.oc-note-active, .oc-selection-overlay, .oc-anchor-handle, .oc-connector-handle',
      ).length,
      notes: [...doc.querySelectorAll('[data-note-spec-index]')].map((note) => ({
        label: note.getAttribute('aria-label'),
        lines: [...note.children].map((line) => line.textContent),
        bold: [...note.querySelectorAll('[font-weight="700"]')].map((span) => span.textContent),
      })),
    };
  }, source);
  expect(notes.controls).toBe(0);
  expect(notes.notes).toHaveLength(layout.chrome.footnotes?.length ?? 0);
  for (const [index, note] of (layout.chrome.footnotes ?? []).entries()) {
    const clean = (text: string) => text.replaceAll('**', '');
    expect(notes.notes[index].label).toBe(
      `${note.index}. ${clean(note.text)}${note.subtitle ? `. ${clean(note.subtitle)}` : ''}`,
    );
    expect(notes.notes[index].lines).toEqual((note.lines ?? []).map(clean));
    if (note.text.includes('**') || note.subtitle?.includes('**'))
      expect(notes.notes[index].bold.length).toBeGreaterThan(0);
  }
}
