export { PlaybackDataError, type PlaybackDataErrorCode } from './errors';
export { interpolatePlaybackLogValue, interpolatePlaybackValue } from './interpolate';
export {
  buildPlaybackMatrix,
  type PlaybackChannel,
  type PlaybackGaps,
  type PlaybackMatrix,
  type PlaybackMatrixOptions,
} from './matrix';
export { type ResolvedPlayback, resolvePlayback } from './options';
export { formatPeriodLabels } from './period-labels';
export {
  orderPeriods,
  type PlaybackPeriod,
  type PlaybackTimeEncoding,
  type PlaybackTimeType,
  readPeriod,
} from './periods';
