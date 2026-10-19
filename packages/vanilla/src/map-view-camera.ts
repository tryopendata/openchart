import type { GeoViewLayout } from '@opendata-ai/openchart-core';
import type { Camera, CameraTarget } from './story/camera-math';
import { FULL_VIEW, fitTarget, interpolateCamera } from './story/camera-math';
import { createTween, easingFns, type Tween } from './story/tween';

interface ViewState {
  view: GeoViewLayout;
  camera: Camera;
  tween?: Tween<Camera>;
  settleFrame?: number;
}
export function cameraForGeoView(
  view: Pick<GeoViewLayout, 'mapSize' | 'focus'>,
  target?: CameraTarget | null,
): Camera {
  const camera = fitTarget(target ?? view.focus?.target ?? FULL_VIEW(view.mapSize), view.mapSize);
  return { ...camera, k: Math.max(1, Math.min(40, camera.k)) };
}
/** Inset cameras share the existing tween math; root continues through its legacy owner. */
export function createMapViewCameras(
  onFrame: (viewId: string, camera: Camera) => void,
  onSettle: (viewId: string) => void,
) {
  const states = new Map<string, ViewState>();
  let dead = false;
  const get = (id: string) => {
    const state = states.get(id);
    if (!state)
      throw new Error(
        `Unknown map view "${id}". Available views: ${[...states.keys()].join(', ') || 'root'}.`,
      );
    return state;
  };
  const cancelSettle = (state: ViewState) => {
    if (state.settleFrame !== undefined) cancelAnimationFrame(state.settleFrame);
    state.settleFrame = undefined;
  };
  const validate = (camera: Camera) => {
    if (
      !Number.isFinite(camera.cx) ||
      !Number.isFinite(camera.cy) ||
      !Number.isFinite(camera.k) ||
      camera.k <= 0
    )
      throw new Error('A map camera requires finite cx/cy and positive finite k.');
  };
  return {
    update(views: readonly GeoViewLayout[]) {
      if (dead) return;
      const ids = new Set(views.map((view) => view.viewId));
      for (const [id, state] of states)
        if (!ids.has(id)) {
          state.tween?.cancel();
          cancelSettle(state);
          states.delete(id);
        }
      for (const view of views) {
        const previous = states.get(view.viewId);
        if (previous) {
          previous.tween?.cancel();
          cancelSettle(previous);
          const oldSize = previous.view.mapSize;
          const changedFocus = JSON.stringify(previous.view.focus) !== JSON.stringify(view.focus);
          previous.camera = changedFocus
            ? cameraForGeoView(view)
            : {
                cx: previous.camera.cx * (oldSize.width ? view.mapSize.width / oldSize.width : 1),
                cy:
                  previous.camera.cy * (oldSize.height ? view.mapSize.height / oldSize.height : 1),
                k: previous.camera.k,
              };
          previous.view = view;
          previous.tween = undefined;
        } else states.set(view.viewId, { view, camera: cameraForGeoView(view) });
      }
    },
    has: (id: string) => states.has(id),
    view: (id: string) => get(id).view,
    get: (id: string) => ({ ...get(id).camera }),
    snapshots() {
      return Object.fromEntries([...states].map(([id, state]) => [id, { ...state.camera }]));
    },
    seed(id: string, camera: Camera) {
      validate(camera);
      const state = get(id);
      state.tween?.cancel();
      cancelSettle(state);
      state.tween = undefined;
      state.camera = { ...camera };
    },
    set(id: string, camera: Camera, settle = true) {
      if (dead) return;
      validate(camera);
      const state = get(id);
      state.tween?.cancel();
      cancelSettle(state);
      state.tween = undefined;
      state.camera = { ...camera };
      onFrame(id, { ...camera });
      if (settle && state.settleFrame === undefined)
        state.settleFrame = requestAnimationFrame(() => {
          state.settleFrame = undefined;
          if (!dead) onSettle(id);
        });
    },
    animate(id: string, camera: Camera, duration: number) {
      if (dead) return;
      validate(camera);
      const state = get(id);
      state.tween?.cancel();
      cancelSettle(state);
      state.tween = createTween({
        initial: state.camera,
        lerp: interpolateCamera,
        duration,
        ease: easingFns.easeInOutCubic,
        onFrame(next) {
          state.camera = next;
          onFrame(id, { ...next });
        },
        onComplete() {
          state.tween = undefined;
          onSettle(id);
        },
      });
      state.tween.to(camera);
    },
    settle(id: string) {
      const state = get(id);
      cancelSettle(state);
      if (!dead) onSettle(id);
    },
    destroy() {
      if (dead) return;
      dead = true;
      for (const state of states.values()) {
        state.tween?.cancel();
        cancelSettle(state);
      }
      states.clear();
    },
  };
}
