/**
 * Test-only harness used by `src/lib/analytics.test.ts`: boots the real `posthog-js`
 * offline through `analytics.ts`'s `load` seam, intercepts its transport and CDN
 * script loader, and records post-`before_send` payloads without making network calls.
 */

import type { CaptureResult, PostHog, PostHogConfig } from "posthog-js";
import { project, type RemoteConfig } from "./posthog-remote-config";

/** A fully enriched event as `before_send` sees it. */
export type CapturedEvent = CaptureResult;

type InitConfig = Partial<PostHogConfig>;
type PostHogModule = Pick<PostHog, "init">;
type BeforeSend = PostHogConfig["before_send"];
type BeforeSendFn = Exclude<BeforeSend, unknown[] | undefined>;

/** happy-dom reports an automated user agent; without this every event drops. */
export const TEST_DOM_OVERRIDES = { opt_out_useragent_filter: true } as const;

/** Config that keeps the real SDK offline and synchronous. */
export const OFFLINE_OVERRIDES = {
  /**
   * No script from PostHog's CDN. The harness answers the one every page needs, remote
   * config, itself; a test that wants the recorder imports its bundle.
   */
  disable_external_dependency_loading: true,
  ...TEST_DOM_OVERRIDES,
} as const;

type ServedConfig = { config: RemoteConfig; siteApps: unknown[] };
type Transport = {
  remoteConfig: RemoteConfig;
  requests: string[];
  scripts: string[];
};
type Done = (error?: unknown) => void;
type Loader = (instance: PostHog, name: string, done: Done) => void;
type PostHogWindow = {
  __PosthogExtensions__?: { loadExternalDependency?: Loader };
  _POSTHOG_REMOTE_CONFIG?: Record<string, ServedConfig>;
};

const transports = new Map<string, Transport>();
const patched = new WeakSet<object>();

function isSdk(value: unknown): value is PostHog {
  if (typeof value !== "object" || value === null) return false;
  return "_send_request" in value;
}

function transportFor(token: string): Transport {
  const transport = transports.get(token);
  if (!transport) {
    throw new Error(`posthog-js used ${token}, which no pipeline set up`);
  }
  return transport;
}

/**
 * Replaces posthog-js's transport and its CDN script loader, which every instance
 * shares, once per prototype. Requests are recorded per token and dropped, except the
 * remote config JSON, which gets the pipeline's config. Script loads are recorded; the
 * remote-config one does what PostHog's `/array/<token>/config.js` does when it loads.
 */
function installTransport(posthog: PostHogModule) {
  const sdk: unknown = Object.getPrototypeOf(posthog);
  if (!isSdk(sdk)) throw new Error("posthog-js's export isn't a PostHog");
  if (patched.has(sdk)) return;
  patched.add(sdk);
  sdk._send_request = function (this: PostHog, options) {
    const transport = transportFor(this.config.token);
    transport.requests.push(options.url);
    if (options.url.includes(`/array/${this.config.token}/config`)) {
      options.callback?.({ statusCode: 200, json: transport.remoteConfig });
    }
  };
  // posthog-js keeps its CDN loader on window; the cast stays in this helper.
  const page = window as unknown as PostHogWindow;
  const extensions = page.__PosthogExtensions__;
  const load = extensions?.loadExternalDependency;
  if (!extensions || !load) throw new Error("posthog-js has no CDN loader");
  extensions.loadExternalDependency = (instance, name, done) => {
    const token = instance.config.token;
    const transport = transportFor(token);
    transport.scripts.push(name);
    if (name !== "remote-config") return load(instance, name, done);
    page._POSTHOG_REMOTE_CONFIG = {
      ...page._POSTHOG_REMOTE_CONFIG,
      [token]: { config: transport.remoteConfig, siteApps: [] },
    };
    done();
  };
}

export type PostHogPipeline = {
  /** Pass as initAnalytics' `load`: the real module, with init wrapped. */
  load: () => Promise<{ default: PostHogModule }>;
  /** The live instance init returned. Throws before init has run. */
  posthog(): PostHog;
  /** The config the caller passed to init, before the wrapper changed it. */
  initConfig(): InitConfig;
  /** The URLs of the requests posthog-js made for this pipeline's token, in order. */
  requests(): string[];
  /** The scripts posthog-js asked its CDN for, by name, in order. */
  scripts(): string[];
  /** Post-`before_send` payloads, in capture order, optionally by name. */
  captured(name?: string): CapturedEvent[];
  /**
   * The one event with this name, or a throw. Indexing `captured(name)[0]` both
   * fails `noUncheckedIndexedAccess` and turns "the event was dropped" into
   * "cannot read properties of undefined".
   */
  only(name: string): CapturedEvent;
  /** Drop everything recorded so far. */
  clear(): void;
  /**
   * Leave the page the way a browser does: stop recording and fire `pagehide` and
   * `beforeunload`, which make posthog-js write its pending persistence and drop its
   * primary-window marker. Storage stays, so the next page can read it.
   */
  leavePage(): void;
  /** Clear persistence and stop recording. Call in `afterEach`. */
  shutdown(): void;
};

let instanceCounter = 0;

function runBeforeSend(hook: BeforeSend, event: CaptureResult | null) {
  if (hook === undefined) return event;
  const hooks: BeforeSendFn[] = Array.isArray(hook) ? hook : [hook];
  let current = event;
  for (const fn of hooks) current = current ? fn(current) : null;
  return current;
}

/**
 * An isolated, named PostHog instance, so tests cannot leak super properties or
 * opt-in state into one another through posthog-js's singleton. Persistence and the
 * stored consent are keyed by the token, so give each test its own key unless it
 * means to share them.
 */
export function createPostHogPipeline(
  posthog: PostHogModule,
  { remoteConfig = project }: { remoteConfig?: RemoteConfig } = {},
): PostHogPipeline {
  installTransport(posthog);
  const transport: Transport = { remoteConfig, requests: [], scripts: [] };
  const name = `pipeline_test_${++instanceCounter}`;
  const captured: CapturedEvent[] = [];
  let recording = true;
  let client: PostHog | undefined;
  let received: InitConfig | undefined;

  const wrapped: PostHogModule = {
    init: (token, config) => {
      received = config;
      transports.set(token, transport);
      client = posthog.init(
        token,
        {
          ...config,
          before_send: (event) => {
            const result = runBeforeSend(config?.before_send, event);
            if (result && recording) captured.push(result);
            // Never send: a real fetch per capture leaves requests in flight on teardown.
            return null;
          },
          ...OFFLINE_OVERRIDES,
        },
        name,
      );
      return client;
    },
  };

  const named = (event?: string) =>
    captured.filter((e) => event === undefined || e.event === event);

  const live = () => {
    if (!client) throw new Error(`posthog.init has not run for ${name}`);
    return client;
  };

  return {
    load: async () => ({ default: wrapped }),
    posthog: live,
    requests: () => [...transport.requests],
    scripts: () => [...transport.scripts],
    initConfig: () => {
      if (!received) throw new Error(`posthog.init has not run for ${name}`);
      return received;
    },
    captured: named,
    only: (eventName) => {
      const matches = named(eventName);
      const [match] = matches;
      if (!match || matches.length > 1) {
        const count = matches.length;
        throw new Error(`expected exactly one ${eventName}, got ${count}`);
      }
      return match;
    },
    clear: () => {
      captured.length = 0;
    },
    leavePage: () => {
      recording = false;
      window.dispatchEvent(new Event("pagehide"));
      window.dispatchEvent(new Event("beforeunload"));
    },
    shutdown: () => {
      recording = false;
      client?.reset(true);
    },
  };
}
