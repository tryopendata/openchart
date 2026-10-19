import { describe, expect, it } from 'vitest';
import { resolveTheme } from '../../theme/resolve';
import { computeChrome } from '../chrome';
import { estimateTextHeight } from '../text-measure';

const theme = resolveTheme();
const measured = (text: string, size: number) => ({
  width: text.length * size * 0.6,
  height: size,
});

describe('measured attribution', () => {
  it('reserves the measured brand width instead of a fixed 130px column', () => {
    const chrome = computeChrome({ source: 'Source: Census' }, theme, 600, measured);
    expect(chrome.watermark?.text).toBe('OpenData');
    expect(chrome.source!.maxWidth).toBeGreaterThan(600 - theme.spacing.padding * 2 - 130);
    expect(chrome.source!.x + chrome.source!.maxWidth).toBeLessThan(
      chrome.watermark!.x - chrome.watermark!.maxWidth,
    );
  });
  it('gives a long narrow source the full row when stacking saves height', () => {
    const chrome = computeChrome(
      { source: 'Source: A long research institute and county administrative records, 2020–2025' },
      theme,
      180,
      measured,
    );
    expect(chrome.attributionLayout).toBe('stacked');
    expect(chrome.source!.maxWidth).toBe(180 - theme.spacing.padding * 2 - 5);
    expect(chrome.watermark!.y).toBeGreaterThan(chrome.source!.y);
  });
  it('keeps short desktop attribution inline', () => {
    const chrome = computeChrome(
      { source: 'Source: Census', byline: 'By Research Team' },
      theme,
      1280,
      measured,
    );
    expect(chrome.attributionLayout).toBe('inline');
    expect(chrome.watermark!.y).toBe(chrome.source!.y);
  });
  it('measures multiline custom brands, includes legend reserve, and suppresses watermark', () => {
    const chrome = computeChrome(
      { brand: { text: 'Our research\nOpen methods', style: { fontSize: 24 } } },
      theme,
      390,
      measured,
      'full',
      undefined,
      true,
      44,
    );
    expect(chrome.watermark).toBeUndefined();
    expect(chrome.brand!.y).toBe(44 + theme.spacing.chartToFooter);
    expect(chrome.bottomHeight).toBeGreaterThanOrEqual(
      chrome.brand!.y +
        estimateTextHeight(24, 2, chrome.brand!.style.lineHeight) +
        theme.spacing.padding,
    );
  });
  it('preserves explicit custom brand style, offsets, and maxLines', () => {
    const chrome = computeChrome(
      {
        source: { text: 'Source', offset: { dx: 3, dy: 4 } },
        brand: {
          text: 'Authored brand',
          offset: { dx: -7, dy: 9 },
          style: { fontSize: 22, color: 'red', maxLines: 1 },
        },
      },
      theme,
      1280,
      measured,
    );
    expect(chrome.source!.x).toBe(theme.spacing.padding + 3);
    expect(chrome.brand!.x).toBe(1280 - theme.spacing.padding - 7);
    expect(chrome.brand!.y).toBe(theme.spacing.chartToFooter + 9);
    expect(chrome.brand!.style.fontSize).toBe(22);
    expect(chrome.brand!.style.fill).toBe('red');
    expect(chrome.brand!.maxLines).toBe(1);
  });
  it.each([
    'compact',
    'hidden',
  ] as const)('%s preserves its existing hidden-attribution policy', (mode) => {
    const chrome = computeChrome({ source: 'Source', brand: 'Custom' }, theme, 390, measured, mode);
    expect(chrome.source).toBeUndefined();
    expect(chrome.brand).toBeUndefined();
    expect(chrome.watermark?.text).toBe('OpenData');
  });
  it('watermark off gives attribution the full width without a ghost reserve', () => {
    const chrome = computeChrome(
      { source: 'Source' },
      theme,
      390,
      measured,
      'full',
      undefined,
      false,
    );
    expect(chrome.source!.maxWidth).toBe(390 - theme.spacing.padding * 2 - 5);
    expect(chrome.watermark).toBeUndefined();
  });
  it('empty chrome still resolves the same portable watermark as other modes', () => {
    const chrome = computeChrome(undefined, theme, 390, measured);
    expect(chrome.watermark?.style.fontSize).toBe(12);
    expect(chrome.watermark?.y).toBe(theme.spacing.chartToFooter);
  });
});
