import { expect, type Locator, type Page, test } from '@playwright/test';

const story = (name: string) => `/?story=gallery--geographic-views--${name}&mode=preview`;
async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
}
async function exported(host: Locator) {
  await host.dispatchEvent('fixture-export');
  return host.getAttribute('data-export');
}
async function cameras(host: Locator) {
  return JSON.parse((await host.getAttribute('data-cameras'))!);
}
for (const width of [390, 1280]) {
  test(`${width}: Texas detail shares immutable fit and preserves Austin/RGV point geometry`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(story('texas-and-austin'));
    const host = page.getByTestId('geo-texas-views');
    await expect(host.locator('svg.oc-map')).toBeVisible();
    await settle(page);
    const points = await host.getAttribute('data-points');
    expect(JSON.parse(points!)).toHaveLength(4);
    const detail = host.locator('[data-geo-layer-id="travis-tracts"]');
    await expect(detail).toHaveAttribute('display', 'none');
    await page.getByRole('button', { name: 'Austin detail', exact: true }).click();
    await settle(page);
    await expect(detail).not.toHaveAttribute('display', 'none');
    expect(await detail.locator('path').count()).toBe(290);
    expect(await host.getAttribute('data-points')).toBe(points);
    await page.getByRole('button', { name: 'Toggle tract context', exact: true }).click();
    await settle(page);
    await expect(host.locator('[data-geo-layer-id="travis-tracts"]')).toHaveCount(0);
    expect(await host.getAttribute('data-points')).toBe(points);
    await page.getByRole('button', { name: 'Toggle tract context', exact: true }).click();
    await settle(page);
    expect(await host.getAttribute('data-points')).toBe(points);
    const svg = await exported(host);
    expect(svg).toContain('travis-tracts');
    expect(svg).not.toContain('foreignObject');
  });
  test(`${width}: explicit inset coverage has readable separate-scale captions and independent cameras`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(story('separate-scales'));
    const host = page.getByTestId('geo-inset-views');
    await expect(host.locator('svg.oc-map')).toBeVisible();
    await settle(page);
    await expect(host.locator('[data-geo-view-id]')).toHaveCount(3);
    const views = JSON.parse((await host.getAttribute('data-views'))!);
    const root = views.find((v: { id: string }) => v.id === 'root');
    expect(root.features).not.toContain('02');
    expect(root.features).not.toContain('15');
    expect(views.find((v: { id: string }) => v.id === 'alaska').features).toEqual(['02']);
    expect(views.find((v: { id: string }) => v.id === 'hawaii').features).toEqual(['15']);
    for (const id of ['alaska', 'hawaii']) {
      const view = host.locator(`[data-geo-view-id="${id}"]`);
      const captions = await view.locator(':scope > text').allTextContents();
      expect(captions.join(' ')).toMatch(/Alaska|Hawaii/);
      expect(captions.join(' ')).toMatch(/separate scale/i);
    }
    const collisions = await host.evaluate((element) => {
      const controls = [...element.querySelectorAll('.oc-map-zoom-controls')].map((node) =>
        node.getBoundingClientRect(),
      );
      return [...element.querySelectorAll('[data-geo-label-id]')]
        .filter((node) => {
          const label = node.getBoundingClientRect();
          return controls.some(
            (control) =>
              Math.min(label.right, control.right) - Math.max(label.left, control.left) > 0.5 &&
              Math.min(label.bottom, control.bottom) - Math.max(label.top, control.top) > 0.5,
          );
        })
        .map((node) => node.textContent);
    });
    expect(collisions).toEqual([]);
    const before = await cameras(host);
    await host.evaluate(
      (element, camera) => {
        element.dispatchEvent(
          new CustomEvent('fixture-camera', { detail: { viewId: 'alaska', camera } }),
        );
      },
      { ...before.alaska, k: before.alaska.k * 1.5 },
    );
    await settle(page);
    const after = await cameras(host);
    expect(after.root).toEqual(before.root);
    expect(after.hawaii).toEqual(before.hawaii);
    expect(after.alaska.k).toBeGreaterThan(before.alaska.k);
    await page.getByRole('button', { name: 'Reset main view', exact: true }).click();
    await settle(page);
    expect((await cameras(host)).alaska).toEqual(after.alaska);
    const svg = await exported(host);
    expect(svg).toContain('Alaska');
    expect(svg).toContain('Hawaii');
    expect(svg).toMatch(/Separate scale/i); // The accessible coverage description is a single string.
  });
}
test('incompatible identity source planes reject updates while preserving the last valid view', async ({
  page,
}) => {
  await page.goto(story('texas-and-austin'));
  const host = page.getByTestId('geo-texas-views');
  await expect(host.locator('svg.oc-map')).toBeVisible();
  await settle(page);
  const before = await host.getAttribute('data-points'),
    camera = await host.getAttribute('data-cameras');
  await host.dispatchEvent('fixture-invalid-plane');
  await expect(host).toHaveAttribute('data-validation-error', /sourcePlane|source plane/i);
  expect(await host.getAttribute('data-points')).toBe(before);
  expect(await host.getAttribute('data-cameras')).toBe(camera);
  await expect(host.locator('svg.oc-map')).toBeVisible();
  for (const scope of ['view', 'layer'] as const) {
    await host.evaluate((element, scope) => {
      element.dispatchEvent(new CustomEvent('fixture-invalid-scope', { detail: scope }));
    }, scope);
    await expect(host).toHaveAttribute('data-scope-error', scope === 'view' ? /view/i : /layer/i);
    expect(await host.getAttribute('data-points')).toBe(before);
    expect(await host.getAttribute('data-cameras')).toBe(camera);
  }
});
test('two inset maps export independently scoped clips with resolvable references', async ({
  page,
}) => {
  await page.goto(story('two-maps'));
  const first = page.getByTestId('geo-inset-first'),
    second = page.getByTestId('geo-inset-second');
  await expect(first.locator('svg.oc-map')).toBeVisible();
  await expect(second.locator('svg.oc-map')).toBeVisible();
  await settle(page);
  await exported(first);
  await exported(second);
  const result = await page.evaluate(() => {
    const strings = ['geo-inset-first', 'geo-inset-second'].map(
      (id) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!.dataset.export!,
    );
    const docs = strings.map((svg) => new DOMParser().parseFromString(svg, 'image/svg+xml'));
    const ids = docs.flatMap((doc) => [...doc.querySelectorAll('[id]')].map((node) => node.id));
    const unresolved = docs.flatMap((doc) =>
      [...doc.querySelectorAll('*')].flatMap((node) =>
        [...node.attributes].flatMap((attr) =>
          [...attr.value.matchAll(/url\(#([^)]*)\)/g)]
            .filter((match) => !doc.getElementById(match[1]))
            .map((match) => match[1]),
        ),
      ),
    );
    return {
      ids,
      unresolved,
      viewCounts: docs.map((doc) => doc.querySelectorAll('[data-geo-view-id]').length),
    };
  });
  expect(result.viewCounts).toEqual([3, 3]);
  expect(new Set(result.ids).size).toBe(result.ids.length);
  expect(result.unresolved).toEqual([]);
});

test('one Alaska observation pins both explicitly duplicated view representations', async ({
  page,
}) => {
  await page.goto(story('duplicated-place'));
  const host = page.getByTestId('geo-duplicate-view');
  await expect(host.locator('[data-geo-view-id]')).toHaveCount(3);
  await settle(page);
  await page.getByRole('button', { name: 'Pin Alaska', exact: true }).click();
  await expect(page.getByTestId('geo-view-reader-panel')).toContainText('Alaska');
  const selection = JSON.parse((await host.getAttribute('data-reader'))!);
  expect(selection.pinned).toHaveLength(1);
  expect(selection.pinned[0].observation).toBe('feature:02');
  await expect(host.locator('[data-oc-reader-overlay] path')).toHaveCount(2);
});

for (const width of [390, 1280]) {
  test(`${width}: larger inset captions remain inside their measured frames`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(story('separate-scales'));
    const host = page.getByTestId('geo-inset-views');
    await page.getByRole('button', { name: 'Enlarge caption text', exact: true }).click();
    await expect(host.locator('[data-geo-view-id]')).toHaveCount(3);
    await settle(page);
    const overflow = await host.evaluate((element) =>
      [...element.querySelectorAll('[data-geo-view-id]:not([data-geo-view-id="root"])')].flatMap(
        (view) => {
          const frame = view.querySelector(':scope > rect')!.getBoundingClientRect();
          return [...view.querySelectorAll(':scope > text')]
            .filter((text) => {
              const box = text.getBoundingClientRect();
              return (
                box.left < frame.left - 0.5 ||
                box.right > frame.right + 0.5 ||
                box.top < frame.top - 0.5 ||
                box.bottom > frame.bottom + 0.5
              );
            })
            .map((text) => text.textContent);
        },
      ),
    );
    expect(overflow).toEqual([]);
    expect(
      await host.locator('[data-geo-view-id="alaska"] > text').first().getAttribute('font-size'),
    ).toBe('24');
  });
}
