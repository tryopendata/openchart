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
  // Freeze before anything advances. Entrances run 600ms+, and the story is
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

  test('value labels ride the bar tip', async ({ page }) => {
    // Gap between a label's bottom edge and the visible tip (the clip edge of
    // the bar path), per bar, at time t.
    const gaps = (t: number) =>
      page.evaluate((time) => {
        (window as unknown as { __seek: (t: number) => void }).__seek(time);
        const bars = Array.from(document.querySelectorAll('.oc-mark-rect'));
        return bars.map((g) => {
          const path = g.querySelector('path') as SVGPathElement;
          const key = g.getAttribute('data-key');
          const label = document.querySelector(`.oc-mark-label[data-label-key="${key}"]`);
          if (!label) throw new Error(`no label for ${key}`);
          const box = path.getBoundingClientRect();
          // clip-path: inset(top right bottom left); only top is non-zero for
          // a column growing from the baseline.
          const top = Number.parseFloat(getComputedStyle(path).clipPath.split('(')[1] ?? '0');
          const tip = box.top + (box.height * (Number.isFinite(top) ? top : 0)) / 100;
          return label.getBoundingClientRect().bottom - tip;
        });
      }, t);

    const rest = await gaps(10_000);
    for (const t of [50, 100, 200, 400]) {
      const at = await gaps(t);
      at.forEach((gap, i) => {
        const drift = Math.abs(gap - rest[i]);
        expect(drift, `bar ${i} at ${t}ms: gap ${gap.toFixed(1)} vs rest ${rest[i].toFixed(1)}`).toBeLessThanOrEqual(4);
      });
    }
  });
});

test('line points appear as the clip edge reaches them', async ({ page }) => {
  await open(page, 'line');
  await installSeek(page);

  const samples = await page.evaluate(() => {
    // Global time: every animation at the same currentTime T, so the points'
    // own delays (keyed to the line's progress) stay in play.
    const seekAll = (t: number) => {
      for (const a of document.getAnimations()) {
        a.pause();
        a.currentTime = t;
      }
    };
    const line = document.querySelector('.oc-mark-line') as SVGGElement;
    const points = Array.from(document.querySelectorAll('circle.oc-mark-point')) as SVGCircleElement[];
    const lineBox = line.getBBox();
    const rootCTM = line.getScreenCTM();
    if (!rootCTM) throw new Error('no CTM');
    // Work in SVG user units; the svg has no viewBox scaling in this fixture
    // but the CTM keeps it honest if it ever does.
    const scale = rootCTM.a;
    const firstSeen = points.map(() => -1);
    const edgeAtFirstSeen = points.map(() => Number.NaN);
    const reachedAt = points.map(() => -1);
    const edgeAt = () => {
      const inset = getComputedStyle(line).clipPath;
      const m = /inset\(([^)]*)\)/.exec(inset);
      if (!m) return lineBox.x + lineBox.width;
      const parts = m[1].split(/\s+/);
      const right = Number.parseFloat(parts[1] ?? '0');
      // Percent insets on an SVG element resolve against its fill box.
      return lineBox.x + lineBox.width * (1 - right / 100);
    };
    // 0.1ms steps: the snap curve moves the edge ~9px/ms early on.
    for (let t = 0; t <= 800; t += 0.1) {
      seekAll(t);
      const edge = edgeAt();
      points.forEach((p, i) => {
        const left = Number(p.getAttribute('cx')) - Number(p.getAttribute('r'));
        if (reachedAt[i] < 0 && edge >= left) reachedAt[i] = t;
        if (firstSeen[i] >= 0) return;
        if (Number(getComputedStyle(p).opacity) > 0.05) {
          firstSeen[i] = t;
          edgeAtFirstSeen[i] = edge;
        }
      });
    }
    return points.map((p, i) => ({
      cx: Number(p.getAttribute('cx')),
      r: Number(p.getAttribute('r')),
      firstSeen: firstSeen[i],
      edge: edgeAtFirstSeen[i],
      reachedAt: reachedAt[i],
      scale,
    }));
  });

  expect(samples.length).toBeGreaterThanOrEqual(8);
  for (const s of samples) {
    const left = s.cx - s.r;
    expect(s.firstSeen, `point at ${s.cx} never became visible`).toBeGreaterThanOrEqual(0);
    const msg = `point cx=${s.cx}: clip edge ${s.edge.toFixed(1)} vs left ${left.toFixed(1)} at t=${s.firstSeen.toFixed(1)}ms`;
    // Never visible before the edge gets there.
    expect(s.edge - left, msg).toBeGreaterThanOrEqual(-4);
    // Never visibly late: within a few px of the edge, or within one 60fps
    // frame of the edge reaching it. Early on the snap curve moves the edge
    // ~9px/ms, so a 2ms fade threshold reads as 17px but is never on screen.
    const lagMs = s.firstSeen - s.reachedAt;
    expect(s.edge - left <= 4 || lagMs <= 1000 / 60, `${msg}, ${lagMs.toFixed(1)}ms late`).toBe(
      true,
    );
  }
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

  const gap = Math.min(80, 300 / (n - 1));
  for (let i = 1; i < n; i++) {
    const d = info.stacks[i].delay - info.stacks[i - 1].delay;
    expect(d, `gap between stack ${i - 1} and ${i}`).toBeCloseTo(gap, 0);
  }
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
