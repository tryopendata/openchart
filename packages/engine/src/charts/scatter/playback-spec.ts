/**
 * The render spec point playback frames draw from: the envelope's normalized spec with the
 * size domain and fill opacity frozen, so a frame's handful of rows draws like every other.
 */
import type { EncodingChannel } from '@opendata-ai/openchart-core';
import { buildSizeScale, SIZE_SCALE_DEFAULTS } from '../../compile/size-scale';
import type { NormalizedChartSpec } from '../../compiler/types';

/**
 * The render spec point frames draw from: the envelope's spec with the size domain
 * pinned to the envelope's extent (unless authored) and the fill opacity fixed, so each
 * frame's handful of rows draws against the same radii and opacity as every other frame.
 */
export function freezePointRenderSpec(
  renderSpec: NormalizedChartSpec,
  pointOpacity: number,
): NormalizedChartSpec {
  const authoredSize = renderSpec.encoding.size;
  const size =
    authoredSize && 'field' in authoredSize ? (authoredSize as EncodingChannel) : undefined;
  const sizeScale = size?.scale?.domain
    ? null
    : buildSizeScale(size, renderSpec.data, SIZE_SCALE_DEFAULTS.point);
  const encoding =
    size && sizeScale
      ? {
          ...renderSpec.encoding,
          size: { ...size, scale: { ...size.scale, domain: sizeScale.domain } },
        }
      : renderSpec.encoding;
  return {
    ...renderSpec,
    encoding,
    markDef: { ...renderSpec.markDef, opacity: pointOpacity },
  };
}
