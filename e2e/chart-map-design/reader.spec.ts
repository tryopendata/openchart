import { expect, type Locator, type Page, test } from '@playwright/test';

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
}
async function pinNext(host: Locator) {
  await host.focus();
  await host.press('ArrowRight');
  await host.press('Enter');
}

for (const width of [390, 1280]) {
  test(`${width}: date slices preserve sparse observations and reconcile keyed updates`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/?story=gallery--reader-comparison--dates&mode=preview');
    const host = page.locator('[data-reader-chart]');
    const panel = page.getByRole('complementary', { name: 'Date comparison', exact: true });
    await expect(host.locator('svg.oc-chart')).toBeVisible();
    await settle(page);
    await pinNext(host);
    await pinNext(host);
    await expect(panel.getByRole('heading', { name: 'A: 2022' })).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'B: 2023' })).toBeVisible();
    await expect(panel).toContainText('No observation');
    await expect(panel).toContainText('3 percentage points');
    await expect(panel).toContainText('Change unavailable');
    await pinNext(host);
    await expect(panel.getByRole('heading', { name: 'A: 2022' })).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'B: 2024' })).toBeVisible();
    await page.getByRole('button', { name: 'Reorder observations' }).click();
    await expect(panel.getByRole('heading', { name: 'B: 2024' })).toBeVisible();
    await page.getByRole('button', { name: 'Remove 2024' }).click();
    await expect(panel.getByRole('heading', { name: 'B: 2024' })).toHaveCount(0);
    await expect(panel.getByRole('heading', { name: 'A: 2022' })).toBeVisible();
    await page.getByRole('button', { name: 'Move comparison panel' }).click();
    await expect(panel.locator('.oc-reader-panel')).toHaveCount(0);
    const alternate = page.getByRole('complementary', { name: 'Alternate date comparison' });
    await expect(alternate.getByRole('heading', { name: 'A: 2022' })).toBeVisible();
    await alternate.getByRole('button', { name: 'Clear selection' }).click();
    await expect(host.locator('.oc-reader-guides [data-reader-slice]')).toHaveCount(0);
  });

  test(`${width}: place search and pins do not change camera; exports omit transient selection`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/?story=gallery--reader-comparison--places&mode=preview');
    const host = page.locator('[data-reader-map]');
    const companion = page.getByRole('complementary', { name: 'Find and rank places' });
    const panel = page.getByRole('complementary', { name: 'Place comparison' });
    await expect(host.locator('svg.oc-map')).toBeVisible();
    await settle(page);
    const camera = await host.getAttribute('data-camera');
    const viewBox = await host.locator('svg.oc-map').getAttribute('viewBox');
    await companion.getByRole('button', { name: /^1\. California: 42/ }).click();
    await companion.getByRole('button', { name: /^2\. Texas: 31/ }).click();
    await expect(panel.getByRole('heading', { name: 'A: California' })).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'B: Texas' })).toBeVisible();
    await expect(panel).toContainText('percentage points');
    expect(await host.getAttribute('data-camera')).toBe(camera);
    expect(await host.locator('svg.oc-map').getAttribute('viewBox')).toBe(viewBox);
    await host.dispatchEvent('fixture-export');
    const exported = await host.getAttribute('data-export');
    expect(exported).toContain('Regions per range');
    expect(exported).not.toMatch(/oc-map-reader|oc-reader-panel|foreignObject/);
    await companion.getByRole('searchbox', { name: 'Find a place' }).fill('Washington');
    await companion.getByRole('button', { name: /Washington: 0/ }).click();
    await expect(panel.getByRole('heading', { name: 'B: Washington' })).toBeVisible();
    await expect(panel).toContainText('0 %');
    await companion.getByRole('searchbox', { name: 'Find a place' }).fill('Alabama');
    await companion.getByRole('button', { name: /^Alabama: No data/ }).click();
    await expect(panel.getByRole('heading', { name: 'B: Alabama' })).toBeVisible();
    await expect(panel).toContainText('No data');
    await expect(panel).toContainText('A comparison needs two observed finite values.');
    expect(await host.getAttribute('data-camera')).toBe(camera);
    await companion.getByRole('button', { name: 'Show Alabama on map' }).click();
    await expect(host).not.toHaveAttribute('data-camera', camera!);
  });
}

test('map keyboard inspection and Escape leave the fixed frame intact', async ({ page }) => {
  await page.goto('/?story=gallery--reader-comparison--places&mode=preview');
  const host = page.locator('[data-reader-map]');
  await expect(host.locator('svg.oc-map')).toBeVisible();
  await settle(page);
  const camera = await host.getAttribute('data-camera');
  const inspect = host.getByRole('button', { name: /^Inspect places/ });
  await inspect.focus();
  await inspect.press('ArrowRight');
  await inspect.press('Enter');
  const panel = page.getByRole('complementary', { name: 'Place comparison' });
  await expect(panel.locator('[data-reader-slot=A]')).toHaveCount(1);
  await inspect.press('ArrowRight');
  await inspect.press('Enter');
  await expect(panel.locator('[data-reader-slot=B]')).toHaveCount(1);
  expect(await host.getAttribute('data-camera')).toBe(camera);
  await inspect.press('Escape');
  await expect(panel.locator('[data-reader-slot]')).toHaveCount(0);
  expect(await host.getAttribute('data-camera')).toBe(camera);
});
