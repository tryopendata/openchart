import { expect, test } from '@playwright/test';

test('the host-owned island keeps keyboard navigation without entrance motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?story=gallery--accessibility--island&mode=preview');
  const island = page.locator('[data-a11y-island]');
  const chart = island.locator('.oc-chart-root');
  await expect(chart.locator('svg')).toBeVisible();
  await page.getByRole('button', { name: 'Replay entrance' }).click();
  await expect(chart.locator('svg')).toBeVisible();
  await expect(chart.locator('svg')).toHaveClass(/oc-animate/);
  expect(await chart.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(chart.locator('table')).toHaveCount(0);
  await expect(island.locator('details table')).toHaveCount(1);
  await chart.focus();
  await expect(island.getByRole('status')).toHaveText('React: 40 projects');
  await chart.press('ArrowRight');
  await expect(island.getByRole('status')).toHaveText('Vue: 28 projects');
});
