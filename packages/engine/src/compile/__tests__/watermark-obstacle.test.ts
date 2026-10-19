import type { ResolvedChrome } from '@opendata-ai/openchart-core';
import { computeChrome, resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { LayoutDimensions } from '../../layout/dimensions';
import { computeWatermarkObstacle } from '../watermark-obstacle';

const theme = resolveTheme();
const measure = (text: string, fontSize: number) => ({
  width: (text.length * fontSize) / 2,
  height: fontSize,
});
const dims = (chrome: ResolvedChrome, noteBand = 0) =>
  ({
    total: { x: 0, y: 0, width: 800, height: 500 },
    chartArea: { x: 60, y: 80, width: 700, height: 360 },
    chrome,
    noteBand,
    theme,
  }) as LayoutDimensions;
describe('measured attribution obstacle', () => {
  it('uses the resolved default mark bounds and the actual axis/footer anchor', () => {
    const chrome = computeChrome({ source: 'Source' }, theme, 800, measure);
    chrome.bottomAnchorY = 457;
    const mark = chrome.watermark!;
    expect(computeWatermarkObstacle(dims(chrome, 34), true, {}, theme, measure)).toEqual({
      x: mark.x - mark.maxWidth,
      y: 457 + 34 + mark.y,
      width: mark.maxWidth,
      height: mark.style.fontSize * mark.style.lineHeight!,
    });
  });
  it('reserves custom brand text even with default watermark disabled, including wrapped lines and explicit note height', () => {
    const chrome = computeChrome(
      {
        brand: {
          text: 'Custom brand\nSecond line',
          offset: { dx: -10, dy: 6 },
          style: { fontSize: 20 },
        },
      },
      theme,
      800,
      measure,
      'full',
      undefined,
      false,
    );
    chrome.bottomAnchorY = 450;
    chrome.noteBandHeight = 48;
    const mark = chrome.brand!;
    expect(computeWatermarkObstacle(dims(chrome, 20), false, {}, theme, measure)).toEqual({
      x: mark.x - mark.maxWidth,
      y: 450 + 48 + mark.y,
      width: mark.maxWidth,
      height: 2 * mark.style.fontSize * mark.style.lineHeight!,
    });
  });
  it('returns no obstacle without a resolved mark, and ignores guessed axis extents', () => {
    expect(
      computeWatermarkObstacle(dims({ topHeight: 0, bottomHeight: 0 }), true, {}, theme, measure),
    ).toBeNull();
  });
});
