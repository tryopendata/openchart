import { type ChartSpec, sampleMotion } from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { describe, expect, it } from 'vitest';
import { renderChartSVG } from '../svg-renderer';
import { applyTweenState, snapTweenToFinal } from '../transition/apply';
import { buildAnnotationTweens } from '../transition/chrome-tweens';
import { hasAnnotationChanged } from '../transition/gate';
import type { Tween } from '../transition/types';

const spec: ChartSpec = {
  mark: 'point',
  animation: false,
  data: [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ],
  encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' } },
  annotations: [
    {
      type: 'text',
      id: 'callout',
      x: 5,
      y: 5,
      text: 'Heading',
      subtitle: 'Subtitle',
      anchor: 'left',
      offset: { dx: -90, dy: -80 },
      connector: { type: 'curve', bend: 0.5 },
      dot: true,
    },
  ],
};

describe('annotation transition rendering', () => {
  it('keeps an unchanged data marker fixed while the label moves and ends at exact fresh SVG geometry', () => {
    const before = compileChart(spec, { width: 600, height: 400 });
    const after = compileChart(
      { ...spec, annotations: [{ ...spec.annotations![0], offset: { dx: -30, dy: -20 } }] },
      { width: 600, height: 400 },
    );
    const host = document.createElement('div');
    const svg = renderChartSVG(after, host) as SVGSVGElement;
    const final = svg.querySelector('.oc-annotation')!.innerHTML;
    const tweens: Tween[] = [];
    buildAnnotationTweens(svg, before, after, tweens);
    const tween = tweens.find((t) => t.tweenType === 'annotation')!;
    expect(tween).toBeDefined();
    applyTweenState(tween, 50, { duration: 100 }, { duration: 100 }, 0, 100);
    const group = svg.querySelector('.oc-annotation')!;
    expect(group.hasAttribute('transform')).toBe(false);
    expect(Number(group.querySelector('.oc-annotation-dot')!.getAttribute('cx'))).toBe(
      after.annotations[0].dot!.x,
    );
    expect(Number(group.querySelector('.oc-annotation-label')!.getAttribute('x'))).toBeCloseTo(
      before.annotations[0].label!.x +
        (after.annotations[0].label!.x - before.annotations[0].label!.x) *
          sampleMotion({ duration: 100 }, 50).position,
    );
    snapTweenToFinal(tween);
    expect(group.innerHTML).toBe(final);
  });
  it('recognizes connector-only geometry changes at the transition gate', () => {
    const before = compileChart(spec, { width: 600, height: 400 });
    const after = compileChart(
      {
        ...spec,
        annotations: [{ ...spec.annotations![0], connector: { type: 'curve', bend: -0.5 } }],
      },
      { width: 600, height: 400 },
    );
    expect(before.annotations[0].label!.x).toBe(after.annotations[0].label!.x);
    expect(hasAnnotationChanged(before, after)).toBe(true);
  });
  it('keeps enter fades and removes previous-only annotations without ghosting', () => {
    const before = compileChart({ ...spec, annotations: [] }, { width: 600, height: 400 });
    const after = compileChart(spec, { width: 600, height: 400 });
    const svg = renderChartSVG(after, document.createElement('div')) as SVGSVGElement;
    const tweens: Tween[] = [];
    buildAnnotationTweens(svg, before, after, tweens);
    expect(tweens[0]).toMatchObject({ kind: 'enter', fromOpacity: 0, toOpacity: 1 });
    const removed = renderChartSVG(before, document.createElement('div')) as SVGSVGElement;
    const exits: Tween[] = [];
    buildAnnotationTweens(removed, after, before, exits);
    expect(exits).toEqual([]);
  });
});
