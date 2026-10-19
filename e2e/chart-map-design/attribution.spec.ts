import { expect, test } from '@playwright/test';

for (const width of [390, 1280]) {
  for (const variant of ['all-visualizations', 'custom-brand', 'large-text']) {
    test(`${width}: ${variant} keeps complete attribution within every visualization`, async ({ page }) => {
      await page.setViewportSize({ width, height: 950 });
      await page.goto(`/?story=gallery--attribution--${variant}&mode=preview`);
      await expect(page.locator('[data-attribution-kind]')).toHaveCount(7);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
      });
      for (const kind of ['chart', 'map', 'barlist', 'sankey', 'tilemap', 'table', 'graph']) {
        const card = page.locator(`[data-attribution-kind=${kind}]`);
        await expect(card.locator('.oc-source')).toContainText('2020–2025');
        // SVG line breaks are separate tspans, without intervening text nodes.
        await expect(card.locator('.oc-byline')).toContainText(/Open\s*research\s*team/);
        await expect(card.locator('.oc-footer')).toContainText(/Methods\s*and\s*coverage/);
        if (variant === 'all-visualizations') {
          await expect(card.locator('.oc-watermark')).toHaveCount(1);
        } else {
          await expect(card.locator('.oc-brand')).toContainText(/Open\s*methods/);
          await expect(card.locator('.oc-watermark')).toHaveCount(0);
        }
        const overflow = await card.evaluate((element) => {
          const selectors = '.oc-source, .oc-byline, .oc-footer, .oc-brand, .oc-watermark';
          return [...element.querySelectorAll<SVGGraphicsElement>(selectors)].flatMap((text) => {
            const box = text.getBoundingClientRect();
            const frame = text.ownerSVGElement!.getBoundingClientRect();
            return box.left < frame.left - 1 || box.right > frame.right + 1 ||
              box.top < frame.top - 1 || box.bottom > frame.bottom + 1
              ? [{ text: text.textContent, kind: element.getAttribute('data-attribution-kind') }]
              : [];
          });
        });
        expect(overflow, kind).toEqual([]);
      }
    });
  }
}
