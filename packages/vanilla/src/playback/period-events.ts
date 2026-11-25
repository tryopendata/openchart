/**
 * Period event delivery for a playback session: listeners hear each period the playhead
 * crosses, in order, and one failing listener never stops the others.
 */
import type { PlaybackPeriod } from './types';

/** A `period` event listener. */
export type PeriodListener = (period: PlaybackPeriod) => void;

/** The listener set and the function that delivers crossings to it. */
export interface PeriodDispatcher {
  readonly listeners: Set<PeriodListener>;
  /** Deliver every period from `first` to `last` inclusive to the current listeners. */
  emit(first: number, last: number): void;
}

/** Surface a listener error to the page without interrupting delivery. */
function reportListenerError(error: unknown): void {
  if (typeof reportError === 'function') {
    reportError(error);
    return;
  }
  queueMicrotask(() => {
    throw error;
  });
}

/**
 * Create a dispatcher that delivers period events in order. Crossings emitted while a
 * listener is running replace any that are still undelivered, after the current event.
 */
export function createPeriodDispatcher(
  periodAt: (index: number) => PlaybackPeriod,
): PeriodDispatcher {
  const listeners = new Set<PeriodListener>();
  const pending: Array<{ period: PlaybackPeriod; recipients: PeriodListener[] }> = [];
  let nextPending = 0;

  function deliver() {
    try {
      while (nextPending < pending.length) {
        const { period, recipients } = pending[nextPending++];
        for (const listener of recipients) {
          if (!listeners.has(listener)) continue;
          try {
            listener({ ...period });
          } catch (error) {
            reportListenerError(error);
          }
        }
      }
    } finally {
      pending.length = 0;
      nextPending = 0;
    }
  }

  return {
    listeners,
    emit(first, last) {
      if (!listeners.size) return;
      const dispatching = pending.length > 0;
      pending.length = nextPending;
      const recipients = [...listeners];
      for (let index = first; index <= last; index++) {
        pending.push({ period: periodAt(index), recipients });
      }
      if (!dispatching) deliver();
    },
  };
}
