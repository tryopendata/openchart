import {
  adaptTheme,
  type Chrome,
  computeChrome,
  type MeasureTextFn,
  type RaceFrame,
  type RaceLayout,
  resolveTheme,
  textAscent,
} from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { barGeometry, computeBarStatic } from '../../../../engine/src/race/layout-bar';
import { SVG_NS } from '../../renderers/svg-dom';
import { RACE_RENDERERS } from '../renderers';
import { createRaceShell } from '../shell';

const chromeContent = {
  title: 'Regional output',
  subtitle: 'Annual figures',
  source: 'Source: Statistics office',
  byline: 'Compiled by the research desk',
  footer: 'Figures are rounded',
} satisfies Chrome;

function barLayout(
  theme = resolveTheme(),
  content: Chrome = chromeContent,
  {
    width = 640,
    height = 360,
    measureText,
  }: { width?: number; height?: number; measureText?: MeasureTextFn } = {},
): Extract<RaceLayout, { mark: 'bar' }> {
  const chrome = computeChrome(content, theme, width, measureText);
  const padding = theme.spacing.padding;
  const area = {
    x: padding,
    y: padding + chrome.topHeight,
    width: width - 2 * padding,
    height: height - 2 * padding - chrome.topHeight - chrome.bottomHeight,
  };
  return {
    mark: 'bar',
    width,
    height,
    area,
    chrome,
    measureText,
    theme,
    watermark: true,
    a11y: {
      altText: 'Regional output ranked by year',
      dataTableFallback: [],
      role: 'img',
      keyboardNavigable: false,
    },
    periods: ['2023', '2024'],
    playback: { durationMs: 8000, holdEndMs: 1500, loop: false, autoplay: false, controls: true },
    colors: ['#2878a0'],
    labels: ['North'],
    static: computeBarStatic({
      area,
      top: 2,
      maxLabelWidth: 45,
      maxValueLabelWidth: 24,
      fontSize: { name: 13, value: 13, tick: 11 },
      showPeriod: false,
      showSummary: false,
      hasNegatives: false,
    }),
  };
}

describe('race shell', () => {
  it('appends a sized, accessible SVG with chrome, then a mark host and controls slot', () => {
    const container = document.createElement('div');
    const layout = barLayout();
    const { root, svg, markHost, controlsSlot } = createRaceShell(container, layout, 'bar');

    expect(container.firstElementChild).toBe(root);
    expect(root.localName).toBe('div');
    expect(root.classList.contains('oc-race-root')).toBe(true);
    expect([...root.children]).toEqual([svg, controlsSlot]);
    expect(controlsSlot.localName).toBe('div');
    expect(controlsSlot.classList.contains('oc-race-controls-slot')).toBe(true);
    expect(controlsSlot.childNodes).toHaveLength(0);
    expect(svg.localName).toBe('svg');
    expect(svg.namespaceURI).toBe(SVG_NS);
    expect(svg.classList.contains('oc-race')).toBe(true);
    expect(svg.getAttribute('viewBox')).toBe('0 0 640 360');
    expect(svg.style.height).toBe('360px');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Regional output ranked by year');
    expect(svg.hasAttribute('aria-hidden')).toBe(false);
    const chrome = svg.querySelector('.oc-chrome');
    expect([...(chrome?.children ?? [])].map((element) => element.textContent)).toEqual(
      Object.values(chromeContent),
    );
    expect(markHost.localName).toBe('g');
    expect(markHost.namespaceURI).toBe(SVG_NS);
    expect(markHost.classList.contains('oc-race-mark')).toBe(true);
    expect(svg.lastElementChild).toBe(markHost);
  });

  it('hides the SVG from assistive technology when requested', () => {
    const layout = barLayout();
    layout.a11y.hidden = true;
    const { svg } = createRaceShell(document.createElement('div'), layout, 'hidden');

    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.hasAttribute('role')).toBe(false);
    expect(svg.hasAttribute('aria-label')).toBe(false);
    expect(svg.querySelector('.oc-title')?.textContent).toBe(chromeContent.title);
    expect(svg.querySelector('.oc-chrome-ref')?.getAttribute('tabindex')).toBe('-1');
  });

  it('uses the current layout dimensions and accessible label', () => {
    const layout = barLayout(
      resolveTheme(),
      { title: 'Seasonal revenue' },
      { width: 360, height: 420 },
    );
    layout.a11y.altText = 'Seasonal revenue ranked by region';
    const { svg } = createRaceShell(document.createElement('div'), layout, 'narrow');

    expect(svg.getAttribute('viewBox')).toBe('0 0 360 420');
    expect(svg.style.height).toBe('420px');
    expect(svg.getAttribute('aria-label')).toBe('Seasonal revenue ranked by region');
  });

  it('matches the controls slot to the chart padding and resolved source size', () => {
    const layout = barLayout(resolveTheme({ spacing: { padding: 28 } }), chromeContent, {
      width: 360,
    });
    const { controlsSlot } = createRaceShell(document.createElement('div'), layout, 'inset');

    expect(controlsSlot.style.getPropertyValue('--oc-race-padding')).toBe('28px');
    expect(controlsSlot.style.getPropertyValue('--oc-source-size')).toBe('10px');
  });

  it('places enabled controls eight pixels after the last footer line', () => {
    const layout = barLayout(resolveTheme({ spacing: { padding: 28 } }), {
      source: {
        text: 'GDP data\nUpdated November 2026',
        offset: { dy: -6 },
        style: { fontSize: 10 },
      },
    });
    layout.watermark = false;
    const { svg, controlsSlot } = createRaceShell(document.createElement('div'), layout, 'lift');
    const source = svg.querySelector('.oc-source');
    expect([...(source?.children ?? [])].map((line) => line.textContent)).toEqual([
      'GDP data',
      'Updated November 2026',
    ]);
    // The fixture uses 10px text with 2px of its line box below the baseline.
    const lastLineBaseline =
      Number(source?.getAttribute('y')) + Number(source?.lastElementChild?.getAttribute('dy'));
    const controlsTop =
      Number.parseFloat(svg.style.height) -
      Number.parseFloat(controlsSlot.style.getPropertyValue('--oc-race-controls-lift'));
    expect(controlsTop - lastLineBaseline - 2).toBeCloseTo(8);

    layout.playback.controls = false;
    const disabled = createRaceShell(document.createElement('div'), layout, 'disabled');
    expect(disabled.controlsSlot.style.getPropertyValue('--oc-race-controls-lift')).toBe('');
  });

  it.each(['', '   '])('names the SVG when the layout label is blank (%j)', (altText) => {
    const layout = barLayout();
    layout.a11y.altText = altText;
    const { svg } = createRaceShell(document.createElement('div'), layout, 'unnamed');

    expect(svg.getAttribute('aria-label')).toBe('Race chart');
  });

  it.each([true, false])('respects the watermark flag %s', (watermark) => {
    const layout = barLayout();
    const { svg } = createRaceShell(
      document.createElement('div'),
      { ...layout, watermark },
      'brand',
    );
    const brand = svg.querySelector('.oc-chrome-ref');

    if (watermark) {
      expect(brand?.getAttribute('href')).toBe('https://openchart.steamfield.io');
      expect(brand?.getAttribute('tabindex')).toBeNull();
      expect(brand?.querySelector('.oc-watermark')?.textContent).toBe('OpenChart');
    } else {
      expect(brand).toBeNull();
      expect(svg.querySelector('.oc-watermark')).toBeNull();
    }
  });

  it.each([undefined, 250])('positions top and footer chrome with bottom anchor %s', (anchor) => {
    const layout = barLayout();
    layout.chrome.bottomAnchorY = anchor;
    const { svg } = createRaceShell(document.createElement('div'), layout, 'footer');
    const bottom = anchor ?? layout.area.y + layout.area.height;

    for (const key of ['title', 'subtitle', 'source', 'byline', 'footer', 'watermark'] as const) {
      const element = layout.chrome[key];
      if (!element) throw new Error(`Expected resolved ${key} in the fixture`);
      const offset = key === 'title' || key === 'subtitle' ? 0 : bottom;
      expect(Number(svg.querySelector(`.oc-${key}`)?.getAttribute('y'))).toBeCloseTo(
        offset + element.y + textAscent(element.style.fontSize),
      );
    }
  });

  it('renders the resolved editorial rule and eyebrow above the title', () => {
    const layout = barLayout(
      resolveTheme({ rule: { width: 32, thickness: 3, color: '#2878a0' } }),
      { ...chromeContent, eyebrow: 'Economy' },
    );
    const { svg } = createRaceShell(document.createElement('div'), layout, 'eyebrow');
    const rule = svg.querySelector('rect.oc-chrome-rule');
    const eyebrow = svg.querySelector('text.oc-eyebrow');
    const { rule: resolvedRule, eyebrow: resolvedEyebrow } = layout.chrome;
    if (!resolvedRule || !resolvedEyebrow) throw new Error('Expected resolved editorial chrome');

    expect(['x', 'y', 'width', 'height', 'fill'].map((name) => rule?.getAttribute(name))).toEqual([
      String(resolvedRule.x),
      String(resolvedRule.y),
      '32',
      '3',
      '#2878a0',
    ]);
    expect(eyebrow?.textContent).toBe('ECONOMY');
    expect(Number(eyebrow?.getAttribute('y'))).toBeCloseTo(
      resolvedEyebrow.y + textAscent(resolvedEyebrow.style.fontSize),
    );
    expect(eyebrow?.getAttribute('x')).toBe(String(resolvedEyebrow.x));
    expect(eyebrow?.nextElementSibling?.textContent).toBe(chromeContent.title);
    expect(svg.querySelector('.oc-eyebrow-dot')).toBeNull();
  });

  it('draws a leading dot and shifts the eyebrow when there is no editorial rule', () => {
    const layout = barLayout(resolveTheme(), { eyebrow: 'Economy', title: chromeContent.title });
    const { svg } = createRaceShell(document.createElement('div'), layout, 'eyebrow-dot');
    const { eyebrow } = layout.chrome;
    if (!eyebrow) throw new Error('Expected a resolved eyebrow');

    const dot = svg.querySelector('circle.oc-eyebrow-dot');
    const text = svg.querySelector('text.oc-eyebrow');
    expect(dot).not.toBeNull();
    expect(dot?.getAttribute('cx')).toBe(String(eyebrow.x + 3));
    expect(dot?.getAttribute('r')).toBe('3');
    expect(dot?.nextElementSibling).toBe(text);
    expect(text?.textContent).toBe('ECONOMY');
    expect(text?.getAttribute('x')).toBe(String(eyebrow.x + 14));
    expect(svg.querySelector('.oc-chrome-rule')).toBeNull();
  });

  it('uses the layout measurer to keep title and brand wrapping consistent with reserved space', () => {
    const title = 'Regional output has grown across most of the country in the past year';
    const brand = 'Research desk';
    const measureText: MeasureTextFn = (value, size) => ({
      width: value.length * size * 0.3,
      height: size,
    });
    const layout = barLayout(resolveTheme(), { ...chromeContent, title, brand }, { measureText });
    const { svg } = createRaceShell(document.createElement('div'), layout, 'measured');

    expect(svg.querySelector('.oc-title')?.textContent).toBe(title);
    expect(svg.querySelector('.oc-title tspan')).toBeNull();
    expect(svg.querySelector('.oc-brand')?.textContent).toBe(brand);
    expect(svg.querySelector('.oc-brand tspan')).toBeNull();
  });

  it('keeps custom branding when the OpenChart watermark is disabled', () => {
    const layout = barLayout(resolveTheme(), { ...chromeContent, brand: 'Research desk' });
    const brand = layout.chrome.brand;
    if (!brand) throw new Error('Expected resolved custom branding');
    layout.chrome.bottomAnchorY = 250;
    const { svg } = createRaceShell(
      document.createElement('div'),
      { ...layout, watermark: false },
      'custom-brand',
    );

    expect(svg.querySelector('.oc-brand')?.textContent).toBe('Research desk');
    expect(Number(svg.querySelector('.oc-brand')?.getAttribute('y'))).toBeCloseTo(
      250 + brand.y + textAscent(brand.style.fontSize),
    );
    expect(svg.querySelector('.oc-watermark')).toBeNull();
  });

  it.each([false, true])('stamps authored theme tokens and reflects dark mode %s', (dark) => {
    const lightTheme = resolveTheme({
      fonts: { family: 'Georgia' },
      chrome: { title: { fontSize: 30 } },
    });
    const theme = dark ? adaptTheme(lightTheme) : lightTheme;
    const { root, svg } = createRaceShell(document.createElement('div'), barLayout(theme), 'theme');

    expect(root.classList.contains('oc-dark')).toBe(dark);
    expect(root.style.getPropertyValue('--oc-font-family')).toBe('Georgia');
    expect(svg.style.getPropertyValue('--oc-font-family')).toBe('Georgia');
    expect(svg.style.getPropertyValue('--oc-title-size')).toBe('30px');
  });

  it('uses an SVG group for a line mark', () => {
    const layout = barLayout();
    const { svg, markHost } = createRaceShell(
      document.createElement('div'),
      {
        ...layout,
        mark: 'line',
        static: {
          plot: layout.area,
          xScale: { domain: [0, 1], range: [0, 600] },
          yAxisX: layout.area.x,
          labelGutter: 0,
          tickFontSize: 12,
        },
      },
      'line',
    );

    expect(markHost.localName).toBe('g');
    expect(markHost.namespaceURI).toBe(SVG_NS);
    expect(markHost.classList.contains('oc-race-mark')).toBe(true);
    expect(svg.lastElementChild).toBe(markHost);
  });

  it('puts the HTML table host after the SVG and before the controls slot', () => {
    const { root, svg, markHost, controlsSlot } = createRaceShell(
      document.createElement('div'),
      {
        ...barLayout(),
        mark: 'table',
        static: {
          rowHeight: 30,
          headerHeight: 30,
          fontSize: 12,
          columns: [],
          labels: {
            rank: 'Rank',
            change: 'Change',
            name: 'Name',
            bar: '',
            value: 'Value',
            share: 'Share',
          },
        },
      },
      'table',
    );

    expect(markHost.localName).toBe('div');
    expect(markHost.namespaceURI).toBe(root.namespaceURI);
    expect(markHost.classList.contains('oc-race-table')).toBe(true);
    expect([...root.children]).toEqual([svg, markHost, controlsSlot]);
  });

  it('destroys only the shell and its contents', () => {
    const container = document.createElement('div');
    const existing = document.createElement('p');
    container.append(existing);
    const { root, controlsSlot, destroy } = createRaceShell(container, barLayout(), 'owned');
    controlsSlot.append(document.createElement('button'));
    const other = createRaceShell(container, barLayout(), 'other');

    destroy();
    expect(root.parentNode).toBeNull();
    expect([...container.children]).toEqual([existing, other.root]);
    destroy();
    expect([...container.children]).toEqual([existing, other.root]);
  });

  it('draws and updates bar geometry in the shell through the registry', () => {
    const layout = barLayout();
    const { svg, markHost } = createRaceShell(document.createElement('div'), layout, 'frame');
    const createBar = RACE_RENDERERS.bar;
    if (!createBar) throw new Error('Expected a registered bar renderer');
    const renderer = createBar(markHost, layout.static, 'frame');
    const frame: RaceFrame = {
      t: 0,
      period: { index: 0, value: 2023, label: '2023' },
      domain: [0, 42],
      items: [
        {
          key: 'north',
          label: 'North',
          color: '#2878a0',
          value: 42,
          valueLabel: '42',
          rank: 0,
          rankPos: 0,
          opacity: 1,
          change: 0,
        },
      ],
    };
    const geometry = barGeometry(layout.static, frame, String);
    renderer.draw(geometry);

    const row = markHost.querySelector('[data-key="north"]');
    const bar = row?.querySelector('rect');
    expect(
      [...(row?.querySelectorAll('text') ?? [])].map((element) => element.textContent),
    ).toEqual(['North', '42']);
    expect(bar?.getAttribute('fill')).toBe('#2878a0');
    expect(Number(bar?.getAttribute('x'))).toBeCloseTo(layout.static.plot.x);
    expect(Number(bar?.getAttribute('y'))).toBeCloseTo(geometry.rows[0].bar.y);
    expect(Number(bar?.getAttribute('width'))).toBeCloseTo(layout.static.plot.width);
    expect(markHost.querySelector('clipPath')?.id).toBe('frame-race-clip');

    const nextGeometry = barGeometry(
      layout.static,
      {
        ...frame,
        t: 1,
        period: { index: 1, value: 2024, label: '2024' },
        items: frame.items.map((item) => ({
          ...item,
          value: 21,
          valueLabel: '21',
          rank: 1,
          rankPos: 1,
        })),
      },
      String,
    );
    renderer.draw(nextGeometry);

    expect(markHost.querySelector('[data-key="north"] rect')).toBe(bar);
    expect(Number(bar?.getAttribute('y'))).toBeCloseTo(nextGeometry.rows[0].bar.y);
    expect(Number(bar?.getAttribute('width'))).toBeCloseTo(layout.static.plot.width / 2);
    expect(row?.querySelector('text:last-child')?.textContent).toBe('21');

    renderer.destroy();
    expect(markHost.children).toHaveLength(0);
    expect(svg.querySelector('.oc-title')?.textContent).toBe(chromeContent.title);
  });
});
