import { expect, type Locator, type Page, test } from '@playwright/test';

const story = '/?story=gallery--geographic-labels--places-and-notes&mode=preview';
async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
}

async function exportGeometry(host: Locator) {
  await host.dispatchEvent('fixture-export');
  return host.evaluate((element) => {
    const doc = new DOMParser().parseFromString(element.dataset.export!, 'image/svg+xml');
    return [...doc.querySelectorAll('[data-geo-label-id], [data-geo-note-id]')].map((node) => ({
      id: node.getAttribute('data-geo-label-id') ?? node.getAttribute('data-geo-note-id'),
      content: node.textContent,
      geometry: [node, ...node.querySelectorAll('*')].map((el) =>
        ['x', 'y', 'cx', 'cy', 'd', 'transform', 'font-size'].map((attr) => el.getAttribute(attr)),
      ),
    }));
  });
}

for (const width of [390, 1280]) {
  test(`${width}: complete inventory is independent of fixed-height map and survives replacement`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(story);
    const host = page.getByTestId('geo-label-host');
    const disclosure = page.getByTestId('geo-label-disclosure');
    await expect(host.locator('svg.oc-map')).toBeVisible();
    await settle(page);
    const height = await host.evaluate((el) => el.getBoundingClientRect().height);
    const viewBox = await host.locator('svg.oc-map').getAttribute('viewBox');
    const camera = await host.getAttribute('data-camera');
    const hidden = host.locator('.oc-map-label-inventory');
    await expect(hidden).toContainText('California coast');
    await expect(hidden).toContainText('A place without a data row');
    await expect(hidden).toContainText('Austin detail at a closer zoom');
    await expect(hidden).toContainText('Visible at another zoom level');
    await disclosure.getByText('Map places and notes', { exact: true }).click();
    await expect(disclosure).toContainText('A place without a data row');
    expect(await host.evaluate((el) => el.getBoundingClientRect().height)).toBe(height);
    expect(await host.locator('svg.oc-map').getAttribute('viewBox')).toBe(viewBox);
    expect(await host.getAttribute('data-camera')).toBe(camera);
    await page.getByRole('button', { name: 'Move place list' }).click();
    await expect(disclosure.locator('details')).toHaveCount(0);
    await expect(page.getByTestId('geo-label-alternate').locator('details')).toHaveCount(1);
    expect(await host.getAttribute('data-camera')).toBe(camera);
    await page.getByRole('button', { name: 'Update a place name' }).click();
    await expect(hidden).toContainText('Texas updated');
    expect(await host.evaluate((el) => el.getBoundingClientRect().height)).toBe(height);
    const described = await host.locator('svg.oc-map').evaluate((svg) =>
      (svg.getAttribute('aria-describedby') ?? '').split(/\s+/).some((id) => {
        const node = document.getElementById(id);
        return node?.textContent?.includes('Texas updated');
      }),
    );
    expect(described).toBe(true);
  });

  test(`${width}: camera history does not affect settled geometry or standalone inventory`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(story);
    const host = page.getByTestId('geo-label-host');
    await expect(host.locator('[data-geo-label-id]').first()).toBeVisible();
    await settle(page);
    const before = await exportGeometry(host);
    expect(before.length).toBeGreaterThan(0);
    const camera = JSON.parse((await host.getAttribute('data-camera'))!);
    await page.getByRole('button', { name: 'Show Texas' }).click();
    await settle(page);
    await host.dispatchEvent('fixture-camera', { detail: camera });
    await settle(page);
    expect(await exportGeometry(host)).toEqual(before);
    const standalone = await host.getAttribute('data-export');
    expect(standalone).toContain('A place without a data row');
    expect(standalone).toContain('Austin detail at a closer zoom');
    expect(standalone).toContain('California coast');
    expect(standalone).not.toContain('foreignObject');
    const labelsInside = await host.evaluate((el) => {
      const svg = el.querySelector('svg.oc-map')!.getBoundingClientRect();
      return [...el.querySelectorAll('[data-geo-label-id]')].every((label) => {
        const r = label.getBoundingClientRect();
        return r.left >= svg.left - 1 && r.right <= svg.right + 1 &&
          r.top >= svg.top - 1 && r.bottom <= svg.bottom + 1;
      });
    });
    expect(labelsInside).toBe(true);
  });
}

test('invalid updates preserve the valid view and inventory', async ({ page }) => {
  await page.goto(story);
  const host = page.getByTestId('geo-label-host');
  await expect(host.locator('[data-geo-label-id]').first()).toBeVisible();
  await settle(page);
  const geometry = await exportGeometry(host);
  const camera = await host.getAttribute('data-camera');
  await host.dispatchEvent('fixture-invalid-update');
  await expect(host).toHaveAttribute('data-validation-error', /duplicate|unique/i);
  expect(await exportGeometry(host)).toEqual(geometry);
  expect(await host.getAttribute('data-camera')).toBe(camera);
  await expect(host.locator('.oc-map-label-inventory')).toContainText('California coast');
});

test('multiple maps keep accessible and SVG reference IDs separate', async ({ page }) => {
  await page.goto('/?story=gallery--geographic-labels--multiple-maps&mode=preview');
  await expect(page.getByTestId('geo-label-second').locator('svg.oc-map')).toBeVisible();
  await settle(page);
  const result = await page.evaluate(() => {
    const hosts = [document.querySelector('[data-testid=geo-label-host]')!,
      document.querySelector('[data-testid=geo-label-second]')!];
    const ids = hosts.flatMap((host) => [...host.querySelectorAll('[id]')].map((n) => n.id));
    const descriptionsLocal = hosts.every((host) => {
      const svg = host.querySelector('svg.oc-map')!;
      const refs = (svg.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
      return refs.length > 0 && refs.every((id) => host.contains(document.getElementById(id)));
    });
    return { unique: new Set(ids).size === ids.length, descriptionsLocal };
  });
  expect(result).toEqual({ unique: true, descriptionsLocal: true });
});

test('zoom keeps text at screen size and map controls clear of the size key', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 950 });
  await page.goto(story);
  const host = page.getByTestId('geo-label-host');
  await expect(host.locator('[data-geo-label-id]').first()).toBeVisible();
  await settle(page);
  const controls = await host.locator('.oc-map-zoom-controls').boundingBox();
  const title = await host.locator('svg text').filter({ hasText: /^Metro population$/ }).boundingBox();
  expect(controls).not.toBeNull();
  expect(title).not.toBeNull();
  expect(controls!.x >= title!.x + title!.width || title!.x >= controls!.x + controls!.width ||
    controls!.y >= title!.y + title!.height || title!.y >= controls!.y + controls!.height).toBe(true);
  const sizes = () => host.locator('[data-geo-label-id] text').evaluateAll((texts) =>
    Object.fromEntries(texts.map((text) => [text.textContent, text.getBoundingClientRect().height])),
  );
  const before = await sizes();
  await page.getByRole('button', { name: 'Show Texas' }).click();
  await settle(page);
  const after = await sizes();
  const shared = Object.keys(after).filter((name) => before[name] !== undefined);
  expect(shared.length).toBeGreaterThan(0);
  for (const name of shared) expect(after[name]).toBeCloseTo(before[name], 1);
});

test('schematic holes and unresolved anchors retain names without growing the map', async ({ page }) => {
  await page.goto('/?story=gallery--geographic-labels--islands-and-holes&mode=preview');
  const host = page.getByTestId('geo-geometry-host');
  await expect(host.locator('[data-geo-label-id]').first()).toBeVisible();
  const inventory = host.locator('.oc-map-label-inventory');
  await expect(inventory).toContainText('Around the lake');
  await expect(inventory).toContainText('Island group');
  await expect(inventory).toContainText('A place outside this supplied geography');
  const height = await host.evaluate((el) => el.getBoundingClientRect().height);
  await page.getByRole('button', { name: 'Show the small island' }).click();
  await settle(page);
  await expect(host.locator('[data-geo-label-id="feature:islands"]')).toBeVisible();
  expect(await host.evaluate((el) => el.getBoundingClientRect().height)).toBe(height);
  await page.getByRole('button', { name: 'All islands' }).click();
  await settle(page);
  await expect(host.locator('[data-geo-label-id="feature:ring"]')).toBeVisible();
});

for (const width of [390, 1280]) {
  test(`${width}: multiple-map gallery controls remain valid and independent`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/?story=gallery--geographic-labels--multiple-maps&mode=preview');
    const first = page.getByTestId('geo-label-host');
    const second = page.getByTestId('geo-label-second');
    await expect(second.locator('svg.oc-map')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try an invalid update' })).toHaveCount(0);
    const secondCamera = await second.getAttribute('data-camera');
    const secondGeometry = await exportGeometry(second);
    for (const name of ['Show Texas', 'Full map', 'Update a place name', 'Move place list']) {
      await page.getByRole('button', { name, exact: true }).click();
      await settle(page);
      await expect(first.locator('svg.oc-map')).toBeVisible();
      expect(await second.getAttribute('data-camera')).toBe(secondCamera);
      expect(await exportGeometry(second)).toEqual(secondGeometry);
    }
    await expect(first.locator('.oc-map-label-inventory')).toContainText('Texas updated');
    await expect(second.locator('.oc-map-label-inventory')).toContainText('Texas triangle');
    await expect(page.getByText(/Error: Invalid spec/)).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
