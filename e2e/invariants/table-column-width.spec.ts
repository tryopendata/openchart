/**
 * Explicit column widths render at their requested pixel size, not stretched
 * or shrunk by the auto-layout/flex-scaling that produced the original
 * "200px column renders at 232px" bug (RFC 26 group G): cell padding without
 * `box-sizing: border-box` widened every cell beyond its computed width, and
 * an explicit `width` wasn't exempt from the proportional flex-scaling meant
 * for auto-sized text columns.
 */

import { expect, test } from '@playwright/test';

test('a 200px explicit column width renders at exactly 200px with no horizontal overflow', async ({
  page,
}) => {
  await page.goto('/?story=testing--fixtures-tables--explicit-column-width&mode=preview');
  await page.waitForSelector('.oc-table-wrapper table');
  await page.evaluate(() => document.fonts.ready);

  const result = await page.evaluate(() => {
    const scroll = document.querySelector('.oc-table-scroll') as HTMLElement | null;
    const th = document.querySelector('.oc-table-wrapper thead th') as HTMLElement | null;
    if (!scroll || !th) return null;
    return {
      headerWidth: th.getBoundingClientRect().width,
      scrollWidth: scroll.scrollWidth,
      clientWidth: scroll.clientWidth,
    };
  });

  expect(result).not.toBeNull();
  expect(Math.abs(result!.headerWidth - 200)).toBeLessThanOrEqual(1);
  // No horizontal overflow: the row of column widths sums to the container.
  expect(result!.scrollWidth).toBeLessThanOrEqual(result!.clientWidth + 1);
});
