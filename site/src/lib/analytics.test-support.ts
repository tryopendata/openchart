/**
 * A stand-in for posthog-js's client, shared by tests that need the real analytics
 * module to talk to an SDK they control (`analytics.test.ts` for late or failing loads).
 */

import type { PostHog } from "posthog-js";
import { vi } from "vitest";

/**
 * An SDK that records `capture` calls and loads on cue: `load` resolves at once, but
 * the SDK's `loaded` callback (which flushes the queue) runs only when the test calls
 * `fireLoaded()`.
 */
export function fakeSdk() {
  const calls: unknown[][] = [];
  let loaded: (() => void) | undefined;
  const instance = {
    capture: (...args: unknown[]) => calls.push(["capture", ...args]),
  } as unknown as PostHog;
  const init = (_key: string, config: { loaded: (p: PostHog) => void }) => {
    loaded = () => config.loaded(instance);
    return instance;
  };
  const load = vi.fn(async () => ({ default: { init } as unknown as PostHog }));
  return { calls, load, fireLoaded: () => loaded?.() };
}
