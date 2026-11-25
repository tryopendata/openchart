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
import type { PlaybackClockState } from './playback/clock';
import { createPlaybackSession, type PlaybackSessionTiming } from './playback/session';
import { createRaceA11y } from './race/a11y-dom';
import { RACE_CLASS_PREFIX } from './race/controls';
import { exportRaceGIF } from './race/export';
import { RACE_RENDERERS } from './race/renderers';
import { createRaceShell, type RaceMarkHost } from './race/shell';
import { measureRaceSize, RACE_CONTROLS_HEIGHT } from './race/size';
import { resolveDarkMode } from './resolve-dark-mode';
import { pageIdScope } from './svg-ids';

export interface RaceMountOptions {
  /** Mount-level theme overrides. */
  theme?: ThemeConfig;
  /** Color scheme preference. Defaults to light. */
  darkMode?: DarkMode;
  /** Observe container resizing. Defaults to true. */
  autoResize?: boolean;
  /** Show the watermark unless the spec sets its own watermark preference. */
  watermark?: boolean;
  /**
   * Restore playback from getState(). A paused first frame still starts when visible
   * if the spec uses visibility autoplay.
   */
  initialState?: PlaybackClockState;
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
  /** Replace mount-level theme overrides and redraw without interrupting playback. */
  setTheme(options: Pick<RaceMountOptions, 'theme' | 'darkMode'>): void;
  /** Measure and redraw the race at the current playhead. */
  resize(): void;
  /** Export the full bar or line race as a GIF. Rejects for table marks and on destruction. */
  export(format: 'gif', options?: Pick<GIFExportOptions, 'fps'>): Promise<Blob>;
  /** Read the playhead, speed, playback and completion status, and period, including after destroy(). */
  getState(): Pick<PlaybackClockState, 't' | 'playing' | 'speed' | 'ended'> & {
    period: RaceFrame['period'];
  };
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
  container: DocumentFragment,
  model: RaceModel,
  layout: LayoutFor<Mark> & RaceLayout,
  darkMode: boolean,
  idScope: string,
) {
  const factory = rendererFor<Mark>(layout.mark);
  const shell = createRaceShell(container, layout, idScope);
  shell.root.classList.toggle('oc-dark', darkMode);
  if (layout.mark === 'table') shell.markHost.setAttribute('aria-hidden', 'true');
  if (model.spec.width !== undefined) shell.root.style.width = `${layout.width}px`;
  function bindRenderer(host: RaceMarkHost<Mark>) {
    const renderer = factory(host, layout.static, idScope);
    return {
      draw(t: number) {
        const geometry = raceGeometryAt(model, layout, t);
        if (isGeometryForMark(geometry, layout.mark)) renderer.draw(geometry);
      },
      destroy() {
        renderer.destroy();
      },
    };
  }
  const renderer = bindRenderer(shell.markHost);
  if (layout.playback.controls) shell.controlsSlot.style.height = `${RACE_CONTROLS_HEIGHT}px`;
  return {
    shell,
    layout,
    controlsSlot: layout.playback.controls ? shell.controlsSlot : null,
    draw: renderer.draw,
    mountExportRenderer(svg: SVGSVGElement) {
      const host = svg.querySelector<RaceMarkHost<Mark>>('g.oc-race-mark');
      if (!host) throw new Error('The race SVG has no mark host');
      host.replaceChildren();
      return bindRenderer(host);
    },
    destroy() {
      renderer.destroy();
      shell.destroy();
    },
  };
}

function sessionTiming(model: RaceModel): PlaybackSessionTiming {
  return { periodCount: model.timeline.periodCount, ...model.playback };
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
 * Mount a race in a host element. Use setTheme() to replace the mount-level theme or color scheme.
 * After destruction, valid playback calls, update(), setTheme(), and resize() have no effect.
 * @throws If the spec is invalid or the selected mark is unavailable.
 */
export function createRace(
  container: HTMLElement,
  spec: RaceSpec,
  { theme, darkMode, autoResize = true, watermark, onWarn, initialState }: RaceMountOptions = {},
): RaceInstance {
  const warn = onWarn && ((warning: CompileWarning) => onWarn(warning.message));
  let model = prepareRace(spec, { onWarn: warn });
  const idScope = pageIdScope.next('race');
  const exportLifetime = new AbortController();
  let destroyed = false;
  let resizeFrame: number | undefined;
  let view: ReturnType<typeof mountView> | undefined;
  let a11y: ReturnType<typeof createRaceA11y> | undefined;
  let appearance = { theme, darkMode };
  let font = resolveFont(model);

  function resolveFont(
    candidate: RaceModel,
    previous?: { family: string; measureText: MeasureTextFn },
    { theme } = appearance,
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

  function compileLayout(
    candidate: RaceModel,
    text = font,
    size = dimensions(candidate),
    { theme, darkMode: colorScheme } = appearance,
  ) {
    const darkMode = resolveDarkMode(colorScheme);
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

  function periodAt(index: number): RaceFrame['period'] {
    return { index, value: model.matrix.periods[index].value, label: model.periodLabels[index] };
  }

  function announce(t: number) {
    if (!model.spec.a11y?.hidden) a11y?.announce(raceFrameAt(model, t));
  }

  // Compile before starting playback so an unusable layout throws before any frame is requested.
  const initialLayout = compileLayout(model);
  const session = createPlaybackSession({
    container,
    timing: sessionTiming(model),
    periodLabels: model.periodLabels,
    periodAt,
    draw: (t) => view?.draw(t),
    onAnnounce: announce,
    classPrefix: RACE_CLASS_PREFIX,
    animate: spec.animation !== false,
    initialState,
  });

  function focusedControl() {
    const active = container.ownerDocument.activeElement;
    if (session.controlsElement?.contains(active)) {
      return active?.localName === 'button' ? 'button' : 'input';
    }
    return undefined;
  }

  function render(
    { layout, darkMode }: ReturnType<typeof compileLayout>,
    focus = focusedControl(),
    anchor?: ChildNode | null,
  ) {
    const previousView = view;
    const fragment = container.ownerDocument.createDocumentFragment();
    view = mountView(fragment, model, layout, darkMode, idScope);
    if (!a11y?.attach(view.shell, model)) {
      a11y?.destroy();
      a11y = createRaceA11y(view.shell, model);
    }
    session.attach({ controls: view.controlsSlot });
    view.draw(session.getClockState().t);
    const oldRoot = previousView?.shell.root;
    const nextSibling = anchor ?? (oldRoot?.parentNode === container ? oldRoot.nextSibling : null);
    previousView?.destroy();
    container.insertBefore(fragment, nextSibling);
    if (focus) {
      session.controlsElement?.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
    }
  }

  function resize() {
    if (!destroyed) render(compileLayout(model));
  }

  function scheduleFontResize(text: typeof font) {
    scheduleFontReload(text.family, () => !destroyed && font === text, resize);
  }

  function setTheme({ theme, darkMode }: Pick<RaceMountOptions, 'theme' | 'darkMode'>) {
    if (destroyed) return;
    const nextAppearance = { theme, darkMode };
    const nextFont = resolveFont(model, font, nextAppearance);
    const nextLayout = compileLayout(model, nextFont, dimensions(model), nextAppearance);
    const fontChanged = nextFont !== font;
    appearance = nextAppearance;
    font = nextFont;
    render(nextLayout);
    if (fontChanged) scheduleFontResize(font);
  }

  /** Remove the view before new timing rebuilds the clock, and return where it stood. */
  function detachViewForRetime(): ChildNode | null | undefined {
    const root = view?.shell.root;
    const anchor = root?.parentNode === container ? root.nextSibling : undefined;
    view?.destroy();
    view = undefined;
    return anchor;
  }

  function update(nextSpec: RaceSpec) {
    if (destroyed) return;
    const next = prepareRace(nextSpec, { onWarn: warn, previousModel: model });
    if (destroyed) return;
    const nextFont = resolveFont(next, font);
    const nextLayout = compileLayout(next, nextFont);
    const fontChanged = nextFont !== font;
    const focus = focusedControl();
    const anchor = playbackTimingChanged(model, next) ? detachViewForRetime() : undefined;
    model = next;
    font = nextFont;
    session.retime(sessionTiming(model), model.periodLabels);
    render(nextLayout, focus, anchor);
    if (fontChanged) scheduleFontResize(font);
  }

  render(initialLayout);
  scheduleFontResize(font);

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
    play: session.play,
    pause: session.pause,
    seek: session.seek,
    setSpeed: session.setSpeed,
    update,
    setTheme,
    resize,
    async export(format, options) {
      if (destroyed) throw new Error('This race was destroyed. Create a new race to export.');
      if (format !== 'gif')
        throw new Error(`Race export supports "gif" only, received "${format}".`);
      if (!view) throw new Error('Race is not rendered');
      const { layout, shell, mountExportRenderer } = view;
      return exportRaceGIF(
        { layout, shell, mountExportRenderer, signal: exportLifetime.signal },
        options,
      );
    },
    getState: session.getState,
    on(event, cb) {
      if (event !== 'period')
        throw new TypeError(`Unknown race event "${event}". Supported: "period".`);
      return session.on(event, cb);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      exportLifetime.abort(new Error('Race was destroyed during GIF export'));
      observer?.disconnect();
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
      session.destroy();
      a11y?.destroy();
      a11y = undefined;
      view?.destroy();
      view = undefined;
    },
  };
}
