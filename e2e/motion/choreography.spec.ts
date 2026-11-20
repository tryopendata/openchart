import { expect, type Page, test } from '@playwright/test';

/**
 * Entrance choreography, checked by seeking rather than waiting.
 *
 * Every test pauses all CSS animations on the page and sets
 * `anim.currentTime = delay + t`, so "t ms into this mark's tween" is exact
 * and the wall clock never enters. `currentTime` is measured from the start of
 * the delay phase, which is why the delay is added back.
 *
 * Fixtures live in examples/src/testing/motion-choreography.stories.tsx and are
 * not part of the visual baseline set.
 */

const url = (name: string) => `/?story=testing--motion-choreography--${name}&mode=preview`;

async function open(page: Page, name: string) {
  await page.goto(url(name));
  await page.waitForSelector('.oc-root svg.oc-chart .oc-marks');
  // Freeze before anything advances. Entrances run 800ms+, and the story is
  // already mounted, so pause synchronously in the same task as the lookup.
  await page.evaluate(() => {
    for (const a of document.getAnimations()) a.pause();
  });
}

/**
 * Browser-side helper source, installed as `window.__seek(t)`. Seeks every
 * animation to `delay + t`. Animations that only exist as fades (point opacity)
 * are seeked the same way against their own delay.
 */
async function installSeek(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __seek: (t: number) => void };
    w.__seek = (t: number) => {
      for (const a of document.getAnimations()) {
        a.pause();
        const d = Number(a.effect?.getTiming().delay ?? 0);
        a.currentTime = d + t;
      }
    };
  });
}

const seek = (page: Page, t: number) =>
  page.evaluate((time) => (window as unknown as { __seek: (t: number) => void }).__seek(time), t);

test.describe('bars', () => {
  test.beforeEach(async ({ page }) => {
    await open(page, 'bars');
    await installSeek(page);
  });

  test('a bar is fully opaque 140ms into its tween', async ({ page }) => {
    await seek(page, 140);
    const opacities = await page.evaluate(() => {
      const bars = Array.from(document.querySelectorAll('.oc-mark-rect path'));
      return bars.map((bar) => {
        let product = 1;
        for (let el: Element | null = bar; el && el.tagName !== 'HTML'; el = el.parentElement) {
          product *= Number(getComputedStyle(el).opacity);
        }
        return product;
      });
    });
    expect(opacities).toHaveLength(5);
    for (const o of opacities) expect(o).toBe(1);
  });

  test('value labels stay hidden until their bar has landed, then fade in place', async ({ page }) => {
    // Global time: every animation at the same currentTime, so each label's
    // own delay (its bar's 0.97 point) stays in play.
    const samples = await page.evaluate(() => {
      const seekAll = (t: number) => {
        for (const a of document.getAnimations()) {
          a.pause();
          a.currentTime = t;
        }
      };
      const bars = Array.from(document.querySelectorAll('.oc-mark-rect'));
      const rows: Array<{ key: string; t: number; inset: number; opacity: number; y: number }> = [];
      for (let t = 0; t <= 2000; t += 10) {
        seekAll(t);
        for (const g of bars) {
          const path = g.querySelector('path') as SVGPathElement;
          const key = g.getAttribute('data-key') ?? '';
          const label = document.querySelector(`.oc-mark-label[data-label-key="${key}"]`);
          if (!label) throw new Error(`no label for ${key}`);
          const m = /inset\(([^)]*)\)/.exec(getComputedStyle(path).clipPath);
          const inset = m ? Math.max(...m[1].split(/\s+/).map((v) => Number.parseFloat(v) || 0)) : 0;
          rows.push({
            key,
            t,
            inset,
            opacity: Number(getComputedStyle(label).opacity),
            y: label.getBoundingClientRect().top,
          });
        }
      }
      return rows;
    });

    const byKey = new Map<string, typeof samples>();
    for (const r of samples) byKey.set(r.key, [...(byKey.get(r.key) ?? []), r]);
    expect(byKey.size).toBe(5);
    for (const [key, rows] of byKey) {
      for (const r of rows) {
        // Hidden while the bar is still visibly growing.
        if (r.inset > 3) expect(r.opacity, `${key} at ${r.t}ms, bar inset ${r.inset}%`).toBe(0);
        // Labels never move.
        expect(Math.abs(r.y - rows[0].y), `${key} moved at ${r.t}ms`).toBeLessThanOrEqual(0.5);
      }
      expect(rows.at(-1)!.opacity, `${key} settles visible`).toBe(1);
    }
  });
});

test('line points stay hidden until the line has drawn, then pop in left to right', async ({ page }) => {
  await open(page, 'line');

  const samples = await page.evaluate(() => {
    const seekAll = (t: number) => {
      for (const a of document.getAnimations()) {
        a.pause();
        a.currentTime = t;
      }
    };
    const line = document.querySelector('.oc-mark-line') as SVGGElement;
    const points = (
      Array.from(document.querySelectorAll('circle.oc-mark-point')) as SVGCircleElement[]
    ).filter((p) => p.getAttribute('opacity') !== '0');
    const rightInset = () => {
      const m = /inset\(([^)]*)\)/.exec(getComputedStyle(line).clipPath);
      return m ? Number.parseFloat(m[1].split(/\s+/)[1] ?? '0') : 0;
    };
    const firstSeen = points.map(() => -1);
    const insetAtFirstSeen = points.map(() => Number.NaN);
    let sawScale = false;
    for (let t = 0; t <= 2000; t += 2) {
      seekAll(t);
      const inset = rightInset();
      points.forEach((p, i) => {
        const cs = getComputedStyle(p);
        if (Number(cs.opacity) > 0 && Number(cs.opacity) < 1 && cs.transform.startsWith('matrix(')) {
          sawScale = true;
        }
        if (firstSeen[i] < 0 && Number(cs.opacity) > 0.02) {
          firstSeen[i] = t;
          insetAtFirstSeen[i] = inset;
        }
      });
    }
    return {
      sawScale,
      points: points.map((p, i) => ({
        cx: Number(p.getAttribute('cx')),
        firstSeen: firstSeen[i],
        inset: insetAtFirstSeen[i],
      })),
    };
  });

  expect(samples.points.length).toBeGreaterThanOrEqual(8);
  expect(samples.sawScale, 'points scale while they fade in').toBe(true);
  const byX = [...samples.points].sort((a, b) => a.cx - b.cx);
  for (const s of byX) {
    expect(s.firstSeen, `point at ${s.cx} never became visible`).toBeGreaterThanOrEqual(0);
    // The line is all but drawn before any dot shows.
    expect(s.inset, `point at ${s.cx}: line inset ${s.inset}% when it appeared`).toBeLessThanOrEqual(3);
  }
  for (let i = 1; i < byX.length; i++) {
    expect(byX[i].firstSeen, `point ${i} before point ${i - 1}`).toBeGreaterThanOrEqual(byX[i - 1].firstSeen);
  }
  // The cascade spans at most LINE_POINT_CASCADE_MS (240), plus one sample step.
  expect(byX.at(-1)!.firstSeen - byX[0].firstSeen).toBeLessThanOrEqual(242);
});

test('stacks share one clip each, spaced by the D5 gap', async ({ page }) => {
  await open(page, 'stacks');

  const info = await page.evaluate(() => {
    const wrappers = Array.from(document.querySelectorAll('.oc-stack-reveal'));
    return {
      stacks: wrappers.map((w) => ({
        segments: w.querySelectorAll('.oc-mark-rect').length,
        // No segment may carry its own entrance clip.
        ownClips: Array.from(w.querySelectorAll('.oc-mark-rect, .oc-mark-rect path')).flatMap((el) =>
          el.getAnimations().map((a) => (a as CSSAnimation).animationName),
        ),
        delay: Number(w.getAnimations()[0]?.effect?.getTiming().delay),
        name: (w.getAnimations()[0] as CSSAnimation | undefined)?.animationName,
      })),
      totalSegments: document.querySelectorAll('.oc-mark-rect').length,
    };
  });

  const n = 4;
  expect(info.stacks).toHaveLength(n);
  expect(info.stacks.reduce((sum, s) => sum + s.segments, 0)).toBe(info.totalSegments);
  for (const s of info.stacks) {
    expect(s.segments).toBe(3);
    expect(s.ownClips).toEqual([]);
    expect(s.name).toMatch(/^oc-enter-stack/);
  }

  const gap = Math.min(80, 450 / (n - 1));
  for (let i = 1; i < n; i++) {
    const d = info.stacks[i].delay - info.stacks[i - 1].delay;
    expect(d, `gap between stack ${i - 1} and ${i}`).toBeCloseTo(gap, 0);
  }
});

test('heatmap cells pop in place on scattered starts: no clip, opaque 400ms after their delay', async ({ page }) => {
  await open(page, 'heatmap');

  const cells = await page.evaluate(() => {
    const shapes = Array.from(
      document.querySelectorAll('.oc-mark-rect[data-cell] :is(rect, path)'),
    ) as SVGElement[];
    const seekAll = (t: number) => {
      for (const a of document.getAnimations()) {
        a.pause();
        a.currentTime = t;
      }
    };
    const clips = new Set<string>();
    const sample = (t: number) => {
      seekAll(t);
      return shapes.map((shape) => {
        clips.add(getComputedStyle(shape).clipPath);
        clips.add(getComputedStyle(shape.parentElement as Element).clipPath);
        return Number(getComputedStyle(shape).opacity);
      });
    };
    const delays = shapes.map((shape) => Number(shape.getAnimations()[0]?.effect?.getTiming().delay));
    const names = shapes.map((shape) => (shape.getAnimations()[0] as CSSAnimation | undefined)?.animationName);
    const early = sample(0);
    const atOwnEnd = shapes.map((_, i) => sample(delays[i] + 400)[i]);
    for (const t of [50, 150, 450, 600, 900]) sample(t);
    return { delays, names, early, atOwnEnd, clips: [...clips] };
  });

  expect(cells.names.length).toBe(20);
  for (const name of cells.names) expect(name).toBe('oc-enter-cell');
  expect(cells.clips).toEqual(['none']);
  expect(Math.min(...cells.early)).toBeLessThan(1);
  // Starts spread over the 600ms sweep, out of mark order.
  let inversions = 0;
  let pairs = 0;
  cells.delays.forEach((d, i) => {
    expect(d, `cell ${i} delay`).toBeGreaterThanOrEqual(0);
    expect(d + 400, `cell ${i} settles by 1000ms`).toBeLessThanOrEqual(1000.5);
    expect(cells.atOwnEnd[i], `cell ${i} at its delay + 400ms`).toBe(1);
    for (let j = i + 1; j < cells.delays.length; j++) {
      pairs++;
      if (cells.delays[j] < d) inversions++;
    }
  });
  expect(inversions / pairs).toBeGreaterThan(0.25);
});

test('a chart below the fold waits until it is scrolled into view', async ({ page }) => {
  await page.goto(url('below-fold'));
  await page.waitForSelector('#below-fold .oc-root svg.oc-chart .oc-marks');

  const state = () =>
    page.evaluate(() => {
      const svg = document.querySelector('#below-fold svg.oc-chart');
      const anims = document
        .getAnimations()
        .filter((a) => a.effect?.target && svg?.contains(a.effect.target as Node));
      return {
        count: anims.length,
        playState: svg ? getComputedStyle(svg).getPropertyValue('--oc-play-state').trim() : 'no-svg',
        currentTimes: anims.map((a) => Number(a.currentTime ?? 0)),
        states: anims.map((a) => a.playState),
      };
    });

  // Let the page lay out and the observer report; two frames is enough for an
  // IntersectionObserver callback to have fired if it were going to start us.
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
  const before = await state();
  expect(before.count).toBeGreaterThan(0);
  expect(before.playState).toBe('paused');
  expect(before.currentTimes.every((t) => t === 0)).toBe(true);

  await page.locator('#below-fold').scrollIntoViewIfNeeded();

  await expect
    .poll(async () => {
      const s = await state();
      return s.currentTimes.some((t) => t > 0) || s.states.some((p) => p === 'finished');
    })
    .toBe(true);
  expect((await state()).playState).not.toBe('paused');
});
