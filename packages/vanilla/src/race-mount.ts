import type {
  CompileOptions,
  DarkMode,
  RaceFrame,
  RaceSpec,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import type { GIFExportOptions } from './export-gif';
import type { RaceClockState } from './race/clock';

export interface RaceMountOptions {
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  /** Observe container resizing. Defaults to true. */
  autoResize?: boolean;
  watermark?: boolean;
  onWarn?: CompileOptions['onWarn'];
}

export interface RaceInstance {
  play(): void;
  pause(): void;
  /** Seek by continuous period index. */
  seek(t: number): void;
  setSpeed(speed: number): void;
  update(spec: RaceSpec): void;
  resize(): void;
  export(format: 'gif', options?: Pick<GIFExportOptions, 'fps'>): Promise<Blob>;
  getState(): Pick<RaceClockState, 't' | 'playing' | 'speed'> & { period: RaceFrame['period'] };
  destroy(): void;
}

export function createRace(
  _container: HTMLElement,
  _spec: RaceSpec,
  _options?: RaceMountOptions,
): RaceInstance {
  throw new Error('not implemented');
}
