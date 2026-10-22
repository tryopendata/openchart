import { expect, test } from '@playwright/test';

for (const width of [320, 390, 430, 640, 1280]) {
  for (const mode of ['light', 'dark'] as const) {
    test(`welcome uses available space at ${width}px in ${mode} mode`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
      await page.goto('/?story=welcome--welcome');
      const chart = page.locator('.ocw-hero-chart .story-chart');
      await expect(chart.locator('svg.oc-chart')).toBeVisible();
      await expect(page.locator('.oc-gallery')).toHaveAttribute('data-oc-mode', mode);
      await page.evaluate(() => document.fonts.ready);

      const box = await chart.boundingBox();
      expect(box).not.toBeNull();
      if (width <= 640) {
        expect(box!.width).toBeGreaterThanOrEqual(width - 28);
        const toolbar = await page.locator('.oc-gallery-toolbar').boundingBox();
        const title = await page.locator('.oc-gallery-title').boundingBox();
        expect(toolbar!.y + toolbar!.height).toBeLessThanOrEqual(title!.y);
      }
      if (box!.width <= 700) {
        await expect(chart.locator('.oc-legend-entry')).toHaveText([
          'Amazon', 'Apple', 'Alphabet', 'Microsoft', 'Meta',
        ]);
        await expect(chart.locator('.oc-endpoint-label-entry')).toHaveCount(0);
        const colors = await chart.locator('.oc-legend-swatch-line').evaluateAll(
          (elements) => elements.map((el) => el.getAttribute('stroke')),
        );
        expect(new Set(colors).size).toBe(5);
        const legend = await chart.locator('.oc-legend').boundingBox();
        const yAxis = await chart.locator('.oc-axis-y').boundingBox();
        expect(legend!.y + legend!.height).toBeLessThan(yAxis!.y);
        if (box!.width < 400) {
          const annotation = await chart.locator('.oc-annotation-bg').boundingBox();
          expect(annotation!.y).toBeGreaterThan(legend!.y + legend!.height);
        }
      } else {
        await expect(chart.locator('.oc-endpoint-label-entry')).toHaveCount(5);
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
}

for (const demo of [
  { story: 'charts--line-and-area', id: 'five-series-legend' },
  { story: 'showcase--showcase', id: 'multi-series-line' },
]) {
  test(`${demo.story} keeps every revenue series identifiable on phones`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/?story=${demo.story}#${demo.id}`);
    const card = page.locator(`#${demo.id}`);
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator('.oc-legend-entry')).toHaveCount(5);
    await expect(card.locator('.oc-endpoint-label-entry')).toHaveCount(0);
    const box = await card.locator('.story-chart').boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(362);
  });
}

for (const mode of ['light', 'dark'] as const) {
  test(`phone width preset keeps the gallery toolbar clear in ${mode} mode`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
    await page.goto('/?story=welcome--welcome&width=390');
    const frame = page.frameLocator('iframe');
    const chart = frame.locator('.ocw-hero-chart .story-chart');
    await expect(chart.locator('.oc-legend-entry')).toHaveCount(5);
    const box = await chart.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(362);
    const toolbar = frame.locator('.oc-gallery-toolbar');
    await expect(toolbar).toHaveAttribute('data-oc-mode', mode);
    await expect(toolbar).toHaveCSS('background-color', mode === 'dark' ? 'rgb(15, 16, 17)' : 'rgb(250, 250, 250)');
    const toolbarBox = await toolbar.boundingBox();
    const titleBox = await frame.locator('.oc-gallery-title').boundingBox();
    expect(toolbarBox!.y + toolbarBox!.height).toBeLessThanOrEqual(titleBox!.y);

    const trigger = frame.getByRole('button', { name: 'Theme Default', exact: true });
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const option = frame.getByRole('button', { name: 'Midnight', exact: true });
    expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await frame.locator('.oc-gallery-title').click({ position: { x: 300, y: 10 } });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await option.focus();
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  });
}

test('theme controls fit a narrow phone and remain accessible in a short viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 360 });
  await page.goto('/?story=welcome--welcome');
  await page.getByRole('button', { name: 'Theme Default', exact: true }).click();
  await page.getByRole('button', { name: 'Midnight', exact: true }).click();
  const trigger = page.getByRole('button', { name: 'Theme Midnight', exact: true });
  const triggerBox = await trigger.boundingBox();
  const githubBox = await page.locator('.oc-github-link').boundingBox();
  expect(triggerBox!.x + triggerBox!.width).toBeLessThan(githubBox!.x);
  await trigger.click();
  await page.getByRole('button', { name: 'Signal', exact: true }).scrollIntoViewIfNeeded();
  const optionsBox = await page.locator('.oc-theme-options').boundingBox();
  expect(optionsBox!.x + optionsBox!.width).toBeLessThanOrEqual(320);
  expect(optionsBox!.y + optionsBox!.height).toBeLessThanOrEqual(360);
});
