import {
  evalValueCurve,
  FADE_CURVE,
  sampleMotion,
  springDuration,
  updateTimeline,
} from '@opendata-ai/openchart-core';
import { interpolateRgb } from 'd3-interpolate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ElementTween, makeGhost, runElementTweens } from '../element-tween';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A rAF the test steps by hand with explicit timestamps. */
function installFakeRaf() {
  let queue = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextId++;
    queue.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    queue.delete(id);
  });
  return {
    frame(now: number) {
      const due = queue;
      queue = new Map();
      for (const cb of due.values()) cb(now);
    },
    get pending() {
      return queue.size;
    },
  };
}

function svgEl(tag: string, attrs: Record<string, string> = {}, parent?: Element): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  parent?.appendChild(el);
  return el;
}

const num = (el: Element, attr: string) => Number(el.getAttribute(attr));

describe('runElementTweens', () => {
  let raf: ReturnType<typeof installFakeRaf>;

  beforeEach(() => {
    raf = installFakeRaf();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('writes every from-state synchronously, before the first frame', () => {
    const rect = svgEl('rect', { width: '100', fill: '#ff0000', opacity: '0.8' });
    const row = svgEl('g', { transform: 'translate(0, 40)' });
    const added = svgEl('g');
    const handle = runElementTweens(
      [
        { kind: 'number', el: rect, attr: 'width', from: 20, to: 100 },
        { kind: 'color', el: rect, attr: 'fill', from: '#0000ff', to: '#ff0000' },
        { kind: 'offset', el: row, dx: 0, dy: -30 },
        { kind: 'enter', el: added },
      ],
      { update: { duration: 400 } },
    );
    expect(raf.pending).toBe(1);
    expect(num(rect, 'width')).toBe(20);
    expect(rect.getAttribute('fill')).toBe(interpolateRgb('#0000ff', '#ff0000')(0));
    expect(row.getAttribute('transform')).toBe('translate(0, 40) translate(0, -30)');
    expect(added.getAttribute('opacity')).toBe('0');
    expect(handle.running).toBe(true);
  });

  it('follows sampleMotion for curve phases and lands exactly on the final state', async () => {
    const rect = svgEl('rect', { width: '100' });
    const update = { duration: 400, ease: 'snappy' as const };
    const handle = runElementTweens(
      [{ kind: 'number', el: rect, attr: 'width', from: 0, to: 100 }],
      { update },
    );
    raf.frame(1000); // start locks on the first frame
    expect(num(rect, 'width')).toBe(0);
    for (const ms of [50, 100, 250, 399]) {
      raf.frame(1000 + ms);
      expect(num(rect, 'width')).toBeCloseTo(100 * sampleMotion(update, ms).position, 10);
    }
    raf.frame(1400);
    expect(num(rect, 'width')).toBe(100);
    expect(handle.running).toBe(false);
    expect(raf.pending).toBe(0);
    await handle.finished;
  });

  it('holds CSS transitions off on tweened elements and restores them at the end', async () => {
    const label = svgEl('text', { style: 'transition: opacity 140ms ease-out' });
    const rect = svgEl('rect');
    const handle = runElementTweens(
      [
        { kind: 'enter', el: label },
        { kind: 'number', el: rect, attr: 'width', from: 0, to: 10 },
      ],
      { update: { duration: 400 } },
    );
    expect(label.style.transition).toBe('none');
    expect(rect.style.transition).toBe('none');
    handle.cancel();
    await handle.finished;
    expect(label.style.transition).toBe('opacity 140ms ease-out');
    expect(rect.style.transition).toBe('');
  });

  it('follows a spring phase', () => {
    const rect = svgEl('rect');
    const spring = { stiffness: 180, damping: 30 };
    const update = { duration: springDuration(spring), spring };
    runElementTweens([{ kind: 'number', el: rect, attr: 'x', from: 10, to: 110 }], { update });
    raf.frame(0);
    raf.frame(120);
    const expected = 10 + 100 * sampleMotion(update, 120).position;
    expect(num(rect, 'x')).toBeCloseTo(expected, 10);
    // A spring isn't the default curve: the sample really comes from the spring.
    expect(sampleMotion(update, 120).position).not.toBeCloseTo(
      evalValueCurve('smooth', 120 / update.duration),
      3,
    );
    raf.frame(update.duration);
    expect(num(rect, 'x')).toBe(110);
  });

  it('interpolates colours, including inline style', () => {
    const label = svgEl('text');
    label.style.setProperty('fill', '#ffffff');
    const update = { duration: 200 };
    runElementTweens(
      [{ kind: 'color', el: label, attr: 'fill', from: '#000000', to: '#ffffff', style: true }],
      { update },
    );
    raf.frame(0);
    raf.frame(100);
    const p = sampleMotion(update, 100).position;
    expect(label.style.getPropertyValue('fill')).toBe(interpolateRgb('#000000', '#ffffff')(p));
    expect(label.getAttribute('fill')).toBeNull();
  });

  it('never interpolates a url() paint', () => {
    const a = svgEl('path', { fill: 'url(#pattern-2)' });
    const b = svgEl('path', { fill: '#336699' });
    runElementTweens(
      [
        { kind: 'color', el: a, attr: 'fill', from: '#ff0000', to: 'url(#pattern-2)' },
        { kind: 'color', el: b, attr: 'fill', from: 'url(#pattern-1)', to: '#336699' },
      ],
      { update: { duration: 200 } },
    );
    // The rendered final paint stays throughout.
    expect(a.getAttribute('fill')).toBe('url(#pattern-2)');
    expect(b.getAttribute('fill')).toBe('#336699');
    raf.frame(0);
    raf.frame(100);
    expect(a.getAttribute('fill')).toBe('url(#pattern-2)');
    expect(b.getAttribute('fill')).toBe('#336699');
  });

  it('morphs a path with matching commands and snaps one whose commands differ', () => {
    const same = svgEl('path', { d: 'M0,10L100,10' });
    const changed = svgEl('path', { d: 'M0,0C10,10,20,20,30,30' });
    const update = { duration: 200 };
    runElementTweens(
      [
        { kind: 'path', el: same, attr: 'd', from: 'M0,0L100,0', to: 'M0,10L100,10' },
        { kind: 'path', el: changed, attr: 'd', from: 'M0,0L30,30', to: 'M0,0C10,10,20,20,30,30' },
      ],
      { update },
    );
    expect(same.getAttribute('d')).toBe('M0,0L100,0');
    expect(changed.getAttribute('d')).toBe('M0,0C10,10,20,20,30,30');
    raf.frame(0);
    raf.frame(100);
    const y = 10 * sampleMotion(update, 100).position;
    expect(same.getAttribute('d')).toBe(`M0,${y}L100,${y}`);
    expect(changed.getAttribute('d')).toBe('M0,0C10,10,20,20,30,30');
  });

  it('slides an offset home and restores the element transform', () => {
    const row = svgEl('g', { transform: 'translate(0, 40)' });
    const bare = svgEl('g');
    const update = { duration: 200 };
    runElementTweens(
      [
        { kind: 'offset', el: row, dx: 0, dy: -30 },
        { kind: 'offset', el: bare, dx: 12, dy: 0 },
      ],
      { update },
    );
    raf.frame(0);
    raf.frame(100);
    const rest = 1 - sampleMotion(update, 100).position;
    expect(row.getAttribute('transform')).toBe(`translate(0, 40) translate(0, ${-30 * rest})`);
    raf.frame(200);
    expect(row.getAttribute('transform')).toBe('translate(0, 40)');
    expect(bare.hasAttribute('transform')).toBe(false);
  });

  it('holds survivors and enters until removal ghosts clear', () => {
    const svg = svgEl('svg');
    const survivor = svgEl('rect', {}, svg);
    const entering = svgEl('rect', {}, svg);
    const ghost = svgEl('rect', { class: 'oc-ghost' }, svg);
    const update = { duration: 400 };
    const exit = { duration: 120, ease: 'gentle' as const };
    const timeline = updateTimeline(update, exit, true);
    runElementTweens(
      [
        { kind: 'number', el: survivor, attr: 'y', from: 0, to: 100 },
        { kind: 'enter', el: entering },
        { kind: 'exit', ghost },
      ],
      { update, exit },
    );
    raf.frame(0);
    raf.frame(60);
    // Survivors wait for the exit.
    expect(num(survivor, 'y')).toBe(0);
    expect(entering.getAttribute('opacity')).toBe('0');
    expect(num(ghost, 'opacity')).toBeCloseTo(1 - sampleMotion(exit, 60).position, 10);

    raf.frame(timeline.updateDelayMs + 100);
    expect(num(survivor, 'y')).toBeCloseTo(100 * sampleMotion(update, 100).position, 10);
    // Enters start at 40% of the survivors' tween, after the hold.
    expect(entering.getAttribute('opacity')).toBe('0');
    expect(num(ghost, 'opacity')).toBe(0);

    const midEnter = timeline.enterDelayMs + timeline.enterMs / 2;
    raf.frame(midEnter);
    expect(num(entering, 'opacity')).toBeCloseTo(evalValueCurve(FADE_CURVE, 0.5), 10);

    raf.frame(timeline.totalMs);
    expect(num(survivor, 'y')).toBe(100);
    expect(entering.hasAttribute('opacity')).toBe(false);
    expect(ghost.isConnected).toBe(false);
  });

  it('does not hold anything without removals', () => {
    const survivor = svgEl('rect');
    const update = { duration: 400 };
    runElementTweens([{ kind: 'number', el: survivor, attr: 'y', from: 0, to: 100 }], {
      update,
      exit: { duration: 120 },
    });
    raf.frame(0);
    raf.frame(60);
    expect(num(survivor, 'y')).toBeCloseTo(100 * sampleMotion(update, 60).position, 10);
    raf.frame(400);
    expect(num(survivor, 'y')).toBe(100);
  });

  it('removes ghosts at once when the exit phase is off', () => {
    const svg = svgEl('svg');
    const ghost = svgEl('rect', {}, svg);
    runElementTweens([{ kind: 'exit', ghost }], { update: { duration: 300 }, exit: null });
    expect(ghost.getAttribute('opacity')).toBe('0');
    raf.frame(0);
    raf.frame(300);
    expect(ghost.isConnected).toBe(false);
  });

  it('removes ghosts and snaps to the final state on cancel', async () => {
    const svg = svgEl('svg');
    const rect = svgEl('rect', { width: '100' }, svg);
    const ghost = svgEl('rect', {}, svg);
    const handle = runElementTweens(
      [
        { kind: 'number', el: rect, attr: 'width', from: 0, to: 100 },
        { kind: 'exit', ghost },
      ],
      { update: { duration: 400 }, exit: { duration: 120 } },
    );
    raf.frame(0);
    raf.frame(50);
    handle.cancel();
    expect(handle.running).toBe(false);
    expect(num(rect, 'width')).toBe(100);
    expect(ghost.isConnected).toBe(false);
    expect(raf.pending).toBe(0);
    await handle.finished;
    // Cancelling twice is harmless.
    handle.cancel();
  });

  it('snaps when more distinct elements than maxMarks would move', async () => {
    const a = svgEl('rect', { width: '10' });
    const b = svgEl('rect', { width: '20' });
    const tweens: ElementTween[] = [
      { kind: 'number', el: a, attr: 'width', from: 0, to: 10 },
      { kind: 'number', el: a, attr: 'x', from: 0, to: 5 },
      { kind: 'number', el: b, attr: 'width', from: 0, to: 20 },
    ];
    const handle = runElementTweens(tweens, { update: { duration: 300 }, maxMarks: 1 });
    expect(handle.running).toBe(false);
    expect(raf.pending).toBe(0);
    expect(num(a, 'width')).toBe(10);
    expect(num(a, 'x')).toBe(5);
    expect(num(b, 'width')).toBe(20);
    await handle.finished;

    // Two distinct elements (three tweens) fit a cap of 2.
    const capped = runElementTweens(tweens, { update: { duration: 300 }, maxMarks: 2 });
    expect(capped.running).toBe(true);
    capped.cancel();
  });

  it('snaps under reduced motion and for a zero-length update', () => {
    const rect = svgEl('rect', { width: '100' });
    const tween: ElementTween = { kind: 'number', el: rect, attr: 'width', from: 0, to: 100 };
    expect(runElementTweens([tween], { update: { duration: 0 } }).running).toBe(false);
    expect(num(rect, 'width')).toBe(100);

    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
    } as unknown as MediaQueryList);
    expect(runElementTweens([tween], { update: { duration: 300 } }).running).toBe(false);
    expect(num(rect, 'width')).toBe(100);
    expect(raf.pending).toBe(0);
  });

  it('returns a settled handle for an empty list', async () => {
    const handle = runElementTweens([], { update: { duration: 300 } });
    expect(handle.running).toBe(false);
    expect(raf.pending).toBe(0);
    await handle.finished;
  });
});

describe('makeGhost', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('clones as an inert, unkeyed ghost', () => {
    const svg = svgEl('svg');
    const marks = svgEl('g', {}, svg);
    const source = svgEl(
      'g',
      { 'data-key': 'a', id: 'row-a', tabindex: '0', class: 'oc-barlist-row' },
      marks,
    );
    svgEl('rect', { 'data-key': 'a-bar', id: 'bar-a', width: '40' }, source);

    const ghost = makeGhost(source, marks);
    expect(ghost.parentNode).toBe(marks);
    expect(ghost).not.toBe(source);
    expect(ghost.classList.contains('oc-ghost')).toBe(true);
    expect(ghost.classList.contains('oc-barlist-row')).toBe(true);
    expect(ghost.getAttribute('aria-hidden')).toBe('true');
    expect(ghost.getAttribute('pointer-events')).toBe('none');
    expect(ghost.hasAttribute('data-key')).toBe(false);
    expect(ghost.hasAttribute('id')).toBe(false);
    expect(ghost.hasAttribute('tabindex')).toBe(false);
    const bar = ghost.querySelector('rect') as Element;
    expect(bar.hasAttribute('data-key')).toBe(false);
    expect(bar.hasAttribute('id')).toBe(false);
    expect(bar.getAttribute('width')).toBe('40');
    // The source is untouched.
    expect(source.getAttribute('data-key')).toBe('a');
  });

  it('re-homes url(#id) paints from the old SVG into the new one under fresh ids', () => {
    // Old SVG: a sankey link painted with a gradient whose id the new SVG reuses
    // for a different link.
    const oldSvg = svgEl('svg');
    document.body.appendChild(oldSvg);
    const oldDefs = svgEl('defs', {}, oldSvg);
    const oldGrad = svgEl('linearGradient', { id: 'grad-0', x1: '10', x2: '90' }, oldDefs);
    svgEl('stop', { offset: '0', 'stop-color': '#ff0000' }, oldGrad);
    const link = svgEl(
      'path',
      { d: 'M0,0L10,10', fill: 'url(#grad-0)', style: 'stroke: url("#grad-0")' },
      oldSvg,
    );

    const newSvg = svgEl('svg');
    document.body.appendChild(newSvg);
    const newDefs = svgEl('defs', {}, newSvg);
    const liveGrad = svgEl('linearGradient', { id: 'grad-0', x1: '0', x2: '50' }, newDefs);
    const links = svgEl('g', {}, newSvg);

    const ghost = makeGhost(link, links);
    const fill = ghost.getAttribute('fill') as string;
    const ref = /^url\(#(.+)\)$/.exec(fill)?.[1] as string;
    expect(ref).toBeTruthy();
    expect(ref).not.toBe('grad-0');
    expect(ghost.getAttribute('style')).toContain(`url(#${ref})`);

    const copied = [...newDefs.children].find((c) => c.getAttribute('id') === ref) as Element;
    expect(copied).toBeTruthy();
    expect(copied.getAttribute('x1')).toBe('10');
    expect(copied.querySelector('stop')?.getAttribute('stop-color')).toBe('#ff0000');
    // The live def and the old SVG are untouched; one copy per referenced id.
    expect(liveGrad.getAttribute('x1')).toBe('0');
    expect(link.getAttribute('fill')).toBe('url(#grad-0)');
    expect(newDefs.children.length).toBe(2);
  });

  it('follows href chains between defs and creates <defs> when missing', () => {
    const oldSvg = svgEl('svg');
    const oldDefs = svgEl('defs', {}, oldSvg);
    svgEl('linearGradient', { id: 'base' }, oldDefs);
    svgEl('linearGradient', { id: 'derived', href: '#base' }, oldDefs);
    const shape = svgEl('rect', { fill: 'url(#derived)' }, oldSvg);

    const newSvg = svgEl('svg');
    const ghost = makeGhost(shape, newSvg);
    const defs = newSvg.querySelector('defs') as Element;
    expect(defs).toBeTruthy();
    const ids = [...defs.children].map((c) => c.getAttribute('id'));
    expect(ids).toHaveLength(2);
    const derivedId = /url\(#(.+)\)/.exec(ghost.getAttribute('fill') as string)?.[1];
    const derived = [...defs.children].find((c) => c.getAttribute('id') === derivedId);
    const baseRef = derived?.getAttribute('href') as string;
    expect(ids).toContain(baseRef.slice(1));
    expect(baseRef).not.toBe('#base');
  });

  it('leaves references alone within the same SVG', () => {
    const svg = svgEl('svg');
    const defs = svgEl('defs', {}, svg);
    svgEl('linearGradient', { id: 'g1' }, defs);
    const shape = svgEl('rect', { fill: 'url(#g1)' }, svg);
    const ghost = makeGhost(shape, svg);
    expect(ghost.getAttribute('fill')).toBe('url(#g1)');
    expect(defs.children.length).toBe(1);
  });
});
