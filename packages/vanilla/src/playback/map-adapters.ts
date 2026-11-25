/**
 * How geo maps and tile maps plug into the map playback host: which compile builds the run,
 * which spec fields an update must keep to carry the playhead, and which classes the GIF
 * clone snapshots.
 */
import type {
  GeoMapLayout,
  GeoMapSpec,
  TileMapLayout,
  TileMapSpec,
} from '@opendata-ai/openchart-core';
import { compileGeoMapPlayback, compileTileMapPlayback } from '@opendata-ai/openchart-engine';
import type { MapPlaybackAdapter } from './map-playback-host';
import { channelField, timeShape } from './update-rules';

/** Geo maps: the features' time and key, and the points layer's. */
export const geoMapPlaybackAdapter: MapPlaybackAdapter<GeoMapSpec, GeoMapLayout> = {
  compilePlayback: (spec, options) => compileGeoMapPlayback(spec, options),
  shapeOf(spec) {
    const encoding = (spec.encoding ?? {}) as Record<string, unknown>;
    const points = (spec.points ?? {}) as Record<string, unknown>;
    return [
      ...timeShape(encoding.time),
      channelField(encoding.key),
      ...timeShape(points.time),
      channelField(points.key),
    ];
  },
  styleSelectors: ['.oc-map-feature', '.oc-map-point', '.oc-playback-period'],
};

/** Tile maps: time and the state field. */
export const tileMapPlaybackAdapter: MapPlaybackAdapter<TileMapSpec, TileMapLayout> = {
  compilePlayback: (spec, options) => compileTileMapPlayback(spec, options),
  shapeOf(spec) {
    const encoding = spec.encoding as unknown as Record<string, unknown>;
    return [...timeShape(encoding.time), channelField(encoding.state)];
  },
  styleSelectors: ['.oc-tilemap-tile', '.oc-playback-period'],
};
