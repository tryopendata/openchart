/**
 * The only module that imports posthog-js. Analytics is off, and the SDK never
 * loads, while the key is empty: the normal state in dev, tests, CI and sandboxes.
 * The caller reads env and passes it in, so this module never touches import.meta.env.
 *
 * Consent: the visitor's Steamfield banner choice (the shared `sf-consent` cookie,
 * read through a consent store) decides, and PostHog's own consent state follows
 * it. Until the visitor accepts, PostHog runs cookieless and stores nothing.
 */

import type { BeforeSendFn, PostHog } from "posthog-js";
import type { EventName, EventProps } from "./events";

/** The visitor's decision: null while undecided. */
export type Consent = "granted" | "denied" | null;

/** The part of @steamfield/ui/consent's store this module reads. */
export type ConsentStore = {
  getState(): Consent;
  subscribe(listener: () => void): () => void;
};

/** What the layout passes in from env and the page's consent store. */
export type AnalyticsConfig = {
  key: string | undefined;
  /** Empty means PostHog US cloud. */
  host?: string | undefined;
  /** Stamped as `site` on every event, so one PostHog project can tell the sites apart. */
  site: string;
  /** Without a store PostHog's own consent record decides, which stays cookieless here. */
  consent?: ConsentStore | undefined;
};

type Loader = () => Promise<{ default: Pick<PostHog, "init"> }>;
type Client = Pick<
  PostHog,
  "capture" | "opt_in_capturing" | "clear_opt_in_out_capturing" | "get_explicit_consent_status"
>;
type Call = (client: Client) => void;

// Calls made before the SDK loads wait here, up to a limit.
const QUEUE_LIMIT = 50;
let client: Client | undefined;
let queue: Call[] | undefined;
let warned = false;

function send(call: Call) {
  if (client) return call(client);
  if (!queue) return; // Not initialized, or no key: a silent no-op.
  if (queue.length >= QUEUE_LIMIT) {
    if (!warned) console.warn("analytics: queue full, dropping calls");
    warned = true;
    return;
  }
  queue.push(call);
}

// Granted opts PostHog in (cookies on). Undecided and declined both return it to
// pending, which with opt_out_capturing_by_default means cookieless and no storage.
function applyConsent(c: Client, consent: Consent) {
  const status = c.get_explicit_consent_status();
  if (consent === "granted") {
    if (status !== "granted") c.opt_in_capturing();
    return;
  }
  if (status !== "pending") c.clear_opt_in_out_capturing();
}

// A registered super property isn't enough: opt_in_capturing() resets super
// properties and captures $opt_in and a $pageview before it returns.
function stampSite(site: string): BeforeSendFn {
  return (event) => (event ? { ...event, properties: { ...event.properties, site } } : null);
}

function onLoaded(instance: Client, store: ConsentStore | undefined) {
  if (store) {
    applyConsent(instance, store.getState());
    store.subscribe(() => send((c) => applyConsent(c, store.getState())));
  }
  client = instance;
  for (const call of queue ?? []) call(instance);
  queue = undefined;
}

/** Loads posthog-js and starts capturing, once per page; does nothing without a key. */
export async function initAnalytics(
  config: AnalyticsConfig,
  load: Loader = () => import("posthog-js"),
): Promise<void> {
  const { key } = config;
  if (!key || typeof window === "undefined" || queue || client) return;
  queue = [];
  let posthog: Pick<PostHog, "init">;
  try {
    ({ default: posthog } = await load());
  } catch {
    // An ad blocker or a network failure stopped the SDK: analytics is optional, so
    // drop the queue and leave it off; later calls are no-ops and nothing rejects.
    queue = undefined;
    return;
  }
  posthog.init(key, {
    api_host: config.host || "https://us.i.posthog.com",
    defaults: "latest",
    person_profiles: "identified_only",
    capture_pageview: "history_change",
    // Cookieless until the visitor accepts; then cookies shared across steamfield.io.
    cookieless_mode: "on_reject",
    opt_out_capturing_by_default: true,
    persistence: "localStorage+cookie",
    cross_subdomain_cookie: true,
    // PostHog's consent record sits beside its identity cookie on .steamfield.io, so a
    // grant on a sibling site doesn't opt the visitor in again under a new id.
    opt_out_capturing_persistence_type: "cookie",
    autocapture: false,
    disable_session_recording: true,
    before_send: stampSite(config.site),
    loaded: (instance) => onLoaded(instance, config.consent),
  });
}

/** Captures one catalog event, queued until the SDK has loaded. */
export function track(event: EventName, props?: EventProps): void {
  send((c) => c.capture(event, props));
}

/** Tests only: forget the client and the queue between cases. */
export function resetAnalyticsForTests(): void {
  client = undefined;
  queue = undefined;
  warned = false;
}
