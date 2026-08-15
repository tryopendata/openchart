import { describe, expect, it } from 'vitest';
import { resolveTheme } from '../../theme/resolve';
import type { Chrome } from '../../types/spec';
import { computeChrome } from '../chrome';
import { BRAND_FONT_SIZE, estimateTextHeight } from '../text-measure';

const theme = resolveTheme();

describe('computeChrome', () => {
  it('returns zero heights when chrome is undefined and watermark is off', () => {
    const result = computeChrome(undefined, theme, 600, undefined, 'full', undefined, false);
    expect(result.topHeight).toBe(0);
    expect(result.bottomHeight).toBe(0);
    expect(result.title).toBeUndefined();
    expect(result.subtitle).toBeUndefined();
  });

  it('returns zero heights in hidden mode when watermark is false', () => {
    const chrome: Chrome = { title: 'Title', source: 'Source' };
    const result = computeChrome(chrome, theme, 600, undefined, 'hidden', undefined, false);
    expect(result.topHeight).toBe(0);
    expect(result.bottomHeight).toBe(0);
  });

  it('reserves a brand band in hidden mode when watermark is explicitly on', () => {
    const chrome: Chrome = { title: 'Title', source: 'Source' };
    const result = computeChrome(chrome, theme, 600, undefined, 'hidden', undefined, true);
    const pad = theme.spacing.padding;
    const expectedBottom =
      theme.spacing.chartToFooter + estimateTextHeight(BRAND_FONT_SIZE, 1) + pad;
    expect(result.topHeight).toBe(0);
    expect(result.bottomHeight).toBe(expectedBottom);
  });

  it('returns zero heights in hidden mode when the chart is too narrow for the brand', () => {
    const chrome: Chrome = { title: 'Title', source: 'Source' };
    const result = computeChrome(chrome, theme, 100, undefined, 'hidden', undefined, true);
    expect(result.topHeight).toBe(0);
    expect(result.bottomHeight).toBe(0);
  });

  it('reserves brand height when chrome is empty but chart is wide enough', () => {
    const result = computeChrome({}, theme, 600);
    const pad = theme.spacing.padding;
    const expectedBottom =
      theme.spacing.chartToFooter + estimateTextHeight(BRAND_FONT_SIZE, 1) + pad;
    expect(result.topHeight).toBe(0);
    expect(result.bottomHeight).toBe(expectedBottom);
  });

  it('returns zero bottom height when chrome is empty and chart is too narrow for brand', () => {
    const result = computeChrome({}, theme, 100);
    expect(result.topHeight).toBe(0);
    expect(result.bottomHeight).toBe(0);
  });

  it('reserves brand height in compact mode for wide charts', () => {
    const chrome: Chrome = { title: 'Title', source: 'Source' };
    const result = computeChrome(chrome, theme, 600, undefined, 'compact');
    const pad = theme.spacing.padding;
    const expectedBottom =
      theme.spacing.chartToFooter + estimateTextHeight(BRAND_FONT_SIZE, 1) + pad;
    expect(result.topHeight).toBeGreaterThan(0);
    expect(result.source).toBeUndefined(); // compact hides bottom chrome text
    expect(result.bottomHeight).toBe(expectedBottom);
  });

  it('returns zero bottom height in compact mode for narrow charts', () => {
    const chrome: Chrome = { title: 'Title', source: 'Source' };
    const result = computeChrome(chrome, theme, 100, undefined, 'compact');
    expect(result.bottomHeight).toBe(0);
  });

  it('positions title correctly', () => {
    const chrome: Chrome = { title: 'GDP Growth Rate' };
    const result = computeChrome(chrome, theme, 600);

    expect(result.title).toBeDefined();
    expect(result.title!.text).toBe('GDP Growth Rate');
    expect(result.title!.x).toBe(theme.spacing.padding);
    expect(result.title!.y).toBe(theme.spacing.padding);
    expect(result.title!.style.fontSize).toBe(theme.chrome.title.fontSize);
    expect(result.title!.style.fontWeight).toBe(theme.chrome.title.fontWeight);
    expect(result.topHeight).toBeGreaterThan(0);
  });

  it('positions subtitle below title', () => {
    const chrome: Chrome = { title: 'Title', subtitle: 'Subtitle text' };
    const result = computeChrome(chrome, theme, 600);

    expect(result.title).toBeDefined();
    expect(result.subtitle).toBeDefined();
    expect(result.subtitle!.y).toBeGreaterThan(result.title!.y);
  });

  it('computes top height from title + subtitle + gaps', () => {
    const chrome: Chrome = { title: 'Title', subtitle: 'Subtitle' };
    const result = computeChrome(chrome, theme, 600);

    // Top height should account for title, gap, subtitle, and chromeToChart
    expect(result.topHeight).toBeGreaterThan(30);
  });

  it('positions source in bottom chrome', () => {
    const chrome: Chrome = { source: 'Source: World Bank' };
    const result = computeChrome(chrome, theme, 600);

    expect(result.source).toBeDefined();
    expect(result.source!.text).toBe('Source: World Bank');
    expect(result.bottomHeight).toBeGreaterThan(0);
  });

  it('handles ChromeText objects with style overrides', () => {
    const chrome: Chrome = {
      title: {
        text: 'Custom Title',
        style: { fontSize: 24, fontWeight: 700, color: '#ff0000' },
      },
    };
    const result = computeChrome(chrome, theme, 600);

    expect(result.title!.style.fontSize).toBe(24);
    expect(result.title!.style.fontWeight).toBe(700);
    expect(result.title!.style.fill).toBe('#ff0000');
  });

  it('sets maxWidth based on width minus padding', () => {
    const chrome: Chrome = { title: 'Title' };
    const result = computeChrome(chrome, theme, 600);

    const expectedMaxWidth = 600 - theme.spacing.padding * 2 - 5;
    expect(result.title!.maxWidth).toBe(expectedMaxWidth);
  });

  it('handles full chrome with all elements', () => {
    const chrome: Chrome = {
      title: 'Title',
      subtitle: 'Subtitle',
      source: 'Source',
      byline: 'By Author',
      footer: 'Footer note',
    };
    const result = computeChrome(chrome, theme, 600);

    expect(result.title).toBeDefined();
    expect(result.subtitle).toBeDefined();
    expect(result.source).toBeDefined();
    expect(result.byline).toBeDefined();
    expect(result.footer).toBeDefined();
    expect(result.topHeight).toBeGreaterThan(0);
    expect(result.bottomHeight).toBeGreaterThan(0);
  });

  it('reserves extra height when title wraps to multiple lines at narrow widths', () => {
    const longTitle =
      'Global Economic Recovery Trends Show Surprising Resilience Across Major Markets';
    const chrome: Chrome = { title: longTitle, subtitle: 'Subtitle text' };

    // At wide width, title fits on one line
    const wide = computeChrome(chrome, theme, 800);
    // At narrow width, title wraps to multiple lines
    const narrow = computeChrome(chrome, theme, 300);

    // Narrow should reserve more top height due to title wrapping
    expect(narrow.topHeight).toBeGreaterThan(wide.topHeight);

    // Subtitle should be pushed further down to avoid collision
    expect(narrow.subtitle!.y).toBeGreaterThan(wide.subtitle!.y);
  });

  it('caps reserved height when title has a maxLines bound', () => {
    const longTitle =
      'Global Economic Recovery Trends Show Surprising Resilience Across Major Markets';

    // Unbounded: at narrow width the title wraps to many lines.
    const unbounded = computeChrome({ title: longTitle }, theme, 300);
    // Bounded to 2 lines.
    const bounded = computeChrome(
      { title: { text: longTitle, style: { maxLines: 2 } } },
      theme,
      300,
    );

    // The 2-line cap must reserve strictly less top height than the unbounded
    // (many-line) title at the same width.
    expect(bounded.topHeight).toBeLessThan(unbounded.topHeight);

    // And it should match the height reserved for a naturally-2-line title.
    const twoLineRef = computeChrome({ title: 'Line one\nLine two' }, theme, 300);
    expect(bounded.topHeight).toBeCloseTo(twoLineRef.topHeight, 5);
  });

  it('does not truncate when maxLines exceeds the natural line count', () => {
    const longTitle =
      'Global Economic Recovery Trends Show Surprising Resilience Across Major Markets';

    const unbounded = computeChrome({ title: longTitle }, theme, 300);
    const generous = computeChrome(
      { title: { text: longTitle, style: { maxLines: 20 } } },
      theme,
      300,
    );

    // maxLines larger than the natural wrap count leaves the height unchanged.
    expect(generous.topHeight).toBe(unbounded.topHeight);
  });

  it('reserves extra height when subtitle contains newline characters', () => {
    const chrome: Chrome = { title: 'Title', subtitle: 'Line one\nLine two' };
    const withNewline = computeChrome(chrome, theme, 600);

    const chromeNoNewline: Chrome = { title: 'Title', subtitle: 'Line one Line two' };
    const withoutNewline = computeChrome(chromeNoNewline, theme, 600);

    // The newline version should reserve more top height since it forces two lines
    expect(withNewline.topHeight).toBeGreaterThan(withoutNewline.topHeight);
  });

  it('handles consecutive newlines in chrome text', () => {
    const chrome: Chrome = { title: 'Title', subtitle: 'Above\n\nBelow' };
    const result = computeChrome(chrome, theme, 600);

    // Three segments: "Above", "", "Below" -> 3 lines total
    // This should be taller than a simple two-line subtitle
    const twoLine: Chrome = { title: 'Title', subtitle: 'Above\nBelow' };
    const twoLineResult = computeChrome(twoLine, theme, 600);

    expect(result.topHeight).toBeGreaterThan(twoLineResult.topHeight);
  });

  it('handles newlines combined with long text that also word-wraps', () => {
    const longSegment = 'This is a very long segment that should wrap at narrow widths on its own';
    const chrome: Chrome = { title: 'Title', subtitle: `${longSegment}\nShort` };
    const result = computeChrome(chrome, theme, 300);

    // At narrow width, the long segment wraps AND the \n adds another line
    const noNewline: Chrome = { title: 'Title', subtitle: longSegment };
    const noNewlineResult = computeChrome(noNewline, theme, 300);

    expect(result.topHeight).toBeGreaterThan(noNewlineResult.topHeight);
  });

  it('uses measureText function when provided', () => {
    const measureText = (text: string, fontSize: number) => ({
      width: text.length * fontSize * 0.6,
      height: fontSize * 1.2,
    });

    const chrome: Chrome = { title: 'Title' };
    const result = computeChrome(chrome, theme, 600, measureText);
    expect(result.title).toBeDefined();
    // Just verify it runs without error; exact values depend on measure fn
  });

  it('returns zero bottom height when watermark is false and no bottom chrome', () => {
    const chrome: Chrome = { title: 'Title' };
    const result = computeChrome(chrome, theme, 600, undefined, 'full', undefined, false);
    expect(result.bottomHeight).toBe(0);
  });

  it('does not reserve brand width for bottom text when watermark is false', () => {
    const chrome: Chrome = { source: 'Source: World Bank' };
    const withWatermark = computeChrome(chrome, theme, 600, undefined, 'full', undefined, true);
    const withoutWatermark = computeChrome(chrome, theme, 600, undefined, 'full', undefined, false);

    // Without watermark, source text gets full width (not reduced by BRAND_RESERVE_WIDTH)
    expect(withoutWatermark.source!.maxWidth).toBeGreaterThan(withWatermark.source!.maxWidth);
  });
});
