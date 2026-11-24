import type {
  CompileOptions,
  CompileWarning,
  DarkMode,
  MeasureTextFn,
  RaceFrame,
  RaceGeometry,
  RaceLayout,
  RaceMarkType,
  RaceSpec,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import {
  layoutRace,
  prepareRace,
  type RaceModel,
  raceFrameAt,
  raceGeometryAt,
} from '@opendata-ai/openchart-engine';
import type { GIFExportOptions } from './export-gif';
import { createMeasureText, resolveFontFamily, scheduleFontReload } from './measure-text';
import { prefersReducedMotion } from './motion/tween';
import { createRaceA11y } from './race/a11y-dom';
import { createRaceClock, type RaceClock, type RaceClockState } from './race/clock';
import { createRaceControls, type RaceControlsOptions } from './race/controls';
import { exportRaceGIF } from './race/export';
import { RACE_RENDERERS } from './race/renderers';
import { createRaceShell, type RaceMarkHost } from './race/shell';
import { measureRaceSize, RACE_CONTROLS_HEIGHT } from './race/size';
import { resolveDarkMode } from './resolve-dark-mode';
import { pageIdScope } from './svg-ids';
import { whenSeen } from './visibility';

export interface RaceMountOptions {
  /** Mount-level theme overrides. Remount to supply a different override. */
  theme?: ThemeConfig;
  /** Color scheme preference. Defaults to light. Remount to change this option. */
  darkMode?: DarkMode;
  /** Observe container resizing. Defaults to true. */
  autoResize?: boolean;
  /** Show the watermark unless the spec sets its own watermark preference. */
  watermark?: boolean;
  /** Receives warnings from preparing the initial or updated spec. */
  onWarn?: CompileOptions['onWarn'];
}

export interface RaceInstance {
  /** Start or resume playback. Replay from the start after natural completion. */
  play(): void;
  /** Pause playback and cancel any pending visibility-triggered start. */
  pause(): void;
  /**
   * Seek by continuous period index, clamped to the available periods.
   * @throws {RangeError} If t is not finite, including after destroy().
   */
  seek(t: number): void;
  /**
   * Set the playback speed as a multiplier of the authored duration.
   * @throws {RangeError} If speed is not finite and positive, including after destroy().
   */
  setSpeed(speed: number): void;
  /**
   * Apply a spec change, including its theme, and retain playback at the clamped playhead.
   * @throws If the spec is invalid. The mounted race and its playback state stay intact.
   */
  update(spec: RaceSpec): void;
  /** Measure and redraw the race at the current playhead. */
  resize(): void;
  /** Export the full bar or line race as a GIF. Rejects for table marks and on destruction. */
  export(format: 'gif', options?: Pick<GIFExportOptions, 'fps'>): Promise<Blob>;
  /** Read the playhead, speed, playback status, and displayed period, including after destroy(). */
  getState(): Pick<RaceClockState, 't' | 'playing' | 'speed'> & { period: RaceFrame['period'] };
  /** Listen for period crossings and seek destinations. Returns an unsubscribe function. */
  on(event: 'period', cb: (period: RaceFrame['period']) => void): () => void;
  /** Stop playback and remove the mounted race. Safe to call repeatedly. */
  destroy(): void;
}

type RaceStatics = { [Layout in RaceLayout as Layout['mark']]: Layout['static'] };
type RaceGeometries = { [Geometry in RaceGeometry as Geometry['mark']]: Geometry };
type LayoutFor<Mark extends RaceMarkType> = {
  [Kind in Mark]: Omit<RaceLayout, 'mark' | 'static'> & { mark: Kind; static: RaceStatics[Kind] };
}[Mark];
type RendererFor<Mark extends RaceMarkType> = (
  host: RaceMarkHost<Mark>,
  stat: RaceStatics[Mark],
  idScope: string,
) => { draw(geometry: RaceGeometries[Mark]): void; destroy(): void };

const renderers: { [Mark in RaceMarkType]?: RendererFor<Mark> } = RACE_RENDERERS;
type ControlHandlers = Omit<RaceControlsOptions, 'periodLabels'> & { onSeekCommit(): void };

function rendererFor<Mark extends RaceMarkType>(mark: Mark): RendererFor<Mark> {
  const factory = renderers[mark];
  if (!factory) {
    throw new Error(
      `Race mark "${mark}" is not registered. Registered: ${Object.keys(renderers).join(', ')}`,
    );
  }
  return factory;
}

function isGeometryForMark<Mark extends RaceMarkType>(
  geometry: RaceGeometry,
  mark: Mark,
): geometry is RaceGeometries[Mark] {
  return geometry.mark === mark;
}

function mountView<Mark extends RaceMarkType>(
  container: HTMLElement,
  model: RaceModel,
  layout: LayoutFor<Mark> & RaceLayout,
  darkMode: boolean,
  idScope: string,
  { onSeekCommit, ...handlers }: ControlHandlers,
) {
  const factory = rendererFor<Mark>(layout.mark);
  const shell = createRaceShell(container, layout, idScope);
  shell.root.classList.toggle('oc-dark', darkMode);
  if (layout.mark === 'table') shell.markHost.setAttribute('aria-hidden', 'true');
  if (model.spec.width !== undefined) shell.root.style.width = `${layout.width}px`;
  const renderer = factory(shell.markHost, layout.static, idScope);
  const controls = layout.playback.controls
    ? createRaceControls({ periodLabels: layout.periods, ...handlers })
    : undefined;
  if (controls) {
    controls.element.addEventListener('change', onSeekCommit);
    shell.controlsSlot.style.height = `${RACE_CONTROLS_HEIGHT}px`;
    shell.controlsSlot.append(controls.element);
  }
  return {
    shell,
    layout,
    controls,
    draw(t: number) {
      const geometry = raceGeometryAt(model, layout, t);
      if (isGeometryForMark(geometry, layout.mark)) renderer.draw(geometry);
    },
    destroy() {
      controls?.element.removeEventListener('change', onSeekCommit);
      controls?.destroy();
      renderer.destroy();
      shell.destroy();
    },
  };
}

function playbackTimingChanged(a: RaceModel, b: RaceModel): boolean {
  return (
    a.timeline.periodCount !== b.timeline.periodCount ||
    a.playback.durationMs !== b.playback.durationMs ||
    a.playback.holdEndMs !== b.playback.holdEndMs ||
    a.playback.loop !== b.playback.loop
  );
}

/**
 * Mount a race in a host element. Options are read at mount. To change the
 * mount-level theme or dark mode, destroy and remount with new options.
 * After destruction, valid playback calls, update(), and resize() have no effect.
 * @throws If the spec is invalid or the selected mark is unavailable.
 */
export function createRace(
  container: HTMLElement,
  spec: RaceSpec,
  { theme, darkMode: mountDarkMode, autoResize = true, watermark, onWarn }: RaceMountOptions = {},
): RaceInstance {
  const warn = onWarn && ((warning: CompileWarning) => onWarn(warning.message));
  let model = prepareRace(spec, { onWarn: warn });
  const idScope = pageIdScope.next('race');
  const exportLifetime = new AbortController();
  type PeriodListener = (period: RaceFrame['period']) => void;
  const periodListeners = new Set<PeriodListener>();
  const pendingPeriods: Array<{ period: RaceFrame['period']; listeners: PeriodListener[] }> = [];
  let nextPendingPeriod = 0;
  let destroyed = false;
  let cancelVisibility: (() => void) | undefined;
  let resizeFrame: number | undefined;
  let view: ReturnType<typeof mountView> | undefined;
  let a11y: ReturnType<typeof createRaceA11y> | undefined;
  let periodIndex = 0;
  let seeking = false;
  const reducedMotion = prefersReducedMotion();
  let font = resolveFont(model);
  let clock = makeClock(model);
  const controlHandlers: ControlHandlers = {
    onToggle() {
      if (clock.getState().playing) pause();
      else play();
    },
    onSeek(t) {
      seek(reducedMotion ? Math.round(t) : t, false);
    },
    onSeekCommit: announce,
    onStep(delta) {
      cancelAutoplay();
      clock.stepPeriod(delta);
      announce();
    },
  };

  function resolveFont(
    candidate: RaceModel,
    previous?: { family: string; measureText: MeasureTextFn },
  ) {
    const family =
      theme?.fonts?.family ?? candidate.spec.theme.fonts?.family ?? resolveFontFamily(container);
    return previous?.family === family
      ? previous
      : { family, measureText: createMeasureText(family) };
  }

  function dimensions(candidate: RaceModel) {
    return measureRaceSize(
      container,
      candidate.spec,
      candidate.playback.controls,
      view?.shell.root,
    );
  }

  function compileLayout(candidate: RaceModel, text = font, size = dimensions(candidate)) {
    const darkMode = resolveDarkMode(mountDarkMode);
    const layout = layoutRace(candidate, {
      ...size,
      theme: { ...theme, fonts: { ...theme?.fonts, family: text.family } },
      watermark,
      darkMode,
      measureText: text.measureText,
    });
    rendererFor(layout.mark);
    return { layout, darkMode };
  }

  function makeClock(candidate: RaceModel, previous?: RaceClockState): RaceClock {
    const { durationMs, holdEndMs, loop } = candidate.playback;
    const { periodCount } = candidate.timeline;
    let replayOnPlay = false;
    const player = createRaceClock({
      periodCount,
      durationMs,
      holdEndMs,
      loop,
      onTick(t) {
        replayOnPlay = false;
        view?.draw(t);
      },
      onStateChange(state) {
        if (!view) return;
        view.controls?.update(state);
        const previousIndex = periodIndex;
        periodIndex = Math.floor(state.t);
        if (!seeking && periodIndex !== previousIndex) {
          const first =
            state.playing && periodIndex > previousIndex ? previousIndex + 1 : periodIndex;
          emitPeriods(first, periodIndex);
        }
      },
    });
    if (!previous) return player;
    player.setSpeed(previous.speed);
    player.seek(previous.t);
    if (previous.playing) player.play();

    // A rebuilt clock seeks to the old playhead. Carry completion until playback or a new seek.
    if (!previous.ended || previous.t < periodCount - 1) return player;
    replayOnPlay = true;
    function play() {
      if (replayOnPlay) player.seek(0);
      player.play();
    }
    return {
      ...player,
      play,
      getState() {
        const state = player.getState();
        return replayOnPlay ? { ...state, ended: true } : state;
      },
    };
  }

  function focusedControl() {
    const active = container.ownerDocument.activeElement;
    if (view?.controls?.element.contains(active)) {
      return active?.localName === 'button' ? 'button' : 'input';
    }
    return undefined;
  }

  function render(
    { layout, darkMode }: ReturnType<typeof compileLayout>,
    focus = focusedControl(),
  ) {
    const previousView = view;
    view = mountView(container, model, layout, darkMode, idScope, controlHandlers);
    if (!a11y?.attach(view.shell, model)) {
      a11y?.destroy();
      a11y = createRaceA11y(view.shell, model);
    }
    previousView?.destroy();
    const state = clock.getState();
    view.draw(state.t);
    view.controls?.update(state);
    if (focus)
      view.controls?.element.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
  }

  function resize() {
    if (!destroyed) render(compileLayout(model));
  }

  function cancelAutoplay() {
    cancelVisibility?.();
    cancelVisibility = undefined;
  }

  function periodAt(index: number): RaceFrame['period'] {
    return { index, value: model.matrix.periods[index].value, label: model.periodLabels[index] };
  }

  function emitPeriods(first: number, last: number) {
    if (!periodListeners.size) return;
    const dispatching = pendingPeriods.length > 0;
    // Finish delivering the current event before replacing any undelivered crossings.
    pendingPeriods.length = nextPendingPeriod;
    const listeners = [...periodListeners];
    for (let index = first; index <= last; index++) {
      pendingPeriods.push({ period: periodAt(index), listeners });
    }
    if (dispatching) return;
    try {
      while (nextPendingPeriod < pendingPeriods.length) {
        const { period, listeners } = pendingPeriods[nextPendingPeriod++];
        for (const listener of listeners) {
          if (!periodListeners.has(listener)) continue;
          try {
            listener({ ...period });
          } catch (error) {
            if (typeof reportError === 'function') reportError(error);
            else
              queueMicrotask(() => {
                throw error;
              });
          }
        }
      }
    } finally {
      pendingPeriods.length = 0;
      nextPendingPeriod = 0;
    }
  }

  function announce() {
    if (destroyed || model.spec.a11y?.hidden) return;
    const { t, playing } = clock.getState();
    if (!playing) a11y?.announce(raceFrameAt(model, t));
  }

  function play() {
    cancelAutoplay();
    clock.play();
  }

  function pause() {
    cancelAutoplay();
    clock.pause();
    announce();
  }

  function seek(t: number, announceOnSeek = true) {
    seeking = true;
    try {
      clock.seek(t);
    } finally {
      seeking = false;
    }
    cancelAutoplay();
    if (destroyed) return;
    if (announceOnSeek) announce();
    emitPeriods(periodIndex, periodIndex);
  }

  function setSpeed(speed: number) {
    if (destroyed && (!Number.isFinite(speed) || speed <= 0)) {
      throw new RangeError('Race playback speed must be finite and greater than zero');
    }
    clock.setSpeed(speed);
  }

  function update(nextSpec: RaceSpec) {
    if (destroyed) return;
    const next = prepareRace(nextSpec, { onWarn: warn });
    if (destroyed) return;
    const nextFont = resolveFont(next, font);
    const nextLayout = compileLayout(next, nextFont);
    const timingChanged = playbackTimingChanged(model, next);
    const focus = focusedControl();
    model = next;
    font = nextFont;
    if (model.playback.autoplay !== 'visible') cancelAutoplay();
    if (timingChanged) {
      view?.destroy();
      view = undefined;
      const previous = clock.getState();
      clock.destroy();
      clock = makeClock(model, previous);
    }
    render(nextLayout, focus);
    const nextIndex = Math.floor(clock.getState().t);
    if (periodIndex !== nextIndex) {
      periodIndex = nextIndex;
      emitPeriods(nextIndex, nextIndex);
    }
  }

  const staticStart = spec.animation === false || reducedMotion;
  if (staticStart) clock.seek(model.timeline.periodCount - 1);
  periodIndex = Math.floor(clock.getState().t);
  render(compileLayout(model));
  scheduleFontReload(font.family, () => !destroyed, resize);
  if (!staticStart) {
    if (model.playback.autoplay === 'visible') {
      cancelVisibility = whenSeen(container, play);
    } else if (model.playback.autoplay) {
      clock.play();
    }
  }

  let observer: ResizeObserver | undefined;
  if (autoResize && typeof ResizeObserver === 'function') {
    observer = new ResizeObserver(() => {
      if (destroyed || resizeFrame !== undefined) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = undefined;
        if (destroyed) return;
        const size = dimensions(model);
        if (view?.layout.width !== size.width || view.layout.height !== size.height) {
          render(compileLayout(model, font, size));
        }
      });
    });
    observer.observe(container);
  }

  return {
    play,
    pause,
    seek,
    setSpeed,
    update,
    resize,
    async export(format, options) {
      if (format !== 'gif') throw new Error(`Unsupported export format: ${format}`);
      if (!view) throw new Error('Race is not rendered');
      const { layout, shell } = view;
      return exportRaceGIF(
        { model, layout, shell, idScope, signal: exportLifetime.signal },
        options,
      );
    },
    getState() {
      const { t, playing, speed } = clock.getState();
      return { t, playing, speed, period: periodAt(Math.floor(t)) };
    },
    on(_event, cb) {
      const listener: PeriodListener = (period) => cb(period);
      if (!destroyed) periodListeners.add(listener);
      return () => {
        periodListeners.delete(listener);
      };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      exportLifetime.abort(new Error('Race was destroyed during GIF export'));
      periodListeners.clear();
      cancelAutoplay();
      observer?.disconnect();
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
      clock.destroy();
      a11y?.destroy();
      a11y = undefined;
      view?.destroy();
      view = undefined;
    },
  };
}
