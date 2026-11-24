import {
  type CompileOptions,
  type CompileWarning,
  type DarkMode,
  DEFAULT_THEME,
  type RaceFrame,
  type RaceGeometry,
  type RaceLayout,
  type RaceMarkType,
  type RaceSpec,
  type ThemeConfig,
} from '@opendata-ai/openchart-core';
import {
  layoutRace,
  prepareRace,
  type RaceModel,
  raceFrameAt,
  raceGeometryAt,
} from '@opendata-ai/openchart-engine';
import type { GIFExportOptions } from './export-gif';
import { createMeasureText } from './measure-text';
import { prefersReducedMotion } from './motion/tween';
import { createRaceClock, type RaceClockState } from './race/clock';
import { createRaceControls, type RaceControls } from './race/controls';
import { RACE_RENDERERS } from './race/renderers';
import { createRaceShell, type RaceMarkHost } from './race/shell';
import { resolveDarkMode } from './resolve-dark-mode';
import { pageIdScope } from './svg-ids';
import { whenSeen } from './visibility';

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

const CONTROLS_HEIGHT = 44;

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

function rendererFor<Mark extends RaceMarkType>(mark: Mark): RendererFor<Mark> {
  const factory = renderers[mark];
  if (!factory) throw new Error(`Race mark "${mark}" has no renderer. Use a supported race mark.`);
  return factory;
}

function isGeometryForMark<Mark extends RaceMarkType>(
  geometry: RaceGeometry,
  mark: Mark,
): geometry is RaceGeometries[Mark] {
  return geometry.mark === mark;
}

export function createRace(
  container: HTMLElement,
  spec: RaceSpec,
  options?: RaceMountOptions,
): RaceInstance {
  const onWarn = options?.onWarn;
  const warn = onWarn && ((warning: CompileWarning) => onWarn(warning.message));
  let model = prepareRace(spec, { onWarn: warn });
  const idScope = pageIdScope.next('race');
  let destroyed = false;
  let cancelVisibility: (() => void) | undefined;
  let resizeFrame: number | undefined;
  let view: ReturnType<typeof mountView> | undefined;
  let fontsReady: FontFaceSet['ready'] | undefined;
  let fontFamily = resolveFont(model);
  let measureText = createMeasureText(fontFamily);
  let clock = makeClock(model);
  let replayOnPlay = false;

  function resolveFont(candidate: RaceModel): string {
    return (
      options?.theme?.fonts?.family ??
      candidate.spec.theme.fonts?.family ??
      DEFAULT_THEME.fonts.family
    );
  }

  function dimensions(candidate: RaceModel) {
    const rect = container.getBoundingClientRect();
    let measuredHeight = rect.height;
    if (candidate.spec.height === undefined && view) {
      // Measure the host without counting the race itself in its intrinsic height.
      const { style } = view.root;
      const position = style.position;
      style.position = 'absolute';
      try {
        measuredHeight = container.getBoundingClientRect().height;
      } finally {
        style.position = position;
      }
    }
    const width = candidate.spec.width ?? (rect.width || 640);
    const height = candidate.spec.height ?? (measuredHeight > 0 ? measuredHeight : 520);
    return {
      width,
      height: Math.max(0, height - (candidate.playback.controls ? CONTROLS_HEIGHT : 0)),
    };
  }

  function compileLayout(candidate: RaceModel, size = dimensions(candidate)) {
    const family = resolveFont(candidate);
    const measure = family === fontFamily ? measureText : createMeasureText(family);
    const darkMode = resolveDarkMode(options?.darkMode);
    const layout = layoutRace(candidate, {
      ...size,
      theme: options?.theme,
      watermark: options?.watermark,
      darkMode,
      measureText: measure,
    });
    rendererFor(layout.mark);
    return { layout, darkMode, family, measure };
  }

  function mountView<Mark extends RaceMarkType>(
    layout: LayoutFor<Mark> & RaceLayout,
    darkMode: boolean,
  ) {
    const factory = rendererFor<Mark>(layout.mark);
    const shell = createRaceShell(container, layout, idScope);
    shell.root.classList.toggle('oc-dark', darkMode);
    if (model.spec.width !== undefined) shell.root.style.width = `${layout.width}px`;
    const renderer = factory(shell.markHost, layout.static, idScope);
    let controls: RaceControls | undefined;
    if (layout.playback.controls) {
      controls = createRaceControls({
        periodLabels: layout.periods,
        onToggle: () => {
          if (replayOnPlay) play();
          else {
            cancelAutoplay();
            clock.toggle();
          }
        },
        onSeek: seek,
        onStep: (delta) => {
          cancelAutoplay();
          replayOnPlay = false;
          clock.stepPeriod(delta);
        },
      });
      shell.controlsSlot.style.height = `${CONTROLS_HEIGHT}px`;
      shell.controlsSlot.append(controls.element);
    }
    return {
      root: shell.root,
      layout,
      controls,
      draw(t: number) {
        const geometry = raceGeometryAt(model, layout, t);
        if (isGeometryForMark(geometry, layout.mark)) renderer.draw(geometry);
      },
      destroy() {
        controls?.destroy();
        renderer.destroy();
        shell.destroy();
      },
    };
  }

  function makeClock(candidate: RaceModel) {
    const { durationMs, holdEndMs, loop } = candidate.playback;
    return createRaceClock({
      periodCount: candidate.timeline.periodCount,
      durationMs,
      holdEndMs,
      loop,
      onTick: (t) => view?.draw(t),
      onStateChange: (state) => view?.controls?.update(state),
    });
  }

  function focusedControl() {
    const active = container.ownerDocument.activeElement;
    if (view?.controls?.element.contains(active)) {
      return active?.localName === 'button' ? 'button' : 'input';
    }
    return undefined;
  }

  function render(
    { layout, darkMode, family, measure }: ReturnType<typeof compileLayout>,
    focus = focusedControl(),
  ) {
    fontFamily = family;
    measureText = measure;
    view?.destroy();
    view = mountView(layout, darkMode);
    const state = clock.getState();
    view.draw(state.t);
    view.controls?.update(state);
    if (focus)
      view.controls?.element.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
    watchFonts();
  }

  function resize() {
    if (!destroyed) render(compileLayout(model));
  }

  function watchFonts() {
    const ready = container.ownerDocument.fonts?.ready;
    if (!ready || ready === fontsReady) return;
    fontsReady = ready;
    ready.then(() => {
      if (fontsReady === ready) resize();
    });
  }

  function cancelAutoplay() {
    cancelVisibility?.();
    cancelVisibility = undefined;
  }

  function play() {
    cancelAutoplay();
    if (replayOnPlay) seek(0);
    clock.play();
  }

  function pause() {
    cancelAutoplay();
    clock.pause();
  }

  function seek(t: number) {
    clock.seek(t);
    if (!destroyed) replayOnPlay = false;
  }

  function update(nextSpec: RaceSpec) {
    if (destroyed) return;
    const next = prepareRace(nextSpec, { onWarn: warn });
    if (destroyed) return;
    const nextLayout = compileLayout(next);
    const { t, speed, playing, ended } = clock.getState();
    const timingChanged =
      next.timeline.periodCount !== model.timeline.periodCount ||
      next.playback.durationMs !== model.playback.durationMs ||
      next.playback.holdEndMs !== model.playback.holdEndMs ||
      next.playback.loop !== model.playback.loop;

    const focus = focusedControl();
    model = next;
    if (model.playback.autoplay !== 'visible') cancelAutoplay();
    if (timingChanged) {
      replayOnPlay = (ended || replayOnPlay) && t >= model.timeline.periodCount - 1;
      view?.destroy();
      view = undefined;
      clock.destroy();
      clock = makeClock(model);
      clock.setSpeed(speed);
      clock.seek(t);
      if (playing) clock.play();
    }
    render(nextLayout, focus);
  }

  const staticStart = spec.animation === false || prefersReducedMotion();
  if (staticStart) clock.seek(model.timeline.periodCount - 1);
  render(compileLayout(model));
  if (!staticStart) {
    if (model.playback.autoplay === 'visible') {
      cancelVisibility = whenSeen(container, play);
    } else if (model.playback.autoplay) {
      clock.play();
    }
  }

  let observer: ResizeObserver | undefined;
  if (options?.autoResize !== false && typeof ResizeObserver === 'function') {
    observer = new ResizeObserver(() => {
      if (destroyed || resizeFrame !== undefined) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = undefined;
        if (destroyed) return;
        const size = dimensions(model);
        if (view?.layout.width !== size.width || view.layout.height !== size.height) {
          render(compileLayout(model, size));
        }
      });
    });
    observer.observe(container);
  }

  return {
    play,
    pause,
    seek,
    setSpeed: (speed) => clock.setSpeed(speed),
    update,
    resize,
    async export() {
      throw new Error('GIF export arrives in a later release');
    },
    getState() {
      const { t, playing, speed } = clock.getState();
      return { t, playing, speed, period: raceFrameAt(model, t).period };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      fontsReady = undefined;
      cancelAutoplay();
      observer?.disconnect();
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
      clock.destroy();
      view?.destroy();
      view = undefined;
    },
  };
}
