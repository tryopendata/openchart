import { expect, test } from '@playwright/test';
import { waitForResizeSettled } from '../settle';

const story = '/?story=features--annotation-gestures&mode=preview';
for (const width of [320, 390, 768, 1280])
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${width} ${colorScheme}: first drag, geometry and export`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.goto(story);
      const host = page.getByTestId('annotation-gesture-host');
      const label = host.locator('.oc-annotation-label');
      await expect(label).toBeVisible();
      // WebKit briefly reports a text box at the origin before its first SVG paint.
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise(requestAnimationFrame);
      });
      await expect
        .poll(() => label.evaluate((el) => el.getBoundingClientRect().right))
        .toBeGreaterThan(100);
      const marker = host.locator('.oc-annotation-dot');
      const anchorBefore = await marker.evaluate((e) => [
        e.getAttribute('cx'),
        e.getAttribute('cy'),
      ]);
      const box = await label.evaluate((el) => {
        const { x, y, width, height } = el.getBoundingClientRect();
        return { x, y, width, height };
      });
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - 35, box.y + box.height / 2 + 25, { steps: 4 });
      await page.evaluate(() => new Promise(requestAnimationFrame));
      const preview = await host
        .locator('.oc-annotation-text')
        .evaluate((group) => ({
          x: Number(group.querySelector('.oc-annotation-label')!.getAttribute('x')),
          y: Number(group.querySelector('.oc-annotation-label')!.getAttribute('y')),
          path: group.querySelector('path.oc-annotation-connector')?.getAttribute('d'),
        }));
      await page.mouse.up();
      await expect(page.getByTestId('edit-count')).toHaveText('1');
      const committed = await host
        .locator('.oc-annotation-text')
        .evaluate((group) => ({
          x: Number(group.querySelector('.oc-annotation-label')!.getAttribute('x')),
          y: Number(group.querySelector('.oc-annotation-label')!.getAttribute('y')),
          path: group.querySelector('path.oc-annotation-connector')?.getAttribute('d'),
        }));
      const previewNumbers = preview.path!.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!.map(Number);
      const committedNumbers = committed.path!.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!.map(Number);
      expect(committedNumbers).toHaveLength(previewNumbers.length);
      committedNumbers.forEach((value, index) =>
        expect(value).toBeCloseTo(previewNumbers[index], 7),
      );
      expect(committed.x).toBeCloseTo(preview.x, 7);
      expect(committed.y).toBeCloseTo(preview.y, 7);
      expect(await marker.evaluate((e) => [e.getAttribute('cx'), e.getAttribute('cy')])).toEqual(
        anchorBefore,
      );
      await host.dispatchEvent('fixture-export');
      const exported = await host.getAttribute('data-export');
      expect(exported).toContain(committed.path!);
      const parity = await host.evaluate((node) => {
        const exported = new DOMParser().parseFromString(node.dataset.export!, 'image/svg+xml');
        return ['.oc-annotation-connector', '.oc-annotation-arrowhead', '.oc-annotation-dot'].every(
          (selector) => {
            const attrs = (el: Element | null) =>
              el && [...el.attributes].map((a) => [a.name, a.value]).sort();
            return (
              JSON.stringify(attrs(node.querySelector(selector))) ===
              JSON.stringify(attrs(exported.querySelector(selector)))
            );
          },
        );
      });
      expect(parity).toBe(true);
      const contained = await label.evaluate((el) => {
        const a = el.getBoundingClientRect();
        const b = el.closest('svg')!.getBoundingClientRect();
        return (
          a.left >= b.left - 1 &&
          a.right <= b.right + 1 &&
          a.top >= b.top - 1 &&
          a.bottom <= b.bottom + 1
        );
      });
      expect(contained).toBe(true);
    });
  }
for (const cancellation of ['Escape', 'pointercancel', 'touchcancel', 'replacement', 'width']) {
  test(`${cancellation} emits nothing`, async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto(story);
    const host = page.getByTestId('annotation-gesture-host');
    const label = host.locator('.oc-annotation-label');
    await expect(label).toBeVisible();
    // WebKit briefly reports a text box at the origin before its first SVG paint.
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise(requestAnimationFrame);
    });
    await expect
      .poll(() => label.evaluate((el) => el.getBoundingClientRect().right))
      .toBeGreaterThan(100);
    const box = await label.evaluate((el) => {
      const { x, y, width, height } = el.getBoundingClientRect();
      return { x, y, width, height };
    });
    await page.mouse.move(box.x + 5, box.y + 5);
    await page.mouse.down();
    await page.mouse.move(box.x - 25, box.y + 25, { steps: 3 });
    if (cancellation === 'Escape') await page.keyboard.press('Escape');
    else if (cancellation === 'replacement') await host.dispatchEvent('fixture-replace');
    else if (cancellation === 'width') {
      await page.setViewportSize({ width: 700, height: 900 });
      await expect.poll(() => host.locator('svg').getAttribute('viewBox')).not.toContain('768');
      // Release only after every debounced resize render has landed, so the
      // pointerup meets the rebuilt chart rather than a pending re-render.
      await waitForResizeSettled(host);
    } else await page.evaluate((type) => document.dispatchEvent(new Event(type)), cancellation);
    await page.mouse.up();
    await expect(page.getByTestId('edit-count')).toHaveText('0');
  });
}
