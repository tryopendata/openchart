import { expect, test } from '@playwright/test';

for (const width of [320, 390, 768, 1280])
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${width} ${colorScheme}: notes and markers share keyboard focus and clean export`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.goto('/?story=features--annotation-crowded-callouts&mode=preview');
      const chart = page.getByTestId('annotation-layout').first();
      const firstNote = chart.locator('[data-note-spec-index]').first();
      await expect(chart.locator('svg')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(chart).toHaveAttribute('data-oc-fonts-state', 'ready');
      if (colorScheme === 'dark') await expect(chart).toHaveClass(/oc-dark/);
      else await expect(chart).not.toHaveClass(/oc-dark/);
      // This interaction fixture needs notes even when the viewport can fit all
      // callouts. Full-width geometry remains covered by layout.spec.ts.
      if (width === 1280) {
        const chartWidth = await chart.evaluate((host) => {
          host.style.maxWidth = '390px';
          return host.clientWidth;
        });
        await expect
          .poll(async () =>
            chart.locator('svg').evaluate((svg) => (svg as SVGSVGElement).viewBox.baseVal.width),
          )
          .toBe(chartWidth);
      }
      // Like the visual capture harness, let the initial debounced resize and
      // font measurement frame finish before testing a user's focus action.
      await page.waitForTimeout(100);
      await expect(firstNote).toBeVisible();
      const source = await firstNote.getAttribute('data-note-spec-index');
      const note = chart.locator(`[data-note-spec-index="${source}"]`);
      const marker = chart.locator(`[data-note-marker-index="${source}"]`).first();
      await expect(chart.locator('svg')).toHaveAttribute('role', 'group');
      await expect(note).toHaveAttribute('role', 'listitem');
      await expect(marker).toHaveAttribute('role', 'button');
      await expect(note).not.toContainText('**');
      await note.focus();
      await expect(note).toHaveClass(/oc-note-active/);
      await expect(marker).toHaveClass(/oc-note-active/);
      await note.press('Enter');
      await expect(marker).toBeFocused();
      await marker.press('Space');
      await expect(note).toBeFocused();
      await expect(chart.locator('textarea, input, [contenteditable]')).toHaveCount(0);
      await chart.dispatchEvent('fixture-export');
      const result = await chart.evaluate((host) => {
        const doc = new DOMParser().parseFromString(
          (host as HTMLElement).dataset.export!,
          'image/svg+xml',
        );
        return {
          active: doc.querySelectorAll(
            '.oc-note-active, .oc-anchor-handle, .oc-connector-handle, .oc-selection-overlay',
          ).length,
          notes: [...doc.querySelectorAll('[data-note-spec-index]')].map((note) =>
            note.getAttribute('aria-label'),
          ),
        };
      });
      expect(result.active).toBe(0);
      expect(result.notes).toContain(await note.getAttribute('aria-label'));
      await expect(note).toHaveClass(/oc-note-active/);
      await note.press('Escape');
      await expect(chart.locator('.oc-note-active')).toHaveCount(0);
    });
  }
