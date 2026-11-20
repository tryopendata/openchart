/**
 * Tests analytics against the installed posthog-js, kept offline: each case gets a
 * fresh SDK instance whose events are recorded after the module's own before_send
 * and then dropped, so nothing leaves the test. Consent comes from a store with the
 * shape @steamfield/ui/consent returns.
 * @vitest-environment happy-dom
 */

import { type CaptureResult, PostHog, type PostHogConfig } from "posthog-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Consent, ConsentStore } from "./analytics";
import * as analytics from "./analytics";
import { Events } from "./events";

// The layout's text, read through Vite; empty (and failing below) if the file is missing.
const entry = import.meta.glob<string>("../layouts/BaseLayout.astro", {
  query: "?raw",
  import: "default",
  eager: true,
});
const entrySource = Object.values(entry)[0] ?? "";

let keyCounter = 0;

/** A real SDK instance behind the module's loader, recording what it would send. */
function offlineSdk() {
  const sent: CaptureResult[] = [];
  const instance = new PostHog();
  const init = (key: string, config: Partial<PostHogConfig>) =>
    instance.init(key, {
      ...config,
      // The test DOM's user agent counts as a bot, and posthog-js drops bot events
      // before before_send; flags would make a network request.
      opt_out_useragent_filter: true,
      advanced_disable_flags: true,
      request_batching: false,
      before_send: [
        ...[config.before_send ?? []].flat(),
        (event) => {
          if (event) sent.push(event);
          return null;
        },
      ],
    });
  const load = vi.fn(async () => ({ default: { init } as unknown as PostHog }));
  const captured = (name: string) => sent.filter((event) => event.event === name);
  return { load, captured, instance };
}

/** A store with the shape createConsentStore returns, set by the test. */
function consentStore(initial: Consent = null) {
  let state = initial;
  const listeners = new Set<() => void>();
  const store: ConsentStore & { set(next: Consent): void } = {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (next) => {
      state = next;
      for (const listener of listeners) listener();
    },
  };
  return store;
}

async function start(consent?: ConsentStore) {
  const sdk = offlineSdk();
  const key = `phc_test_${++keyCounter}`;
  await analytics.initAnalytics(
    { key, host: "http://127.0.0.1:9", site: "openchart", consent },
    sdk.load,
  );
  return { ...sdk, key };
}

/** The sessionStorage names posthog-js has written for this key. */
function sessionNames(key: string) {
  return Object.keys(sessionStorage).filter((name) => name.includes(key));
}

/** The event a browser fires when it restores a page from the back-forward cache. */
function restoredFromCache() {
  const event = new Event("pageshow");
  Object.defineProperty(event, "persisted", { value: true });
  return event;
}

afterEach(() => {
  analytics.resetAnalyticsForTests();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe("without a key", () => {
  it("never loads the SDK and every call is a silent no-op", async () => {
    const sdk = offlineSdk();
    const warn = vi.spyOn(console, "warn");
    await analytics.initAnalytics({ key: "", site: "openchart" }, sdk.load);
    analytics.track(Events.exampleViewed);
    expect(sdk.load).not.toHaveBeenCalled();
    expect(sdk.captured("example_viewed")).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("consent", () => {
  it("sends events cookieless and stamped with the site before the visitor decides", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const sdk = await start(consentStore());
    analytics.track(Events.exampleViewed, { position: 1 });
    expect(sdk.captured("example_viewed").map((event) => event.properties)).toEqual([
      expect.objectContaining({ site: "openchart", position: 1, $cookieless_mode: true }),
    ]);
  });

  it("drops cookieless mode once the visitor accepts, keeping the site", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const store = consentStore();
    const sdk = await start(store);
    store.set("granted");
    analytics.track(Events.exampleViewed);
    const [event] = sdk.captured("example_viewed");
    expect(event?.properties.site).toBe("openchart");
    expect(event?.properties.$cookieless_mode).not.toBe(true);
  });

  it("goes back to cookieless when an accepted visitor declines", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const store = consentStore("granted");
    const sdk = await start(store);
    store.set("denied");
    analytics.track(Events.exampleViewed);
    expect(sdk.captured("example_viewed")[0]?.properties).toMatchObject({
      site: "openchart",
      $cookieless_mode: true,
    });
  });

  it("leaves no PostHog session storage behind after a withdrawal", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const store = consentStore("granted");
    const sdk = await start(store);
    analytics.track(Events.exampleViewed);
    expect(sessionNames(sdk.key)).toContain(`ph_${sdk.key}_window_id`);
    store.set(null);
    expect(sessionNames(sdk.key)).toEqual([]);
  });

  it("withdraws on a page restored from the cache after a decline on a sibling site", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const sdk = await start(consentStore("granted"));
    analytics.track(Events.exampleViewed);
    // The decline elsewhere cleared PostHog's shared consent cookie; this page's
    // store still says granted, since it was frozen in the cache.
    sdk.instance.clear_opt_in_out_capturing();
    window.dispatchEvent(restoredFromCache());
    analytics.track(Events.exampleViewed, { position: 2 });
    expect(sdk.captured("example_viewed").at(-1)?.properties).toMatchObject({
      position: 2,
      $cookieless_mode: true,
    });
    expect(sessionNames(sdk.key)).toEqual([]);
  });
});

describe("the queue", () => {
  it("replays calls made before the SDK loads, in order", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const sdk = offlineSdk();
    const init = analytics.initAnalytics({ key: "phc_queue", site: "openchart" }, sdk.load);
    analytics.track(Events.exampleViewed, { position: 1 });
    analytics.track(Events.exampleViewed, { position: 2 });
    await init;
    expect(sdk.captured("example_viewed").map((event) => event.properties.position)).toEqual([
      1, 2,
    ]);
  });

  it("keeps the first 50 calls made before init and warns once", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const sdk = offlineSdk();
    const init = analytics.initAnalytics({ key: "phc_limit", site: "openchart" }, sdk.load);
    for (let i = 0; i < 60; i++) analytics.track(Events.exampleViewed, { i });
    await init;
    expect(sdk.captured("example_viewed")).toHaveLength(50);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("turns analytics off when the SDK fails to load", async () => {
    const blocked = vi.fn(() => Promise.reject(new Error("blocked")));
    const init = analytics.initAnalytics({ key: "phc_blocked", site: "openchart" }, blocked);
    analytics.track(Events.exampleViewed, { position: 1 });
    await expect(init).resolves.toBeUndefined();
    // A later init starts clean: nothing queued before the failure is replayed.
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const sdk = await start();
    expect(sdk.captured("example_viewed")).toEqual([]);
  });

  it("initializes once across repeated calls", async () => {
    const sdk = offlineSdk();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const config = { key: "phc_once", site: "openchart" };
    await Promise.all([
      analytics.initAnalytics(config, sdk.load),
      analytics.initAnalytics(config, sdk.load),
    ]);
    expect(sdk.load).toHaveBeenCalledTimes(1);
  });
});

// The module sends nothing until the layout calls it, so check that wiring.
describe("wiring", () => {
  it("BaseLayout.astro calls initAnalytics for the openchart site with the consent store", () => {
    const imported =
      /import\s*\{[^}]*\binitAnalytics\b[^}]*\}\s*from\s*["'][^"']*lib\/analytics["']/;
    expect(entrySource).toMatch(imported);
    expect(entrySource).toMatch(/\binitAnalytics\(\{[^}]*site:\s*"openchart"[^}]*consent/s);
  });
});
