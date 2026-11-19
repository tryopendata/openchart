import { expect, test } from '@playwright/test';

/**
 * Exits (RFC D9): a removed bar's ghost has faded out before any surviving bar
 * moves onto the space it occupied.
 *
 * Method: update transitions run on the driver's own rAF loop, which a page
 * can't seek (unlike the CSS entrances in choreography.spec.ts). So a recorder
 * rides rAF alongside it and, every frame, reads the ghost's computed opacity
 * and every bar's getBBox(). Each frame's reads come from one DOM state (the
 * driver writes once per frame, before or after the recorder, never during),
 * so opacity and geometry are always paired; the only tolerance is 0.5px on
 * geometry for antialiasing-free box arithmetic.
 *
 * Fixture: the "Update transitions (interactive)" demo in
 * examples/src/gallery/features-animation.stories.tsx. "Remove point" drops the
 * last bar, and the remaining bars widen into its slot.
 */

const STORY = '/?story=features--animation&mode=preview';

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Frame {
  t: number;
  ghost: { opacity: number; box: Box } | null;
  survivors: Box[];
}

test('a removed bar fades out before its neighbours cover its slot', async ({ page }) => {
  await page.goto(STORY);
  // The demo card lazy-mounts when it nears the viewport.
  await page.getByRole('heading', { name: 'Update transitions (interactive)' }).scrollIntoViewIfNeeded();
  const remove = page.getByRole('button', { name: 'Remove point' });
  await remove.scrollIntoViewIfNeeded();

  // The chart sits just above its buttons. Wait for the entrance (which plays
  // once it is in view) to finish, since an update during it doesn't animate.
  await page.waitForFunction(() => {
    const button = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Remove point',
    );
    const svg = button?.parentElement?.previousElementSibling?.querySelector('svg.oc-chart');
    return !!svg && svg.querySelectorAll('.oc-mark-rect').length === 6 && !svg.classList.contains('oc-animate');
  });

  // Note the slot of the bar that is about to go, then start recording.
  const slot = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Remove point',
    )!;
    const svg = button.parentElement!.previousElementSibling!.querySelector('svg.oc-chart')!;
    const bars = Array.from(svg.querySelectorAll<SVGGraphicsElement>('.oc-mark-rect'));
    const last = bars.reduce((a, b) => (b.getBBox().x > a.getBBox().x ? b : a));
    const { x, y, width, height } = last.getBBox();

    const w = window as unknown as { __frames: Frame[]; __recording: boolean };
    w.__frames = [];
    w.__recording = true;
    const box = (el: SVGGraphicsElement) => {
      const b = el.getBBox();
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    };
    const record = (t: number) => {
      const ghost = svg.querySelector<SVGGraphicsElement>('.oc-mark-rect.oc-ghost');
      w.__frames.push({
        t,
        ghost: ghost ? { opacity: Number(getComputedStyle(ghost).opacity), box: box(ghost) } : null,
        survivors: Array.from(
          svg.querySelectorAll<SVGGraphicsElement>('.oc-mark-rect:not(.oc-ghost)'),
        ).map(box),
      });
      if (w.__recording) requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
    return { x, y, width, height };
  });

  await remove.click();
  // Record until the ghost has come and gone and the update (500ms after the
  // 120ms exit hold) has had time to land.
  await page.waitForFunction(() => {
    const frames = (window as unknown as { __frames: Frame[] }).__frames;
    const first = frames.findIndex((f) => f.ghost !== null);
    if (first < 0) return false;
    const last = frames[frames.length - 1];
    return last.ghost === null && last.t - frames[first].t > 800;
  });
  const frames = await page.evaluate(() => {
    const w = window as unknown as { __frames: unknown[]; __recording: boolean };
    w.__recording = false;
    return w.__frames as Frame[];
  });

  const withGhost = frames.filter((f) => f.ghost !== null);
  expect(withGhost.length, 'the removal produced a ghost').toBeGreaterThan(0);
  const start = withGhost[0].t;

  const overlapArea = (a: Box, b: Box) => {
    const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    return w > 0.5 && h > 0.5 ? w * h : 0;
  };

  let firstCover = Number.POSITIVE_INFINITY;
  for (const f of frames) {
    if (f.t < start) continue;
    const covered = f.survivors.some((s) => overlapArea(s, slot) > 0);
    if (covered) firstCover = Math.min(firstCover, f.t);
    if (!f.ghost) continue;
    if (covered) {
      expect(f.ghost.opacity, `ghost visible ${Math.round(f.t - start)}ms in, under a neighbour`).toBe(0);
    }
    // Ghost geometry stays in [from, to]: same column, collapsing onto the baseline.
    expect(f.ghost.box.x).toBeCloseTo(slot.x, 0);
    expect(f.ghost.box.width).toBeCloseTo(slot.width, 0);
    expect(f.ghost.box.height).toBeLessThanOrEqual(slot.height + 0.5);
    expect(f.ghost.box.y + f.ghost.box.height).toBeCloseTo(slot.y + slot.height, 0);
  }

  // The fixture is meaningful only if the survivors do reach the slot.
  expect(Number.isFinite(firstCover), 'survivors widen into the removed slot').toBe(true);
  // The ghost is gone well before the update has finished.
  const lastGhost = withGhost[withGhost.length - 1].t;
  expect(lastGhost - start).toBeLessThan(700);
});
