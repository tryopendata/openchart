import type { ChartSpec, GeoMapSpec, LayerSpec } from '@opendata-ai/openchart-core';
/** Private instance bridge. No global selection state or DOM interception. */
export type ReaderHostEvent = {
  kind: 'layout' | 'editing' | 'gesture-start' | 'gesture-end' | 'camera' | 'destroy';
};
export interface ReaderInteractionHost {
  suspendNavigation(): () => void;
  isEditing(): boolean;
  getSpec?(): ChartSpec | LayerSpec | GeoMapSpec;
  subscribe(listener: (event: ReaderHostEvent) => void): () => void;
}
interface Registration {
  host: ReaderInteractionHost;
  owner?: object;
  restore?: () => void;
  dead: boolean;
}
const hosts = new WeakMap<object, Registration>();
export function registerReaderHost(instance: object, host: ReaderInteractionHost): () => void {
  const registration: Registration = { host, dead: false };
  hosts.set(instance, registration);
  return () => {
    if (registration.dead) return;
    registration.dead = true;
    registration.restore?.();
    registration.restore = undefined;
    if (hosts.get(instance) === registration) hosts.delete(instance);
  };
}
export function acquireReaderHost(instance: object, owner: object) {
  const registration = hosts.get(instance);
  if (!registration || registration.dead || registration.owner) return null;
  registration.owner = owner;
  if (!registration.host.isEditing()) registration.restore = registration.host.suspendNavigation();
  let released = false;
  return {
    get active() {
      return !released && !registration.dead && !registration.host.isEditing();
    },
    getSpec: () => registration.host.getSpec?.(),
    subscribe: registration.host.subscribe,
    release() {
      if (released) return;
      released = true;
      if (registration.owner === owner) {
        registration.owner = undefined;
        registration.restore?.();
        registration.restore = undefined;
      }
    },
  };
}
export const READER_CONTROLS =
  'a,button,input,textarea,select,summary,[contenteditable],[role=button],.oc-annotations,.oc-selection-overlay,.oc-anchor-handle,.oc-connector-handle';
export function readerEventExcluded(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(READER_CONTROLS);
}
