import { expect, test } from '@playwright/test';

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
  // Wait past the debounce and prove the stale query never returns.
  await expect(host.locator('tbody tr')).toHaveCount(10);
  await page.waitForTimeout(250);
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
